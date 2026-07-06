import React, { useMemo, useState, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Platform, Modal } from 'react-native';
import { router, useLocalSearchParams, Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as Sharing from 'expo-sharing';
import { captureRef } from 'react-native-view-shot';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import { useColors } from '@/constants/colors';
import { useAppStore, SetLog, ExerciseCategory } from '@/lib/store';
import { getSessionLabel, getSessionSubtitle } from '@/lib/workout-engine';
import { getExerciseCategoryMap, getExerciseTargetRegionsMap } from '@/lib/exercise-db';
import { BodyDiagram, MUSCLE_SET } from '@/components/BodyDiagram';
import { formatDate, formatWeight, kgToDisplayUnit } from '@/lib/utils';
import WorkoutShareCard, { WorkoutShareCardData } from '@/components/WorkoutShareCard';

const GAIN_GREEN = '#22c55e';
const DROP_AMBER = '#f59e0b';

const WEB_TOP_INSET = 67;
const WEB_BOTTOM_INSET = 34;

const MILESTONE_SESSIONS = [1, 5, 10, 25, 50, 100, 150, 200];

type BadgeKind = 'gain-weight' | 'gain-reps' | 'drop' | 'first' | 'matched' | 'none';

interface ExerciseRow {
  exerciseId: string;
  exerciseName: string;
  category: ExerciseCategory | null;
  isWeighted: boolean;
  bestWeight: number;
  bestReps: number;
  totalReps: number;
  setCount: number;
  badge: BadgeKind;
  deltaWeight: number;
  deltaReps: number;
}

const CATEGORY_LABELS: Record<ExerciseCategory, string> = {
  prep: 'Warm-up',
  mechanical: 'Priming',
  neuro: 'Power',
  main: 'Main Lift',
  accessory: 'Accessory',
  prehab: 'Prehab',
  finisher: 'Finisher',
  cooldown: 'Cooldown',
};

function categoryColors(
  category: ExerciseCategory,
  C: ReturnType<typeof useColors>
): { bg: string; fg: string } {
  switch (category) {
    case 'main':
      return { bg: C.primaryMuted, fg: C.primary };
    case 'mechanical':
      return { bg: C.categoryMechanical, fg: C.categoryMechanicalText };
    case 'neuro':
      return { bg: C.categoryNeuro, fg: C.categoryNeuroText };
    case 'prehab':
      return { bg: C.categoryPrehab, fg: C.categoryPrehabText };
    case 'finisher':
      return { bg: C.categoryFinisher, fg: C.categoryFinisherText };
    case 'cooldown':
      return { bg: C.categoryCooldown, fg: C.categoryCooldownText };
    default:
      return { bg: C.surfaceTertiary, fg: C.textSecondary };
  }
}

function bestCompletedSet(sets: SetLog[]): { weight: number; reps: number } | null {
  const valid = sets.filter((s) => s.completed && !s.skipped && s.weight > 0);
  if (valid.length === 0) return null;
  return valid.reduce(
    (best, s) => {
      if (s.weight > best.weight) return { weight: s.weight, reps: s.reps };
      if (s.weight === best.weight && s.reps > best.reps) return { weight: s.weight, reps: s.reps };
      return best;
    },
    { weight: 0, reps: 0 }
  );
}

export default function SessionSummaryScreen() {
  const C = useColors();
  const insets = useSafeAreaInsets();
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();

  const completedSessions = useAppStore((s) => s.completedSessions);
  const getExerciseHistory = useAppStore((s) => s.getExerciseHistory);
  const userName = useAppStore((s) => s.userProfile?.name);
  const weightUnit = useAppStore((s) => s.weightUnit);
  const getStreakDays = useAppStore((s) => s.getStreakDays);
  const setExerciseFeedback = useAppStore((s) => s.setExerciseFeedback);
  const applyTooEasyAdjustment = useAppStore((s) => s.applyTooEasyAdjustment);
  const oneRepMaxes = useAppStore((s) => s.oneRepMaxes);

  const newlyUnlockedBadges = useAppStore((s) => s.newlyUnlockedBadges);

  const shareCardRef = useRef<View>(null);

  const [showRatingModal, setShowRatingModal] = useState(false);
  const [showTooEasyModal, setShowTooEasyModal] = useState(false);
  const [thumbsRatings, setThumbsRatings] = useState<Record<string, 'up' | 'down'>>({});
  const [tooEasySelected, setTooEasySelected] = useState<Set<string>>(new Set());
  const [tooEasySaved, setTooEasySaved] = useState(false);
  const [isSharing, setIsSharing] = useState(false);

  const session = useMemo(() => {
    if (sessionId) {
      const found = completedSessions.find((s) => s.id === sessionId);
      if (found) return found;
    }
    return completedSessions[0] ?? null;
  }, [completedSessions, sessionId]);

  const categoryMap = useMemo(() => getExerciseCategoryMap(), []);

  const summary = useMemo(() => {
    if (!session) {
      return {
        totalSets: 0,
        totalReps: 0,
        totalVolumeKg: 0,
        rows: [] as ExerciseRow[],
        hasWeighted: false,
      };
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
        const history = getExerciseHistory(log.exerciseId).filter(
          (h) => h.sessionId !== session.id
        );
        let prevBest: { weight: number; reps: number } | null = null;
        for (const h of history) {
          const pb = bestCompletedSet(h.sets);
          if (pb) {
            prevBest = pb;
            break;
          }
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
        category: categoryMap[log.exerciseId] ?? null,
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
  }, [session, getExerciseHistory, categoryMap]);

  const prevSameTypeVol = useMemo(() => {
    if (!session) return 0;
    const prev = completedSessions.find(
      (s) => s.id !== session.id && s.sessionType === session.sessionType
    );
    if (!prev) return 0;
    return prev.exerciseLogs.reduce(
      (sum, log) =>
        sum +
        log.sets
          .filter((s) => s.completed && !s.skipped && s.weight > 0 && s.reps > 0)
          .reduce((s2, set) => s2 + set.weight * set.reps, 0),
      0
    );
  }, [session, completedSessions]);

  const sessionNumber = useMemo(() => {
    if (!session) return 0;
    const idx = completedSessions.findIndex((s) => s.id === session.id);
    return idx >= 0 ? completedSessions.length - idx : 0;
  }, [session, completedSessions]);

  const isMilestone = MILESTONE_SESSIONS.includes(sessionNumber);

  const testWeekOrmData = useMemo(() => {
    if (!session?.isTestWeek) return null;
    const orms = oneRepMaxes
      .filter((o) => o.lift === session.sessionType)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    if (orms.length === 0) return null;
    return { next: orms[0].weight, prev: orms[1]?.weight ?? null };
  }, [session, oneRepMaxes]);

  const newPb = useMemo(() => {
    if (!session) return null;
    const prevBests: Record<string, number> = {};
    for (const s of completedSessions) {
      if (s.id === session.id) continue;
      for (const log of s.exerciseLogs) {
        const max = Math.max(
          0,
          ...log.sets
            .filter((sl) => sl.completed && !sl.skipped && sl.weight > 0)
            .map((sl) => sl.weight)
        );
        if (max > 0) prevBests[log.exerciseId] = Math.max(prevBests[log.exerciseId] ?? 0, max);
      }
    }
    let best: { exerciseName: string; weightKg: number } | null = null;
    for (const log of session.exerciseLogs) {
      const max = Math.max(
        0,
        ...log.sets
          .filter((sl) => sl.completed && !sl.skipped && sl.weight > 0)
          .map((sl) => sl.weight)
      );
      if (max > 0 && max > (prevBests[log.exerciseId] ?? 0)) {
        if (!best || max > best.weightKg) {
          best = { exerciseName: log.exerciseName, weightKg: max };
        }
      }
    }
    return best;
  }, [session, completedSessions]);

  const workedRegions = useMemo(() => {
    if (!session || session.exerciseLogs.length === 0) return null;
    const targetMap = getExerciseTargetRegionsMap();
    const regionSet = new Set<string>();
    for (const log of session.exerciseLogs) {
      for (const r of targetMap[log.exerciseId] ?? []) {
        if (r && MUSCLE_SET.has(r as any)) regionSet.add(r);
      }
    }
    if (regionSet.size === 0) return null;
    const counts: Record<string, number> = {};
    regionSet.forEach((r) => {
      counts[r] = 1;
    });
    return counts as Parameters<typeof BodyDiagram>[0]['heatmapCounts'];
  }, [session]);

  const shareCardData: WorkoutShareCardData | null = useMemo(() => {
    if (!session) return null;
    return {
      sessionLabel: getSessionLabel(session.sessionType),
      sessionSubtitle: getSessionSubtitle(session.sessionType),
      totalVolumeKg: summary.totalVolumeKg,
      totalSets: summary.totalSets,
      durationSeconds: session.durationSeconds ?? 0,
      newPb,
      streakDays: getStreakDays(),
      isTestWeek: !!session.isTestWeek,
      weightUnit,
      newlyUnlockedBadgeIds: newlyUnlockedBadges,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, summary, newPb, weightUnit, newlyUnlockedBadges]);

  const handleShare = useCallback(async () => {
    if (!shareCardData || isSharing) return;
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsSharing(true);
    try {
      if (Platform.OS === 'web') {
        const base64 = await captureRef(shareCardRef, {
          format: 'png',
          quality: 1,
          result: 'base64',
        });
        const dataUrl = `data:image/png;base64,${base64}`;
        const dateStr = new Date().toISOString().split('T')[0];
        const a = document.createElement('a');
        a.href = dataUrl;
        a.download = `grow-workout-${dateStr}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      } else {
        const uri = await captureRef(shareCardRef, {
          format: 'png',
          quality: 1,
          result: 'tmpfile',
        });
        const canShare = await Sharing.isAvailableAsync();
        if (canShare) {
          await Sharing.shareAsync(uri, {
            mimeType: 'image/png',
            dialogTitle: 'Share Your Workout',
          });
        }
      }
    } catch {
    } finally {
      setIsSharing(false);
    }
  }, [shareCardData, isSharing]);

  const submitRatings = useCallback(() => {
    Object.entries(thumbsRatings).forEach(([id, thumbs]) => {
      setExerciseFeedback(id, thumbs);
    });
    setShowRatingModal(false);
  }, [thumbsRatings, setExerciseFeedback]);

  const confirmTooEasy = useCallback(() => {
    if (tooEasySelected.size > 0) {
      applyTooEasyAdjustment(Array.from(tooEasySelected));
      setTooEasySaved(true);
      setTimeout(() => setTooEasySaved(false), 4000);
    }
    setTooEasySelected(new Set());
    setShowTooEasyModal(false);
  }, [tooEasySelected, applyTooEasyAdjustment]);

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
          <Pressable
            onPress={goHome}
            style={[styles.doneButton, { backgroundColor: C.primary, marginTop: 20 }]}
          >
            <Text style={[styles.doneButtonText, { color: C.textInverse }]}>Back to Home</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const durationSeconds = session.durationSeconds ?? 0;
  const durationLabel =
    durationSeconds >= 3600
      ? `${Math.floor(durationSeconds / 3600)}h ${String(Math.floor((durationSeconds % 3600) / 60)).padStart(2, '0')}m`
      : `${Math.floor(durationSeconds / 60)} min`;
  const volumeDisplay = Math.round(
    kgToDisplayUnit(summary.totalVolumeKg, weightUnit)
  ).toLocaleString();
  const exerciseCount = session.exerciseLogs.length;
  const topWeightKg =
    summary.rows.length > 0 ? Math.max(0, ...summary.rows.map((r) => r.bestWeight)) : 0;
  const topWeightDisplay = topWeightKg > 0 ? formatWeight(topWeightKg, weightUnit) : '—';

  const greeting = userName ? `Great work, ${userName}!` : 'Great work!';

  const STRENGTH_TYPES = ['squat', 'bench', 'deadlift'];
  const showVolumeCompare =
    STRENGTH_TYPES.includes(session.sessionType) && summary.totalVolumeKg > 0;

  return (
    <View style={[styles.container, { backgroundColor: C.background }]}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Off-screen share card */}
      {shareCardData && (
        <View style={{ position: 'absolute', left: -9999, top: 0, pointerEvents: 'none' }}>
          <WorkoutShareCard ref={shareCardRef} {...shareCardData} />
        </View>
      )}

      <ScrollView
        contentContainerStyle={{
          paddingTop: topPad + 16,
          paddingBottom: bottomPad + 100,
          paddingHorizontal: 20,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <Animated.View entering={FadeIn.duration(450)} style={styles.header}>
          <View
            style={[
              styles.trophyWrap,
              { backgroundColor: C.trophyBg, borderColor: C.trophyBorder },
            ]}
          >
            <Ionicons
              name={isMilestone ? 'trophy' : 'checkmark-circle'}
              size={40}
              color={C.trophy}
            />
          </View>
          {isMilestone && (
            <View
              style={[
                styles.milestonePill,
                { backgroundColor: C.trophyBg, borderColor: C.trophyBorder },
              ]}
            >
              <Text style={[styles.milestonePillText, { color: C.trophy }]}>
                SESSION {sessionNumber} MILESTONE
              </Text>
            </View>
          )}
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
            <Text style={[styles.statValue, { color: C.text }]}>{exerciseCount}</Text>
            <Text style={[styles.statLabel, { color: C.textSecondary }]}>Exercises</Text>
          </View>
          <View style={[styles.statDivider, { backgroundColor: C.borderLight }]} />
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
          {topWeightKg > 0 && (
            <>
              <View style={[styles.statDivider, { backgroundColor: C.borderLight }]} />
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: C.primary }]}>{topWeightDisplay}</Text>
                <Text style={[styles.statLabel, { color: C.textSecondary }]}>Top Weight</Text>
              </View>
            </>
          )}
          {summary.totalVolumeKg > 0 && (
            <>
              <View style={[styles.statDivider, { backgroundColor: C.borderLight }]} />
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: C.text }]}>{volumeDisplay}</Text>
                <Text style={[styles.statLabel, { color: C.textSecondary }]}>
                  Vol ({weightUnit})
                </Text>
              </View>
            </>
          )}
        </Animated.View>

        {/* Volume comparison */}
        {showVolumeCompare && (
          <Animated.View
            entering={FadeInDown.delay(120).duration(400)}
            style={[styles.compareRow, { backgroundColor: C.surface, borderColor: C.borderLight }]}
          >
            {prevSameTypeVol > 0 ? (
              <>
                <Ionicons
                  name={summary.totalVolumeKg >= prevSameTypeVol ? 'trending-up' : 'trending-down'}
                  size={15}
                  color={summary.totalVolumeKg >= prevSameTypeVol ? C.primary : C.textTertiary}
                />
                <Text
                  style={[
                    styles.compareText,
                    {
                      color: summary.totalVolumeKg > prevSameTypeVol ? C.primary : C.textSecondary,
                    },
                  ]}
                >
                  {summary.totalVolumeKg > prevSameTypeVol
                    ? `↑ ${Math.round(kgToDisplayUnit(summary.totalVolumeKg - prevSameTypeVol, weightUnit)).toLocaleString()} ${weightUnit} more than last ${getSessionLabel(session.sessionType).toLowerCase()}`
                    : summary.totalVolumeKg === prevSameTypeVol
                      ? `Same volume as last ${getSessionLabel(session.sessionType).toLowerCase()}`
                      : `${Math.round(kgToDisplayUnit(prevSameTypeVol - summary.totalVolumeKg, weightUnit)).toLocaleString()} ${weightUnit} less than last ${getSessionLabel(session.sessionType).toLowerCase()}`}
                </Text>
              </>
            ) : (
              <>
                <Ionicons name="star" size={15} color={C.warning ?? '#f59e0b'} />
                <Text style={[styles.compareText, { color: C.textSecondary }]}>
                  First {getSessionLabel(session.sessionType).toLowerCase()} session logged!
                </Text>
              </>
            )}
          </Animated.View>
        )}

        {/* Test week ORM comparison */}
        {testWeekOrmData && (
          <Animated.View
            entering={FadeInDown.delay(140).duration(420)}
            style={[styles.ormCard, { backgroundColor: C.surface, borderColor: C.borderLight }]}
          >
            <Text style={[styles.ormTitle, { color: C.text }]}>
              {getSessionLabel(session.sessionType)} Strength Test
            </Text>
            <View style={styles.ormRow}>
              <View style={styles.ormItem}>
                <Text style={[styles.ormLabel, { color: C.textSecondary }]}>Previous</Text>
                <Text style={[styles.ormValue, { color: C.text }]}>
                  {testWeekOrmData.prev ? formatWeight(testWeekOrmData.prev, weightUnit) : '—'}
                </Text>
              </View>
              <Ionicons name="arrow-forward" size={18} color={C.textTertiary} />
              <View style={styles.ormItem}>
                <Text style={[styles.ormLabel, { color: C.primary }]}>New 1RM</Text>
                <Text style={[styles.ormValue, { color: C.primary }]}>
                  {formatWeight(testWeekOrmData.next, weightUnit)}
                </Text>
              </View>
            </View>
            {testWeekOrmData.prev !== null && testWeekOrmData.next > testWeekOrmData.prev && (
              <View style={[styles.ormPbPill, { backgroundColor: C.trophyBg }]}>
                <Text style={[styles.ormPbText, { color: C.trophy }]}>🏆 New Personal Best!</Text>
              </View>
            )}
          </Animated.View>
        )}

        {/* Too easy saved confirmation */}
        {tooEasySaved && (
          <Animated.View
            entering={FadeIn.duration(300)}
            style={[
              styles.savedBanner,
              { backgroundColor: C.primarySurface, borderColor: C.primaryMuted },
            ]}
          >
            <Ionicons name="checkmark-circle" size={16} color={C.primary} />
            <Text style={[styles.savedText, { color: C.primary }]}>
              Weights adjusted for next session
            </Text>
          </Animated.View>
        )}

        {/* Action buttons row */}
        {session.exerciseLogs.length > 0 && (
          <Animated.View entering={FadeInDown.delay(160).duration(420)} style={styles.actionRow}>
            <Pressable
              onPress={() => {
                if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setShowRatingModal(true);
              }}
              style={[styles.actionBtn, { backgroundColor: C.surface, borderColor: C.borderLight }]}
              testID="open-rate-modal"
            >
              <Ionicons name="thumbs-up-outline" size={18} color={C.primary} />
              <Text style={[styles.actionBtnText, { color: C.text }]}>Rate</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setShowTooEasyModal(true);
              }}
              style={[styles.actionBtn, { backgroundColor: C.surface, borderColor: C.borderLight }]}
              testID="open-too-easy-modal"
            >
              <Ionicons name="trending-up-outline" size={18} color={C.primary} />
              <Text style={[styles.actionBtnText, { color: C.text }]}>Too Easy?</Text>
            </Pressable>
            <Pressable
              onPress={handleShare}
              disabled={isSharing}
              style={[
                styles.actionBtn,
                { backgroundColor: C.surface, borderColor: C.borderLight },
                isSharing && { opacity: 0.5 },
              ]}
              testID="share-workout"
            >
              <Ionicons name="share-outline" size={18} color={C.primary} />
              <Text style={[styles.actionBtnText, { color: C.text }]}>
                {isSharing ? '…' : 'Share'}
              </Text>
            </Pressable>
          </Animated.View>
        )}

        {/* Muscles worked heatmap */}
        {workedRegions && (
          <Animated.View
            entering={FadeInDown.delay(180).duration(420)}
            style={[styles.bodyCard, { backgroundColor: C.surface, borderColor: C.borderLight }]}
          >
            <Text style={[styles.sectionTitle, { color: C.text }]}>Muscles Worked</Text>
            <BodyDiagram
              selected={undefined}
              onSelect={() => {}}
              heatmapCounts={workedRegions}
              maxWidth={130}
            />
          </Animated.View>
        )}

        {/* Exercise breakdown */}
        {summary.hasWeighted ? (
          <>
            <Text style={[styles.sectionTitle, { color: C.text }]}>Your lifts vs last time</Text>
            {summary.rows.map((row, i) => {
              const pill = row.category ? categoryColors(row.category, C) : null;
              return (
                <Animated.View
                  key={row.exerciseId + i}
                  entering={FadeInDown.delay(200 + i * 60).duration(420)}
                  style={[
                    styles.exerciseCard,
                    { backgroundColor: C.surface, borderColor: C.borderLight },
                  ]}
                >
                  <View style={styles.exerciseLeft}>
                    <Text style={[styles.exerciseName, { color: C.text }]} numberOfLines={2}>
                      {row.exerciseName}
                    </Text>
                    {pill && row.category && (
                      <View style={[styles.categoryPill, { backgroundColor: pill.bg }]}>
                        <Text style={[styles.categoryPillText, { color: pill.fg }]}>
                          {CATEGORY_LABELS[row.category]}
                        </Text>
                      </View>
                    )}
                    <Text style={[styles.exerciseMeta, { color: C.textSecondary }]}>
                      {row.isWeighted
                        ? `${formatWeight(row.bestWeight, weightUnit)} × ${row.bestReps} · ${row.setCount} ${row.setCount === 1 ? 'set' : 'sets'}`
                        : `${row.totalReps} reps · ${row.setCount} ${row.setCount === 1 ? 'set' : 'sets'}`}
                    </Text>
                  </View>
                  <ExerciseBadge row={row} weightUnit={weightUnit} C={C} />
                </Animated.View>
              );
            })}
          </>
        ) : (
          <Animated.View
            entering={FadeInDown.delay(200).duration(420)}
            style={[
              styles.exerciseCard,
              { backgroundColor: C.surface, borderColor: C.borderLight, justifyContent: 'center' },
            ]}
          >
            <Ionicons name="leaf-outline" size={20} color={C.textTertiary} />
            <Text style={[styles.exerciseMeta, { color: C.textSecondary, marginLeft: 10 }]}>
              No weighted exercises this session.
            </Text>
          </Animated.View>
        )}
      </ScrollView>

      {/* Done button pinned to bottom */}
      <View
        style={[
          styles.footer,
          {
            paddingBottom: bottomPad + 14,
            backgroundColor: C.background,
            borderTopColor: C.borderLight,
          },
        ]}
      >
        <Pressable
          onPress={goHome}
          style={[styles.doneButton, { backgroundColor: C.primary }]}
          testID="summary-done"
        >
          <Text style={[styles.doneButtonText, { color: C.textInverse }]}>Done</Text>
        </Pressable>
      </View>

      {/* Rate Exercises Modal */}
      <Modal
        visible={showRatingModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowRatingModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { backgroundColor: C.surface }]}>
            <View style={[styles.modalHeader, { borderBottomColor: C.borderLight }]}>
              <View style={[styles.modalIconWrap, { backgroundColor: C.primaryMuted }]}>
                <Ionicons name="thumbs-up-outline" size={24} color={C.primary} />
              </View>
              <View style={styles.modalHeaderText}>
                <Text style={[styles.modalTitle, { color: C.text }]}>Rate Exercises</Text>
                <Text style={[styles.modalSubtitle, { color: C.textSecondary }]}>
                  How did each exercise feel?
                </Text>
              </View>
            </View>
            <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
              {session.exerciseLogs.map((log) => (
                <View
                  key={log.exerciseId}
                  style={[styles.ratingRow, { borderBottomColor: C.borderLight }]}
                >
                  <Text style={[styles.ratingName, { color: C.text }]} numberOfLines={2}>
                    {log.exerciseName}
                  </Text>
                  <View style={styles.ratingButtons}>
                    <Pressable
                      onPress={() =>
                        setThumbsRatings((prev) => ({ ...prev, [log.exerciseId]: 'up' }))
                      }
                      style={[
                        styles.thumbBtn,
                        { backgroundColor: C.surfaceTertiary, borderColor: C.border },
                        thumbsRatings[log.exerciseId] === 'up' && {
                          backgroundColor: C.primary,
                          borderColor: C.primary,
                        },
                      ]}
                      testID={`thumb-up-${log.exerciseId}`}
                    >
                      <Ionicons
                        name="thumbs-up"
                        size={18}
                        color={
                          thumbsRatings[log.exerciseId] === 'up' ? C.textInverse : C.textSecondary
                        }
                      />
                    </Pressable>
                    <Pressable
                      onPress={() =>
                        setThumbsRatings((prev) => ({ ...prev, [log.exerciseId]: 'down' }))
                      }
                      style={[
                        styles.thumbBtn,
                        { backgroundColor: C.surfaceTertiary, borderColor: C.border },
                        thumbsRatings[log.exerciseId] === 'down' && {
                          backgroundColor: C.categoryFinisherText,
                          borderColor: C.categoryFinisherText,
                        },
                      ]}
                      testID={`thumb-down-${log.exerciseId}`}
                    >
                      <Ionicons
                        name="thumbs-down"
                        size={18}
                        color={
                          thumbsRatings[log.exerciseId] === 'down' ? C.textInverse : C.textSecondary
                        }
                      />
                    </Pressable>
                  </View>
                </View>
              ))}
              <View style={{ height: 16 }} />
            </ScrollView>
            <View
              style={[
                styles.modalFooter,
                { borderTopColor: C.borderLight, paddingBottom: bottomPad + 16 },
              ]}
            >
              <Pressable
                onPress={submitRatings}
                style={[styles.modalPrimaryBtn, { backgroundColor: C.primary }]}
                testID="submit-ratings"
              >
                <Text style={[styles.modalPrimaryBtnText, { color: C.textInverse }]}>
                  Submit Ratings
                </Text>
              </Pressable>
              <Pressable onPress={() => setShowRatingModal(false)} style={styles.modalSkipBtn}>
                <Text style={[styles.modalSkipText, { color: C.textSecondary }]}>Skip</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Too Easy Modal */}
      <Modal
        visible={showTooEasyModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowTooEasyModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { backgroundColor: C.surface }]}>
            <View style={[styles.modalHeader, { borderBottomColor: C.borderLight }]}>
              <View style={[styles.modalIconWrap, { backgroundColor: C.categoryPrehab }]}>
                <Ionicons name="trending-up-outline" size={24} color={C.categoryPrehabText} />
              </View>
              <View style={styles.modalHeaderText}>
                <Text style={[styles.modalTitle, { color: C.text }]}>Too Easy?</Text>
                <Text style={[styles.modalSubtitle, { color: C.textSecondary }]}>
                  Select exercises to increase next session
                </Text>
              </View>
            </View>
            <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
              {session.exerciseLogs.map((log) => {
                const selected = tooEasySelected.has(log.exerciseId);
                return (
                  <Pressable
                    key={log.exerciseId}
                    onPress={() => {
                      setTooEasySelected((prev) => {
                        const next = new Set(prev);
                        if (next.has(log.exerciseId)) next.delete(log.exerciseId);
                        else next.add(log.exerciseId);
                        return next;
                      });
                    }}
                    style={[
                      styles.checkRow,
                      { borderBottomColor: C.borderLight },
                      selected && { backgroundColor: C.primarySurface },
                    ]}
                    testID={`tooEasy-${log.exerciseId}`}
                  >
                    <View
                      style={[
                        styles.checkbox,
                        { borderColor: selected ? C.primary : C.border },
                        selected && { backgroundColor: C.primary },
                      ]}
                    >
                      {selected && <Ionicons name="checkmark" size={13} color={C.textInverse} />}
                    </View>
                    <Text
                      style={[styles.checkName, { color: selected ? C.primaryDark : C.text }]}
                      numberOfLines={2}
                    >
                      {log.exerciseName}
                    </Text>
                  </Pressable>
                );
              })}
              <View style={{ height: 16 }} />
            </ScrollView>
            <View
              style={[
                styles.modalFooter,
                { borderTopColor: C.borderLight, paddingBottom: bottomPad + 16 },
              ]}
            >
              <Pressable
                onPress={confirmTooEasy}
                style={[
                  styles.modalPrimaryBtn,
                  { backgroundColor: tooEasySelected.size > 0 ? C.primary : C.surfaceTertiary },
                ]}
                testID="confirm-too-easy"
              >
                <Text
                  style={[
                    styles.modalPrimaryBtnText,
                    { color: tooEasySelected.size > 0 ? C.textInverse : C.textTertiary },
                  ]}
                >
                  {tooEasySelected.size > 0
                    ? `Increase ${tooEasySelected.size} exercise${tooEasySelected.size > 1 ? 's' : ''}`
                    : 'Confirm'}
                </Text>
              </Pressable>
              <Pressable onPress={() => setShowTooEasyModal(false)} style={styles.modalSkipBtn}>
                <Text style={[styles.modalSkipText, { color: C.textSecondary }]}>Skip</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function ExerciseBadge({
  row,
  weightUnit,
  C,
}: {
  row: ExerciseRow;
  weightUnit: 'kg' | 'lbs';
  C: ReturnType<typeof useColors>;
}) {
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
        <Text style={[styles.badgeText, { color: GAIN_GREEN }]}>
          +{delta} {weightUnit}
        </Text>
      </View>
    );
  }

  if (row.badge === 'gain-reps') {
    return (
      <View style={[styles.badge, { backgroundColor: GAIN_GREEN + '1f' }]}>
        <Ionicons name="trending-up" size={13} color={GAIN_GREEN} />
        <Text style={[styles.badgeText, { color: GAIN_GREEN }]}>
          +{row.deltaReps} {row.deltaReps === 1 ? 'rep' : 'reps'}
        </Text>
      </View>
    );
  }

  if (row.badge === 'drop') {
    const delta = Math.round(kgToDisplayUnit(row.deltaWeight, weightUnit) * 10) / 10;
    return (
      <View style={[styles.badge, { backgroundColor: DROP_AMBER + '1f' }]}>
        <Ionicons name="refresh-outline" size={13} color={DROP_AMBER} />
        <Text style={[styles.badgeText, { color: DROP_AMBER }]}>
          -{delta} {weightUnit}
        </Text>
      </View>
    );
  }

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
    marginBottom: 10,
  },
  milestonePill: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 8,
  },
  milestonePillText: {
    fontSize: 10,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 1,
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
    marginBottom: 12,
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
  compareRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 12,
  },
  compareText: {
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
    flex: 1,
  },
  ormCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    marginBottom: 12,
  },
  ormTitle: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    marginBottom: 12,
  },
  ormRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    marginBottom: 10,
  },
  ormItem: {
    alignItems: 'center',
  },
  ormLabel: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
    marginBottom: 4,
  },
  ormValue: {
    fontSize: 22,
    fontFamily: 'Inter_700Bold',
  },
  ormPbPill: {
    alignSelf: 'center',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
  },
  ormPbText: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
  },
  savedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 12,
  },
  savedText: {
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 12,
  },
  actionBtnText: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
    marginBottom: 12,
  },
  bodyCard: {
    borderRadius: 16,
    borderWidth: 1,
    paddingTop: 16,
    paddingHorizontal: 8,
    paddingBottom: 8,
    marginBottom: 16,
    alignItems: 'center' as const,
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
  categoryPill: {
    alignSelf: 'flex-start',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginTop: 5,
  },
  categoryPillText: {
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
  },
  exerciseMeta: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    marginTop: 5,
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
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 18,
    borderBottomWidth: 1,
  },
  modalIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalHeaderText: {
    flex: 1,
  },
  modalTitle: {
    fontSize: 17,
    fontFamily: 'Inter_700Bold',
  },
  modalSubtitle: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    marginTop: 2,
  },
  modalScroll: {
    maxHeight: 360,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    gap: 12,
  },
  ratingName: {
    flex: 1,
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
  },
  ratingButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  thumbBtn: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    gap: 12,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  checkName: {
    flex: 1,
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
  },
  modalFooter: {
    paddingHorizontal: 20,
    paddingTop: 14,
    borderTopWidth: 1,
    gap: 4,
  },
  modalPrimaryBtn: {
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
  },
  modalPrimaryBtnText: {
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
  },
  modalSkipBtn: {
    paddingVertical: 10,
    alignItems: 'center',
  },
  modalSkipText: {
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
  },
});
