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
import type { SessionType } from '@/lib/store';
import {
  PROGRAMMES,
  PROGRAMME_IDS,
  blockPlan,
  cycleFor,
  extrasFor,
  programmeFor,
  type ProgrammeId,
} from '@/lib/programme';
import type { BlockLength, TrainingDays } from '@/lib/profile-tree';

const DAY_OPTIONS: TrainingDays[] = [2, 3, 4, 5];
const LENGTH_OPTIONS: BlockLength[] = [8, 12, 16];

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
  const cycle = cycleFor(programme.templateId, programme.days);
  const extras = extrasFor(programme.templateId, programme.days);
  const plan = blockPlan(programme);
  const pct = Math.min(100, Math.round((position.onPlan / position.totalSessions) * 100));

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
        <Text style={styles.name}>{template.name}</Text>
        <Text style={styles.blurb}>{template.blurb}</Text>

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
            <View style={styles.weekRow}>
              <Text style={styles.week}>
                Week {position.week}
                <Text style={styles.weekOf}> of {programme.blockWeeks}</Text>
              </Text>
              <Text style={styles.weekCount}>
                {position.onPlan} of {position.totalSessions} sessions
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
          <View style={styles.doneBadge} testID="hub-complete">
            <Ionicons name="ribbon-outline" size={16} color={PAGE.ink} />
            <Text style={styles.doneBadgeText}>Block complete</Text>
          </View>
        )}
      </View>

      {/* ── Next up ──────────────────────────────────────────────────── */}
      {!programme.paused && (
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
        <View style={styles.planWrap}>
          {Array.from({ length: programme.blockWeeks }, (_, w) => {
            const week = w + 1;
            const items = plan.filter((p) => p.week === week);
            const firstIndex = w * programme.days;
            return (
              <View key={week} style={styles.planWeek}>
                <Text style={styles.planWeekNo}>W{week}</Text>
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
              </View>
            );
          })}
        </View>
      </View>

      {/* ── Change it ────────────────────────────────────────────────── */}
      <View style={styles.block} testID="hub-controls">
        <Text style={styles.blockTitle}>Change anything</Text>
        <Text style={styles.blockSub}>
          Nothing here deletes anything. Your history, your records and your weights survive every
          one of these.
        </Text>

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

        <Text style={styles.ctrlLabel}>BLOCK LENGTH</Text>
        <View style={styles.segment}>
          {LENGTH_OPTIONS.map((n) => (
            <Pressable
              key={n}
              onPress={() => {
                haptic();
                updateProgramme({ blockWeeks: n });
              }}
              testID={`hub-length-${n}`}
              style={[
                styles.segItem,
                programme.blockWeeks === n && { backgroundColor: C.primaryMuted },
              ]}
            >
              <Text
                style={[styles.segText, programme.blockWeeks === n && { color: C.primaryText }]}
              >
                {n} wk
              </Text>
            </Pressable>
          ))}
        </View>

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
    doneBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 7,
      alignSelf: 'flex-start',
      marginTop: 13,
      paddingVertical: 6,
      paddingHorizontal: 11,
      borderRadius: 9,
      backgroundColor: PAGE.inset,
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
