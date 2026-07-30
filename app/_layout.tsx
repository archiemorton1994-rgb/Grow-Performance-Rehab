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
  ScrollView as RNScrollView,
  StyleSheet,
  Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LayoutAnimationConfig } from 'react-native-reanimated';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';
import * as Notifications from 'expo-notifications';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { queryClient } from '@/lib/query-client';
import { useAppStore } from '@/lib/store';
import { AuthProvider, useAuth } from '@/lib/auth-context';
import { useColors, DarkColors } from '@/constants/colors';
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

function WeeklyWeightPrompt() {
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
      visible={showPrompt}
      transparent
      animationType="fade"
      onRequestClose={neverSetWeight ? undefined : dismiss}
    >
      <Pressable style={styles.overlay} onPress={neverSetWeight ? undefined : dismiss}>
        <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
          <View style={styles.iconWrap}>
            <Text style={styles.iconText}>⚖️</Text>
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
    iconText: { fontSize: 28 },
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
  const { onboardingComplete, hasHydrated } = useAppStore();
  const { isLoading, isAuthenticated, hasActiveSubscription } = useAuth();
  const segments = useSegments();
  const currentPath = segments.join('/');
  // True while the user is on any screen that drives its own post-action
  // navigation (session → session-summary, readiness → session, etc.).
  const isOnTransientScreen = segments.some((s) => TRANSIENT_SCREENS.has(s));

  // ─── Badge toast queue (root-level so it floats above all screens) ────────
  const { newlyUnlockedBadges, clearNewlyUnlockedBadges } = useAppStore();
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
  // show a toast — inside (tabs), or on session-summary right after a session
  // ends (so a badge earned by that session celebrates there and then, instead
  // of silently queuing until the next time the user happens to open Home) —
  // so the toast never fires on top of gate screens (auth, subscription, etc.)
  // even when hasActiveSubscription briefly becomes true before navigation.
  const canShowBadgeToast =
    segments[0] === '(tabs)' || segments.some((s) => s === 'session-summary');

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
      setHasQueuedWork(true);
    } else {
      const badge = BADGE_MAP.get(newIds[0]);
      if (badge) {
        setToastQueue((q) => [...q, badge]);
        setHasQueuedWork(true);
      }
    }
  }, [newlyUnlockedBadges]);

  useEffect(() => {
    if (!inMainApp) return;
    if (!canShowBadgeToast) return; // don't pop toasts on gate screens before navigation completes
    if (currentToast || toastQueue.length === 0) return;
    const [next, ...rest] = toastQueue;
    setToastQueue(rest);
    setCurrentToast(next);
  }, [inMainApp, canShowBadgeToast, currentToast, toastQueue]);

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

  const { reminderEnabled, reminderTime, activeSession, clearActiveSession } = useAppStore();

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

  const {
    nudgeEnabled,
    streakProtectionEnabled,
    streakProtectionTime,
    completedSessions,
    getStreakDays,
    weeklyStreakGoal,
    getThisWeekCount,
  } = useAppStore();

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
      </Stack>
      <WeeklyWeightPrompt />
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
            badgeIcon={currentToast.icon}
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
  const [lastCrash, setLastCrash] = useState<string | null>(null);

  useEffect(() => {
    if (fontsLoaded || fontError || Platform.OS === 'web') {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [fontsLoaded, fontError]);

  useEffect(() => {
    AsyncStorage.getItem('__last_crash__')
      .then((val) => {
        if (val) {
          setLastCrash(val);
          AsyncStorage.removeItem('__last_crash__').catch(() => {});
        }
      })
      .catch(() => {});
  }, []);

  if (!fontsLoaded && !fontError && Platform.OS !== 'web') {
    if (lastCrash) {
      return (
        <View
          style={{
            flex: 1,
            backgroundColor: DarkColors.background,
            justifyContent: 'flex-start',
            padding: 24,
            paddingTop: 60,
          }}
        >
          <Text
            style={{ color: DarkColors.error, fontWeight: 'bold', fontSize: 16, marginBottom: 8 }}
          >
            ⚠️ Previous Launch Crash
          </Text>
          <RNScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 24 }}>
            <Text style={{ color: DarkColors.textInverse, fontSize: 11, fontFamily: 'monospace' }}>
              {lastCrash}
            </Text>
          </RNScrollView>
          <Pressable
            onPress={() => {
              AsyncStorage.removeItem('__last_crash__').catch(() => {});
              setLastCrash(null);
            }}
            style={{
              marginTop: 12,
              backgroundColor: DarkColors.surfaceTertiary,
              padding: 14,
              borderRadius: 10,
              alignItems: 'center',
            }}
          >
            <Text style={{ color: DarkColors.textInverse, fontWeight: '600' }}>
              Dismiss & Continue Loading
            </Text>
          </Pressable>
        </View>
      );
    }
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
      {lastCrash ? (
        <Modal visible transparent animationType="fade">
          <View
            style={{
              flex: 1,
              backgroundColor: 'rgba(0,0,0,0.85)',
              justifyContent: 'center',
              alignItems: 'center',
              padding: 24,
            }}
          >
            <View
              style={{
                backgroundColor: DarkColors.surfaceSecondary,
                borderRadius: 16,
                padding: 20,
                width: '100%',
                maxHeight: '80%',
              }}
            >
              <Text
                style={{
                  color: DarkColors.error,
                  fontWeight: 'bold',
                  fontSize: 16,
                  marginBottom: 8,
                }}
              >
                Last Crash Log
              </Text>
              <ScrollViewInline text={lastCrash} />
              <Pressable
                onPress={() => setLastCrash(null)}
                style={{
                  marginTop: 16,
                  backgroundColor: DarkColors.surfaceTertiary,
                  borderRadius: 10,
                  padding: 12,
                  alignItems: 'center',
                }}
              >
                <Text style={{ color: DarkColors.textInverse, fontWeight: '600' }}>Dismiss</Text>
              </Pressable>
            </View>
          </View>
        </Modal>
      ) : null}
    </ErrorBoundary>
  );
}

function ScrollViewInline({ text }: { text: string }) {
  return (
    <RNScrollView style={{ maxHeight: 300 }}>
      <Text style={{ color: '#ccc', fontSize: 11, lineHeight: 16 }}>{text}</Text>
    </RNScrollView>
  );
}
