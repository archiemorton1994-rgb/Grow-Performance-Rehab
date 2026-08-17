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
} from 'react-native';
import * as Notifications from 'expo-notifications';
import * as StoreReview from 'expo-store-review';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { GrowIcon } from '@/components/GrowIcon';
import { PlateCalculator } from '@/components/PlateCalculator';
import { isBarbellExercise } from '@/lib/plate-math';
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
import { GlossaryTerm } from '@/components/GlossaryTerm';
import {
  EquipmentTier,
  EnergyLevel,
  PainRegion,
  PainSeverity,
  SessionType,
  TimeAvailable,
  SetLog,
  ExerciseLog,
  ExerciseFeedback,
  FeedbackRating,
  WeightUnit,
  CustomExercise,
  CardioLogData,
  useAppStore,
  STRENGTH_SESSION_TYPES,
  TIER_ORDER,
} from '@/lib/store';
import { uploadUserData } from '@/lib/sync';
import { ACUTE_PROTOCOL_NOTES, PAIN_FREE_RULE } from '@/lib/acute-rehab';
import { videoUrlFor } from '@/lib/exercise-videos';
import {
  scheduleMissedWorkoutNudge,
  cancelRestTimerNotification,
  cancelStreakProtectionAlert,
  REST_TIMER_NOTIF_ID,
} from '@/lib/notifications';
import {
  kgToDisplayUnit,
  displayUnitToKg,
  convertLoadString,
  isHeavierThan,
  snapToLoadable,
} from '@/lib/utils';
import {
  Exercise,
  generateWorkout,
  generate1RMWorkout,
  getSessionLabel,
  getPainRegionLabel,
  getWeightGuideKg,
  expandSetTargets,
  getMainLiftExerciseId,
  workingWeightFromOrm,
  testLoadFromWorkingWeight,
  estimateOrmFromAmrap,
  workingWeightAfterTest,
  skipsMaxTest,
  TEST_EXPECTED_REPS,
  REST_PERIOD_SECONDS,
} from '@/lib/workout-engine';
import {
  feedbackRatingFor,
  nextAnchorKg,
  suggestSetWeight,
  SET_FEEDBACK_LABELS,
  type LoadPlan,
  type SetFeedback,
} from '@/lib/auto-regulation';

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

/**
 * Does this exercise get the continuous countdown rather than a rest timer?
 *
 * The question is what the movement is, not where it sits. Keying on "the first
 * warm-up in the list" held only because the generator always opens with cardio;
 * a custom build that skipped the cardio step handed the clock to a stretch, and
 * `parseRepsToSeconds` fell back to five minutes — a Cossack squat held for five
 * minutes. The custom builder had to force a cardio block in to avoid it.
 *
 * The prescription is the honest signal. Every cardio warm-up in the catalogue
 * asks for a run of minutes, whichever generator picked it, and so does the one
 * the custom builder writes; every mobility drill in the same block is counted
 * in seconds or in reps.
 */
function isTimedCardioWarmup(exercise: Exercise): boolean {
  return exercise.category === 'prep' && /\d+\s*min/.test(exercise.reps);
}

/**
 * Which way the arrow beside a progression note points.
 *
 * A weight that was eased back after time away arrives filed as a hold, because
 * the two directions the engine can express are "up" and "hold" and an upward
 * arrow beside a reduced weight would be worse than a flat one. Flat is still
 * wrong: the note reads "Eased back to 78%" and the icon next to it says nothing
 * moved. Until the direction itself can say "down", the sentence is the only
 * record of the reduction, so it is what the arrow reads.
 *
 * "Starting fresh" is deliberately not included. That note means the old weight
 * has stopped being evidence and the number is an estimate again — which is not
 * the same as a step down, and can land either side of where the user left off.
 */
function progressionIconFor(exercise: Exercise) {
  if (/^Eased back/.test(exercise.progressionNote ?? '')) return 'trending-down-outline' as const;
  return exercise.progressionDirection === 'hold'
    ? ('remove-outline' as const)
    : ('trending-up-outline' as const);
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
          <Ionicons name="checkmark-circle" size={16} color={C.primaryText} />
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
            <Ionicons name="checkmark-circle" size={16} color={C.primaryText} />
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
              <Pressable
                onPress={togglePause}
                style={styles.restTimerIconBtn}
                accessibilityLabel={isRunning ? 'Pause rest timer' : 'Resume rest timer'}
                accessibilityRole="button"
              >
                <Ionicons name={isRunning ? 'pause' : 'play'} size={15} color={C.primaryText} />
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
              <Pressable
                onPress={reset}
                style={styles.restTimerIconBtn}
                accessibilityLabel="Reset rest timer"
                accessibilityRole="button"
              >
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
        <Ionicons name="timer" size={18} color={C.primaryText} />
        <Text style={styles.restTimerText}>
          Rest timer · {mm}:{ss}
        </Text>
      </View>
      <Pressable
        onPress={reset}
        style={styles.restTimerResetBtn}
        accessibilityLabel="Reset timer"
        accessibilityRole="button"
      >
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
          <Ionicons name="checkmark-circle" size={16} color={C.primaryText} />
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
          color={isRunning ? '#fff' : C.primaryText}
        />
        <Text style={[styles.restTimerText, isRunning && styles.restTimerTextActive]}>
          {isRunning ? `Warm-up - ${mm}:${ss}` : `Cardio timer - ${mm}:${ss}`}
        </Text>
      </Pressable>
      <Pressable
        onPress={reset}
        style={styles.restTimerResetBtn}
        accessibilityLabel="Reset timer"
        accessibilityRole="button"
      >
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
  /**
   * The answer to "how did that set feel", carrying the set it refers to and
   * the weight that was on the bar. Both are needed because the answer adjusts
   * the NEXT set's load, and `activeSetIndex` has already advanced by the time
   * the buttons are tapped.
   */
  onFeedback: (exerciseId: string, setIndex: number, f: SetFeedback, loggedKg: number) => void;
  /** One short line explaining why the prefilled weight is what it is, if it
   *  was changed by the previous set's answer. */
  autoNote?: string | null;
  onCompleteSession: () => void;
  /** Returns to the previous exercise to fix a mis-logged set. Omitted (no
   *  button shown) for the first exercise or in the demo tutorial. */
  onGoBack?: () => void;
  bottomInset: number;
  /** In the demo tutorial, keep this bar's layout stable rather than flipping
   *  to the feedback-buttons UI on tap — the tutorial's spotlight is measured
   *  once per step and doesn't re-measure if the bar's own content changes. */
  isDemo?: boolean;
  /**
   * Suppresses the "how did it feel?" prompt.
   *
   * Two cases. A 1RM test set is taken to failure by definition, so there is no
   * "5+ more left" to report and nothing for the answer to adjust — the next
   * session's load comes from the tested max, not from an RPE guess. And a set
   * with no weight on it — held for time, or done at bodyweight or with a band
   * — has no load for the answer to move: this bar draws it without a weight
   * box at all. Asking anyway is how the prompt ended up interrupting
   * diaphragmatic breathing and hip-flexor stretches, where the question has
   * nothing to change and the only way past it is to make a claim about a
   * stretch.
   */
  suppressFeedback?: boolean;
  /** Demo mode only: show the feedback UI unconditionally, driven by which
   *  tutorial step is active rather than by a real tap (the demo doesn't
   *  process taps) — see TutorialStep.demoForceFeedback. */
  demoForceFeedback?: boolean;
}

// Generous ceilings, not realistic targets - just enough to catch a
// fat-fingered entry (e.g. "2225" instead of "225") before it gets logged as
// a permanent PR and skews progression/badges going forward. The heaviest
// raw deadlift ever recorded is ~500kg.
const MAX_PLAUSIBLE_KG = 500;
const MAX_PLAUSIBLE_REPS = 200;

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
  autoNote = null,
  onCompleteSession,
  onGoBack,
  bottomInset,
  isDemo = false,
  suppressFeedback = false,
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
  /**
   * The set the feedback buttons are asking about.
   *
   * Not `activeSetIndex`: completing a set marks it done, which makes the
   * parent recompute activeSetIndex as "first uncompleted set" — so by the time
   * this prompt renders it is already pointing at the NEXT set. The old prompt
   * read `activeSetIndex + 1` and therefore announced the wrong set number on
   * every set but the last (where the clamp happened to hide it). It also
   * carries the weight, which the auto-regulation needs to adjust from.
   */
  /**
   * Which set the open prompt is asking about, captured when it was raised.
   *
   * Completing the last set of an exercise advances the session, so by the time
   * the user taps an answer the bar is already showing the NEXT exercise. Read
   * live, that saved every working-set rating against the wrong exercise — and
   * the working set is the one that decides the load, so it has to be the id
   * from the moment the set was logged, not the id on screen when it is
   * answered.
   */
  const [showFeedback, setShowFeedback] = useState<{
    exerciseId: string;
    setIndex: number;
    kg: number;
  } | null>(null);

  const prevKeyRef = useRef(`${exerciseIndex}-${activeSetIndex}`);
  /**
   * The last number the app put in the weight box itself.
   *
   * The prefill has to be able to move without the set moving. Completing a set
   * advances the index first and asks how it felt second, so the answer — and
   * the lighter weight "Challenging" or "Too Hard" earns — lands while the key
   * below is unchanged; keying the refresh on the set alone left the guide and
   * the auto-regulation note updating while the box the user actually submits
   * still held the weight they had just called too heavy. Comparing against
   * this is what lets a new recommendation replace a prefill nobody has touched
   * without overwriting a weight the user deliberately typed.
   */
  const autoFilledRef = useRef(weightText);
  const prevRecommendedRef = useRef(recommendedKg);
  useEffect(() => {
    const prefill = (value: string) => {
      autoFilledRef.current = value;
      setWeightText(value);
    };
    const key = `${exerciseIndex}-${activeSetIndex}`;
    if (prevKeyRef.current !== key) {
      prevKeyRef.current = key;
      prevRecommendedRef.current = recommendedKg;
      prefill(computeInitialWeight());
      const r = setData?.sets[activeSetIndex]?.reps ?? 0;
      setRepsText(r > 0 ? String(r) : parseTargetRepsForPrefill(exercise?.reps ?? ''));
      return;
    }
    if (prevRecommendedRef.current !== recommendedKg) {
      prevRecommendedRef.current = recommendedKg;
      if (weightText === autoFilledRef.current) prefill(computeInitialWeight());
    }
  }, [
    exerciseIndex,
    activeSetIndex,
    recommendedKg,
    weightText,
    computeInitialWeight,
    setData,
    exercise,
  ]);

  const currentSet = setData?.sets[activeSetIndex];
  const totalSets = setData?.sets.length ?? 1;

  const parsedWeight = Math.max(0, parseFloat(weightText) || 0);
  const parsedReps = parseInt(repsText) || 0;
  const effectiveWeightKg = displayUnitToKg(parsedWeight, weightUnit);

  /**
   * Rehab loads are a starting point, not a floor.
   *
   * "Light dumbbell 1-2 kg" on a wrist extension assumes an elbow that can hold
   * 1 kg, and the movement is worth doing unweighted by someone whose elbow
   * cannot — but the bar demanded a weight, so the only way through was to
   * enter one they had not lifted. Zero is the honest answer here and the log
   * should be able to say so. Deliberately not opened up to the loaded lifts:
   * on those, 0 kg is a typo far more often than it is a set, and nothing on
   * this bar can tell the two apart.
   */
  const allowsZeroWeight = exercise?.category === 'prehab';

  const isZeroBlocked =
    !isTimeExercise &&
    (isBandExercise || allowsZeroWeight
      ? parsedReps === 0
      : effectiveWeightKg === 0 || parsedReps === 0);
  const isImplausible =
    !isTimeExercise && (effectiveWeightKg > MAX_PLAUSIBLE_KG || parsedReps > MAX_PLAUSIBLE_REPS);
  const isCompleteBlocked = isZeroBlocked || isImplausible;

  // Judged in the unit on screen, not in the kilograms behind it. Converting
  // 100 kg out to 220.5 lbs and back lands on 100.02 kg, so a straight kg
  // comparison fired "New Record!" for submitting the number the app itself
  // prefilled — i.e. every single time it held a weight. See isHeavierThan.
  const isNewRecord =
    !isBandExercise &&
    !isTimeExercise &&
    previousBest !== undefined &&
    previousBest > 0 &&
    parsedWeight > 0 &&
    isHeavierThan(effectiveWeightKg, previousBest, weightUnit);

  // Named to match the per-set guide printed on the card above, which calls the
  // penultimate set of a long ramp an "Approach set" at ~87.5% of the working
  // weight. Calling that a warm-up was the third of three accounts the same
  // exercise gave of itself on one screen.
  const setLabel =
    exercise?.category === 'main'
      ? activeSetIndex >= totalSets - 1
        ? 'Working set'
        : totalSets >= 4 && activeSetIndex === totalSets - 2
          ? 'Approach set'
          : 'Warm-up'
      : null;

  const handleComplete = () => {
    if (isCompleteBlocked || !currentSet || !exercise) return;
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
    if (!isDemo && !suppressFeedback) {
      // Deliberately no auto-dismiss. This prompt replaces the logging bar, so
      // it stays put until one of the three buttons is tapped. The old 3s timer
      // meant a slower reader lost the chance to answer, and every set that
      // goes unrated is a load adjustment the engine never gets to make.
      setShowFeedback({
        exerciseId: exercise.id,
        setIndex: activeSetIndex,
        kg: effectiveWeightKg,
      });
    }
  };

  const handleFeedback = (f: SetFeedback) => {
    if (showFeedback) {
      onFeedback(showFeedback.exerciseId, showFeedback.setIndex, f, showFeedback.kg);
    }
    setShowFeedback(null);
  };

  if (isCardioExercise) {
    return (
      <View style={[styles.barContainer, { paddingBottom: bottomInset + 12 }]}>
        <View style={styles.barCardioHint}>
          <Ionicons name="timer-outline" size={20} color={C.primaryText} />
          <Text style={styles.barCardioHintText}>Log your cardio in the card above ↑</Text>
        </View>
      </View>
    );
  }

  // An open prompt outranks the finish button: the last set of the session is
  // still a set, and it is usually the heaviest one. Falling straight through to
  // "Complete Session" threw its rating away, so the exercise the user just
  // finished was the one the engine learned nothing about.
  if (sessionAllDone && !showFeedback) {
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

  // The prompt is about a set that is already logged, so it needs nothing from
  // the exercise now under the cursor — and on the session's last set there is
  // no next set for these guards to find.
  if (!showFeedback && (!exercise || !currentSet || activeSetIndex >= totalSets)) return null;

  if (showFeedback || demoForceFeedback) {
    const loggedSetNumber = (showFeedback?.setIndex ?? activeSetIndex) + 1;
    return (
      <View style={[styles.barContainer, { paddingBottom: bottomInset + 12 }]}>
        <Text style={styles.barFeedbackPrompt}>Set {loggedSetNumber} logged · how did it feel?</Text>
        {/* Three answers, because the answer now has a job: it sets the weight
            offered for the next set. "5+ reps left" and "2-3 reps left" are the
            same instruction to the app (go up) asked two different ways, and
            neither is a question you can answer while out of breath. Effort,
            not rep-counting.

            One row, easiest to hardest, so the buttons read as one scale.
            C.error on the last one rather than categoryFinisherText — that
            token is white in light mode because it is designed to sit on a
            solid red fill, and on this pale button it rendered at 1.06:1. */}
        <View style={styles.barFeedbackRow}>
          <Pressable
            onPress={() => handleFeedback('easy')}
            style={styles.barFeedbackBtn}
            testID="feedback-easy"
          >
            <GrowIcon name="effort1" size={17} color={C.primaryDark} />
            <Text style={styles.barFeedbackBtnText}>{SET_FEEDBACK_LABELS.easy}</Text>
          </Pressable>
          <Pressable
            onPress={() => handleFeedback('challenging')}
            style={[styles.barFeedbackBtn, styles.barFeedbackBtnNeutral]}
            testID="feedback-challenging"
          >
            <GrowIcon name="effort3" size={17} color={C.text} />
            <Text style={[styles.barFeedbackBtnText, { color: C.text }]}>
              {SET_FEEDBACK_LABELS.challenging}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => handleFeedback('too_hard')}
            style={[styles.barFeedbackBtn, styles.barFeedbackBtnHard]}
            testID="feedback-too-hard"
          >
            <GrowIcon name="effort4" size={17} color={C.error} />
            <Text style={[styles.barFeedbackBtnText, { color: C.error }]}>
              {SET_FEEDBACK_LABELS.too_hard}
            </Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // Past the prompt, the bar is back to logging a live set and needs a real one.
  if (!exercise || !currentSet || activeSetIndex >= totalSets) return null;

  return (
    <View style={[styles.barContainer, { paddingBottom: bottomInset + 8 }]}>
      <View style={styles.barHeader}>
        {exerciseIndex > 0 && onGoBack && (
          <Pressable
            onPress={onGoBack}
            hitSlop={10}
            style={styles.barBackBtn}
            testID="session-bar-back"
            accessibilityLabel="Previous exercise"
            accessibilityRole="button"
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
            disabled={isCompleteBlocked}
            style={[styles.barCompleteBtn, isCompleteBlocked && styles.barCompleteBtnDisabled]}
            testID={`set-${activeSetIndex + 1}-check`}
            accessibilityLabel="Complete set"
            accessibilityRole="button"
          >
            <Ionicons
              name="checkmark-circle"
              size={26}
              color={isCompleteBlocked ? C.textTertiary : C.primaryDarkText}
            />
          </Pressable>
        </View>
      )}

      {/* Why this number changed. Shown only when the previous set's answer
          moved it, so it never becomes wallpaper the user stops reading. */}
      {!isTimeExercise && !isBandExercise && autoNote && (
        <Text style={styles.barAutoNote} testID="auto-regulation-note">
          {autoNote}
        </Text>
      )}

      {!isTimeExercise && (isZeroBlocked || isImplausible) && (
        <Text style={styles.barZeroHint}>
          {isImplausible
            ? `Double check that ${effectiveWeightKg > MAX_PLAUSIBLE_KG ? 'weight' : 'rep count'} - looks like a typo`
            : isBandExercise || allowsZeroWeight
              ? 'Enter reps to complete'
              : 'Enter weight and reps to complete'}
        </Text>
      )}

      {!isTimeExercise && (
        <Pressable
          onPress={handleComplete}
          disabled={isCompleteBlocked}
          style={[styles.didItBtn, isCompleteBlocked && styles.didItBtnDisabled]}
          testID={`did-it-${activeSetIndex + 1}`}
        >
          <Ionicons
            name="checkmark-circle"
            size={20}
            color={isCompleteBlocked ? C.textTertiary : C.primaryDarkText}
          />
          <Text style={[styles.didItBtnText, isCompleteBlocked && styles.didItBtnTextDisabled]}>
            Did It
          </Text>
        </Pressable>
      )}
    </View>
  );
}

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
        <Ionicons name="checkmark-circle" size={18} color={C.primaryText} />
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
  onEditSet,
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
  headerRef,
  swapBtnRef,
  previousNote,
  onOpenPlates,
}: {
  exercise: Exercise;
  index: number;
  setData: ExerciseSetData;
  onSetChange: (setIndex: number, updated: SetLog) => void;
  /** Reopen an already-logged set so its weight/reps can be corrected. */
  onEditSet?: (setIndex: number) => void;
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
  /** Only passed for the first card. headerRef wraps the name-through-icon-row
   *  header so the in-session tutorial can spotlight just that region; swapBtnRef
   *  gives the "swap" step a tight spotlight on just that one icon. */
  headerRef?: React.RefObject<View | null>;
  swapBtnRef?: React.RefObject<View | null>;
  /** The last note the user wrote about this exercise, from any past
   *  session. Shown once, above the card, until they write a new one. */
  previousNote?: string | null;
  onOpenPlates?: () => void;
}) {
  const C = useColors();
  const styles = useMemo(() => makeStyles(C), [C]);
  const [expanded, setExpanded] = useState(true);
  const effectiveTimerTrigger = restTimerTrigger ?? 0;
  const allDone = setData.sets.every((s) => s.completed);
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
    // Every other row here pairs a dark tinted fill with a bright ink token.
    // This one used `primary`, which is the fill green — dim ink on a dim fill,
    // 1.90:1 in dark mode, on the first four cards of every session.
    prep: { bg: C.primaryMuted, text: C.primaryText, label: 'Warm-Up' },
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
  // Exercise-db rep strings aren't uniformly formatted. Some are bare counts
  // ("10", "10-12") that need " reps" appended for clarity; most of the rest
  // already name their own unit or object and read as nonsense with it —
  // "10 deep breaths reps", "40m reps", "25 pulses reps", "20 total reps".
  // Asking "does it already say reps or each?" caught two of those spellings
  // and let 226 others through, so the question is asked the other way round:
  // append only to a string that is nothing but a number or a range.
  const repsIsBareCount = /^[\d\s.,\-–—+x×/]+$/.test(repsLabel.trim());
  const repDisplay = isTimeExercise || !repsIsBareCount ? repsLabel : `${repsLabel} reps`;

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
              <View ref={headerRef} collapsable={false}>
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
                        <Ionicons name="trophy" size={11} color={C.pbFlashText} />
                        <Text style={styles.pbFlashBadgeText}>New PB</Text>
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
                      <Ionicons
                        name={progressionIconFor(exercise)}
                        size={11}
                        color={C.primaryText}
                      />
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
                  onPress={onVideoPress}
                  style={styles.iconActionBtn}
                  testID={`video-${index}`}
                  accessibilityLabel="Watch exercise video"
                  accessibilityRole="button"
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
                    accessibilityLabel="Swap exercise"
                    accessibilityRole="button"
                  >
                    <Ionicons
                      name="swap-horizontal-outline"
                      size={18}
                      color={setData.swapCount > 0 ? C.primaryText : C.textSecondary}
                    />
                  </Pressable>
                )}
                <Pressable
                  onPress={onToggleNote}
                  style={[styles.iconActionBtn, noteVisible && styles.iconActionBtnActive]}
                  testID={`note-toggle-${index}`}
                  accessibilityLabel={noteVisible ? 'Hide note' : 'Add note'}
                  accessibilityRole="button"
                >
                  <Ionicons
                    name={noteVisible ? 'pencil' : 'pencil-outline'}
                    size={17}
                    color={noteVisible ? C.primaryText : C.textSecondary}
                  />
                </Pressable>
              </View>
              </View>

              {/* The injury screen's own line wins where it exists: it names
                  the exercise that was taken out, which the generic "adapted
                  for your knee" cannot. Both end with the same escape hatch,
                  because a rule applied to 447 exercises will sometimes be
                  wrong about one of them, and the user is in the room. */}
              {/* WHAT YOU WROTE LAST TIME.
                  Notes were being saved on every session and read back by
                  nothing — "belt on for the top set", "left knee twinges past
                  90" was recorded once and then only visible by scrolling
                  through history. It belongs at the top of the exercise it is
                  about, on the day you are about to do it again. */}
              {previousNote && !note && (
                <View style={styles.recalledNote}>
                  <Ionicons name="bookmark" size={12} color={C.primaryText} />
                  <Text style={styles.recalledNoteText} numberOfLines={3}>
                    {previousNote}
                  </Text>
                </View>
              )}

              {/* Offered only on barbell lifts, because it only means
                  anything there. A "plates" button on a cable fly is noise. */}
              {onOpenPlates && isBarbellExercise(exercise.name) && (
                <Pressable
                  onPress={onOpenPlates}
                  style={({ pressed }) => [styles.plateBtn, pressed && { opacity: 0.75 }]}
                  testID={`plate-calc-${index}`}
                  accessibilityLabel="Plate breakdown"
                >
                  <Ionicons name="barbell-outline" size={13} color={C.primaryText} />
                  <Text style={styles.plateBtnText}>What plates?</Text>
                </Pressable>
              )}

              {exercise.safetyNote ? (
                <View style={styles.comfortNote}>
                  <Ionicons name="shield-checkmark-outline" size={13} color={C.warning} />
                  <Text style={styles.comfortNoteText} testID={`safety-note-${index}`}>
                    {exercise.safetyNote}. Tap Swap to put it back.
                  </Text>
                </View>
              ) : (
                exercise.badge === 'comfort' &&
                comfortRegionLabel && (
                  <View style={styles.comfortNote}>
                    <Ionicons name="heart-circle-outline" size={13} color={C.warning} />
                    <Text style={styles.comfortNoteText}>
                      Adapted for {comfortRegionLabel}, tap Swap or skip if still uncomfortable
                    </Text>
                  </View>
                )
              )}

              {expanded && (
                <View style={styles.setsContainer}>
                  <View style={styles.cueContainer}>
                    <Ionicons name="bulb-outline" size={14} color={C.primaryText} />
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

                  {exercise.type !== 'cardio' && isTimedCardioWarmup(exercise) && (
                    <CardioWarmupTimer repsStr={exercise.reps} />
                  )}

                  {exercise.type !== 'cardio' && !isTimedCardioWarmup(exercise) && (
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
                      // Keep each set's real index: the chips are tappable to reopen a set for
                      // correction, and the filter above means chip order is not a safe proxy.
                      const completedSets = setData.sets
                        .slice(0, activeSetIndex)
                        .map((s, realIndex) => ({ set: s, realIndex }))
                        .filter(({ set }) => set.completed);
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
                              {completedSets.map(({ set: s, realIndex }, i) => {
                                let chipLabel = '';
                                if (isTimeExercise) {
                                  chipLabel = 'done';
                                } else if (isBandExercise) {
                                  chipLabel = `${s.reps} reps`;
                                } else {
                                  const w = kgToDisplayUnit(s.weight, weightUnit);
                                  chipLabel = `${w}${weightUnit} × ${s.reps}`;
                                }
                                // Tap to reopen for correction. A mistyped weight used to be
                                // permanent — it set a false PB and drove every later load
                                // suggestion, with no way back once the set was logged.
                                return (
                                  <Pressable
                                    key={realIndex}
                                    onPress={() => onEditSet?.(realIndex)}
                                    disabled={!onEditSet}
                                    style={({ pressed }) => [
                                      styles.doneChip,
                                      pressed && { opacity: 0.7 },
                                    ]}
                                    testID={`edit-logged-set-${realIndex + 1}`}
                                    accessibilityRole="button"
                                    accessibilityLabel={`Edit set ${i + 1}, ${chipLabel}`}
                                  >
                                    <Text style={styles.doneChipText}>
                                      S{i + 1} · {chipLabel}
                                    </Text>
                                    <Ionicons
                                      name={onEditSet ? 'pencil' : 'checkmark'}
                                      size={10}
                                      color={C.primaryText}
                                    />
                                  </Pressable>
                                );
                              })}
                            </ScrollView>
                          )}

                          {/* Active set indicator – inputs live in SessionActiveBar */}
                          {!allDone &&
                            activeSetIndex >= 0 &&
                            activeSetIndex < setData.sets.length && (
                              <View style={styles.activeSetInCard}>
                                <Ionicons name="barbell-outline" size={14} color={C.primaryText} />
                                <Text style={styles.activeSetInCardText}>
                                  Set {activeSetIndex + 1} of {setData.sets.length} · log below ↓
                                </Text>
                              </View>
                            )}

                          {/* All sets done indicator */}
                          {allDone && (
                            <View style={styles.allSetsDone}>
                              <Ionicons name="checkmark-circle" size={18} color={C.primaryText} />
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
            {/* THE INSTRUCTION COMES FIRST, and it names the area.
                This used to end on "skip anything that hurts" — true, and far
                too mild for what it is. A session built around a sore area has
                one rule that matters: if a movement hurts THAT area, stop, do
                not push through it. Asked for in those words: "if any exercise
                causes pain to the specified area then to stop immediately and
                skip". Naming the region matters too — the user picked it on a
                body map two screens ago and this is the only place it is
                confirmed back to them during the session. */}
            {`If anything hurts your ${getPainRegionLabel(painRegion).toLowerCase()}, stop that exercise straight away and tap Skip. ` +
              (comfortCount > 0
                ? `${comfortCount} ${comfortCount === 1 ? 'exercise was' : 'exercises were'} already swapped for comfort.`
                : 'Nothing needed swapping, so take it as it comes.')}
          </Text>
        </View>
      </View>
      <Pressable
        onPress={onDismiss}
        style={{ padding: 4, alignItems: 'center', justifyContent: 'center' }}
        testID="pain-banner-dismiss"
        accessibilityLabel="Dismiss"
        accessibilityRole="button"
      >
        <Ionicons name="close" size={16} color={C.warning} />
      </Pressable>
    </Animated.View>
  );
}

/**
 * Shown on a test week that deliberately does not run the all-out set.
 *
 * Not dismissible and not silent on purpose: the block counter still moves on,
 * so without this the session would simply look like a test week that forgot
 * to be one. See `skipsMaxTest`.
 */
export function NoMaxTestBanner({ visible }: { visible: boolean }) {
  const C = useColors();
  if (!visible) return null;
  return (
    <Animated.View
      entering={FadeInDown.duration(350)}
      testID="no-max-test-banner"
      style={{
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginHorizontal: 16,
        marginBottom: 6,
        paddingVertical: 10,
        paddingHorizontal: 12,
        backgroundColor: C.warningLight,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: C.warning + '44',
        gap: 8,
      }}
    >
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
          No max test this block
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
          A fair strength test has to be heavy, and you have told us you are rehabbing. This is your
          normal session instead — your weights keep climbing as they have been. Drop rehab from your
          goals in Profile if you want the test back.
        </Text>
      </View>
    </Animated.View>
  );
}

/**
 * The pain rule, on the sessions built for a sore area.
 *
 * WHY IT CANNOT BE DISMISSED
 * ──────────────────────────
 * Every other banner in this file reports something the app has already decided:
 * volume was cut, an exercise was swapped, no test this block. This one is
 * different in kind — it is an instruction, and it is the only thing setting the
 * dose. The acute protocols prescribe effort as a fraction ("about a third of
 * your effort") precisely because the correct load in the first days after a
 * strain is whatever does not hurt. Without the number that defines "does not
 * hurt", the prescriptions underneath are incomplete.
 *
 * So there is no dismiss control, and no persisted "seen it" flag: it is part of
 * the protocol, not a notification about it.
 */
export function PainFreeRangeBanner({ text }: { text: string | null }) {
  const C = useColors();
  if (!text) return null;
  return (
    <Animated.View
      entering={FadeInDown.duration(350)}
      testID="pain-free-range-banner"
      accessibilityRole="alert"
      style={{
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginHorizontal: 16,
        marginBottom: 6,
        paddingVertical: 10,
        paddingHorizontal: 12,
        backgroundColor: C.warningLight,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: C.warning + '44',
        gap: 8,
      }}
    >
      <Ionicons name="medkit-outline" size={16} color={C.warning} />
      <View style={{ flex: 1 }}>
        <Text
          style={{
            fontSize: 13,
            fontFamily: 'Inter_600SemiBold',
            color: C.warning,
            marginBottom: 1,
          }}
        >
          Keep it pain-free
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
          {text}
        </Text>
      </View>
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
  spotlightRef: 'firstCardHeader' | 'sessionBar' | 'progressBar';
  /** Which specific measured sub-element within the spotlight this step is
   *  really about (e.g. a specific icon button). Only meaningful together with
   *  tightSpotlight. */
  spotlightTarget?: 'swap';
  /** When true (requires spotlightTarget), the spotlight cutout tightly hugs
   *  the spotlightTarget element itself instead of the whole spotlightRef
   *  region — use when the step is only about one icon, not the card in general. */
  tightSpotlight?: true;
  /** If true, this step is skipped for session types that don't use weight logging (prehab, flexibility). */
  requiresWeightLogging?: true;
  /** Demo mode only: force the session bar into its post-set feedback UI
   *  (Too Easy / OK / Hard) for the duration of this step, regardless of
   *  whether the user actually tapped the demo's log-set button — the demo
   *  doesn't process real taps, so without this the step would narrate a
   *  UI that never actually appears. */
  demoForceFeedback?: true;
}

const SESSION_TUTORIAL: readonly TutorialStep[] = [
  {
    spotlightRef: 'firstCardHeader',
    iconName: 'barbell-outline',
    iconLabel: 'Exercise',
    title: 'Your first exercise',
    body: "Tap 'Watch form' for a video demo before you start. Work through exercises in order, the app builds them to flow.",
  },
  {
    spotlightRef: 'sessionBar',
    requiresWeightLogging: true,
    iconName: 'create-outline',
    iconLabel: 'Log sets',
    title: 'Log every set',
    body: 'Type the weight and reps, then tap the green button to save the set. The app remembers your weights and auto-suggests next time.',
  },
  {
    spotlightRef: 'sessionBar',
    requiresWeightLogging: true,
    iconName: 'happy-outline',
    iconLabel: 'Feedback',
    title: 'Tell us how it felt',
    // Says what the answer is FOR. The tour used to describe only the
    // in-session effect, so the single biggest thing these taps do — set the
    // weight you are given next week — went unexplained, and an answer whose
    // consequence you cannot see is one people stop giving.
    body: 'After each set, tap Easy, Challenging or Too Hard. It changes your next set straight away, and it sets the weight you start with next time — bigger jumps when you say Easy, no jump at all after Too Hard.',
    demoForceFeedback: true,
  },
  {
    spotlightRef: 'firstCardHeader',
    spotlightTarget: 'swap',
    tightSpotlight: true,
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
    painSeverity?: string;
    /** 'true' when painRegion is hurting today rather than just being the focus. */
    acute?: string;
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
  /**
   * Whether the named region is hurting NOW.
   *
   * Two callers, two answers. The readiness screen sets it because reporting
   * pain there IS saying it hurts today. The Restore tab asks, because naming a
   * region there is just how you choose what to work on — someone six weeks into
   * knee rehab is picking "knee" and is not injured today.
   *
   * Defaults to TRUE when a region is named and nothing said otherwise. The two
   * ways to be wrong are not equal: giving gentle work to someone who could have
   * handled more costs them a session, and giving a stretch to a fresh tear
   * costs them weeks.
   */
  const isAcute = params.acute ? params.acute === 'true' : !!params.painRegion;
  const VALID_PAIN_SEVERITY: PainSeverity[] = ['mild', 'moderate', 'severe'];
  const painSeverity = VALID_PAIN_SEVERITY.includes(params.painSeverity as PainSeverity)
    ? (params.painSeverity as PainSeverity)
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
    exerciseStuckStreak,
    lastSessionPerformance,
    pendingCustomExercises,
    clearPendingCustomExercises,
    sessionTutorialShown,
    setSessionTutorialShown,
    setTourComplete,
    setTourJustCompleted,
    markTourGenuinelyCompleted,
    getLastExerciseNote,
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
  const equipmentTier: EquipmentTier = TIER_ORDER.includes(params.equipment as EquipmentTier)
    ? (params.equipment as EquipmentTier)
    : getEffectiveTier();

  const isDumbbellSession = equipmentTier === 'dumbbells' || equipmentTier === 'kettlebells';

  /**
   * Does this test week actually run the all-out set?
   *
   * `isTestWeek` stays true either way — it is what records the session and
   * moves the block counter on, and a rehab user's blocks should still turn
   * over. This is the narrower question of whether the max-effort set happens;
   * see `skipsMaxTest`.
   */
  const runsMaxTest = isTestWeek && !skipsMaxTest(userProfile);

  // Capture exerciseFeedback at session start so mid-session store updates don't re-generate exercises
  const exerciseFeedbackAtStart = useRef<Record<string, ExerciseFeedback>>(exerciseFeedback);
  /**
   * The unit this session's weights were worked out in, frozen at the start.
   *
   * The prescription is rounded onto the grid the user's gym can load, so the
   * engine has to be told which gym. Read live it would be a dependency of the
   * exercise list, and regenerating that list mid-session resets every logged
   * set — so it is captured once, exactly like the feedback above. Changing
   * units mid-session then converts what is already on screen and moves nothing;
   * the new grid takes effect from the next session.
   */
  const loadUnitAtStart = useRef<WeightUnit>(weightUnit);
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

  /**
   * What this lift is currently being trained at — the number a test week both
   * builds its load from and is judged against.
   *
   * The most recent working weight wins, and the one implied by their best-ever
   * 1RM is only a fallback for a lift with no history. It used to take the
   * larger of the two, on the reasoning that a too-light bar inflates the Epley
   * estimate. That reasoning belonged to the old maths, where the test load was
   * a fraction of the WORKING weight and being under-loaded was easy; the load
   * now comes off the estimated max, and the cap in
   * `applyTestResultToWorkingWeight` closes the inflation door from the other
   * side. Keeping best-ever in the maximum did real harm: someone who genuinely
   * lost strength — illness, a long layoff — would be handed a bar set from a
   * personal best they no longer own, which is both a failed test and a lift
   * they should not be under.
   */
  const testWeekBaselineKg = useMemo(() => {
    if (!isTestWeek) return 0;
    const mainLiftId = getMainLiftExerciseId(sessionType, equipmentTier);
    const lastKg = mainLiftId ? (lastLoggedWeights?.[mainLiftId] ?? 0) : 0;
    if (lastKg > 0) return lastKg;
    const bestForLift = getBestORM(sessionType);
    return bestForLift
      ? workingWeightFromOrm(bestForLift.weight, userProfile, loadUnitAtStart.current)
      : 0;
  }, [
    isTestWeek,
    sessionType,
    equipmentTier,
    lastLoggedWeights,
    getBestORM,
    userProfile,
  ]);

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
    if (runsMaxTest) {
      // Real numbers on the ramp-up and the test set, instead of "Ramp up" and
      // "~90% of working weight". The load is a fixed share of the max implied
      // by what they train at, so the reps needed to hold station are the same
      // for every goal - see TEST_LOAD_FRACTION_OF_ORM.
      const testKg =
        testWeekBaselineKg > 0
          ? testLoadFromWorkingWeight(testWeekBaselineKg, userProfile, loadUnitAtStart.current)
          : 0;
      return generate1RMWorkout(
        sessionType,
        equipmentTier,
        strengthCount,
        testKg > 0 ? testKg : undefined,
        loadUnitAtStart.current
      );
    }
    const bestOrm = getBestORM(sessionType);
    const bestOrmKg = bestOrm ? bestOrm.weight : undefined;
    return generateWorkout(
      sessionType,
      equipmentTier,
      {
        hasAches,
        painRegion: painRegions && painRegions.length > 0 ? painRegions : painRegion,
        painSeverity,
        acute: isAcute,
        energy,
        timeAvailable,
      },
      userProfile,
      exerciseFeedbackAtStart.current,
      bestOrmKg,
      strengthCount,
      lastLoggedWeights,
      exerciseNormalStreak,
      lastSessionPerformance,
      undefined,
      loadUnitAtStart.current,
      exerciseStuckStreak
    );
  }, [
    sessionType,
    equipmentTier,
    hasAches,
    painRegion,
    painSeverity,
    energy,
    timeAvailable,
    runsMaxTest,
    testWeekBaselineKg,
    userProfile,
    getBestORM,
    strengthCount,
    lastLoggedWeights,
    exerciseNormalStreak,
    exerciseStuckStreak,
    lastSessionPerformance,
  ]);

  const [exerciseData, setExerciseData] = useState<ExerciseSetData[]>([]);

  /**
   * Every set answer given this session, per exercise, indexed by set.
   *
   * Held here rather than in the bar because the bar unmounts nothing but
   * re-derives everything from props, and because two things need this: the
   * weight offered for the next set, and the aggregate rating that shapes the
   * next session. Deliberately not persisted — it is scratch working for the
   * current exercise, and what survives the session is the aggregate in
   * `inSessionFeedback` plus the weights actually logged.
   */
  const [setAnswers, setSetAnswers] = useState<Record<string, (SetFeedback | null)[]>>({});
  // Mirror, so the feedback handler can read the answers it is about to add to
  // without nesting one state updater inside another.
  const setAnswersRef = useRef(setAnswers);
  useEffect(() => {
    setAnswersRef.current = setAnswers;
  }, [setAnswers]);

  const comfortCount = useMemo(
    () =>
      exercises.filter((ex, i) => ex.badge === 'comfort' && (exerciseData[i]?.swapCount ?? 0) === 0)
        .length,
    [exercises, exerciseData]
  );
  /**
   * The pain rule to show, or null if this session is not one that needs it.
   *
   * Decided by looking at the exercises the session actually contains, not by
   * re-deriving the condition the engine used to choose them. Those are two
   * different things, and only one of them can be wrong: if the engine ever
   * serves acute rehab down a path nobody thought of, the instruction that makes
   * it safe still arrives with it.
   *
   * The wording is the region's own where a single region is known, because
   * "stop if the leg feels worse the next morning" is more use than a generic
   * sentence. PAIN_FREE_RULE covers the multi-region case, where no one
   * protocol's advice is the right one to print.
   */
  const painFreeText = useMemo(() => {
    const hasAcuteWork = exercises.some((ex) => ex.id?.startsWith('acute-'));
    if (!hasAcuteWork) return null;
    if (painRegions?.length === 1 && ACUTE_PROTOCOL_NOTES[painRegions[0]]) {
      return ACUTE_PROTOCOL_NOTES[painRegions[0]].disclaimer;
    }
    return PAIN_FREE_RULE;
  }, [exercises, painRegions]);

  const [exerciseNotes, setExerciseNotes] = useState<string[]>([]);
  const [cardioLogs, setCardioLogs] = useState<(CardioLogData | null)[]>([]);
  const [showAbandonModal, setShowAbandonModal] = useState(false);
  const [showDemoComplete, setShowDemoComplete] = useState(false);
  const [painBannerDismissed, setPainBannerDismissed] = useState(false);
  const [barTimerTrigger, setBarTimerTrigger] = useState(0);
  const [notesVisible, setNotesVisible] = useState<boolean[]>([]);
  const [inSessionFeedback, setInSessionFeedback] = useState<
    Record<string, FeedbackRating | null>
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
  // Name-through-icon-row header of the first exercise card, spotlighted on
  // its own (not the whole card) for the "Your first exercise" step so the
  // tip/rest-timer content further down stays visible instead of getting
  // boxed in too.
  const firstCardHeaderRef = useRef<View>(null);
  // Only needed to give the "swap" step a tight spotlight on just that icon.
  const swapBtnRef = useRef<View>(null);
  const [tutSpotlight, setTutSpotlight] = useState<SpotlightRect | null>(null);

  // Measure the spotlighted element whenever the tutorial step changes.
  // Clear the spotlight immediately on step change to avoid showing a stale rect
  // from the previous step while the new measurement is pending (fast-tap safety).
  useEffect(() => {
    setTutSpotlight(null);
    if (tutStep === null) return;
    const refLookup = {
      firstCardHeader: firstCardHeaderRef,
      sessionBar: sessionBarRef,
      progressBar: progressBarRef,
    };
    const step = effectiveTutorial[tutStep];
    const tightTarget =
      step?.tightSpotlight && step.spotlightTarget === 'swap' ? swapBtnRef : null;
    const target = tightTarget ?? (step ? refLookup[step.spotlightRef] : null);
    const pad = tightTarget ? 8 : 4;
    const timer = setTimeout(() => {
      target?.current?.measureInWindow((x, y, w, h) => {
        if (w > 0 && h > 0) {
          setTutSpotlight({ top: y - pad, left: x - pad, width: w + pad * 2, height: h + pad * 2 });
        }
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

  const handleBarFeedback = useCallback(
    (exerciseId: string, setIndex: number, f: SetFeedback, _loggedKg: number) => {
      setSetAnswers((prev) => {
        const answers = [...(prev[exerciseId] ?? [])];
        answers[setIndex] = f;
        return { ...prev, [exerciseId]: answers };
      });
      // The aggregate that shapes NEXT session is derived from the whole run of
      // answers, not from the latest tap — see feedbackRatingFor. "Challenging"
      // maps to nothing, so it must be able to CLEAR a rating an earlier answer
      // set, otherwise one Easy on set 1 would outlive being corrected.
      setInSessionFeedback((prev) => {
        const answers = [...(setAnswersRef.current[exerciseId] ?? [])];
        answers[setIndex] = f;
        // Passed with its gaps intact: which set an answer belongs to is what
        // decides whether it counts, and squeezing the unanswered sets out
        // would shift every later answer onto the wrong one.
        const rated = exercises.find((ex) => ex.id === exerciseId);
        const rating = feedbackRatingFor(answers, {
          isRamped: rated?.category === 'main',
          sets: rated?.sets ?? answers.length,
        });
        const next = { ...prev };
        if (rating) next[exerciseId] = rating;
        else delete next[exerciseId];
        return next;
      });
      if (Platform.OS !== 'web') Haptics.selectionAsync();
    },
    [exercises]
  );

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
    const restoredNotes =
      stored.exerciseNotes.length === exs.length ? stored.exerciseNotes : exs.map(() => '');
    setExerciseNotes(restoredNotes);
    // A note that survived the reload but came back collapsed reads as a note
    // that was lost: nothing on the card says it is there. Reopen the ones that
    // have something in them.
    setNotesVisible(restoredNotes.map((n) => n.length > 0));
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

  /**
   * Open the demo for an exercise.
   *
   * Opens the exact @GrowPerformanceRehabilitation video for this movement when
   * there is one, and falls back to a YouTube search on the exercise name when
   * there is not. Which videos exist is data, in lib/exercise-videos.ts — adding
   * one is a single line in that file, with no code change and no release.
   *
   * The fallback is deliberate rather than a stopgap. Footage is being recorded
   * a few movements at a time and the catalogue is several hundred deep, so most
   * exercises will have no video of their own for a long while. A search at
   * least shows the movement; a dead button shows nothing and reads as broken.
   *
   * A grip variant inherits its base's video deliberately. That was one of the
   * conditions a variant had to pass to be accepted at all (see
   * lib/grip-variants.ts) — the base footage has to show the movement well
   * enough that only the cue needs to change.
   */
  const openExerciseVideo = (exercise: {
    name: string;
    videoId?: string;
    youtubeUrl?: string;
  }) => {
    const url = videoUrlFor(exercise);
    if (url) {
      Linking.openURL(url);
      return;
    }
    const query = encodeURIComponent(exercise.name + ' exercise proper form tutorial');
    Linking.openURL('https://www.youtube.com/results?search_query=' + query);
  };
  const [swapModal, setSwapModal] = useState<{ index: number; exercise: Exercise } | null>(null);
  /** The exercise whose plate breakdown is open. Holds the index so the
   *  weight shown follows that card's own current set. */
  const [plateModalIndex, setPlateModalIndex] = useState<number | null>(null);
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

  /**
   * Reopen an already-logged set for correction.
   *
   * Marking it uncompleted is all that is needed: handleSetChange derives
   * activeSetIndex as "first uncompleted set", so the logging bar rewinds to
   * this set and repopulates from its stored weight/reps. The user edits and
   * re-logs it exactly as they did the first time.
   *
   * Nothing is double-counted — the set is overwritten in place, and totals are
   * computed from the sets array at completion rather than accumulated per tap.
   */
  const handleEditSet = useCallback((exerciseIndex: number, setIndex: number) => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setExerciseData((prev) => {
      const next = [...prev];
      const ex = { ...next[exerciseIndex], sets: [...next[exerciseIndex].sets] };
      const target = ex.sets[setIndex];
      if (!target) return prev;
      ex.sets[setIndex] = { ...target, completed: false };
      ex.activeSetIndex = setIndex;
      next[exerciseIndex] = ex;
      return next;
    });
  }, []);

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
      // Only the sets NOT already done. This used to zero every set on the
      // exercise, so someone who benched two sets and then felt a shoulder
      // twinge lost both: the summary showed zero reps and zero volume, the
      // lift never reached the progress chart, and next session's suggestion
      // did not move because the app had no record of any work.
      //
      // The in-session safety banner tells the user to do exactly this —
      // "stop that exercise straight away and tap Skip" — so the button the
      // clinical advice points at must not destroy the work already logged.
      // The allSkipped guard in lib/store.ts keeps the nothing-was-logged case
      // recorded as skipped rather than failed.
      const skippedSets = ex.sets.map((s) =>
        s.completed ? s : { ...s, weight: 0, reps: 0, completed: true, skipped: true }
      );
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
    // A swap is a different movement with its own load, so the structured
    // weights computed for the original no longer describe it. Dropping
    // loadKg falls the guide back to reading the swap's own load text —
    // which is the only thing that has ever described a swap.
    if (swapCount === 1 && exercise.swapName) {
      return {
        ...exercise,
        name: exercise.swapName,
        cue: exercise.swapCue ?? exercise.cue,
        suggestedLoad: exercise.swapLoad ?? exercise.suggestedLoad,
        loadKg: exercise.swapLoad ? undefined : exercise.loadKg,
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
        loadKg: exercise.swap2Load ? undefined : exercise.loadKg,
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

    // Set when a test week completes with a usable AMRAP result, so the
    // sessionWeights block below can also re-baseline the real KPI-lift
    // exercise ID - not just the test protocol's own (different) ID - with
    // this fresh number. Without this, a new 1RM never reaches
    // lastLoggedWeights for the exercise a normal session actually reads
    // from, so it stops influencing suggested weight after the very first
    // time that lift is ever suggested.
    let testWeekWorkingWeight: number | undefined;
    if (runsMaxTest) {
      const mainExIndex = exercises.findIndex((e) => e.category === 'main');
      if (mainExIndex >= 0) {
        const mainSets = exerciseData[mainExIndex].sets;
        const amrapSet = mainSets.find((s) => s.completed && s.weight > 0 && s.reps > 0);
        if (amrapSet) {
          const estimatedMax = Math.round(estimateOrmFromAmrap(amrapSet.weight, amrapSet.reps));
          addOneRepMax({
            lift: sessionType,
            weight: estimatedMax,
            reps: amrapSet.reps,
            date: new Date().toISOString(),
            unit: 'kg',
          });
          // What the test says, then what a single test is allowed to do about
          // it. One session is evidence about a block, not a verdict on it -
          // see MAX_TEST_WEIGHT_MOVE and TEST_DEADBAND.
          testWeekWorkingWeight = workingWeightAfterTest(
            testWeekBaselineKg,
            estimatedMax,
            userProfile,
            loadUnitAtStart.current
          );
        }
      }
    }

    // Rehab and mobility sessions record what was done, same as anything else.
    //
    // These used to save with an empty list. The reasoning was presumably that
    // there is no weight to record — but the consequence was that weeks of
    // rehab produced a session count and a date and NOTHING else: no exercise
    // history, no muscle map, no progress, and a summary screen that said
    // "Recovery sessions don't load exercises, so there's nothing to compare
    // here". For anyone training that way, which is a lot of people, the app
    // simply had no memory of what they did.
    //
    // Nothing downstream needs the sets to be weighted. Volume already filters
    // on `weight > 0`, so unweighted work contributes zero volume without being
    // erased, and the muscle map and exercise history key off the exercise, not
    // the load.
    const exerciseLogs: ExerciseLog[] = exercises.map((ex, i) => {
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
    //
    // Rehab and mobility are deliberately still excluded here, even though they
    // now record their exercises above. Recording what someone did is not the
    // same as automatically adding load to it every session — rehab work is
    // prescribed at a load for a reason, and creeping it upward on a timer is
    // the wrong default. History yes, progressive overload no.
    if (!isPrehabOrFlex && exerciseLogs.length > 0) {
      const sessionWeights: Record<string, number> = {};
      for (const log of exerciseLogs) {
        const completedWeights = log.sets
          .filter((s) => s.completed && !s.skipped && s.weight > 0)
          .map((s) => s.weight);
        if (completedWeights.length > 0) {
          // Key by exerciseId (stable, unaffected by KB name relabeling).
          // Filing the heaviest set outright treated "the most you lifted" as
          // "the most you can lift", which is a feedback loop: a light session
          // prescribes a lighter one, and that one is lighter still. See
          // nextAnchorKg — a session can raise this number freely, and only
          // lower it when the user actually said a set was too much.
          sessionWeights[log.exerciseId] = nextAnchorKg(
            Math.max(...completedWeights),
            lastLoggedWeights?.[log.exerciseId] ?? 0,
            log.feedbackRating
          );
        }
      }
      // Also re-baseline the real (non-test-protocol) KPI-lift exercise ID
      // when this was a test week, so the fresh 1RM actually feeds into the
      // next normal session's suggestion instead of being ignored.
      if (testWeekWorkingWeight !== undefined) {
        const mainLiftId = getMainLiftExerciseId(sessionType, equipmentTier);
        if (mainLiftId) sessionWeights[mainLiftId] = testWeekWorkingWeight;
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
      ...(painSeverity ? { painSeverity } : {}),
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
            ) as Record<string, FeedbackRating>,
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
        <Pressable
          onPress={handleExit}
          style={styles.closeButton}
          testID="session-exit"
          accessibilityLabel="Exit session"
          accessibilityRole="button"
        >
          <Ionicons name="close" size={24} color={C.text} />
        </Pressable>
        <View style={styles.sessionInfo}>
          <Text style={styles.sessionLabel}>
            {runsMaxTest ? 'Strength Test' : (displayLabel ?? getSessionLabel(sessionType))}
          </Text>
          {runsMaxTest ? (
            <GlossaryTerm
              term="Max reps test"
              definition={`Warm up, then do one all-out set: as many clean reps as you can manage at the weight shown. Around ${TEST_EXPECTED_REPS} reps keeps your training weight exactly where it is, so there is nothing to chase. Your one-rep max is worked out from that weight and how many reps you got.`}
              textStyle={styles.sessionSub}
            />
          ) : isTestWeek ? (
            <Text style={styles.sessionSub}>No max test on a rehab goal</Text>
          ) : null}
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
              <Ionicons
                name={runsMaxTest ? 'trophy-outline' : 'shield-checkmark-outline'}
                size={12}
                color={C.categoryPrehabText}
              />
              <Text style={[styles.adaptTagText, { color: C.categoryPrehabText }]}>
                {runsMaxTest ? 'Test Week' : 'Test Week · normal session'}
              </Text>
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
          {energy !== 'normal' && !runsMaxTest && (
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

      <NoMaxTestBanner visible={isTestWeek && !runsMaxTest} />

      <PainFreeRangeBanner text={painFreeText} />

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
              onEditSet={isDemo ? undefined : (si) => handleEditSet(index, si)}
              onVideoPress={() => openExerciseVideo(displayExercise)}
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
              headerRef={index === 0 ? firstCardHeaderRef : undefined}
              swapBtnRef={index === 0 ? swapBtnRef : undefined}
              previousNote={isDemo ? null : getLastExerciseNote(exercise.id, exercise.name)}
              onOpenPlates={isDemo ? undefined : () => setPlateModalIndex(index)}
            />
          );
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
          const plannedForBar = !displayEx
            ? []
            : displayEx.loadKg
              ? expandSetTargets(
                  displayEx.category,
                  displayEx.sets,
                  displayEx.loadKg,
                  loadUnitAtStart.current
                )
              : getWeightGuideKg(
                  displayEx.category,
                  displayEx.sets,
                  displayEx.suggestedLoad,
                  loadUnitAtStart.current
                );

          // Auto-regulation. The prescription above is where the exercise
          // STARTS; what the user has actually lifted and said about it decides
          // where it goes from there. Outcomes stop at the first set that isn't
          // finished, so an exercise reopened for correction regulates from
          // real history rather than from gaps.
          let autoNoteForBar: string | null = null;
          let weightGuidesForBar = plannedForBar;
          if (displayEx && activeData) {
            const answers = setAnswers[displayEx.id] ?? [];
            const outcomes: LoadPlan['outcomes'] = [];
            for (const [i, s] of activeData.sets.entries()) {
              if (!s.completed) break;
              outcomes.push({ loggedKg: s.weight, feedback: answers[i] ?? null });
            }
            // Only the KPI/main lift arrives with a ramp to climb; everything
            // else is a flat target that moves ±10% off what was just lifted.
            const plan: LoadPlan = {
              isRamped: displayEx.category === 'main',
              plannedKg: plannedForBar,
              outcomes,
            };
            const regulated = plannedForBar.map((_, i) => suggestSetWeight(plan, i));
            // Auto-regulation works in kilogram increments (see loadStepKg): a
            // 10% move off 145 lbs comes back as 93.7 lbs, which is not a
            // weight. Put it back on the gym's grid without undoing the move
            // the user's answer just earned. No-op in kilograms.
            weightGuidesForBar = regulated.map((r, i) =>
              snapToLoadable(r.kg, outcomes[i - 1]?.loggedKg ?? 0, loadUnitAtStart.current)
            );
            autoNoteForBar = regulated[clampedSetIdx]?.note ?? null;
          }
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
              autoNote={autoNoteForBar}
              onCompleteSession={handleComplete}
              onGoBack={isDemo ? undefined : handleGoBackExercise}
              suppressFeedback={runsMaxTest || isTimeEx || isBandEx}
              bottomInset={insets.bottom + (Platform.OS === 'web' ? 34 : 0)}
              isDemo={isDemo}
              demoForceFeedback={
                isDemo && tutStep !== null && effectiveTutorial[tutStep]?.demoForceFeedback === true
              }
            />
          );
        })()}
      </View>

      {/* Plate breakdown. Weight comes from the card's own current set, so
          it answers "what do I load RIGHT NOW" rather than showing the top
          set while you are still warming up. */}
      {plateModalIndex !== null &&
        (() => {
          const ex = exercises[plateModalIndex];
          const data = exerciseData[plateModalIndex];
          if (!ex || !data) return null;
          const setIdx = Math.min(
            Math.max(data.activeSetIndex ?? 0, 0),
            Math.max(0, data.sets.length - 1)
          );
          const guides = ex.loadKg
            ? expandSetTargets(ex.category, ex.sets, ex.loadKg, loadUnitAtStart.current)
            : getWeightGuideKg(ex.category, ex.sets, ex.suggestedLoad, loadUnitAtStart.current);
          const logged = data.sets[setIdx]?.weight ?? 0;
          const kg = logged > 0 ? logged : (guides[setIdx] ?? 0);
          return (
            <PlateCalculator
              visible
              onClose={() => setPlateModalIndex(null)}
              targetKg={kg}
              weightUnit={weightUnit}
              exerciseName={ex.name}
            />
          );
        })()}

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
              <Ionicons name="checkmark-circle" size={52} color={C.primaryText} />
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
                "Your programme is ready. Sessions rotate automatically, just show up and the app handles the planning."
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
            insets.bottom +
            (Platform.OS === 'web' ? 34 : 0) +
            (effectiveTutorial[tutStep].bottomOffset ?? 190)
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
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
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
      color: C.primaryText,
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
      color: C.primaryText,
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
      color: C.primaryText,
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
    swapToLabel: { fontSize: 11, fontFamily: 'Inter_500Medium', color: C.primaryText, marginBottom: 2 },
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
    swapToLoad: { fontSize: 12, fontFamily: 'Inter_500Medium', color: C.primaryText },
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
    congratsStatValue: { fontSize: 22, fontFamily: 'Inter_700Bold', color: C.primaryText },
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
    feedbackSavedText: { fontSize: 13, fontFamily: 'Inter_500Medium', color: C.primaryText, flex: 1 },
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
    feedbackSecondaryText: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: C.primaryText },
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
      color: C.primaryText,
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
    restTimerSkipText: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: C.primaryText },
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
    restTimerText: { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: C.primaryText },
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
    restTimerDoneText: { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: C.primaryText },
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
    restTimerPillSkipText: { fontSize: 12, fontFamily: 'Inter_600SemiBold', color: C.primaryText },
    restTimerPillInner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      flex: 1,
      justifyContent: 'center',
    },
    restTimerPillCompleteText: { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: C.primaryText },
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
      color: C.primaryText,
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
      color: C.primaryText,
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
    ormCompareNew: { color: C.primaryText, fontSize: 22 },
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
    timeDoneBtnText: { fontSize: 15, fontFamily: 'Inter_600SemiBold', color: C.primaryText },
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
    recalledNote: {
      flexDirection: 'row',
      gap: 7,
      alignItems: 'flex-start',
      backgroundColor: C.primarySurface,
      borderRadius: 10,
      paddingHorizontal: 10,
      paddingVertical: 8,
      marginTop: 8,
    },
    recalledNoteText: {
      flex: 1,
      fontSize: 12,
      fontFamily: 'Inter_500Medium',
      color: C.primaryDark,
      lineHeight: 16,
    },
    plateBtn: {
      flexDirection: 'row',
      alignSelf: 'flex-start',
      alignItems: 'center',
      gap: 5,
      marginTop: 8,
      paddingHorizontal: 9,
      paddingVertical: 5,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: C.primaryMuted,
      backgroundColor: C.primarySurface,
    },
    plateBtnText: { fontSize: 11.5, fontFamily: 'Inter_600SemiBold', color: C.primaryText },
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
      color: C.primaryText,
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
      color: C.primaryText,
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
      color: C.primaryText,
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
      color: C.primaryText,
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
    // Icon above label rather than beside it. Three buttons share the width now
    // where two used to, and "Challenging" alongside a 17px icon does not fit
    // in a third of a phone's width without wrapping.
    barFeedbackBtn: {
      flex: 1,
      gap: 4,
      paddingVertical: 10,
      borderRadius: 12,
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
      fontSize: 12,
      fontFamily: 'Inter_600SemiBold',
      color: C.primaryDark,
    },
    barAutoNote: {
      fontSize: 11,
      fontFamily: 'Inter_500Medium',
      color: C.textSecondary,
      textAlign: 'center',
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
      color: C.primaryText,
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
