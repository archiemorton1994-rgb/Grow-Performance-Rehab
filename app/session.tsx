import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  Platform,
  TextInput,
  Modal,
  Linking,
  KeyboardAvoidingView,
  Keyboard,
  AppState,
  AppStateStatus,
  useWindowDimensions,
} from 'react-native';
import * as Notifications from 'expo-notifications';
import * as StoreReview from 'expo-store-review';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, {
  FadeInDown,
  FadeInUp,
  FadeIn,
  FadeOut,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  interpolateColor,
} from 'react-native-reanimated';
import { useColors } from '@/constants/colors';
import { shadowStyle } from '@/constants/shadows';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import CoachMark, { SpotlightRect } from '@/components/CoachMark';
import {
  EquipmentTier,
  EnergyLevel,
  PainRegion,
  SessionType,
  TimeAvailable,
  SetLog,
  ExerciseLog,
  ExerciseFeedback,
  WeightUnit,
  CustomExercise,
  CardioLogData,
  useAppStore,
  STRENGTH_SESSION_TYPES,
} from '@/lib/store';
import { uploadUserData } from '@/lib/sync';
import {
  scheduleMissedWorkoutNudge,
  cancelRestTimerNotification,
  cancelStreakProtectionAlert,
  REST_TIMER_NOTIF_ID,
} from '@/lib/notifications';
import { kgToDisplayUnit, displayUnitToKg, convertLoadString } from '@/lib/utils';
import {
  Exercise,
  generateWorkout,
  generate1RMWorkout,
  getSessionLabel,
  getPainRegionLabel,
  getWeightGuideKg,
  REST_PERIOD_SECONDS,
} from '@/lib/workout-engine';

interface ExerciseSetData {
  sets: SetLog[];
  swapCount: 0 | 1 | 2;
  activeSetIndex: number;
  cardioData?: CardioLogData;
}

function isLoadBandOrBodyweight(suggestedLoad: string): boolean {
  const lower = suggestedLoad.toLowerCase();
  return lower.startsWith('bodyweight') || lower.includes('band') || lower === 'low intensity';
}

function isRepsTimeBased(repsStr: string, sessionType?: SessionType): boolean {
  if (sessionType === 'conditioning') return true;
  // Only recognise "min" (e.g. "2 min", "5min") or seconds "30s" / "30 s".
  // Do NOT match bare "m" - that collides with meters (e.g. "40m" Farmers Carry).
  return /\d+\s*min\b/.test(repsStr) || /\d+\s*s\b/.test(repsStr);
}

/**
 * Parse the lower bound of a reps string for pre-filling the reps input.
 * Returns the first numeric token as a string, or '' for time-based reps
 * (min/s) or when nothing is parseable.
 * e.g. "10" → "10", "8-12" → "8", "30s" → '', "2 min" → ''.
 */
function parseTargetRepsForPrefill(repsStr: string): string {
  if (!repsStr) return '';
  if (/\d+\s*min\b/.test(repsStr) || /\d+\s*s\b/.test(repsStr)) return '';
  const match = repsStr.match(/\d+/);
  return match ? match[0] : '';
}

function parseRepsToSeconds(repsStr: string): number {
  // "X min" or "Xmin" - explicit minutes token
  const minMatch = repsStr.match(/(\d+(?:\.\d+)?)\s*min/);
  if (minMatch) return Math.round(parseFloat(minMatch[1]) * 60);
  // "Xm" or "X m" - bare m as minutes (only called when we KNOW the context is time, e.g. cardio warmup)
  const bareMinMatch = repsStr.match(/^(\d+(?:\.\d+)?)\s*m\b/);
  if (bareMinMatch) return Math.round(parseFloat(bareMinMatch[1]) * 60);
  // "Xs" or "X s" - seconds
  const secMatch = repsStr.match(/(\d+)\s*s\b/);
  if (secMatch) return parseInt(secMatch[1], 10);
  return 5 * 60; // fallback 5 minutes
}

function RestTimer({
  category,
  trigger = 0,
  onTimerEnd,
}: {
  category: Exercise['category'];
  trigger?: number;
  onTimerEnd?: () => void;
}) {
  const C = useColors();
  const styles = useMemo(() => makeStyles(C), [C]);
  const duration = REST_PERIOD_SECONDS[category] ?? 0;
  // Wall-clock model: `endAt` is the absolute timestamp when the countdown
  // should hit zero. `secondsLeft` is derived from (endAt - Date.now()) on
  // every tick, so backgrounding, scroll jank, or device sleep can never
  // cause drift - the displayed value snaps to truth on the next interval.
  const [endAt, setEndAt] = useState<number | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(duration);
  const [isRunning, setIsRunning] = useState(false);
  const [isDone, setIsDone] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const pulseScale = useSharedValue(1);
  const pulseStyle = useAnimatedStyle(() => ({ transform: [{ scale: pulseScale.value }] }));

  const notifIdRef = useRef<string | null>(null);

  const cancelNotif = useCallback(async () => {
    if (Platform.OS !== 'web') {
      await Notifications.cancelScheduledNotificationAsync(REST_TIMER_NOTIF_ID).catch(() => {});
      notifIdRef.current = null;
    }
  }, []);

  const scheduleNotif = useCallback(
    async (seconds: number) => {
      if (Platform.OS === 'web') return;
      await cancelNotif();
      try {
        const { status } = await Notifications.requestPermissionsAsync();
        if (status !== 'granted') return;
        await Notifications.scheduleNotificationAsync({
          identifier: REST_TIMER_NOTIF_ID,
          content: { title: 'Rest Complete', body: 'Time to hit your next set!', sound: true },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
            seconds,
            repeats: false,
          },
        });
        notifIdRef.current = REST_TIMER_NOTIF_ID;
      } catch {}
    },
    [cancelNotif]
  );

  // Auto-start when trigger increments (i.e. a set was just completed).
  useEffect(() => {
    if (trigger > 0 && duration > 0) {
      const end = Date.now() + duration * 1000;
      setEndAt(end);
      setSecondsLeft(duration);
      setIsDone(false);
      setIsRunning(true);
      scheduleNotif(duration);
      if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trigger]);

  // Wall-clock tick: every second derive remaining from absolute endAt.
  useEffect(() => {
    if (!duration || !isRunning || endAt == null) return;
    const recompute = () => {
      const remaining = Math.max(0, Math.ceil((endAt - Date.now()) / 1000));
      setSecondsLeft(remaining);
      if (remaining <= 0) {
        setIsRunning(false);
        setIsCompleting(true);
        cancelNotif();
        if (Platform.OS !== 'web') {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
        pulseScale.value = withTiming(1.1, { duration: 200 }, () => {
          pulseScale.value = withTiming(1, { duration: 200 });
        });
        setTimeout(() => {
          setIsDone(true);
          setIsCompleting(false);
          onTimerEnd?.();
        }, 520);
      }
    };
    recompute();
    const timerId = setInterval(recompute, 1000);
    // Re-sync immediately when app returns from background.
    const sub =
      Platform.OS !== 'web'
        ? AppState.addEventListener('change', (s: AppStateStatus) => {
            if (s === 'active') recompute();
          })
        : null;
    return () => {
      clearInterval(timerId);
      sub?.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [duration, isRunning, endAt]);

  // Cancel notification on unmount (navigating away mid-rest)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(
    () => () => {
      cancelNotif();
    },
    []
  );

  if (!duration) return null;

  const reset = () => {
    cancelNotif();
    setEndAt(null);
    setSecondsLeft(duration);
    setIsRunning(false);
    setIsDone(false);
    setIsCompleting(false);
  };
  const skip = () => {
    cancelNotif();
    setIsRunning(false);
    setIsCompleting(true);
    setEndAt(null);
    if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    pulseScale.value = withTiming(1.1, { duration: 180 }, () => {
      pulseScale.value = withTiming(1, { duration: 180 });
    });
    setTimeout(() => {
      setIsDone(true);
      setIsCompleting(false);
      onTimerEnd?.();
    }, 450);
  };
  const addFifteen = () => {
    if (Platform.OS !== 'web') Haptics.selectionAsync();
    setEndAt((prev) => {
      const base = prev ?? Date.now() + secondsLeft * 1000;
      const next = base + 15 * 1000;
      if (isRunning) {
        const seconds = Math.max(1, Math.ceil((next - Date.now()) / 1000));
        scheduleNotif(seconds);
      }
      return next;
    });
  };
  const togglePause = () => {
    if (isRunning) {
      cancelNotif();
      setIsRunning(false);
    } else {
      if (secondsLeft > 0) {
        setEndAt(Date.now() + secondsLeft * 1000);
        scheduleNotif(secondsLeft);
        setIsRunning(true);
      }
    }
  };
  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, '0');
  const ss = String(secondsLeft % 60).padStart(2, '0');

  if (isDone) {
    return (
      <Animated.View style={pulseStyle}>
        <Pressable onPress={reset} style={styles.restTimerDone}>
          <Ionicons name="checkmark-circle" size={16} color={C.primary} />
          <Text style={styles.restTimerDoneText}>Rest complete</Text>
        </Pressable>
      </Animated.View>
    );
  }

  // ── Active pill — shown once the first set is completed ────────────────────
  if (trigger > 0) {
    return (
      <Animated.View style={[styles.restTimerPill, isCompleting && pulseStyle]}>
        {isCompleting ? (
          <View style={styles.restTimerPillInner}>
            <Ionicons name="checkmark-circle" size={16} color={C.primary} />
            <Text style={styles.restTimerPillCompleteText}>Done!</Text>
          </View>
        ) : (
          <>
            <View style={styles.restTimerPillLeft}>
              <Text style={styles.restTimerPillDigits}>
                {mm}:{ss}
              </Text>
              <Text style={styles.restTimerPillState}>{isRunning ? 'resting' : 'paused'}</Text>
            </View>
            <View style={styles.restTimerPillActions}>
              <Pressable onPress={togglePause} style={styles.restTimerIconBtn}>
                <Ionicons name={isRunning ? 'pause' : 'play'} size={15} color={C.primary} />
              </Pressable>
              <Pressable
                onPress={addFifteen}
                style={styles.restTimerIconBtn}
                testID="rest-timer-add-15"
              >
                <Text style={styles.restTimerAddText}>+15s</Text>
              </Pressable>
              <Pressable onPress={skip} style={styles.restTimerPillSkip}>
                <Text style={styles.restTimerPillSkipText}>Skip rest</Text>
              </Pressable>
              <Pressable onPress={reset} style={styles.restTimerIconBtn}>
                <Ionicons name="refresh-outline" size={14} color={C.textTertiary} />
              </Pressable>
            </View>
          </>
        )}
      </Animated.View>
    );
  }

  // ── Idle state — quiet hint row before any set is logged ───────────────────
  return (
    <View style={styles.restTimerRow}>
      <View style={[styles.restTimerBtn, { flex: 1 }]}>
        <Ionicons name="timer" size={18} color={C.primary} />
        <Text style={styles.restTimerText}>
          Rest timer · {mm}:{ss}
        </Text>
      </View>
      <Pressable onPress={reset} style={styles.restTimerResetBtn}>
        <Ionicons name="refresh-outline" size={16} color={C.textSecondary} />
      </Pressable>
    </View>
  );
}

function CardioWarmupTimer({ repsStr = '5 min' }: { repsStr?: string }) {
  const C = useColors();
  const styles = useMemo(() => makeStyles(C), [C]);
  const DURATION = parseRepsToSeconds(repsStr);
  const [secondsLeft, setSecondsLeft] = useState(DURATION);
  const [isRunning, setIsRunning] = useState(true);
  const [isDone, setIsDone] = useState(false);

  useEffect(() => {
    if (!isRunning || secondsLeft <= 0) return;
    const id = setInterval(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearInterval(id);
  }, [isRunning, secondsLeft]);

  useEffect(() => {
    if (secondsLeft <= 0 && isRunning) {
      setIsRunning(false);
      setIsDone(true);
      if (Platform.OS !== 'web') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    }
  }, [secondsLeft, isRunning]);

  const reset = () => {
    setSecondsLeft(DURATION);
    setIsRunning(true);
    setIsDone(false);
  };
  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, '0');
  const ss = String(secondsLeft % 60).padStart(2, '0');

  if (isDone) {
    return (
      <Animated.View>
        <Pressable onPress={reset} style={styles.restTimerDone}>
          <Ionicons name="checkmark-circle" size={16} color={C.primary} />
          <Text style={styles.restTimerDoneText}>Warm-up complete - tap to reset</Text>
        </Pressable>
      </Animated.View>
    );
  }

  return (
    <View style={styles.restTimerRow}>
      <Pressable
        onPress={() => setIsRunning((r) => !r)}
        style={[styles.restTimerBtn, isRunning && styles.restTimerBtnActive, { flex: 1 }]}
      >
        <Ionicons
          name={isRunning ? 'pause-circle' : 'flame'}
          size={18}
          color={isRunning ? '#fff' : C.primary}
        />
        <Text style={[styles.restTimerText, isRunning && styles.restTimerTextActive]}>
          {isRunning ? `Warm-up - ${mm}:${ss}` : `Cardio timer - ${mm}:${ss}`}
        </Text>
      </Pressable>
      <Pressable onPress={reset} style={styles.restTimerResetBtn}>
        <Ionicons name="refresh-outline" size={16} color={C.textSecondary} />
      </Pressable>
    </View>
  );
}

// ─── Session Active Bar ───────────────────────────────────────────────────────
// Floating bar at the bottom of the screen. Contains weight/reps inputs for
// the active set, the "Complete Set" button, a brief per-set feedback strip,
// and a "Complete Session" button when all sets are done.

interface SessionActiveBarProps {
  exercise: Exercise | null;
  exerciseIndex: number;
  setData: ExerciseSetData | null;
  activeSetIndex: number;
  weightGuidesKg: number[];
  isBandExercise: boolean;
  isTimeExercise: boolean;
  previousBest: number | undefined;
  previousSessionWeight: number | undefined;
  weightUnit: WeightUnit;
  isLastExercise: boolean;
  sessionAllDone: boolean;
  isPrehabOrFlex: boolean;
  isCardioExercise: boolean;
  onSetChange: (exerciseIndex: number, setIndex: number, updated: SetLog) => void;
  onSetCompleted: () => void;
  onNewPb?: () => void;
  onFeedback: (exerciseId: string, f: 'easy' | 'hard') => void;
  onCompleteSession: () => void;
  /** Returns to the previous exercise to fix a mis-logged set. Omitted (no
   *  button shown) for the first exercise or in the demo tutorial. */
  onGoBack?: () => void;
  bottomInset: number;
  /** In the demo tutorial, keep this bar's layout stable rather than flipping
   *  to the feedback-buttons UI on tap — the tutorial's spotlight is measured
   *  once per step and doesn't re-measure if the bar's own content changes. */
  isDemo?: boolean;
  /** Demo mode only: show the feedback UI unconditionally, driven by which
   *  tutorial step is active rather than by a real tap (the demo doesn't
   *  process taps) — see TutorialStep.demoForceFeedback. */
  demoForceFeedback?: boolean;
}

export function SessionActiveBar({
  exercise,
  exerciseIndex,
  setData,
  activeSetIndex,
  weightGuidesKg,
  isBandExercise,
  isTimeExercise,
  previousBest,
  previousSessionWeight,
  weightUnit = 'kg',
  isLastExercise,
  sessionAllDone,
  isPrehabOrFlex,
  isCardioExercise,
  onSetChange,
  onSetCompleted,
  onNewPb,
  onFeedback,
  onCompleteSession,
  onGoBack,
  bottomInset,
  isDemo = false,
  demoForceFeedback = false,
}: SessionActiveBarProps) {
  const C = useColors();
  const styles = useMemo(() => makeStyles(C), [C]);

  const recommendedKg = weightGuidesKg[activeSetIndex] ?? 0;
  const prevSetWeight =
    activeSetIndex > 0
      ? (setData?.sets[activeSetIndex - 1]?.weight ?? 0)
      : (previousSessionWeight ?? 0);

  const computeInitialWeight = useCallback((): string => {
    const stored = setData?.sets[activeSetIndex]?.weight ?? 0;
    if (stored > 0) return String(kgToDisplayUnit(stored, weightUnit));
    if (recommendedKg > 0) return String(kgToDisplayUnit(recommendedKg, weightUnit));
    if (prevSetWeight > 0) return String(kgToDisplayUnit(prevSetWeight, weightUnit));
    return '';
  }, [activeSetIndex, exerciseIndex, setData, recommendedKg, prevSetWeight, weightUnit]); // eslint-disable-line react-hooks/exhaustive-deps

  const [weightText, setWeightText] = useState<string>(computeInitialWeight);
  const [repsText, setRepsText] = useState<string>(() => {
    const r = setData?.sets[activeSetIndex]?.reps ?? 0;
    return r > 0 ? String(r) : parseTargetRepsForPrefill(exercise?.reps ?? '');
  });
  const [showFeedback, setShowFeedback] = useState(false);
  const feedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const prevKeyRef = useRef(`${exerciseIndex}-${activeSetIndex}`);
  useEffect(() => {
    const key = `${exerciseIndex}-${activeSetIndex}`;
    if (prevKeyRef.current !== key) {
      prevKeyRef.current = key;
      setWeightText(computeInitialWeight());
      const r = setData?.sets[activeSetIndex]?.reps ?? 0;
      setRepsText(r > 0 ? String(r) : parseTargetRepsForPrefill(exercise?.reps ?? ''));
    }
  }, [exerciseIndex, activeSetIndex, computeInitialWeight, setData, exercise]);

  const currentSet = setData?.sets[activeSetIndex];
  const totalSets = setData?.sets.length ?? 1;

  const parsedWeight = Math.max(0, parseFloat(weightText) || 0);
  const parsedReps = parseInt(repsText) || 0;
  const effectiveWeightKg = displayUnitToKg(parsedWeight, weightUnit);

  const isZeroBlocked =
    !isTimeExercise &&
    (isBandExercise ? parsedReps === 0 : effectiveWeightKg === 0 || parsedReps === 0);

  const isNewRecord =
    !isBandExercise &&
    !isTimeExercise &&
    previousBest !== undefined &&
    previousBest > 0 &&
    parsedWeight > 0 &&
    effectiveWeightKg > previousBest;

  const setLabel =
    exercise?.category === 'main'
      ? activeSetIndex < totalSets - 1
        ? 'Warm-up'
        : 'Working set'
      : null;

  const handleComplete = () => {
    if (isZeroBlocked || !currentSet || !exercise) return;
    Keyboard.dismiss();
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    onSetChange(exerciseIndex, activeSetIndex, {
      ...currentSet,
      weight: effectiveWeightKg,
      reps: parsedReps,
      completed: true,
    });
    if (isNewRecord) onNewPb?.();
    onSetCompleted();
    if (!isDemo) {
      setShowFeedback(true);
      if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
      feedbackTimerRef.current = setTimeout(() => setShowFeedback(false), 3000);
    }
  };

  const handleFeedback = (f: 'easy' | 'hard') => {
    if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
    if (exercise) onFeedback(exercise.id, f);
    setShowFeedback(false);
  };

  if (isCardioExercise) {
    return (
      <View style={[styles.barContainer, { paddingBottom: bottomInset + 12 }]}>
        <View style={styles.barCardioHint}>
          <Ionicons name="timer-outline" size={20} color={C.primary} />
          <Text style={styles.barCardioHintText}>Log your cardio in the card above ↑</Text>
        </View>
      </View>
    );
  }

  if (sessionAllDone) {
    return (
      <View style={[styles.barContainer, { paddingBottom: bottomInset + 12 }]}>
        <Pressable
          onPress={onCompleteSession}
          style={({ pressed }) => [
            styles.barCompleteSessionBtn,
            pressed && { opacity: 0.9, transform: [{ scale: 0.98 as number }] },
          ]}
          testID="complete-session"
        >
          <Ionicons name="checkmark-circle" size={22} color={C.textInverse} />
          <Text style={styles.barCompleteSessionText}>Complete Session</Text>
        </Pressable>
      </View>
    );
  }

  if (!exercise || !currentSet || activeSetIndex >= totalSets) return null;

  if (showFeedback || demoForceFeedback) {
    return (
      <View style={[styles.barContainer, { paddingBottom: bottomInset + 12 }]}>
        <Text style={styles.barFeedbackPrompt}>
          Set {activeSetIndex + 1} logged · How did it feel?
        </Text>
        <View style={styles.barFeedbackRow}>
          <Pressable onPress={() => handleFeedback('easy')} style={styles.barFeedbackBtn}>
            <Text style={styles.barFeedbackBtnText}>👍 Too easy</Text>
          </Pressable>
          <Pressable
            onPress={() => setShowFeedback(false)}
            style={[styles.barFeedbackBtn, styles.barFeedbackBtnNeutral]}
            testID="feedback-good"
          >
            <Text style={[styles.barFeedbackBtnText, { color: C.text }]}>✓ OK</Text>
          </Pressable>
          <Pressable
            onPress={() => handleFeedback('hard')}
            style={[styles.barFeedbackBtn, styles.barFeedbackBtnHard]}
          >
            <Text style={[styles.barFeedbackBtnText, { color: C.categoryFinisherText }]}>
              💪 Hard
            </Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.barContainer, { paddingBottom: bottomInset + 8 }]}>
      <View style={styles.barHeader}>
        {exerciseIndex > 0 && onGoBack && (
          <Pressable
            onPress={onGoBack}
            hitSlop={10}
            style={styles.barBackBtn}
            testID="session-bar-back"
          >
            <Ionicons name="chevron-back" size={18} color={C.textSecondary} />
          </Pressable>
        )}
        <Text style={styles.barExerciseName} numberOfLines={1}>
          {exercise.name}
        </Text>
        <View style={styles.barSetCountRow}>
          {setLabel && <Text style={styles.barSetLabel}>{setLabel}</Text>}
          <Text style={styles.barSetCount}>
            Set {activeSetIndex + 1}/{totalSets}
          </Text>
        </View>
      </View>

      {isNewRecord && (
        <View style={[styles.newRecordBadge, { alignSelf: 'flex-start', marginBottom: 6 }]}>
          <Ionicons name="star" size={10} color="#fff" />
          <Text style={styles.newRecordText}>New Record!</Text>
        </View>
      )}

      {isTimeExercise ? (
        <Pressable
          onPress={handleComplete}
          style={styles.barMarkDoneBtn}
          testID={`set-${activeSetIndex + 1}-check`}
        >
          <Ionicons name="checkmark-circle" size={20} color={C.textInverse} />
          <Text style={styles.barMarkDoneText}>Mark Set Done</Text>
        </Pressable>
      ) : (
        <View style={styles.barInputArea}>
          {!isBandExercise && (
            <View style={styles.barInputBlock}>
              {recommendedKg > 0 && (
                <Text style={styles.barInputHint}>
                  {kgToDisplayUnit(recommendedKg, weightUnit)} {weightUnit} guide
                </Text>
              )}
              <TextInput
                style={styles.barInput}
                placeholder="0"
                placeholderTextColor={C.textTertiary}
                keyboardType="decimal-pad"
                returnKeyType="next"
                selectTextOnFocus
                value={weightText}
                onChangeText={setWeightText}
                onBlur={() => {
                  const v = parseFloat(weightText) || 0;
                  setWeightText(v > 0 ? String(v) : '');
                }}
                testID={`set-${activeSetIndex + 1}-weight`}
              />
            </View>
          )}

          {isBandExercise && (
            <View style={styles.barInputBlock}>
              <Text style={styles.barInputHint}>Bodyweight</Text>
            </View>
          )}

          <Text style={styles.barTimesSign}>×</Text>

          <View style={styles.barInputBlock}>
            <Text style={styles.barInputHint}>reps</Text>
            <TextInput
              style={styles.barInput}
              placeholder="0"
              placeholderTextColor={C.textTertiary}
              keyboardType="number-pad"
              returnKeyType="done"
              selectTextOnFocus
              value={repsText}
              onChangeText={setRepsText}
              onSubmitEditing={Keyboard.dismiss}
              testID={`set-${activeSetIndex + 1}-reps`}
            />
          </View>

          <Pressable
            onPress={handleComplete}
            disabled={isZeroBlocked}
            style={[styles.barCompleteBtn, isZeroBlocked && styles.barCompleteBtnDisabled]}
            testID={`set-${activeSetIndex + 1}-check`}
          >
            <Ionicons
              name="checkmark-circle"
              size={26}
              color={isZeroBlocked ? C.textTertiary : C.primaryDarkText}
            />
          </Pressable>
        </View>
      )}

      {isZeroBlocked && !isTimeExercise && (
        <Text style={styles.barZeroHint}>
          {isBandExercise ? 'Enter reps to complete' : 'Enter weight and reps to complete'}
        </Text>
      )}

      {!isTimeExercise && (
        <Pressable
          onPress={handleComplete}
          disabled={isZeroBlocked}
          style={[styles.didItBtn, isZeroBlocked && styles.didItBtnDisabled]}
          testID={`did-it-${activeSetIndex + 1}`}
        >
          <Ionicons
            name="checkmark-circle"
            size={20}
            color={isZeroBlocked ? C.textTertiary : C.primaryDarkText}
          />
          <Text style={[styles.didItBtnText, isZeroBlocked && styles.didItBtnTextDisabled]}>
            Did It
          </Text>
        </Pressable>
      )}
    </View>
  );
}

export interface ActiveSetBlockHandle {
  focus: () => void;
}

const ActiveSetBlock = React.forwardRef<
  ActiveSetBlockHandle,
  {
    setNum: number;
    totalSets: number;
    data: SetLog;
    onChange: (updated: SetLog) => void;
    isBandExercise?: boolean;
    isTimeExercise?: boolean;
    previousBest?: number;
    prevSetWeight?: number;
    recommendedWeightKg?: number;
    weightUnit?: WeightUnit;
    onCompleted?: () => void;
  }
>(function ActiveSetBlock(
  {
    setNum,
    totalSets,
    data,
    onChange,
    isBandExercise,
    isTimeExercise,
    previousBest,
    prevSetWeight,
    recommendedWeightKg,
    weightUnit = 'kg',
    onCompleted,
  },
  forwardedRef
) {
  const C = useColors();
  const styles = useMemo(() => makeStyles(C), [C]);

  // Pre-fill weight: prefer stored > guide recommendation > previous set > empty.
  // The guide recommendation takes precedence over previous-set carry-forward so
  // each set shows its specific ramped target (e.g. 50% on set 1, 100% on final set)
  // rather than repeating whatever was typed for the last set.
  const initialWeight =
    data.weight > 0
      ? String(kgToDisplayUnit(data.weight, weightUnit))
      : recommendedWeightKg && recommendedWeightKg > 0
        ? String(kgToDisplayUnit(recommendedWeightKg, weightUnit))
        : prevSetWeight && prevSetWeight > 0
          ? String(kgToDisplayUnit(prevSetWeight, weightUnit))
          : '';

  // Parent keys this component by setNum so it re-mounts on each new set,
  // which resets weightText state automatically.
  const [weightText, setWeightText] = useState(initialWeight);

  // Re-sync displayed weight when the user toggles kg ↔ lbs from Settings
  // mid-session. We convert the *current* weightText (which may be an unblurred
  // in-progress edit) through the previous unit so typed-but-unsaved values are
  // preserved across the toggle. Falls back to data.weight (always kg) when the
  // field is empty.
  const prevUnitRef = useRef<WeightUnit>(weightUnit);
  useEffect(() => {
    const prevUnit = prevUnitRef.current;
    if (prevUnit === weightUnit) return;
    const typed = parseFloat(weightText);
    if (typed > 0) {
      const kg = displayUnitToKg(typed, prevUnit);
      setWeightText(String(kgToDisplayUnit(kg, weightUnit)));
    } else {
      const sourceKg = data.weight > 0 ? data.weight : (prevSetWeight ?? 0);
      setWeightText(sourceKg > 0 ? String(kgToDisplayUnit(sourceKg, weightUnit)) : '');
    }
    prevUnitRef.current = weightUnit;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weightUnit]);

  const flashBg = useSharedValue(0);
  const flashStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      flashBg.value,
      [0, 1],
      ['rgba(47,107,70,0)', 'rgba(47,107,70,0.18)']
    ),
    borderRadius: 14,
  }));

  // Expose a focus() method so the parent (ExerciseCard) can shift focus to
  // this set's primary input when the rest timer ends. Weight input is the
  // primary input for weighted exercises; reps for band/bodyweight.
  const weightInputRef = useRef<TextInput>(null);
  const repsInputRef = useRef<TextInput>(null);
  React.useImperativeHandle(
    forwardedRef,
    () => ({
      focus: () => {
        const target = !isBandExercise ? weightInputRef.current : repsInputRef.current;
        target?.focus();
      },
    }),
    [isBandExercise]
  );

  const handleWeightBlur = () => {
    const displayVal = parseFloat(weightText) || 0;
    setWeightText(displayVal > 0 ? String(displayVal) : '');
    onChange({ ...data, weight: displayUnitToKg(displayVal, weightUnit) });
  };

  // Effective weight: prefer local weightText (may be pre-filled before blur) over data.weight
  const parsedWeightText = Math.max(0, parseFloat(weightText) || 0);
  const effectiveWeightKg =
    parsedWeightText > 0 ? displayUnitToKg(parsedWeightText, weightUnit) : data.weight;

  // Only show "New Record!" on sets that are already saved/completed, not while typing.
  // data.weight is already stored in kg - no unit conversion needed.
  const savedWeightKg = data.weight ?? 0;
  const isNewRecord =
    !isBandExercise &&
    data.completed &&
    previousBest !== undefined &&
    previousBest > 0 &&
    savedWeightKg > previousBest;

  // For weighted: require both effective weight > 0 AND reps > 0. For band: reps > 0 only.
  const isZeroBlocked =
    !isTimeExercise &&
    (isBandExercise ? data.reps === 0 : effectiveWeightKg === 0 || data.reps === 0);

  const handleComplete = () => {
    if (isZeroBlocked) return;
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    flashBg.value = 1;
    flashBg.value = withTiming(0, { duration: 600 });
    // Use effectiveWeightKg (derived from local weightText or data.weight)
    onChange({ ...data, weight: effectiveWeightKg, completed: true });
    onCompleted?.();
  };

  if (isTimeExercise) {
    return (
      <Animated.View style={[styles.activeSetBlock, flashStyle]}>
        <Text style={styles.activeSetLabel}>
          Set {setNum} of {totalSets}
        </Text>
        <Pressable
          onPress={handleComplete}
          style={styles.completeSetBtn}
          testID={`set-${setNum}-check`}
        >
          <Ionicons name="checkmark-circle" size={20} color={C.primaryDarkText} />
          <Text style={styles.completeSetBtnText}>Mark Set Done</Text>
        </Pressable>
      </Animated.View>
    );
  }

  return (
    <Animated.View style={[styles.activeSetBlock, flashStyle]}>
      <Text style={styles.activeSetLabel}>
        Set {setNum} of {totalSets}
      </Text>

      <View style={styles.activeSetInputRow}>
        {!isBandExercise && (
          <View style={styles.activeInputGroup}>
            <TextInput
              ref={weightInputRef}
              style={styles.activeSetInput}
              placeholder="0"
              placeholderTextColor={C.textTertiary}
              keyboardType="decimal-pad"
              returnKeyType="next"
              value={weightText}
              onChangeText={setWeightText}
              onBlur={handleWeightBlur}
              testID={`set-${setNum}-weight`}
            />
            <Text style={styles.activeInputUnit}>{weightUnit}</Text>
          </View>
        )}
        <View style={styles.activeInputGroup}>
          <TextInput
            ref={repsInputRef}
            style={styles.activeSetInput}
            placeholder="0"
            placeholderTextColor={C.textTertiary}
            keyboardType="number-pad"
            returnKeyType="done"
            value={data.reps > 0 ? String(data.reps) : ''}
            onChangeText={(t) => {
              const r = parseInt(t) || 0;
              onChange({ ...data, reps: r });
            }}
            testID={`set-${setNum}-reps`}
          />
          <Text style={styles.activeInputUnit}>reps</Text>
        </View>
      </View>

      {isNewRecord && (
        <View style={styles.newRecordBadge}>
          <Ionicons name="star" size={10} color="#fff" />
          <Text style={styles.newRecordText}>New Record!</Text>
        </View>
      )}

      {isZeroBlocked && (
        <Text style={styles.zeroBlockHint}>
          {isBandExercise ? 'Enter reps to complete' : 'Enter weight and reps to complete'}
        </Text>
      )}

      <Pressable
        onPress={handleComplete}
        disabled={isZeroBlocked}
        style={[styles.completeSetBtn, isZeroBlocked && styles.completeSetBtnDisabled]}
        testID={`set-${setNum}-check`}
      >
        <Ionicons
          name="checkmark-circle"
          size={20}
          color={isZeroBlocked ? C.textTertiary : C.primaryDarkText}
        />
        <Text
          style={[styles.completeSetBtnText, isZeroBlocked && styles.completeSetBtnTextDisabled]}
        >
          Complete Set
        </Text>
      </Pressable>
    </Animated.View>
  );
});

// ── Cardio Input Block ─────────────────────────────────────────────────────
function CardioInputBlock({
  cardioData,
  onLog,
}: {
  cardioData?: CardioLogData;
  onLog: (data: CardioLogData) => void;
}) {
  const C = useColors();
  const styles = useMemo(() => makeStyles(C), [C]);
  const [duration, setDuration] = useState('');
  const [speed, setSpeed] = useState('');
  const [distance, setDistance] = useState('');

  if (cardioData) {
    const parts: string[] = [`${cardioData.durationMinutes} min`];
    if (cardioData.speedKmh) parts.push(`${cardioData.speedKmh} km/h`);
    if (cardioData.distanceKm) parts.push(`${cardioData.distanceKm} km`);
    return (
      <View style={styles.cardioLoggedRow}>
        <Ionicons name="checkmark-circle" size={18} color={C.primary} />
        <Text style={styles.cardioLoggedText}>{parts.join(' · ')}</Text>
      </View>
    );
  }

  const durationNum = parseFloat(duration);
  const canLog = durationNum > 0;

  return (
    <View style={styles.cardioInputBlock}>
      <View style={styles.cardioInputRow}>
        <View style={styles.cardioInputField}>
          <Text style={styles.cardioInputLabel}>Duration (min)*</Text>
          <TextInput
            style={styles.cardioInputBox}
            value={duration}
            onChangeText={setDuration}
            placeholder="e.g. 20"
            placeholderTextColor={C.textTertiary}
            keyboardType="numeric"
            returnKeyType="next"
          />
        </View>
        <View style={styles.cardioInputField}>
          <Text style={styles.cardioInputLabel}>Speed (km/h)</Text>
          <TextInput
            style={styles.cardioInputBox}
            value={speed}
            onChangeText={setSpeed}
            placeholder="optional"
            placeholderTextColor={C.textTertiary}
            keyboardType="numeric"
            returnKeyType="next"
          />
        </View>
        <View style={styles.cardioInputField}>
          <Text style={styles.cardioInputLabel}>Distance (km)</Text>
          <TextInput
            style={styles.cardioInputBox}
            value={distance}
            onChangeText={setDistance}
            placeholder="optional"
            placeholderTextColor={C.textTertiary}
            keyboardType="numeric"
            returnKeyType="done"
          />
        </View>
      </View>
      <Pressable
        onPress={() => {
          if (!canLog) return;
          onLog({
            durationMinutes: durationNum,
            ...(parseFloat(speed) > 0 ? { speedKmh: parseFloat(speed) } : {}),
            ...(parseFloat(distance) > 0 ? { distanceKm: parseFloat(distance) } : {}),
          });
        }}
        disabled={!canLog}
        style={[styles.cardioLogBtn, !canLog && styles.cardioLogBtnDisabled]}
      >
        <Ionicons name="timer-outline" size={18} color={canLog ? C.textInverse : C.textTertiary} />
        <Text style={[styles.cardioLogBtnText, !canLog && styles.cardioLogBtnTextDisabled]}>
          Log Cardio
        </Text>
      </Pressable>
    </View>
  );
}

type ExerciseState = 'active' | 'past' | 'future';

export function ExerciseCard({
  exercise,
  index,
  setData,
  onSetChange,
  onVideoPress,
  onSwapPress,
  onSkipExercise,
  isDumbbellSession,
  exerciseState,
  sessionType,
  onCardLayout,
  previousBest,
  previousSessionWeight,
  lastSessionHint,
  feedbackMultiplier,
  weightUnit = 'kg',
  note = '',
  onNoteChange,
  isLastExercise = false,
  comfortRegionLabel,
  restTimerTrigger,
  noteVisible = false,
  onToggleNote,
  onCardioLog,
  showPbFlash = false,
  videoBtnRef,
  swapBtnRef,
}: {
  exercise: Exercise;
  index: number;
  setData: ExerciseSetData;
  onSetChange: (setIndex: number, updated: SetLog) => void;
  onVideoPress: () => void;
  onSwapPress: () => void;
  onSkipExercise?: () => void;
  isDumbbellSession: boolean;
  exerciseState: ExerciseState;
  sessionType: SessionType;
  onCardLayout?: (y: number) => void;
  previousBest?: number;
  previousSessionWeight?: number;
  lastSessionHint?: { weight: number; reps: number; date: string };
  feedbackMultiplier?: number;
  weightUnit?: WeightUnit;
  note?: string;
  onNoteChange?: (text: string) => void;
  isLastExercise?: boolean;
  comfortRegionLabel?: string;
  restTimerTrigger?: number;
  noteVisible?: boolean;
  onToggleNote?: () => void;
  onCardioLog?: (data: CardioLogData) => void;
  showPbFlash?: boolean;
  /** Only passed for the first card, so the in-session tutorial can point its
   *  arrow at these specific icons rather than guessing their position. */
  videoBtnRef?: React.RefObject<View | null>;
  swapBtnRef?: React.RefObject<View | null>;
}) {
  const C = useColors();
  const styles = useMemo(() => makeStyles(C), [C]);
  const [expanded, setExpanded] = useState(true);
  const effectiveTimerTrigger = restTimerTrigger ?? 0;
  const allDone = setData.sets.every((s) => s.completed);
  const weightGuidesKg = getWeightGuideKg(exercise.category, exercise.sets, exercise.suggestedLoad);

  const isBandExercise = isLoadBandOrBodyweight(exercise.suggestedLoad);
  const isTimeExercise = isRepsTimeBased(exercise.reps, sessionType);

  // Scale-up animation when card becomes active (future → active transition)
  const isActive = exerciseState === 'active';
  const unlockScale = useSharedValue(1);
  useEffect(() => {
    if (isActive) {
      unlockScale.value = 0.96;
      unlockScale.value = withSpring(1, { mass: 0.4, damping: 14, stiffness: 220 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive]);
  const scaleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: unlockScale.value }],
  }));

  const categoryColors: Record<string, { bg: string; text: string; label: string }> = {
    prep: { bg: C.primaryMuted, text: C.primary, label: 'Warm-Up' },
    mechanical: { bg: C.categoryMechanical, text: C.categoryMechanicalText, label: 'Activation' },
    neuro: { bg: C.categoryNeuro, text: C.categoryNeuroText, label: 'Power Primer' },
    main: { bg: C.primaryMuted, text: C.primaryDark, label: 'KPI Lift' },
    accessory: { bg: C.surfaceTertiary, text: C.textSecondary, label: 'Accessory' },
    prehab: { bg: C.categoryPrehab, text: C.categoryPrehabText, label: 'Prehab' },
    finisher: { bg: C.categoryFinisher, text: C.categoryFinisherText, label: 'Finisher' },
    cooldown: { bg: C.categoryCooldown, text: C.categoryCooldownText, label: 'Cool Down' },
  };

  const cat = categoryColors[exercise.category] ?? categoryColors.accessory;
  // Show the per-hand clarification only when the exercise name doesn't already
  // mention "DB" or "Dumbbell" - those names make the dumbbell context obvious.
  // Detection is fully case-insensitive and matches "DB" as a whole token so
  // unrelated words containing those letters aren't false positives.
  const nameImpliesDumbbell = /\bdb\b|dumbbell/i.test(exercise.name);
  const showDumbbellNote =
    isDumbbellSession && !nameImpliesDumbbell && exercise.suggestedLoad.includes('kg');

  const setsLabel = `${exercise.sets} ${exercise.sets === 1 ? 'set' : 'sets'}`;
  const repsLabel = exercise.reps;
  const repDisplay = isTimeExercise ? repsLabel : `${repsLabel} reps`;

  const isPast = exerciseState === 'past';
  const isFuture = exerciseState === 'future';

  return (
    <Animated.View
      entering={FadeInDown.delay(60 + index * 35).duration(350)}
      onLayout={onCardLayout ? (e) => onCardLayout(e.nativeEvent.layout.y) : undefined}
    >
      <View
        style={[
          styles.exerciseCard,
          isActive && allDone && styles.exerciseCardDone,
          isPast && styles.exerciseCardPast,
          isFuture && styles.exerciseCardLocked,
          !isFuture &&
            !isPast &&
            !(isActive && allDone) && { borderLeftWidth: 4, borderLeftColor: cat.text },
          (isPast || (isActive && allDone)) && {
            borderLeftWidth: 3,
            borderLeftColor: C.primaryDark,
          },
        ]}
      >
        {/* ── Future state: locked with padlock ────────────────────────────── */}
        {isFuture && (
          <View style={styles.lockedHeader}>
            <View style={styles.lockIconWrap}>
              <Ionicons name="lock-closed" size={14} color={C.textTertiary} />
            </View>
            <View style={styles.lockedInfo}>
              <Text style={styles.lockedName} numberOfLines={1}>
                {exercise.name}
              </Text>
              <View style={styles.lockedMeta}>
                <View style={[styles.categoryPill, { backgroundColor: cat.bg }]}>
                  <View style={[styles.categoryDot, { backgroundColor: cat.text }]} />
                  <Text style={[styles.categoryText, { color: cat.text }]}>{cat.label}</Text>
                </View>
                <Text style={styles.lockedMetaText}>
                  {setsLabel} × {repDisplay}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* ── Past state: collapsed with completion checkmark ───────────────── */}
        {isPast && (
          <View style={styles.pastHeader}>
            <View style={styles.checkCircleDone}>
              <Ionicons name="checkmark" size={14} color={C.textInverse} />
            </View>
            <View style={styles.lockedInfo}>
              <Text style={styles.pastName} numberOfLines={1}>
                {exercise.name}
              </Text>
              <View style={styles.lockedMeta}>
                <View style={[styles.categoryPill, { backgroundColor: cat.bg }]}>
                  <View style={[styles.categoryDot, { backgroundColor: cat.text }]} />
                  <Text style={[styles.categoryText, { color: cat.text }]}>{cat.label}</Text>
                </View>
                <Text style={styles.lockedMetaText}>
                  {setsLabel} × {repDisplay}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* ── Active state: full interactive card with fade + scale-up ──────── */}
        {isActive && (
          <Animated.View entering={FadeIn.duration(320)}>
            <Animated.View style={scaleStyle}>
              <Pressable onPress={() => setExpanded(!expanded)} style={styles.exerciseHeader}>
                <View style={[styles.checkCircle, allDone && styles.checkCircleDone]}>
                  {allDone && <Ionicons name="checkmark" size={14} color={C.textInverse} />}
                </View>
                <View style={styles.exerciseInfo}>
                  <View style={styles.exerciseNameRow}>
                    <Text
                      style={[styles.exerciseName, allDone && styles.exerciseNameDone]}
                      numberOfLines={2}
                    >
                      {exercise.name}
                    </Text>
                    {exercise.badge && (
                      <View
                        style={[
                          styles.badge,
                          exercise.badge === 'comfort'
                            ? { backgroundColor: C.badgeComfort }
                            : { backgroundColor: C.badgeVolume },
                        ]}
                      >
                        <Text
                          style={[
                            styles.badgeText,
                            exercise.badge === 'comfort'
                              ? { color: C.badgeComfortText }
                              : { color: C.badgeVolumeText },
                          ]}
                        >
                          {exercise.badge === 'comfort' ? 'Comfort' : 'Volume'}
                        </Text>
                      </View>
                    )}
                    {feedbackMultiplier !== undefined &&
                      Math.abs(feedbackMultiplier - 1.0) > 0.001 && (
                        <View
                          style={[
                            styles.badge,
                            {
                              backgroundColor:
                                feedbackMultiplier > 1.0 ? C.primaryMuted : C.categoryPrehab,
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.badgeText,
                              {
                                color:
                                  feedbackMultiplier > 1.0 ? C.primaryDark : C.categoryPrehabText,
                              },
                            ]}
                          >
                            {feedbackMultiplier > 1.0 ? '↑ adjusted' : '↓ adjusted'}
                          </Text>
                        </View>
                      )}
                    {showPbFlash && (
                      <Animated.View
                        entering={FadeInDown.duration(300).springify()}
                        exiting={FadeOut.duration(400)}
                        style={styles.pbFlashBadge}
                      >
                        <Text style={styles.pbFlashBadgeText}>New PB 🏆</Text>
                      </Animated.View>
                    )}
                  </View>
                  <View style={styles.exerciseMeta}>
                    <View style={[styles.categoryPill, { backgroundColor: cat.bg }]}>
                      <View style={[styles.categoryDot, { backgroundColor: cat.text }]} />
                      <Text style={[styles.categoryText, { color: cat.text }]}>{cat.label}</Text>
                    </View>
                    <Text style={styles.metaText}>
                      {setsLabel} × {repDisplay}
                    </Text>
                  </View>
                  {exercise.category === 'main' && (
                    <Text style={styles.kpiHint}>Your main strength move for today</Text>
                  )}
                  {!isBandExercise && <Text style={styles.targetWeightLabel}>Target weight: </Text>}
                  <Text style={[styles.loadText, !isBandExercise && styles.loadTextMain]}>
                    {convertLoadString(exercise.suggestedLoad, weightUnit)}
                  </Text>
                  {showDumbbellNote && (
                    <Text style={styles.dumbbellNote}>
                      Weight shown is per hand (each dumbbell)
                    </Text>
                  )}
                  {exercise.progressionNote && (
                    <View style={styles.progressionNoteRow}>
                      <Ionicons name="trending-up-outline" size={11} color={C.primary} />
                      <Text style={styles.progressionNoteText}>{exercise.progressionNote}</Text>
                    </View>
                  )}
                </View>
                <Ionicons
                  name={expanded ? 'chevron-up' : 'chevron-down'}
                  size={18}
                  color={C.textTertiary}
                  style={styles.chevron}
                />
              </Pressable>

              <View style={styles.actionRow}>
                <Pressable
                  ref={videoBtnRef}
                  onPress={onVideoPress}
                  style={styles.iconActionBtn}
                  testID={`video-${index}`}
                >
                  <Ionicons name="logo-youtube" size={20} color="#CC0000" />
                </Pressable>
                {exercise.hasSwap && (
                  <Pressable
                    ref={swapBtnRef}
                    onPress={onSwapPress}
                    style={[
                      styles.iconActionBtn,
                      setData.swapCount > 0 && styles.iconActionBtnActive,
                    ]}
                    testID={`swap-${index}`}
                  >
                    <Ionicons
                      name="swap-horizontal-outline"
                      size={18}
                      color={setData.swapCount > 0 ? C.primary : C.textSecondary}
                    />
                  </Pressable>
                )}
                <Pressable
                  onPress={onToggleNote}
                  style={[styles.iconActionBtn, noteVisible && styles.iconActionBtnActive]}
                  testID={`note-toggle-${index}`}
                >
                  <Ionicons
                    name={noteVisible ? 'pencil' : 'pencil-outline'}
                    size={17}
                    color={noteVisible ? C.primary : C.textSecondary}
                  />
                </Pressable>
              </View>

              {exercise.badge === 'comfort' && comfortRegionLabel && (
                <View style={styles.comfortNote}>
                  <Ionicons name="heart-circle-outline" size={13} color={C.warning} />
                  <Text style={styles.comfortNoteText}>
                    Adapted for {comfortRegionLabel}, tap Swap or skip if still uncomfortable
                  </Text>
                </View>
              )}

              {expanded && (
                <View style={styles.setsContainer}>
                  <View style={styles.cueContainer}>
                    <Ionicons name="bulb-outline" size={14} color={C.primary} />
                    <Text style={styles.cueText}>{exercise.cue}</Text>
                  </View>

                  {exercise.type === 'cardio' && (
                    <CardioInputBlock
                      cardioData={setData.cardioData}
                      onLog={(data) => {
                        onSetChange(0, {
                          setNumber: 1,
                          weight: 0,
                          reps: 0,
                          completed: true,
                        });
                        onCardioLog?.(data);
                      }}
                    />
                  )}

                  {exercise.type !== 'cardio' &&
                    (exercise.id === 'cardio-warmup' ||
                      (exercise.category === 'prep' && index === 0)) && (
                      <CardioWarmupTimer repsStr={exercise.reps} />
                    )}

                  {exercise.type !== 'cardio' &&
                    exercise.id !== 'cardio-warmup' &&
                    !(exercise.category === 'prep' && index === 0) && (
                      <RestTimer category={exercise.category} trigger={effectiveTimerTrigger} />
                    )}

                  {exercise.type !== 'cardio' &&
                    !isBandExercise &&
                    (exercise.category === 'main' || exercise.category === 'neuro') && (
                      <View style={styles.spotterAdvisory}>
                        <Ionicons
                          name="shield-checkmark-outline"
                          size={12}
                          color={C.textTertiary}
                        />
                        <Text style={styles.spotterAdvisoryText}>
                          Consider a spotter for heavy lifts
                        </Text>
                      </View>
                    )}

                  {/* ── Set-by-set view (hidden for cardio exercises) ───────── */}
                  {exercise.type !== 'cardio' &&
                    (() => {
                      const activeSetIndex =
                        setData.activeSetIndex ??
                        (allDone
                          ? setData.sets.length
                          : setData.sets.findIndex((s) => !s.completed));
                      // Use slice(0, activeSetIndex) but also verify each set is truly completed
                      // - defensive for restored legacy data with irregular completion order
                      const completedSets = setData.sets
                        .slice(0, activeSetIndex)
                        .filter((s) => s.completed);
                      const prevSetWeight =
                        activeSetIndex > 0
                          ? setData.sets[activeSetIndex - 1].weight
                          : previousSessionWeight;

                      return (
                        <>
                          {/* Completed sets chips */}
                          {completedSets.length > 0 && (
                            <ScrollView
                              horizontal
                              showsHorizontalScrollIndicator={false}
                              style={styles.doneChipsScroll}
                              contentContainerStyle={styles.doneChipsContent}
                            >
                              {completedSets.map((s, i) => {
                                let chipLabel = '';
                                if (isTimeExercise) {
                                  chipLabel = 'done';
                                } else if (isBandExercise) {
                                  chipLabel = `${s.reps} reps`;
                                } else {
                                  const w = kgToDisplayUnit(s.weight, weightUnit);
                                  chipLabel = `${w}${weightUnit} × ${s.reps}`;
                                }
                                return (
                                  <View key={i} style={styles.doneChip}>
                                    <Text style={styles.doneChipText}>
                                      S{i + 1} · {chipLabel}
                                    </Text>
                                    <Ionicons name="checkmark" size={10} color={C.primary} />
                                  </View>
                                );
                              })}
                            </ScrollView>
                          )}

                          {/* Active set indicator – inputs live in SessionActiveBar */}
                          {!allDone &&
                            activeSetIndex >= 0 &&
                            activeSetIndex < setData.sets.length && (
                              <View style={styles.activeSetInCard}>
                                <Ionicons name="barbell-outline" size={14} color={C.primary} />
                                <Text style={styles.activeSetInCardText}>
                                  Set {activeSetIndex + 1} of {setData.sets.length} · log below ↓
                                </Text>
                              </View>
                            )}

                          {/* All sets done indicator */}
                          {allDone && (
                            <View style={styles.allSetsDone}>
                              <Ionicons name="checkmark-circle" size={18} color={C.primary} />
                              <Text style={styles.allSetsDoneText}>All sets complete!</Text>
                            </View>
                          )}

                          {!allDone && onSkipExercise && (
                            <Pressable
                              onPress={onSkipExercise}
                              style={styles.skipExerciseLink}
                              testID={`skip-exercise-${index}`}
                            >
                              <Text style={styles.skipExerciseLinkText}>
                                {"Skip - couldn't do this exercise"}
                              </Text>
                            </Pressable>
                          )}
                        </>
                      );
                    })()}

                  {noteVisible && (
                    <View style={styles.noteInputRow}>
                      <TextInput
                        style={styles.noteInput}
                        placeholder="Add a note…"
                        placeholderTextColor={C.textTertiary}
                        value={note}
                        onChangeText={onNoteChange}
                        returnKeyType="done"
                        multiline={false}
                        maxLength={160}
                        testID={`note-${index}`}
                      />
                    </View>
                  )}
                </View>
              )}
            </Animated.View>
          </Animated.View>
        )}
      </View>
    </Animated.View>
  );
}

/**
 * Exported for unit testing. Renders the pain-adaptation banner that appears
 * at the top of a session when `hasAches && painRegion && !dismissed`.
 * The parent (SessionScreen) owns the `dismissed` state so it can persist it
 * with the rest of the stored session.
 */
export function PainAdaptBanner({
  hasAches,
  painRegion,
  comfortCount,
  dismissed,
  onDismiss,
}: {
  hasAches: boolean;
  painRegion: PainRegion | undefined;
  comfortCount: number;
  dismissed: boolean;
  onDismiss: () => void;
}) {
  const C = useColors();
  if (!hasAches || !painRegion || dismissed) return null;
  return (
    <Animated.View
      entering={FadeInDown.duration(350)}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        marginHorizontal: 16,
        marginBottom: 6,
        paddingVertical: 10,
        paddingHorizontal: 12,
        backgroundColor: C.warningLight,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: C.warning + '44',
        gap: 10,
      }}
    >
      <View style={{ flex: 1, flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
        <Ionicons name="shield-checkmark" size={16} color={C.warning} />
        <View style={{ flex: 1 }}>
          <Text
            style={{
              fontSize: 13,
              fontFamily: 'Inter_600SemiBold',
              color: C.warning,
              marginBottom: 1,
            }}
          >
            Adapted for {getPainRegionLabel(painRegion)}
          </Text>
          <Text
            style={{
              fontSize: 12,
              fontFamily: 'Inter_400Regular',
              color: C.warning,
              opacity: 0.85,
              lineHeight: 17,
            }}
          >
            {comfortCount > 0
              ? `${comfortCount} ${comfortCount === 1 ? 'exercise' : 'exercises'} swapped for comfort. Tap Swap or skip any that still hurt`
              : 'No exercises needed swapping. Tap Swap or skip anything that hurts'}
          </Text>
        </View>
      </View>
      <Pressable
        onPress={onDismiss}
        style={{ padding: 4, alignItems: 'center', justifyContent: 'center' }}
        testID="pain-banner-dismiss"
      >
        <Ionicons name="close" size={16} color={C.warning} />
      </Pressable>
    </Animated.View>
  );
}

// ─── Demo session exercises ────────────────────────────────────────────────
// A hardcoded, realistic-looking set of exercises used in demo mode (?demo=true).
// Covers each tutorial spotlight target: firstCard, sessionBar, progressBar.
// No data from this session is ever persisted to the store.

const DEMO_EXERCISES: Exercise[] = [
  {
    id: 'demo-squat',
    name: 'Barbell Back Squat',
    sets: 3,
    reps: '8',
    cue: 'Bar across upper traps, chest tall. Push knees out as you lower, drive hard through heels to stand.',
    suggestedLoad: '60 kg',
    category: 'main',
    badge: undefined,
    videoId: '',
    hasSwap: true,
    swapName: 'Goblet Squat',
    swapCue: 'Hold a weight at chest height. Sit deep, elbows tracking inside knees.',
    swapLoad: '16 kg',
  },
  {
    id: 'demo-rdl',
    name: 'Romanian Deadlift',
    sets: 3,
    reps: '10',
    cue: 'Push hips back with a soft knee bend. Bar stays close to your legs the whole way down. Feel the hamstring stretch.',
    suggestedLoad: '50 kg',
    category: 'accessory',
    badge: undefined,
    videoId: '',
    hasSwap: true,
    swapName: 'Dumbbell RDL',
    swapCue: 'Same hinge pattern, dumbbells either side. Keep the DBs close to your legs.',
    swapLoad: '20 kg',
  },
  {
    id: 'demo-leg-curl',
    name: 'Lying Leg Curl',
    sets: 3,
    reps: '12',
    cue: 'Hips flat on the pad. Curl heels toward glutes with control, hold briefly at the top.',
    suggestedLoad: '40 kg',
    category: 'accessory',
    badge: undefined,
    videoId: '',
    hasSwap: false,
  },
  {
    id: 'demo-plank',
    name: 'Dead Bug',
    sets: 3,
    reps: '10',
    cue: 'Lower back pressed flat. Extend opposite arm and leg, breathing out as you go. Keep core braced throughout.',
    suggestedLoad: 'Bodyweight',
    category: 'prehab',
    badge: undefined,
    videoId: '',
    hasSwap: false,
  },
];

// ─── In-session tutorial content ──────────────────────────────────────────

interface TutorialStep {
  iconName: string;
  iconLabel: string;
  title: string;
  body: string;
  /** Override the default 190px card-to-bottom offset for steps that spotlight elements near the bottom bar. */
  bottomOffset?: number;
  /** Which UI ref to spotlight for this step. */
  spotlightRef: 'firstCard' | 'sessionBar' | 'progressBar';
  /** Which specific measured sub-element within the spotlight the arrow should
   *  point at (e.g. a specific icon button). When omitted, the arrow points at
   *  the horizontal center of the spotlighted rect itself. */
  arrowTarget?: 'video' | 'swap';
  /** When true (requires arrowTarget), the spotlight cutout tightly hugs the
   *  arrowTarget element itself instead of the whole spotlightRef region —
   *  use when the step is only about one icon, not the card in general. */
  spotlightArrowTargetOnly?: true;
  /** If true, this step is skipped for session types that don't use weight logging (prehab, flexibility). */
  requiresWeightLogging?: true;
  /** 'up' (default) means the spotlighted element sits above the card, so the
   *  card is anchored near the bottom of the screen with an up-pointing arrow.
   *  'down' means the target is a bottom-pinned bar BELOW the card (e.g.
   *  sessionBar) — the card anchors above the target's measured position with
   *  a down-pointing arrow instead. */
  arrowDirection?: 'up' | 'down';
  /** Demo mode only: force the session bar into its post-set feedback UI
   *  (Too Easy / OK / Hard) for the duration of this step, regardless of
   *  whether the user actually tapped the demo's log-set button — the demo
   *  doesn't process real taps, so without this the step would narrate a
   *  UI that never actually appears. */
  demoForceFeedback?: true;
}

const SESSION_TUTORIAL: readonly TutorialStep[] = [
  {
    spotlightRef: 'firstCard',
    arrowTarget: 'video',
    iconName: 'barbell-outline',
    iconLabel: 'Exercise',
    title: 'Your first exercise',
    body: "Tap 'Watch form' for a video demo before you start. Work through exercises in order — the app builds them to flow.",
  },
  {
    spotlightRef: 'sessionBar',
    requiresWeightLogging: true,
    iconName: 'create-outline',
    iconLabel: 'Log sets',
    title: 'Log every set',
    body: 'Type the weight and reps, then tap the green button to save the set. The app remembers your weights and auto-suggests next time.',
    arrowDirection: 'down',
  },
  {
    spotlightRef: 'sessionBar',
    requiresWeightLogging: true,
    iconName: 'happy-outline',
    iconLabel: 'Feedback',
    title: 'Tell us how it felt',
    body: 'After each set rate it Too Easy, OK or Hard. This drives the automatic weight progression — check the Progress tab after your session to see exactly what changed.',
    arrowDirection: 'down',
    demoForceFeedback: true,
  },
  {
    spotlightRef: 'firstCard',
    arrowTarget: 'swap',
    spotlightArrowTargetOnly: true,
    iconName: 'shuffle-outline',
    iconLabel: 'Swap',
    title: 'Swap any exercise',
    body: 'Tap the swap icon on any card to get an alternative for the same muscle group. Useful if equipment is taken or something hurts.',
  },
  {
    spotlightRef: 'progressBar',
    iconName: 'stats-chart-outline',
    iconLabel: 'Progress',
    title: "You're on your way",
    body: 'The bar at the top tracks your sets. Every session you complete builds your streak and moves you closer to the next milestone badge.',
  },
];

export default function SessionScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    sessionType: string;
    hasAches: string;
    painRegion: string;
    energy: string;
    timeAvailable: string;
    isTestWeek: string;
    equipment: string;
    displayLabel?: string;
    demo?: string;
  }>();
  const isDemo = params.demo === 'true';

  const VALID_SESSION_TYPES: SessionType[] = [
    'squat',
    'bench',
    'deadlift',
    'upper_body',
    'lower_body',
    'full_body',
    'conditioning',
    'prehab',
    'flexibility',
    'custom',
  ];
  const VALID_ENERGY: EnergyLevel[] = ['low', 'normal', 'high'];
  const VALID_TIME: TimeAvailable[] = ['30', '45', '60'];

  const sessionType = VALID_SESSION_TYPES.includes(params.sessionType as SessionType)
    ? (params.sessionType as SessionType)
    : 'squat';
  const hasAches = params.hasAches === 'true';
  const painRegion = params.painRegion
    ? (params.painRegion.split(',')[0] as PainRegion)
    : undefined;
  const painRegions: PainRegion[] | undefined = params.painRegion
    ? params.painRegion
        .split(',')
        .filter(Boolean)
        .map((r) => r as PainRegion)
    : undefined;
  const energy = VALID_ENERGY.includes(params.energy as EnergyLevel)
    ? (params.energy as EnergyLevel)
    : 'normal';
  const timeAvailable = VALID_TIME.includes(params.timeAvailable as TimeAvailable)
    ? (params.timeAvailable as TimeAvailable)
    : '60';
  const NON_TEST_TYPES: SessionType[] = [
    'prehab',
    'flexibility',
    'conditioning',
    'custom',
    'upper_body',
    'lower_body',
    'full_body',
  ];
  const isTestWeek = params.isTestWeek === 'true' && !NON_TEST_TYPES.includes(sessionType);
  const paramDisplayLabel =
    typeof params.displayLabel === 'string' && params.displayLabel.length > 0
      ? params.displayLabel
      : undefined;

  const C = useColors();
  const styles = useMemo(() => makeStyles(C), [C]);
  const {
    getEffectiveTier,
    completeSession,
    addOneRepMax,
    userProfile,
    exerciseFeedback,
    getBestORM,
    completedSessions,
    weightUnit,
    activeSession,
    setActiveSession,
    clearActiveSession,
    updateLastLoggedWeights,
    lastLoggedWeights,
    reviewPromptShown,
    setReviewPromptShown,
    exerciseNormalStreak,
    lastSessionPerformance,
    pendingCustomExercises,
    clearPendingCustomExercises,
    sessionTutorialShown,
    setSessionTutorialShown,
    setTourComplete,
    setTourJustCompleted,
    markTourGenuinelyCompleted,
  } = useAppStore();
  // Fall back to the saved active-session label when the resume path did not
  // forward the displayLabel param (e.g. older resume entry points).
  const displayLabel =
    paramDisplayLabel ??
    (activeSession && activeSession.sessionType === sessionType
      ? activeSession.displayLabel
      : undefined);
  // Only count strength sessions for auto-progression - conditioning, prehab,
  // and flexibility sessions do not drive strength progressive overload.
  const strengthCount = completedSessions.filter((s) =>
    STRENGTH_SESSION_TYPES.includes(s.sessionType)
  ).length;
  const VALID_EQUIPMENT: EquipmentTier[] = [
    'bodyweight',
    'bands',
    'dumbbells',
    'kettlebells',
    'fullgym',
  ];
  const equipmentTier: EquipmentTier = VALID_EQUIPMENT.includes(params.equipment as EquipmentTier)
    ? (params.equipment as EquipmentTier)
    : getEffectiveTier();

  const isDumbbellSession = equipmentTier === 'dumbbells' || equipmentTier === 'kettlebells';

  // Capture exerciseFeedback at session start so mid-session store updates don't re-generate exercises
  const exerciseFeedbackAtStart = useRef<Record<string, ExerciseFeedback>>(exerciseFeedback);
  // Snapshot custom exercises at mount so store.clearPendingCustomExercises() doesn't empty the list mid-session.
  // On resume, pendingCustomExercises is already cleared; fall back to what was persisted in activeSession.
  const customExercisesSnapshot = useRef<CustomExercise[]>(
    sessionType === 'custom'
      ? pendingCustomExercises.length > 0
        ? pendingCustomExercises
        : (activeSession?.customExercises ?? [])
      : []
  );

  // Compute per-exercise previous best weight from persisted sessions.
  // useMemo re-runs when completedSessions changes (e.g. after async hydration completes)
  // but NOT on keystrokes (keystroke state only updates exerciseData, not completedSessions).
  const previousBest = useMemo<Record<string, number>>(() => {
    const lookup: Record<string, number> = {};
    for (const session of completedSessions) {
      for (const exLog of session.exerciseLogs) {
        const maxWeight = exLog.sets.reduce((m, s) => (s.weight > m ? s.weight : m), 0);
        if (maxWeight > 0) {
          if (lookup[exLog.exerciseId] === undefined || maxWeight > lookup[exLog.exerciseId]) {
            lookup[exLog.exerciseId] = maxWeight;
          }
        }
      }
    }
    return lookup;
  }, [completedSessions]);

  // Per-exercise average weight from the most recent session - used as kg placeholder pre-fill
  const previousSessionWeights = useMemo<Record<string, number>>(() => {
    const lookup: Record<string, number> = {};
    // completedSessions is newest-first
    for (const session of completedSessions) {
      for (const exLog of session.exerciseLogs) {
        if (lookup[exLog.exerciseId] !== undefined) continue;
        const completedSets = exLog.sets.filter((s) => s.completed && s.weight > 0);
        if (completedSets.length === 0) continue;
        const avg = completedSets.reduce((sum, s) => sum + s.weight, 0) / completedSets.length;
        lookup[exLog.exerciseId] = Math.round(avg * 10) / 10;
      }
    }
    return lookup;
  }, [completedSessions]);

  // Per-exercise last-session hint: last completed set's weight + reps + date.
  // completedSessions is newest-first, so first match per exercise = most recent.
  const previousSessionData = useMemo<
    Record<string, { weight: number; reps: number; date: string }>
  >(() => {
    const lookup: Record<string, { weight: number; reps: number; date: string }> = {};
    for (const session of completedSessions) {
      for (const exLog of session.exerciseLogs) {
        if (lookup[exLog.exerciseId] !== undefined) continue;
        const done = exLog.sets.filter((s) => s.completed && !s.skipped);
        if (done.length === 0) continue;
        const last = done[done.length - 1];
        lookup[exLog.exerciseId] = { weight: last.weight, reps: last.reps, date: session.date };
      }
    }
    return lookup;
  }, [completedSessions]);

  const exercises = useMemo(() => {
    if (isDemo) return DEMO_EXERCISES;
    if (sessionType === 'custom') {
      return customExercisesSnapshot.current.map((ce: CustomExercise): Exercise => ({
        id: ce.id,
        name: ce.name,
        sets: ce.sets,
        reps: ce.reps,
        cue: ce.cue,
        suggestedLoad: ce.suggestedLoad,
        category: ce.category,
        type: ce.type,
        badge: undefined,
        videoId: '',
        hasSwap: false,
      }));
    }
    if (isTestWeek) {
      return generate1RMWorkout(sessionType, equipmentTier, strengthCount);
    }
    const bestOrm = getBestORM(sessionType);
    const bestOrmKg = bestOrm ? bestOrm.weight : undefined;
    return generateWorkout(
      sessionType,
      equipmentTier,
      {
        hasAches,
        painRegion: painRegions && painRegions.length > 0 ? painRegions : painRegion,
        energy,
        timeAvailable,
      },
      userProfile,
      exerciseFeedbackAtStart.current,
      bestOrmKg,
      strengthCount,
      lastLoggedWeights,
      exerciseNormalStreak,
      lastSessionPerformance
    );
  }, [
    sessionType,
    equipmentTier,
    hasAches,
    painRegion,
    energy,
    timeAvailable,
    isTestWeek,
    userProfile,
    getBestORM,
    strengthCount,
    lastLoggedWeights,
    exerciseNormalStreak,
    lastSessionPerformance,
  ]);

  const [exerciseData, setExerciseData] = useState<ExerciseSetData[]>([]);

  const comfortCount = useMemo(
    () =>
      exercises.filter((ex, i) => ex.badge === 'comfort' && (exerciseData[i]?.swapCount ?? 0) === 0)
        .length,
    [exercises, exerciseData]
  );
  const [exerciseNotes, setExerciseNotes] = useState<string[]>([]);
  const [cardioLogs, setCardioLogs] = useState<(CardioLogData | null)[]>([]);
  const [showAbandonModal, setShowAbandonModal] = useState(false);
  const [showDemoComplete, setShowDemoComplete] = useState(false);
  const [painBannerDismissed, setPainBannerDismissed] = useState(false);
  const [barTimerTrigger, setBarTimerTrigger] = useState(0);
  const [notesVisible, setNotesVisible] = useState<boolean[]>([]);
  const [inSessionFeedback, setInSessionFeedback] = useState<
    Record<string, 'easy' | 'hard' | null>
  >({});

  const [tutStep, setTutStep] = useState<number | null>(null);
  const tutStartedRef = useRef(false);

  const effectiveTutorial = useMemo(
    () =>
      sessionType === 'prehab' || sessionType === 'flexibility'
        ? SESSION_TUTORIAL.filter((s) => !s.requiresWeightLogging)
        : SESSION_TUTORIAL,
    [sessionType]
  );

  // ── Spotlight refs for session tutorial ─────────────────────────────────
  const progressBarRef = useRef<View>(null);
  const sessionBarRef = useRef<View>(null);
  const firstCardRef = useRef<View>(null);
  // Only needed to give the tutorial's arrow a real target for the two steps
  // that point at a specific icon (video / swap) rather than the whole card.
  const videoBtnRef = useRef<View>(null);
  const swapBtnRef = useRef<View>(null);
  const [tutSpotlight, setTutSpotlight] = useState<SpotlightRect | null>(null);
  const [tutArrowX, setTutArrowX] = useState<number | null>(null);
  // Only set for arrowDirection: 'down' steps — derived from the target's
  // measured top so the card sits flush above it regardless of how tall the
  // target actually is (sessionBar's height varies with its content).
  const [tutBottomOffset, setTutBottomOffset] = useState<number | null>(null);
  const { height: SCREEN_H } = useWindowDimensions();

  // Measure the spotlighted element whenever the tutorial step changes.
  // Clear the spotlight immediately on step change to avoid showing a stale rect
  // from the previous step while the new measurement is pending (fast-tap safety).
  useEffect(() => {
    setTutSpotlight(null);
    setTutArrowX(null);
    setTutBottomOffset(null);
    if (tutStep === null) return;
    const refLookup = {
      firstCard: firstCardRef,
      sessionBar: sessionBarRef,
      progressBar: progressBarRef,
    };
    const arrowTargetRefLookup = { video: videoBtnRef, swap: swapBtnRef };
    const step = effectiveTutorial[tutStep];
    const target = step ? refLookup[step.spotlightRef] : null;
    const arrowTargetRef = step?.arrowTarget ? arrowTargetRefLookup[step.arrowTarget] : null;
    const tightIconSpotlight = step?.spotlightArrowTargetOnly && arrowTargetRef;
    const timer = setTimeout(() => {
      if (tightIconSpotlight) {
        // This step is only about one icon — spotlight it tightly instead of
        // the whole card, and skip the separate whole-region measurement below.
        arrowTargetRef.current?.measureInWindow((x, y, w, h) => {
          if (w > 0 && h > 0) {
            setTutSpotlight({ top: y - 8, left: x - 8, width: w + 16, height: h + 16 });
            setTutArrowX(x + w / 2);
          }
        });
        return;
      }
      target?.current?.measureInWindow((x, y, w, h) => {
        if (w > 0 && h > 0) {
          setTutSpotlight({
            top: y - 4,
            left: x - 4,
            width: w + 8,
            height: h + 8,
          });
          // Default: center the arrow on the spotlighted rect itself.
          setTutArrowX(x + w / 2);
          // Down-arrow steps: anchor the card to the target's real top edge
          // instead of a fixed guess, so it tracks sessionBar's actual height.
          if (step?.arrowDirection === 'down') {
            setTutBottomOffset(SCREEN_H - y + 12);
          }
        }
      });
      // If this step points at a specific icon, measure it too and use its
      // real center instead of the spotlight's center — the icon's position
      // doesn't scale proportionally with screen width, so a fixed fraction
      // of the card's width can land nowhere near it.
      arrowTargetRef?.current?.measureInWindow((x, _y, w) => {
        if (w > 0) setTutArrowX(x + w / 2);
      });
    }, 120);
    return () => clearTimeout(timer);
  }, [tutStep]); // eslint-disable-line react-hooks/exhaustive-deps

  const advanceTut = useCallback(() => {
    setTutStep((prev) => {
      if (prev === null) return null;
      const next = prev + 1;
      if (next >= effectiveTutorial.length) {
        setSessionTutorialShown(true);
        if (isDemo) {
          setTourComplete(true);
          setTourJustCompleted(true);
          setShowDemoComplete(true);
        }
        return null;
      }
      return next;
    });
  }, [effectiveTutorial, isDemo, setSessionTutorialShown, setTourComplete, setTourJustCompleted]);

  const skipTut = useCallback(() => {
    setTutStep(null);
    setSessionTutorialShown(true);
    if (isDemo) {
      setTourComplete(true);
      setTourJustCompleted(true);
      router.navigate('/(tabs)' as any);
    }
  }, [isDemo, setSessionTutorialShown, setTourComplete, setTourJustCompleted]);

  // Auto-start the tutorial only in demo mode. Real sessions never auto-trigger it.
  useEffect(() => {
    if (isDemo && exercises.length > 0 && !tutStartedRef.current) {
      tutStartedRef.current = true;
      const timer = setTimeout(() => setTutStep(0), 800);
      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exercises.length]);

  const handleBarSetCompleted = useCallback(() => {
    setBarTimerTrigger((n) => n + 1);
  }, []);

  const [pbFlashIndex, setPbFlashIndex] = useState<number | null>(null);
  const pbShownRef = useRef<Set<number>>(new Set());
  const pbTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleNewPb = useCallback(() => {
    const idx = activeIndexRef.current;
    if (pbShownRef.current.has(idx)) return;
    pbShownRef.current.add(idx);
    if (pbTimerRef.current) clearTimeout(pbTimerRef.current);
    setPbFlashIndex(idx);
    pbTimerRef.current = setTimeout(() => setPbFlashIndex(null), 2500);
  }, []);

  const toggleNoteVisible = useCallback(
    (idx: number) => {
      setNotesVisible((prev) => {
        const next = [...prev];
        next[idx] = !next[idx];
        // Scroll the card into view when opening the note input so the pencil
        // button and the text field are both reachable before the keyboard appears.
        if (next[idx]) {
          setTimeout(() => {
            const y = cardYPositions.current[idx];
            if (y !== undefined && scrollViewRef.current) {
              scrollViewRef.current.scrollTo({ y: Math.max(0, y - 80), animated: true });
            }
          }, 50);
        }
        return next;
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const handleBarFeedback = useCallback((exerciseId: string, f: 'easy' | 'hard') => {
    setInSessionFeedback((prev) => ({ ...prev, [exerciseId]: f }));
    if (Platform.OS !== 'web') Haptics.selectionAsync();
  }, []);

  // Elapsed session timer
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const elapsedSecondsRef = useRef(0);
  useEffect(() => {
    if (isDemo) return; // demo sessions do not run a live timer
    const timerId = setInterval(() => {
      setElapsedSeconds((s) => {
        elapsedSecondsRef.current = s + 1;
        return s + 1;
      });
    }, 1000);
    return () => clearInterval(timerId);
  }, [isDemo]);
  const elapsedMM = String(Math.floor(elapsedSeconds / 60)).padStart(2, '0');
  const elapsedSS = String(elapsedSeconds % 60).padStart(2, '0');

  // Mutable refs for background save (avoid stale closures in AppState listener)
  const exerciseDataRef = useRef<ExerciseSetData[]>([]);
  const exerciseNotesRef = useRef<string[]>([]);
  const activeIndexRef = useRef<number>(0);
  const exerciseIdsRef = useRef<string[]>([]);
  const painBannerDismissedRef = useRef(false);
  // Ref to always-current activeSession (used in effects whose deps don't include activeSession)
  const activeSessionRef = useRef(activeSession);
  useEffect(() => {
    activeSessionRef.current = activeSession;
  }, [activeSession]);
  // Guard: prevent autosave/background writes after session is completed or discarded
  const sessionTerminatedRef = useRef(false);
  // Guard: ensure we only restore from activeSession once
  const hasRestoredRef = useRef(false);
  // Guard: when the user manually goes back to a previous (already-completed)
  // exercise, skip the very next auto-advance check — otherwise it would
  // immediately bounce them straight forward again since that exercise's sets
  // are all still marked complete.
  const suppressAutoAdvanceRef = useRef(false);
  useEffect(() => {
    exerciseDataRef.current = exerciseData;
  }, [exerciseData]);
  useEffect(() => {
    exerciseNotesRef.current = exerciseNotes;
  }, [exerciseNotes]);
  useEffect(() => {
    exerciseIdsRef.current = exercises.map((ex) => ex.id);
  }, [exercises]);
  useEffect(() => {
    painBannerDismissedRef.current = painBannerDismissed;
  }, [painBannerDismissed]);

  // Sequential exercise active index (active | past | future model)
  const [activeIndex, setActiveIndex] = useState(0);
  useEffect(() => {
    activeIndexRef.current = activeIndex;
  }, [activeIndex]);

  // Background save: persist state whenever app is backgrounded or goes inactive
  useEffect(() => {
    const saveSnapshot = () => {
      if (isDemo) return;
      if (sessionTerminatedRef.current) return;
      const data = exerciseDataRef.current;
      if (data.length === 0) return;
      const notes = exerciseNotesRef.current;
      const idx = activeIndexRef.current;
      const ids = exerciseIdsRef.current;
      // Require minimal engagement before creating a resume snapshot (prevents
      // a resume card just from opening the session and backgrounding)
      const hasMinimalProgress =
        idx > 0 ||
        data.some(
          (ed) => ed.sets.some((s) => s.completed || s.weight > 0 || s.reps > 0) || ed.swapCount > 0
        ) ||
        notes.some((n) => n.length > 0);
      if (!hasMinimalProgress) return;
      const completedSetsCount = data.reduce(
        (sum, ed) => sum + ed.sets.filter((s) => s.completed).length,
        0
      );
      const totalSets = data.reduce((sum, ed) => sum + ed.sets.length, 0);
      setActiveSession({
        sessionType,
        equipmentTier,
        hasAches,
        painRegion,
        energy,
        timeAvailable,
        isTestWeek,
        exerciseData: data,
        exerciseNotes: notes,
        activeIndex: idx,
        savedAt: new Date().toISOString(),
        completedSetsCount,
        totalSets,
        sessionName: getSessionLabel(sessionType),
        displayLabel,
        elapsedSeconds: elapsedSecondsRef.current,
        exerciseIds: ids,
        painBannerDismissed: painBannerDismissedRef.current,
        ...(sessionType === 'custom' ? { customExercises: customExercisesSnapshot.current } : {}),
      });
    };
    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'background' || state === 'inactive') saveSnapshot();
    });
    return () => {
      sub.remove();
      saveSnapshot();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const scrollViewRef = useRef<ScrollView>(null);
  const cardYPositions = useRef<Record<number, number>>({});
  // Set to true after a restore so the first onCardLayout for the active card triggers a scroll
  const pendingScrollToActiveRef = useRef(false);

  // Helper: attempt to restore stored session state onto loaded exercises.
  // Returns true if restored, false if not (caller decides fallback).
  const tryRestoreFromStored = (exs: typeof exercises, stored: typeof activeSession): boolean => {
    if (hasRestoredRef.current || !stored || exs.length === 0) return false;
    const currentIds = exs.map((ex) => ex.id);
    const idsMatch =
      Array.isArray(stored.exerciseIds) &&
      stored.exerciseIds.length === currentIds.length &&
      stored.exerciseIds.every((id, i) => id === currentIds[i]);
    const canRestore =
      stored.sessionType === sessionType &&
      stored.equipmentTier === equipmentTier &&
      stored.hasAches === hasAches &&
      (stored.painRegion ?? '') === (painRegion ?? '') &&
      stored.energy === energy &&
      stored.timeAvailable === timeAvailable &&
      stored.isTestWeek === isTestWeek &&
      stored.exerciseData.length === exs.length &&
      idsMatch;
    if (!canRestore) return false;
    hasRestoredRef.current = true;
    // Cap the added time to 90 min - prevents absurd timer values if the app
    // was closed overnight and then resumed (the session was not actually running).
    const timeSinceSave = Math.min(
      Math.floor((Date.now() - new Date(stored.savedAt).getTime()) / 1000),
      5400
    );
    const restoredElapsed = Math.max(0, stored.elapsedSeconds + timeSinceSave);
    setElapsedSeconds(restoredElapsed);
    elapsedSecondsRef.current = restoredElapsed;
    // Restore exerciseData, deriving activeSetIndex from sets if missing (old snapshots)
    const restoredData: ExerciseSetData[] = (stored.exerciseData as ExerciseSetData[]).map((ed) => {
      const activeSetIndex =
        ed.activeSetIndex !== undefined
          ? ed.activeSetIndex
          : (() => {
              const firstUncompleted = ed.sets.findIndex((s) => !s.completed);
              return firstUncompleted === -1 ? ed.sets.length : firstUncompleted;
            })();
      return { ...ed, activeSetIndex };
    });
    setExerciseData(restoredData);
    setExerciseNotes(
      stored.exerciseNotes.length === exs.length ? stored.exerciseNotes : exs.map(() => '')
    );
    setActiveIndex(Math.min(stored.activeIndex, exs.length - 1));
    if (stored.painBannerDismissed) setPainBannerDismissed(true);
    if (stored.inSessionFeedback) setInSessionFeedback(stored.inSessionFeedback);
    // Signal that we need to scroll to the restored active card once it reports its layout
    pendingScrollToActiveRef.current = true;
    return true;
  };

  // Primary restore: runs when exercises are computed (normal app flow).
  // Reads activeSession via ref to avoid rerunning on every autosave.
  useEffect(() => {
    if (exercises.length === 0) return;
    const restored = tryRestoreFromStored(exercises, activeSessionRef.current);
    if (!restored) {
      setExerciseData(
        exercises.map((ex) => ({
          sets: Array.from({ length: ex.sets }, (_, i) => ({
            setNumber: i + 1,
            weight: 0,
            reps: 0,
            completed: false,
          })),
          swapCount: 0,
          activeSetIndex: 0,
        }))
      );
      setExerciseNotes(exercises.map(() => ''));
      setActiveIndex(0);
    }
    cardYPositions.current = {};
    if (sessionType === 'custom') {
      clearPendingCustomExercises();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exercises]);

  // Late-hydration restore: runs only when activeSession arrives after exercises.
  // Only attempts restore (no fresh-init fallback, exercises already initialised).
  useEffect(() => {
    if (!hasRestoredRef.current && exercises.length > 0 && activeSession !== null) {
      tryRestoreFromStored(exercises, activeSession);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSession]);

  // Auto-advance to next exercise when current is fully complete
  useEffect(() => {
    if (exerciseData.length === 0) return;
    if (activeIndex >= exerciseData.length) return;
    if (suppressAutoAdvanceRef.current) {
      suppressAutoAdvanceRef.current = false;
      return;
    }
    const currentDone = exerciseData[activeIndex]?.sets.every((s) => s.completed);
    if (currentDone) {
      const nextIndex = activeIndex + 1;
      setActiveIndex(nextIndex);
      if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      // Center-scroll to the newly active exercise after its animation starts
      setTimeout(() => {
        const y = cardYPositions.current[nextIndex];
        if (y !== undefined && scrollViewRef.current) {
          scrollViewRef.current.scrollTo({ y: Math.max(0, y - 80), animated: true });
        }
      }, 350);
    }
  }, [exerciseData, activeIndex]);

  // Manual back-navigation — lets the user return to the previous exercise to
  // fix a mis-logged set. The exercise stays marked complete/locked in the
  // list (exState still derives from activeIndex the same way it always has);
  // this just moves the editable "active" pointer back by one step.
  const handleGoBackExercise = useCallback(() => {
    if (activeIndex === 0) return;
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    suppressAutoAdvanceRef.current = true;
    const prevIndex = activeIndex - 1;
    setActiveIndex(prevIndex);
    setTimeout(() => {
      const y = cardYPositions.current[prevIndex];
      if (y !== undefined && scrollViewRef.current) {
        scrollViewRef.current.scrollTo({ y: Math.max(0, y - 80), animated: true });
      }
    }, 350);
  }, [activeIndex]);

  // Auto-save in-progress state whenever data changes (sets, swaps, or notes)
  useEffect(() => {
    if (isDemo) return; // demo sessions must never create a resume snapshot
    if (sessionTerminatedRef.current) return;
    if (exerciseData.length === 0) return;
    const completedSetsCount = exerciseData.reduce(
      (sum, ed) => sum + ed.sets.filter((s) => s.completed).length,
      0
    );
    const totalSets = exerciseData.reduce((sum, ed) => sum + ed.sets.length, 0);
    const hasAnyProgress =
      exerciseData.some(
        (ed) => ed.sets.some((s) => s.completed || s.weight > 0 || s.reps > 0) || ed.swapCount > 0
      ) || exerciseNotes.some((n) => n.length > 0);
    if (!hasAnyProgress) return;
    setActiveSession({
      sessionType,
      equipmentTier,
      hasAches,
      painRegion,
      energy,
      timeAvailable,
      isTestWeek,
      exerciseData,
      exerciseNotes,
      activeIndex,
      savedAt: new Date().toISOString(),
      completedSetsCount,
      totalSets,
      sessionName: getSessionLabel(sessionType),
      displayLabel,
      elapsedSeconds: elapsedSecondsRef.current,
      exerciseIds: exercises.map((ex) => ex.id),
      painBannerDismissed,
      ...(sessionType === 'custom' ? { customExercises: customExercisesSnapshot.current } : {}),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exerciseData, exerciseNotes, activeIndex, painBannerDismissed]);

  const openYouTube = (exerciseName: string) => {
    const query = encodeURIComponent(exerciseName + ' exercise proper form tutorial');
    Linking.openURL('https://www.youtube.com/results?search_query=' + query);
  };
  const [swapModal, setSwapModal] = useState<{ index: number; exercise: Exercise } | null>(null);
  const webTopInset = Platform.OS === 'web' ? 67 : 0;

  const handleSetChange = useCallback(
    (exerciseIndex: number, setIndex: number, updated: SetLog) => {
      setExerciseData((prev) => {
        const next = [...prev];
        const ex = { ...next[exerciseIndex], sets: [...next[exerciseIndex].sets] };
        ex.sets[setIndex] = updated;
        // Recompute activeSetIndex: first uncompleted set, or sets.length if all done
        const firstUncompleted = ex.sets.findIndex((s) => !s.completed);
        ex.activeSetIndex = firstUncompleted === -1 ? ex.sets.length : firstUncompleted;
        next[exerciseIndex] = ex;
        return next;
      });
    },
    []
  );

  const handleCardioLog = useCallback((exerciseIndex: number, data: CardioLogData) => {
    setExerciseData((prev) => {
      const next = [...prev];
      const ex = { ...next[exerciseIndex] };
      ex.cardioData = data;
      next[exerciseIndex] = ex;
      return next;
    });
    setCardioLogs((prev) => {
      const next = [...prev];
      next[exerciseIndex] = data;
      return next;
    });
  }, []);

  const handleNoteChange = useCallback((exerciseIndex: number, text: string) => {
    setExerciseNotes((prev) => {
      const next = [...prev];
      next[exerciseIndex] = text;
      return next;
    });
  }, []);

  const handleSwapConfirm = useCallback((index: number) => {
    setExerciseData((prev) => {
      const cur = prev[index]?.swapCount ?? 0;
      if (cur >= 2) return prev;
      const next = [...prev];
      next[index] = { ...next[index], swapCount: (cur + 1) as 0 | 1 | 2 };
      return next;
    });
    setSwapModal(null);
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, []);

  const handleSkipExercise = useCallback((index: number) => {
    setExerciseData((prev) => {
      const next = [...prev];
      const ex = next[index];
      if (!ex) return prev;
      const skippedSets = ex.sets.map((s) => ({
        ...s,
        weight: 0,
        reps: 0,
        completed: true,
        skipped: true,
      }));
      next[index] = {
        ...ex,
        sets: skippedSets,
        activeSetIndex: skippedSets.length,
      };
      return next;
    });
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const getDisplayExercise = (exercise: Exercise, data: ExerciseSetData): Exercise => {
    const swapCount = data.swapCount ?? 0;
    if (swapCount === 1 && exercise.swapName) {
      return {
        ...exercise,
        name: exercise.swapName,
        cue: exercise.swapCue ?? exercise.cue,
        suggestedLoad: exercise.swapLoad ?? exercise.suggestedLoad,
        hasSwap: true,
        badge: undefined,
      };
    }
    if (swapCount === 2 && exercise.swap2Name) {
      return {
        ...exercise,
        name: exercise.swap2Name,
        cue: exercise.swap2Cue ?? exercise.cue,
        suggestedLoad: exercise.swap2Load ?? exercise.suggestedLoad,
        hasSwap: true,
        badge: undefined,
      };
    }
    return exercise;
  };

  if (exerciseData.length === 0) {
    return (
      <View
        style={[
          styles.container,
          { paddingTop: insets.top + webTopInset, justifyContent: 'center', alignItems: 'center' },
        ]}
      >
        <Text style={{ fontFamily: 'Inter_500Medium', color: C.textSecondary }}>
          Loading session...
        </Text>
      </View>
    );
  }

  const isPrehabOrFlex = sessionType === 'prehab' || sessionType === 'flexibility';
  const allDone = exerciseData.every((ed) => ed.sets.every((s) => s.completed));
  const completedSetsCount = exerciseData.reduce(
    (sum, ed) => sum + ed.sets.filter((s) => s.completed).length,
    0
  );
  const totalSets = exerciseData.reduce((sum, ed) => sum + ed.sets.length, 0);

  const phaseLabelMap: Record<string, string> = {
    prep: 'Warm-Up',
    mechanical: 'Activation',
    neuro: 'Power',
    main: 'KPI Lift',
    accessory: 'Pump',
    prehab: 'Recovery',
    finisher: 'Finisher',
    cooldown: 'Cool Down',
    conditioning: 'Conditioning',
  };
  const activePhaseCategory = exercises[activeIndex]?.category ?? 'prep';
  const currentPhaseLabel = phaseLabelMap[activePhaseCategory] ?? activePhaseCategory;
  const progress = totalSets > 0 ? completedSetsCount / totalSets : 0;

  const handleComplete = () => {
    if (isDemo) {
      setTourComplete(true);
      setSessionTutorialShown(true);
      setTourJustCompleted(true);
      // Only path that reaches this point without skipping or exiting early —
      // earns the one-time welcome badge for genuinely finishing the tour.
      markTourGenuinelyCompleted();
      router.navigate('/(tabs)' as any);
      return;
    }
    if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    if (isTestWeek) {
      const mainExIndex = exercises.findIndex((e) => e.category === 'main');
      if (mainExIndex >= 0) {
        const mainSets = exerciseData[mainExIndex].sets;
        const amrapSet = mainSets.find((s) => s.completed && s.weight > 0 && s.reps > 0);
        if (amrapSet) {
          const estimatedMax = Math.round(amrapSet.weight * (1 + amrapSet.reps / 30));
          addOneRepMax({
            lift: sessionType,
            weight: estimatedMax,
            reps: amrapSet.reps,
            date: new Date().toISOString(),
            unit: 'kg',
          });
        }
      }
    }

    const exerciseLogs: ExerciseLog[] = isPrehabOrFlex
      ? []
      : exercises.map((ex, i) => {
          const rating = inSessionFeedback[ex.id];
          const cardio = exerciseData[i]?.cardioData ?? undefined;
          return {
            exerciseId: ex.id,
            exerciseName: ex.name,
            sets: exerciseData[i].sets,
            note: exerciseNotes[i] || undefined,
            ...(rating != null ? { feedbackRating: rating } : {}),
            ...(cardio != null ? { cardioData: cardio } : {}),
          };
        });

    // Extract per-exercise max weight from this session and persist to store.
    // These are used by the workout engine on the NEXT session to apply a
    // deterministic +2.5 kg micro-increment per exercise (progressive overload).
    if (!isPrehabOrFlex && exerciseLogs.length > 0) {
      const sessionWeights: Record<string, number> = {};
      for (const log of exerciseLogs) {
        const completedWeights = log.sets
          .filter((s) => s.completed && !s.skipped && s.weight > 0)
          .map((s) => s.weight);
        if (completedWeights.length > 0) {
          // Key by exerciseId (stable, unaffected by KB name relabeling)
          sessionWeights[log.exerciseId] = Math.max(...completedWeights);
        }
      }
      if (Object.keys(sessionWeights).length > 0) {
        updateLastLoggedWeights(sessionWeights);
      }
    }

    const newCount = completedSessions.length + 1;
    const capturedDuration = elapsedSeconds;

    completeSession({
      sessionType,
      date: new Date().toISOString(),
      equipmentTier,
      hadAches: hasAches,
      painRegion,
      ...(painRegions && painRegions.length > 0 ? { painRegions } : {}),
      energy,
      timeAvailable,
      exerciseCount: exercises.length,
      exerciseLogs,
      isTestWeek,
      durationSeconds: capturedDuration,
      displayLabel,
    });

    if (newCount === 5 && !reviewPromptShown) {
      setTimeout(async () => {
        try {
          const available = await StoreReview.isAvailableAsync();
          if (available) {
            setReviewPromptShown(true);
            await StoreReview.requestReview();
          }
        } catch {}
      }, 3000);
    }

    sessionTerminatedRef.current = true;
    clearActiveSession();
    void uploadUserData(useAppStore.getState().getDataForSync());
    if (Platform.OS !== 'web') {
      cancelRestTimerNotification();
      if (useAppStore.getState().nudgeEnabled) void scheduleMissedWorkoutNudge();
      void cancelStreakProtectionAlert();
    }
    router.push('/session-summary');
  };

  const handleExit = () => {
    if (isDemo) {
      setTourComplete(true);
      setSessionTutorialShown(true);
      router.navigate('/(tabs)' as any);
      return;
    }
    const hasProgress =
      exerciseData.some(
        (ed) => ed.sets.some((s) => s.completed || s.weight > 0 || s.reps > 0) || ed.swapCount > 0
      ) || exerciseNotes.some((n) => n.length > 0);
    if (hasProgress) {
      setShowAbandonModal(true);
    } else {
      router.back();
    }
  };

  const handleSaveAndExit = () => {
    if (Platform.OS !== 'web') {
      cancelRestTimerNotification();
      if (useAppStore.getState().nudgeEnabled) void scheduleMissedWorkoutNudge();
      void cancelStreakProtectionAlert();
    }
    const completedSetsCount = exerciseData.reduce(
      (sum, ed) => sum + ed.sets.filter((s) => s.completed).length,
      0
    );
    const totalSets = exerciseData.reduce((sum, ed) => sum + ed.sets.length, 0);
    setActiveSession({
      sessionType,
      equipmentTier,
      hasAches,
      painRegion,
      energy,
      timeAvailable,
      isTestWeek,
      exerciseData,
      exerciseNotes,
      activeIndex,
      savedAt: new Date().toISOString(),
      completedSetsCount,
      totalSets,
      sessionName: getSessionLabel(sessionType),
      displayLabel,
      elapsedSeconds,
      exerciseIds: exercises.map((ex) => ex.id),
      painBannerDismissed,
      ...(sessionType === 'custom' ? { customExercises: customExercisesSnapshot.current } : {}),
      ...(Object.keys(inSessionFeedback).length > 0
        ? {
            inSessionFeedback: Object.fromEntries(
              Object.entries(inSessionFeedback).filter(([, v]) => v != null)
            ) as Record<string, 'easy' | 'hard'>,
          }
        : {}),
    });
    setShowAbandonModal(false);
    router.dismissAll();
    router.replace('/(tabs)');
  };

  const keyboardBehavior = Platform.OS === 'ios' ? 'padding' : 'height';

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top + webTopInset }]}
      behavior={keyboardBehavior}
      keyboardVerticalOffset={insets.top + webTopInset}
    >
      <Animated.View entering={FadeInUp.duration(400)} style={styles.topBar}>
        <Pressable onPress={handleExit} style={styles.closeButton} testID="session-exit">
          <Ionicons name="close" size={24} color={C.text} />
        </Pressable>
        <View style={styles.sessionInfo}>
          <Text style={styles.sessionLabel}>
            {isTestWeek ? 'Strength Test' : (displayLabel ?? getSessionLabel(sessionType))}
          </Text>
          {isTestWeek ? <Text style={styles.sessionSub}>AMRAP @ 90%</Text> : null}
        </View>
        <View style={styles.elapsedTimer}>
          <Ionicons name="time-outline" size={12} color={C.textTertiary} />
          <Text style={styles.elapsedTimerText}>
            {elapsedMM}:{elapsedSS}
          </Text>
        </View>
      </Animated.View>

      <View ref={progressBarRef} style={styles.progressBar}>
        <View style={styles.progressTrack}>
          <Animated.View style={[styles.progressFill, { width: `${progress * 100}%` as any }]} />
        </View>
        <Text style={styles.progressText}>
          {isPrehabOrFlex
            ? 'Complete when ready'
            : `${currentPhaseLabel} · ${completedSetsCount}/${totalSets}`}
        </Text>
      </View>

      {(hasAches || energy !== 'normal' || isTestWeek) && (
        <View style={styles.adaptationBar}>
          {isTestWeek && (
            <View style={[styles.adaptTag, { backgroundColor: C.categoryPrehab }]}>
              <Ionicons name="trophy-outline" size={12} color={C.categoryPrehabText} />
              <Text style={[styles.adaptTagText, { color: C.categoryPrehabText }]}>Test Week</Text>
            </View>
          )}
          {hasAches && painRegion && (
            <View style={[styles.adaptTag, { backgroundColor: C.badgeComfort }]}>
              <Ionicons name="medical-outline" size={12} color={C.badgeComfortText} />
              <Text style={[styles.adaptTagText, { color: C.badgeComfortText }]}>
                {getPainRegionLabel(painRegion)}
              </Text>
            </View>
          )}
          {energy !== 'normal' && !isTestWeek && (
            <View style={[styles.adaptTag, { backgroundColor: C.badgeVolume }]}>
              <Ionicons name="flash-outline" size={12} color={C.badgeVolumeText} />
              <Text style={[styles.adaptTagText, { color: C.badgeVolumeText }]}>
                {energy === 'low' ? 'Reduced volume' : 'Extra volume'}
              </Text>
            </View>
          )}
        </View>
      )}

      <PainAdaptBanner
        hasAches={hasAches}
        painRegion={painRegion}
        comfortCount={comfortCount}
        dismissed={painBannerDismissed}
        onDismiss={() => setPainBannerDismissed(true)}
      />

      <KeyboardAwareScrollViewCompat
        ref={scrollViewRef}
        style={styles.exerciseList}
        contentContainerStyle={[
          styles.exerciseListContent,
          { paddingBottom: insets.bottom + (Platform.OS === 'web' ? 34 : 0) + 16 },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        bottomOffset={24}
      >
        {exercises.map((exercise, index) => {
          const data = exerciseData[index];
          if (!data) return null;
          const displayExercise = getDisplayExercise(exercise, data);
          const exState: ExerciseState =
            index < activeIndex ? 'past' : index === activeIndex ? 'active' : 'future';
          const card = (
            <ExerciseCard
              key={exercise.id + index}
              exercise={displayExercise}
              index={index}
              setData={data}
              onSetChange={isDemo ? () => {} : (si, u) => handleSetChange(index, si, u)}
              onVideoPress={() => openYouTube(displayExercise.name)}
              onSwapPress={
                isDemo ? () => {} : () => setSwapModal({ index, exercise: displayExercise })
              }
              onSkipExercise={isDemo ? () => {} : () => handleSkipExercise(index)}
              onCardioLog={isDemo ? () => {} : (data) => handleCardioLog(index, data)}
              isDumbbellSession={isDumbbellSession}
              exerciseState={exState}
              sessionType={sessionType}
              onCardLayout={(y) => {
                cardYPositions.current[index] = y;
                // On session restore, scroll to the active card once it reports its position.
                // Use >= 0 (not > 0) so card 0 also clears the flag and avoids stale state.
                if (
                  pendingScrollToActiveRef.current &&
                  index === activeIndexRef.current &&
                  y >= 0
                ) {
                  pendingScrollToActiveRef.current = false;
                  if (y > 0) {
                    setTimeout(() => {
                      const yPos = cardYPositions.current[activeIndexRef.current];
                      if (yPos !== undefined && scrollViewRef.current) {
                        scrollViewRef.current.scrollTo({
                          y: Math.max(0, yPos - 80),
                          animated: true,
                        });
                      }
                    }, 150);
                  }
                }
              }}
              previousBest={previousBest[exercise.id]}
              previousSessionWeight={previousSessionWeights[exercise.id]}
              lastSessionHint={previousSessionData[exercise.id]}
              feedbackMultiplier={exerciseFeedbackAtStart.current[exercise.id]?.multiplier}
              weightUnit={weightUnit}
              note={exerciseNotes[index] ?? ''}
              onNoteChange={isDemo ? () => {} : (text) => handleNoteChange(index, text)}
              isLastExercise={index === exercises.length - 1}
              comfortRegionLabel={
                exercise.badge === 'comfort' && hasAches && painRegion
                  ? getPainRegionLabel(painRegion)
                  : undefined
              }
              restTimerTrigger={activeIndex === index ? barTimerTrigger : 0}
              noteVisible={notesVisible[index] ?? false}
              onToggleNote={isDemo ? () => {} : () => toggleNoteVisible(index)}
              showPbFlash={pbFlashIndex === index}
              videoBtnRef={index === 0 ? videoBtnRef : undefined}
              swapBtnRef={index === 0 ? swapBtnRef : undefined}
            />
          );
          // Wrap the first card with a ref so the tutorial can spotlight it.
          if (index === 0) {
            return (
              <View key={exercise.id + index} ref={firstCardRef}>
                {card}
              </View>
            );
          }
          return card;
        })}
      </KeyboardAwareScrollViewCompat>

      {/* Wrap the active bar so the tutorial can spotlight it (steps 1 & 2). */}
      <View ref={sessionBarRef}>
        {(() => {
          const activeEx = exercises[activeIndex];
          const activeData = exerciseData[activeIndex];
          const displayEx =
            activeEx && activeData ? getDisplayExercise(activeEx, activeData) : activeEx;
          const activeSetIdx =
            activeData?.activeSetIndex ?? activeData?.sets.findIndex((s) => !s.completed) ?? 0;
          const clampedSetIdx = Math.min(
            Math.max(activeSetIdx, 0),
            (activeData?.sets.length ?? 1) - 1
          );
          const weightGuidesForBar = displayEx
            ? getWeightGuideKg(displayEx.category, displayEx.sets, displayEx.suggestedLoad)
            : [];
          const isBandEx = displayEx ? isLoadBandOrBodyweight(displayEx.suggestedLoad) : false;
          const isTimeEx = displayEx ? isRepsTimeBased(displayEx.reps, sessionType) : false;
          return (
            <SessionActiveBar
              exercise={displayEx ?? null}
              exerciseIndex={activeIndex}
              setData={activeData ?? null}
              activeSetIndex={clampedSetIdx}
              weightGuidesKg={weightGuidesForBar}
              isBandExercise={isBandEx}
              isTimeExercise={isTimeEx}
              previousBest={previousBest[activeEx?.id ?? '']}
              previousSessionWeight={previousSessionWeights[activeEx?.id ?? '']}
              weightUnit={weightUnit}
              isLastExercise={activeIndex === exercises.length - 1}
              sessionAllDone={allDone}
              isPrehabOrFlex={isPrehabOrFlex}
              isCardioExercise={activeEx?.type === 'cardio'}
              onSetChange={isDemo ? () => {} : handleSetChange}
              onSetCompleted={isDemo ? () => {} : handleBarSetCompleted}
              onNewPb={isDemo ? undefined : handleNewPb}
              onFeedback={isDemo ? () => {} : handleBarFeedback}
              onCompleteSession={handleComplete}
              onGoBack={isDemo ? undefined : handleGoBackExercise}
              bottomInset={insets.bottom + (Platform.OS === 'web' ? 34 : 0)}
              isDemo={isDemo}
              demoForceFeedback={
                isDemo && tutStep !== null && effectiveTutorial[tutStep]?.demoForceFeedback === true
              }
            />
          );
        })()}
      </View>

      {/* Abandon Modal */}
      <Modal
        visible={showAbandonModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowAbandonModal(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setShowAbandonModal(false)}>
          <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
            <View style={[styles.modalIcon, { backgroundColor: C.categoryFinisher }]}>
              <Ionicons name="exit-outline" size={32} color={C.categoryFinisherText} />
            </View>
            <Text style={styles.modalTitle}>Leave Session?</Text>
            <Text style={styles.modalDesc}>
              {"You've logged some sets. What would you like to do?"}
            </Text>
            <Pressable
              onPress={handleSaveAndExit}
              style={[styles.abandonBtn, styles.abandonBtnSave]}
              testID="abandon-save"
            >
              <Ionicons name="save-outline" size={18} color={C.textInverse} />
              <Text style={styles.abandonBtnSaveText}>Save & exit</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                sessionTerminatedRef.current = true;
                clearActiveSession();
                if (Platform.OS !== 'web') {
                  cancelRestTimerNotification();
                  if (useAppStore.getState().nudgeEnabled) void scheduleMissedWorkoutNudge();
                }
                setShowAbandonModal(false);
                router.back();
              }}
              style={[styles.abandonBtn, styles.abandonBtnDiscard]}
              testID="abandon-discard"
            >
              <Ionicons name="trash-outline" size={18} color={C.categoryFinisherText} />
              <Text style={styles.abandonBtnDiscardText}>Discard session</Text>
            </Pressable>
            <Pressable onPress={() => setShowAbandonModal(false)} style={styles.modalClose}>
              <Text style={styles.modalCloseText}>Keep going</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Demo Complete Overlay — shown after the demo session tutorial finishes */}
      <Modal visible={showDemoComplete} transparent animationType="fade" onRequestClose={() => {}}>
        <View
          style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.6)',
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: 24,
          }}
        >
          <Animated.View
            entering={FadeInDown.duration(340)}
            style={{
              width: '100%',
              backgroundColor: C.surface,
              borderRadius: 24,
              borderWidth: 1,
              borderColor: C.border,
              paddingHorizontal: 24,
              paddingVertical: 28,
              alignItems: 'center',
              gap: 12,
              ...shadowStyle('#000', 0.18, 24, 8, 12),
            }}
          >
            <View
              style={{
                width: 80,
                height: 80,
                borderRadius: 40,
                backgroundColor: C.primarySurface,
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 4,
              }}
            >
              <Ionicons name="checkmark-circle" size={52} color={C.primary} />
            </View>
            <Text
              style={{
                fontSize: 24,
                fontFamily: 'Inter_700Bold',
                color: C.text,
                textAlign: 'center',
              }}
            >
              {"You're all set!"}
            </Text>
            <Text
              style={{
                fontSize: 15,
                fontFamily: 'Inter_400Regular',
                color: C.textSecondary,
                lineHeight: 22,
                textAlign: 'center',
              }}
            >
              {
                'Your programme is ready. Sessions rotate automatically — just show up and the app handles the planning.'
              }
            </Text>
            <Pressable
              onPress={() => {
                setShowDemoComplete(false);
                router.navigate('/(tabs)' as any);
              }}
              style={({ pressed }) => ({
                marginTop: 8,
                paddingHorizontal: 28,
                paddingVertical: 14,
                borderRadius: 16,
                alignSelf: 'stretch',
                alignItems: 'center',
                backgroundColor: C.primary,
                opacity: pressed ? 0.85 : 1,
              })}
            >
              <Text style={{ fontSize: 16, fontFamily: 'Inter_700Bold', color: C.textInverse }}>
                Start my first session →
              </Text>
            </Pressable>
          </Animated.View>
        </View>
      </Modal>

      {/* Swap Modal */}
      <Modal
        visible={!!swapModal}
        transparent
        animationType="fade"
        onRequestClose={() => setSwapModal(null)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setSwapModal(null)}>
          <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
            <View style={[styles.modalIcon, { backgroundColor: C.categoryPrehab }]}>
              <Ionicons name="swap-horizontal-outline" size={32} color={C.categoryPrehabText} />
            </View>
            <Text style={styles.modalTitle}>Swap Exercise</Text>
            {swapModal &&
              (() => {
                const swapCount = exerciseData[swapModal.index]?.swapCount ?? 0;
                const origExercise = exercises[swapModal.index];
                const swap2Name = origExercise?.swap2Name;
                const swap2Cue = origExercise?.swap2Cue;
                const swap2Load = origExercise?.swap2Load;

                if (swapCount === 2 || (swapCount === 1 && !swap2Name)) {
                  return (
                    <>
                      <View style={styles.swapFrom}>
                        <Text style={styles.swapFromLabel}>Current exercise</Text>
                        <Text style={styles.swapFromName}>{swapModal.exercise.name}</Text>
                      </View>
                      <Text style={[styles.swapNote, { marginTop: 16, textAlign: 'center' }]}>
                        No further alternatives are available for this exercise. Keep going!
                      </Text>
                    </>
                  );
                }

                if (swapCount === 1 && swap2Name) {
                  return (
                    <>
                      <View style={styles.swapFrom}>
                        <Text style={styles.swapFromLabel}>Replace</Text>
                        <Text style={styles.swapFromName}>{swapModal.exercise.name}</Text>
                      </View>
                      <View style={styles.swapArrow}>
                        <Ionicons name="arrow-down" size={18} color={C.textTertiary} />
                      </View>
                      <View style={styles.swapTo}>
                        <Text style={styles.swapToLabel}>With</Text>
                        <Text style={styles.swapToName}>{swap2Name}</Text>
                        <Text style={styles.swapToCue}>{swap2Cue}</Text>
                        {swap2Load && (
                          <Text style={styles.swapToLoad}>
                            {convertLoadString(swap2Load, weightUnit)}
                          </Text>
                        )}
                      </View>
                      <Text style={styles.swapNote}>A second alternative for this exercise.</Text>
                      <Pressable
                        onPress={() => handleSwapConfirm(swapModal.index)}
                        style={styles.swapConfirmBtn}
                      >
                        <Text style={styles.swapConfirmText}>Swap again</Text>
                      </Pressable>
                    </>
                  );
                }

                return (
                  <>
                    <View style={styles.swapFrom}>
                      <Text style={styles.swapFromLabel}>Replace</Text>
                      <Text style={styles.swapFromName}>{swapModal.exercise.name}</Text>
                    </View>
                    <View style={styles.swapArrow}>
                      <Ionicons name="arrow-down" size={18} color={C.textTertiary} />
                    </View>
                    <View style={styles.swapTo}>
                      <Text style={styles.swapToLabel}>With</Text>
                      <Text style={styles.swapToName}>{swapModal.exercise.swapName}</Text>
                      <Text style={styles.swapToCue}>{swapModal.exercise.swapCue}</Text>
                      {swapModal.exercise.swapLoad && (
                        <Text style={styles.swapToLoad}>
                          {convertLoadString(swapModal.exercise.swapLoad, weightUnit)}
                        </Text>
                      )}
                    </View>
                    <Text style={styles.swapNote}>
                      This alternative targets the same muscles with less demand.
                    </Text>
                    <Pressable
                      onPress={() => handleSwapConfirm(swapModal.index)}
                      style={styles.swapConfirmBtn}
                    >
                      <Text style={styles.swapConfirmText}>Use this exercise instead</Text>
                    </Pressable>
                  </>
                );
              })()}
            <Pressable onPress={() => setSwapModal(null)} style={styles.modalClose}>
              <Text style={styles.modalCloseText}>
                {(exerciseData[swapModal?.index ?? -1]?.swapCount ?? 0) > 0
                  ? 'Close'
                  : 'Keep original'}
              </Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {tutStep !== null && effectiveTutorial[tutStep] != null && (
        <CoachMark
          visible
          title={effectiveTutorial[tutStep].title}
          body={effectiveTutorial[tutStep].body}
          step={tutStep + 1}
          total={effectiveTutorial.length}
          onNext={advanceTut}
          onSkip={skipTut}
          bottomOffset={
            effectiveTutorial[tutStep].arrowDirection === 'down'
              ? (tutBottomOffset ??
                insets.bottom + (Platform.OS === 'web' ? 34 : 0) + 190)
              : insets.bottom +
                (Platform.OS === 'web' ? 34 : 0) +
                (effectiveTutorial[tutStep].bottomOffset ?? 190)
          }
          upArrowScreenX={
            effectiveTutorial[tutStep].arrowDirection === 'down' ? undefined : (tutArrowX ?? undefined)
          }
          downArrowScreenX={
            effectiveTutorial[tutStep].arrowDirection === 'down' ? (tutArrowX ?? undefined) : undefined
          }
          iconName={effectiveTutorial[tutStep].iconName}
          iconLabel={effectiveTutorial[tutStep].iconLabel}
          spotlightRect={tutSpotlight ?? undefined}
        />
      )}
    </KeyboardAvoidingView>
  );
}

function makeStyles(C: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: C.background },
    topBar: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    closeButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
    sessionInfo: { flex: 1, alignItems: 'center' },
    sessionLabel: { fontSize: 16, fontFamily: 'Inter_600SemiBold', color: C.text },
    sessionSub: { fontSize: 12, fontFamily: 'Inter_400Regular', color: C.textSecondary },
    progressBar: { paddingHorizontal: 24, marginBottom: 4 },
    progressTrack: {
      height: 4,
      backgroundColor: C.surfaceTertiary,
      borderRadius: 2,
      overflow: 'hidden',
      marginBottom: 6,
    },
    progressFill: { height: '100%', backgroundColor: C.primaryDark, borderRadius: 2 },
    progressText: {
      fontSize: 12,
      fontFamily: 'Inter_500Medium',
      color: C.textTertiary,
      textAlign: 'center',
    },
    adaptationBar: {
      flexDirection: 'row',
      paddingHorizontal: 24,
      paddingVertical: 8,
      gap: 8,
      justifyContent: 'center',
      flexWrap: 'wrap',
    },
    adaptTag: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 8,
      gap: 4,
    },
    adaptTagText: { fontSize: 12, fontFamily: 'Inter_500Medium' },
    exerciseList: { flex: 1 },
    exerciseListContent: { paddingHorizontal: 16, paddingTop: 8, gap: 10 },
    exerciseCard: {
      backgroundColor: C.surface,
      borderRadius: 14,
      padding: 14,
      borderWidth: 1,
      borderColor: C.borderLight,
    },
    exerciseCardDone: {
      backgroundColor: C.primarySurface,
      borderColor: C.primaryMuted,
      borderLeftWidth: 3,
      borderLeftColor: C.primaryDark,
    },
    exerciseCardLocked: {
      backgroundColor: C.surfaceTertiary,
      borderColor: C.borderLight,
      opacity: 0.65,
    },
    exerciseHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
    checkCircle: {
      width: 22,
      height: 22,
      borderRadius: 11,
      borderWidth: 2,
      borderColor: C.border,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 2,
      flexShrink: 0,
    },
    checkCircleDone: { backgroundColor: C.primary, borderColor: C.primary },
    exerciseInfo: { flex: 1 },
    exerciseNameRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      flexWrap: 'wrap',
      gap: 6,
      marginBottom: 4,
    },
    exerciseName: { fontSize: 15, fontFamily: 'Inter_600SemiBold', color: C.text, flex: 1 },
    exerciseNameDone: { color: C.primaryDark },
    badge: { paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4 },
    badgeText: {
      fontSize: 9,
      fontFamily: 'Inter_600SemiBold',
      textTransform: 'uppercase' as const,
      letterSpacing: 0.5,
    },
    pbFlashBadge: {
      backgroundColor: C.pbFlash,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 6,
    },
    pbFlashBadgeText: {
      fontSize: 11,
      fontFamily: 'Inter_700Bold',
      color: C.pbFlashText,
      letterSpacing: 0.3,
    },
    exerciseMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 },
    categoryPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 7,
      paddingVertical: 3,
      borderRadius: 4,
    },
    categoryDot: { width: 5, height: 5, borderRadius: 3 },
    categoryText: { fontSize: 10, fontFamily: 'Inter_500Medium' },
    metaText: { fontSize: 12, fontFamily: 'Inter_500Medium', color: C.textSecondary },
    loadText: { fontSize: 12, fontFamily: 'Inter_400Regular', color: C.textTertiary },
    kpiHint: {
      fontSize: 11,
      fontFamily: 'Inter_400Regular',
      color: C.textTertiary,
      marginTop: 2,
      marginBottom: 2,
    },
    dumbbellNote: {
      fontSize: 11,
      fontFamily: 'Inter_400Regular',
      color: C.primary,
      marginTop: 2,
      fontStyle: 'italic' as const,
    },
    progressionNoteRow: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      gap: 4,
      marginTop: 3,
    },
    progressionNoteText: {
      fontSize: 11,
      fontFamily: 'Inter_400Regular',
      color: C.primary,
      fontStyle: 'italic' as const,
      flex: 1,
    },
    lastSessionRow: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      gap: 4,
      marginTop: 3,
    },
    lastSessionText: { fontSize: 11, fontFamily: 'Inter_400Regular', color: C.textTertiary },
    volumeCompareRow: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      gap: 6,
      marginBottom: 14,
      paddingHorizontal: 4,
    },
    volumeCompareText: {
      fontSize: 12,
      fontFamily: 'Inter_500Medium',
      color: C.textSecondary,
      flex: 1,
    },
    chevron: { marginTop: 2 },
    actionRow: { flexDirection: 'row', gap: 8, marginTop: 10, paddingLeft: 32 },
    actionBtnYoutube: {
      backgroundColor: C.youtubeSurface,
      borderWidth: 1,
      borderColor: C.youtubeBorder,
    },
    setsContainer: {
      marginTop: 12,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: C.borderLight,
    },
    cueContainer: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginBottom: 6 },
    cueText: {
      fontSize: 13,
      fontFamily: 'Inter_400Regular',
      color: C.primary,
      fontStyle: 'italic' as const,
      flex: 1,
    },
    setHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 8,
      marginBottom: 2,
    },
    setHeaderItem: {
      fontSize: 11,
      fontFamily: 'Inter_500Medium',
      color: C.textTertiary,
      textAlign: 'center',
    },
    setHeaderInputs: { flex: 1, flexDirection: 'row', justifyContent: 'center', gap: 20 },
    setRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 4,
      paddingHorizontal: 8,
    },
    setLabel: { fontSize: 13, fontFamily: 'Inter_500Medium', color: C.textSecondary, width: 36 },
    setInputs: { flex: 1, flexDirection: 'row', justifyContent: 'center', gap: 12 },
    inputGroup: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    setInput: {
      width: 58,
      height: 38,
      borderRadius: 8,
      backgroundColor: C.surfaceTertiary,
      textAlign: 'center',
      fontSize: 14,
      fontFamily: 'Inter_500Medium',
      color: C.text,
      borderWidth: 1,
      borderColor: C.borderLight,
    },
    setInputDisabled: { opacity: 0.45 },
    inputUnit: { fontSize: 11, fontFamily: 'Inter_400Regular', color: C.textTertiary, width: 30 },
    setCheck: {
      width: 44,
      height: 44,
      borderRadius: 22,
      borderWidth: 2.5,
      borderColor: C.border,
      alignItems: 'center',
      justifyContent: 'center',
      marginLeft: 8,
    },
    setCheckDone: { backgroundColor: C.primary, borderColor: C.primary },
    setCheckDisabled: { opacity: 0.3 },
    // Card state styles
    exerciseCardPast: {
      backgroundColor: C.surfaceTertiary,
      borderColor: C.borderLight,
      opacity: 0.8,
    },
    // Locked/future card styles
    lockedHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    lockIconWrap: {
      width: 22,
      height: 22,
      borderRadius: 11,
      borderWidth: 1,
      borderColor: C.border,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    lockedInfo: { flex: 1 },
    lockedName: {
      fontSize: 14,
      fontFamily: 'Inter_500Medium',
      color: C.textSecondary,
      marginBottom: 4,
    },
    lockedMeta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    lockedMetaText: { fontSize: 11, fontFamily: 'Inter_400Regular', color: C.textTertiary },
    // Past (completed) card styles
    pastHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    pastName: {
      fontSize: 14,
      fontFamily: 'Inter_500Medium',
      color: C.textSecondary,
      marginBottom: 4,
    },
    bottomAction: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      paddingHorizontal: 20,
      paddingTop: 12,
      backgroundColor: C.background,
      borderTopWidth: 1,
      borderTopColor: C.borderLight,
    },
    completeButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: C.primary,
      borderRadius: 14,
      paddingVertical: 16,
      gap: 8,
    },
    completeButtonDisabled: { backgroundColor: C.surfaceTertiary },
    completeText: { fontSize: 17, fontFamily: 'Inter_600SemiBold', color: C.textInverse },
    completeTextDisabled: { color: C.textTertiary },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.55)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 24,
    },
    modalContent: {
      backgroundColor: C.surface,
      borderRadius: 20,
      padding: 28,
      alignItems: 'center',
      width: '100%',
      maxWidth: 340,
    },
    modalIcon: {
      width: 64,
      height: 64,
      borderRadius: 16,
      backgroundColor: C.primaryMuted,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 16,
    },
    modalTitle: {
      fontSize: 18,
      fontFamily: 'Inter_700Bold',
      color: C.text,
      textAlign: 'center',
      marginBottom: 8,
    },
    modalDesc: {
      fontSize: 14,
      fontFamily: 'Inter_400Regular',
      color: C.textSecondary,
      textAlign: 'center',
      marginBottom: 20,
    },
    youtubeButton: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#FF0000',
      paddingHorizontal: 24,
      paddingVertical: 12,
      borderRadius: 12,
      gap: 8,
      marginBottom: 12,
      width: '100%',
      justifyContent: 'center',
    },
    youtubeButtonText: { color: '#fff', fontSize: 15, fontFamily: 'Inter_600SemiBold' },
    modalClose: { paddingVertical: 10, paddingHorizontal: 32 },
    modalCloseText: { fontSize: 14, fontFamily: 'Inter_500Medium', color: C.textSecondary },
    swapFrom: {
      width: '100%',
      padding: 12,
      backgroundColor: C.surfaceTertiary,
      borderRadius: 10,
      marginBottom: 4,
    },
    swapFromLabel: {
      fontSize: 11,
      fontFamily: 'Inter_500Medium',
      color: C.textTertiary,
      marginBottom: 2,
    },
    swapFromName: { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: C.text },
    swapArrow: { paddingVertical: 4 },
    swapTo: {
      width: '100%',
      padding: 12,
      backgroundColor: C.primarySurface,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: C.primaryMuted,
      marginBottom: 12,
    },
    swapToLabel: { fontSize: 11, fontFamily: 'Inter_500Medium', color: C.primary, marginBottom: 2 },
    swapToName: {
      fontSize: 14,
      fontFamily: 'Inter_700Bold',
      color: C.primaryDark,
      marginBottom: 4,
    },
    swapToCue: {
      fontSize: 12,
      fontFamily: 'Inter_400Regular',
      color: C.textSecondary,
      fontStyle: 'italic' as const,
      marginBottom: 4,
    },
    swapToLoad: { fontSize: 12, fontFamily: 'Inter_500Medium', color: C.primary },
    swapNote: {
      fontSize: 12,
      fontFamily: 'Inter_400Regular',
      color: C.textTertiary,
      textAlign: 'center',
      marginBottom: 16,
    },
    swapConfirmBtn: {
      width: '100%',
      backgroundColor: C.primary,
      paddingVertical: 13,
      borderRadius: 12,
      alignItems: 'center',
      marginBottom: 4,
    },
    swapConfirmText: { fontSize: 15, fontFamily: 'Inter_600SemiBold', color: C.textInverse },
    congratsModal: { gap: 0 },
    congratsIcon: {
      width: 80,
      height: 80,
      borderRadius: 20,
      backgroundColor: C.trophyBg,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 16,
    },
    congratsTitle: {
      fontSize: 22,
      fontFamily: 'Inter_700Bold',
      color: C.text,
      textAlign: 'center',
      marginBottom: 12,
    },
    congratsMessage: {
      fontSize: 14,
      fontFamily: 'Inter_400Regular',
      color: C.textSecondary,
      textAlign: 'center',
      lineHeight: 22,
      marginBottom: 20,
      paddingHorizontal: 4,
    },
    congratsStats: {
      flexDirection: 'row',
      backgroundColor: C.surfaceTertiary,
      borderRadius: 14,
      padding: 16,
      marginBottom: 20,
      width: '100%',
      alignItems: 'center',
    },
    congratsStat: { flex: 1, alignItems: 'center' },
    congratsStatValue: { fontSize: 22, fontFamily: 'Inter_700Bold', color: C.primary },
    congratsStatLabel: {
      fontSize: 11,
      fontFamily: 'Inter_400Regular',
      color: C.textTertiary,
      marginTop: 2,
    },
    congratsStatDivider: { width: 1, height: 28, backgroundColor: C.border },
    congratsButton: {
      width: '100%',
      flexDirection: 'row',
      backgroundColor: C.primary,
      paddingVertical: 16,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 8,
    },
    congratsButtonMuted: { backgroundColor: C.surfaceTertiary },
    congratsButtonText: { fontSize: 16, fontFamily: 'Inter_600SemiBold', color: C.textInverse },
    congratsSecondaryButton: {
      width: '100%',
      paddingVertical: 14,
      borderRadius: 14,
      alignItems: 'center',
      marginBottom: 4,
    },
    congratsSecondaryButtonText: {
      fontSize: 15,
      fontFamily: 'Inter_600SemiBold',
      color: C.textSecondary,
    },
    feedbackSavedBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingVertical: 8,
      paddingHorizontal: 12,
      backgroundColor: C.primarySurface,
      borderRadius: 10,
      marginBottom: 14,
      width: '100%',
    },
    feedbackSavedText: { fontSize: 13, fontFamily: 'Inter_500Medium', color: C.primary, flex: 1 },
    feedbackButtonRow: {
      flexDirection: 'row',
      gap: 10,
      width: '100%',
      marginTop: 10,
      flexWrap: 'wrap',
    },
    feedbackSecondaryBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 11,
      borderRadius: 12,
      backgroundColor: C.primarySurface,
      borderWidth: 1,
      borderColor: C.primaryMuted,
    },
    feedbackSecondaryText: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: C.primary },
    feedbackSubtitle: {
      fontSize: 13,
      fontFamily: 'Inter_400Regular',
      color: C.textSecondary,
      textAlign: 'center',
      marginBottom: 14,
    },
    feedbackScroll: { width: '100%', maxHeight: 260, marginBottom: 16 },
    ratingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: C.borderLight,
      gap: 8,
    },
    ratingName: { flex: 1, fontSize: 13, fontFamily: 'Inter_500Medium', color: C.text },
    ratingButtons: { flexDirection: 'row', gap: 6 },
    thumbBtn: {
      width: 34,
      height: 34,
      borderRadius: 8,
      borderWidth: 1.5,
      borderColor: C.border,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: C.surfaceTertiary,
    },
    thumbBtnActive: { backgroundColor: C.primary, borderColor: C.primary },
    thumbBtnDown: { borderColor: C.border },
    thumbBtnDownActive: { backgroundColor: C.destructive, borderColor: C.destructive },
    checklistRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 11,
      paddingHorizontal: 4,
      borderBottomWidth: 1,
      borderBottomColor: C.borderLight,
      gap: 10,
    },
    checklistRowSelected: { backgroundColor: C.primarySurface },
    checklistBox: {
      width: 22,
      height: 22,
      borderRadius: 6,
      borderWidth: 1.5,
      borderColor: C.border,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    checklistBoxSelected: { backgroundColor: C.primary, borderColor: C.primary },
    checklistName: { flex: 1, fontSize: 13, fontFamily: 'Inter_500Medium', color: C.text },
    checklistNameSelected: { color: C.primaryDark, fontFamily: 'Inter_600SemiBold' },
    // New Record badge
    newRecordBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      alignSelf: 'flex-start',
      backgroundColor: C.success,
      borderRadius: 10,
      paddingHorizontal: 8,
      paddingVertical: 3,
      marginLeft: 8,
      marginBottom: 2,
    },
    newRecordText: {
      fontSize: 10,
      fontFamily: 'Inter_700Bold',
      color: C.textInverse,
      letterSpacing: 0.3,
    },
    // Milestone congrats styles
    milestoneHeader: { alignItems: 'center', marginBottom: 12 },
    milestoneIconWrap: {
      width: 96,
      height: 96,
      borderRadius: 24,
      backgroundColor: C.trophyBg,
      borderWidth: 2,
      borderColor: C.trophyBorder,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 8,
    },
    milestoneBadgeText: {
      fontSize: 11,
      fontFamily: 'Inter_700Bold',
      color: C.primary,
      letterSpacing: 1.5,
      backgroundColor: C.primaryMuted,
      paddingHorizontal: 12,
      paddingVertical: 4,
      borderRadius: 8,
    },
    congratsTitleMilestone: {
      fontSize: 26,
      fontFamily: 'Inter_700Bold',
      color: C.primaryDark,
      textAlign: 'center',
      marginBottom: 12,
    },
    congratsButtonMilestone: { backgroundColor: C.primaryDark },
    // Streak badge
    streakBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: C.streakBg,
      borderWidth: 1,
      borderColor: C.streakBorder,
      borderRadius: 10,
      paddingHorizontal: 14,
      paddingVertical: 8,
      marginBottom: 14,
      width: '100%',
      justifyContent: 'center',
    },
    streakBadgeIcon: { fontSize: 18 },
    streakBadgeText: { fontSize: 14, fontFamily: 'Inter_700Bold', color: C.streakText },
    // Elapsed timer in top bar
    elapsedTimer: { flexDirection: 'row', alignItems: 'center', gap: 3, width: 52 },
    elapsedTimerText: { fontSize: 12, fontFamily: 'Inter_500Medium', color: C.textTertiary },
    // Rest timer
    restTimerRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
    restTimerBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: 10,
      backgroundColor: C.primarySurface,
      borderWidth: 1.5,
      borderColor: C.primaryMuted,
    },
    restTimerBtnActive: { backgroundColor: C.primary, borderColor: C.primaryDark },
    restTimerResetBtn: {
      width: 40,
      height: 40,
      borderRadius: 10,
      backgroundColor: C.surfaceTertiary,
      borderWidth: 1,
      borderColor: C.borderLight,
      alignItems: 'center',
      justifyContent: 'center',
    },
    restTimerSkipBtn: {
      paddingHorizontal: 12,
      height: 40,
      borderRadius: 10,
      backgroundColor: C.primarySurface,
      borderWidth: 1,
      borderColor: C.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    restTimerSkipText: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: C.primary },
    restTimerAddBtn: {
      paddingHorizontal: 10,
      height: 40,
      borderRadius: 10,
      backgroundColor: C.surfaceTertiary,
      borderWidth: 1,
      borderColor: C.borderLight,
      alignItems: 'center',
      justifyContent: 'center',
    },
    restTimerAddText: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: C.textSecondary },
    restTimerText: { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: C.primary },
    restTimerTextActive: { color: '#fff' },
    restTimerDone: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 10,
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: 10,
      backgroundColor: C.primarySurface,
      borderWidth: 1.5,
      borderColor: C.primary,
      alignSelf: 'flex-start',
    },
    restTimerDoneText: { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: C.primary },
    restTimerPill: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 12,
      backgroundColor: C.primarySurface,
      borderWidth: 1,
      borderColor: C.primaryMuted,
      marginBottom: 10,
      minHeight: 44,
    },
    restTimerPillLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    restTimerPillDigits: {
      fontSize: 20,
      fontFamily: 'Inter_700Bold',
      color: C.text,
    },
    restTimerPillState: {
      fontSize: 12,
      fontFamily: 'Inter_500Medium',
      color: C.textSecondary,
    },
    restTimerPillActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    restTimerIconBtn: {
      width: 32,
      height: 32,
      borderRadius: 8,
      backgroundColor: C.surface,
      borderWidth: 1,
      borderColor: C.borderLight,
      alignItems: 'center',
      justifyContent: 'center',
    },
    restTimerPillSkip: {
      paddingHorizontal: 10,
      height: 32,
      borderRadius: 8,
      backgroundColor: C.primarySurface,
      borderWidth: 1,
      borderColor: C.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    restTimerPillSkipText: { fontSize: 12, fontFamily: 'Inter_600SemiBold', color: C.primary },
    restTimerPillInner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      flex: 1,
      justifyContent: 'center',
    },
    restTimerPillCompleteText: { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: C.primary },
    // Spotter advisory
    spotterAdvisory: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 8 },
    spotterAdvisoryText: {
      fontSize: 11,
      fontFamily: 'Inter_400Regular',
      color: C.textTertiary,
      fontStyle: 'italic',
    },
    // Per-exercise note input
    noteInputRow: { marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: C.borderLight },
    noteInput: {
      height: 36,
      borderRadius: 8,
      backgroundColor: C.surfaceTertiary,
      borderWidth: 1,
      borderColor: C.borderLight,
      paddingHorizontal: 10,
      fontSize: 13,
      fontFamily: 'Inter_400Regular',
      color: C.text,
    },
    // Abandon modal
    abandonBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      width: '100%',
      paddingVertical: 14,
      borderRadius: 12,
      marginBottom: 8,
    },
    abandonBtnSave: { backgroundColor: C.primary },
    abandonBtnSaveText: { fontSize: 15, fontFamily: 'Inter_600SemiBold', color: C.textInverse },
    abandonBtnDiscard: {
      backgroundColor: C.categoryFinisher,
      borderWidth: 1,
      borderColor: C.categoryFinisherText + '55',
    },
    abandonBtnDiscardText: {
      fontSize: 15,
      fontFamily: 'Inter_600SemiBold',
      color: C.categoryFinisherText,
    },
    // Target weight label on KPI lift
    targetWeightLabel: {
      fontSize: 11,
      fontFamily: 'Inter_600SemiBold',
      color: C.primary,
      textTransform: 'uppercase' as const,
      letterSpacing: 0.5,
      marginBottom: 1,
    },
    loadTextMain: { fontSize: 16, fontFamily: 'Inter_700Bold', color: C.primaryDark },
    // Swapped-again action button
    actionBtnSwapped: {
      backgroundColor: C.primarySurface,
      borderWidth: 1,
      borderColor: C.primaryMuted,
    },
    // Test week ORM comparison card in congrats modal
    ormCompareCard: {
      width: '100%',
      backgroundColor: C.primarySurface,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: C.primaryMuted,
      padding: 14,
      marginBottom: 14,
    },
    ormCompareTitle: {
      fontSize: 12,
      fontFamily: 'Inter_600SemiBold',
      color: C.primary,
      textAlign: 'center',
      marginBottom: 12,
      textTransform: 'uppercase' as const,
      letterSpacing: 0.5,
    },
    ormCompareRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around' },
    ormCompareItem: { alignItems: 'center', flex: 1 },
    ormCompareLabel: {
      fontSize: 11,
      fontFamily: 'Inter_400Regular',
      color: C.textTertiary,
      marginBottom: 4,
    },
    ormCompareValue: { fontSize: 20, fontFamily: 'Inter_700Bold', color: C.text },
    ormCompareNew: { color: C.primary, fontSize: 22 },
    ormPbBadge: { marginTop: 10, alignItems: 'center' },
    ormPbBadgeText: { fontSize: 14, fontFamily: 'Inter_700Bold', color: C.primaryDark },
    // Time-based exercise done button
    timeDoneBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 14,
      borderRadius: 12,
      borderWidth: 1.5,
      borderColor: C.primaryMuted,
      backgroundColor: C.primarySurface,
      marginVertical: 8,
    },
    timeDoneBtnDone: { backgroundColor: C.primary, borderColor: C.primary },
    timeDoneBtnText: { fontSize: 15, fontFamily: 'Inter_600SemiBold', color: C.primary },
    timeDoneBtnTextDone: { color: C.textInverse },
    // Zero-block hint below set row
    zeroBlockHint: {
      fontSize: 11,
      fontFamily: 'Inter_400Regular',
      color: C.textTertiary,
      fontStyle: 'italic',
      textAlign: 'center',
      marginTop: 2,
      paddingHorizontal: 8,
    },
    // Skip exercise link
    skipExerciseLink: { alignItems: 'center', paddingVertical: 10 },
    skipExerciseLinkText: {
      fontSize: 12,
      fontFamily: 'Inter_500Medium',
      color: C.textTertiary,
      textDecorationLine: 'underline',
    },
    // Pain adaptation banner
    painAdaptBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      marginHorizontal: 16,
      marginBottom: 6,
      paddingVertical: 10,
      paddingHorizontal: 12,
      backgroundColor: C.warningLight,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: C.warning + '44',
      gap: 10,
    },
    painAdaptBannerLeft: { flex: 1, flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
    painAdaptBannerTitle: {
      fontSize: 13,
      fontFamily: 'Inter_600SemiBold',
      color: C.warning,
      marginBottom: 1,
    },
    painAdaptBannerSub: {
      fontSize: 12,
      fontFamily: 'Inter_400Regular',
      color: C.warning,
      opacity: 0.85,
      lineHeight: 17,
    },
    painAdaptDismiss: { padding: 4, alignItems: 'center', justifyContent: 'center' },
    // Comfort adaptation note on exercise cards
    comfortNote: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      marginTop: 8,
      paddingHorizontal: 4,
      paddingVertical: 5,
      backgroundColor: C.warningLight,
      borderRadius: 7,
      borderWidth: 1,
      borderColor: C.warning + '33',
      marginLeft: 32,
    },
    comfortNoteText: { fontSize: 11, fontFamily: 'Inter_500Medium', color: C.warning, flex: 1 },
    // ── Set-by-set new UI ────────────────────────────────────────────────────
    // Completed set chips strip
    doneChipsScroll: { marginBottom: 12 },
    doneChipsContent: { flexDirection: 'row', gap: 8, paddingVertical: 2 },
    doneChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 20,
      backgroundColor: C.primarySurface,
      borderWidth: 1,
      borderColor: C.primaryMuted,
    },
    doneChipText: { fontSize: 12, fontFamily: 'Inter_500Medium', color: C.primaryDark },
    // Active set block
    activeSetBlock: {
      padding: 14,
      borderRadius: 14,
      borderWidth: 1.5,
      borderColor: C.primaryMuted,
      backgroundColor: C.primarySurface,
      gap: 10,
      marginBottom: 8,
    },
    activeSetLabel: {
      fontSize: 12,
      fontFamily: 'Inter_600SemiBold',
      color: C.primary,
      textTransform: 'uppercase' as const,
      letterSpacing: 0.8,
      textAlign: 'center',
    },
    activeSetInputRow: { flexDirection: 'row', justifyContent: 'center', gap: 20 },
    activeInputGroup: { alignItems: 'center', gap: 4 },
    activeSetInput: {
      width: 96,
      height: 64,
      borderRadius: 12,
      backgroundColor: C.primaryMuted,
      textAlign: 'center',
      fontSize: 28,
      fontFamily: 'Inter_700Bold',
      color: C.text,
      borderWidth: 2,
      borderColor: C.primary,
    },
    activeInputUnit: { fontSize: 12, fontFamily: 'Inter_500Medium', color: C.textTertiary },
    activeSetGuideRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    activeSetGuideText: {
      fontSize: 12,
      fontFamily: 'Inter_400Regular',
      color: C.primary,
      flex: 1,
      fontStyle: 'italic' as const,
    },
    // Complete Set button
    completeSetBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: C.primaryDark,
      borderRadius: 12,
      paddingVertical: 14,
      gap: 8,
    },
    completeSetBtnDisabled: { backgroundColor: C.surfaceTertiary },
    completeSetBtnText: { fontSize: 16, fontFamily: 'Inter_600SemiBold', color: C.primaryDarkText },
    completeSetBtnTextDisabled: { color: C.textTertiary },
    // All sets done row
    allSetsDone: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 10,
      backgroundColor: C.primarySurface,
      borderRadius: 10,
    },
    allSetsDoneText: { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: C.primaryDark },
    // ── Active-in-card indicator (replaces ActiveSetBlock inside card) ─────────
    activeSetInCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingVertical: 8,
      paddingHorizontal: 12,
      backgroundColor: C.primarySurface,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: C.primaryMuted,
      marginBottom: 8,
    },
    activeSetInCardText: {
      fontSize: 12,
      fontFamily: 'Inter_500Medium',
      color: C.primary,
    },
    // ── Icon-only action buttons ────────────────────────────────────────────────
    iconActionBtn: {
      width: 36,
      height: 36,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: C.surfaceTertiary,
    },
    iconActionBtnActive: {
      backgroundColor: C.primarySurface,
      borderWidth: 1,
      borderColor: C.primaryMuted,
    },
    // ── Session Active Bar ───────────────────────────────────────────────────────
    barContainer: {
      borderTopWidth: 1,
      borderTopColor: C.border,
      backgroundColor: C.surface,
      paddingHorizontal: 16,
      paddingTop: 12,
      gap: 10,
    },
    barHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    barExerciseName: {
      fontSize: 15,
      fontFamily: 'Inter_600SemiBold',
      color: C.text,
      flex: 1,
      marginRight: 8,
    },
    barBackBtn: {
      marginRight: 4,
      padding: 2,
    },
    barSetCountRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    barSetLabel: {
      fontSize: 11,
      fontFamily: 'Inter_500Medium',
      color: C.primary,
      textTransform: 'uppercase' as const,
      letterSpacing: 0.5,
    },
    barSetCount: {
      fontSize: 13,
      fontFamily: 'Inter_600SemiBold',
      color: C.textSecondary,
    },
    barInputArea: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: 8,
    },
    barInputBlock: {
      flex: 1,
      alignItems: 'center',
      gap: 3,
    },
    barInputHint: {
      fontSize: 11,
      fontFamily: 'Inter_400Regular',
      color: C.textTertiary,
    },
    barInput: {
      width: '100%',
      height: 56,
      borderRadius: 12,
      backgroundColor: C.surfaceTertiary,
      borderWidth: 2,
      borderColor: C.primary,
      textAlign: 'center',
      fontSize: 26,
      fontFamily: 'Inter_700Bold',
      color: C.text,
    },
    barInputUnit: {
      fontSize: 11,
      fontFamily: 'Inter_400Regular',
      color: C.textTertiary,
    },
    barTimesSign: {
      fontSize: 20,
      fontFamily: 'Inter_400Regular',
      color: C.textTertiary,
      marginBottom: 14,
    },
    barCompleteBtn: {
      width: 56,
      height: 56,
      borderRadius: 12,
      backgroundColor: C.primaryDark,
      alignItems: 'center',
      justifyContent: 'center',
    },
    barCompleteBtnDisabled: {
      backgroundColor: C.surfaceTertiary,
    },
    didItBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 14,
      borderRadius: 12,
      backgroundColor: C.primaryDark,
      marginTop: 8,
    },
    didItBtnDisabled: {
      backgroundColor: C.surfaceTertiary,
    },
    didItBtnText: {
      fontSize: 16,
      fontFamily: 'Inter_600SemiBold',
      color: C.primaryDarkText,
    },
    didItBtnTextDisabled: {
      color: C.textTertiary,
    },
    barMarkDoneBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 14,
      borderRadius: 12,
      backgroundColor: C.primary,
    },
    barMarkDoneText: {
      fontSize: 16,
      fontFamily: 'Inter_600SemiBold',
      color: C.textInverse,
    },
    barCompleteSessionBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
      paddingVertical: 16,
      borderRadius: 14,
      backgroundColor: C.primary,
    },
    barCompleteSessionText: {
      fontSize: 17,
      fontFamily: 'Inter_700Bold',
      color: C.textInverse,
    },
    barFeedbackPrompt: {
      fontSize: 12,
      fontFamily: 'Inter_500Medium',
      color: C.textSecondary,
      textAlign: 'center',
    },
    barFeedbackRow: {
      flexDirection: 'row',
      gap: 8,
    },
    barFeedbackBtn: {
      flex: 1,
      paddingVertical: 10,
      borderRadius: 10,
      backgroundColor: C.primarySurface,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: C.primaryMuted,
    },
    barFeedbackBtnNeutral: {
      backgroundColor: C.surfaceTertiary,
      borderColor: C.border,
    },
    barFeedbackBtnHard: {
      backgroundColor: C.surfaceTertiary,
      borderColor: C.categoryFinisher,
    },
    barFeedbackBtnText: {
      fontSize: 13,
      fontFamily: 'Inter_600SemiBold',
      color: C.primaryDark,
    },
    barZeroHint: {
      fontSize: 11,
      fontFamily: 'Inter_400Regular',
      color: C.textTertiary,
      textAlign: 'center',
      fontStyle: 'italic' as const,
    },
    barCardioHint: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
      gap: 8,
      paddingVertical: 14,
    },
    barCardioHintText: {
      fontSize: 14,
      fontFamily: 'Inter_500Medium',
      color: C.primary,
    },
    cardioInputBlock: {
      marginTop: 8,
      gap: 10,
    },
    cardioInputRow: {
      flexDirection: 'row' as const,
      gap: 8,
    },
    cardioInputField: {
      flex: 1,
      gap: 4,
    },
    cardioInputLabel: {
      fontSize: 11,
      fontFamily: 'Inter_500Medium',
      color: C.textSecondary,
    },
    cardioInputBox: {
      height: 40,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: C.borderLight,
      backgroundColor: C.surfaceTertiary,
      paddingHorizontal: 10,
      fontSize: 14,
      fontFamily: 'Inter_400Regular',
      color: C.text,
      textAlign: 'center' as const,
    },
    cardioLogBtn: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
      gap: 8,
      paddingVertical: 12,
      borderRadius: 10,
      backgroundColor: C.primary,
    },
    cardioLogBtnDisabled: {
      backgroundColor: C.surfaceTertiary,
    },
    cardioLogBtnText: {
      fontSize: 15,
      fontFamily: 'Inter_600SemiBold',
      color: C.textInverse,
    },
    cardioLogBtnTextDisabled: {
      color: C.textTertiary,
    },
    cardioLoggedRow: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      gap: 8,
      paddingVertical: 10,
      paddingHorizontal: 12,
      backgroundColor: C.primarySurface,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: C.primaryMuted,
      marginTop: 8,
    },
    cardioLoggedText: {
      fontSize: 14,
      fontFamily: 'Inter_600SemiBold',
      color: C.primaryDark,
    },
  });
}
