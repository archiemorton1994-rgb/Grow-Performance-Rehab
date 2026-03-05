import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  Platform,
  Alert,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import Colors from '@/constants/colors';
import { EnergyLevel, PainArea, SessionType, useAppStore } from '@/lib/store';
import {
  Exercise,
  generateWorkout,
  getSessionLabel,
  getSessionSubtitle,
} from '@/lib/workout-engine';

function ExerciseCard({ exercise, index, completed, onToggle }: {
  exercise: Exercise;
  index: number;
  completed: boolean;
  onToggle: () => void;
}) {
  const categoryColors: Record<string, { bg: string; text: string }> = {
    main: { bg: Colors.primaryMuted, text: Colors.primaryDark },
    accessory: { bg: Colors.surfaceTertiary, text: Colors.textSecondary },
    finisher: { bg: '#fff3e0', text: '#e65100' },
  };

  const cat = categoryColors[exercise.category];

  return (
    <Animated.View entering={FadeInDown.delay(100 + index * 60).duration(400)}>
      <Pressable
        onPress={onToggle}
        style={({ pressed }) => [
          styles.exerciseCard,
          completed && styles.exerciseCardDone,
          pressed && { opacity: 0.9 },
        ]}
      >
        <View style={styles.exerciseHeader}>
          <View style={styles.exerciseLeft}>
            <View style={[styles.checkCircle, completed && styles.checkCircleDone]}>
              {completed && <Ionicons name="checkmark" size={14} color={Colors.textInverse} />}
            </View>
            <View style={styles.exerciseInfo}>
              <View style={styles.exerciseNameRow}>
                <Text style={[styles.exerciseName, completed && styles.exerciseNameDone]}>
                  {exercise.name}
                </Text>
                {exercise.badge && (
                  <View style={[
                    styles.badge,
                    exercise.badge === 'comfort'
                      ? { backgroundColor: Colors.badgeComfort }
                      : { backgroundColor: Colors.badgeVolume },
                  ]}>
                    <Text style={[
                      styles.badgeText,
                      exercise.badge === 'comfort'
                        ? { color: Colors.badgeComfortText }
                        : { color: Colors.badgeVolumeText },
                    ]}>
                      {exercise.badge === 'comfort' ? 'Comfort swap' : 'Volume adjusted'}
                    </Text>
                  </View>
                )}
              </View>
              <View style={[styles.categoryPill, { backgroundColor: cat.bg }]}>
                <Text style={[styles.categoryText, { color: cat.text }]}>
                  {exercise.category.charAt(0).toUpperCase() + exercise.category.slice(1)}
                </Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.exerciseDetails}>
          <View style={styles.detailRow}>
            <Ionicons name="repeat-outline" size={16} color={Colors.textSecondary} />
            <Text style={styles.detailText}>{exercise.sets} x {exercise.reps}</Text>
          </View>
          <View style={styles.detailRow}>
            <Ionicons name="barbell-outline" size={16} color={Colors.textSecondary} />
            <Text style={styles.detailText}>{exercise.suggestedLoad}</Text>
          </View>
        </View>

        <View style={styles.cueContainer}>
          <Ionicons name="bulb-outline" size={14} color={Colors.primary} />
          <Text style={styles.cueText}>{exercise.cue}</Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}

export default function SessionScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    sessionType: string;
    hasAches: string;
    painArea: string;
    energy: string;
  }>();

  const sessionType = (params.sessionType || 'squat') as SessionType;
  const hasAches = params.hasAches === 'true';
  const painArea = (params.painArea || undefined) as PainArea | undefined;
  const energy = (params.energy || 'normal') as EnergyLevel;

  const { equipmentTier, completeSession } = useAppStore();

  const exercises = useMemo(
    () => generateWorkout(sessionType, equipmentTier, { hasAches, painArea, energy }),
    [sessionType, equipmentTier, hasAches, painArea, energy]
  );

  const [completedSets, setCompletedSets] = useState<Set<number>>(new Set());

  const toggleExercise = (index: number) => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setCompletedSets((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const allDone = completedSets.size === exercises.length;
  const progress = exercises.length > 0 ? completedSets.size / exercises.length : 0;

  const handleComplete = () => {
    if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    completeSession({
      sessionType,
      date: new Date().toISOString(),
      equipmentTier,
      hadAches: hasAches,
      painArea,
      energy,
      exerciseCount: exercises.length,
    });
    router.dismissAll();
    router.replace('/(tabs)');
  };

  const handleExit = () => {
    if (completedSets.size > 0) {
      Alert.alert(
        'Leave Session?',
        'Your progress will not be saved.',
        [
          { text: 'Stay', style: 'cancel' },
          { text: 'Leave', style: 'destructive', onPress: () => router.back() },
        ]
      );
    } else {
      router.back();
    }
  };

  const webTopInset = Platform.OS === 'web' ? 67 : 0;

  return (
    <View style={[styles.container, { paddingTop: insets.top + webTopInset }]}>
      <Animated.View entering={FadeInUp.duration(400)} style={styles.topBar}>
        <Pressable onPress={handleExit} style={styles.closeButton}>
          <Ionicons name="close" size={24} color={Colors.text} />
        </Pressable>
        <View style={styles.sessionInfo}>
          <Text style={styles.sessionLabel}>{getSessionLabel(sessionType)}</Text>
          <Text style={styles.sessionSub}>{getSessionSubtitle(sessionType)}</Text>
        </View>
        <View style={{ width: 40 }} />
      </Animated.View>

      <View style={styles.progressBar}>
        <View style={styles.progressTrack}>
          <Animated.View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
        </View>
        <Text style={styles.progressText}>{completedSets.size}/{exercises.length} complete</Text>
      </View>

      {(hasAches || energy !== 'normal') && (
        <View style={styles.adaptationBar}>
          {hasAches && (
            <View style={[styles.adaptTag, { backgroundColor: Colors.badgeComfort }]}>
              <Ionicons name="medical-outline" size={12} color={Colors.badgeComfortText} />
              <Text style={[styles.adaptTagText, { color: Colors.badgeComfortText }]}>
                Pain adapted{painArea ? ` (${painArea})` : ''}
              </Text>
            </View>
          )}
          {energy !== 'normal' && (
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
        contentContainerStyle={[styles.exerciseListContent, { paddingBottom: insets.bottom + (Platform.OS === 'web' ? 34 : 0) + 100 }]}
        showsVerticalScrollIndicator={false}
      >
        {exercises.map((exercise, index) => (
          <ExerciseCard
            key={index}
            exercise={exercise}
            index={index}
            completed={completedSets.has(index)}
            onToggle={() => toggleExercise(index)}
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
        >
          <Ionicons
            name="checkmark-circle"
            size={22}
            color={allDone ? Colors.textInverse : Colors.textTertiary}
          />
          <Text style={[styles.completeText, !allDone && styles.completeTextDisabled]}>
            Complete Session
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  closeButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sessionInfo: {
    flex: 1,
    alignItems: 'center',
  },
  sessionLabel: {
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.text,
  },
  sessionSub: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    color: Colors.textSecondary,
  },
  progressBar: {
    paddingHorizontal: 24,
    marginBottom: 4,
  },
  progressTrack: {
    height: 4,
    backgroundColor: Colors.surfaceTertiary,
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 6,
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.primary,
    borderRadius: 2,
  },
  progressText: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
    color: Colors.textTertiary,
    textAlign: 'center',
  },
  adaptationBar: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    paddingVertical: 10,
    gap: 8,
    justifyContent: 'center',
  },
  adaptTag: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    gap: 4,
  },
  adaptTagText: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
  },
  exerciseList: {
    flex: 1,
  },
  exerciseListContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
    gap: 10,
  },
  exerciseCard: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  exerciseCardDone: {
    backgroundColor: Colors.primarySurface,
    borderColor: Colors.primaryMuted,
  },
  exerciseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  exerciseLeft: {
    flexDirection: 'row',
    flex: 1,
  },
  checkCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    marginTop: 2,
  },
  checkCircleDone: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  exerciseInfo: {
    flex: 1,
  },
  exerciseNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 6,
  },
  exerciseName: {
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.text,
  },
  exerciseNameDone: {
    color: Colors.primaryDark,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 10,
    fontFamily: 'Inter_600SemiBold',
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  categoryPill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  categoryText: {
    fontSize: 11,
    fontFamily: 'Inter_500Medium',
  },
  exerciseDetails: {
    flexDirection: 'row',
    gap: 20,
    marginBottom: 8,
    paddingLeft: 36,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  detailText: {
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
    color: Colors.textSecondary,
  },
  cueContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingLeft: 36,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
    paddingTop: 8,
  },
  cueText: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    color: Colors.primary,
    fontStyle: 'italic' as const,
    flex: 1,
  },
  bottomAction: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingTop: 12,
    backgroundColor: Colors.background,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  completeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    borderRadius: 14,
    paddingVertical: 16,
    gap: 8,
  },
  completeButtonDisabled: {
    backgroundColor: Colors.surfaceTertiary,
  },
  completeText: {
    fontSize: 17,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.textInverse,
  },
  completeTextDisabled: {
    color: Colors.textTertiary,
  },
});
