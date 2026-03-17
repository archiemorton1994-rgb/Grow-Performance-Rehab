import React, { useState, useMemo, useCallback } from 'react';
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
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import Colors from '@/constants/colors';
import { EnergyLevel, PainRegion, SessionType, TimeAvailable, SetLog, ExerciseLog, useAppStore } from '@/lib/store';
import {
  Exercise,
  generateWorkout,
  generate1RMWorkout,
  getSessionLabel,
  getSessionSubtitle,
  getPainRegionLabel,
} from '@/lib/workout-engine';

interface ExerciseSetData {
  sets: SetLog[];
}

function SetRow({ setNum, data, onChange }: {
  setNum: number;
  data: SetLog;
  onChange: (updated: SetLog) => void;
}) {
  return (
    <View style={styles.setRow}>
      <Text style={styles.setLabel}>Set {setNum}</Text>
      <View style={styles.setInputs}>
        <View style={styles.inputGroup}>
          <TextInput
            style={styles.setInput}
            placeholder="0"
            placeholderTextColor={Colors.textTertiary}
            keyboardType="numeric"
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
            keyboardType="numeric"
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
  );
}

function ExerciseCard({ exercise, index, setData, onSetChange, onVideoPress }: {
  exercise: Exercise;
  index: number;
  setData: ExerciseSetData;
  onSetChange: (setIndex: number, updated: SetLog) => void;
  onVideoPress: () => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const allDone = setData.sets.every(s => s.completed);

  const categoryColors: Record<string, { bg: string; text: string; label: string }> = {
    prep:       { bg: '#e3f2fd', text: '#1565c0', label: 'Prep' },
    mechanical: { bg: '#e0f2f1', text: '#00695c', label: 'Activation' },
    neuro:      { bg: '#f3e5f5', text: '#7b1fa2', label: 'Power Primer' },
    main:       { bg: Colors.primaryMuted, text: Colors.primaryDark, label: 'KPI Lift' },
    accessory:  { bg: Colors.surfaceTertiary, text: Colors.textSecondary, label: 'Pump' },
    prehab:     { bg: '#fff3e0', text: '#e65100', label: 'Prehab' },
    finisher:   { bg: '#fce8e6', text: '#c62828', label: 'Finisher' },
    cooldown:   { bg: '#e8f5e9', text: '#2e7d32', label: 'Cool Down' },
  };

  const cat = categoryColors[exercise.category] ?? categoryColors.accessory;

  return (
    <Animated.View entering={FadeInDown.delay(80 + index * 40).duration(400)}>
      <View style={[styles.exerciseCard, allDone && styles.exerciseCardDone]}>
        <Pressable
          onPress={() => setExpanded(!expanded)}
          style={styles.exerciseHeader}
        >
          <View style={styles.exerciseLeft}>
            <View style={[styles.checkCircle, allDone && styles.checkCircleDone]}>
              {allDone && <Ionicons name="checkmark" size={14} color={Colors.textInverse} />}
            </View>
            <View style={styles.exerciseInfo}>
              <View style={styles.exerciseNameRow}>
                <Text style={[styles.exerciseName, allDone && styles.exerciseNameDone]} numberOfLines={1}>
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
                  <Text style={[styles.categoryText, { color: cat.text }]}>
                    {cat.label}
                  </Text>
                </View>
                <Text style={styles.metaText}>{exercise.sets}x{exercise.reps}</Text>
                <Text style={styles.metaText}>{exercise.suggestedLoad}</Text>
              </View>
            </View>
          </View>
          <View style={styles.headerActions}>
            <Pressable onPress={onVideoPress} hitSlop={8} style={styles.videoBtn} testID={`video-${index}`}>
              <Ionicons name="videocam-outline" size={18} color={Colors.textSecondary} />
            </Pressable>
            <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={18} color={Colors.textTertiary} />
          </View>
        </Pressable>

        {expanded && (
          <View style={styles.setsContainer}>
            <View style={styles.cueContainer}>
              <Ionicons name="bulb-outline" size={14} color={Colors.primary} />
              <Text style={styles.cueText}>{exercise.cue}</Text>
            </View>
            <View style={styles.setHeader}>
              <Text style={styles.setHeaderLabel}>Set</Text>
              <View style={styles.setHeaderInputs}>
                <Text style={styles.setHeaderLabel}>Weight</Text>
                <Text style={styles.setHeaderLabel}>Reps</Text>
              </View>
              <Text style={styles.setHeaderLabel}>Done</Text>
            </View>
            {setData.sets.map((s, si) => (
              <SetRow key={si} setNum={si + 1} data={s} onChange={(u) => onSetChange(si, u)} />
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
  }>();

  const VALID_SESSION_TYPES: SessionType[] = ['squat', 'bench', 'deadlift'];
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

  const { equipmentTier, completeSession, addOneRepMax } = useAppStore();

  const exercises = useMemo(() => {
    if (isTestWeek) {
      return generate1RMWorkout(sessionType, equipmentTier);
    }
    return generateWorkout(sessionType, equipmentTier, { hasAches, painRegion, energy, timeAvailable });
  }, [sessionType, equipmentTier, hasAches, painRegion, energy, timeAvailable, isTestWeek]);

  const [exerciseData, setExerciseData] = useState<ExerciseSetData[]>([]);

  React.useEffect(() => {
    setExerciseData(
      exercises.map((ex) => ({
        sets: Array.from({ length: ex.sets }, (_, i) => ({
          setNumber: i + 1,
          weight: 0,
          reps: 0,
          completed: false,
        })),
      }))
    );
  }, [exercises]);

  const [videoModalExercise, setVideoModalExercise] = useState<string | null>(null);
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

  if (exerciseData.length === 0) {
    return (
      <View style={[styles.container, { paddingTop: insets.top + webTopInset, justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={{ fontFamily: 'Inter_500Medium', color: Colors.textSecondary }}>Loading...</Text>
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
    router.dismissAll();
    router.replace('/(tabs)');
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

  return (
    <View style={[styles.container, { paddingTop: insets.top + webTopInset }]}>
      <Animated.View entering={FadeInUp.duration(400)} style={styles.topBar}>
        <Pressable onPress={handleExit} style={styles.closeButton} testID="session-exit">
          <Ionicons name="close" size={24} color={Colors.text} />
        </Pressable>
        <View style={styles.sessionInfo}>
          <Text style={styles.sessionLabel}>
            {isTestWeek ? '1RM Test' : getSessionLabel(sessionType)}
          </Text>
          <Text style={styles.sessionSub}>
            {isTestWeek ? `${getSessionLabel(sessionType)} - Max Effort` : getSessionSubtitle(sessionType)}
          </Text>
        </View>
        <View style={{ width: 40 }} />
      </Animated.View>

      <View style={styles.progressBar}>
        <View style={styles.progressTrack}>
          <Animated.View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
        </View>
        <Text style={styles.progressText}>{completedSetsCount}/{totalSets} sets</Text>
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
                {energy === 'low' ? 'Reduced' : 'Extra'} volume
              </Text>
            </View>
          )}
        </View>
      )}

      <ScrollView
        style={styles.exerciseList}
        contentContainerStyle={[styles.exerciseListContent, { paddingBottom: insets.bottom + (Platform.OS === 'web' ? 34 : 0) + 100 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {exercises.map((exercise, index) => (
          <ExerciseCard
            key={exercise.id + index}
            exercise={exercise}
            index={index}
            setData={exerciseData[index]}
            onSetChange={(si, u) => handleSetChange(index, si, u)}
            onVideoPress={() => setVideoModalExercise(exercise.name)}
          />
        ))}
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

      <Modal visible={!!videoModalExercise} transparent animationType="fade" onRequestClose={() => setVideoModalExercise(null)}>
        <Pressable style={styles.modalOverlay} onPress={() => setVideoModalExercise(null)}>
          <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalIcon}>
              <Ionicons name="play-circle-outline" size={36} color={Colors.primary} />
            </View>
            <Text style={styles.modalTitle}>{videoModalExercise}</Text>
            <Text style={styles.modalDesc}>Watch a demonstration video to learn perfect form and technique.</Text>
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
    </View>
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
  adaptationBar: { flexDirection: 'row', paddingHorizontal: 24, paddingVertical: 10, gap: 8, justifyContent: 'center', flexWrap: 'wrap' },
  adaptTag: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, gap: 4 },
  adaptTagText: { fontSize: 12, fontFamily: 'Inter_500Medium' },
  exerciseList: { flex: 1 },
  exerciseListContent: { paddingHorizontal: 20, paddingTop: 8, gap: 10 },
  exerciseCard: { backgroundColor: Colors.surface, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: Colors.borderLight },
  exerciseCardDone: { backgroundColor: Colors.primarySurface, borderColor: Colors.primaryMuted },
  exerciseHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  exerciseLeft: { flexDirection: 'row', flex: 1 },
  checkCircle: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center', marginRight: 10, marginTop: 2 },
  checkCircleDone: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  exerciseInfo: { flex: 1 },
  exerciseNameRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginBottom: 4 },
  exerciseName: { fontSize: 15, fontFamily: 'Inter_600SemiBold', color: Colors.text },
  exerciseNameDone: { color: Colors.primaryDark },
  badge: { paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4 },
  badgeText: { fontSize: 9, fontFamily: 'Inter_600SemiBold', textTransform: 'uppercase' as const, letterSpacing: 0.5 },
  exerciseMeta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  categoryPill: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  categoryText: { fontSize: 10, fontFamily: 'Inter_500Medium' },
  metaText: { fontSize: 12, fontFamily: 'Inter_400Regular', color: Colors.textSecondary },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  videoBtn: { width: 32, height: 32, borderRadius: 8, backgroundColor: Colors.surfaceTertiary, alignItems: 'center', justifyContent: 'center' },
  setsContainer: { marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: Colors.borderLight },
  cueContainer: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingLeft: 34, marginBottom: 10 },
  cueText: { fontSize: 13, fontFamily: 'Inter_400Regular', color: Colors.primary, fontStyle: 'italic' as const, flex: 1 },
  setHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, marginBottom: 4 },
  setHeaderLabel: { fontSize: 11, fontFamily: 'Inter_500Medium', color: Colors.textTertiary, width: 36, textAlign: 'center' },
  setHeaderInputs: { flex: 1, flexDirection: 'row', justifyContent: 'center', gap: 20 },
  setRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, paddingHorizontal: 8 },
  setLabel: { fontSize: 13, fontFamily: 'Inter_500Medium', color: Colors.textSecondary, width: 36 },
  setInputs: { flex: 1, flexDirection: 'row', justifyContent: 'center', gap: 12 },
  inputGroup: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  setInput: { width: 56, height: 36, borderRadius: 8, backgroundColor: Colors.surfaceTertiary, textAlign: 'center', fontSize: 14, fontFamily: 'Inter_500Medium', color: Colors.text },
  inputUnit: { fontSize: 11, fontFamily: 'Inter_400Regular', color: Colors.textTertiary },
  setCheck: { width: 28, height: 28, borderRadius: 14, borderWidth: 2, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center', marginLeft: 8 },
  setCheckDone: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  bottomAction: { position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: 20, paddingTop: 12, backgroundColor: Colors.background, borderTopWidth: 1, borderTopColor: Colors.borderLight },
  completeButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.primary, borderRadius: 14, paddingVertical: 16, gap: 8 },
  completeButtonDisabled: { backgroundColor: Colors.surfaceTertiary },
  completeText: { fontSize: 17, fontFamily: 'Inter_600SemiBold', color: Colors.textInverse },
  completeTextDisabled: { color: Colors.textTertiary },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 32 },
  modalContent: { backgroundColor: Colors.surface, borderRadius: 20, padding: 28, alignItems: 'center', width: '100%', maxWidth: 320 },
  modalIcon: { width: 64, height: 64, borderRadius: 16, backgroundColor: Colors.primaryMuted, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 18, fontFamily: 'Inter_700Bold', color: Colors.text, textAlign: 'center', marginBottom: 4 },
  modalSub: { fontSize: 15, fontFamily: 'Inter_600SemiBold', color: Colors.primary, marginBottom: 8 },
  modalDesc: { fontSize: 14, fontFamily: 'Inter_400Regular', color: Colors.textSecondary, textAlign: 'center', marginBottom: 20 },
  youtubeButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FF0000', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12, gap: 8, marginBottom: 12, width: '100%', justifyContent: 'center' },
  youtubeButtonText: { color: '#fff', fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  modalClose: { paddingVertical: 10, paddingHorizontal: 32 },
  modalCloseText: { fontSize: 14, fontFamily: 'Inter_500Medium', color: Colors.textSecondary },
});
