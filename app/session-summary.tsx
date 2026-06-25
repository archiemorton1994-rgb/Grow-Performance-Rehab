import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Platform,
} from 'react-native';
import { router, useLocalSearchParams, Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import { useColors } from '@/constants/colors';
import { useAppStore, SetLog } from '@/lib/store';
import { getSessionLabel } from '@/lib/workout-engine';
import { formatDate, formatWeight, kgToDisplayUnit } from '@/lib/utils';

const GAIN_GREEN = '#22c55e';
const DROP_AMBER = '#f59e0b';

const WEB_TOP_INSET = 67;
const WEB_BOTTOM_INSET = 34;

type BadgeKind = 'gain-weight' | 'gain-reps' | 'drop' | 'first' | 'matched' | 'none';

interface ExerciseRow {
  exerciseId: string;
  exerciseName: string;
  isWeighted: boolean;
  bestWeight: number;
  bestReps: number;
  totalReps: number;
  setCount: number;
  badge: BadgeKind;
  deltaWeight: number;
  deltaReps: number;
}

/** Best completed working set: highest weight, ties broken by most reps. */
function bestCompletedSet(sets: SetLog[]): { weight: number; reps: number } | null {
  const valid = sets.filter((s) => s.completed && !s.skipped && s.weight > 0);
  if (valid.length === 0) return null;
  return valid.reduce((best, s) => {
    if (s.weight > best.weight) return { weight: s.weight, reps: s.reps };
    if (s.weight === best.weight && s.reps > best.reps) return { weight: s.weight, reps: s.reps };
    return best;
  }, { weight: 0, reps: 0 });
}

export default function SessionSummaryScreen() {
  const C = useColors();
  const insets = useSafeAreaInsets();
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();

  const completedSessions = useAppStore((s) => s.completedSessions);
  const getExerciseHistory = useAppStore((s) => s.getExerciseHistory);
  const userName = useAppStore((s) => s.userProfile?.name);
  const weightUnit = useAppStore((s) => s.weightUnit);

  const session = useMemo(() => {
    if (sessionId) {
      const found = completedSessions.find((s) => s.id === sessionId);
      if (found) return found;
    }
    return completedSessions[0] ?? null;
  }, [completedSessions, sessionId]);

  const summary = useMemo(() => {
    if (!session) {
      return { totalSets: 0, totalReps: 0, totalVolumeKg: 0, rows: [] as ExerciseRow[], hasWeighted: false };
    }

    let totalSets = 0;
    let totalReps = 0;
    let totalVolumeKg = 0;
    const rows: ExerciseRow[] = [];

    for (const log of session.exerciseLogs) {
      const completedSets = log.sets.filter((s) => s.completed && !s.skipped);
      if (completedSets.length === 0) continue;

      const setCount = completedSets.length;
      const repsSum = completedSets.reduce((sum, s) => sum + (s.reps || 0), 0);
      totalSets += setCount;
      totalReps += repsSum;

      const thisBest = bestCompletedSet(log.sets);
      const isWeighted = thisBest !== null;

      if (isWeighted) {
        for (const s of completedSets) {
          if (s.weight > 0 && s.reps > 0) totalVolumeKg += s.weight * s.reps;
        }
      }

      let badge: BadgeKind = isWeighted ? 'first' : 'none';
      let deltaWeight = 0;
      let deltaReps = 0;

      if (isWeighted && thisBest) {
        // Find the most recent PRIOR appearance of this exercise (exclude this session)
        const history = getExerciseHistory(log.exerciseId)
          .filter((h) => h.sessionId !== session.id);
        let prevBest: { weight: number; reps: number } | null = null;
        for (const h of history) {
          const pb = bestCompletedSet(h.sets);
          if (pb) { prevBest = pb; break; }
        }

        if (!prevBest) {
          badge = 'first';
        } else if (thisBest.weight > prevBest.weight) {
          badge = 'gain-weight';
          deltaWeight = thisBest.weight - prevBest.weight;
        } else if (thisBest.weight === prevBest.weight && thisBest.reps > prevBest.reps) {
          badge = 'gain-reps';
          deltaReps = thisBest.reps - prevBest.reps;
        } else if (thisBest.weight < prevBest.weight) {
          badge = 'drop';
          deltaWeight = prevBest.weight - thisBest.weight;
        } else {
          badge = 'matched';
        }
      }

      rows.push({
        exerciseId: log.exerciseId,
        exerciseName: log.exerciseName,
        isWeighted,
        bestWeight: thisBest?.weight ?? 0,
        bestReps: thisBest?.reps ?? 0,
        totalReps: repsSum,
        setCount,
        badge,
        deltaWeight,
        deltaReps,
      });
    }

    const hasWeighted = rows.some((r) => r.isWeighted);
    return { totalSets, totalReps, totalVolumeKg, rows, hasWeighted };
  }, [session, getExerciseHistory]);

  const goHome = () => {
    router.dismissAll();
    router.replace('/(tabs)');
  };

  const topPad = Platform.OS === 'web' ? WEB_TOP_INSET : insets.top;
  const bottomPad = Platform.OS === 'web' ? WEB_BOTTOM_INSET : insets.bottom;

  if (!session) {
    return (
      <View style={[styles.container, { backgroundColor: C.background, paddingTop: topPad + 24 }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.emptyWrap}>
          <Ionicons name="document-outline" size={40} color={C.textTertiary} />
          <Text style={[styles.emptyText, { color: C.textSecondary }]}>No session found.</Text>
          <Pressable onPress={goHome} style={[styles.doneButton, { backgroundColor: C.primary, marginTop: 20 }]}>
            <Text style={[styles.doneButtonText, { color: C.textInverse }]}>Back to Home</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const durationSeconds = session.durationSeconds ?? 0;
  const durationLabel = durationSeconds >= 3600
    ? `${Math.floor(durationSeconds / 3600)}h ${String(Math.floor((durationSeconds % 3600) / 60)).padStart(2, '0')}m`
    : `${Math.floor(durationSeconds / 60)} min`;
  const volumeDisplay = Math.round(kgToDisplayUnit(summary.totalVolumeKg, weightUnit)).toLocaleString();

  const greeting = userName ? `Great work, ${userName}!` : 'Great work!';

  return (
    <View style={[styles.container, { backgroundColor: C.background }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView
        contentContainerStyle={{ paddingTop: topPad + 16, paddingBottom: bottomPad + 100, paddingHorizontal: 20 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <Animated.View entering={FadeIn.duration(450)} style={styles.header}>
          <View style={[styles.trophyWrap, { backgroundColor: C.trophyBg, borderColor: C.trophyBorder }]}>
            <Ionicons name="trophy" size={40} color={C.trophy} />
          </View>
          <Text style={[styles.headline, { color: C.text }]}>{greeting}</Text>
          <Text style={[styles.subhead, { color: C.textSecondary }]}>
            {getSessionLabel(session.sessionType)} · {formatDate(session.date)}
          </Text>
        </Animated.View>

        {/* Stats row */}
        <Animated.View
          entering={FadeInDown.delay(80).duration(450)}
          style={[styles.statsCard, { backgroundColor: C.surface, borderColor: C.borderLight }]}
        >
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: C.text }]}>{durationLabel}</Text>
            <Text style={[styles.statLabel, { color: C.textSecondary }]}>Duration</Text>
          </View>
          <View style={[styles.statDivider, { backgroundColor: C.borderLight }]} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: C.text }]}>{summary.totalSets}</Text>
            <Text style={[styles.statLabel, { color: C.textSecondary }]}>Sets</Text>
          </View>
          <View style={[styles.statDivider, { backgroundColor: C.borderLight }]} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: C.text }]}>{summary.totalReps}</Text>
            <Text style={[styles.statLabel, { color: C.textSecondary }]}>Reps</Text>
          </View>
          {summary.hasWeighted && (
            <>
              <View style={[styles.statDivider, { backgroundColor: C.borderLight }]} />
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: C.text }]}>{volumeDisplay}</Text>
                <Text style={[styles.statLabel, { color: C.textSecondary }]}>Vol ({weightUnit})</Text>
              </View>
            </>
          )}
        </Animated.View>

        {/* Exercise breakdown */}
        {summary.rows.length > 0 ? (
          <>
            <Text style={[styles.sectionTitle, { color: C.text }]}>
              {summary.hasWeighted ? 'Your lifts vs last time' : 'This session'}
            </Text>
            {summary.rows.map((row, i) => (
              <Animated.View
                key={row.exerciseId + i}
                entering={FadeInDown.delay(140 + i * 60).duration(420)}
                style={[styles.exerciseCard, { backgroundColor: C.surface, borderColor: C.borderLight }]}
              >
                <View style={styles.exerciseLeft}>
                  <Text style={[styles.exerciseName, { color: C.text }]} numberOfLines={2}>
                    {row.exerciseName}
                  </Text>
                  <Text style={[styles.exerciseMeta, { color: C.textSecondary }]}>
                    {row.isWeighted
                      ? `${formatWeight(row.bestWeight, weightUnit)} × ${row.bestReps} · ${row.setCount} ${row.setCount === 1 ? 'set' : 'sets'}`
                      : `${row.totalReps} reps · ${row.setCount} ${row.setCount === 1 ? 'set' : 'sets'}`}
                  </Text>
                </View>
                <Badge row={row} weightUnit={weightUnit} C={C} />
              </Animated.View>
            ))}
          </>
        ) : (
          <Animated.View
            entering={FadeInDown.delay(140).duration(420)}
            style={[styles.exerciseCard, { backgroundColor: C.surface, borderColor: C.borderLight, justifyContent: 'center' }]}
          >
            <Ionicons name="leaf-outline" size={20} color={C.textTertiary} />
            <Text style={[styles.exerciseMeta, { color: C.textSecondary, marginLeft: 10 }]}>
              No weighted exercises this session.
            </Text>
          </Animated.View>
        )}
      </ScrollView>

      {/* Done button pinned to bottom */}
      <View style={[styles.footer, { paddingBottom: bottomPad + 14, backgroundColor: C.background, borderTopColor: C.borderLight }]}>
        <Pressable
          onPress={goHome}
          style={[styles.doneButton, { backgroundColor: C.primary }]}
          testID="summary-done"
        >
          <Text style={[styles.doneButtonText, { color: C.textInverse }]}>Done</Text>
        </Pressable>
      </View>
    </View>
  );
}

function Badge({ row, weightUnit, C }: { row: ExerciseRow; weightUnit: 'kg' | 'lbs'; C: ReturnType<typeof useColors> }) {
  if (row.badge === 'none') {
    return (
      <View style={[styles.badge, { backgroundColor: C.surfaceTertiary }]}>
        <Ionicons name="body-outline" size={13} color={C.textSecondary} />
        <Text style={[styles.badgeText, { color: C.textSecondary }]}>Bodyweight</Text>
      </View>
    );
  }

  if (row.badge === 'first') {
    return (
      <View style={[styles.badge, { backgroundColor: C.surfaceTertiary }]}>
        <Ionicons name="sparkles-outline" size={13} color={C.textSecondary} />
        <Text style={[styles.badgeText, { color: C.textSecondary }]}>First time</Text>
      </View>
    );
  }

  if (row.badge === 'gain-weight') {
    const delta = Math.round(kgToDisplayUnit(row.deltaWeight, weightUnit) * 10) / 10;
    return (
      <View style={[styles.badge, { backgroundColor: GAIN_GREEN + '1f' }]}>
        <Ionicons name="trending-up" size={13} color={GAIN_GREEN} />
        <Text style={[styles.badgeText, { color: GAIN_GREEN }]}>+{delta} {weightUnit}</Text>
      </View>
    );
  }

  if (row.badge === 'gain-reps') {
    return (
      <View style={[styles.badge, { backgroundColor: GAIN_GREEN + '1f' }]}>
        <Ionicons name="trending-up" size={13} color={GAIN_GREEN} />
        <Text style={[styles.badgeText, { color: GAIN_GREEN }]}>+{row.deltaReps} {row.deltaReps === 1 ? 'rep' : 'reps'}</Text>
      </View>
    );
  }

  if (row.badge === 'drop') {
    const delta = Math.round(kgToDisplayUnit(row.deltaWeight, weightUnit) * 10) / 10;
    return (
      <View style={[styles.badge, { backgroundColor: DROP_AMBER + '1f' }]}>
        <Ionicons name="refresh-outline" size={13} color={DROP_AMBER} />
        <Text style={[styles.badgeText, { color: DROP_AMBER }]}>-{delta} {weightUnit}</Text>
      </View>
    );
  }

  // matched
  return (
    <View style={[styles.badge, { backgroundColor: C.surfaceTertiary }]}>
      <Ionicons name="remove-outline" size={13} color={C.textSecondary} />
      <Text style={[styles.badgeText, { color: C.textSecondary }]}>Matched</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    alignItems: 'center',
    marginBottom: 20,
  },
  trophyWrap: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    marginBottom: 14,
  },
  headline: {
    fontSize: 24,
    fontFamily: 'Inter_700Bold',
    textAlign: 'center',
  },
  subhead: {
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
    marginTop: 4,
    textAlign: 'center',
  },
  statsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: 18,
    paddingHorizontal: 8,
    marginBottom: 24,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 19,
    fontFamily: 'Inter_700Bold',
  },
  statLabel: {
    fontSize: 11,
    fontFamily: 'Inter_500Medium',
    marginTop: 3,
  },
  statDivider: {
    width: 1,
    height: 32,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
    marginBottom: 12,
  },
  exerciseCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 10,
    minHeight: 64,
  },
  exerciseLeft: {
    flex: 1,
    paddingRight: 12,
  },
  exerciseName: {
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
  },
  exerciseMeta: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    marginTop: 3,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  badgeText: {
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
  },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 20,
    paddingTop: 14,
    borderTopWidth: 1,
  },
  doneButton: {
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  doneButtonText: {
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
  },
  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  emptyText: {
    fontSize: 15,
    fontFamily: 'Inter_500Medium',
  },
});
