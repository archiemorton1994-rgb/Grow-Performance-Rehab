/**
 * THE PROGRAMME HUB: where you are, and everything you can change about it.
 *
 * WHAT IT REPLACED
 * ────────────────
 * app/program.tsx was, by construction, the three-lift rotation. It counted
 * squat/bench/deadlift sessions towards a strength test and drew dots for the
 * cycle, and it could not describe anything else, because until now there was
 * nothing else to describe. Its own comment said so: "making it speak a non-KPI
 * plan is the next piece of work, not this one." This is that work.
 *
 * The old screen is still there and still reached by anybody with no programme,
 * which is everybody who has been using Grow until now. Nothing about their view
 * changes.
 *
 * THE FOUR THINGS SOMEBODY COMES HERE FOR
 * ───────────────────────────────────────
 *   WHERE AM I        week, sessions done, what is next, and what they did off
 *                     plan, which is counted rather than hidden
 *   WHAT IS COMING    the block laid out, so it is a plan rather than a promise
 *   WHAT ELSE CAN I DO    the rehab and recovery work that sits alongside it,
 *                     and the fact that doing one costs them nothing
 *   CHANGE IT         days, length, a different programme, pause, or leave
 *
 * NOTHING HERE IS DESTRUCTIVE WITHOUT ASKING. Switching programme and leaving
 * both start a fresh block, which is a bigger deal than it looks when somebody
 * is nine weeks in, so both confirm first and both say what will happen to the
 * work already logged, which is nothing.
 */
import React, { useCallback, useMemo, useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors, useGoColors } from '@/constants/colors';
import { PAGE } from '@/lib/session-identity';
import { SESSION_DISPLAY_NAMES, SESSION_SHORT_LABELS } from '@/lib/session-meta';
import { useAppStore } from '@/lib/store';
import type { ExperienceLevel, SessionType } from '@/lib/store';
import {
  PROGRAMMES,
  PROGRAMME_IDS,
  blockPlan,
  cycleOf,
  extrasOf,
  programmeDifficulty,
  nameOf,
  programmeFor,
  type ProgrammeId,
} from '@/lib/programme';
import { SESSION_COUNTS, type TrainingDays } from '@/lib/profile-tree';
import { bandLabel, LEVEL_NAMES } from '@/lib/exercise-levels';
import { levelBandForExperience } from '@/lib/programme';

const DAY_OPTIONS: TrainingDays[] = [2, 3, 4, 5];

/**
 * "9, 10 and 11" rather than "9,10,11".
 *
 * A run of consecutive session numbers is the usual case, and joining them with
 * commas reads like a part number. Contiguous runs collapse to "9 to 11", which
 * is both shorter and how a person would say it out loud.
 */
function listSessions(nums: number[]): string {
  const runs: number[][] = [];
  for (const n of nums) {
    const last = runs[runs.length - 1];
    if (last && n === last[last.length - 1] + 1) last.push(n);
    else runs.push([n]);
  }
  const parts = runs.map((r) => (r.length === 1 ? `${r[0]}` : `${r[0]} to ${r[r.length - 1]}`));
  if (parts.length === 1) return parts[0];
  return `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
}

/** The same three the profile builder asks, in the same order. */
const EXPERIENCE_OPTIONS: { value: ExperienceLevel; label: string }[] = [
  { value: 'beginner', label: 'New to it' },
  { value: 'intermediate', label: '1 to 3 yrs' },
  { value: 'advanced', label: '3 yrs plus' },
];

export function ProgrammeHub() {
  const C = useColors();
  const go = useGoColors();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(C), [C]);

  const programme = useAppStore((s) => s.programme);
  const getProgrammePosition = useAppStore((s) => s.getProgrammePosition);
  const updateProgramme = useAppStore((s) => s.updateProgramme);
  const switchProgramme = useAppStore((s) => s.switchProgramme);
  const setProgrammePaused = useAppStore((s) => s.setProgrammePaused);
  const equipmentTiers = useAppStore((s) => s.equipmentTiers);
  const experienceLevel = useAppStore((s) => s.userProfile?.experienceLevel);
  const setUserProfile = useAppStore((s) => s.setUserProfile);
  const completedProgrammes = useAppStore((s) => s.completedProgrammes);
  const earnedLevelBonus = useAppStore((s) => s.userProfile?.earnedLevelBonus ?? 0);

  const [changing, setChanging] = useState(false);

  const haptic = useCallback((heavy = false) => {
    if (Platform.OS === 'web') return;
    void Haptics.impactAsync(
      heavy ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light
    );
  }, []);

  const startSession = useCallback(
    (sessionType: SessionType) => {
      haptic(true);
      router.push({
        pathname: '/readiness',
        params: {
          sessionType,
          isTestWeek: 'false',
          equipmentOverride: (equipmentTiers ?? []).join(','),
        },
      });
    },
    [haptic, equipmentTiers]
  );

  if (!programme) return null;
  const position = getProgrammePosition();
  if (!position) return null;

  const template = programmeFor(programme.templateId);
  const displayName = nameOf(programme);
  const cycle = cycleOf(programme);
  const extras = extrasOf(programme);
  const plan = blockPlan(programme);
  const difficulty = programmeDifficulty(
    programme.templateId,
    experienceLevel ?? 'beginner',
    programme.days,
    cycle
  );
  const pct = Math.min(100, Math.round((position.onPlan / position.totalSessions) * 100));
  /**
   * The movements they are actually prescribed from, which is the experience
   * answer PLUS whatever finishing blocks has earned.
   *
   * Not difficulty.band. That is a property of the programme - how hard the work
   * it prescribes is - and this is a property of the person. The two were both
   * being called "your level", which is how somebody could take a rung on the
   * report and find the hub saying exactly what it said before.
   */
  const earnedBand = levelBandForExperience(experienceLevel ?? 'beginner', earnedLevelBonus);

  /** Which sessions of the block are done, for the plan list. */
  const doneUpTo = position.onPlan;

  const confirmSwitch = (id: ProgrammeId) => {
    const next = PROGRAMMES[id];
    Alert.alert(
      `Switch to ${next.name}?`,
      'This starts a fresh block from today. Everything you have already logged stays exactly where it is: your history, your records and your weights are untouched.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Switch',
          onPress: () => {
            haptic(true);
            switchProgramme(id, new Date().toISOString());
            setChanging(false);
          },
        },
      ]
    );
  };

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}
      showsVerticalScrollIndicator={false}
    >
      {/* ── Where you are ────────────────────────────────────────────── */}
      <View style={styles.page} testID="hub-card">
        <Text style={styles.pageEyebrow}>YOUR PROGRAMME</Text>
        <Text style={styles.name}>{displayName}</Text>
        <Text style={styles.blurb}>{template.blurb}</Text>

        <View style={styles.difficultyRow} testID="hub-difficulty">
          <View style={styles.difficultyPill}>
            <Text style={styles.difficultyPillText}>{difficulty.label.toUpperCase()}</Text>
          </View>
          <Text style={styles.difficultyWhy}>
            {difficulty.because} {bandLabel(difficulty.band)}, out of five.
          </Text>
        </View>

        <View style={styles.rule} />

        {programme.paused ? (
          <View style={styles.pausedRow}>
            <Ionicons name="pause-circle-outline" size={17} color={PAGE.warn} />
            <Text style={styles.pausedText}>
              Paused. You are still training, it just is not moving the block along.
            </Text>
          </View>
        ) : (
          <>
            {/* SESSIONS lead, weeks follow. The block is measured in sessions,
                so the number that moves when they train is the big one. */}
            <View style={styles.weekRow}>
              <Text style={styles.week}>
                Session {Math.min(position.onPlan + 1, position.totalSessions)}
                <Text style={styles.weekOf}> of {position.totalSessions}</Text>
              </Text>
              <Text style={styles.weekCount}>
                Week {position.week} of {position.weeks}
              </Text>
            </View>
            <View style={styles.track}>
              <View style={[styles.trackFill, { width: `${pct}%` }]} />
            </View>
          </>
        )}

        {position.offPlan > 0 && (
          <Text style={styles.offPlan} testID="hub-off-plan">
            Plus {position.offPlan} other {position.offPlan === 1 ? 'session' : 'sessions'} you
            chose yourself. They all count towards your history and records.
          </Text>
        )}

        {position.complete && (
          /* Was a chip that said "Block complete" and did nothing. Weeks of
             work, acknowledged with a label. The report is what was behind it
             all along, and this is the way in. */
          <Pressable
            onPress={() => {
              haptic(true);
              router.push('/programme-report');
            }}
            testID="hub-complete"
            style={({ pressed }) => [styles.doneBadge, pressed && { opacity: 0.85 }]}
          >
            <Ionicons name="ribbon" size={17} color={PAGE.ink} />
            <View style={{ flex: 1 }}>
              <Text style={styles.doneBadgeText}>Block complete</Text>
              <Text style={styles.doneBadgeSub}>
                Read the report: what you did, what moved, and what comes next
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={PAGE.inkMuted} />
          </Pressable>
        )}
      </View>

      {/* ── Next up ──────────────────────────────────────────────────── */}
      {/* Not once it is finished. "Session 13 of 12" is the app failing to
          notice the thing it just counted to, and the question at that point is
          what happens next rather than what is next. */}
      {!programme.paused && !position.complete && (
        <View style={styles.block}>
          <Text style={styles.blockTitle}>Next in your programme</Text>
          <Pressable
            onPress={() => startSession(position.next)}
            testID="hub-start-next"
            style={({ pressed }) => [styles.nextCard, pressed && { opacity: 0.9 }]}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.nextLabel}>{SESSION_DISPLAY_NAMES[position.next]}</Text>
              <Text style={styles.nextSub}>
                Session {Math.min(position.onPlan + 1, position.totalSessions)} of{' '}
                {position.totalSessions}
                {position.deload ? ' · easier week' : ''}
              </Text>
            </View>
            <View style={[styles.nextGo, { backgroundColor: go.fill }]}>
              <Ionicons name="arrow-forward" size={19} color={go.on} />
            </View>
          </Pressable>
        </View>
      )}

      {/* ── Alongside it ─────────────────────────────────────────────── */}
      {extras.length > 0 && (
        <View style={styles.block} testID="hub-extras">
          <Text style={styles.blockTitle}>Alongside it, whenever you want</Text>
          <Text style={styles.blockSub}>
            Doing one of these never costs you your place. The block waits exactly where it is.
          </Text>
          <View style={styles.extraRow}>
            {extras.map((t) => (
              <Pressable
                key={t}
                onPress={() => startSession(t)}
                testID={`hub-extra-${t}`}
                style={({ pressed }) => [styles.extra, pressed && { opacity: 0.85 }]}
              >
                <Text style={styles.extraText}>{SESSION_DISPLAY_NAMES[t]}</Text>
                <Ionicons name="add" size={16} color={C.primaryText} />
              </Pressable>
            ))}
          </View>
        </View>
      )}

      {/* ── The block, laid out ──────────────────────────────────────── */}
      <View style={styles.block}>
        <Text style={styles.blockTitle}>The whole block</Text>
        <Text style={styles.blockSub}>
          It repeats {cycle.length} sessions at a time. What you get on the day is still built
          around how you feel and whatever is sore.
        </Text>
        {/* Named before the strip rather than left to a mark nobody can read.
            A row that goes quiet for a week with no explanation is a row that
            looks like a mistake. */}
        {position.deloadSessions.length > 0 && (
          <Text style={styles.blockSub} testID="hub-deload-note">
            {/* SESSIONS, NOT WEEKS. The schedule is decided in sessions now, and
                a trimmed window covers only part of a week - saying "week 4 is
                an easier week" would promise an easier session the plan has
                deliberately left alone. */}
            {position.deloadSessions.length === 1
              ? `Session ${position.deloadSessions[0]} is a planned easier one`
              : `Sessions ${listSessions(position.deloadSessions)} are planned easier ones`}
            {/* "One set fewer" is not always true: the set only comes off work
                that already has more than two, and a shorter Full Body session
                is built entirely on two-set exercises. */}
            : about 10% off the bar, and a set off the hard work where there is one to take, so
            you come into what follows fresh.
          </Text>
        )}
        <View style={styles.planWrap}>
          {Array.from({ length: position.weeks }, (_, w) => {
            const week = w + 1;
            const items = plan.filter((p) => p.week === week);
            const firstIndex = w * programme.days;
            // ANY eased session in the week, not just the first one. A trimmed
            // deload window can start mid-week, and asking only the first
            // session called that whole week ordinary.
            const easier = items.some((p) => p.deload);
            return (
              <View key={week} style={styles.planWeek}>
                <Text style={[styles.planWeekNo, easier && styles.planWeekNoEasy]}>
                  W{week}
                </Text>
                <View style={styles.planItems}>
                  {items.map((it, i) => {
                    const done = firstIndex + i < doneUpTo;
                    return (
                      <View
                        key={`${week}-${i}`}
                        style={[styles.planPip, done && { backgroundColor: go.fill }]}
                      />
                    );
                  })}
                </View>
                {/* SHORT labels, not the display names. Three full names on one
                    line reads "Squat Session · Bench Session · Deadlift S...",
                    which truncates the one word that distinguishes the row. */}
                <Text style={styles.planWeekTypes} numberOfLines={1}>
                  {items.map((it) => SESSION_SHORT_LABELS[it.type]).join(' · ')}
                </Text>
                {easier && (
                  <View style={styles.planEasy} testID={`hub-week-easy-${week}`}>
                    <Text style={styles.planEasyText}>EASIER</Text>
                  </View>
                )}
              </View>
            );
          })}
        </View>
      </View>

      {completedProgrammes.length > 0 && (
        <Pressable
          onPress={() => {
            haptic();
            router.push('/completed-programmes');
          }}
          testID="hub-completed-link"
          style={({ pressed }) => [styles.archiveRow, pressed && { opacity: 0.85 }]}
        >
          <Ionicons name="albums-outline" size={18} color={C.textSecondary} />
          <View style={{ flex: 1 }}>
            <Text style={styles.archiveTitle}>
              {completedProgrammes.length}{' '}
              {completedProgrammes.length === 1 ? 'block finished' : 'blocks finished'}
            </Text>
            <Text style={styles.archiveSub}>Every report you have earned, kept for good</Text>
          </View>
          <Ionicons name="chevron-forward" size={17} color={C.textTertiary} />
        </Pressable>
      )}

      {/* ── Change it ────────────────────────────────────────────────── */}
      <View style={styles.block} testID="hub-controls">
        <Text style={styles.blockTitle}>Change anything</Text>
        <Text style={styles.blockSub}>
          Nothing here deletes anything. Your history, your records and your weights survive every
          one of these.
        </Text>

        {/**
          * CHANGE THE LEVEL BY CHANGING WHAT DRIVES IT.
          *
          * "I was assigned a certain level and difficulty, but what if I wanted
          * to change this?" The honest control is not a dropdown of the six
          * labels: the label is a description of the work, so setting it
          * directly would let somebody rename an Intermediate programme Elite
          * and change nothing about what they are handed.
          *
          * What they can change is the thing the label is computed FROM, and it
          * is the same self-reported answer the profile builder takes. Moving it
          * moves the label AND the movement-level ceiling that decides which
          * exercises they are ever prescribed, which is what "change my level"
          * has to mean if it is to mean anything.
          */}
        <Text style={styles.ctrlLabel}>YOUR LEVEL</Text>
        <View style={styles.segment}>
          {EXPERIENCE_OPTIONS.map((e) => (
            <Pressable
              key={e.value}
              onPress={() => {
                haptic();
                setUserProfile({ experienceLevel: e.value });
              }}
              testID={`hub-experience-${e.value}`}
              style={[
                styles.segItem,
                experienceLevel === e.value && { backgroundColor: C.primaryMuted },
              ]}
            >
              <Text
                style={[
                  styles.segTextSmall,
                  experienceLevel === e.value && { color: C.primaryText },
                ]}
                numberOfLines={1}
              >
                {e.label}
              </Text>
            </Pressable>
          ))}
        </View>
        <Text style={styles.ctrlNote}>
          This sets your difficulty, which is {difficulty.label} right now, and the hardest
          movements the app will ever put in front of you. Move it up when the work stops being
          hard, not before.
        </Text>

        {/* The other half of the ceiling: what finishing blocks has earned. It
            lives here rather than only on the report, because this is the screen
            that claims to describe somebody's level and it would otherwise read
            exactly the same before and after they took a rung. */}
        <View style={styles.rung} testID="hub-earned-rung">
          <Ionicons
            name={earnedLevelBonus > 0 ? 'trending-up' : 'lock-closed-outline'}
            size={15}
            color={earnedLevelBonus > 0 ? C.primaryText : C.textTertiary}
          />
          <Text style={styles.rungText}>
            {/* Named rather than numbered, matching the report. bandLabel
                reads "Level 4 to 5 work", which said five twice once "out of
                five" was appended to it and told nobody what level 4 is. */}
            {earnedLevelBonus > 0
              ? `Plus ${earnedLevelBonus === 1 ? 'one rung' : `${earnedLevelBonus} rungs`} you earned by finishing blocks. Your sessions are built on ${LEVEL_NAMES[earnedBand.prefer].toLowerCase()} movements, with ${LEVEL_NAMES[earnedBand.max].toLowerCase()} work available on top.`
              : `Your sessions are built on ${LEVEL_NAMES[earnedBand.prefer].toLowerCase()} movements, with ${LEVEL_NAMES[earnedBand.max].toLowerCase()} work available on top. Finish a block comfortably and you earn a rung above that.`}
          </Text>
          {earnedLevelBonus > 0 && (
            <Pressable
              onPress={() => {
                haptic();
                setUserProfile({ earnedLevelBonus: earnedLevelBonus - 1 });
              }}
              testID="hub-give-back-rung"
              hitSlop={8}
              style={({ pressed }) => [styles.rungBack, pressed && { opacity: 0.7 }]}
            >
              <Text style={styles.rungBackText}>Give one back</Text>
            </Pressable>
          )}
        </View>

        <Text style={styles.ctrlLabel}>DAYS A WEEK</Text>
        <View style={styles.segment}>
          {DAY_OPTIONS.map((d) => (
            <Pressable
              key={d}
              onPress={() => {
                haptic();
                updateProgramme({ days: d });
              }}
              testID={`hub-days-${d}`}
              style={[styles.segItem, programme.days === d && { backgroundColor: C.primaryMuted }]}
            >
              <Text
                style={[styles.segText, programme.days === d && { color: C.primaryText }]}
              >
                {d}
              </Text>
            </Pressable>
          ))}
        </View>
        <Text style={styles.ctrlNote}>
          Changing this rebuilds the rest of the block. The sessions you have already done stay
          done.
        </Text>

        {/* Nine choices, so they WRAP rather than share one row. Nine items in
            a single segmented control on a 390pt screen gives each one about
            thirty points, which is under the touch target and unreadable. */}
        <Text style={styles.ctrlLabel}>BLOCK LENGTH</Text>
        <View style={styles.segmentWrap}>
          {SESSION_COUNTS.map((n) => (
            <Pressable
              key={n}
              onPress={() => {
                haptic();
                updateProgramme({ sessions: n });
              }}
              testID={`hub-length-${n}`}
              style={[
                styles.segChip,
                programme.sessions === n && { backgroundColor: C.primaryMuted },
              ]}
            >
              <Text style={[styles.segText, programme.sessions === n && { color: C.primaryText }]}>
                {n}
              </Text>
            </Pressable>
          ))}
        </View>
        <Text style={styles.ctrlNote}>
          Sessions, not weeks, so the block only moves when you train. Yours works out at about{' '}
          {position.weeks} {position.weeks === 1 ? 'week' : 'weeks'} at {programme.days} a week.
        </Text>

        <Pressable
          onPress={() => {
            haptic();
            setChanging((v) => !v);
          }}
          testID="hub-switch-toggle"
          style={({ pressed }) => [styles.wideBtn, pressed && { opacity: 0.85 }]}
        >
          <Ionicons name="swap-horizontal" size={17} color={C.text} />
          <Text style={styles.wideBtnText}>
            {changing ? 'Never mind' : 'Train a different programme'}
          </Text>
        </Pressable>

        {changing && (
          <View style={styles.switchList} testID="hub-switch-list">
            {/* Building your own is a switch target like any other, and it is
                first because it is the only one that is not already on the
                list. Somebody already on a custom cycle gets "Change mine"
                here, which is the only way back into the builder. */}
            <Pressable
              onPress={() => {
                haptic(true);
                router.push('/build-programme');
              }}
              testID="hub-switch-custom"
              style={({ pressed }) => [styles.switchItem, pressed && { opacity: 0.85 }]}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.switchName}>
                  {programme.templateId === 'custom' ? 'Change my own cycle' : 'Put one together myself'}
                </Text>
                <Text style={styles.switchBlurb}>
                  Choose the kinds of session and the order they repeat in.
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={17} color={C.textTertiary} />
            </Pressable>
            {PROGRAMME_IDS.map((id) => {
              const p = PROGRAMMES[id];
              const current = id === programme.templateId;
              return (
                <Pressable
                  key={id}
                  disabled={current}
                  onPress={() => confirmSwitch(id)}
                  testID={`hub-switch-${id}`}
                  style={({ pressed }) => [
                    styles.switchItem,
                    current && { borderColor: go.fill },
                    pressed && !current && { opacity: 0.85 },
                  ]}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.switchName}>{p.name}</Text>
                    <Text style={styles.switchBlurb}>{p.blurb}</Text>
                  </View>
                  {current ? (
                    <Text style={[styles.switchNow, { color: go.fill }]}>NOW</Text>
                  ) : (
                    <Ionicons name="chevron-forward" size={17} color={C.textTertiary} />
                  )}
                </Pressable>
              );
            })}
          </View>
        )}

        <Pressable
          onPress={() => {
            haptic();
            setProgrammePaused(!programme.paused);
          }}
          testID="hub-pause"
          style={({ pressed }) => [styles.wideBtn, pressed && { opacity: 0.85 }]}
        >
          <Ionicons
            name={programme.paused ? 'play-outline' : 'pause-outline'}
            size={17}
            color={C.text}
          />
          <Text style={styles.wideBtnText}>
            {programme.paused ? 'Resume the programme' : 'Pause the programme'}
          </Text>
        </Pressable>
        <Text style={styles.ctrlNote}>
          Pausing keeps your place. The app goes back to suggesting from whatever you have been
          training.
        </Text>
      </View>
    </ScrollView>
  );
}

function makeStyles(C: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    root: { flex: 1 },
    content: { paddingHorizontal: 18, paddingTop: 4 },

    // The same paper the certificate is printed on, so the hub is recognisably
    // the thing they were handed rather than a settings screen about it.
    page: {
      backgroundColor: PAGE.bg,
      borderRadius: 18,
      padding: 18,
      borderWidth: 1,
      borderColor: PAGE.bgEdge,
    },
    pageEyebrow: {
      fontSize: 9.5,
      fontFamily: 'Inter_700Bold',
      letterSpacing: 1.4,
      color: PAGE.inkFaint,
    },
    name: {
      fontSize: 25,
      lineHeight: 29,
      fontFamily: 'Inter_700Bold',
      color: PAGE.ink,
      letterSpacing: -0.6,
      marginTop: 5,
    },
    blurb: {
      fontSize: 13,
      lineHeight: 18,
      fontFamily: 'Inter_400Regular',
      color: PAGE.inkMuted,
      marginTop: 5,
    },
    rule: { height: 1, backgroundColor: PAGE.hairline, marginVertical: 15 },

    difficultyRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 11 },
    difficultyPill: {
      paddingHorizontal: 9,
      paddingVertical: 4,
      borderRadius: 6,
      borderWidth: 1,
      borderColor: PAGE.hairline,
      backgroundColor: PAGE.inset,
    },
    difficultyPillText: {
      fontSize: 10,
      letterSpacing: 0.9,
      fontFamily: 'Inter_700Bold',
      color: PAGE.ink,
    },
    difficultyWhy: {
      flex: 1,
      fontSize: 11.5,
      lineHeight: 15,
      fontFamily: 'Inter_400Regular',
      color: PAGE.inkMuted,
    },

    weekRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
    week: { fontSize: 19, fontFamily: 'Inter_700Bold', color: PAGE.ink },
    weekOf: { fontSize: 14, fontFamily: 'Inter_400Regular', color: PAGE.inkMuted },
    weekCount: { fontSize: 12, fontFamily: 'Inter_500Medium', color: PAGE.inkMuted },
    track: {
      height: 6,
      borderRadius: 3,
      backgroundColor: PAGE.inset,
      marginTop: 9,
      overflow: 'hidden',
    },
    trackFill: { height: 6, borderRadius: 3, backgroundColor: PAGE.ink },

    pausedRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
    pausedText: {
      flex: 1,
      fontSize: 13,
      lineHeight: 18,
      fontFamily: 'Inter_500Medium',
      color: PAGE.warn,
    },

    offPlan: {
      fontSize: 12,
      lineHeight: 17,
      fontFamily: 'Inter_400Regular',
      color: PAGE.inkFaint,
      marginTop: 12,
    },
    // A full-width row now rather than a chip that hugs its own text: it is a
    // control with a second line and a chevron, and a small pill would read as
    // a label somebody had accidentally made tappable.
    doneBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginTop: 14,
      paddingVertical: 12,
      paddingHorizontal: 13,
      borderRadius: 12,
      backgroundColor: PAGE.inset,
      borderWidth: 1,
      borderColor: PAGE.hairline,
    },
    doneBadgeText: { fontSize: 12.5, fontFamily: 'Inter_700Bold', color: PAGE.ink },

    block: { marginTop: 26 },
    blockTitle: { fontSize: 18, fontFamily: 'Inter_700Bold', color: C.text, letterSpacing: -0.2 },
    blockSub: {
      fontSize: 12.5,
      lineHeight: 17.5,
      fontFamily: 'Inter_400Regular',
      color: C.textSecondary,
      marginTop: 4,
    },

    nextCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      marginTop: 12,
      padding: 15,
      borderRadius: 15,
      backgroundColor: C.surface,
      borderWidth: 1,
      borderColor: C.border,
    },
    nextLabel: { fontSize: 17, fontFamily: 'Inter_700Bold', color: C.text },
    nextSub: {
      fontSize: 12.5,
      fontFamily: 'Inter_400Regular',
      color: C.textSecondary,
      marginTop: 2,
    },
    nextGo: {
      width: 42,
      height: 42,
      borderRadius: 21,
      alignItems: 'center',
      justifyContent: 'center',
    },

    extraRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
    extra: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingVertical: 10,
      paddingHorizontal: 13,
      borderRadius: 11,
      backgroundColor: C.primarySurface,
      borderWidth: 1,
      borderColor: C.primaryMuted,
    },
    extraText: { fontSize: 13.5, fontFamily: 'Inter_600SemiBold', color: C.primaryText },

    doneBadgeSub: {
      marginTop: 2,
      fontSize: 11,
      lineHeight: 15,
      fontFamily: 'Inter_400Regular',
      color: PAGE.inkMuted,
    },

    archiveRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: C.surface,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: C.border,
      paddingHorizontal: 15,
      paddingVertical: 13,
    },
    archiveTitle: { fontSize: 13.5, fontFamily: 'Inter_600SemiBold', color: C.text },
    archiveSub: {
      marginTop: 1,
      fontSize: 11.5,
      fontFamily: 'Inter_400Regular',
      color: C.textTertiary,
    },

    rung: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 8,
      marginTop: 4,
      padding: 11,
      borderRadius: 11,
      backgroundColor: C.surfaceSecondary,
      borderWidth: 1,
      borderColor: C.border,
    },
    rungText: {
      flex: 1,
      fontSize: 11.5,
      lineHeight: 16,
      fontFamily: 'Inter_400Regular',
      color: C.textSecondary,
    },
    rungBack: { paddingVertical: 1 },
    rungBackText: {
      fontSize: 11,
      fontFamily: 'Inter_600SemiBold',
      color: C.textTertiary,
      textDecorationLine: 'underline',
    },

    planWrap: { marginTop: 12, gap: 7 },
    planWeek: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    planWeekNo: {
      width: 28,
      fontSize: 11,
      fontFamily: 'Inter_700Bold',
      color: C.textTertiary,
    },
    planItems: { flexDirection: 'row', gap: 4, width: 62 },
    planPip: {
      width: 9,
      height: 9,
      borderRadius: 5,
      backgroundColor: C.surfaceTertiary,
    },
    // The week number carries it too, so the row still reads as different work
    // when the chip is pushed off the end of a narrow phone. Theme colours, not
    // PAGE ones: this strip sits on the app's own surface rather than on the
    // parchment above it, and ink-on-cream here is invisible in the dark theme.
    planWeekNoEasy: { color: C.text },
    planEasy: {
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 5,
      backgroundColor: C.surfaceTertiary,
      borderWidth: 1,
      borderColor: C.border,
    },
    planEasyText: {
      fontSize: 8.5,
      fontFamily: 'Inter_700Bold',
      color: C.textSecondary,
      letterSpacing: 0.7,
    },

    planWeekTypes: {
      flex: 1,
      fontSize: 11.5,
      fontFamily: 'Inter_400Regular',
      color: C.textSecondary,
    },

    ctrlLabel: {
      fontSize: 9.5,
      fontFamily: 'Inter_700Bold',
      letterSpacing: 1.2,
      color: C.textTertiary,
      marginTop: 18,
      marginBottom: 8,
    },
    segment: {
      flexDirection: 'row',
      gap: 6,
      padding: 4,
      borderRadius: 12,
      backgroundColor: C.surfaceSecondary,
    },
    segItem: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      height: 40,
      borderRadius: 9,
    },
    segText: { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: C.textSecondary },
    // Three words rather than one digit, so they get their own size.
    segTextSmall: { fontSize: 12.5, fontFamily: 'Inter_600SemiBold', color: C.textSecondary },
    segmentWrap: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
      padding: 4,
      borderRadius: 12,
      backgroundColor: C.surfaceSecondary,
    },
    segChip: {
      // Three rows of three rather than seven and a ragged two. flexBasis at
      // 30% forces the wrap after the third, and flexGrow then fills each row
      // evenly, so nine numbers read as a grid instead of a run that ran out.
      flexBasis: '30%',
      flexGrow: 1,
      alignItems: 'center',
      justifyContent: 'center',
      height: 40,
      paddingHorizontal: 10,
      borderRadius: 9,
    },
    ctrlNote: {
      fontSize: 11.5,
      lineHeight: 16,
      fontFamily: 'Inter_400Regular',
      color: C.textTertiary,
      marginTop: 8,
    },

    wideBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      height: 48,
      borderRadius: 13,
      marginTop: 18,
      backgroundColor: C.surface,
      borderWidth: 1,
      borderColor: C.border,
    },
    wideBtnText: { fontSize: 14.5, fontFamily: 'Inter_600SemiBold', color: C.text },

    switchList: { marginTop: 10, gap: 8 },
    switchItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      padding: 13,
      borderRadius: 12,
      backgroundColor: C.surfaceSecondary,
      borderWidth: 1.5,
      borderColor: C.border,
    },
    switchName: { fontSize: 14.5, fontFamily: 'Inter_700Bold', color: C.text },
    switchBlurb: {
      fontSize: 12,
      lineHeight: 16.5,
      fontFamily: 'Inter_400Regular',
      color: C.textSecondary,
      marginTop: 2,
    },
    switchNow: { fontSize: 10, fontFamily: 'Inter_700Bold', letterSpacing: 1 },
  });
}
