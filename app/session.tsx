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
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown, FadeInUp, FadeIn, useSharedValue, useAnimatedStyle, withSpring, withTiming, interpolateColor } from 'react-native-reanimated';
import Colors, { useColors } from '@/constants/colors';
import { EquipmentTier, EnergyLevel, PainRegion, SessionType, TimeAvailable, SetLog, ExerciseLog, ExerciseFeedback, WeightUnit, useAppStore } from '@/lib/store';
import { formatWeight, kgToDisplayUnit, displayUnitToKg } from '@/lib/utils';
import {
  Exercise,
  generateWorkout,
  generate1RMWorkout,
  getSessionLabel,
  getSessionSubtitle,
  getPainRegionLabel,
  getRestPeriod,
  getWeightGuide,
} from '@/lib/workout-engine';

const MILESTONE_SESSIONS = [1, 5, 10, 25, 50, 100, 150, 200];
const MILESTONE_STREAKS = [3, 7, 14, 30];

function getMilestoneMessage(count: number): string {
  if (count === 1) return "Your first session — the hardest step is done!";
  if (count === 5) return "5 sessions down — you're building real momentum!";
  if (count === 10) return "10 sessions! Double digits — you're making this a habit.";
  if (count === 25) return "That's your 25th session — you're building a habit!";
  if (count === 50) return "50 sessions! You're halfway to triple digits. Incredible.";
  if (count === 100) return "100 sessions! You've reached an elite level of consistency.";
  if (count === 150) return "150 sessions — that's genuinely extraordinary dedication.";
  if (count === 200) return "200 sessions! You are the definition of commitment.";
  return `Session ${count} — keep going!`;
}


const CONGRATS_MESSAGES = [
  "Absolutely smashed it! Every rep, every set — you showed up and delivered.",
  "That's what dedication looks like. Be proud of what you just achieved!",
  "Another session in the books. Your future self is thanking you right now.",
  "You did the work when it would have been easier not to. That's the difference maker.",
  "Champion effort today. Progress doesn't happen by accident — it's built session by session.",
  "Brilliant work! Consistency like this is what transforms bodies and builds strength.",
  "One step closer to your goals. Every session counts — and you just added another.",
];

interface ExerciseSetData {
  sets: SetLog[];
  swapped: boolean;
}

function isLoadBandOrBodyweight(suggestedLoad: string): boolean {
  const lower = suggestedLoad.toLowerCase();
  return (
    lower.startsWith('bodyweight') ||
    lower.includes('band') ||
    lower === 'low intensity'
  );
}

function isRepsTimeBased(repsStr: string, sessionType?: SessionType): boolean {
  if (sessionType === 'conditioning') return true;
  return /\bmin\b/.test(repsStr) || /\d+s\b/.test(repsStr);
}

const REST_TIMER_DURATIONS: Partial<Record<Exercise['category'], number>> = {
  main: 120, neuro: 60, accessory: 60, mechanical: 45,
};

function RestTimer({ category, trigger = 0 }: { category: Exercise['category']; trigger?: number }) {
  const C = useColors();
  const styles = useMemo(() => makeStyles(C), [C]);
  const duration = REST_TIMER_DURATIONS[category] ?? 0;
  const [secondsLeft, setSecondsLeft] = useState(duration);
  const [isRunning, setIsRunning] = useState(false);
  const [isDone, setIsDone] = useState(false);
  const pulseScale = useSharedValue(1);
  const pulseStyle = useAnimatedStyle(() => ({ transform: [{ scale: pulseScale.value }] }));

  // Auto-start when trigger increments (i.e. a set was just completed)
  useEffect(() => {
    if (trigger > 0 && duration > 0) {
      setSecondsLeft(duration);
      setIsDone(false);
      setIsRunning(true);
      if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
  }, [trigger]);

  useEffect(() => {
    if (!duration || !isRunning) return;
    if (secondsLeft <= 0) {
      setIsRunning(false);
      setIsDone(true);
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      pulseScale.value = withTiming(1.12, { duration: 180 }, () => {
        pulseScale.value = withTiming(1, { duration: 180 });
      });
      return;
    }
    const timerId = setInterval(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearInterval(timerId);
  }, [duration, isRunning, secondsLeft]);

  if (!duration) return null;

  const reset = () => { setSecondsLeft(duration); setIsRunning(false); setIsDone(false); };
  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, '0');
  const ss = String(secondsLeft % 60).padStart(2, '0');

  if (isDone) {
    return (
      <Animated.View style={pulseStyle}>
        <Pressable onPress={reset} style={styles.restTimerDone}>
          <Ionicons name="checkmark-circle" size={16} color={C.primary} />
          <Text style={styles.restTimerDoneText}>Rest complete — tap to reset</Text>
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
          name={isRunning ? 'pause-circle' : 'timer'}
          size={18}
          color={isRunning ? '#fff' : C.primary}
        />
        <Text style={[styles.restTimerText, isRunning && styles.restTimerTextActive]}>
          {isRunning ? `Resting — ${mm}:${ss}` : `Rest timer — ${mm}:${ss}`}
        </Text>
      </Pressable>
      <Pressable onPress={reset} style={styles.restTimerResetBtn}>
        <Ionicons name="refresh-outline" size={16} color={C.textSecondary} />
      </Pressable>
    </View>
  );
}

function CardioWarmupTimer() {
  const C = useColors();
  const styles = useMemo(() => makeStyles(C), [C]);
  const DURATION = 5 * 60;
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
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  }, [secondsLeft, isRunning]);

  const reset = () => { setSecondsLeft(DURATION); setIsRunning(true); setIsDone(false); };
  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, '0');
  const ss = String(secondsLeft % 60).padStart(2, '0');

  if (isDone) {
    return (
      <Animated.View>
        <Pressable onPress={reset} style={styles.restTimerDone}>
          <Ionicons name="checkmark-circle" size={16} color={C.primary} />
          <Text style={styles.restTimerDoneText}>Warm-up complete — tap to reset</Text>
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
          {isRunning ? `Warm-up — ${mm}:${ss}` : `Cardio timer — ${mm}:${ss}`}
        </Text>
      </Pressable>
      <Pressable onPress={reset} style={styles.restTimerResetBtn}>
        <Ionicons name="refresh-outline" size={16} color={C.textSecondary} />
      </Pressable>
    </View>
  );
}

function SetRow({
  setNum,
  data,
  onChange,
  weightGuide,
  isBandExercise,
  isTimeExercise,
  disabled,
  previousBest,
  previousWeight,
  weightUnit = 'kg',
  onCompleted,
}: {
  setNum: number;
  data: SetLog;
  onChange: (updated: SetLog) => void;
  weightGuide?: string;
  isBandExercise?: boolean;
  isTimeExercise?: boolean;
  disabled?: boolean;
  previousBest?: number;
  previousWeight?: number;
  weightUnit?: WeightUnit;
  onCompleted?: () => void;
}) {
  const C = useColors();
  const styles = useMemo(() => makeStyles(C), [C]);

  const [weightText, setWeightText] = useState(() =>
    data.weight > 0 ? String(kgToDisplayUnit(data.weight, weightUnit)) : ''
  );

  const flashBg = useSharedValue(0);
  const flashStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(flashBg.value, [0, 1], ['rgba(47,107,70,0)', 'rgba(47,107,70,0.13)']),
    borderRadius: 6,
  }));

  const handleWeightChange = (t: string) => {
    setWeightText(t);
  };

  const handleWeightBlur = () => {
    const displayVal = parseFloat(weightText) || 0;
    setWeightText(displayVal > 0 ? String(displayVal) : '');
    onChange({ ...data, weight: displayUnitToKg(displayVal, weightUnit) });
  };

  const isNewRecord = !isBandExercise && previousBest !== undefined && previousBest > 0 && data.weight > previousBest;
  const placeholder = previousWeight && previousWeight > 0 ? String(kgToDisplayUnit(previousWeight, weightUnit)) : '0';

  return (
    <Animated.View style={flashStyle}>
      {weightGuide && (
        <View style={styles.weightGuideRow}>
          <Ionicons name="information-circle-outline" size={12} color={C.primary} />
          <Text style={styles.weightGuideText}>{weightGuide}</Text>
        </View>
      )}
      <View style={styles.setRow}>
        <Text style={styles.setLabel}>Set {setNum}</Text>
        <View style={styles.setInputs}>
          {!isBandExercise && (
            <View style={styles.inputGroup}>
              <TextInput
                style={[styles.setInput, disabled && styles.setInputDisabled]}
                placeholder={placeholder}
                placeholderTextColor={C.textTertiary}
                keyboardType="decimal-pad"
                returnKeyType="done"
                value={weightText}
                onChangeText={handleWeightChange}
                onBlur={handleWeightBlur}
                editable={!disabled}
                testID={`set-${setNum}-weight`}
              />
              <Text style={styles.inputUnit}>{weightUnit}</Text>
            </View>
          )}
          <View style={styles.inputGroup}>
            <TextInput
              style={[styles.setInput, disabled && styles.setInputDisabled]}
              placeholder="0"
              placeholderTextColor={C.textTertiary}
              keyboardType="number-pad"
              returnKeyType="done"
              value={data.reps > 0 ? String(data.reps) : ''}
              onChangeText={(t) => {
                const r = parseInt(t) || 0;
                onChange({ ...data, reps: r });
              }}
              editable={!disabled}
              testID={`set-${setNum}-reps`}
            />
            <Text style={styles.inputUnit}>{isTimeExercise ? 'min' : 'reps'}</Text>
          </View>
        </View>
        <Pressable
          onPress={() => {
            if (disabled) return;
            const completing = !data.completed;
            if (Platform.OS !== 'web') {
              if (completing) {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              } else {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }
            }
            if (completing) {
              flashBg.value = 1;
              flashBg.value = withTiming(0, { duration: 700 });
            }
            const displayVal = parseFloat(weightText);
            const w = displayVal > 0 ? displayUnitToKg(displayVal, weightUnit) : data.weight;
            onChange({ ...data, weight: w, completed: completing });
            if (completing) onCompleted?.();
          }}
          style={[styles.setCheck, data.completed && styles.setCheckDone, disabled && styles.setCheckDisabled]}
          testID={`set-${setNum}-check`}
        >
          {data.completed && <Ionicons name="checkmark" size={20} color={C.textInverse} />}
        </Pressable>
      </View>
      {isNewRecord && (
        <View style={styles.newRecordBadge}>
          <Ionicons name="star" size={10} color="#fff" />
          <Text style={styles.newRecordText}>New Record!</Text>
        </View>
      )}
    </Animated.View>
  );
}

type ExerciseState = 'active' | 'past' | 'future';

function ExerciseCard({
  exercise,
  index,
  setData,
  onSetChange,
  onVideoPress,
  onSwapPress,
  isDumbbellSession,
  exerciseState,
  sessionType,
  onCardLayout,
  previousBest,
  previousSessionWeight,
  feedbackMultiplier,
  weightUnit = 'kg',
  note = '',
  onNoteChange,
}: {
  exercise: Exercise;
  index: number;
  setData: ExerciseSetData;
  onSetChange: (setIndex: number, updated: SetLog) => void;
  onVideoPress: () => void;
  onSwapPress: () => void;
  isDumbbellSession: boolean;
  exerciseState: ExerciseState;
  sessionType: SessionType;
  onCardLayout?: (y: number) => void;
  previousBest?: number;
  previousSessionWeight?: number;
  feedbackMultiplier?: number;
  weightUnit?: WeightUnit;
  note?: string;
  onNoteChange?: (text: string) => void;
}) {
  const C = useColors();
  const styles = useMemo(() => makeStyles(C), [C]);
  const [expanded, setExpanded] = useState(true);
  const [timerTrigger, setTimerTrigger] = useState(0);
  const allDone = setData.sets.every(s => s.completed);
  const weightGuides = getWeightGuide(exercise.category, exercise.sets, weightUnit, exercise.suggestedLoad);
  const restPeriod = getRestPeriod(exercise.category);

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
  }, [isActive]);
  const scaleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: unlockScale.value }],
  }));

  const categoryColors: Record<string, { bg: string; text: string; label: string }> = {
    prep:       { bg: '#e3f2fd', text: '#1565c0', label: 'Warm-Up' },
    mechanical: { bg: '#e0f2f1', text: '#00695c', label: 'Activation' },
    neuro:      { bg: '#f3e5f5', text: '#7b1fa2', label: 'Power Primer' },
    main:       { bg: C.primaryMuted, text: C.primaryDark, label: 'KPI Lift' },
    accessory:  { bg: C.surfaceTertiary, text: C.textSecondary, label: 'Pump' },
    prehab:     { bg: '#fff3e0', text: '#e65100', label: 'Prehab' },
    finisher:   { bg: '#fce8e6', text: '#c62828', label: 'Finisher' },
    cooldown:   { bg: '#e8f5e9', text: '#2e7d32', label: 'Cool Down' },
  };

  const cat = categoryColors[exercise.category] ?? categoryColors.accessory;
  const showDumbbellNote = isDumbbellSession &&
    (exercise.name.toLowerCase().includes('dumbbell') || exercise.name.toLowerCase().includes(' db ') || exercise.name.startsWith('DB ')) &&
    exercise.suggestedLoad.includes('kg');

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
      <View style={[
        styles.exerciseCard,
        isActive && allDone && styles.exerciseCardDone,
        isPast && styles.exerciseCardPast,
        isFuture && styles.exerciseCardLocked,
        !isFuture && { borderLeftWidth: 4, borderLeftColor: cat.text },
      ]}>

        {/* ── Future state: locked with padlock ────────────────────────────── */}
        {isFuture && (
          <View style={styles.lockedHeader}>
            <View style={styles.lockIconWrap}>
              <Ionicons name="lock-closed" size={14} color={C.textTertiary} />
            </View>
            <View style={styles.lockedInfo}>
              <Text style={styles.lockedName} numberOfLines={1}>{exercise.name}</Text>
              <View style={styles.lockedMeta}>
                <View style={[styles.categoryPill, { backgroundColor: cat.bg }]}>
                  <Text style={[styles.categoryText, { color: cat.text }]}>{cat.label}</Text>
                </View>
                <Text style={styles.lockedMetaText}>{setsLabel} × {repDisplay}</Text>
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
              <Text style={styles.pastName} numberOfLines={1}>{exercise.name}</Text>
              <View style={styles.lockedMeta}>
                <View style={[styles.categoryPill, { backgroundColor: cat.bg }]}>
                  <Text style={[styles.categoryText, { color: cat.text }]}>{cat.label}</Text>
                </View>
                <Text style={styles.lockedMetaText}>{setsLabel} × {repDisplay}</Text>
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
                  <Text style={[styles.exerciseName, allDone && styles.exerciseNameDone]} numberOfLines={2}>
                    {exercise.name}
                  </Text>
                  {exercise.badge && (
                    <View style={[styles.badge, exercise.badge === 'comfort' ? { backgroundColor: C.badgeComfort } : { backgroundColor: C.badgeVolume }]}>
                      <Text style={[styles.badgeText, exercise.badge === 'comfort' ? { color: C.badgeComfortText } : { color: C.badgeVolumeText }]}>
                        {exercise.badge === 'comfort' ? 'Comfort' : 'Volume'}
                      </Text>
                    </View>
                  )}
                  {feedbackMultiplier !== undefined && Math.abs(feedbackMultiplier - 1.0) > 0.001 && (
                    <View style={[styles.badge, { backgroundColor: feedbackMultiplier > 1.0 ? C.primaryMuted : '#fff3e0' }]}>
                      <Text style={[styles.badgeText, { color: feedbackMultiplier > 1.0 ? C.primaryDark : '#e65100' }]}>
                        {feedbackMultiplier > 1.0 ? '↑ adjusted' : '↓ adjusted'}
                      </Text>
                    </View>
                  )}
                </View>
                <View style={styles.exerciseMeta}>
                  <View style={[styles.categoryPill, { backgroundColor: cat.bg }]}>
                    <Text style={[styles.categoryText, { color: cat.text }]}>{cat.label}</Text>
                  </View>
                  <Text style={styles.metaText}>{setsLabel} × {repDisplay}</Text>
                </View>
                {!isBandExercise && (
                  <Text style={styles.targetWeightLabel}>Target weight: </Text>
                )}
                <Text style={[styles.loadText, !isBandExercise && styles.loadTextMain]}>{exercise.suggestedLoad}</Text>
                {showDumbbellNote && (
                  <Text style={styles.dumbbellNote}>Weight shown is per hand (each dumbbell)</Text>
                )}
              </View>
              <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={18} color={C.textTertiary} style={styles.chevron} />
            </Pressable>

            <View style={styles.actionRow}>
              <Pressable onPress={onVideoPress} style={[styles.actionBtn, styles.actionBtnYoutube]} testID={`video-${index}`}>
                <Ionicons name="logo-youtube" size={15} color="#FF0000" />
                <Text style={[styles.actionBtnText, { color: '#CC0000' }]}>Watch on YouTube</Text>
              </Pressable>
              {exercise.hasSwap && (
                <Pressable onPress={onSwapPress} style={[styles.actionBtn, setData.swapped && styles.actionBtnSwapped]} testID={`swap-${index}`}>
                  <Ionicons name="swap-horizontal-outline" size={15} color={setData.swapped ? C.primary : C.textSecondary} />
                  <Text style={[styles.actionBtnText, setData.swapped && { color: C.primary }]}>
                    {setData.swapped ? 'Swap again' : 'Swap exercise'}
                  </Text>
                </Pressable>
              )}
            </View>

            {expanded && (
              <View style={styles.setsContainer}>
                <View style={styles.cueContainer}>
                  <Ionicons name="bulb-outline" size={14} color={C.primary} />
                  <Text style={styles.cueText}>{exercise.cue}</Text>
                </View>

                {(exercise.id === 'cardio-warmup' || (exercise.category === 'prep' && index === 0)) && <CardioWarmupTimer />}

                {exercise.id !== 'cardio-warmup' && !(exercise.category === 'prep' && index === 0) && <RestTimer category={exercise.category} trigger={timerTrigger} />}

                <View style={styles.setHeaderRow}>
                  <Text style={styles.setHeaderItem}>Set</Text>
                  <View style={styles.setHeaderInputs}>
                    {!isBandExercise && (
                      <Text style={styles.setHeaderItem}>{weightUnit}</Text>
                    )}
                    <Text style={styles.setHeaderItem}>{isTimeExercise ? 'Time' : 'Reps'}</Text>
                  </View>
                  <Text style={styles.setHeaderItem}>Done</Text>
                </View>

                {setData.sets.map((s, si) => (
                  <SetRow
                    key={si}
                    setNum={si + 1}
                    data={s}
                    onChange={(u) => onSetChange(si, u)}
                    weightGuide={weightGuides[si]}
                    isBandExercise={isBandExercise}
                    isTimeExercise={isTimeExercise}
                    previousBest={previousBest}
                    previousWeight={previousSessionWeight}
                    weightUnit={weightUnit}
                    onCompleted={si === setData.sets.length - 1 ? () => setTimerTrigger((n) => n + 1) : undefined}
                  />
                ))}

                <View style={styles.noteInputRow}>
                  <TextInput
                    style={styles.noteInput}
                    placeholder="Note (optional)"
                    placeholderTextColor={C.textTertiary}
                    value={note}
                    onChangeText={onNoteChange}
                    returnKeyType="done"
                    multiline={false}
                    maxLength={160}
                    testID={`note-${index}`}
                  />
                </View>
              </View>
            )}
          </Animated.View>
          </Animated.View>
        )}

      </View>
    </Animated.View>
  );
}

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
  }>();

  const VALID_SESSION_TYPES: SessionType[] = ['squat', 'bench', 'deadlift', 'conditioning', 'prehab', 'flexibility'];
  const VALID_ENERGY: EnergyLevel[] = ['low', 'normal', 'high'];
  const VALID_TIME: TimeAvailable[] = ['30', '45', '60'];

  const sessionType = VALID_SESSION_TYPES.includes(params.sessionType as SessionType)
    ? (params.sessionType as SessionType) : 'squat';
  const hasAches = params.hasAches === 'true';
  const painRegion = params.painRegion ? (params.painRegion as PainRegion) : undefined;
  const energy = VALID_ENERGY.includes(params.energy as EnergyLevel)
    ? (params.energy as EnergyLevel) : 'normal';
  const timeAvailable = VALID_TIME.includes(params.timeAvailable as TimeAvailable)
    ? (params.timeAvailable as TimeAvailable) : '60';
  const NON_TEST_TYPES: SessionType[] = ['prehab', 'flexibility', 'conditioning'];
  const isTestWeek = params.isTestWeek === 'true' && !NON_TEST_TYPES.includes(sessionType);

  const C = useColors();
  const styles = useMemo(() => makeStyles(C), [C]);
  const { getEffectiveTier, completeSession, addOneRepMax, userProfile, exerciseFeedback, setExerciseFeedback, applyTooEasyAdjustment, getBestORM, completedSessions, completedCount, weightUnit } = useAppStore();
  const VALID_EQUIPMENT: EquipmentTier[] = ['bodyweight', 'bands', 'dumbbells', 'kettlebells', 'fullgym'];
  const equipmentTier: EquipmentTier = VALID_EQUIPMENT.includes(params.equipment as EquipmentTier)
    ? (params.equipment as EquipmentTier)
    : getEffectiveTier();

  const isDumbbellSession = equipmentTier === 'dumbbells' || equipmentTier === 'kettlebells';

  // Capture exerciseFeedback at session start so mid-session store updates don't re-generate exercises
  const exerciseFeedbackAtStart = useRef<Record<string, ExerciseFeedback>>(exerciseFeedback);

  // Compute per-exercise previous best weight from persisted sessions.
  // useMemo re-runs when completedSessions changes (e.g. after async hydration completes)
  // but NOT on keystrokes (keystroke state only updates exerciseData, not completedSessions).
  const previousBest = useMemo<Record<string, number>>(() => {
    const lookup: Record<string, number> = {};
    for (const session of completedSessions) {
      for (const exLog of session.exerciseLogs) {
        const maxWeight = exLog.sets.reduce((m, s) => s.weight > m ? s.weight : m, 0);
        if (maxWeight > 0) {
          if (lookup[exLog.exerciseId] === undefined || maxWeight > lookup[exLog.exerciseId]) {
            lookup[exLog.exerciseId] = maxWeight;
          }
        }
      }
    }
    return lookup;
  }, [completedSessions]);

  // Per-exercise average weight from the most recent session — used as kg placeholder pre-fill
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

  const exercises = useMemo(() => {
    if (isTestWeek) {
      return generate1RMWorkout(sessionType, equipmentTier);
    }
    const bestOrm = getBestORM(sessionType);
    const bestOrmKg = bestOrm ? bestOrm.weight : undefined;
    return generateWorkout(sessionType, equipmentTier, { hasAches, painRegion, energy, timeAvailable }, userProfile, exerciseFeedbackAtStart.current, bestOrmKg);
  }, [sessionType, equipmentTier, hasAches, painRegion, energy, timeAvailable, isTestWeek, userProfile, getBestORM]);

  const [exerciseData, setExerciseData] = useState<ExerciseSetData[]>([]);
  const [exerciseNotes, setExerciseNotes] = useState<string[]>([]);
  const [showAbandonModal, setShowAbandonModal] = useState(false);
  const [showCongratsModal, setShowCongratsModal] = useState(false);
  const [congratsMessage] = useState(() =>
    CONGRATS_MESSAGES[Math.floor(Math.random() * CONGRATS_MESSAGES.length)]
  );
  const [feedbackStep, setFeedbackStep] = useState<'congrats' | 'rating' | 'tooEasy'>('congrats');
  const [thumbsRatings, setThumbsRatings] = useState<Record<string, 'up' | 'down'>>({});
  const [tooEasySelected, setTooEasySelected] = useState<Set<string>>(new Set());
  const [tooEasySaved, setTooEasySaved] = useState(false);
  const [isMilestone, setIsMilestone] = useState(false);
  const [milestoneCount, setMilestoneCount] = useState(0);
  const [streakMilestone, setStreakMilestone] = useState(0);
  const [testWeekOrmData, setTestWeekOrmData] = useState<{ prev: number | null; next: number } | null>(null);

  // Elapsed session timer
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  useEffect(() => {
    const timerId = setInterval(() => setElapsedSeconds((s) => s + 1), 1000);
    return () => clearInterval(timerId);
  }, []);
  const elapsedMM = String(Math.floor(elapsedSeconds / 60)).padStart(2, '0');
  const elapsedSS = String(elapsedSeconds % 60).padStart(2, '0');

  // Sequential exercise active index (active | past | future model)
  const [activeIndex, setActiveIndex] = useState(0);
  const scrollViewRef = useRef<ScrollView>(null);
  const cardYPositions = useRef<Record<number, number>>({});

  useEffect(() => {
    setExerciseData(
      exercises.map((ex) => ({
        sets: Array.from({ length: ex.sets }, (_, i) => ({
          setNumber: i + 1,
          weight: 0,
          reps: 0,
          completed: false,
        })),
        swapped: false,
      }))
    );
    setExerciseNotes(exercises.map(() => ''));
    setActiveIndex(0);
    cardYPositions.current = {};
  }, [exercises]);

  // Auto-advance to next exercise when current is fully complete
  useEffect(() => {
    if (exerciseData.length === 0) return;
    if (activeIndex >= exerciseData.length) return;
    const currentDone = exerciseData[activeIndex]?.sets.every(s => s.completed);
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

  const openYouTube = (exerciseName: string) => {
    const query = encodeURIComponent(exerciseName + ' exercise proper form tutorial');
    Linking.openURL('https://www.youtube.com/results?search_query=' + query);
  };
  const [swapModal, setSwapModal] = useState<{ index: number; exercise: Exercise } | null>(null);
  const webTopInset = Platform.OS === 'web' ? 67 : 0;

  const handleSetChange = useCallback((exerciseIndex: number, setIndex: number, updated: SetLog) => {
    setExerciseData(prev => {
      const next = [...prev];
      const ex = { ...next[exerciseIndex], sets: [...next[exerciseIndex].sets] };
      ex.sets[setIndex] = updated;
      next[exerciseIndex] = ex;
      return next;
    });
  }, []);

  const handleNoteChange = useCallback((exerciseIndex: number, text: string) => {
    setExerciseNotes(prev => {
      const next = [...prev];
      next[exerciseIndex] = text;
      return next;
    });
  }, []);

  const handleSwapConfirm = useCallback((index: number) => {
    setExerciseData(prev => {
      const next = [...prev];
      next[index] = { ...next[index], swapped: true };
      return next;
    });
    setSwapModal(null);
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, []);

  const getDisplayExercise = (exercise: Exercise, data: ExerciseSetData): Exercise => {
    if (data.swapped && exercise.swapName) {
      return {
        ...exercise,
        name: exercise.swapName,
        cue: exercise.swapCue ?? exercise.cue,
        suggestedLoad: exercise.swapLoad ?? exercise.suggestedLoad,
        hasSwap: true, // Keep swap available — allow unlimited swaps back to original
      };
    }
    return exercise;
  };

  if (exerciseData.length === 0) {
    return (
      <View style={[styles.container, { paddingTop: insets.top + webTopInset, justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={{ fontFamily: 'Inter_500Medium', color: C.textSecondary }}>Loading session...</Text>
      </View>
    );
  }

  const isPrehabOrFlex = sessionType === 'prehab' || sessionType === 'flexibility';
  const allDone = isPrehabOrFlex || exerciseData.every(ed => ed.sets.every(s => s.completed));
  const completedSetsCount = exerciseData.reduce((sum, ed) => sum + ed.sets.filter(s => s.completed).length, 0);
  const totalSets = exerciseData.reduce((sum, ed) => sum + ed.sets.length, 0);
  const progress = isPrehabOrFlex ? 1 : (totalSets > 0 ? completedSetsCount / totalSets : 0);

  const handleComplete = () => {
    if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    if (isTestWeek) {
      const mainExIndex = exercises.findIndex(e => e.category === 'main');
      if (mainExIndex >= 0) {
        const mainSets = exerciseData[mainExIndex].sets;
        const amrapSet = mainSets.find(s => s.completed && s.weight > 0 && s.reps > 0);
        if (amrapSet) {
          const estimatedMax = Math.round(amrapSet.weight * (1 + amrapSet.reps / 30));
          const prevOrm = getBestORM(sessionType);
          setTestWeekOrmData({ prev: prevOrm?.weight ?? null, next: estimatedMax });
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
      : exercises.map((ex, i) => ({
          exerciseId: ex.id,
          exerciseName: ex.name,
          sets: exerciseData[i].sets,
          note: exerciseNotes[i] || undefined,
        }));

    // Detect milestone before saving (completedCount is current, new count = completedCount + 1)
    const newCount = completedCount + 1;
    const hitsMilestone = MILESTONE_SESSIONS.includes(newCount);

    // Compute pre-save streak and post-save streak deterministically from session dates.
    // Only celebrate a streak milestone when this session actually extends the streak
    // into a new milestone value (avoids repeat badge for a 2nd session on the same day).
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    function computeStreakFromDates(dayTimestamps: Set<number>): number {
      const sorted = Array.from(dayTimestamps).sort((a, b) => b - a);
      let streak = 0;
      for (let i = 0; i < sorted.length; i++) {
        const checkDate = new Date(today);
        checkDate.setDate(checkDate.getDate() - i);
        checkDate.setHours(0, 0, 0, 0);
        if (sorted.includes(checkDate.getTime())) {
          streak++;
        } else {
          break;
        }
      }
      return streak;
    }

    const preSaveDays = new Set(
      completedSessions.map((s) => {
        const d = new Date(s.date);
        d.setHours(0, 0, 0, 0);
        return d.getTime();
      })
    );
    const postSaveDays = new Set(preSaveDays);
    postSaveDays.add(today.getTime()); // include today's session

    const preStreak = computeStreakFromDates(preSaveDays);
    const postStreak = computeStreakFromDates(postSaveDays);

    // Only show streak milestone badge when streak actually crosses into the milestone value
    const hitsStreakMilestone = (postStreak > preStreak && MILESTONE_STREAKS.includes(postStreak))
      ? postStreak
      : 0;

    completeSession({
      sessionType,
      date: new Date().toISOString(),
      equipmentTier,
      hadAches: hasAches,
      painRegion,
      energy,
      timeAvailable,
      exerciseCount: exercises.length,
      exerciseLogs,
      isTestWeek,
    });

    setIsMilestone(hitsMilestone);
    setMilestoneCount(newCount);
    setStreakMilestone(hitsStreakMilestone);
    setFeedbackStep('congrats');
    setThumbsRatings({});
    setTooEasySelected(new Set());
    setTooEasySaved(false);
    setShowCongratsModal(true);
  };

  const handleExit = () => {
    const hasProgress = exerciseData.some(ed => ed.sets.some(s => s.completed));
    if (hasProgress) {
      setShowAbandonModal(true);
    } else {
      router.back();
    }
  };

  const handleSaveAndExit = () => {
    const exerciseLogs: ExerciseLog[] = exercises.map((ex, i) => ({
      exerciseId: ex.id,
      exerciseName: ex.name,
      sets: exerciseData[i]?.sets ?? [],
      note: exerciseNotes[i] || undefined,
    }));
    completeSession({
      sessionType,
      date: new Date().toISOString(),
      equipmentTier,
      hadAches: hasAches,
      painRegion,
      energy,
      timeAvailable,
      exerciseCount: exercises.length,
      exerciseLogs,
      isTestWeek,
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
            {isTestWeek ? 'Strength Test' : getSessionLabel(sessionType)}
          </Text>
          <Text style={styles.sessionSub}>
            {isTestWeek ? `${getSessionLabel(sessionType)} — AMRAP @ 90%` : getSessionSubtitle(sessionType)}
          </Text>
        </View>
        <View style={styles.elapsedTimer}>
          <Ionicons name="time-outline" size={12} color={C.textTertiary} />
          <Text style={styles.elapsedTimerText}>{elapsedMM}:{elapsedSS}</Text>
        </View>
      </Animated.View>

      <View style={styles.progressBar}>
        <View style={styles.progressTrack}>
          <Animated.View style={[styles.progressFill, { width: `${progress * 100}%` as any }]} />
        </View>
        <Text style={styles.progressText}>{isPrehabOrFlex ? 'Complete when ready' : `${completedSetsCount}/${totalSets} sets completed`}</Text>
      </View>

      {(hasAches || energy !== 'normal' || isTestWeek) && (
        <View style={styles.adaptationBar}>
          {isTestWeek && (
            <View style={[styles.adaptTag, { backgroundColor: '#fff3e0' }]}>
              <Ionicons name="trophy-outline" size={12} color="#e65100" />
              <Text style={[styles.adaptTagText, { color: '#e65100' }]}>Test Week</Text>
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

      <ScrollView
        ref={scrollViewRef}
        style={styles.exerciseList}
        contentContainerStyle={[
          styles.exerciseListContent,
          { paddingBottom: insets.bottom + (Platform.OS === 'web' ? 34 : 0) + 110 },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
      >
        {exercises.map((exercise, index) => {
          const data = exerciseData[index];
          if (!data) return null;
          const displayExercise = getDisplayExercise(exercise, data);
          const exState: ExerciseState =
            index < activeIndex ? 'past' :
            index === activeIndex ? 'active' : 'future';
          return (
            <ExerciseCard
              key={exercise.id + index}
              exercise={displayExercise}
              index={index}
              setData={data}
              onSetChange={(si, u) => handleSetChange(index, si, u)}
              onVideoPress={() => openYouTube(displayExercise.name)}
              onSwapPress={() => setSwapModal({ index, exercise })}
              isDumbbellSession={isDumbbellSession}
              exerciseState={exState}
              sessionType={sessionType}
              onCardLayout={(y) => { cardYPositions.current[index] = y; }}
              previousBest={previousBest[exercise.id]}
              previousSessionWeight={previousSessionWeights[exercise.id]}
              feedbackMultiplier={exerciseFeedbackAtStart.current[exercise.id]?.multiplier}
              weightUnit={weightUnit}
              note={exerciseNotes[index] ?? ''}
              onNoteChange={(text) => handleNoteChange(index, text)}
            />
          );
        })}
      </ScrollView>

      <View style={[styles.bottomAction, { paddingBottom: insets.bottom + (Platform.OS === 'web' ? 34 : 16) }]}>
        <Pressable
          onPress={handleComplete}
          disabled={!allDone}
          style={({ pressed }) => [
            styles.completeButton,
            !allDone && styles.completeButtonDisabled,
            pressed && allDone && { opacity: 0.9, transform: [{ scale: 0.98 }] },
          ]}
          testID="complete-session"
        >
          <Ionicons name="checkmark-circle" size={22} color={allDone ? C.textInverse : C.textTertiary} />
          <Text style={[styles.completeText, !allDone && styles.completeTextDisabled]}>
            {isTestWeek ? 'Save Strength Results' : 'Complete Session'}
          </Text>
        </Pressable>
      </View>

      {/* Abandon Modal */}
      <Modal visible={showAbandonModal} transparent animationType="fade" onRequestClose={() => setShowAbandonModal(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setShowAbandonModal(false)}>
          <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
            <View style={[styles.modalIcon, { backgroundColor: '#fce8e6' }]}>
              <Ionicons name="exit-outline" size={32} color="#c62828" />
            </View>
            <Text style={styles.modalTitle}>Leave Session?</Text>
            <Text style={styles.modalDesc}>You've logged some sets. What would you like to do?</Text>
            <Pressable
              onPress={handleSaveAndExit}
              style={[styles.abandonBtn, styles.abandonBtnSave]}
              testID="abandon-save"
            >
              <Ionicons name="save-outline" size={18} color={C.textInverse} />
              <Text style={styles.abandonBtnSaveText}>Save & exit</Text>
            </Pressable>
            <Pressable
              onPress={() => { setShowAbandonModal(false); router.back(); }}
              style={[styles.abandonBtn, styles.abandonBtnDiscard]}
              testID="abandon-discard"
            >
              <Ionicons name="trash-outline" size={18} color="#c62828" />
              <Text style={styles.abandonBtnDiscardText}>Discard session</Text>
            </Pressable>
            <Pressable onPress={() => setShowAbandonModal(false)} style={styles.modalClose}>
              <Text style={styles.modalCloseText}>Keep going</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Swap Modal */}
      <Modal visible={!!swapModal} transparent animationType="fade" onRequestClose={() => setSwapModal(null)}>
        <Pressable style={styles.modalOverlay} onPress={() => setSwapModal(null)}>
          <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
            <View style={[styles.modalIcon, { backgroundColor: '#fff3e0' }]}>
              <Ionicons name="swap-horizontal-outline" size={32} color="#e65100" />
            </View>
            <Text style={styles.modalTitle}>Swap Exercise</Text>
            {swapModal && (
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
                    <Text style={styles.swapToLoad}>{swapModal.exercise.swapLoad}</Text>
                  )}
                </View>
                <Text style={styles.swapNote}>This alternative targets the same muscles with less demand.</Text>
                <Pressable
                  onPress={() => handleSwapConfirm(swapModal.index)}
                  style={styles.swapConfirmBtn}
                >
                  <Text style={styles.swapConfirmText}>Use this exercise instead</Text>
                </Pressable>
              </>
            )}
            <Pressable onPress={() => setSwapModal(null)} style={styles.modalClose}>
              <Text style={styles.modalCloseText}>Keep original</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Congratulations Modal */}
      <Modal visible={showCongratsModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <Animated.View entering={FadeIn.duration(500)} style={[styles.modalContent, styles.congratsModal]}>

            {/* ── Congrats Step ────────────────────────────────────────────── */}
            {feedbackStep === 'congrats' && (
              <>
                {isMilestone ? (
                  <View style={styles.milestoneHeader}>
                    <View style={styles.milestoneIconWrap}>
                      <Ionicons name="trophy" size={52} color="#f59e0b" />
                    </View>
                    <Text style={styles.milestoneBadgeText}>MILESTONE</Text>
                  </View>
                ) : (
                  <View style={styles.congratsIcon}>
                    <Ionicons name="trophy" size={44} color="#f59e0b" />
                  </View>
                )}
                <Text style={isMilestone ? styles.congratsTitleMilestone : styles.congratsTitle}>
                  {isMilestone ? `Session ${milestoneCount}!` : 'Session Complete!'}
                </Text>
                <Text style={styles.congratsMessage}>
                  {isMilestone ? getMilestoneMessage(milestoneCount) : congratsMessage}
                </Text>
                <View style={styles.congratsStats}>
                  <View style={styles.congratsStat}>
                    <Text style={styles.congratsStatValue}>{exercises.length}</Text>
                    <Text style={styles.congratsStatLabel}>Exercises</Text>
                  </View>
                  <View style={styles.congratsStatDivider} />
                  <View style={styles.congratsStat}>
                    <Text style={styles.congratsStatValue}>{totalSets}</Text>
                    <Text style={styles.congratsStatLabel}>Total Sets</Text>
                  </View>
                  <View style={styles.congratsStatDivider} />
                  <View style={styles.congratsStat}>
                    <Text style={styles.congratsStatValue}>{timeAvailable}</Text>
                    <Text style={styles.congratsStatLabel}>Minutes</Text>
                  </View>
                </View>
                {streakMilestone > 0 && (
                  <View style={styles.streakBadge}>
                    <Text style={styles.streakBadgeIcon}>🔥</Text>
                    <Text style={styles.streakBadgeText}>{streakMilestone}-day streak!</Text>
                  </View>
                )}
                {isTestWeek && testWeekOrmData && (
                  <View style={styles.ormCompareCard}>
                    <Text style={styles.ormCompareTitle}>
                      {getSessionLabel(sessionType)} Strength Test
                    </Text>
                    <View style={styles.ormCompareRow}>
                      <View style={styles.ormCompareItem}>
                        <Text style={styles.ormCompareLabel}>Previous</Text>
                        <Text style={styles.ormCompareValue}>
                          {testWeekOrmData.prev ? formatWeight(testWeekOrmData.prev, weightUnit) : '—'}
                        </Text>
                      </View>
                      <Ionicons name="arrow-forward" size={18} color={C.textTertiary} />
                      <View style={styles.ormCompareItem}>
                        <Text style={styles.ormCompareLabel}>New 1RM</Text>
                        <Text style={[styles.ormCompareValue, styles.ormCompareNew]}>
                          {formatWeight(testWeekOrmData.next, weightUnit)}
                        </Text>
                      </View>
                    </View>
                    {testWeekOrmData.prev !== null && testWeekOrmData.next > testWeekOrmData.prev && (
                      <View style={styles.ormPbBadge}>
                        <Text style={styles.ormPbBadgeText}>🏆 New Personal Best!</Text>
                      </View>
                    )}
                  </View>
                )}
                {tooEasySaved && (
                  <View style={styles.feedbackSavedBanner}>
                    <Ionicons name="checkmark-circle" size={16} color={C.primary} />
                    <Text style={styles.feedbackSavedText}>Weights adjusted for next session</Text>
                  </View>
                )}
                <Pressable
                  onPress={() => {
                    setShowCongratsModal(false);
                    router.dismissAll();
                    router.replace('/(tabs)');
                  }}
                  style={[styles.congratsButton, isMilestone && styles.congratsButtonMilestone]}
                  testID="congrats-close"
                >
                  <Text style={styles.congratsButtonText}>Back to Home</Text>
                </Pressable>
                <View style={styles.feedbackButtonRow}>
                  <Pressable
                    onPress={() => setFeedbackStep('rating')}
                    style={styles.feedbackSecondaryBtn}
                    testID="open-rate-modal"
                  >
                    <Ionicons name="thumbs-up-outline" size={16} color={C.primary} />
                    <Text style={styles.feedbackSecondaryText}>Rate exercises</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => setFeedbackStep('tooEasy')}
                    style={styles.feedbackSecondaryBtn}
                    testID="open-too-easy-modal"
                  >
                    <Ionicons name="trending-up-outline" size={16} color={C.primary} />
                    <Text style={styles.feedbackSecondaryText}>Too easy?</Text>
                  </Pressable>
                </View>
              </>
            )}

            {/* ── Rating Step ──────────────────────────────────────────────── */}
            {feedbackStep === 'rating' && (
              <>
                <View style={[styles.modalIcon, { backgroundColor: C.primaryMuted }]}>
                  <Ionicons name="thumbs-up-outline" size={28} color={C.primary} />
                </View>
                <Text style={styles.modalTitle}>Rate Exercises</Text>
                <Text style={styles.feedbackSubtitle}>How did each exercise feel?</Text>
                <ScrollView style={styles.feedbackScroll} showsVerticalScrollIndicator={false}>
                  {exercises.map((ex) => (
                    <View key={ex.id} style={styles.ratingRow}>
                      <Text style={styles.ratingName} numberOfLines={2}>{ex.name}</Text>
                      <View style={styles.ratingButtons}>
                        <Pressable
                          onPress={() => setThumbsRatings((prev) => ({ ...prev, [ex.id]: 'up' }))}
                          style={[styles.thumbBtn, thumbsRatings[ex.id] === 'up' && styles.thumbBtnActive]}
                          testID={`thumb-up-${ex.id}`}
                        >
                          <Ionicons
                            name="thumbs-up"
                            size={18}
                            color={thumbsRatings[ex.id] === 'up' ? C.textInverse : C.textSecondary}
                          />
                        </Pressable>
                        <Pressable
                          onPress={() => setThumbsRatings((prev) => ({ ...prev, [ex.id]: 'down' }))}
                          style={[styles.thumbBtn, styles.thumbBtnDown, thumbsRatings[ex.id] === 'down' && styles.thumbBtnDownActive]}
                          testID={`thumb-down-${ex.id}`}
                        >
                          <Ionicons
                            name="thumbs-down"
                            size={18}
                            color={thumbsRatings[ex.id] === 'down' ? C.textInverse : C.textSecondary}
                          />
                        </Pressable>
                      </View>
                    </View>
                  ))}
                </ScrollView>
                <Pressable
                  onPress={() => {
                    Object.entries(thumbsRatings).forEach(([id, thumbs]) => {
                      setExerciseFeedback(id, thumbs);
                    });
                    setFeedbackStep('congrats');
                  }}
                  style={styles.congratsButton}
                  testID="submit-ratings"
                >
                  <Text style={styles.congratsButtonText}>Submit Ratings</Text>
                </Pressable>
                <Pressable onPress={() => setFeedbackStep('congrats')} style={styles.modalClose}>
                  <Text style={styles.modalCloseText}>Skip</Text>
                </Pressable>
              </>
            )}

            {/* ── Too Easy Step ────────────────────────────────────────────── */}
            {feedbackStep === 'tooEasy' && (
              <>
                <View style={[styles.modalIcon, { backgroundColor: '#fff3e0' }]}>
                  <Ionicons name="trending-up-outline" size={28} color="#e65100" />
                </View>
                <Text style={styles.modalTitle}>Too Easy?</Text>
                <Text style={styles.feedbackSubtitle}>Select exercises to make harder next session</Text>
                <ScrollView style={styles.feedbackScroll} showsVerticalScrollIndicator={false}>
                  {exercises.map((ex) => {
                    const selected = tooEasySelected.has(ex.id);
                    return (
                      <Pressable
                        key={ex.id}
                        onPress={() => {
                          setTooEasySelected((prev) => {
                            const next = new Set(prev);
                            if (next.has(ex.id)) next.delete(ex.id);
                            else next.add(ex.id);
                            return next;
                          });
                        }}
                        style={[styles.checklistRow, selected && styles.checklistRowSelected]}
                        testID={`tooEasy-${ex.id}`}
                      >
                        <View style={[styles.checklistBox, selected && styles.checklistBoxSelected]}>
                          {selected && <Ionicons name="checkmark" size={14} color={C.textInverse} />}
                        </View>
                        <Text style={[styles.checklistName, selected && styles.checklistNameSelected]} numberOfLines={2}>
                          {ex.name}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
                <Pressable
                  onPress={() => {
                    if (tooEasySelected.size > 0) {
                      applyTooEasyAdjustment(Array.from(tooEasySelected));
                      setTooEasySaved(true);
                      setTimeout(() => setTooEasySaved(false), 4000);
                    }
                    setTooEasySelected(new Set());
                    setFeedbackStep('congrats');
                  }}
                  style={[styles.congratsButton, tooEasySelected.size === 0 && styles.congratsButtonMuted]}
                  testID="confirm-too-easy"
                >
                  <Text style={styles.congratsButtonText}>
                    {tooEasySelected.size > 0 ? `Adjust ${tooEasySelected.size} exercise${tooEasySelected.size > 1 ? 's' : ''}` : 'Confirm'}
                  </Text>
                </Pressable>
                <Pressable onPress={() => setFeedbackStep('congrats')} style={styles.modalClose}>
                  <Text style={styles.modalCloseText}>Skip</Text>
                </Pressable>
              </>
            )}

          </Animated.View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

function makeStyles(C: ReturnType<typeof useColors>) { return StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  topBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 },
  closeButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  sessionInfo: { flex: 1, alignItems: 'center' },
  sessionLabel: { fontSize: 16, fontFamily: 'Inter_600SemiBold', color: C.text },
  sessionSub: { fontSize: 12, fontFamily: 'Inter_400Regular', color: C.textSecondary },
  progressBar: { paddingHorizontal: 24, marginBottom: 4 },
  progressTrack: { height: 4, backgroundColor: C.surfaceTertiary, borderRadius: 2, overflow: 'hidden', marginBottom: 6 },
  progressFill: { height: '100%', backgroundColor: C.primary, borderRadius: 2 },
  progressText: { fontSize: 12, fontFamily: 'Inter_500Medium', color: C.textTertiary, textAlign: 'center' },
  adaptationBar: { flexDirection: 'row', paddingHorizontal: 24, paddingVertical: 8, gap: 8, justifyContent: 'center', flexWrap: 'wrap' },
  adaptTag: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, gap: 4 },
  adaptTagText: { fontSize: 12, fontFamily: 'Inter_500Medium' },
  exerciseList: { flex: 1 },
  exerciseListContent: { paddingHorizontal: 16, paddingTop: 8, gap: 10 },
  exerciseCard: { backgroundColor: C.surface, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: C.borderLight },
  exerciseCardDone: { backgroundColor: C.primarySurface, borderColor: C.primaryMuted },
  exerciseCardLocked: { backgroundColor: C.surfaceTertiary, borderColor: C.borderLight, opacity: 0.65 },
  exerciseHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  checkCircle: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: C.border, alignItems: 'center', justifyContent: 'center', marginTop: 2, flexShrink: 0 },
  checkCircleDone: { backgroundColor: C.primary, borderColor: C.primary },
  exerciseInfo: { flex: 1 },
  exerciseNameRow: { flexDirection: 'row', alignItems: 'flex-start', flexWrap: 'wrap', gap: 6, marginBottom: 4 },
  exerciseName: { fontSize: 15, fontFamily: 'Inter_600SemiBold', color: C.text, flex: 1 },
  exerciseNameDone: { color: C.primaryDark },
  badge: { paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4 },
  badgeText: { fontSize: 9, fontFamily: 'Inter_600SemiBold', textTransform: 'uppercase' as const, letterSpacing: 0.5 },
  exerciseMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 },
  categoryPill: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  categoryText: { fontSize: 10, fontFamily: 'Inter_500Medium' },
  metaText: { fontSize: 12, fontFamily: 'Inter_500Medium', color: C.textSecondary },
  loadText: { fontSize: 12, fontFamily: 'Inter_400Regular', color: C.textTertiary },
  dumbbellNote: { fontSize: 11, fontFamily: 'Inter_400Regular', color: C.primary, marginTop: 2, fontStyle: 'italic' as const },
  chevron: { marginTop: 2 },
  actionRow: { flexDirection: 'row', gap: 8, marginTop: 10, paddingLeft: 32 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, backgroundColor: C.surfaceTertiary },
  actionBtnYoutube: { backgroundColor: '#FFF0F0', borderWidth: 1, borderColor: '#FFCCCC' },
  actionBtnText: { fontSize: 12, fontFamily: 'Inter_500Medium', color: C.textSecondary },
  setsContainer: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: C.borderLight },
  cueContainer: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginBottom: 6 },
  cueText: { fontSize: 13, fontFamily: 'Inter_400Regular', color: C.primary, fontStyle: 'italic' as const, flex: 1 },
  setHeaderRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, marginBottom: 2 },
  setHeaderItem: { fontSize: 11, fontFamily: 'Inter_500Medium', color: C.textTertiary, textAlign: 'center' },
  setHeaderInputs: { flex: 1, flexDirection: 'row', justifyContent: 'center', gap: 20 },
  weightGuideRow: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingTop: 4, paddingBottom: 2 },
  weightGuideText: { fontSize: 11, fontFamily: 'Inter_400Regular', color: C.primary, flex: 1, fontStyle: 'italic' as const },
  setRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 4, paddingHorizontal: 8 },
  setLabel: { fontSize: 13, fontFamily: 'Inter_500Medium', color: C.textSecondary, width: 36 },
  setInputs: { flex: 1, flexDirection: 'row', justifyContent: 'center', gap: 12 },
  inputGroup: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  setInput: { width: 58, height: 38, borderRadius: 8, backgroundColor: C.surfaceTertiary, textAlign: 'center', fontSize: 14, fontFamily: 'Inter_500Medium', color: C.text, borderWidth: 1, borderColor: C.borderLight },
  setInputDisabled: { opacity: 0.45 },
  inputUnit: { fontSize: 11, fontFamily: 'Inter_400Regular', color: C.textTertiary, width: 30 },
  setCheck: { width: 44, height: 44, borderRadius: 22, borderWidth: 2.5, borderColor: C.border, alignItems: 'center', justifyContent: 'center', marginLeft: 8 },
  setCheckDone: { backgroundColor: C.primary, borderColor: C.primary },
  setCheckDisabled: { opacity: 0.3 },
  // Card state styles
  exerciseCardPast: { backgroundColor: C.surfaceTertiary, borderColor: C.borderLight, opacity: 0.80 },
  // Locked/future card styles
  lockedHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  lockIconWrap: { width: 22, height: 22, borderRadius: 11, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  lockedInfo: { flex: 1 },
  lockedName: { fontSize: 14, fontFamily: 'Inter_500Medium', color: C.textSecondary, marginBottom: 4 },
  lockedMeta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  lockedMetaText: { fontSize: 11, fontFamily: 'Inter_400Regular', color: C.textTertiary },
  // Past (completed) card styles
  pastHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  pastName: { fontSize: 14, fontFamily: 'Inter_500Medium', color: C.textSecondary, marginBottom: 4 },
  bottomAction: { position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: 20, paddingTop: 12, backgroundColor: C.background, borderTopWidth: 1, borderTopColor: C.borderLight },
  completeButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: C.primary, borderRadius: 14, paddingVertical: 16, gap: 8 },
  completeButtonDisabled: { backgroundColor: C.surfaceTertiary },
  completeText: { fontSize: 17, fontFamily: 'Inter_600SemiBold', color: C.textInverse },
  completeTextDisabled: { color: C.textTertiary },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  modalContent: { backgroundColor: C.surface, borderRadius: 20, padding: 28, alignItems: 'center', width: '100%', maxWidth: 340 },
  modalIcon: { width: 64, height: 64, borderRadius: 16, backgroundColor: C.primaryMuted, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 18, fontFamily: 'Inter_700Bold', color: C.text, textAlign: 'center', marginBottom: 8 },
  modalDesc: { fontSize: 14, fontFamily: 'Inter_400Regular', color: C.textSecondary, textAlign: 'center', marginBottom: 20 },
  youtubeButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FF0000', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12, gap: 8, marginBottom: 12, width: '100%', justifyContent: 'center' },
  youtubeButtonText: { color: '#fff', fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  modalClose: { paddingVertical: 10, paddingHorizontal: 32 },
  modalCloseText: { fontSize: 14, fontFamily: 'Inter_500Medium', color: C.textSecondary },
  swapFrom: { width: '100%', padding: 12, backgroundColor: C.surfaceTertiary, borderRadius: 10, marginBottom: 4 },
  swapFromLabel: { fontSize: 11, fontFamily: 'Inter_500Medium', color: C.textTertiary, marginBottom: 2 },
  swapFromName: { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: C.text },
  swapArrow: { paddingVertical: 4 },
  swapTo: { width: '100%', padding: 12, backgroundColor: C.primarySurface, borderRadius: 10, borderWidth: 1, borderColor: C.primaryMuted, marginBottom: 12 },
  swapToLabel: { fontSize: 11, fontFamily: 'Inter_500Medium', color: C.primary, marginBottom: 2 },
  swapToName: { fontSize: 14, fontFamily: 'Inter_700Bold', color: C.primaryDark, marginBottom: 4 },
  swapToCue: { fontSize: 12, fontFamily: 'Inter_400Regular', color: C.textSecondary, fontStyle: 'italic' as const, marginBottom: 4 },
  swapToLoad: { fontSize: 12, fontFamily: 'Inter_500Medium', color: C.primary },
  swapNote: { fontSize: 12, fontFamily: 'Inter_400Regular', color: C.textTertiary, textAlign: 'center', marginBottom: 16 },
  swapConfirmBtn: { width: '100%', backgroundColor: C.primary, paddingVertical: 13, borderRadius: 12, alignItems: 'center', marginBottom: 4 },
  swapConfirmText: { fontSize: 15, fontFamily: 'Inter_600SemiBold', color: C.textInverse },
  congratsModal: { gap: 0 },
  congratsIcon: { width: 80, height: 80, borderRadius: 20, backgroundColor: '#fef9c3', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  congratsTitle: { fontSize: 22, fontFamily: 'Inter_700Bold', color: C.text, textAlign: 'center', marginBottom: 12 },
  congratsMessage: { fontSize: 14, fontFamily: 'Inter_400Regular', color: C.textSecondary, textAlign: 'center', lineHeight: 22, marginBottom: 20, paddingHorizontal: 4 },
  congratsStats: { flexDirection: 'row', backgroundColor: C.surfaceTertiary, borderRadius: 14, padding: 16, marginBottom: 20, width: '100%', alignItems: 'center' },
  congratsStat: { flex: 1, alignItems: 'center' },
  congratsStatValue: { fontSize: 22, fontFamily: 'Inter_700Bold', color: C.primary },
  congratsStatLabel: { fontSize: 11, fontFamily: 'Inter_400Regular', color: C.textTertiary, marginTop: 2 },
  congratsStatDivider: { width: 1, height: 28, backgroundColor: C.border },
  congratsButton: { width: '100%', backgroundColor: C.primary, paddingVertical: 16, borderRadius: 14, alignItems: 'center', marginBottom: 4 },
  congratsButtonMuted: { backgroundColor: C.surfaceTertiary },
  congratsButtonText: { fontSize: 16, fontFamily: 'Inter_600SemiBold', color: C.textInverse },
  feedbackSavedBanner: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 12, backgroundColor: C.primarySurface, borderRadius: 10, marginBottom: 14, width: '100%' },
  feedbackSavedText: { fontSize: 13, fontFamily: 'Inter_500Medium', color: C.primary, flex: 1 },
  feedbackButtonRow: { flexDirection: 'row', gap: 10, width: '100%', marginTop: 10 },
  feedbackSecondaryBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 11, borderRadius: 12, backgroundColor: C.primarySurface, borderWidth: 1, borderColor: C.primaryMuted },
  feedbackSecondaryText: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: C.primary },
  feedbackSubtitle: { fontSize: 13, fontFamily: 'Inter_400Regular', color: C.textSecondary, textAlign: 'center', marginBottom: 14 },
  feedbackScroll: { width: '100%', maxHeight: 260, marginBottom: 16 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.borderLight, gap: 8 },
  ratingName: { flex: 1, fontSize: 13, fontFamily: 'Inter_500Medium', color: C.text },
  ratingButtons: { flexDirection: 'row', gap: 6 },
  thumbBtn: { width: 34, height: 34, borderRadius: 8, borderWidth: 1.5, borderColor: C.border, alignItems: 'center', justifyContent: 'center', backgroundColor: C.surfaceTertiary },
  thumbBtnActive: { backgroundColor: C.primary, borderColor: C.primary },
  thumbBtnDown: { borderColor: C.border },
  thumbBtnDownActive: { backgroundColor: '#ef4444', borderColor: '#ef4444' },
  checklistRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 11, paddingHorizontal: 4, borderBottomWidth: 1, borderBottomColor: C.borderLight, gap: 10 },
  checklistRowSelected: { backgroundColor: C.primarySurface },
  checklistBox: { width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, borderColor: C.border, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  checklistBoxSelected: { backgroundColor: C.primary, borderColor: C.primary },
  checklistName: { flex: 1, fontSize: 13, fontFamily: 'Inter_500Medium', color: C.text },
  checklistNameSelected: { color: C.primaryDark, fontFamily: 'Inter_600SemiBold' },
  // New Record badge
  newRecordBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', backgroundColor: '#16a34a', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3, marginLeft: 8, marginBottom: 2 },
  newRecordText: { fontSize: 10, fontFamily: 'Inter_700Bold', color: '#fff', letterSpacing: 0.3 },
  // Milestone congrats styles
  milestoneHeader: { alignItems: 'center', marginBottom: 12 },
  milestoneIconWrap: { width: 96, height: 96, borderRadius: 24, backgroundColor: '#fef9c3', borderWidth: 2, borderColor: '#fde68a', alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  milestoneBadgeText: { fontSize: 11, fontFamily: 'Inter_700Bold', color: C.primary, letterSpacing: 1.5, backgroundColor: C.primaryMuted, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 8 },
  congratsTitleMilestone: { fontSize: 26, fontFamily: 'Inter_700Bold', color: C.primaryDark, textAlign: 'center', marginBottom: 12 },
  congratsButtonMilestone: { backgroundColor: C.primaryDark },
  // Streak badge
  streakBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#fff7ed', borderWidth: 1, borderColor: '#fed7aa', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8, marginBottom: 14, width: '100%', justifyContent: 'center' },
  streakBadgeIcon: { fontSize: 18 },
  streakBadgeText: { fontSize: 14, fontFamily: 'Inter_700Bold', color: '#c2410c' },
  // Elapsed timer in top bar
  elapsedTimer: { flexDirection: 'row', alignItems: 'center', gap: 3, width: 52 },
  elapsedTimerText: { fontSize: 12, fontFamily: 'Inter_500Medium', color: C.textTertiary },
  // Rest timer
  restTimerRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  restTimerBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10, backgroundColor: C.primarySurface, borderWidth: 1.5, borderColor: C.primaryMuted },
  restTimerBtnActive: { backgroundColor: C.primary, borderColor: C.primaryDark },
  restTimerResetBtn: { width: 40, height: 40, borderRadius: 10, backgroundColor: C.surfaceTertiary, borderWidth: 1, borderColor: C.borderLight, alignItems: 'center', justifyContent: 'center' },
  restTimerText: { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: C.primary },
  restTimerTextActive: { color: '#fff' },
  restTimerDone: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10, backgroundColor: C.primarySurface, borderWidth: 1.5, borderColor: C.primary, alignSelf: 'flex-start' },
  restTimerDoneText: { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: C.primary },
  // Cardio warmup timer
  cardioTimerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#fff3e0', borderRadius: 10, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: '#ffe0b2' },
  cardioTimerIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#ffe0b2', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  cardioTimerLabel: { fontSize: 12, fontFamily: 'Inter_600SemiBold', color: '#bf360c', marginBottom: 2 },
  cardioTimerCountdown: { fontSize: 20, fontFamily: 'Inter_700Bold', color: '#e65100' },
  cardioTimerToggle: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#ffe0b2', alignItems: 'center', justifyContent: 'center' },
  cardioTimerDone: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.primarySurface, borderRadius: 10, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: C.primaryMuted },
  cardioTimerDoneText: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: C.primary },
  // Per-exercise note input
  noteInputRow: { marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: C.borderLight },
  noteInput: { height: 36, borderRadius: 8, backgroundColor: C.surfaceTertiary, borderWidth: 1, borderColor: C.borderLight, paddingHorizontal: 10, fontSize: 13, fontFamily: 'Inter_400Regular', color: C.text },
  // Abandon modal
  abandonBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', paddingVertical: 14, borderRadius: 12, marginBottom: 8 },
  abandonBtnSave: { backgroundColor: C.primary },
  abandonBtnSaveText: { fontSize: 15, fontFamily: 'Inter_600SemiBold', color: C.textInverse },
  abandonBtnDiscard: { backgroundColor: '#fce8e6', borderWidth: 1, borderColor: '#ef9a9a' },
  abandonBtnDiscardText: { fontSize: 15, fontFamily: 'Inter_600SemiBold', color: '#c62828' },
  // Target weight label on KPI lift
  targetWeightLabel: { fontSize: 11, fontFamily: 'Inter_600SemiBold', color: C.primary, textTransform: 'uppercase' as const, letterSpacing: 0.5, marginBottom: 1 },
  loadTextMain: { fontSize: 16, fontFamily: 'Inter_700Bold', color: C.primaryDark },
  // Swapped-again action button
  actionBtnSwapped: { backgroundColor: C.primarySurface, borderWidth: 1, borderColor: C.primaryMuted },
  // Test week ORM comparison card in congrats modal
  ormCompareCard: { width: '100%', backgroundColor: C.primarySurface, borderRadius: 12, borderWidth: 1, borderColor: C.primaryMuted, padding: 14, marginBottom: 14 },
  ormCompareTitle: { fontSize: 12, fontFamily: 'Inter_600SemiBold', color: C.primary, textAlign: 'center', marginBottom: 12, textTransform: 'uppercase' as const, letterSpacing: 0.5 },
  ormCompareRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around' },
  ormCompareItem: { alignItems: 'center', flex: 1 },
  ormCompareLabel: { fontSize: 11, fontFamily: 'Inter_400Regular', color: C.textTertiary, marginBottom: 4 },
  ormCompareValue: { fontSize: 20, fontFamily: 'Inter_700Bold', color: C.text },
  ormCompareNew: { color: C.primary, fontSize: 22 },
  ormPbBadge: { marginTop: 10, alignItems: 'center' },
  ormPbBadgeText: { fontSize: 14, fontFamily: 'Inter_700Bold', color: C.primaryDark },
}); }
