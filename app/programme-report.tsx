/**
 * THE PROGRAMME REPORT: the ending a block never had.
 *
 * WHAT IT REPLACES. Finishing the twelfth session of twelve showed a chip
 * reading "Block complete" in two places, and then nothing. No moment, no
 * numbers, and no question about what came next - the app simply carried on
 * suggesting session thirteen of twelve.
 *
 * WHY IT LOOKS LIKE THIS. It is printed on the same parchment as the
 * certificate somebody was handed at the START of the block, because that is
 * what it is: the other end of the same document. A block opens with a page that
 * says what you are about to do and closes with a page that says what you did.
 * Everything else in the app is themed; these two are not, so both read as
 * objects you were given rather than as screens you were shown.
 *
 * WHY IT SCROLLS RATHER THAN FLIPPING. The certificate is a booklet because it
 * is six short pages of promises. This is a record of weeks of work, and Archie
 * asked for it to be extensive. Paging something you want to read end to end
 * hides most of it behind a gesture.
 *
 * EVERY NUMBER ON IT IS FROZEN. The report is built once, when the block
 * finishes, and stored - see lib/programme-report.ts. This screen formats; it
 * does not compute. That is what stops the document changing under somebody who
 * later deletes a session or edits their cycle.
 */
import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Platform, Image } from 'react-native';
import { router, useLocalSearchParams, Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';

import { useColors } from '@/constants/colors';
import { useAppStore } from '@/lib/store';
import { PAGE } from '@/lib/session-identity';
/**
 * The one green, on paper.
 *
 * Parchment is a light surface in both themes, so it takes the LIGHT go colour
 * whichever theme the reader is running. Reading it from here rather than
 * writing the hex down again is the whole point of lib/go-colors.ts.
 */
import { GO } from '@/lib/go-colors';
import { SESSION_DISPLAY_NAMES } from '@/lib/session-meta';
import { getPainRegionLabel } from '@/lib/workout-engine';
import { LEVEL_NAMES } from '@/lib/exercise-levels';
import type { CompletedProgramme, ProgrammeReport } from '@/lib/programme-report';
import { formatWeight, kgToDisplayUnit } from '@/lib/utils';
import { useReducedMotion } from '@/lib/use-reduced-motion';

const WEB_TOP_INSET = 67;
const WEB_BOTTOM_INSET = 34;

/** A whole number with thousands separators, for the big counts. */
const grouped = (n: number) => Math.round(n).toLocaleString();

const dayMonth = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
const longDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });

/** "3 h 40" for anything over an hour, "40 min" below it. */
function readableMinutes(mins: number): { value: string; unit: string } {
  if (mins < 90) return { value: String(Math.round(mins)), unit: 'minutes' };
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  return { value: m === 0 ? `${h}` : `${h}.${Math.round((m / 60) * 10)}`, unit: 'hours' };
}

/**
 * What a report written before the deload rule changed called its easier weeks.
 *
 * Reports are frozen at the moment they are built and are never recomputed, so
 * an archive from before the change still holds deloadWeeksDone and a count in
 * weeks. Reading it here keeps that line on the document instead of quietly
 * dropping it, and the wording stays the wording that was true on the day.
 */
function legacyDeloadWeeks(r: unknown): number {
  const n = (r as { deloadWeeksDone?: unknown })?.deloadWeeksDone;
  return typeof n === 'number' && Number.isFinite(n) ? n : 0;
}

export default function ProgrammeReportScreen() {
  const C = useColors();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const params = useLocalSearchParams<{ id?: string }>();

  const completedProgrammes = useAppStore((s) => s.completedProgrammes);
  const pendingId = useAppStore((s) => s.pendingProgrammeReportId);
  const clearPending = useAppStore((s) => s.clearPendingProgrammeReport);
  const acceptLevelStep = useAppStore((s) => s.acceptLevelStep);
  /** Rungs held right now, so a report already acted on says so. */
  const earnedBonus = useAppStore((s) => s.userProfile.earnedLevelBonus ?? 0);
  const switchProgramme = useAppStore((s) => s.switchProgramme);
  const weightUnit = useAppStore((s) => s.weightUnit);
  const name = useAppStore((s) => s.userProfile.name);

  /**
   * The block being reported on.
   *
   * An explicit id wins, so the archive can open any of them. Without one this
   * is the report that has just been earned, which is how the screen is reached
   * from the session summary and from Home.
   */
  const block: CompletedProgramme | null = useMemo(() => {
    const wanted = params.id ?? pendingId;
    if (!wanted) return completedProgrammes[completedProgrammes.length - 1] ?? null;
    return completedProgrammes.find((c) => c.id === wanted) ?? null;
  }, [params.id, pendingId, completedProgrammes]);

  /**
   * Reading it is what marks it as seen.
   *
   * Deliberately on mount rather than on the way out: somebody who reads the
   * report and then closes the app from inside it has still read it, and being
   * handed it a second time reads as the app losing track rather than as
   * generosity.
   */
  React.useEffect(() => {
    if (block && pendingId && block.id === pendingId) clearPending();
  }, [block, pendingId, clearPending]);

  const topPad = Platform.OS === 'web' ? WEB_TOP_INSET : insets.top;
  const bottomPad = Platform.OS === 'web' ? WEB_BOTTOM_INSET : insets.bottom;
  const styles = useMemo(() => makeStyles(C), [C]);

  if (!block) {
    return (
      <View style={[styles.screen, { paddingTop: topPad + 24 }]} testID="programme-report-empty">
        <Stack.Screen options={{ headerShown: false }} />
        <Text style={styles.emptyTitle}>No report to show</Text>
        <Text style={styles.emptyBody}>
          A report is written the moment you finish a block. Once you have one, it is kept here
          for good.
        </Text>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [styles.emptyBtn, pressed && { opacity: 0.85 }]}
        >
          <Text style={styles.emptyBtnText}>Back</Text>
        </Pressable>
      </View>
    );
  }

  const r: ProgrammeReport = block.report;
  const isFresh = pendingId === block.id || params.id === undefined;

  // ── The headline ─────────────────────────────────────────────────────────
  //
  // The report layer decides WHICH fact goes in the biggest type; this decides
  // what it says, because a weight has to be spoken in the reader's own unit and
  // that is a fact about today rather than about the block.
  const headline = (() => {
    const h = r.highlight;
    if (!h) return { value: String(r.onPlan), unit: '', caption: 'sessions in the block' };
    if (h.kind === 'lift') {
      const gain = kgToDisplayUnit(h.move.deltaKg, weightUnit);
      return {
        value: `+${gain < 10 ? gain.toFixed(1) : Math.round(gain)}`,
        unit: weightUnit,
        caption: `on your ${h.move.exerciseName}, over ${h.move.appearances} sessions`,
      };
    }
    if (h.kind === 'volume') {
      return {
        value: grouped(kgToDisplayUnit(h.kg, weightUnit)),
        unit: weightUnit,
        caption: 'lifted across the whole block',
      };
    }
    return { value: String(h.count), unit: '', caption: 'sessions finished' };
  })();

  const enter = (delay: number) =>
    reduceMotion ? undefined : FadeInDown.duration(420).delay(delay);

  const time = readableMinutes(r.minutesTrained);

  /** The stat grid. Every entry is a number the app actually recorded. */
  const stats: { value: string; unit?: string; label: string }[] = [
    { value: String(r.onPlan), label: `of ${r.blockLength} on the plan` },
    { value: String(r.offPlan), label: 'you chose yourself' },
    { value: String(block.weeks), label: 'weeks it was written for' },
    { value: String(r.spanDays), label: 'days it actually took' },
    { value: time.value, unit: time.unit, label: 'under the bar' },
    { value: grouped(r.totalSets), label: 'sets logged' },
    { value: grouped(r.totalReps), label: 'reps logged' },
    ...(r.volumeKg > 0
      ? [
          {
            value: grouped(kgToDisplayUnit(r.volumeKg, weightUnit)),
            unit: weightUnit,
            label: 'total weight moved',
          },
        ]
      : []),
    { value: String(r.distinctExercises), label: 'different exercises' },
  ];

  const startAnother = () => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    switchProgramme(block.templateId, new Date().toISOString());
    router.replace('/program');
  };

  return (
    <View style={[styles.screen, { paddingTop: topPad }]}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.topBar}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.6 }]}
          testID="report-back"
          accessibilityLabel="Back"
          accessibilityRole="button"
        >
          <Ionicons name="chevron-back" size={24} color={C.text} />
        </Pressable>
        <Text style={styles.topBarTitle} numberOfLines={1}>
          Programme report
        </Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[styles.scroll, { paddingBottom: bottomPad + 40 }]}
        showsVerticalScrollIndicator={false}
        testID="programme-report"
      >
        {/* ── 1. THE MOMENT ──────────────────────────────────────────────── */}
        <Animated.View entering={enter(0)} style={styles.sheet}>
          <LinearGradient
            colors={[PAGE.bg, PAGE.bgEdge]}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />

          {/* The seal. A ring, a mark and a word, and it is the first thing on
              the page for the same reason a medal is the first thing in the box:
              what happened here is that they finished something. */}
          <View style={styles.sealRing}>
            <View style={styles.sealInner}>
              <Image
                source={require('@/assets/images/logo.png')}
                style={styles.sealMark}
                resizeMode="cover"
              />
            </View>
          </View>

          <Text style={styles.eyebrow}>BLOCK COMPLETE</Text>
          <Text style={styles.blockName} testID="report-name">
            {block.name}
          </Text>
          <Text style={styles.blockDates}>
            {dayMonth(block.startedAt)} to {dayMonth(block.finishedAt)} · {r.onPlan} of{' '}
            {r.blockLength} sessions
          </Text>

          <View style={styles.headlineWrap} testID="report-headline">
            <View style={styles.headlineRow}>
              <Text style={styles.headlineValue} numberOfLines={1} adjustsFontSizeToFit>
                {headline.value}
              </Text>
              {!!headline.unit && <Text style={styles.headlineUnit}>{headline.unit}</Text>}
            </View>
            <Text style={styles.headlineCaption}>{headline.caption}</Text>
          </View>

          <View style={styles.sealFoot}>
            <View style={styles.rule} />
            <Text style={styles.sealFootText}>
              Issued to {name || 'you'} on {longDate(block.finishedAt)} · Grow Performance and
              Rehabilitation
            </Text>
          </View>
        </Animated.View>

        {/* ── 2. THE NUMBERS ─────────────────────────────────────────────── */}
        <Animated.View entering={enter(70)} style={styles.sheet}>
          <Text style={styles.sectionTitle}>The block, in numbers</Text>
          <Text style={styles.sectionSub}>
            Everything you did while this block was running, whether it was on the plan or not.
          </Text>
          <View style={styles.statGrid} testID="report-stats">
            {stats.map((s) => (
              <View key={s.label} style={styles.stat}>
                <View style={styles.statValueRow}>
                  <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit>
                    {s.value}
                  </Text>
                  {!!s.unit && <Text style={styles.statUnit}>{s.unit}</Text>}
                </View>
                <Text style={styles.statLabel}>{s.label}</Text>
              </View>
            ))}
          </View>

          <View style={styles.rule} />
          <Text style={styles.line}>
            You trained {r.perWeek} times a week over that stretch, against the{' '}
            {r.plannedPerWeek} the block was written for.
            {/* Sessions, not weeks. The easier stretch is placed by session
                count now, and a window trimmed to keep the last session normal
                is not a whole week off.

                A REPORT IS FROZEN THE DAY IT IS WRITTEN, so a block finished
                before this change carries the old field and the old unit. It
                still gets its sentence, in the words that were true when it was
                issued, rather than silently losing a line off a document
                somebody may have shared. */}
            {r.deloadSessionsDone > 0
              ? ` ${r.deloadSessionsDone === 1 ? 'One session of it was' : `${r.deloadSessionsDone} sessions of it were`} a planned easier one.`
              : legacyDeloadWeeks(r) > 0
                ? ` ${legacyDeloadWeeks(r) === 1 ? 'One week of it was' : `${legacyDeloadWeeks(r)} weeks of it were`} a planned easier week.`
                : ''}
          </Text>
          <View style={styles.typeRow}>
            {r.byType.map((t) => (
              <View key={t.type} style={styles.typeChip}>
                <Text style={styles.typeChipText}>
                  {SESSION_DISPLAY_NAMES[t.type]} · {t.count}
                </Text>
              </View>
            ))}
          </View>
        </Animated.View>

        {/* ── 3. WHAT MOVED ──────────────────────────────────────────────── */}
        {(r.movers.length > 0 || r.slipped.length > 0) && (
          <Animated.View entering={enter(140)} style={styles.sheet} testID="report-movers">
            <Text style={styles.sectionTitle}>What moved</Text>
            <Text style={styles.sectionSub}>
              Your first session of the block against your last. Extra reps at the same weight
              count, because that is how the app adds load: reps first, then a plate.
            </Text>
            {r.movers.map((m, i) => (
              <View
                key={m.exerciseId}
                style={[styles.moveRow, i === r.movers.length - 1 && styles.moveRowLast]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.moveName} numberOfLines={1}>
                    {m.exerciseName}
                  </Text>
                  <Text style={styles.moveDetail}>
                    {formatWeight(m.fromKg, weightUnit)} × {m.fromReps} to{' '}
                    {formatWeight(m.toKg, weightUnit)} × {m.toReps}
                  </Text>
                </View>
                <Text style={styles.moveDelta}>
                  +{formatWeight(m.deltaKg, weightUnit)}
                </Text>
              </View>
            ))}
            {r.slipped.length > 0 && (
              <>
                {/* Named plainly, and not hidden. A report that only ever
                    reports gains is a report nobody can trust the good news in,
                    and this is the half a physiotherapist reads first. */}
                <View style={styles.rule} />
                <Text style={styles.sectionSub}>
                  And what went the other way. Worth knowing rather than worth worrying about:
                  a lift often dips while something else is climbing hard.
                </Text>
                {r.slipped.map((m, i) => (
                  <View
                    key={m.exerciseId}
                    style={[styles.moveRow, i === r.slipped.length - 1 && styles.moveRowLast]}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.moveName} numberOfLines={1}>
                        {m.exerciseName}
                      </Text>
                      <Text style={styles.moveDetail}>
                        {formatWeight(m.fromKg, weightUnit)} × {m.fromReps} to{' '}
                        {formatWeight(m.toKg, weightUnit)} × {m.toReps}
                      </Text>
                    </View>
                    <Text style={[styles.moveDelta, styles.moveDeltaDown]}>
                      −{formatWeight(Math.abs(m.deltaKg), weightUnit)}
                    </Text>
                  </View>
                ))}
              </>
            )}
          </Animated.View>
        )}

        {/* ── 4. FIRSTS ──────────────────────────────────────────────────── */}
        {r.personalBests.length > 0 && (
          <Animated.View entering={enter(200)} style={styles.sheet} testID="report-bests">
            <Text style={styles.sectionTitle}>
              {r.personalBests.length === 1 ? 'A personal best' : 'Personal bests'}
            </Text>
            <Text style={styles.sectionSub}>
              Weights you had never lifted before this block began.
            </Text>
            {r.personalBests.map((b) => (
              <View key={b.exerciseName} style={styles.bestRow}>
                <Ionicons name="trophy" size={14} color={GO.light.fill} />
                <Text style={styles.bestName} numberOfLines={1}>
                  {b.exerciseName}
                </Text>
                <Text style={styles.bestValue}>
                  {formatWeight(b.kg, weightUnit)} × {b.reps}
                </Text>
              </View>
            ))}
          </Animated.View>
        )}

        {/* ── 5. HOW IT WENT ─────────────────────────────────────────────── */}
        <Animated.View entering={enter(260)} style={styles.sheet} testID="report-how">
          <Text style={styles.sectionTitle}>How it went</Text>
          <Text style={styles.line}>
            {r.cleanSessions} of your {r.onPlan + r.offPlan} sessions were finished without leaving
            a set behind.
            {r.effort.rated > 0
              ? ` You rated ${r.effort.rated} exercises along the way, ${r.effort.hard} of them hard.`
              : ' You did not rate any of the work, which is the one number the app cannot get any other way.'}
          </Text>
          {r.acheSessions > 0 ? (
            <Text style={styles.line}>
              Something was sore on {r.acheSessions}{' '}
              {r.acheSessions === 1 ? 'session' : 'sessions'}
              {r.acheRegions.length > 0
                ? `, mostly ${r.acheRegions.map((x) => getPainRegionLabel(x).toLowerCase()).join(' and ')}`
                : ''}
              .{' '}
              {r.acheTrend === 'settled'
                ? 'It came up less often in the second half than the first, which is the direction you want.'
                : r.acheTrend === 'worse'
                  ? 'It came up more often in the second half than the first. Worth mentioning to a clinician, and Return to Lifting is built for exactly this.'
                  : 'It came up about as often throughout.'}
            </Text>
          ) : (
            <Text style={styles.line}>
              Nothing was flagged as sore at any point in this block.
            </Text>
          )}
          {r.testSessions > 0 && (
            <Text style={styles.line}>
              {r.testSessions} of them were strength tests, so the weights you finished on are
              measured rather than estimated.
            </Text>
          )}
        </Animated.View>

        {/* ── 6. THE STEP UP ─────────────────────────────────────────────── */}
        <Animated.View entering={enter(320)} style={styles.sheet} testID="report-step">
          <Text style={styles.sectionTitle}>
            {r.step.earned ? 'You earned a step up' : 'Where your level sits'}
          </Text>
          <Text style={styles.line}>{r.step.because}</Text>

          {r.step.earned && (
            <View style={styles.stepPanel}>
              <View style={styles.stepFromTo}>
{/* The rung sessions are BUILT on at each end, which is the thing
                    that changes. Showing the ceilings instead read "Range and
                    asymmetry to Elite" after one finished block, which names
                    the highest thing unlocked rather than what happened. */}
                <View style={styles.stepEnd}>
                  <Text style={styles.stepEndLabel}>BUILT ON NOW</Text>
                  <Text style={styles.stepEndValue}>{LEVEL_NAMES[r.step.fromBand.prefer]}</Text>
                </View>
                <Ionicons name="arrow-forward" size={16} color={PAGE.inkFaint} />
                <View style={styles.stepEnd}>
                  <Text style={styles.stepEndLabel}>NEXT BLOCK</Text>
                  <Text style={[styles.stepEndValue, { color: GO.light.fill }]}>
                    {LEVEL_NAMES[r.step.toBand.prefer]}
                  </Text>
                </View>
              </View>
              <Text style={styles.stepNote}>
                One rung of the movement ladder, not a jump to a different plan. Nothing changes
                until you say so, and the level control in your programme is still yours.
              </Text>
              {/* Read from what is held NOW rather than from the frozen
                  report, so reopening a report acted on months ago says taken
                  instead of offering the same rung a second time. */}
              {earnedBonus >= r.step.toBonus ? (
                <View style={styles.stepTaken} testID="report-step-taken">
                  <Ionicons name="checkmark-circle" size={16} color={GO.light.fill} />
                  <Text style={styles.stepTakenText}>
                    Taken. Your sessions are built on{' '}
                    {LEVEL_NAMES[r.step.toBand.prefer].toLowerCase()} movements from here.
                  </Text>
                </View>
              ) : (
                <Pressable
                  onPress={() => {
                    if (Platform.OS !== 'web')
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    acceptLevelStep(r.step.toBonus);
                  }}
                  testID="report-step-accept"
                  style={({ pressed }) => [
                    styles.stepBtn,
                    { backgroundColor: GO.light.fill },
                    pressed && { opacity: 0.9 },
                  ]}
                >
                  <Text style={[styles.stepBtnText, { color: GO.light.on }]}>
                    Take the step up
                  </Text>
                </Pressable>
              )}
            </View>
          )}
        </Animated.View>

        {/* ── 7. WHAT NEXT ───────────────────────────────────────────────── */}
        {isFresh && (
          <Animated.View entering={enter(380)} style={styles.sheet} testID="report-next">
            <Text style={styles.sectionTitle}>What next</Text>
            <Text style={styles.sectionSub}>
              Nothing has changed on its own. You are still on {block.name} until you pick
              something, and everything you have logged stays whatever you choose.
            </Text>
            <Pressable
              onPress={startAnother}
              testID="report-another-block"
              style={({ pressed }) => [
                styles.primaryBtn,
                { backgroundColor: GO.light.fill },
                pressed && { opacity: 0.9 },
              ]}
            >
              <Text style={[styles.primaryBtnText, { color: GO.light.on }]}>
                Another block of {block.name}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => router.replace('/program')}
              testID="report-choose-other"
              style={({ pressed }) => [styles.secondaryBtn, pressed && { opacity: 0.85 }]}
            >
              <Text style={styles.secondaryBtnText}>Choose a different programme</Text>
            </Pressable>
            <Pressable
              onPress={() => router.back()}
              testID="report-decide-later"
              style={({ pressed }) => [styles.quietBtn, pressed && { opacity: 0.7 }]}
            >
              <Text style={styles.quietBtnText}>Decide later</Text>
            </Pressable>
          </Animated.View>
        )}

        <Pressable
          onPress={() => router.push('/completed-programmes')}
          testID="report-open-archive"
          style={({ pressed }) => [styles.archiveLink, pressed && { opacity: 0.7 }]}
        >
          <Ionicons name="albums-outline" size={15} color={C.textSecondary} />
          <Text style={styles.archiveLinkText}>
            This is kept in Completed Programmes, for good
          </Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const makeStyles = (C: ReturnType<typeof useColors>) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: C.background },
    topBar: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 12,
      paddingBottom: 8,
      gap: 8,
    },
    backBtn: { padding: 4 },
    topBarTitle: {
      flex: 1,
      fontSize: 15,
      fontFamily: 'Inter_600SemiBold',
      color: C.text,
    },
    scroll: { paddingHorizontal: 16, gap: 14 },

    // The sheet. Same paper as the certificate at the other end of the block.
    sheet: {
      backgroundColor: PAGE.bg,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: PAGE.bgEdge,
      padding: 20,
      overflow: 'hidden',
      gap: 10,
    },

    sealRing: {
      alignSelf: 'center',
      width: 62,
      height: 62,
      borderRadius: 31,
      borderWidth: 2,
      borderColor: GO.light.fill,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 2,
    },
    sealInner: {
      width: 48,
      height: 48,
      borderRadius: 24,
      overflow: 'hidden',
      alignItems: 'center',
      justifyContent: 'center',
    },
    sealMark: { width: '100%', height: '100%' },

    eyebrow: {
      alignSelf: 'center',
      fontSize: 10,
      fontFamily: 'Inter_700Bold',
      color: GO.light.fill,
      letterSpacing: 1.6,
    },
    blockName: {
      alignSelf: 'center',
      textAlign: 'center',
      fontSize: 24,
      fontFamily: 'Inter_700Bold',
      color: PAGE.ink,
      letterSpacing: -0.5,
    },
    blockDates: {
      alignSelf: 'center',
      textAlign: 'center',
      fontSize: 12,
      fontFamily: 'Inter_500Medium',
      color: PAGE.inkMuted,
    },

    headlineWrap: { alignItems: 'center', marginTop: 12, marginBottom: 4 },
    headlineRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 4 },
    headlineValue: {
      fontSize: 58,
      lineHeight: 62,
      fontFamily: 'Inter_700Bold',
      color: PAGE.ink,
      letterSpacing: -2,
      fontVariant: ['tabular-nums'],
    },
    headlineUnit: {
      fontSize: 20,
      fontFamily: 'Inter_600SemiBold',
      color: PAGE.inkMuted,
      marginBottom: 9,
    },
    headlineCaption: {
      marginTop: 2,
      textAlign: 'center',
      fontSize: 13,
      fontFamily: 'Inter_500Medium',
      color: PAGE.inkMuted,
    },

    sealFoot: { marginTop: 8, gap: 8 },
    sealFootText: {
      fontSize: 10,
      lineHeight: 14,
      fontFamily: 'Inter_500Medium',
      color: PAGE.inkFaint,
      letterSpacing: 0.3,
    },

    rule: { height: 1, backgroundColor: PAGE.hairline, marginVertical: 4 },

    sectionTitle: {
      fontSize: 17,
      fontFamily: 'Inter_700Bold',
      color: PAGE.ink,
      letterSpacing: -0.3,
    },
    sectionSub: {
      fontSize: 12.5,
      lineHeight: 18,
      fontFamily: 'Inter_400Regular',
      color: PAGE.inkMuted,
    },
    line: {
      fontSize: 13,
      lineHeight: 19,
      fontFamily: 'Inter_400Regular',
      color: PAGE.ink,
    },

    // Three across on a phone. Fixed width rather than flex so a row of two
    // lines up under a row of three instead of stretching to fill it.
    statGrid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 4, rowGap: 14 },
    stat: { width: '33.33%', paddingRight: 8 },
    statValueRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 3 },
    statValue: {
      fontSize: 22,
      fontFamily: 'Inter_700Bold',
      color: PAGE.ink,
      letterSpacing: -0.6,
      fontVariant: ['tabular-nums'],
    },
    statUnit: {
      fontSize: 10,
      fontFamily: 'Inter_600SemiBold',
      color: PAGE.inkMuted,
      marginBottom: 3,
    },
    statLabel: {
      marginTop: 1,
      fontSize: 10.5,
      lineHeight: 14,
      fontFamily: 'Inter_500Medium',
      color: PAGE.inkFaint,
    },

    typeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 2 },
    typeChip: {
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 7,
      backgroundColor: PAGE.inset,
      borderWidth: 1,
      borderColor: PAGE.hairline,
    },
    typeChipText: {
      fontSize: 10.5,
      fontFamily: 'Inter_600SemiBold',
      color: PAGE.inkMuted,
    },

    moveRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingVertical: 8,
      borderBottomWidth: 1,
      borderBottomColor: PAGE.hairline,
    },
    // A rule under the last row is a line under nothing.
    moveRowLast: { borderBottomWidth: 0, paddingBottom: 2 },
    moveName: { fontSize: 13.5, fontFamily: 'Inter_600SemiBold', color: PAGE.ink },
    moveDetail: {
      marginTop: 1,
      fontSize: 11.5,
      fontFamily: 'Inter_400Regular',
      color: PAGE.inkFaint,
    },
    moveDelta: {
      fontSize: 15,
      fontFamily: 'Inter_700Bold',
      color: GO.light.fill,
      fontVariant: ['tabular-nums'],
    },
    // A dip is still progress logged, not a failure, so this is a warm rust
    // rather than an alarm colour. Same reasoning as TONE_DOWN on the session
    // certificate, and now the same value, from the file that owns the paper.
    moveDeltaDown: { color: PAGE.down },

    bestRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 7 },
    bestName: { flex: 1, fontSize: 13, fontFamily: 'Inter_600SemiBold', color: PAGE.ink },
    bestValue: {
      fontSize: 13,
      fontFamily: 'Inter_700Bold',
      color: PAGE.ink,
      fontVariant: ['tabular-nums'],
    },

    stepPanel: {
      marginTop: 6,
      padding: 14,
      borderRadius: 14,
      backgroundColor: PAGE.inset,
      borderWidth: 1,
      borderColor: PAGE.hairline,
      gap: 12,
    },
    stepFromTo: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    stepEnd: { flex: 1 },
    stepEndLabel: {
      fontSize: 8.5,
      fontFamily: 'Inter_700Bold',
      color: PAGE.inkFaint,
      letterSpacing: 1,
    },
    stepEndValue: {
      marginTop: 2,
      fontSize: 14,
      fontFamily: 'Inter_700Bold',
      color: PAGE.ink,
    },
    stepNote: {
      fontSize: 11.5,
      lineHeight: 16,
      fontFamily: 'Inter_400Regular',
      color: PAGE.inkMuted,
    },
    stepBtn: { borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
    stepBtnText: { fontSize: 14, fontFamily: 'Inter_700Bold' },
    stepTaken: { flexDirection: 'row', alignItems: 'center', gap: 7 },
    stepTakenText: {
      flex: 1,
      fontSize: 12,
      fontFamily: 'Inter_600SemiBold',
      color: PAGE.ink,
    },

    primaryBtn: { marginTop: 6, borderRadius: 13, paddingVertical: 14, alignItems: 'center' },
    primaryBtnText: { fontSize: 14.5, fontFamily: 'Inter_700Bold' },
    secondaryBtn: {
      borderRadius: 13,
      paddingVertical: 13,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: PAGE.hairline,
      backgroundColor: PAGE.inset,
    },
    secondaryBtnText: { fontSize: 13.5, fontFamily: 'Inter_600SemiBold', color: PAGE.ink },
    quietBtn: { paddingVertical: 10, alignItems: 'center' },
    quietBtnText: { fontSize: 12.5, fontFamily: 'Inter_500Medium', color: PAGE.inkFaint },

    archiveLink: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 7,
      paddingVertical: 14,
    },
    archiveLinkText: { fontSize: 12, fontFamily: 'Inter_500Medium', color: C.textSecondary },

    emptyTitle: {
      fontSize: 18,
      fontFamily: 'Inter_700Bold',
      color: C.text,
      textAlign: 'center',
      paddingHorizontal: 32,
    },
    emptyBody: {
      marginTop: 8,
      fontSize: 13,
      lineHeight: 19,
      fontFamily: 'Inter_400Regular',
      color: C.textSecondary,
      textAlign: 'center',
      paddingHorizontal: 32,
    },
    emptyBtn: {
      alignSelf: 'center',
      marginTop: 18,
      paddingHorizontal: 22,
      paddingVertical: 11,
      borderRadius: 12,
      backgroundColor: C.surfaceSecondary,
    },
    emptyBtnText: { fontSize: 13.5, fontFamily: 'Inter_600SemiBold', color: C.text },
  });
