import React, { useState, useMemo, useCallback, useRef } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  Platform,
  Alert,
  TextInput,
  Modal,
  Linking,
  KeyboardAvoidingView,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown, FadeInUp, FadeIn } from 'react-native-reanimated';
import Colors from '@/constants/colors';
import { EquipmentTier, EnergyLevel, PainRegion, SessionType, TimeAvailable, SetLog, ExerciseLog, useAppStore } from '@/lib/store';
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

function SetRow({ setNum, data, onChange, weightGuide }: {
  setNum: number;
  data: SetLog;
  onChange: (updated: SetLog) => void;
  weightGuide?: string;
}) {
  return (
    <View>
      {weightGuide && (
        <View style={styles.weightGuideRow}>
          <Ionicons name="information-circle-outline" size={12} color={Colors.primary} />
          <Text style={styles.weightGuideText}>{weightGuide}</Text>
        </View>
      )}
      <View style={styles.setRow}>
        <Text style={styles.setLabel}>Set {setNum}</Text>
        <View style={styles.setInputs}>
          <View style={styles.inputGroup}>
            <TextInput
              style={styles.setInput}
              placeholder="0"
              placeholderTextColor={Colors.textTertiary}
              keyboardType="decimal-pad"
              returnKeyType="done"
              value={data.weight > 0 ? String(data.weight) : ''}
              onChangeText={(t) => {
                const w = parseFloat(t) || 0;
                onChange({ ...data, weight: w });
              }}
              testID={`set-${setNum}-weight`}
            />
            <Text style={styles.inputUnit}>kg</Text>
          </View>
          <View style={styles.inputGroup}>
            <TextInput
              style={styles.setInput}
              placeholder="0"
              placeholderTextColor={Colors.textTertiary}
              keyboardType="number-pad"
              returnKeyType="done"
              value={data.reps > 0 ? String(data.reps) : ''}
              onChangeText={(t) => {
                const r = parseInt(t) || 0;
                onChange({ ...data, reps: r });
              }}
              testID={`set-${setNum}-reps`}
            />
            <Text style={styles.inputUnit}>reps</Text>
          </View>
        </View>
        <Pressable
          onPress={() => {
            if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onChange({ ...data, completed: !data.completed });
          }}
          style={[styles.setCheck, data.completed && styles.setCheckDone]}
          testID={`set-${setNum}-check`}
        >
          {data.completed && <Ionicons name="checkmark" size={14} color={Colors.textInverse} />}
        </Pressable>
      </View>
    </View>
  );
}

function ExerciseCard({ exercise, index, setData, onSetChange, onVideoPress, onSwapPress, isDumbbellSession }: {
  exercise: Exercise;
  index: number;
  setData: ExerciseSetData;
  onSetChange: (setIndex: number, updated: SetLog) => void;
  onVideoPress: () => void;
  onSwapPress: () => void;
  isDumbbellSession: boolean;
}) {
  const [expanded, setExpanded] = useState(true);
  const allDone = setData.sets.every(s => s.completed);
  const weightGuides = getWeightGuide(exercise.category, exercise.sets);
  const restPeriod = getRestPeriod(exercise.category);

  const categoryColors: Record<string, { bg: string; text: string; label: string }> = {
    prep:       { bg: '#e3f2fd', text: '#1565c0', label: 'Warm-Up' },
    mechanical: { bg: '#e0f2f1', text: '#00695c', label: 'Activation' },
    neuro:      { bg: '#f3e5f5', text: '#7b1fa2', label: 'Power Primer' },
    main:       { bg: Colors.primaryMuted, text: Colors.primaryDark, label: 'KPI Lift' },
    accessory:  { bg: Colors.surfaceTertiary, text: Colors.textSecondary, label: 'Pump' },
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

  return (
    <Animated.View entering={FadeInDown.delay(60 + index * 35).duration(350)}>
      <View style={[styles.exerciseCard, allDone && styles.exerciseCardDone]}>
        <Pressable onPress={() => setExpanded(!expanded)} style={styles.exerciseHeader}>
          <View style={[styles.checkCircle, allDone && styles.checkCircleDone]}>
            {allDone && <Ionicons name="checkmark" size={14} color={Colors.textInverse} />}
          </View>
          <View style={styles.exerciseInfo}>
            <View style={styles.exerciseNameRow}>
              <Text style={[styles.exerciseName, allDone && styles.exerciseNameDone]} numberOfLines={2}>
                {exercise.name}
              </Text>
              {exercise.badge && (
                <View style={[styles.badge, exercise.badge === 'comfort' ? { backgroundColor: Colors.badgeComfort } : { backgroundColor: Colors.badgeVolume }]}>
                  <Text style={[styles.badgeText, exercise.badge === 'comfort' ? { color: Colors.badgeComfortText } : { color: Colors.badgeVolumeText }]}>
                    {exercise.badge === 'comfort' ? 'Comfort' : 'Volume'}
                  </Text>
                </View>
              )}
            </View>
            <View style={styles.exerciseMeta}>
              <View style={[styles.categoryPill, { backgroundColor: cat.bg }]}>
                <Text style={[styles.categoryText, { color: cat.text }]}>{cat.label}</Text>
              </View>
              <Text style={styles.metaText}>{setsLabel} × {repsLabel}</Text>
            </View>
            <Text style={styles.loadText}>{exercise.suggestedLoad}</Text>
            {showDumbbellNote && (
              <Text style={styles.dumbbellNote}>Weight shown is per hand (each dumbbell)</Text>
            )}
          </View>
          <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={18} color={Colors.textTertiary} style={styles.chevron} />
        </Pressable>

        <View style={styles.actionRow}>
          <Pressable onPress={onVideoPress} style={styles.actionBtn} testID={`video-${index}`}>
            <Ionicons name="play-circle-outline" size={15} color={Colors.textSecondary} />
            <Text style={styles.actionBtnText}>Watch form</Text>
          </Pressable>
          {exercise.hasSwap && !setData.swapped && (
            <Pressable onPress={onSwapPress} style={styles.actionBtn} testID={`swap-${index}`}>
              <Ionicons name="swap-horizontal-outline" size={15} color={Colors.textSecondary} />
              <Text style={styles.actionBtnText}>Swap exercise</Text>
            </Pressable>
          )}
          {setData.swapped && (
            <View style={[styles.actionBtn, { backgroundColor: '#fff3e0' }]}>
              <Ionicons name="checkmark-circle-outline" size={15} color="#e65100" />
              <Text style={[styles.actionBtnText, { color: '#e65100' }]}>Swapped</Text>
            </View>
          )}
        </View>

        {expanded && (
          <View style={styles.setsContainer}>
            <View style={styles.cueContainer}>
              <Ionicons name="bulb-outline" size={14} color={Colors.primary} />
              <Text style={styles.cueText}>{exercise.cue}</Text>
            </View>

            <View style={styles.restContainer}>
              <Ionicons name="timer-outline" size={12} color={Colors.textTertiary} />
              <Text style={styles.restText}>{restPeriod}</Text>
            </View>

            <View style={styles.setHeaderRow}>
              <Text style={styles.setHeaderItem}>Set</Text>
              <View style={styles.setHeaderInputs}>
                <Text style={styles.setHeaderItem}>Weight (kg)</Text>
                <Text style={styles.setHeaderItem}>Reps</Text>
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
              />
            ))}
          </View>
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

  const VALID_SESSION_TYPES: SessionType[] = ['squat', 'bench', 'deadlift', 'conditioning'];
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
  const isTestWeek = params.isTestWeek === 'true';

  const { equipmentTier: storeEquipmentTier, completeSession, addOneRepMax, userProfile } = useAppStore();
  const VALID_EQUIPMENT: EquipmentTier[] = ['bodyweight', 'bands', 'dumbbells', 'kettlebells', 'fullgym'];
  const equipmentTier: EquipmentTier = VALID_EQUIPMENT.includes(params.equipment as EquipmentTier)
    ? (params.equipment as EquipmentTier)
    : storeEquipmentTier;

  const isDumbbellSession = equipmentTier === 'dumbbells' || equipmentTier === 'kettlebells';

  const exercises = useMemo(() => {
    if (isTestWeek) {
      return generate1RMWorkout(sessionType, equipmentTier);
    }
    return generateWorkout(sessionType, equipmentTier, { hasAches, painRegion, energy, timeAvailable }, userProfile);
  }, [sessionType, equipmentTier, hasAches, painRegion, energy, timeAvailable, isTestWeek, userProfile]);

  const [exerciseData, setExerciseData] = useState<ExerciseSetData[]>([]);
  const [showCongratsModal, setShowCongratsModal] = useState(false);
  const [congratsMessage] = useState(() =>
    CONGRATS_MESSAGES[Math.floor(Math.random() * CONGRATS_MESSAGES.length)]
  );

  React.useEffect(() => {
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
  }, [exercises]);

  const [videoModalExercise, setVideoModalExercise] = useState<string | null>(null);
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
        hasSwap: false,
      };
    }
    return exercise;
  };

  if (exerciseData.length === 0) {
    return (
      <View style={[styles.container, { paddingTop: insets.top + webTopInset, justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={{ fontFamily: 'Inter_500Medium', color: Colors.textSecondary }}>Loading session...</Text>
      </View>
    );
  }

  const allDone = exerciseData.every(ed => ed.sets.every(s => s.completed));
  const completedSetsCount = exerciseData.reduce((sum, ed) => sum + ed.sets.filter(s => s.completed).length, 0);
  const totalSets = exerciseData.reduce((sum, ed) => sum + ed.sets.length, 0);
  const progress = totalSets > 0 ? completedSetsCount / totalSets : 0;

  const handleComplete = () => {
    if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    if (isTestWeek) {
      const mainExIndex = exercises.findIndex(e => e.category === 'main');
      if (mainExIndex >= 0) {
        const mainSets = exerciseData[mainExIndex].sets;
        const heaviest = mainSets.reduce((best, s) => s.weight > best ? s.weight : best, 0);
        if (heaviest > 0) {
          addOneRepMax({
            lift: sessionType,
            weight: heaviest,
            date: new Date().toISOString(),
            unit: 'kg',
          });
        }
      }
    }

    const exerciseLogs: ExerciseLog[] = exercises.map((ex, i) => ({
      exerciseId: ex.id,
      exerciseName: ex.name,
      sets: exerciseData[i].sets,
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

    setShowCongratsModal(true);
  };

  const handleExit = () => {
    const hasProgress = exerciseData.some(ed => ed.sets.some(s => s.completed));
    if (hasProgress) {
      Alert.alert('Leave Session?', 'Your progress will not be saved.', [
        { text: 'Stay', style: 'cancel' },
        { text: 'Leave', style: 'destructive', onPress: () => router.back() },
      ]);
    } else {
      router.back();
    }
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
          <Ionicons name="close" size={24} color={Colors.text} />
        </Pressable>
        <View style={styles.sessionInfo}>
          <Text style={styles.sessionLabel}>
            {isTestWeek ? '1RM Test' : getSessionLabel(sessionType)}
          </Text>
          <Text style={styles.sessionSub}>
            {isTestWeek ? `${getSessionLabel(sessionType)} — Max Effort` : getSessionSubtitle(sessionType)}
          </Text>
        </View>
        <View style={{ width: 40 }} />
      </Animated.View>

      <View style={styles.progressBar}>
        <View style={styles.progressTrack}>
          <Animated.View style={[styles.progressFill, { width: `${progress * 100}%` as any }]} />
        </View>
        <Text style={styles.progressText}>{completedSetsCount}/{totalSets} sets completed</Text>
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
            <View style={[styles.adaptTag, { backgroundColor: Colors.badgeComfort }]}>
              <Ionicons name="medical-outline" size={12} color={Colors.badgeComfortText} />
              <Text style={[styles.adaptTagText, { color: Colors.badgeComfortText }]}>
                {getPainRegionLabel(painRegion)}
              </Text>
            </View>
          )}
          {energy !== 'normal' && !isTestWeek && (
            <View style={[styles.adaptTag, { backgroundColor: Colors.badgeVolume }]}>
              <Ionicons name="flash-outline" size={12} color={Colors.badgeVolumeText} />
              <Text style={[styles.adaptTagText, { color: Colors.badgeVolumeText }]}>
                {energy === 'low' ? 'Reduced volume' : 'Extra volume'}
              </Text>
            </View>
          )}
        </View>
      )}

      <ScrollView
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
          return (
            <ExerciseCard
              key={exercise.id + index}
              exercise={displayExercise}
              index={index}
              setData={data}
              onSetChange={(si, u) => handleSetChange(index, si, u)}
              onVideoPress={() => setVideoModalExercise(displayExercise.name)}
              onSwapPress={() => setSwapModal({ index, exercise })}
              isDumbbellSession={isDumbbellSession}
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
          <Ionicons name="checkmark-circle" size={22} color={allDone ? Colors.textInverse : Colors.textTertiary} />
          <Text style={[styles.completeText, !allDone && styles.completeTextDisabled]}>
            {isTestWeek ? 'Save 1RM Results' : 'Complete Session'}
          </Text>
        </Pressable>
      </View>

      {/* Video Modal */}
      <Modal visible={!!videoModalExercise} transparent animationType="fade" onRequestClose={() => setVideoModalExercise(null)}>
        <Pressable style={styles.modalOverlay} onPress={() => setVideoModalExercise(null)}>
          <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalIcon}>
              <Ionicons name="play-circle-outline" size={36} color={Colors.primary} />
            </View>
            <Text style={styles.modalTitle}>{videoModalExercise}</Text>
            <Text style={styles.modalDesc}>Watch a demonstration to learn perfect form and technique.</Text>
            <Pressable
              onPress={() => {
                const query = encodeURIComponent((videoModalExercise || '') + ' exercise proper form tutorial');
                Linking.openURL('https://www.youtube.com/results?search_query=' + query);
              }}
              style={styles.youtubeButton}
            >
              <Ionicons name="logo-youtube" size={20} color="#fff" />
              <Text style={styles.youtubeButtonText}>Watch on YouTube</Text>
            </Pressable>
            <Pressable onPress={() => setVideoModalExercise(null)} style={styles.modalClose}>
              <Text style={styles.modalCloseText}>Close</Text>
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
                  <Ionicons name="arrow-down" size={18} color={Colors.textTertiary} />
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
            <View style={styles.congratsIcon}>
              <Ionicons name="trophy" size={44} color="#f59e0b" />
            </View>
            <Text style={styles.congratsTitle}>Session Complete!</Text>
            <Text style={styles.congratsMessage}>{congratsMessage}</Text>
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
            <Pressable
              onPress={() => {
                setShowCongratsModal(false);
                router.dismissAll();
                router.replace('/(tabs)');
              }}
              style={styles.congratsButton}
              testID="congrats-close"
            >
              <Text style={styles.congratsButtonText}>Back to Home</Text>
            </Pressable>
          </Animated.View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  topBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 },
  closeButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  sessionInfo: { flex: 1, alignItems: 'center' },
  sessionLabel: { fontSize: 16, fontFamily: 'Inter_600SemiBold', color: Colors.text },
  sessionSub: { fontSize: 12, fontFamily: 'Inter_400Regular', color: Colors.textSecondary },
  progressBar: { paddingHorizontal: 24, marginBottom: 4 },
  progressTrack: { height: 4, backgroundColor: Colors.surfaceTertiary, borderRadius: 2, overflow: 'hidden', marginBottom: 6 },
  progressFill: { height: '100%', backgroundColor: Colors.primary, borderRadius: 2 },
  progressText: { fontSize: 12, fontFamily: 'Inter_500Medium', color: Colors.textTertiary, textAlign: 'center' },
  adaptationBar: { flexDirection: 'row', paddingHorizontal: 24, paddingVertical: 8, gap: 8, justifyContent: 'center', flexWrap: 'wrap' },
  adaptTag: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, gap: 4 },
  adaptTagText: { fontSize: 12, fontFamily: 'Inter_500Medium' },
  exerciseList: { flex: 1 },
  exerciseListContent: { paddingHorizontal: 16, paddingTop: 8, gap: 10 },
  exerciseCard: { backgroundColor: Colors.surface, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: Colors.borderLight },
  exerciseCardDone: { backgroundColor: Colors.primarySurface, borderColor: Colors.primaryMuted },
  exerciseHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  checkCircle: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center', marginTop: 2, flexShrink: 0 },
  checkCircleDone: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  exerciseInfo: { flex: 1 },
  exerciseNameRow: { flexDirection: 'row', alignItems: 'flex-start', flexWrap: 'wrap', gap: 6, marginBottom: 4 },
  exerciseName: { fontSize: 15, fontFamily: 'Inter_600SemiBold', color: Colors.text, flex: 1 },
  exerciseNameDone: { color: Colors.primaryDark },
  badge: { paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4 },
  badgeText: { fontSize: 9, fontFamily: 'Inter_600SemiBold', textTransform: 'uppercase' as const, letterSpacing: 0.5 },
  exerciseMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 },
  categoryPill: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  categoryText: { fontSize: 10, fontFamily: 'Inter_500Medium' },
  metaText: { fontSize: 12, fontFamily: 'Inter_500Medium', color: Colors.textSecondary },
  loadText: { fontSize: 12, fontFamily: 'Inter_400Regular', color: Colors.textTertiary },
  dumbbellNote: { fontSize: 11, fontFamily: 'Inter_400Regular', color: Colors.primary, marginTop: 2, fontStyle: 'italic' as const },
  chevron: { marginTop: 2 },
  actionRow: { flexDirection: 'row', gap: 8, marginTop: 10, paddingLeft: 32 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, backgroundColor: Colors.surfaceTertiary },
  actionBtnText: { fontSize: 12, fontFamily: 'Inter_500Medium', color: Colors.textSecondary },
  setsContainer: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: Colors.borderLight },
  cueContainer: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginBottom: 6 },
  cueText: { fontSize: 13, fontFamily: 'Inter_400Regular', color: Colors.primary, fontStyle: 'italic' as const, flex: 1 },
  restContainer: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 12, paddingVertical: 6, paddingHorizontal: 8, backgroundColor: Colors.surfaceTertiary, borderRadius: 8 },
  restText: { fontSize: 12, fontFamily: 'Inter_500Medium', color: Colors.textTertiary },
  setHeaderRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, marginBottom: 2 },
  setHeaderItem: { fontSize: 11, fontFamily: 'Inter_500Medium', color: Colors.textTertiary, width: 36, textAlign: 'center' },
  setHeaderInputs: { flex: 1, flexDirection: 'row', justifyContent: 'center', gap: 20 },
  weightGuideRow: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingTop: 4, paddingBottom: 2 },
  weightGuideText: { fontSize: 11, fontFamily: 'Inter_400Regular', color: Colors.primary, flex: 1, fontStyle: 'italic' as const },
  setRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 4, paddingHorizontal: 8 },
  setLabel: { fontSize: 13, fontFamily: 'Inter_500Medium', color: Colors.textSecondary, width: 36 },
  setInputs: { flex: 1, flexDirection: 'row', justifyContent: 'center', gap: 12 },
  inputGroup: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  setInput: { width: 58, height: 38, borderRadius: 8, backgroundColor: Colors.surfaceTertiary, textAlign: 'center', fontSize: 14, fontFamily: 'Inter_500Medium', color: Colors.text, borderWidth: 1, borderColor: Colors.borderLight },
  inputUnit: { fontSize: 11, fontFamily: 'Inter_400Regular', color: Colors.textTertiary, width: 30 },
  setCheck: { width: 28, height: 28, borderRadius: 14, borderWidth: 2, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center', marginLeft: 8 },
  setCheckDone: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  bottomAction: { position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: 20, paddingTop: 12, backgroundColor: Colors.background, borderTopWidth: 1, borderTopColor: Colors.borderLight },
  completeButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.primary, borderRadius: 14, paddingVertical: 16, gap: 8 },
  completeButtonDisabled: { backgroundColor: Colors.surfaceTertiary },
  completeText: { fontSize: 17, fontFamily: 'Inter_600SemiBold', color: Colors.textInverse },
  completeTextDisabled: { color: Colors.textTertiary },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  modalContent: { backgroundColor: Colors.surface, borderRadius: 20, padding: 28, alignItems: 'center', width: '100%', maxWidth: 340 },
  modalIcon: { width: 64, height: 64, borderRadius: 16, backgroundColor: Colors.primaryMuted, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 18, fontFamily: 'Inter_700Bold', color: Colors.text, textAlign: 'center', marginBottom: 8 },
  modalDesc: { fontSize: 14, fontFamily: 'Inter_400Regular', color: Colors.textSecondary, textAlign: 'center', marginBottom: 20 },
  youtubeButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FF0000', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12, gap: 8, marginBottom: 12, width: '100%', justifyContent: 'center' },
  youtubeButtonText: { color: '#fff', fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  modalClose: { paddingVertical: 10, paddingHorizontal: 32 },
  modalCloseText: { fontSize: 14, fontFamily: 'Inter_500Medium', color: Colors.textSecondary },
  swapFrom: { width: '100%', padding: 12, backgroundColor: Colors.surfaceTertiary, borderRadius: 10, marginBottom: 4 },
  swapFromLabel: { fontSize: 11, fontFamily: 'Inter_500Medium', color: Colors.textTertiary, marginBottom: 2 },
  swapFromName: { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: Colors.text },
  swapArrow: { paddingVertical: 4 },
  swapTo: { width: '100%', padding: 12, backgroundColor: Colors.primarySurface, borderRadius: 10, borderWidth: 1, borderColor: Colors.primaryMuted, marginBottom: 12 },
  swapToLabel: { fontSize: 11, fontFamily: 'Inter_500Medium', color: Colors.primary, marginBottom: 2 },
  swapToName: { fontSize: 14, fontFamily: 'Inter_700Bold', color: Colors.primaryDark, marginBottom: 4 },
  swapToCue: { fontSize: 12, fontFamily: 'Inter_400Regular', color: Colors.textSecondary, fontStyle: 'italic' as const, marginBottom: 4 },
  swapToLoad: { fontSize: 12, fontFamily: 'Inter_500Medium', color: Colors.primary },
  swapNote: { fontSize: 12, fontFamily: 'Inter_400Regular', color: Colors.textTertiary, textAlign: 'center', marginBottom: 16 },
  swapConfirmBtn: { width: '100%', backgroundColor: Colors.primary, paddingVertical: 13, borderRadius: 12, alignItems: 'center', marginBottom: 4 },
  swapConfirmText: { fontSize: 15, fontFamily: 'Inter_600SemiBold', color: Colors.textInverse },
  congratsModal: { gap: 0 },
  congratsIcon: { width: 80, height: 80, borderRadius: 20, backgroundColor: '#fef9c3', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  congratsTitle: { fontSize: 22, fontFamily: 'Inter_700Bold', color: Colors.text, textAlign: 'center', marginBottom: 12 },
  congratsMessage: { fontSize: 14, fontFamily: 'Inter_400Regular', color: Colors.textSecondary, textAlign: 'center', lineHeight: 22, marginBottom: 20, paddingHorizontal: 4 },
  congratsStats: { flexDirection: 'row', backgroundColor: Colors.surfaceTertiary, borderRadius: 14, padding: 16, marginBottom: 20, width: '100%', alignItems: 'center' },
  congratsStat: { flex: 1, alignItems: 'center' },
  congratsStatValue: { fontSize: 22, fontFamily: 'Inter_700Bold', color: Colors.primary },
  congratsStatLabel: { fontSize: 11, fontFamily: 'Inter_400Regular', color: Colors.textTertiary, marginTop: 2 },
  congratsStatDivider: { width: 1, height: 28, backgroundColor: Colors.border },
  congratsButton: { width: '100%', backgroundColor: Colors.primary, paddingVertical: 16, borderRadius: 14, alignItems: 'center' },
  congratsButtonText: { fontSize: 16, fontFamily: 'Inter_600SemiBold', color: Colors.textInverse },
});
