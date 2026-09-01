/**
 * THE PROGRAMME, ON THE STATS SCREEN.
 *
 * WHY IT WAS MISSING
 * ──────────────────
 * Stats was built when the app's only unit of progress was an exercise: your
 * heaviest lifts, your one-rep maxes, your personal bests. Archie, after using
 * the programmes: "the stats will also need a revamp to focus more on the
 * program side of things rather than individual exercises."
 *
 * He is right, and the gap is bigger than "add a card". Everything on Overview
 * counted sessions in the abstract - this week, this streak, all time - and
 * nothing anywhere told somebody how their BLOCK was going, which is now the
 * thing they are actually doing.
 *
 * WHAT IT SHOWS THAT NOTHING ELSE DID
 * ───────────────────────────────────
 * The split. Sessions the programme asked for, and sessions they chose
 * themselves, side by side and both counted. The app has promised from the day
 * programmes landed that training something else costs you nothing; this is the
 * first screen that proves it with a number rather than saying it in a sentence.
 *
 * And the pace: sessions a week over the block so far, against the frequency
 * they signed up for. That is the number that predicts whether somebody
 * finishes, and it is measured rather than assumed.
 *
 * EVERY FIGURE IS DERIVED FROM THE HISTORY. Nothing here is stored, so nothing
 * here can disagree with the sessions list.
 */
import React, { useMemo } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors, useGoColors } from '@/constants/colors';
import { SESSION_SHORT_LABELS } from '@/lib/session-meta';
import { useAppStore } from '@/lib/store';
import { blockPlan, cycleOf, nameOf, programmeDifficulty } from '@/lib/programme';

/** How many block pips to draw before they stop being readable at 390pt. */
const MAX_PIPS = 20;

export function ProgrammeStats() {
  const C = useColors();
  const go = useGoColors();
  const styles = useMemo(() => makeStyles(C), [C]);

  const programme = useAppStore((s) => s.programme);
  const completedSessions = useAppStore((s) => s.completedSessions);
  const getProgrammePosition = useAppStore((s) => s.getProgrammePosition);
  const experienceLevel = useAppStore((s) => s.userProfile?.experienceLevel);

  const position = programme ? getProgrammePosition() : null;

  /**
   * Sessions a week since the block started, measured off the calendar.
   *
   * Null until a week has actually gone by. A pace worked out from three days
   * is a number that says "21 a week" and then falls for a month, which reads
   * as going backwards while somebody trains perfectly well.
   */
  const pace = useMemo(() => {
    if (!programme) return null;
    const started = new Date(programme.startedAt).getTime();
    if (!Number.isFinite(started)) return null;
    const weeksElapsed = (Date.now() - started) / (7 * 86400000);
    if (weeksElapsed < 1) return null;
    const since = completedSessions.filter(
      (s) => new Date(s.date).getTime() >= started
    ).length;
    return since / weeksElapsed;
  }, [programme, completedSessions]);

  if (!programme || !position) return null;

  const cycle = cycleOf(programme);
  const difficulty = programmeDifficulty(
    programme.templateId,
    experienceLevel ?? 'beginner',
    programme.days,
    cycle
  );
  const plan = blockPlan(programme);
  const pct = Math.min(100, Math.round((position.onPlan / position.totalSessions) * 100));
  const left = Math.max(0, position.totalSessions - position.onPlan);

  return (
    <Pressable
      onPress={() => {
        if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        router.push('/program');
      }}
      testID="stats-programme"
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.92 }]}
    >
      <View style={styles.head}>
        <View style={{ flex: 1 }}>
          <Text style={styles.eyebrow}>YOUR PROGRAMME</Text>
          <Text style={styles.name} numberOfLines={1}>
            {nameOf(programme)}
          </Text>
        </View>
        <View style={styles.pill}>
          <Text style={styles.pillText}>{difficulty.label.toUpperCase()}</Text>
        </View>
      </View>

      <View style={styles.progressRow}>
        <Text style={styles.big}>
          {Math.min(position.onPlan + 1, position.totalSessions)}
          <Text style={styles.bigOf}> of {position.totalSessions}</Text>
        </Text>
        <Text style={styles.left}>
          {position.complete ? 'Block complete' : `${left} to go`}
        </Text>
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${pct}%`, backgroundColor: go.fill }]} />
      </View>

      {/* Every session in the block, in order, so the shape of it is visible
          rather than described. Capped, because past twenty a row of pips on a
          390pt screen is a texture rather than a count. */}
      {plan.length <= MAX_PIPS && (
        <View style={styles.pips}>
          {plan.map((p, i) => (
            <View
              key={`${p.type}-${i}`}
              style={[
                styles.pip,
                i < position.onPlan && { backgroundColor: go.fill },
                i === position.onPlan && { borderColor: go.fill, borderWidth: 2 },
              ]}
            />
          ))}
        </View>
      )}

      <View style={styles.rule} />

      <View style={styles.stats}>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{position.onPlan}</Text>
          <Text style={styles.statLabel}>on the plan</Text>
        </View>
        <View style={styles.statDivide} />
        <View style={styles.stat}>
          {/* The number the app has been promising and never showing. */}
          <Text style={styles.statValue}>{position.offPlan}</Text>
          <Text style={styles.statLabel}>your own choice</Text>
        </View>
        <View style={styles.statDivide} />
        <View style={styles.stat}>
          {/* Their aim until there is a week to measure, then the measurement.
              A dash would have been the obvious placeholder and the repo's own
              voice rule refuses dashes, which turned out to be the better
              answer anyway: the number they signed up for is more use to
              somebody three days in than an empty box. */}
          <Text style={styles.statValue}>
            {pace === null ? programme.days : pace.toFixed(1)}
          </Text>
          <Text style={styles.statLabel}>
            {pace === null ? 'a week, your aim' : 'a week so far'}
          </Text>
        </View>
      </View>

      <Text style={styles.foot} numberOfLines={1}>
        {cycle.map((t) => SESSION_SHORT_LABELS[t]).join(' · ')}
        {pace !== null && pace + 0.25 < programme.days
          ? `  ·  aiming for ${programme.days}`
          : ''}
      </Text>

      <View style={styles.openRow}>
        <Text style={styles.openText}>Open your programme</Text>
        <Ionicons name="chevron-forward" size={14} color={C.primaryText} />
      </View>
    </Pressable>
  );
}

function makeStyles(C: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    card: {
      borderRadius: 18,
      padding: 16,
      backgroundColor: C.surface,
      borderWidth: 1,
      borderColor: C.border,
      gap: 10,
    },
    head: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
    eyebrow: {
      fontSize: 9.5,
      letterSpacing: 1.2,
      fontFamily: 'Inter_700Bold',
      color: C.textTertiary,
    },
    name: {
      fontSize: 20,
      fontFamily: 'Inter_700Bold',
      color: C.text,
      letterSpacing: -0.4,
      marginTop: 2,
    },
    pill: {
      paddingHorizontal: 9,
      paddingVertical: 4,
      borderRadius: 6,
      backgroundColor: C.primaryMuted,
    },
    pillText: {
      fontSize: 9.5,
      letterSpacing: 0.9,
      fontFamily: 'Inter_700Bold',
      color: C.primaryText,
    },

    progressRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
    big: { fontSize: 26, fontFamily: 'Inter_700Bold', color: C.text, letterSpacing: -0.8 },
    bigOf: { fontSize: 15, fontFamily: 'Inter_500Medium', color: C.textSecondary },
    left: { fontSize: 12, fontFamily: 'Inter_500Medium', color: C.textTertiary },

    track: { height: 7, borderRadius: 4, backgroundColor: C.surfaceSecondary, overflow: 'hidden' },
    fill: { height: '100%', borderRadius: 4 },

    pips: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 2 },
    pip: {
      width: 9,
      height: 9,
      borderRadius: 5,
      backgroundColor: C.surfaceSecondary,
      borderWidth: 0,
      borderColor: 'transparent',
    },

    rule: { height: 1, backgroundColor: C.borderLight, marginVertical: 2 },

    stats: { flexDirection: 'row', alignItems: 'center' },
    stat: { flex: 1, alignItems: 'center' },
    statDivide: { width: 1, height: 26, backgroundColor: C.borderLight },
    statValue: {
      fontSize: 19,
      fontFamily: 'Inter_700Bold',
      color: C.text,
      fontVariant: ['tabular-nums'],
    },
    statLabel: {
      fontSize: 10.5,
      fontFamily: 'Inter_500Medium',
      color: C.textTertiary,
      marginTop: 1,
    },

    foot: { fontSize: 11.5, fontFamily: 'Inter_500Medium', color: C.textTertiary },

    openRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    openText: { fontSize: 12.5, fontFamily: 'Inter_600SemiBold', color: C.primaryText },
  });
}
