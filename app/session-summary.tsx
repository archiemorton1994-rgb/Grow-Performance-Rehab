import React, { useMemo, useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Platform,
  Modal,
  Alert,
  Image,
  TextInput,
  useWindowDimensions,
} from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { router, useLocalSearchParams, Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
// expo-sharing, expo-media-library, and react-native-view-shot are loaded
// lazily inside the functions that use them. Static top-level imports of these
// native modules crash module evaluation in Expo Go (SDK 54), which causes
// Expo Router to report a missing default export and route the screen to +not-found.
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import { useColors, DarkColors, AppColors } from '@/constants/colors';
import { useAppStore, SetLog, ExerciseCategory, PainRegion, SessionType } from '@/lib/store';
import { getSessionLabel } from '@/lib/workout-engine';
import {
  getExerciseCategoryMap,
  getExerciseTargetRegionsMap,
  getRegionsByExerciseNameMap,
} from '@/lib/exercise-db';
import { MILESTONE_SESSION_THRESHOLDS } from '@/lib/badges';
import { BodyDiagram, MUSCLE_SET, PANEL_BG } from '@/components/BodyDiagram';
import { formatDate, formatWeight, kgToDisplayUnit } from '@/lib/utils';

const WEB_TOP_INSET = 67;
const WEB_BOTTOM_INSET = 34;

// Certificate palette (fixed regardless of device theme so the shareable card
// always looks the same). Iron-and-chalk dark palette, not a light parchment
// certificate - the card is meant to feel like a win worth showing off, not a
// diploma. PANEL_BG matches the dark panel already used behind the body
// diagram elsewhere in the app, so this doesn't introduce a new near-black.
const OUTER_BG = PANEL_BG; // '#0d0d0d' - screen background around the card
const CARD_BG = '#161613'; // the card itself
const PILL_BG = '#1b1b17'; // sub-panels inside the card (hero, stats, map)
const CARD_TEXT = '#f4f2ec'; // warm off-white ink
const CARD_MUTED = '#a8a49a'; // warm grey - secondary text
const CARD_FAINT = '#726e64'; // warm dark grey - tertiary text, labels
const CARD_HAIRLINE = '#2b2a26'; // warm dark divider
const GOLD = '#fbbf24';
const ACCENT_GREEN = '#4ade80'; // bright accent for text/glow sitting directly on the dark card

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

const SESSION_TYPE_FALLBACK_REGIONS: Partial<Record<string, PainRegion[]>> = {
  squat: ['quads', 'glutes', 'hamstrings', 'knee', 'hip_groin'],
  bench: ['chest', 'tricep', 'front_shoulder'],
  deadlift: ['lower_back', 'hamstrings', 'glutes', 'lat_mid_back'],
  conditioning: ['core_ribs', 'quads', 'hamstrings'],
  prehab: ['hip_groin', 'lower_back', 'core_ribs'],
  flexibility: [],
  custom: [],
};

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

const BADGE_META: Record<
  BadgeKind,
  { label: (r: ExerciseRow) => string; icon: string; tone: 'up' | 'down' | 'neutral' | 'first' }
> = {
  'gain-weight': {
    label: (r) => `+${r.deltaWeight} kg vs last time`,
    icon: 'trending-up',
    tone: 'up',
  },
  'gain-reps': {
    label: (r) => `+${r.deltaReps} rep${r.deltaReps === 1 ? '' : 's'} at the same weight`,
    icon: 'trending-up',
    tone: 'up',
  },
  drop: {
    label: (r) => `${r.deltaWeight} kg lighter than last time`,
    icon: 'trending-down',
    tone: 'down',
  },
  first: { label: () => 'First time logging this', icon: 'sparkles', tone: 'first' },
  matched: { label: () => 'Matched your last result', icon: 'remove', tone: 'neutral' },
  none: { label: () => 'Completed', icon: 'checkmark', tone: 'neutral' },
};

/**
 * "Here's what changed" view — makes the progression engine's decisions
 * visible instead of invisible. The badge/delta data here already existed
 * (computed for the certificate's PB count) but was never shown per exercise,
 * so a real effect ("your feedback moved this exercise's weight") had no way
 * to be perceived. Doesn't recompute anything — just surfaces what completing
 * this session and rating it already decided for next time.
 */
function ProgressTab({
  C,
  rows,
  sessionType,
  hasWeighted,
  onOpenRating,
}: {
  C: AppColors;
  rows: ExerciseRow[];
  sessionType: SessionType;
  hasWeighted: boolean;
  onOpenRating: () => void;
}) {
  const weighted = rows.filter((r) => r.isWeighted);
  const toneColor: Record<'up' | 'down' | 'neutral' | 'first', string> = {
    up: C.success,
    down: C.warning,
    neutral: C.textTertiary,
    first: C.primary,
  };
  const isRecoverySession = sessionType === 'prehab' || sessionType === 'flexibility';

  return (
    <Animated.View
      entering={FadeIn.duration(350)}
      style={{ backgroundColor: C.surface, borderRadius: 20, borderWidth: 1, borderColor: C.border }}
    >
      <View style={{ padding: 20, gap: 4 }}>
        <Text style={{ fontSize: 17, fontFamily: 'Inter_700Bold', color: C.text }}>
          What this session changed
        </Text>
        <Text
          style={{
            fontSize: 13,
            fontFamily: 'Inter_400Regular',
            color: C.textSecondary,
            lineHeight: 19,
          }}
        >
          Every set you complete, and how you rate it, decides the weight the app suggests next
          time you do this exercise. This is that decision, made visible.
        </Text>
      </View>

      {!hasWeighted ? (
        <View style={{ paddingHorizontal: 20, paddingBottom: 20 }}>
          <Text style={{ fontSize: 14, fontFamily: 'Inter_400Regular', color: C.textSecondary }}>
            {isRecoverySession
              ? "Recovery sessions don't load exercises, so there's nothing to compare here. This one's about the reps and holds, not the numbers."
              : "No weighted sets logged this session, so there's nothing to compare yet."}
          </Text>
        </View>
      ) : (
        <View style={{ paddingHorizontal: 12, paddingBottom: 8 }}>
          {weighted.map((r) => {
            const meta = BADGE_META[r.badge];
            return (
              <View
                key={r.exerciseId}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 12,
                  paddingHorizontal: 8,
                  paddingVertical: 12,
                  borderTopWidth: 1,
                  borderTopColor: C.borderLight,
                }}
              >
                <View
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 17,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: toneColor[meta.tone] + '1a',
                  }}
                >
                  <Ionicons name={meta.icon as any} size={16} color={toneColor[meta.tone]} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text
                    style={{ fontSize: 14, fontFamily: 'Inter_600SemiBold', color: C.text }}
                    numberOfLines={1}
                  >
                    {r.exerciseName}
                  </Text>
                  <Text
                    style={{
                      fontSize: 12,
                      fontFamily: 'Inter_400Regular',
                      color: toneColor[meta.tone],
                      marginTop: 1,
                    }}
                  >
                    {meta.label(r)}
                  </Text>
                </View>
                <Text style={{ fontSize: 13, fontFamily: 'Inter_600SemiBold', color: C.textTertiary }}>
                  {r.bestWeight > 0 ? `${r.bestWeight} kg` : ''}
                </Text>
              </View>
            );
          })}
        </View>
      )}

      <Pressable
        onPress={onOpenRating}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          paddingVertical: 14,
          borderTopWidth: 1,
          borderTopColor: C.borderLight,
        }}
        testID="progress-tab-rate"
      >
        <Ionicons name="thumbs-up-outline" size={15} color={C.primary} />
        <Text style={{ fontSize: 13, fontFamily: 'Inter_600SemiBold', color: C.primary }}>
          Didn&apos;t feel right? Rate your exercises
        </Text>
      </Pressable>
    </Animated.View>
  );
}

export default function SessionSummaryScreen() {
  const C = useColors();
  const insets = useSafeAreaInsets();
  const { height: screenHeight } = useWindowDimensions();
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();

  const completedSessions = useAppStore((s) => s.completedSessions);
  const getExerciseHistory = useAppStore((s) => s.getExerciseHistory);
  const weightUnit = useAppStore((s) => s.weightUnit);
  const getStreakDays = useAppStore((s) => s.getStreakDays);
  const setExerciseFeedback = useAppStore((s) => s.setExerciseFeedback);
  const updateSessionNotes = useAppStore((s) => s.updateSessionNotes);

  const certRef = useRef<View>(null);

  const [activeTab, setActiveTab] = useState<'summary' | 'progress'>('summary');
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [thumbsRatings, setThumbsRatings] = useState<Record<string, 'up' | 'down'>>({});
  const [isSharing, setIsSharing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveConfirmed, setSaveConfirmed] = useState(false);
  const [sessionNotes, setSessionNotes] = useState('');

  const session = useMemo(() => {
    if (sessionId) {
      const found = completedSessions.find((s) => s.id === sessionId);
      if (found) return found;
    }
    return completedSessions[0] ?? null;
  }, [completedSessions, sessionId]);

  useEffect(() => {
    setSessionNotes(session?.notes ?? '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.id]);

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

  const sessionNumber = useMemo(() => {
    if (!session) return 0;
    const idx = completedSessions.findIndex((s) => s.id === session.id);
    return idx >= 0 ? completedSessions.length - idx : 0;
  }, [session, completedSessions]);

  const isMilestone = MILESTONE_SESSION_THRESHOLDS.includes(sessionNumber);

  const workedRegions = useMemo(() => {
    if (!session || session.exerciseLogs.length === 0) return null;
    const targetMap = getExerciseTargetRegionsMap();
    const nameMap = getRegionsByExerciseNameMap();
    const counts: Record<string, number> = {};

    for (const log of session.exerciseLogs) {
      let regions: PainRegion[] | undefined = targetMap[log.exerciseId];
      if (!regions || regions.length === 0) {
        regions = nameMap[log.exerciseName];
      }
      for (const r of regions ?? []) {
        if (MUSCLE_SET.has(r)) {
          counts[r] = (counts[r] ?? 0) + 1;
        }
      }
    }

    if (Object.keys(counts).length === 0) {
      const fallback = SESSION_TYPE_FALLBACK_REGIONS[session.sessionType] ?? [];
      fallback.forEach((r) => {
        if (MUSCLE_SET.has(r)) counts[r] = 1;
      });
    }

    return Object.keys(counts).length > 0
      ? (counts as Parameters<typeof BodyDiagram>[0]['heatmapCounts'])
      : null;
  }, [session]);

  const handleShare = useCallback(async () => {
    if (isSharing) return;
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsSharing(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { captureRef } = require('react-native-view-shot') as {
        captureRef: (ref: unknown, opts: unknown) => Promise<string>;
      };
      if (Platform.OS === 'web') {
        const base64 = await captureRef(certRef, {
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
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const Sharing = require('expo-sharing') as typeof import('expo-sharing');
        const uri = await captureRef(certRef, {
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
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Share failed', "Couldn't share your workout - please try again");
    } finally {
      setIsSharing(false);
    }
  }, [isSharing]);

  const handleSave = useCallback(async () => {
    if (isSaving) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsSaving(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { captureRef } = require('react-native-view-shot') as {
        captureRef: (ref: unknown, opts: unknown) => Promise<string>;
      };
      if (Platform.OS === 'web') {
        // Web: trigger a direct PNG download (same as Share on web)
        const base64 = await captureRef(certRef, {
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
        setSaveConfirmed(true);
        setTimeout(() => setSaveConfirmed(false), 2000);
      } else {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const MediaLibrary = require('expo-media-library') as typeof import('expo-media-library');
        // Native: request permission then save to camera roll
        const { status } = await MediaLibrary.requestPermissionsAsync(/* writeOnly */ true);
        if (status !== 'granted') {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          Alert.alert(
            'Photo access needed',
            'To save your certificate, allow Grow to add photos in your device Settings.',
            [{ text: 'OK' }]
          );
          return;
        }
        const uri = await captureRef(certRef, {
          format: 'png',
          quality: 1,
          result: 'tmpfile',
        });
        await MediaLibrary.saveToLibraryAsync(uri);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setSaveConfirmed(true);
        setTimeout(() => setSaveConfirmed(false), 2000);
      }
    } catch {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Save failed', "Couldn't save photo - please try again");
    } finally {
      setIsSaving(false);
    }
  }, [isSaving]);

  const submitRatings = useCallback(() => {
    Object.entries(thumbsRatings).forEach(([id, thumbs]) => {
      setExerciseFeedback(id, thumbs);
    });
    setShowRatingModal(false);
  }, [thumbsRatings, setExerciseFeedback]);

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
      : `${Math.floor(durationSeconds / 60)}m`;
  const topWeightKg =
    summary.rows.length > 0 ? Math.max(0, ...summary.rows.map((r) => r.bestWeight)) : 0;
  const musclesHit = workedRegions ? Object.keys(workedRegions).length : 0;
  const streakDays = getStreakDays();
  const pbCount = summary.rows.filter((r) => r.badge === 'gain-weight').length;

  // Responsive compact-diagram sizing: larger on tall phones, smaller on short
  // ones so the certificate always fits on one screen without scrolling.
  const bodyMaxWidth = Math.min(84, Math.max(58, Math.floor((screenHeight - 560) / 2.4)));

  const heatmap = (workedRegions ?? {}) as Parameters<typeof BodyDiagram>[0]['heatmapCounts'];

  // Lead with the one biggest thing that happened, not three equal stats.
  // Priority: a genuine PB beats hitting a milestone session beats an
  // ordinary day's top weight (or, for a recovery session with nothing
  // weighted, the set count).
  const bestPbRow = summary.rows
    .filter((r) => r.badge === 'gain-weight')
    .sort((a, b) => b.deltaWeight - a.deltaWeight)[0];
  const heroKind: 'pb' | 'milestone' | 'default' = bestPbRow
    ? 'pb'
    : isMilestone
      ? 'milestone'
      : 'default';

  const heroNumber =
    heroKind === 'pb' && bestPbRow
      ? kgToDisplayUnit(bestPbRow.bestWeight, weightUnit)
      : heroKind === 'milestone'
        ? sessionNumber
        : topWeightKg > 0
          ? kgToDisplayUnit(topWeightKg, weightUnit)
          : summary.totalSets;
  const heroUnit =
    heroKind === 'milestone' ? '' : heroKind === 'default' && topWeightKg === 0 ? 'sets' : weightUnit;
  const heroBadgeLabel =
    heroKind === 'pb' ? 'New personal best' : heroKind === 'milestone' ? 'Milestone session' : null;
  const heroCaption =
    heroKind === 'pb' && bestPbRow
      ? `${bestPbRow.exerciseName}, up ${formatWeight(bestPbRow.deltaWeight, weightUnit)} from last time`
      : heroKind === 'milestone'
        ? `${sessionNumber} sessions and counting`
        : streakDays >= 1
          ? `${streakDays} day streak. Keep it going.`
          : 'Nice work today.';

  const stats: { label: string; value: string; accent?: boolean }[] = [
    { label: 'Duration', value: durationLabel },
    { label: 'Sets', value: String(summary.totalSets) },
    { label: 'Muscles', value: String(musclesHit) },
  ];

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: activeTab === 'summary' ? OUTER_BG : C.background },
      ]}
    >
      <Stack.Screen options={{ headerShown: false }} />

      <KeyboardAwareScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingTop: topPad + 10,
          paddingHorizontal: 16,
          paddingBottom: bottomPad + 12,
        }}
        keyboardShouldPersistTaps="handled"
        bottomOffset={24}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Summary / Progress tab switcher ── */}
        <View style={styles.tabSwitcherRow}>
          <View style={[styles.tabSwitcher, { backgroundColor: C.surfaceTertiary }]}>
            <Pressable
              onPress={() => setActiveTab('summary')}
              style={[styles.tabBtn, activeTab === 'summary' && { backgroundColor: C.surface }]}
              testID="summary-tab-summary"
            >
              <Text
                style={[
                  styles.tabBtnText,
                  { color: activeTab === 'summary' ? C.text : C.textTertiary },
                ]}
              >
                Certificate
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setActiveTab('progress')}
              style={[styles.tabBtn, activeTab === 'progress' && { backgroundColor: C.surface }]}
              testID="summary-tab-progress"
            >
              <Text
                style={[
                  styles.tabBtnText,
                  { color: activeTab === 'progress' ? C.text : C.textTertiary },
                ]}
              >
                Progress
              </Text>
            </Pressable>
          </View>
        </View>

        {activeTab === 'progress' ? (
          <ProgressTab
            C={C}
            rows={summary.rows}
            sessionType={session.sessionType}
            hasWeighted={summary.hasWeighted}
            onOpenRating={() => {
              if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setShowRatingModal(true);
            }}
          />
        ) : (
        <>
        <View style={styles.cardWrap}>
          {/* Certificate card (this View is captured for sharing) */}
          <Animated.View entering={FadeIn.duration(450)}>
            <View ref={certRef} collapsable={false} style={styles.card}>
              {/* Top line: brand + date */}
              <View style={styles.cardHeader}>
                <View style={styles.brandRow}>
                  <View style={styles.logoCircle}>
                    <Image
                      source={require('@/assets/images/logo.png')}
                      style={styles.logoImg}
                      resizeMode="cover"
                    />
                  </View>
                  <Text style={styles.brandText}>GROW</Text>
                </View>
                <Text style={styles.dateText}>{formatDate(session.date)}</Text>
              </View>

              {/* Hero: the single biggest thing that happened this session */}
              <Animated.View
                entering={FadeInDown.duration(500).delay(80)}
                style={styles.heroPanel}
              >
                {heroBadgeLabel && (
                  <View style={styles.heroBadge}>
                    <Ionicons name="trophy" size={11} color={GOLD} />
                    <Text style={styles.heroBadgeText}>{heroBadgeLabel.toUpperCase()}</Text>
                  </View>
                )}
                <View style={styles.heroNumberRow}>
                  <Text style={styles.heroNumber} numberOfLines={1} adjustsFontSizeToFit>
                    {heroNumber}
                  </Text>
                  {heroUnit ? <Text style={styles.heroUnit}>{heroUnit}</Text> : null}
                </View>
                <Text style={styles.heroCaption} numberOfLines={2}>
                  {heroCaption}
                </Text>
                {pbCount > 1 && (
                  <Text style={styles.heroExtra} testID="pb-count-row">
                    +{pbCount - 1} more personal best{pbCount > 2 ? 's' : ''} this session
                  </Text>
                )}
                <View style={styles.heroSessionRow}>
                  <Text style={styles.heroSessionName} numberOfLines={1}>
                    {session.displayLabel ?? getSessionLabel(session.sessionType)}
                  </Text>
                  <View style={styles.heroDot} />
                  <Text style={styles.heroSessionNum}>Session {sessionNumber}</Text>
                  {session.isTestWeek && (
                    <View style={styles.testPill}>
                      <Text style={styles.testPillText}>TEST WEEK</Text>
                    </View>
                  )}
                </View>
              </Animated.View>

              {/* Stat rail */}
              <Animated.View
                entering={FadeInDown.duration(450).delay(160)}
                style={styles.statRail}
              >
                {stats.map((s) => (
                  <View key={s.label} style={styles.statTile}>
                    <Text style={styles.statLabel} numberOfLines={1}>
                      {s.label.toUpperCase()}
                    </Text>
                    <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit>
                      {s.value}
                    </Text>
                  </View>
                ))}
              </Animated.View>

              {/* Body diagram */}
              <Animated.View
                entering={FadeInDown.duration(450).delay(220)}
                style={styles.mapPanel}
              >
                <View style={styles.diagramRow}>
                  <View style={styles.diagramCol}>
                    <BodyDiagram
                      compact
                      defaultView="front"
                      heatmapCounts={heatmap}
                      maxWidth={bodyMaxWidth}
                      onSelect={() => {}}
                    />
                    <Text style={styles.diagramLabel}>FRONT</Text>
                  </View>
                  <View style={styles.diagramCol}>
                    <BodyDiagram
                      compact
                      defaultView="back"
                      heatmapCounts={heatmap}
                      maxWidth={bodyMaxWidth}
                      onSelect={() => {}}
                    />
                    <Text style={styles.diagramLabel}>BACK</Text>
                  </View>
                </View>
              </Animated.View>

              {/* Footer */}
              <View style={styles.cardFooter}>
                {streakDays >= 1 ? (
                  <View style={styles.footerStreak}>
                    <Ionicons name="flame" size={13} color={GOLD} />
                    <Text style={styles.footerStreakText}>
                      {streakDays} day{streakDays > 1 ? 's' : ''} streak
                    </Text>
                  </View>
                ) : (
                  <Text style={styles.footerStreakText}>Keep it going</Text>
                )}
                <Text style={styles.footerBrand}>growperformanceandrehab.com</Text>
              </View>
            </View>
          </Animated.View>
        </View>

        {/* Actions (not captured) */}
        <Animated.View entering={FadeInDown.delay(280).duration(420)} style={styles.actionRow}>
          <Pressable
            onPress={() => {
              if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setShowRatingModal(true);
            }}
            style={styles.actionBtn}
            testID="open-rate-modal"
          >
            <Ionicons name="thumbs-up-outline" size={18} color={CARD_TEXT} />
            <Text style={styles.actionBtnText}>Rate</Text>
          </Pressable>
          <Pressable
            onPress={handleSave}
            disabled={isSaving}
            style={[styles.actionBtn, isSaving && { opacity: 0.5 }]}
            testID="save-workout"
          >
            <Ionicons
              name={saveConfirmed ? 'checkmark-circle-outline' : 'download-outline'}
              size={18}
              color={CARD_TEXT}
            />
            <Text style={styles.actionBtnText}>
              {isSaving ? '…' : saveConfirmed ? 'Saved!' : 'Save'}
            </Text>
          </Pressable>
          <Pressable
            onPress={handleShare}
            disabled={isSharing}
            style={[styles.actionBtnPrimary, isSharing && { opacity: 0.5 }]}
            testID="share-workout"
          >
            <Ionicons name="share-outline" size={18} color={OUTER_BG} />
            <Text style={styles.actionBtnPrimaryText}>{isSharing ? '…' : 'Share'}</Text>
          </Pressable>
        </Animated.View>
        </>
        )}

        {/* Session notes */}
        <View style={{ marginTop: 14 }}>
          <Text
            style={{
              fontSize: 11,
              fontFamily: 'Inter_700Bold',
              color: C.textTertiary,
              textTransform: 'uppercase',
              letterSpacing: 0.5,
              marginBottom: 8,
            }}
          >
            Session notes
          </Text>
          <TextInput
            style={{
              backgroundColor: C.surfaceTertiary,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: C.border,
              paddingHorizontal: 14,
              paddingVertical: 10,
              fontSize: 14,
              fontFamily: 'Inter_400Regular',
              color: C.text,
              minHeight: 72,
              textAlignVertical: 'top',
            }}
            placeholder="How did it feel? Anything to remember..."
            placeholderTextColor={C.textTertiary}
            multiline
            value={sessionNotes}
            onChangeText={(text) => {
              setSessionNotes(text);
              if (session) updateSessionNotes(session.id, text);
            }}
            returnKeyType="done"
            blurOnSubmit
          />
        </View>

        {/* Done */}
        <Pressable
          onPress={goHome}
          style={[styles.doneButton, { backgroundColor: C.primary }]}
          testID="summary-done"
        >
          <Text style={[styles.doneButtonText, { color: C.textInverse }]}>Done</Text>
        </Pressable>
      </KeyboardAwareScrollView>

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
                  Sets the weight you&apos;ll see next time you do these
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  tabSwitcherRow: {
    alignItems: 'center',
    marginBottom: 16,
  },
  tabSwitcher: {
    flexDirection: 'row',
    borderRadius: 12,
    padding: 3,
  },
  tabBtn: {
    paddingVertical: 8,
    paddingHorizontal: 22,
    borderRadius: 9,
  },
  tabBtnText: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
  },

  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  emptyText: {
    fontSize: 15,
    fontFamily: 'Inter_500Medium',
    marginTop: 12,
  },

  // Certificate card
  cardWrap: {
    flex: 1,
    justifyContent: 'center',
  },
  card: {
    backgroundColor: CARD_BG,
    borderRadius: 24,
    overflow: 'hidden',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 16,
    borderWidth: 1,
    borderColor: CARD_HAIRLINE,
    gap: 14,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  logoCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: DarkColors.textInverse,
    overflow: 'hidden',
  },
  logoImg: {
    width: 26,
    height: 26,
  },
  brandText: {
    fontSize: 13,
    fontFamily: 'Inter_700Bold',
    color: CARD_MUTED,
    letterSpacing: 2.5,
  },
  dateText: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
    color: CARD_FAINT,
    fontVariant: ['tabular-nums'],
  },

  // Hero - the single biggest thing that happened this session
  heroPanel: {
    backgroundColor: PILL_BG,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: CARD_HAIRLINE,
    paddingVertical: 22,
    paddingHorizontal: 18,
    alignItems: 'center',
  },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(251,191,36,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(251,191,36,0.35)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginBottom: 14,
  },
  heroBadgeText: {
    fontSize: 10,
    fontFamily: 'Inter_700Bold',
    color: GOLD,
    letterSpacing: 1,
  },
  heroNumberRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
  },
  heroNumber: {
    fontSize: 56,
    lineHeight: 58,
    fontFamily: 'Inter_700Bold',
    color: CARD_TEXT,
    fontVariant: ['tabular-nums'],
  },
  heroUnit: {
    fontSize: 18,
    fontFamily: 'Inter_600SemiBold',
    color: CARD_MUTED,
    paddingBottom: 8,
  },
  heroCaption: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    color: CARD_MUTED,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
  },
  heroExtra: {
    fontSize: 11.5,
    fontFamily: 'Inter_600SemiBold',
    color: ACCENT_GREEN,
    marginTop: 4,
  },
  heroSessionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 16,
  },
  heroSessionName: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    color: CARD_TEXT,
  },
  heroDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: CARD_FAINT,
  },
  heroSessionNum: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
    color: CARD_FAINT,
  },
  testPill: {
    backgroundColor: 'rgba(74,222,128,0.12)',
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 2,
    marginLeft: 2,
  },
  testPillText: {
    fontSize: 8,
    fontFamily: 'Inter_700Bold',
    color: ACCENT_GREEN,
    letterSpacing: 0.8,
  },

  // Stat rail
  statRail: {
    flexDirection: 'row',
    gap: 10,
  },
  statTile: {
    flex: 1,
    backgroundColor: PILL_BG,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: CARD_HAIRLINE,
    paddingVertical: 11,
    paddingHorizontal: 8,
    alignItems: 'center',
    gap: 4,
  },
  statLabel: {
    fontSize: 9,
    fontFamily: 'Inter_700Bold',
    color: CARD_FAINT,
    letterSpacing: 0.6,
  },
  statValue: {
    fontSize: 16,
    fontFamily: 'Inter_700Bold',
    color: CARD_TEXT,
    fontVariant: ['tabular-nums'],
  },

  // Body diagram panel
  mapPanel: {
    backgroundColor: PILL_BG,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: CARD_HAIRLINE,
    paddingVertical: 14,
  },
  diagramRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'flex-start',
    gap: 20,
  },
  diagramCol: {
    alignItems: 'center',
  },
  diagramLabel: {
    fontSize: 9,
    fontFamily: 'Inter_600SemiBold',
    color: CARD_FAINT,
    letterSpacing: 1.5,
    marginTop: 2,
  },

  // Card footer
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
  },
  footerStreak: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  footerStreakText: {
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
    color: CARD_MUTED,
  },
  footerBrand: {
    fontSize: 11,
    fontFamily: 'Inter_500Medium',
    color: CARD_FAINT,
  },

  // ── Actions ─────────────────────────────────────────────────────────────────
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    backgroundColor: PILL_BG,
    borderColor: CARD_HAIRLINE,
  },
  actionBtnText: {
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
    color: CARD_TEXT,
  },
  actionBtnPrimary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: ACCENT_GREEN,
  },
  actionBtnPrimaryText: {
    fontSize: 15,
    fontFamily: 'Inter_700Bold',
    color: OUTER_BG,
  },

  // ── Done ────────────────────────────────────────────────────────────────────
  doneButton: {
    marginTop: 10,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneButtonText: {
    fontSize: 16,
    fontFamily: 'Inter_700Bold',
  },

  // ── Rate modal ──────────────────────────────────────────────────────────────
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
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
    gap: 14,
    padding: 20,
    borderBottomWidth: 1,
  },
  modalIconWrap: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalHeaderText: {
    flex: 1,
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: 'Inter_700Bold',
  },
  modalSubtitle: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    marginTop: 2,
  },
  modalScroll: {
    paddingHorizontal: 20,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: 1,
    gap: 12,
  },
  ratingName: {
    flex: 1,
    fontSize: 15,
    fontFamily: 'Inter_500Medium',
  },
  ratingButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  thumbBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalFooter: {
    padding: 20,
    borderTopWidth: 1,
    gap: 8,
  },
  modalPrimaryBtn: {
    paddingVertical: 15,
    borderRadius: 14,
    alignItems: 'center',
  },
  modalPrimaryBtnText: {
    fontSize: 16,
    fontFamily: 'Inter_700Bold',
  },
  modalSkipBtn: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  modalSkipText: {
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
  },
});
