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
import { LinearGradient } from 'expo-linear-gradient';
import { useColors, DarkColors } from '@/constants/colors';
import { elevatedShadow } from '@/constants/shadows';
import {
  useAppStore,
  CompletedSession,
  SESSION_ORDER,
  SetLog,
  ExerciseCategory,
  ExerciseFeedback,
  ExercisePerformance,
  PainRegion,
  SessionType,
  WeightUnit,
} from '@/lib/store';
import { getSessionLabel } from '@/lib/workout-engine';
import {
  getExerciseCategoryMap,
  getExerciseTargetRegionsMap,
  getRegionsByExerciseNameMap,
} from '@/lib/exercise-db';
import { Badge, BADGE_MAP, MILESTONE_SESSION_THRESHOLDS } from '@/lib/badges';
import { AchievementBanner } from '@/components/AchievementBanner';
import { BodyDiagram, musclesWorked } from '@/components/BodyDiagram';
import { formatDate, formatWeight, kgToDisplayUnit } from '@/lib/utils';

const WEB_TOP_INSET = 67;
const WEB_BOTTOM_INSET = 34;

// Fixed palette (independent of device theme) shared by both tabs, so the
// whole screen reads as one continuous moment instead of switching brand
// identity when you swipe between Certificate and Progress. Green on ecru,
// matching the Grow logo's own mark-on-parchment colouring.
interface CardPalette {
  outerBg: string;
  cardGradient: readonly [string, string, string];
  pillBg: string;
  text: string;
  muted: string;
  faint: string;
  hairline: string;
  accent: string;
  badgeBg: string;
}

const SAGE: CardPalette = {
  outerBg: '#e6d9b8',
  cardGradient: ['#fdf9ee', '#f5e9c9', '#ecdbaa'],
  pillBg: 'rgba(47,107,70,0.08)',
  text: '#173a26',
  muted: '#3f6350',
  faint: '#5f7768',
  hairline: 'rgba(47,107,70,0.22)',
  accent: '#2f6b46',
  badgeBg: 'rgba(47,107,70,0.16)',
};

// Semantic tone colours for progress rows - separate from the palette's own
// accent, these mean "up/down/neutral" regardless of what else is on screen.
// Deliberately not traffic-light red/green: a dip is still real progress
// logged, not a failure, so TONE_DOWN is a warm rust rather than an alarm
// colour. Both are darkened well past their original values (this pair was
// first picked for the old near-black Cobalt card) since a light-on-light
// pairing on the new ecru background was down at ~1.5:1 contrast.
const TONE_UP = '#166534';
const TONE_DOWN = '#9a3412';

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
  /**
   * True when the user answered "Too Hard" on a set of this exercise.
   *
   * The store turns that answer into an ExercisePerformance of 'failed', which
   * is the same value a genuinely unfinished set produces — so the hint below
   * could not tell the two apart and told everyone who answered honestly that
   * they had left a set incomplete. Carried through so the reason it gives is
   * the reason that actually applied.
   */
  ratedHard: boolean;
}

const SESSION_TYPE_FALLBACK_REGIONS: Partial<Record<string, PainRegion[]>> = {
  squat: ['quads', 'glutes', 'hamstrings', 'knee', 'hip_groin'],
  bench: ['chest', 'tricep', 'front_shoulder'],
  deadlift: ['lower_back', 'hamstrings', 'glutes', 'lat_mid_back'],
  // The weekly sessions were missing entirely, so an upper-body session whose
  // exercises had no per-exercise region data fell through to an empty
  // fallback — the body map then showed only whichever exercises happened to
  // carry data, which is why chest could go unlit after a bench session while
  // an incidental core movement did light up.
  upper_body: ['chest', 'lat_mid_back', 'upper_back', 'tricep', 'bicep'],
  lower_body: ['quads', 'glutes', 'hamstrings', 'calf_shin'],
  full_body: ['quads', 'glutes', 'chest', 'lat_mid_back', 'core_ribs'],
  conditioning: ['core_ribs', 'quads', 'hamstrings'],
  prehab: ['hip_groin', 'lower_back', 'core_ribs'],
  flexibility: [],
  custom: [],
};

/** Same aggregation the main summary useMemo does for the current session,
 *  factored out so it can also run against a past session for comparison
 *  without duplicating (and risking drift from) that logic. */
function computeSessionTotals(session: CompletedSession): {
  totalSets: number;
  totalReps: number;
  totalVolumeKg: number;
} {
  let totalSets = 0;
  let totalReps = 0;
  let totalVolumeKg = 0;
  for (const log of session.exerciseLogs) {
    const completedSets = log.sets.filter((s) => s.completed && !s.skipped);
    totalSets += completedSets.length;
    for (const s of completedSets) {
      totalReps += s.reps || 0;
      if (s.weight > 0 && s.reps > 0) totalVolumeKg += s.weight * s.reps;
    }
  }
  return { totalSets, totalReps, totalVolumeKg };
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

/**
 * The badge under each exercise on the summary.
 *
 * TWO THINGS THESE LABELS USED TO GET WRONG.
 *
 * They printed the raw subtraction. Two weights a hundredth apart came out of
 * binary floating point as 0.009999999999999787, and that is what went on the
 * card: "Goblet Squat Primer +0.009999999999999787 kg vs last time". Every
 * other weight in the app goes through formatWeight, and these did not.
 *
 * And they hardcoded "kg" while the rest of the screen respected the user's
 * choice, so somebody training in pounds was shown a kilogram number labelled
 * as their own unit. That is the worse of the two: a long number looks broken,
 * a wrong unit looks right.
 */
const BADGE_META: Record<
  BadgeKind,
  {
    label: (r: ExerciseRow, unit: WeightUnit) => string;
    icon: string;
    tone: 'up' | 'down' | 'neutral' | 'first';
  }
> = {
  'gain-weight': {
    label: (r, unit) => `+${formatWeight(r.deltaWeight, unit)} vs last time`,
    icon: 'trending-up',
    tone: 'up',
  },
  'gain-reps': {
    label: (r) => `+${r.deltaReps} rep${r.deltaReps === 1 ? '' : 's'} at the same weight`,
    icon: 'trending-up',
    tone: 'up',
  },
  drop: {
    label: (r, unit) => `${formatWeight(r.deltaWeight, unit)} lighter than last time`,
    icon: 'trending-down',
    tone: 'down',
  },
  first: { label: () => 'First time logging this', icon: 'sparkles', tone: 'first' },
  matched: { label: () => 'Matched your last result', icon: 'remove', tone: 'neutral' },
  none: { label: () => 'Completed', icon: 'checkmark', tone: 'neutral' },
};

// What actually decides the weight this exercise starts at next time.
// Mirrors personalizeLoad()'s real priority order in lib/workout-engine.ts:
// a held/thumbs-down session holds the weight; an easy rating or a 3-session
// clean streak earns the bigger +5kg jump; anything else clean gets +2.5kg.
// Only meaningful for the session the app is CURRENTLY basing its next
// suggestion on - lastSessionPerformance/exerciseNormalStreak are live store
// state, not a history snapshot, so this is only shown for the most recent
// completed session, never an older one pulled up from history.
function getNextHint(
  exerciseId: string,
  bestWeightKg: number,
  isLatestSession: boolean,
  lastSessionPerformance: Record<string, ExercisePerformance>,
  exerciseNormalStreak: Record<string, number>,
  exerciseFeedback: Record<string, ExerciseFeedback>,
  weightUnit: WeightUnit,
  ratedHard: boolean,
  repNote?: string
): string | null {
  if (!isLatestSession || bestWeightKg <= 0) return null;
  const perf = lastSessionPerformance[exerciseId];
  if (perf === 'failed') {
    const ratedDown = exerciseFeedback[exerciseId]?.thumbs === 'down';
    // FOUR things reach 'failed' and only one of them is an unfinished set.
    // The fourth is double progression: while the reps are climbing inside the
    // range the load must hold, and the store records that hold as 'failed'
    // (lib/store.ts, repsStillClimbing). Read literally, this screen told
    // somebody who completed every set and EARNED an extra rep that they had
    // left a set incomplete.
    //
    // The rep note is the truth in that case, and lib/rep-scheme.ts already
    // wrote it — "One more rep at the same weight" — so it is preferred over
    // the load sentence whenever it exists.
    if (repNote) return `Next time: ${repNote.charAt(0).toLowerCase()}${repNote.slice(1)}.`;
    const why = ratedHard
      ? 'You rated a set Too Hard'
      : ratedDown
        ? 'You rated this tough'
        : 'A set was left incomplete';
    return `Next time: holding at ${formatWeight(bestWeightKg, weightUnit)}. ${why}.`;
  }
  if (perf === 'very_easy') {
    return `Next time: up to ${formatWeight(bestWeightKg + 7.5, weightUnit)}. You rated more than one set Easy.`;
  }
  const streak = exerciseNormalStreak[exerciseId] ?? 0;
  if (perf === 'easy' || streak >= 3) {
    const why =
      perf === 'easy' ? 'You rated a set Easy' : `${streak} sessions completed in full`;
    return `Next time: up to ${formatWeight(bestWeightKg + 5, weightUnit)}. ${why}.`;
  }
  // "Clean session" was jargon the UI never defined — see ProgressionRules.
  return `Next time: up to ${formatWeight(bestWeightKg + 2.5, weightUnit)}. Every set completed.`;
}

/** One "proud fact" stat with an optional vs-last-time delta line below it.
 *  delta is the raw signed number driving the tone (undefined = nothing to
 *  compare against yet, so the delta line is omitted entirely rather than
 *  showing a misleading "same as last time"). */
function StatDeltaTile({
  P,
  label,
  value,
  delta,
  deltaLabel,
}: {
  P: CardPalette;
  label: string;
  value: string;
  delta?: number;
  deltaLabel?: string;
}) {
  const tone = delta === undefined ? null : delta > 0 ? 'up' : delta < 0 ? 'down' : 'neutral';
  const toneColor = tone === 'up' ? TONE_UP : tone === 'down' ? TONE_DOWN : P.muted;
  const icon = tone === 'up' ? 'trending-up' : tone === 'down' ? 'trending-down' : 'remove';
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: P.pillBg,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: P.hairline,
        paddingVertical: 12,
        paddingHorizontal: 10,
        gap: 3,
      }}
    >
      <Text
        style={{ fontSize: 10, fontFamily: 'Inter_700Bold', color: P.faint, letterSpacing: 0.6 }}
      >
        {label.toUpperCase()}
      </Text>
      <Text style={{ fontSize: 19, fontFamily: 'Inter_700Bold', color: P.text }}>{value}</Text>
      {tone && deltaLabel ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
          <Ionicons name={icon as any} size={11} color={toneColor} />
          <Text style={{ fontSize: 11, fontFamily: 'Inter_600SemiBold', color: toneColor }}>
            {deltaLabel}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

/**
 * "What's driving your numbers" view - makes the progression engine's real
 * decision visible instead of invisible. The badge/delta here already
 * existed (computed for the certificate's PB count) but was never shown per
 * exercise; getNextHint above adds the forward-looking half - not just what
 * changed, but what happens next session and why.
 */
/**
 * The actual rules the load engine follows, in three lines.
 *
 * This replaces a paragraph that was both long and wrong. It said "a clean
 * session nudges it up, a tough one holds it, and a run of clean sessions earns
 * a bigger jump" — which never mentioned the set ratings at all, and so read as
 * though rating an exercise did nothing. It is the opposite: the rating is the
 * strongest lever there is, and it overrides everything else.
 *
 * Transcribed from lib/store.ts (completeSession, where performance is
 * classified), lib/auto-regulation.ts (feedbackRatingFor, which turns a run of
 * set answers into one rating) and getNextHint above. Keep all three in step:
 *
 *   two or more sets rated "Easy"    → +7.5 kg
 *   one set rated "Easy"             → +5 kg
 *   any set rated "Too Hard", or any
 *     set left incomplete            → hold
 *   all sets done, nothing rated
 *     Easy or Too Hard               → +2.5 kg   ("clean")
 *   3 clean sessions in a row        → +5 kg
 *
 * "Clean" was never defined anywhere in the UI, which is the other half of the
 * complaint, so it is spelled out rather than used as jargon. Note that
 * "Challenging" appears nowhere: it means the prescription was right, which is
 * not a reason to change it.
 */
function ProgressionRules({ P }: { P: CardPalette }) {
  const rows: { badge: string; tone: 'up' | 'hold'; text: string }[] = [
    { badge: '↑', tone: 'up', text: 'You rated a set Easy, so you get the biggest jump: 5 to 7.5 kg.' },
    { badge: '↑', tone: 'up', text: 'Every set completed and nothing rated, so a steady 2.5 kg. Three of those in a row earns 5 kg.' },
    { badge: '=', tone: 'hold', text: 'You rated a set Too Hard, or left one incomplete, so the weight holds until you clear it.' },
  ];
  return (
    <View style={{ gap: 10, marginTop: 2 }}>
      <Text
        style={{ fontSize: 13, fontFamily: 'Inter_400Regular', color: P.muted, lineHeight: 19 }}
      >
        Each exercise moves on its own, from what you actually lifted and how you rated it:
      </Text>
      <View style={{ gap: 7 }}>
        {rows.map((r) => (
          <View key={r.text} style={{ flexDirection: 'row', gap: 9, alignItems: 'flex-start' }}>
            <View
              style={{
                width: 18,
                height: 18,
                borderRadius: 6,
                backgroundColor: r.tone === 'up' ? P.pillBg : 'transparent',
                borderWidth: 1,
                borderColor: P.hairline,
                alignItems: 'center',
                justifyContent: 'center',
                marginTop: 1,
              }}
            >
              <Text
                style={{
                  fontSize: 11,
                  fontFamily: 'Inter_700Bold',
                  color: r.tone === 'up' ? TONE_UP : P.faint,
                }}
              >
                {r.badge}
              </Text>
            </View>
            <Text
              style={{
                flex: 1,
                fontSize: 12.5,
                fontFamily: 'Inter_400Regular',
                color: P.text,
                lineHeight: 18,
              }}
            >
              {r.text}
            </Text>
          </View>
        ))}
      </View>
      <Text
        style={{ fontSize: 11.5, fontFamily: 'Inter_400Regular', color: P.faint, lineHeight: 17 }}
      >
        The session around those weights is built fresh each time from your equipment, the energy
        you logged and any pain you flagged.
      </Text>
    </View>
  );
}

/**
 * This lift's top set across the block that led to a test, as a simple bar
 * chart. Deliberately plain Views rather than a charting dependency — five to
 * twelve bars needs no library, and this has to survive being captured by
 * react-native-view-shot for the shareable card.
 */
function BlockProgressChart({
  points,
  weightUnit,
  liftName,
}: {
  points: { kg: number; date: string }[];
  weightUnit: WeightUnit;
  liftName: string;
}) {
  const P = SAGE;
  const values = points.map((p) => p.kg);
  const max = Math.max(...values);
  const min = Math.min(...values);
  const gained = values[values.length - 1] - values[0];
  // Scale bars between min and max rather than from zero: the interesting range
  // is the top of the lift, and a zero baseline flattens every bar into a
  // near-identical block.
  const span = max - min || 1;
  const heightFor = (kg: number) => 26 + ((kg - min) / span) * 54;

  return (
    <View style={{ paddingHorizontal: 20, paddingBottom: 18, gap: 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
        <Text style={{ fontSize: 13, fontFamily: 'Inter_600SemiBold', color: P.text }}>
          {liftName} through this block
        </Text>
        <Text style={{ fontSize: 12, fontFamily: 'Inter_500Medium', color: P.muted }}>
          {points.length} session{points.length === 1 ? '' : 's'}
        </Text>
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 5, height: 80 }}>
        {points.map((p, i) => {
          const isLast = i === points.length - 1;
          return (
            <View key={`${p.date}-${i}`} style={{ flex: 1, alignItems: 'center', gap: 4 }}>
              <View
                style={{
                  width: '100%',
                  height: heightFor(p.kg),
                  borderRadius: 5,
                  backgroundColor: isLast ? P.accent : P.badgeBg,
                }}
              />
            </View>
          );
        })}
      </View>

      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text style={{ fontSize: 11, fontFamily: 'Inter_500Medium', color: P.faint }}>
          {formatWeight(values[0], weightUnit)}
        </Text>
        <Text
          style={{
            fontSize: 12,
            fontFamily: 'Inter_700Bold',
            color: gained > 0 ? P.accent : P.muted,
          }}
        >
          {gained > 0
            ? `+${formatWeight(gained, weightUnit)} over the block`
            : gained < 0
              ? `${formatWeight(Math.abs(gained), weightUnit)} down over the block`
              : 'Held steady over the block'}
        </Text>
        <Text style={{ fontSize: 11, fontFamily: 'Inter_500Medium', color: P.faint }}>
          {formatWeight(values[values.length - 1], weightUnit)}
        </Text>
      </View>
    </View>
  );
}

function ProgressTab({
  rows,
  sessionType,
  hasWeighted,
  totalVolumeKg,
  totalReps,
  previousTotals,
  isLatestSession,
  lastSessionPerformance,
  exerciseRepNote,
  exerciseNormalStreak,
  exerciseStuckStreak,
  exerciseFeedback,
  weightUnit,
  testBlockSeries,
  liftName,
  onOpenRating,
}: {
  rows: ExerciseRow[];
  sessionType: SessionType;
  hasWeighted: boolean;
  totalVolumeKg: number;
  totalReps: number;
  /** The previous completed session of the same sessionType, aggregated the
   *  same way - null when this is the first time this session type has ever
   *  been logged, in which case there's nothing to compare against. */
  previousTotals: { totalVolumeKg: number; totalReps: number } | null;
  isLatestSession: boolean;
  lastSessionPerformance: Record<string, ExercisePerformance>;
  /** The plain-English reason each rep target moved, from lib/rep-scheme.ts. */
  exerciseRepNote: Record<string, string>;
  exerciseNormalStreak: Record<string, number>;
  exerciseStuckStreak: Record<string, number>;
  exerciseFeedback: Record<string, ExerciseFeedback>;
  weightUnit: WeightUnit;
  /** Set on a test session: this lift's top set across the block leading here. */
  testBlockSeries?: { kg: number; date: string }[] | null;
  liftName?: string;
  onOpenRating: () => void;
}) {
  const P = SAGE;
  const weighted = rows.filter((r) => r.isWeighted);
  const isTest = Boolean(testBlockSeries);
  const toneColor: Record<'up' | 'down' | 'neutral' | 'first', string> = {
    up: TONE_UP,
    down: TONE_DOWN,
    neutral: P.muted,
    first: P.accent,
  };
  const isRecoverySession = sessionType === 'prehab' || sessionType === 'flexibility';

  const volumeDeltaKg = previousTotals ? totalVolumeKg - previousTotals.totalVolumeKg : 0;
  const volumeDeltaLabel = !previousTotals
    ? undefined
    : volumeDeltaKg > 0
      ? `+${formatWeight(volumeDeltaKg, weightUnit)} vs last time`
      : volumeDeltaKg < 0
        ? `${formatWeight(-volumeDeltaKg, weightUnit)} less than last time`
        : 'Same as last time';

  const repsDelta = previousTotals ? totalReps - previousTotals.totalReps : 0;
  const repsDeltaLabel = !previousTotals
    ? undefined
    : repsDelta > 0
      ? `+${repsDelta} vs last time`
      : repsDelta < 0
        ? `${-repsDelta} fewer than last time`
        : 'Same as last time';

  return (
    <Animated.View entering={FadeIn.duration(350)}>
      <LinearGradient
        colors={P.cardGradient}
        style={{ borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: P.hairline }}
      >
        <View style={{ padding: 20, gap: 4 }}>
          <Text style={{ fontSize: 17, fontFamily: 'Inter_700Bold', color: P.text }}>
            What&apos;s driving your numbers
          </Text>
          {isTest ? (
            <Text
              style={{
                fontSize: 13,
                fontFamily: 'Inter_400Regular',
                color: P.muted,
                lineHeight: 19,
              }}
            >
              A test is two exercises, so today&apos;s volume says nothing. This is the block of
              work that got you here.
            </Text>
          ) : (
            <ProgressionRules P={P} />
          )}
        </View>

        {testBlockSeries && (
          <BlockProgressChart
            points={testBlockSeries}
            weightUnit={weightUnit}
            liftName={liftName ?? 'This lift'}
          />
        )}

        {!isTest && totalReps > 0 && (
          <View style={{ flexDirection: 'row', gap: 10, paddingHorizontal: 20, paddingBottom: 16 }}>
            {hasWeighted && (
              <StatDeltaTile
                P={P}
                label="Total volume"
                value={`${Math.round(kgToDisplayUnit(totalVolumeKg, weightUnit)).toLocaleString()} ${weightUnit}`}
                delta={previousTotals ? volumeDeltaKg : undefined}
                deltaLabel={volumeDeltaLabel}
              />
            )}
            <StatDeltaTile
              P={P}
              label="Total reps"
              value={`${totalReps}`}
              delta={previousTotals ? repsDelta : undefined}
              deltaLabel={repsDeltaLabel}
            />
          </View>
        )}

        {!hasWeighted ? (
          <View style={{ paddingHorizontal: 20, paddingBottom: 20 }}>
            <Text style={{ fontSize: 14, fontFamily: 'Inter_400Regular', color: P.muted }}>
              {isRecoverySession
                ? "Recovery sessions don't load exercises, so there's nothing to compare here. This one's about the reps and holds, not the numbers."
                : 'No weighted sets logged this session, so there is nothing to compare yet.'}
            </Text>
          </View>
        ) : (
          <View style={{ paddingHorizontal: 12, paddingBottom: 8 }}>
            {weighted.map((r) => {
              const meta = BADGE_META[r.badge];
              const nextHint = getNextHint(
                r.exerciseId,
                r.bestWeight,
                isLatestSession,
                lastSessionPerformance,
                exerciseNormalStreak,
                exerciseFeedback,
                weightUnit,
                r.ratedHard,
                exerciseRepNote[r.exerciseId]
              );
              const stuckStreak = exerciseStuckStreak[r.exerciseId] ?? 0;
              const showPlateauNudge = isLatestSession && stuckStreak >= 3;
              return (
                <View
                  key={r.exerciseId}
                  style={{
                    gap: 6,
                    paddingHorizontal: 8,
                    paddingVertical: 12,
                    borderTopWidth: 1,
                    borderTopColor: P.hairline,
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <View
                      style={{
                        width: 34,
                        height: 34,
                        borderRadius: 17,
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: toneColor[meta.tone] + '22',
                      }}
                    >
                      <Ionicons name={meta.icon as any} size={16} color={toneColor[meta.tone]} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text
                        style={{ fontSize: 14, fontFamily: 'Inter_600SemiBold', color: P.text }}
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
                        {meta.label(r, weightUnit)}
                      </Text>
                    </View>
                    <Text style={{ fontSize: 13, fontFamily: 'Inter_600SemiBold', color: P.muted }}>
                      {r.bestWeight > 0 ? formatWeight(r.bestWeight, weightUnit) : ''}
                    </Text>
                  </View>
                  {nextHint && (
                    <Text
                      style={{
                        fontSize: 11.5,
                        fontFamily: 'Inter_500Medium',
                        color: P.faint,
                        marginLeft: 46,
                      }}
                    >
                      {nextHint}
                    </Text>
                  )}
                  {showPlateauNudge && (
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'flex-start',
                        gap: 6,
                        marginLeft: 46,
                        marginTop: 2,
                      }}
                    >
                      <Ionicons
                        name="swap-horizontal-outline"
                        size={13}
                        color={TONE_DOWN}
                        style={{ marginTop: 1 }}
                      />
                      <Text
                        style={{
                          flex: 1,
                          fontSize: 11.5,
                          fontFamily: 'Inter_500Medium',
                          color: TONE_DOWN,
                          lineHeight: 15,
                        }}
                      >
                        {`Held at this weight for ${stuckStreak} sessions in a row - a deload or swapping this exercise for a while could help it move again.`}
                      </Text>
                    </View>
                  )}
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
            borderTopColor: P.hairline,
          }}
          testID="progress-tab-rate"
        >
          <Ionicons name="thumbs-up-outline" size={15} color={P.accent} />
          <Text style={{ fontSize: 13, fontFamily: 'Inter_600SemiBold', color: P.accent }}>
            Didn&apos;t feel right? Rate your exercises
          </Text>
        </Pressable>
      </LinearGradient>
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
  const lastSessionPerformance = useAppStore((s) => s.lastSessionPerformance);
  const exerciseNormalStreak = useAppStore((s) => s.exerciseNormalStreak);
  const exerciseRepNote = useAppStore((s) => s.exerciseRepNote);
  const exerciseStuckStreak = useAppStore((s) => s.exerciseStuckStreak);
  const exerciseFeedback = useAppStore((s) => s.exerciseFeedback);
  const oneRepMaxes = useAppStore((s) => s.oneRepMaxes);
  const newlyUnlockedBadges = useAppStore((s) => s.newlyUnlockedBadges);
  const clearNewlyUnlockedBadges = useAppStore((s) => s.clearNewlyUnlockedBadges);

  // Badges earned by the session you just finished, celebrated here rather than
  // waiting until you happen to open a tab.
  //
  // The queue is claimed ONCE on mount and cleared, so the root-level unlock
  // sheet in app/_layout.tsx does not also fire for the same badges when the
  // user gets back to the tabs. Snapshotted into local state because clearing
  // the store queue would otherwise empty the banner mid-animation.
  const [sessionBadges, setSessionBadges] = useState<Badge[]>([]);
  const claimedRef = useRef(false);
  useEffect(() => {
    if (claimedRef.current || newlyUnlockedBadges.length === 0) return;
    claimedRef.current = true;
    const resolved = newlyUnlockedBadges.flatMap((id) => {
      const b = BADGE_MAP.get(id);
      return b ? [b] : [];
    });
    if (resolved.length > 0) setSessionBadges(resolved);
    clearNewlyUnlockedBadges();
  }, [newlyUnlockedBadges, clearNewlyUnlockedBadges]);

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

  // lastSessionPerformance/exerciseNormalStreak are live store state driving
  // the NEXT session's suggestion, not a per-session snapshot - only valid to
  // show as "what happens next" when this is genuinely the most recent
  // completed session, not one pulled up from history.
  const isLatestSession = !!session && completedSessions[0]?.id === session.id;

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

        /**
         * Compared at the precision the user reads, not at full float.
         *
         * Two sets a hundredth of a kilogram apart are the same set. Nothing in
         * a gym can express the difference, and comparing the raw numbers called
         * it a personal best and printed "+0.009999999999999787 vs last time".
         * Rounding only the label would have hidden the number and kept the
         * wrong verdict, so the comparison itself is made on what gets shown:
         * if the two weights print identically, they matched.
         */
        const shownNow = kgToDisplayUnit(thisBest.weight, weightUnit);
        const shownBefore = prevBest ? kgToDisplayUnit(prevBest.weight, weightUnit) : 0;

        if (!prevBest) {
          badge = 'first';
        } else if (shownNow > shownBefore) {
          badge = 'gain-weight';
          deltaWeight = thisBest.weight - prevBest.weight;
        } else if (shownNow === shownBefore && thisBest.reps > prevBest.reps) {
          badge = 'gain-reps';
          deltaReps = thisBest.reps - prevBest.reps;
        } else if (shownNow < shownBefore) {
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
        ratedHard: log.feedbackRating === 'hard',
      });
    }

    const hasWeighted = rows.some((r) => r.isWeighted);
    return { totalSets, totalReps, totalVolumeKg, rows, hasWeighted };
  }, [session, getExerciseHistory, categoryMap, weightUnit]);

  // The previous completed session of this same sessionType, aggregated the
  // same way, purely so the Progress tab can show "vs last time" on the
  // session-level volume/rep totals - null the first time this session type
  // has ever been logged, since there's nothing yet to compare against.
  const previousTotals = useMemo(() => {
    if (!session) return null;
    const prev = completedSessions.find(
      (s) => s.sessionType === session.sessionType && s.id !== session.id
    );
    return prev ? computeSessionTotals(prev) : null;
  }, [session, completedSessions]);

  const sessionNumber = useMemo(() => {
    if (!session) return 0;
    const idx = completedSessions.findIndex((s) => s.id === session.id);
    return idx >= 0 ? completedSessions.length - idx : 0;
  }, [session, completedSessions]);

  const isMilestone = MILESTONE_SESSION_THRESHOLDS.includes(sessionNumber);

  /**
   * Where the work landed.
   *
   * Joints count. They used to be thrown away, which was invisible for a squat
   * session and actively wrong for rehab: an hour of elbow work lit nothing at
   * all, so the card fell through to the generic fallback and reported a hip
   * and a lower back the user had never touched. The figures can shade a
   * forearm or an ankle perfectly well — nothing was gained by hiding them.
   */
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
        counts[r] = (counts[r] ?? 0) + 1;
      }
    }

    if (Object.keys(counts).length === 0) {
      const fallback = SESSION_TYPE_FALLBACK_REGIONS[session.sessionType] ?? [];
      fallback.forEach((r) => {
        counts[r] = 1;
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
  // WEEKS, despite the name. getStreakDays counts consecutive Monday-to-Sunday
  // weeks that hit the weekly goal — see lib/store.ts. Both places it is
  // printed used to call them days.
  const streakWeeks = getStreakDays();
  const pbCount = summary.rows.filter((r) => r.badge === 'gain-weight').length;

  // Responsive compact-diagram sizing: larger on tall phones, smaller on short
  // ones so the certificate always fits on one screen without scrolling.
  const bodyMaxWidth = Math.min(84, Math.max(58, Math.floor((screenHeight - 560) / 2.4)));

  const heatmap = (workedRegions ?? {}) as Parameters<typeof BodyDiagram>[0]['heatmapCounts'];

  /**
   * The shaded regions, named as MUSCLES.
   *
   * The figures already showed where the work landed; nothing said what the
   * shading meant. Reading a highlighted outline and knowing it is "lat / mid
   * back" is a skill, not a glance.
   *
   * Two things this used to get wrong, both visible in one screenshot of a
   * custom session — "Quads, Hamstrings, Glutes, Knee, Hip, Lower Back, +5 more":
   *
   *   Joints in a list of what you trained. A knee is not trained, the quads
   *   and hamstrings that move it are. musclesWorked() does that translation.
   *
   *   "+5 more". This sits beside a body map with eleven regions shaded; naming
   *   six of them and counting the rest is the one thing a legend must not do.
   *   Every muscle the figures shade is now named, and the row wraps.
   */
  // Not memoised: this sits below an early return, so a hook here would be
  // called conditionally. It is a sort of at most nineteen entries — cheaper
  // than the comparison that would decide whether to recompute it.
  const workedLabels = musclesWorked(workedRegions ?? {});

  // Lead with the one biggest thing that happened, not three equal stats.
  //
  // Milestones outrank PBs. Under progressive overload a PB is close to routine
  // — early on you set one most sessions — whereas session 100 happens once.
  // The old order put PB first, so hitting a milestone *and* a PB in the same
  // session silently dropped the milestone from the hero entirely. When both
  // land, the milestone leads and the caption carries the PB rather than one
  // erasing the other.
  const bestPbRow = summary.rows
    .filter((r) => r.badge === 'gain-weight')
    .sort((a, b) => b.deltaWeight - a.deltaWeight)[0];
  // ── Test week: the tested max IS the story ─────────────────────────────────
  // Twelve sessions of work land on this one number, so it outranks everything
  // else on the hero — a routine PB or a session-count milestone must not bump
  // it. oneRepMaxes is newest-first, so [0] is the result just recorded and [1]
  // is the previous test of the same lift.
  const liftOrms = session.isTestWeek
    ? oneRepMaxes.filter((o) => o.lift === session.sessionType)
    : [];
  const testedOrm = liftOrms[0];
  const previousOrm = liftOrms[1];
  const testDeltaKg = testedOrm && previousOrm ? testedOrm.weight - previousOrm.weight : null;
  const liftName = getSessionLabel(session.sessionType).replace(/\s*Session$/i, '');
  const liftSessionCount = completedSessions.filter(
    (s) => s.sessionType === session.sessionType
  ).length;

  // Bodyweight and band tests log reps against a zero weight, so the 1RM path
  // above never fires for them — those users used to finish a whole test week
  // with nothing recorded and a summary that looked like any other session.
  // For them the rep count IS the result, and it is already in the session log.
  // The test protocol is always [ramp-up, test set], so the test set is last.
  const testMainLog = session.isTestWeek
    ? session.exerciseLogs[session.exerciseLogs.length - 1]
    : undefined;
  const testRepsSet = testMainLog?.sets.find((s) => s.completed && s.reps > 0);
  const testedReps = !testedOrm && testRepsSet?.weight === 0 ? testRepsSet.reps : null;

  // completedSessions is newest-first and already contains this session, so
  // skipping by id finds the previous test of the same lift.
  const previousTestSession = completedSessions.find(
    (s) => s.id !== session.id && s.isTestWeek && s.sessionType === session.sessionType
  );
  const previousTestReps =
    previousTestSession?.exerciseLogs[previousTestSession.exerciseLogs.length - 1]?.sets.find(
      (s) => s.completed && s.reps > 0
    )?.reps ?? null;
  const testDeltaReps =
    testedReps !== null && previousTestReps !== null ? testedReps - previousTestReps : null;

  // ── Cycle results: the payoff for the whole block ──────────────────────────
  // Three lifts are tested across a test week and nothing joined them up, so
  // finishing the third one felt like finishing any other session. On that last
  // test we show all three together — the actual milestone.
  //
  // Results are recomputed from each session's own log rather than read out of
  // oneRepMaxes, so a lift is matched to its test by the session it came from
  // instead of by hoping the dates line up.
  const testResultOf = (s: CompletedSession): { kg: number | null; reps: number | null } => {
    const log = s.exerciseLogs[s.exerciseLogs.length - 1];
    const set = log?.sets.find((x) => x.completed && x.reps > 0);
    if (!set) return { kg: null, reps: null };
    // Epley, matching the estimate the completion path records.
    if (set.weight > 0) return { kg: Math.round(set.weight * (1 + set.reps / 30)), reps: set.reps };
    return { kg: null, reps: set.reps };
  };

  // The most recent unbroken run of test sessions — this block.
  const blockTests: CompletedSession[] = [];
  for (const s of completedSessions) {
    if (!SESSION_ORDER.includes(s.sessionType)) continue;
    if (!s.isTestWeek) break;
    blockTests.push(s);
    if (blockTests.length === SESSION_ORDER.length) break;
  }
  const cycleComplete =
    Boolean(session.isTestWeek) &&
    blockTests.length === SESSION_ORDER.length &&
    blockTests.some((s) => s.id === session.id);

  const cycleRows = cycleComplete
    ? blockTests
        .slice()
        .reverse() // squat, bench, deadlift — the order they were tested in
        .map((s) => {
          const now = testResultOf(s);
          // The same lift's previous test, from before this block.
          const prior = completedSessions.find(
            (p) =>
              p.sessionType === s.sessionType &&
              p.isTestWeek &&
              !blockTests.some((b) => b.id === p.id)
          );
          const was = prior ? testResultOf(prior) : null;
          const isReps = now.kg === null;
          const value = isReps ? now.reps : now.kg;
          const previous = was ? (isReps ? was.reps : was.kg) : null;
          return {
            lift: getSessionLabel(s.sessionType).replace(/\s*Session$/i, ''),
            value,
            previous,
            delta: value !== null && previous !== null ? value - previous : null,
            isReps,
          };
        })
        .filter((r) => r.value !== null)
    : [];

  // ── The run-up to this test ────────────────────────────────────────────────
  // On a test, today's volume and rep count are meaningless — a two-exercise
  // test is always lighter than a training session, so both tiles read as a
  // decline. What actually matters is the block of work that led here, so the
  // Progress tab shows this lift's top set across every session since the last
  // test of it.
  const heaviestSetOf = (s: CompletedSession): number => {
    let top = 0;
    for (const log of s.exerciseLogs) {
      for (const set of log.sets) {
        if (set.completed && set.weight > top) top = set.weight;
      }
    }
    return top;
  };

  const testBlockSeries = (() => {
    if (!session.isTestWeek) return null;
    const sameLift = completedSessions.filter((s) => s.sessionType === session.sessionType);
    const here = sameLift.findIndex((s) => s.id === session.id);
    if (here === -1) return null;
    // completedSessions is newest-first, so walking forward goes back in time.
    // Stop at the previous test: that is where this block began.
    const block: CompletedSession[] = [];
    for (let i = here + 1; i < sameLift.length; i++) {
      if (sameLift[i].isTestWeek) break;
      block.push(sameLift[i]);
    }
    const points = block
      .reverse() // oldest first, so the chart reads left to right
      .map((s) => ({ kg: heaviestSetOf(s), date: s.date }))
      .filter((p) => p.kg > 0);
    return points.length >= 2 ? points : null;
  })();

  const isTestHero = Boolean(testedOrm) || testedReps !== null;
  const heroKind: 'test' | 'pb' | 'milestone' | 'default' = isTestHero
    ? 'test'
    : isMilestone
      ? 'milestone'
      : bestPbRow
        ? 'pb'
        : 'default';

  const heroNumber =
    heroKind === 'test' && testedOrm
      ? kgToDisplayUnit(testedOrm.weight, weightUnit)
      : heroKind === 'test' && testedReps !== null
        ? testedReps
        : heroKind === 'pb' && bestPbRow
          ? kgToDisplayUnit(bestPbRow.bestWeight, weightUnit)
          : heroKind === 'milestone'
            ? sessionNumber
            : topWeightKg > 0
              ? kgToDisplayUnit(topWeightKg, weightUnit)
              : summary.totalSets;
  const heroUnit =
    heroKind === 'test' && testedReps !== null
      ? testedReps === 1
        ? 'rep'
        : 'reps'
      : heroKind === 'milestone'
        ? ''
        : heroKind === 'default' && topWeightKg === 0
          ? 'sets'
          : weightUnit;
  const heroBadgeLabel =
    heroKind === 'test'
      ? testedReps !== null
        ? `${liftName} max reps`
        : `${liftName} one-rep max`
      : heroKind === 'pb'
        ? 'New personal best'
        : heroKind === 'milestone'
          ? 'Milestone session'
          : null;
  const repsWord = (n: number) => `${n} rep${n === 1 ? '' : 's'}`;

  /**
   * Caption for a test result, in whichever unit that lift is measured in —
   * kilos for a weighted test, reps for a bodyweight one. Covers a drop
   * honestly: plenty of real test weeks go backwards, and saying so is better
   * than the app pretending it did not happen.
   */
  const testCaption = (delta: number | null, format: (n: number) => string): string => {
    if (delta === null) {
      return `Your first tested ${liftName.toLowerCase()} max. This is the number everything else is measured against.`;
    }
    if (delta > 0) {
      return `Up ${format(delta)} on your last test. That is ${liftSessionCount} session${liftSessionCount === 1 ? '' : 's'} of work showing up.`;
    }
    if (delta === 0) return 'Level with your last test. Holding a max is its own result.';
    return `Down ${format(Math.abs(delta))} on your last test. One number on one day. It happens.`;
  };

  const heroCaption =
    heroKind === 'test'
      ? testedReps !== null
        ? testCaption(testDeltaReps, repsWord)
        : testCaption(testDeltaKg, (n) => formatWeight(n, weightUnit))
      : heroKind === 'pb' && bestPbRow
        ? `${bestPbRow.exerciseName}, up ${formatWeight(bestPbRow.deltaWeight, weightUnit)} from last time`
        : heroKind === 'milestone'
          ? bestPbRow
            ? `${sessionNumber} session${sessionNumber === 1 ? '' : 's'}, and a new best on ${bestPbRow.exerciseName}`
            : `${sessionNumber} session${sessionNumber === 1 ? '' : 's'} and counting`
          : streakWeeks >= 1
            ? `${streakWeeks} week${streakWeeks === 1 ? '' : 's'} in a row. Keep it going.`
            : 'Nice work today.';

  // On a test the rail carries the story of this lift rather than today's
  // duration and set count, which are beside the point on a two-exercise test.
  const testRail = (
    previous: string,
    delta: number | null,
    format: (n: number) => string
  ): { label: string; value: string; accent?: boolean }[] => [
    { label: 'Previous', value: previous },
    {
      label: 'Change',
      value: delta === null ? 'First' : `${delta >= 0 ? '+' : '−'}${format(Math.abs(delta))}`,
      accent: delta !== null && delta > 0,
    },
    { label: `${liftName} sessions`, value: String(liftSessionCount) },
  ];

  const stats: { label: string; value: string; accent?: boolean }[] =
    heroKind === 'test' && testedReps !== null
      ? testRail(
          previousTestReps !== null ? repsWord(previousTestReps) : '-',
          testDeltaReps,
          repsWord
        )
      : heroKind === 'test' && testedOrm
        ? testRail(
            previousOrm ? formatWeight(previousOrm.weight, weightUnit) : '-',
            testDeltaKg,
            (n) => formatWeight(n, weightUnit)
          )
        : [
            { label: 'Duration', value: durationLabel },
            { label: 'Sets', value: String(summary.totalSets) },
            // "Muscles" again, and true again. It was renamed to "Areas"
            // because the tally counted the elbow, the knee and the ankle —
            // joints, which nobody trains. Now that the joints resolve to the
            // muscles that move them this counts muscles, and it counts exactly
            // the chips printed under the figures rather than a larger number
            // the reader can't reconcile with them.
            { label: 'Muscles', value: String(workedLabels.length) },
          ];

  return (
    <View style={[styles.container, { backgroundColor: SAGE.outerBg }]}>
      <Stack.Screen options={{ headerShown: false }} />

      <KeyboardAwareScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingTop: topPad + 10,
          paddingHorizontal: 16,
          // The pinned Done footer below owns the safe-area inset now, so this
          // only needs a small gap above it.
          paddingBottom: 12,
        }}
        keyboardShouldPersistTaps="handled"
        bottomOffset={24}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Summary / Progress tab switcher ──

            Painted from SAGE, not from the device theme. This whole screen is a
            fixed cream-and-sage page by design (see CardPalette at the top of
            this file) so the two tabs read as one continuous moment. The
            controls sitting on top of it still followed light/dark, which put
            dark-mode chrome on a cream page for anybody not in light mode. */}
        <View style={styles.tabSwitcherRow}>
          <View style={[styles.tabSwitcher, { backgroundColor: SAGE.pillBg }]}>
            <Pressable
              onPress={() => setActiveTab('summary')}
              style={[styles.tabBtn, activeTab === 'summary' && { backgroundColor: SAGE.cardGradient[0] }]}
              testID="summary-tab-summary"
            >
              <Text
                style={[
                  styles.tabBtnText,
                  { color: activeTab === 'summary' ? SAGE.text : SAGE.faint },
                ]}
              >
                Certificate
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setActiveTab('progress')}
              style={[styles.tabBtn, activeTab === 'progress' && { backgroundColor: SAGE.cardGradient[0] }]}
              testID="summary-tab-progress"
            >
              <Text
                style={[
                  styles.tabBtnText,
                  { color: activeTab === 'progress' ? SAGE.text : SAGE.faint },
                ]}
              >
                Progress
              </Text>
            </Pressable>
          </View>
        </View>

        {activeTab === 'progress' ? (
          <ProgressTab
            rows={summary.rows}
            sessionType={session.sessionType}
            hasWeighted={summary.hasWeighted}
            totalVolumeKg={summary.totalVolumeKg}
            totalReps={summary.totalReps}
            previousTotals={previousTotals}
            isLatestSession={isLatestSession}
            lastSessionPerformance={lastSessionPerformance}
            exerciseRepNote={exerciseRepNote}
            exerciseNormalStreak={exerciseNormalStreak}
            exerciseStuckStreak={exerciseStuckStreak}
            exerciseFeedback={exerciseFeedback}
            weightUnit={weightUnit}
            testBlockSeries={testBlockSeries}
            liftName={liftName}
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
                  <LinearGradient
                    colors={SAGE.cardGradient}
                    style={StyleSheet.absoluteFillObject}
                    pointerEvents="none"
                  />
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
                        <Ionicons name="trophy" size={11} color={SAGE.accent} />
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

                  {/* Cycle results — only on the last test of a block */}
                  {cycleRows.length > 0 && (
                    <Animated.View
                      entering={FadeInDown.duration(500).delay(130)}
                      style={styles.cyclePanel}
                    >
                      <Text style={styles.cycleTitle}>TEST WEEK COMPLETE</Text>
                      {cycleRows.map((r) => (
                        <View key={r.lift} style={styles.cycleRow}>
                          <Text style={styles.cycleLift} numberOfLines={1}>
                            {r.lift}
                          </Text>
                          <Text style={styles.cycleValue}>
                            {r.isReps
                              ? `${r.value} ${r.value === 1 ? 'rep' : 'reps'}`
                              : formatWeight(r.value as number, weightUnit)}
                          </Text>
                          <Text
                            style={[
                              styles.cycleDelta,
                              r.delta !== null && r.delta > 0 && { color: SAGE.accent },
                            ]}
                          >
                            {r.delta === null
                              ? 'first'
                              : r.delta === 0
                                ? 'level'
                                : `${r.delta > 0 ? '+' : '−'}${
                                    r.isReps
                                      ? Math.abs(r.delta)
                                      : formatWeight(Math.abs(r.delta), weightUnit)
                                  }`}
                          </Text>
                        </View>
                      ))}
                    </Animated.View>
                  )}

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

                    {/* WHAT THE SHADING MEANS.
                        The figures show where the work landed, and until now
                        the only way to read them was to recognise a shaded
                        outline — fine for the person who built the app, not for
                        someone glancing at their own summary. Naming the
                        regions costs one line and removes the guesswork.

                        Ordered by how much each was worked, so the heaviest
                        reads first. All of them: this is the key to the figures
                        beside it, and a key that stops halfway is not one. */}
                    {workedLabels.length > 0 && (
                      <View style={styles.workedRow}>
                        {workedLabels.map((label) => (
                          <View key={label} style={styles.workedChip}>
                            <Text style={styles.workedChipText}>{label}</Text>
                          </View>
                        ))}
                      </View>
                    )}
                  </Animated.View>

                  {/* Footer */}
                  <View style={styles.cardFooter}>
                    {streakWeeks >= 1 ? (
                      <View style={styles.footerStreak}>
                        <Ionicons name="flame" size={13} color={SAGE.accent} />
                        <Text style={styles.footerStreakText}>
                          {streakWeeks} week{streakWeeks > 1 ? 's' : ''} in a row
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
                <Ionicons name="thumbs-up-outline" size={18} color={SAGE.text} />
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
                  color={SAGE.text}
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
                <Ionicons name="share-outline" size={18} color={SAGE.cardGradient[0]} />
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
      </KeyboardAwareScrollView>

      {/* Pinned footer — Done sits outside the scroll view so it is always on
          screen. It used to be the last child after the notes field, which
          buried it below the fold and left people scrolling to leave. Same
          pattern as the Recover tab's footer. */}
      <View style={[styles.doneFooter, { paddingBottom: bottomPad + 12 }]}>
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
                <Ionicons name="thumbs-up-outline" size={24} color={C.primaryText} />
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
                      accessibilityLabel="Rate this exercise good"
                      accessibilityRole="button"
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
                      accessibilityLabel="Rate this exercise tough"
                      accessibilityRole="button"
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

      {/* Celebrate what this session earned, here, where it was earned.
          Rendered inside this screen rather than as a root <Modal> — see the
          note in components/AchievementBanner.tsx; a Modal here would be a
          second native modal over this screen's own fullScreenModal
          presentation, which is what froze the app after a session.
          Rendered LAST so it paints above the scroll view rather than under it.
          Tapping pushes /achievements onto the stack, so its back button
          returns straight here. */}
      {sessionBadges.length > 0 && (
        <AchievementBanner
          badges={sessionBadges}
          onPress={() => router.push('/achievements')}
          onDone={() => setSessionBadges([])}
        />
      )}
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
    // card itself clips to its rounded corners (overflow: hidden, for the
    // gradient fill), so the drop shadow that separates it from the ecru
    // surround has to live on this unclipped wrapper instead.
    ...elevatedShadow(SAGE.text),
  },
  card: {
    borderRadius: 24,
    overflow: 'hidden',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 16,
    borderWidth: 1,
    borderColor: SAGE.hairline,
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
    color: SAGE.muted,
    letterSpacing: 2.5,
  },
  dateText: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
    color: SAGE.faint,
    fontVariant: ['tabular-nums'],
  },

  // Hero - the single biggest thing that happened this session
  heroPanel: {
    backgroundColor: SAGE.pillBg,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: SAGE.hairline,
    paddingVertical: 22,
    paddingHorizontal: 18,
    alignItems: 'center',
  },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: SAGE.badgeBg,
    borderWidth: 1,
    borderColor: SAGE.hairline,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginBottom: 14,
  },
  heroBadgeText: {
    fontSize: 10,
    fontFamily: 'Inter_700Bold',
    color: SAGE.accent,
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
    color: SAGE.text,
    fontVariant: ['tabular-nums'],
  },
  heroUnit: {
    fontSize: 18,
    fontFamily: 'Inter_600SemiBold',
    color: SAGE.muted,
    paddingBottom: 8,
  },
  heroCaption: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    color: SAGE.muted,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
  },
  heroExtra: {
    fontSize: 11.5,
    fontFamily: 'Inter_600SemiBold',
    color: SAGE.accent,
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
    color: SAGE.text,
  },
  heroDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: SAGE.faint,
  },
  heroSessionNum: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
    color: SAGE.faint,
  },
  testPill: {
    backgroundColor: SAGE.badgeBg,
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 2,
    marginLeft: 2,
  },
  testPillText: {
    fontSize: 8,
    fontFamily: 'Inter_700Bold',
    color: SAGE.accent,
    letterSpacing: 0.8,
  },

  // Cycle results — all three tested lifts, shown on the last test of a block
  cyclePanel: {
    backgroundColor: SAGE.pillBg,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: SAGE.hairline,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 12,
    gap: 8,
  },
  cycleTitle: {
    fontSize: 9,
    fontFamily: 'Inter_700Bold',
    color: SAGE.faint,
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  cycleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  cycleLift: {
    flex: 1,
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
    color: SAGE.muted,
  },
  cycleValue: {
    fontSize: 15,
    fontFamily: 'Inter_700Bold',
    color: SAGE.text,
  },
  cycleDelta: {
    minWidth: 54,
    textAlign: 'right',
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
    color: SAGE.faint,
  },

  // Stat rail
  statRail: {
    flexDirection: 'row',
    gap: 10,
  },
  statTile: {
    flex: 1,
    backgroundColor: SAGE.pillBg,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: SAGE.hairline,
    paddingVertical: 11,
    paddingHorizontal: 8,
    alignItems: 'center',
    gap: 4,
  },
  statLabel: {
    fontSize: 9,
    fontFamily: 'Inter_700Bold',
    color: SAGE.faint,
    letterSpacing: 0.6,
  },
  statValue: {
    fontSize: 16,
    fontFamily: 'Inter_700Bold',
    color: SAGE.text,
    fontVariant: ['tabular-nums'],
  },

  // Body diagram panel
  mapPanel: {
    backgroundColor: SAGE.pillBg,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: SAGE.hairline,
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
  workedRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 5,
    marginTop: 10,
    paddingHorizontal: 4,
  },
  workedChip: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 7,
    backgroundColor: SAGE.pillBg,
  },
  workedChipText: {
    fontSize: 9.5,
    fontFamily: 'Inter_600SemiBold',
    color: SAGE.muted,
  },
  diagramLabel: {
    fontSize: 9,
    fontFamily: 'Inter_600SemiBold',
    color: SAGE.faint,
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
    color: SAGE.muted,
  },
  footerBrand: {
    fontSize: 11,
    fontFamily: 'Inter_500Medium',
    color: SAGE.faint,
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
    backgroundColor: SAGE.pillBg,
    borderColor: SAGE.hairline,
  },
  actionBtnText: {
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
    color: SAGE.text,
  },
  actionBtnPrimary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: SAGE.accent,
  },
  actionBtnPrimaryText: {
    fontSize: 15,
    fontFamily: 'Inter_700Bold',
    color: SAGE.cardGradient[0],
  },

  // ── Done ────────────────────────────────────────────────────────────────────
  // Footer is a flex sibling of the scroll view, not an overlay, so content
  // never scrolls underneath it. Bottom padding is applied inline from the
  // safe-area inset.
  doneFooter: {
    paddingHorizontal: 16,
    paddingTop: 4,
  },
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
