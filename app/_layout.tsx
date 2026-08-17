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
import React, { useEffect, useState, useMemo, useRef } from 'react';
import {
  AppState,
  AppStateStatus,
  Modal,
  View,
  Text,
  Pressable,
  TextInput,
  StyleSheet,
  Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LayoutAnimationConfig } from 'react-native-reanimated';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';
import * as Notifications from 'expo-notifications';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { GrowIcon } from '@/components/GrowIcon';
import { queryClient } from '@/lib/query-client';
import { useAppStore } from '@/lib/store';
import { AuthProvider, useAuth } from '@/lib/auth-context';
import { useColors } from '@/constants/colors';
import { kgToDisplayUnit, displayUnitToKg } from '@/lib/utils';
import {
  scheduleWorkoutReminder,
  scheduleMissedWorkoutNudge,
  scheduleStreakProtectionAlert,
  cancelStreakProtectionAlert,
} from '@/lib/notifications';
import { BADGE_MAP, Badge } from '@/lib/badges';
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

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * `deferred` holds this modal back while another root-level Modal is on screen.
 *
 * Two native Modals presented at once break touch routing on BOTH of them and
 * the whole app reads as frozen — see the same note in (tabs)/_layout.tsx,
 * which already guards the tour intro against the achievement toast. This
 * prompt was the unguarded third: its effect keys off completedSessions.length,
 * so it re-arms on every session completion, which is exactly when a badge
 * toast is most likely to be up.
 */
function WeeklyWeightPrompt({ deferred = false }: { deferred?: boolean }) {
  const C = useColors();
  const {
    hasHydrated,
    lastWeightPromptedAt,
    setLastWeightPromptedAt,
    userProfile,
    setUserProfile,
    weightUnit,
    completedSessions,
    onboardingComplete,
    tourComplete,
  } = useAppStore();
  const { isAuthenticated } = useAuth();

  const [showPrompt, setShowPrompt] = useState(false);
  const [weightText, setWeightText] = useState('');

  // Also wait for the guided tour to be done/skipped - it and the achievement
  // toast are separate root/tab-level Modals; this one shouldn't compete with
  // them for the screen right after a fresh onboarding completes.
  const isReadyToPrompt = hasHydrated && isAuthenticated && onboardingComplete && tourComplete;
  const neverSetWeight = userProfile.bodyweightKg === 0;

  useEffect(() => {
    if (!isReadyToPrompt) return;
    const hasCompletedSessions = completedSessions.length > 0;
    const shouldPrompt =
      (hasCompletedSessions || neverSetWeight) &&
      (!lastWeightPromptedAt || Date.now() - lastWeightPromptedAt > SEVEN_DAYS_MS);
    if (shouldPrompt && !showPrompt) {
      const display =
        userProfile.bodyweightKg > 0
          ? String(kgToDisplayUnit(userProfile.bodyweightKg, weightUnit))
          : '';
      setWeightText(display);
      setShowPrompt(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isReadyToPrompt, lastWeightPromptedAt, completedSessions.length, neverSetWeight]);

  const trimmed = weightText.trim();
  const parsedWeight = /^\d+(\.\d+)?$/.test(trimmed) ? parseFloat(trimmed) : NaN;
  const isValidInput = !isNaN(parsedWeight) && parsedWeight > 0;
  const hasText = trimmed.length > 0;
  const inputInvalid = hasText && !isValidInput;
  // When no weight has ever been set, require a valid value - cannot skip or confirm empty
  const canConfirm = neverSetWeight ? isValidInput : !inputInvalid;

  const dismiss = () => {
    if (neverSetWeight) return; // no dismissal without a weight when never set
    setLastWeightPromptedAt(Date.now());
    setShowPrompt(false);
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const confirm = () => {
    if (!canConfirm) return;
    if (isValidInput) {
      setUserProfile({ bodyweightKg: displayUnitToKg(parsedWeight, weightUnit) });
    }
    setLastWeightPromptedAt(Date.now());
    setShowPrompt(false);
    if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const styles = useMemo(() => makePromptStyles(C), [C]);

  return (
    <Modal
      // Gated on `deferred` rather than on showPrompt alone, so the prompt
      // stays armed and simply presents once the other modal has gone.
      visible={showPrompt && !deferred}
      transparent
      animationType="fade"
      onRequestClose={neverSetWeight ? undefined : dismiss}
    >
      <Pressable style={styles.overlay} onPress={neverSetWeight ? undefined : dismiss}>
        <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
          <View style={styles.iconWrap}>
            <GrowIcon name="scale" size={28} color={C.primaryText} />
          </View>
          <Text style={styles.title}>Update Your Weight</Text>
          <Text style={styles.sub}>
            {userProfile.bodyweightKg > 0
              ? `Your last recorded weight is ${kgToDisplayUnit(userProfile.bodyweightKg, weightUnit)} ${weightUnit}. Still accurate?`
              : 'Enter your body weight to help calibrate your sessions.'}
          </Text>
          <View style={styles.inputRow}>
            <TextInput
              style={[styles.input, inputInvalid && styles.inputError]}
              value={weightText}
              onChangeText={setWeightText}
              placeholder={weightUnit === 'kg' ? 'e.g. 80' : 'e.g. 176'}
              placeholderTextColor={C.textTertiary}
              keyboardType="decimal-pad"
              returnKeyType="done"
              onSubmitEditing={confirm}
              autoFocus
              testID="weight-prompt-input"
            />
            <Text style={styles.unit}>{weightUnit}</Text>
          </View>
          {inputInvalid && <Text style={styles.errorText}>Please enter a positive number</Text>}
          <Pressable
            onPress={confirm}
            style={[styles.confirmBtn, !canConfirm && styles.confirmBtnDisabled]}
            disabled={!canConfirm}
            testID="weight-prompt-confirm"
          >
            <Text style={styles.confirmText}>
              {isValidInput ? 'Save & Continue' : neverSetWeight ? 'Enter your weight' : 'Skip'}
            </Text>
          </Pressable>
          {userProfile.bodyweightKg > 0 && (
            <Pressable onPress={dismiss} style={styles.dismissBtn}>
              <Text style={styles.dismissText}>Skip for this week</Text>
            </Pressable>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function makePromptStyles(C: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.45)',
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 24,
    },
    card: {
      width: '100%',
      backgroundColor: C.surface,
      borderRadius: 20,
      padding: 24,
      alignItems: 'center',
    },
    iconWrap: {
      width: 56,
      height: 56,
      borderRadius: 16,
      backgroundColor: C.primarySurface,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 16,
    },
    title: {
      fontSize: 20,
      fontFamily: 'Inter_700Bold',
      color: C.text,
      marginBottom: 8,
      textAlign: 'center',
    },
    sub: {
      fontSize: 14,
      fontFamily: 'Inter_400Regular',
      color: C.textSecondary,
      textAlign: 'center',
      lineHeight: 20,
      marginBottom: 20,
    },
    inputRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      alignSelf: 'stretch',
      marginBottom: 6,
    },
    input: {
      flex: 1,
      height: 48,
      backgroundColor: C.surfaceTertiary,
      borderRadius: 12,
      borderWidth: 1.5,
      borderColor: C.primary,
      paddingHorizontal: 14,
      fontSize: 18,
      fontFamily: 'Inter_600SemiBold',
      color: C.text,
      textAlign: 'center',
    },
    inputError: { borderColor: C.error },
    errorText: {
      fontSize: 12,
      fontFamily: 'Inter_400Regular',
      color: C.error,
      alignSelf: 'flex-start',
      marginBottom: 14,
      marginTop: 2,
    },
    unit: { fontSize: 16, fontFamily: 'Inter_600SemiBold', color: C.textSecondary, minWidth: 28 },
    confirmBtn: {
      width: '100%',
      backgroundColor: C.primary,
      borderRadius: 12,
      paddingVertical: 14,
      alignItems: 'center',
      marginBottom: 10,
      marginTop: 14,
    },
    confirmBtnDisabled: { backgroundColor: C.border, opacity: 0.7 },
    confirmText: { fontSize: 15, fontFamily: 'Inter_700Bold', color: '#fff' },
    dismissBtn: { paddingVertical: 10 },
    dismissText: { fontSize: 14, fontFamily: 'Inter_500Medium', color: C.textTertiary },
  });
}

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
    } else if (!hasActiveSubscription) {
      if (currentPath !== 'subscription') timer = setTimeout(() => router.replace('/subscription'), 0);
    } else if (
      currentPath === 'onboarding' ||
      currentPath === 'auth' ||
      currentPath === 'subscription'
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

  useEffect(() => {
    if (!hasHydrated) return;
    if (activeSession?.savedAt) {
      const age = Date.now() - new Date(activeSession.savedAt).getTime();
      if (age > 24 * 60 * 60 * 1000) {
        clearActiveSession();
      }
    }
  }, [hasHydrated, activeSession, clearActiveSession]);

  useEffect(() => {
    if (!hasHydrated || Platform.OS === 'web') return;
    if (reminderEnabled) {
      scheduleWorkoutReminder(reminderTime).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasHydrated]);

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
        <Stack.Screen name="subscription" options={{ headerShown: false }} />
        <Stack.Screen name="readiness" options={{ headerShown: false }} />
        <Stack.Screen name="session" options={{ headerShown: false }} />
        <Stack.Screen
          name="session-summary"
          options={{ headerShown: false, presentation: 'fullScreenModal', gestureEnabled: false }}
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
      {/* Only one root-level Modal may be presented at a time, and only over
          the tabs — see canShowRootModal above. */}
      <WeeklyWeightPrompt deferred={currentToast !== null || !canShowRootModal} />
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
            onDismiss={() => setCurrentToast(null)}
          />
        ))}
    </>
  );
}

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
