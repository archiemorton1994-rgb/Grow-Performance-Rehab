import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from '@expo-google-fonts/inter';
import { QueryClientProvider } from '@tanstack/react-query';
import { Stack, router, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import React, { useEffect, useState, useRef } from 'react';
import { AppState, AppStateStatus, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LayoutAnimationConfig } from 'react-native-reanimated';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as Notifications from 'expo-notifications';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { queryClient } from '@/lib/query-client';
import { useAppStore } from '@/lib/store';
import { AuthProvider, useAuth } from '@/lib/auth-context';
import {
  scheduleWorkoutReminder,
  reminderAudienceFor,
  scheduleMissedWorkoutNudge,
  scheduleStreakProtectionAlert,
  cancelStreakProtectionAlert,
} from '@/lib/notifications';
import { BADGE_MAP, Badge, TOUR_WELCOME_BADGE_ID } from '@/lib/badges';
import AchievementUnlockedSheet from '@/components/AchievementUnlockedSheet';

/** A toast queue item: either an individual badge or a batched-summary token. */
type SummaryToast = { readonly isSummary: true; count: number; badgeIds: string[] };
type ToastItem = Badge | SummaryToast;
const isSummaryToast = (t: ToastItem): t is SummaryToast =>
  'isSummary' in t && (t as { isSummary?: unknown }).isSummary === true;

if (!__DEV__) {
  type EUType = {
    getGlobalHandler: () => (e: Error, fatal?: boolean) => void;
    setGlobalHandler: (h: (e: Error, fatal?: boolean) => void) => void;
  };
  const EU = (global as unknown as { ErrorUtils?: EUType }).ErrorUtils;
  if (EU) {
    const defaultHandler = EU.getGlobalHandler();
    EU.setGlobalHandler((error: Error, isFatal?: boolean) => {
      const entry = JSON.stringify({
        ts: new Date().toISOString(),
        fatal: isFatal,
        msg: error?.message,
        stack: error?.stack?.slice(0, 1200),
      });
      AsyncStorage.setItem('__last_crash__', entry).then(
        () => defaultHandler(error, isFatal),
        () => defaultHandler(error, isFatal)
      );
    });
  }

  // On every launch: read the previous crash log from AsyncStorage and POST it
  // to the server so it appears in deployment logs. Fires at module-load time
  // (~100ms), long before the ~700ms crash, so the write completes reliably.
  const _domain = process.env.EXPO_PUBLIC_DOMAIN || 'grow-performance-rehab.replit.app';
  AsyncStorage.getItem('__last_crash__')
    .then((val) => {
      if (!val) return;
      fetch(`https://${_domain}/api/crash-log`, {
        method: 'POST',
        body: val,
        headers: { 'Content-Type': 'text/plain' },
      }).catch(() => {});
    })
    .catch(() => {});
}

if (Platform.OS !== 'web') {
  SplashScreen.preventAutoHideAsync().catch(() => {});
}

if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

/**
 * THE WEEKLY WEIGHT PROMPT IS GONE.
 *
 * It was a root-level Modal that re-armed whenever completedSessions changed,
 * so the app asked for a bodyweight on opening, again after onboarding, and
 * again after the first session. Testers reported all three, and when the user
 * had never set a weight it could not be dismissed at all.
 *
 * Bodyweight is asked ONCE now, during onboarding, where answering is optional.
 * Keeping it fresh is handled without interrupting anyone: the assistant on
 * Home already carries a "Your logged weight is getting old" message with an
 * Update action, Profile shows a dot on Settings when it goes stale, and there
 * is an opt-in reminder notification. A recurring modal on top of three
 * existing channels was not a fourth reminder, it was a nag.
 */

// Screens that manage their own navigation after a user action (e.g. completing
// a session). The gate must never redirect away from these screens — doing so
// causes a race condition where router.replace('/(tabs)') fires after
// router.replace('/session-summary') and lands on the +not-found screen.
const TRANSIENT_SCREENS = new Set(['session', 'session-summary', 'readiness', 'custom-session']);

function RootLayoutNav() {
  // Field-by-field selectors, deliberately. A bare useAppStore() subscribes to
  // the WHOLE store, so this navigator - the component wrapping every screen in
  // the app - re-rendered on every set logged, every note keystroke and every
  // autosave. There were four such calls in here.
  const onboardingComplete = useAppStore((s) => s.onboardingComplete);
  const showcaseComplete = useAppStore((s) => s.showcaseComplete);
  const hasHydrated = useAppStore((s) => s.hasHydrated);
  const { isLoading, isAuthenticated, hasActiveSubscription } = useAuth();
  const segments = useSegments();
  const currentPath = segments.join('/');
  // True while the user is on any screen that drives its own post-action
  // navigation (session → session-summary, readiness → session, etc.).
  const isOnTransientScreen = segments.some((s) => TRANSIENT_SCREENS.has(s));

  // ─── Badge toast queue (root-level so it floats above all screens) ────────
  const newlyUnlockedBadges = useAppStore((s) => s.newlyUnlockedBadges);
  const clearNewlyUnlockedBadges = useAppStore((s) => s.clearNewlyUnlockedBadges);
  const [toastQueue, setToastQueue] = useState<ToastItem[]>([]);
  const [currentToast, setCurrentToast] = useState<ToastItem | null>(null);
  // Dedup guard for which ids have already been turned into a toastQueue entry.
  // Kept as a ref (fine - only ever read/written by the enqueue effect itself,
  // never used to gate the clear effect below, which is what used to race it).
  const enqueuedBadgeIds = useRef<Set<string>>(new Set());
  // Whether the enqueue effect has handed at least one badge to toastQueue that
  // the clear effect hasn't accounted for yet. This MUST be state, not a ref -
  // the clear effect needs to read it from the same render's snapshot as
  // toastQueue/currentToast. A ref mutated synchronously inside the enqueue
  // effect was already updated by the time the clear effect ran in the same
  // commit, while toastQueue/currentToast were still their pre-update values -
  // so the clear effect saw "nothing queued yet" and "already marked handled"
  // simultaneously and wiped newlyUnlockedBadges before the toast ever showed.
  const [hasQueuedWork, setHasQueuedWork] = useState(false);

  // Only drain the queue once the user has passed all gate screens (onboarding /
  // auth / subscription). Badges earned during those flows accumulate silently
  // and are delivered as a single moment when the user first reaches the tabs.
  const inMainApp = !isLoading && onboardingComplete && isAuthenticated && hasActiveSubscription;
  // Extra guard: also confirm the router has actually landed somewhere safe to
  // show a toast, so it never fires on top of a gate screen (auth,
  // subscription) even when hasActiveSubscription briefly becomes true before
  // navigation.
  //
  // (tabs) ONLY — deliberately NOT session-summary.
  //
  // session-summary is declared with presentation: 'fullScreenModal' (see the
  // Stack below), which on iOS is a real native modal presentation, not just a
  // styled screen. The achievement sheet is a native <Modal> too. Presenting
  // one over the other is two native modals at once, which breaks touch routing
  // on BOTH: the screen paints perfectly and nothing responds to taps, with no
  // crash and no error screen. That is the "app is frozen after finishing a
  // session" report, and it is the third time this same collision has bitten —
  // see tests/root-modal-exclusivity.check.mjs for the other two.
  //
  // It hid for so long because it only fires when a session actually unlocks a
  // badge. On an established account most sessions unlock nothing, so the flow
  // tested clean; a fresh account's first session unlocks five at once and
  // hits it every time.
  //
  // The cost is that the celebration lands a moment later, when the user
  // returns to the tabs, instead of on the summary screen. The queue is drained
  // in order and nothing is lost.
  //
  // This is ONE rule about root-level Modals, not a rule about badges, and it
  // is named accordingly because it was previously applied to the badge toast
  // alone. The weekly weight prompt below deferred only against the toast, so
  // it happily presented over session-summary — and its trigger is
  // `completedSessions.length > 0` with no prompt yet recorded, which first
  // becomes true at the instant a user finishes their FIRST session. Same
  // collision, same dead screen, guaranteed on every new account rather than
  // only on the ones that unlocked a badge. Anything root-level and modal goes
  // through this gate.
  const canShowRootModal = segments[0] === '(tabs)';

  useEffect(() => {
    if (newlyUnlockedBadges.length === 0) return;
    const newIds = newlyUnlockedBadges.filter((id) => !enqueuedBadgeIds.current.has(id));
    if (newIds.length === 0) return;
    newIds.forEach((id) => enqueuedBadgeIds.current.add(id));
    if (newIds.length >= 2) {
      // Batch simultaneous unlocks into a single summary toast so the user
      // doesn't get a parade of sequential pop-ups (especially on first use).
      setToastQueue((q) => [
        ...q,
        { isSummary: true as const, count: newIds.length, badgeIds: newIds },
      ]);
    } else {
      const badge = BADGE_MAP.get(newIds[0]);
      if (badge) setToastQueue((q) => [...q, badge]);
    }
    // ALWAYS, even when nothing could be queued.
    //
    // This used to sit inside each branch, so an id that BADGE_MAP could not
    // resolve — a badge renamed or retired while a queue referencing it was in
    // flight — consumed the id into enqueuedBadgeIds and queued nothing. The
    // cleanup effect below is gated on hasQueuedWork, so it never ran, and
    // newlyUnlockedBadges stayed non-empty for the rest of the process.
    //
    // That is not a cosmetic loss. The guided-tour intro is gated on
    // `newlyUnlockedBadges.length === 0` — deliberately, so the two root Modals
    // can never present together — so a queue that cannot drain silently
    // suppresses the tour forever. The user lands on Home after onboarding, no
    // tour appears, nothing happens, and because this queue is deliberately NOT
    // persisted a restart is the only thing that clears it. Reported as "frozen
    // on the home screen, only way to proceed is a restart", with no pop-up on
    // screen — which is exactly the shape of a queue that will not drain.
    //
    // Marking the work as queued regardless means the cleanup always runs and
    // the ids always clear, whether or not anything was presentable.
    setHasQueuedWork(true);
  }, [newlyUnlockedBadges]);

  useEffect(() => {
    if (!inMainApp) return;
    if (!canShowRootModal) return; // don't pop toasts on gate screens before navigation completes
    if (currentToast || toastQueue.length === 0) return;
    const [next, ...rest] = toastQueue;
    setToastQueue(rest);
    setCurrentToast(next);
  }, [inMainApp, canShowRootModal, currentToast, toastQueue]);

  useEffect(() => {
    if (currentToast !== null || toastQueue.length > 0) return;
    if (!hasQueuedWork) return;
    enqueuedBadgeIds.current.clear();
    setHasQueuedWork(false);
    clearNewlyUnlockedBadges();
  }, [currentToast, toastQueue, hasQueuedWork, clearNewlyUnlockedBadges]);
  // ──────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (isLoading) return;
    // onboardingComplete defaults to false until AsyncStorage rehydration
    // finishes. isLoading (auth) can resolve first — with no stored token
    // that's near-instant — so without this guard the gate could make its
    // navigation decision on the stale default, bouncing a genuinely
    // already-onboarded user back into onboarding.
    if (!hasHydrated) return;
    // Never redirect away from screens that manage their own post-action
    // navigation (e.g. session → session-summary). A store update inside
    // completeSession() can re-trigger this effect before session-summary
    // has mounted, causing the router to land on the +not-found screen.
    if (isOnTransientScreen) return;

    // Re-evaluate on every relevant state change (not just once) — this must
    // keep enforcing itself for the life of the session, not just at launch:
    // a subscription can expire, a token can be cleared, and gate screens
    // (onboarding, auth, subscription) intentionally don't navigate
    // themselves — they update their own piece of state and rely entirely on
    // this effect to route forward. A one-shot guard here previously meant
    // the gate's very first decision (redirecting a fresh user to
    // /onboarding) permanently disabled it, silently letting anyone who
    // finished onboarding through to the tabs without ever being required to
    // sign in or subscribe.
    let timer: ReturnType<typeof setTimeout> | undefined;
    if (!onboardingComplete) {
      if (currentPath !== 'onboarding') timer = setTimeout(() => router.replace('/onboarding'), 0);
    } else if (!isAuthenticated) {
      if (currentPath !== 'auth') timer = setTimeout(() => router.replace('/auth'), 0);
    } else if (!hasActiveSubscription && !showcaseComplete) {
      /**
       * SHOW THE APP BEFORE ASKING ANYONE TO PAY FOR IT.
       *
       * The order used to be onboarding, sign in, PAY, and only then the guided
       * tour and the practice session. Every download invested ten minutes and
       * handed over card details before experiencing a single thing Grow does.
       *
       * The showcase and the offer sit outside (tabs) on purpose. Moving the tab
       * tour in front of the gate would have meant an unsubscribed user was
       * inside the app, and anyone who skipped the tour was simply in. The
       * practice session the showcase ends on is a root-level route in demo
       * mode, which cannot write to the store, so nothing is exposed and the
       * paywall keeps exactly the reach it had.
       *
       * The offer screen is not redirected away from: it is the second half of
       * this same flow. It marks the showcase seen on mount, so this branch
       * stops applying the moment it is reached.
       */
      if (currentPath !== 'showcase' && currentPath !== 'offer') {
        timer = setTimeout(() => router.replace('/showcase'), 0);
      }
    } else if (!hasActiveSubscription) {
      if (currentPath !== 'subscription') timer = setTimeout(() => router.replace('/subscription'), 0);
    } else if (
      currentPath === 'onboarding' ||
      currentPath === 'auth' ||
      currentPath === 'subscription' ||
      currentPath === 'showcase' ||
      currentPath === 'offer'
    ) {
      // Only force into the tabs from a gate screen — once the user is fully
      // cleared and already somewhere else in the app (tabs, achievements,
      // program, etc.), leave navigation alone.
      timer = setTimeout(() => router.replace('/(tabs)'), 0);
    } else if (currentPath === '') {
      // Empty segments means either a genuine cold start (no route resolved
      // yet) or, on web, a brief transient while a hard-loaded deep link
      // (e.g. refreshing the browser on /profile) is still resolving its
      // real path from the URL. Wait longer than the 0ms used above so a
      // resolving deep link has a chance to update currentPath first — that
      // re-runs this effect and the cleanup below cancels this timer before
      // it fires, instead of forcing the tabs root and stranding the
      // refreshed page on Home before its real destination ever resolves.
      timer = setTimeout(() => router.replace('/(tabs)'), 300);
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [
    isLoading,
    hasHydrated,
    onboardingComplete,
    showcaseComplete,
    isAuthenticated,
    hasActiveSubscription,
    isOnTransientScreen,
    currentPath,
  ]);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    const sub = Notifications.addNotificationResponseReceivedListener(() => {
      if (isAuthenticated && hasActiveSubscription) {
        router.push('/(tabs)');
      }
    });
    return () => sub.remove();
  }, [isAuthenticated, hasActiveSubscription]);

  const reminderEnabled = useAppStore((s) => s.reminderEnabled);
  const reminderTime = useAppStore((s) => s.reminderTime);
  const activeSession = useAppStore((s) => s.activeSession);
  const clearActiveSession = useAppStore((s) => s.clearActiveSession);

  /**
   * A half-finished session is kept for a WEEK, not a day.
   *
   * At 24 hours this deleted, with no warning and no notice, the sets of anyone
   * who started on Saturday morning, got interrupted, and opened the app on
   * Sunday. They came back to nothing and no explanation. Home already offers
   * both answers on that card - Resume, and an X to start fresh - so the
   * choice existed; the automatic delete was taking it away before the user
   * ever saw it.
   *
   * A week rather than forever, because after that the prescription genuinely
   * is stale, and the load maths already backs the weights off after a layoff
   * (see getLayoff), so resuming a fortnight-old session would train against
   * numbers the app has since moved on from. Seven days is long enough that
   * nobody loses a session to ordinary life, and short enough that nothing
   * ancient is offered.
   *
   * tests/session-resume-fidelity.check.mjs pins this window and the card that
   * shows its age.
   */
  useEffect(() => {
    if (!hasHydrated) return;
    if (activeSession?.savedAt) {
      const age = Date.now() - new Date(activeSession.savedAt).getTime();
      if (age > ACTIVE_SESSION_MAX_AGE_MS) {
        clearActiveSession();
      }
    }
  }, [hasHydrated, activeSession, clearActiveSession]);

  /**
   * The daily reminder now says something different to somebody who cannot open
   * a session.
   *
   * "Your session is ready. Let's go." fired every day for everybody with
   * reminders on, including people the gate sends straight to the paywall. They
   * tap it, hit a paywall, and learn to ignore the app's notifications, which
   * is a worse outcome than not sending it.
   *
   * Same alarm, same time they chose, different words. Re-scheduled when the
   * subscription state changes, or the message would be whatever it was on the
   * day it was set.
   */
  const hasEverSubscribed = useAppStore((s) => s.hasEverSubscribed);
  const markHasSubscribed = useAppStore((s) => s.markHasSubscribed);
  const reminderPromptKind = useAppStore((s) => s.reminderPromptKind);
  const reminderPromptSince = useAppStore((s) => s.reminderPromptSince);
  const noteReminderAudience = useAppStore((s) => s.noteReminderAudience);
  useEffect(() => {
    if (hasActiveSubscription) markHasSubscribed();
  }, [hasActiveSubscription, markHasSubscribed]);

  const reminderAudience = reminderAudienceFor(hasActiveSubscription, hasEverSubscribed);
  useEffect(() => {
    if (!hasHydrated) return;
    noteReminderAudience(reminderAudience, new Date().toISOString());
  }, [hasHydrated, reminderAudience, noteReminderAudience]);

  useEffect(() => {
    if (!hasHydrated || Platform.OS === 'web') return;
    if (reminderEnabled) {
      scheduleWorkoutReminder(
        reminderTime,
        reminderAudience,
        reminderPromptKind === reminderAudience ? reminderPromptSince : null
      ).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasHydrated, reminderAudience, reminderPromptKind, reminderPromptSince]);

  const nudgeEnabled = useAppStore((s) => s.nudgeEnabled);
  const streakProtectionEnabled = useAppStore((s) => s.streakProtectionEnabled);
  const streakProtectionTime = useAppStore((s) => s.streakProtectionTime);
  const completedSessions = useAppStore((s) => s.completedSessions);
  const getStreakDays = useAppStore((s) => s.getStreakDays);
  const weeklyStreakGoal = useAppStore((s) => s.weeklyStreakGoal);
  const getThisWeekCount = useAppStore((s) => s.getThisWeekCount);

  useEffect(() => {
    if (!hasHydrated || Platform.OS === 'web' || !isAuthenticated || !hasActiveSubscription) return;
    if (nudgeEnabled) {
      scheduleMissedWorkoutNudge().catch(() => {});
    }
    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (next === 'active' && nudgeEnabled) {
        scheduleMissedWorkoutNudge().catch(() => {});
      }
    });
    return () => sub.remove();
  }, [hasHydrated, isAuthenticated, hasActiveSubscription, nudgeEnabled]);

  useEffect(() => {
    if (!hasHydrated || Platform.OS === 'web' || !isAuthenticated || !hasActiveSubscription) return;
    const streak = getStreakDays();
    const weekCount = getThisWeekCount();
    if (streakProtectionEnabled && streak >= 2) {
      scheduleStreakProtectionAlert(streakProtectionTime, weeklyStreakGoal, weekCount).catch(
        () => {}
      );
    } else {
      cancelStreakProtectionAlert().catch(() => {});
    }
    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (next !== 'active') return;
      const state = useAppStore.getState();
      const streakNow = state.getStreakDays();
      const weekCountNow = state.getThisWeekCount();
      if (state.streakProtectionEnabled && streakNow >= 2) {
        scheduleStreakProtectionAlert(
          state.streakProtectionTime,
          state.weeklyStreakGoal,
          weekCountNow
        ).catch(() => {});
      } else {
        cancelStreakProtectionAlert().catch(() => {});
      }
    });
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    hasHydrated,
    isAuthenticated,
    hasActiveSubscription,
    streakProtectionEnabled,
    streakProtectionTime,
    weeklyStreakGoal,
    completedSessions,
  ]);

  return (
    <>
      <Stack screenOptions={{ headerBackTitle: 'Back' }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="onboarding" options={{ headerShown: false }} />
        <Stack.Screen name="auth" options={{ headerShown: false }} />
        <Stack.Screen name="showcase" options={{ headerShown: false }} />
        <Stack.Screen name="offer" options={{ headerShown: false }} />
        <Stack.Screen name="subscription" options={{ headerShown: false }} />
        <Stack.Screen name="readiness" options={{ headerShown: false }} />
        <Stack.Screen name="session" options={{ headerShown: false }} />
        <Stack.Screen
          name="session-summary"
          options={{ headerShown: false, presentation: 'fullScreenModal', gestureEnabled: false }}
        />
        {/* Presented as a sheet: it is the home-screen panel getting bigger,
            not a place you navigate to and lose your place from. */}
        <Stack.Screen
          name="assistant"
          options={{ headerShown: false, presentation: 'modal', animation: 'slide_from_bottom' }}
        />
        <Stack.Screen name="achievements" options={{ headerShown: false }} />
        <Stack.Screen name="program" options={{ headerShown: false }} />
        <Stack.Screen name="past-sessions" options={{ headerShown: false }} />
        {/* This one was missing, and every other screen in the app declares it.
            Without an entry the route falls back to the default navigator
            header — which renders the raw route name, so the screen showed a
            grey "custom-session" bar with a Back button directly above its own
            properly-designed header. Two headers, one of them showing a file
            path. */}
        <Stack.Screen name="custom-session" options={{ headerShown: false }} />
      </Stack>
      {currentToast &&
        (isSummaryToast(currentToast) ? (
          <AchievementUnlockedSheet
            badgeCount={currentToast.count}
            badges={currentToast.badgeIds.flatMap((id) => {
              const b = BADGE_MAP.get(id);
              return b ? [b] : [];
            })}
            sessionCount={completedSessions.length}
            onDismiss={() => setCurrentToast(null)}
          />
        ) : (
          <AchievementUnlockedSheet
            badgeCount={1}
            badgeName={currentToast.name}
            badges={[currentToast]}
            badgeColor={currentToast.color}
            sessionCount={completedSessions.length}
            /**
             * The tour's last beat.
             *
             * Welcome Aboard is awarded by the practice session's final button
             * and is the only badge in the app not earned by training. Sending
             * it to ?tour=1 opens the achievements screen with its explainer,
             * which is how the tour ends: a real badge lands, and then the
             * shelf it landed on is shown. Every other unlock goes to the plain
             * screen, because by then the user knows what this place is.
             */
            viewAllHref={
              currentToast.id === TOUR_WELCOME_BADGE_ID
                ? '/achievements?tour=1'
                : '/achievements'
            }
            onDismiss={() => setCurrentToast(null)}
          />
        ))}
    </>
  );
}

/**
 * How long a half-finished session survives before the app throws it away.
 *
 * Was 24 hours, which deleted the sets of anyone who started on Saturday and
 * opened the app on Sunday. Named and exported so the contract test pins the
 * window rather than a magic number, and so the notification ladder can ask
 * whether a rung fires after it.
 */
export const ACTIVE_SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });
  useEffect(() => {
    if (fontsLoaded || fontError || Platform.OS === 'web') {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [fontsLoaded, fontError]);

  /**
   * THE ON-DEVICE CRASH LOG IS GONE. The reporting is not.
   *
   * After any crash, the next launch used to open on a black full-screen panel
   * headed "Last Crash Log" in red, showing a timestamp, a `fatal` flag, the
   * internal error message and up to 1200 characters of JavaScript stack trace,
   * above a Dismiss button.
   *
   * The part that made it dangerous rather than merely ugly: the handler that
   * WRITES __last_crash__ is gated to production builds, so this screen was
   * invisible in Expo Go and in every dev build. The only people who could ever
   * see it were paying customers and App Review — for whom it reads as a
   * catastrophically broken app, and is a straight Guideline 2.1 rejection for
   * shipping developer diagnostic content.
   *
   * It was also a third uncoordinated root Modal, able to present alongside the
   * weekly weigh-in prompt and freeze the app on launch.
   *
   * Nothing is lost by removing it: the crash is POSTed to /api/crash-log at
   * module load (see the top of this file), which is where it should be read.
   */
  if (!fontsLoaded && !fontError && Platform.OS !== 'web') {
    return null;
  }

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <GestureHandlerRootView style={{ flex: 1 }}>
          {/* Reanimated's web layout-animation renderer can get entering
              views stuck at their pre-animation visibility:hidden state on
              first mount (a known rough edge of its web support, distinct
              from its native UI-thread implementation). Skip entering/exiting
              animations on web entirely rather than risk a blank screen -
              native is unaffected since this only applies on that platform. */}
          <LayoutAnimationConfig skipEntering={Platform.OS === 'web'}>
            <AuthProvider>
              <RootLayoutNav />
            </AuthProvider>
          </LayoutAnimationConfig>
        </GestureHandlerRootView>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
