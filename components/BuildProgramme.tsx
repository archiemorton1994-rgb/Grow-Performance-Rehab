/**
 * BUILD YOUR OWN: pick the sessions, put them in an order, say how long.
 *
 * WHY THIS EXISTS
 * ───────────────
 * The seven programmes cover the six things people say they want plus a split,
 * and they will never cover everybody. Archie asked for it directly: "we do
 * custom sessions, so what about an option for building their own custom
 * program?"
 *
 * WHAT IT DOES AND DOES NOT LET YOU DO
 * ────────────────────────────────────
 * You choose the CYCLE - which kinds of session, in what order - and how often
 * and how long the block runs. You do not choose the exercises inside a
 * session, and that is on purpose rather than for want of time. Every session
 * is still built on the day from your kit, your time, whatever is sore and what
 * you lifted last, which is the thing this app does that a spreadsheet cannot.
 * Fixing the exercises in advance would opt somebody out of all of it.
 *
 * Anybody who wants to choose the exercises already can: that is the custom
 * SESSION builder, and it is a different tool for a different job. This screen
 * says so rather than leaving people to find out.
 *
 * A CYCLE, NOT A WEEK. Same model as every other programme: an ordered list
 * that repeats, with `days` deciding how fast you move through it rather than
 * which day of the week anything lands on. See lib/programme.ts.
 */
import React, { useCallback, useMemo, useState } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors, useGoColors } from '@/constants/colors';
import { SESSION_DISPLAY_NAMES } from '@/lib/session-meta';
import { useAppStore } from '@/lib/store';
import type { SessionType } from '@/lib/store';
import {
  BUILDABLE_SESSION_TYPES,
  MAX_CUSTOM_CYCLE,
  demandOfCycle,
  programmeDifficulty,
} from '@/lib/programme';
import { SESSION_COUNTS, type SessionCount, type TrainingDays } from '@/lib/profile-tree';
import { bandLabel } from '@/lib/exercise-levels';

const DAY_OPTIONS: TrainingDays[] = [2, 3, 4, 5];

/** One line each, so the list is a decision rather than nine words. */
const WHAT_IT_IS: Record<string, string> = {
  squat: 'Squat as the main lift, with accessories around it',
  bench: 'Bench as the main lift, with accessories around it',
  deadlift: 'Deadlift as the main lift, with accessories around it',
  upper_body: 'Chest, back, shoulders and arms',
  lower_body: 'Quads, hamstrings, glutes and calves',
  full_body: 'A bit of everything, in one session',
  conditioning: 'Intervals, circuits and cardio work',
  prehab: 'Joint work and the drills that keep you training',
  flexibility: 'Mobility and stretching',
};

export function BuildProgramme() {
  const C = useColors();
  const go = useGoColors();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(C), [C]);

  const enrolInCustomProgramme = useAppStore((s) => s.enrolInCustomProgramme);
  const experienceLevel = useAppStore((s) => s.userProfile?.experienceLevel);

  const [name, setName] = useState('');
  const [cycle, setCycle] = useState<SessionType[]>([]);
  const [days, setDays] = useState<TrainingDays>(3);
  const [sessions, setSessions] = useState<SessionCount>(12);

  const haptic = useCallback((heavy = false) => {
    if (Platform.OS === 'web') return;
    void Haptics.impactAsync(
      heavy ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light
    );
  }, []);

  const add = (t: SessionType) => {
    if (cycle.length >= MAX_CUSTOM_CYCLE) return;
    haptic();
    setCycle((c) => [...c, t]);
  };
  const removeAt = (i: number) => {
    haptic();
    setCycle((c) => c.filter((_, j) => j !== i));
  };
  /**
   * Up and down arrows rather than drag to reorder.
   *
   * A drag handle inside a scrolling list needs a gesture library and gets the
   * scroll direction wrong on somebody's first try. Two buttons are duller and
   * they work the first time, which on a screen most people use once is the
   * better trade.
   */
  const move = (i: number, by: -1 | 1) => {
    const j = i + by;
    if (j < 0 || j >= cycle.length) return;
    haptic();
    setCycle((c) => {
      const next = [...c];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  };

  const ready = cycle.length > 0;
  const difficulty = programmeDifficulty('custom', experienceLevel ?? 'beginner', days, cycle);
  const weeks = Math.max(1, Math.ceil(sessions / days));

  const start = () => {
    if (!ready) return;
    haptic(true);
    enrolInCustomProgramme(
      { name: name.trim() || 'Your Own Programme', cycle },
      days,
      sessions,
      new Date().toISOString()
    );
  };

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 120 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        testID="build-programme"
      >
        <Text style={styles.lede}>
          Choose the kinds of session and the order they repeat in. What is inside each one is
          still built on the day around your kit, your time and anything that is sore.
        </Text>

        {/* ── The cycle ─────────────────────────────────────────────── */}
        <Text style={styles.sectionLabel}>YOUR CYCLE</Text>
        {cycle.length === 0 ? (
          <View style={styles.empty} testID="build-empty">
            <Ionicons name="albums-outline" size={20} color={C.textTertiary} />
            <Text style={styles.emptyText}>
              Nothing in it yet. Add a session below and it will repeat in the order you set.
            </Text>
          </View>
        ) : (
          <View style={styles.cycleList}>
            {cycle.map((t, i) => (
              <View key={`${t}-${i}`} style={styles.slot} testID={`build-slot-${i}`}>
                <Text style={styles.slotNo}>{i + 1}</Text>
                <Text style={styles.slotName} numberOfLines={1}>
                  {SESSION_DISPLAY_NAMES[t]}
                </Text>
                <Pressable
                  onPress={() => move(i, -1)}
                  hitSlop={8}
                  disabled={i === 0}
                  testID={`build-up-${i}`}
                  style={({ pressed }) => [styles.slotBtn, pressed && { opacity: 0.6 }]}
                >
                  <Ionicons
                    name="chevron-up"
                    size={16}
                    color={i === 0 ? C.borderLight : C.textSecondary}
                  />
                </Pressable>
                <Pressable
                  onPress={() => move(i, 1)}
                  hitSlop={8}
                  disabled={i === cycle.length - 1}
                  testID={`build-down-${i}`}
                  style={({ pressed }) => [styles.slotBtn, pressed && { opacity: 0.6 }]}
                >
                  <Ionicons
                    name="chevron-down"
                    size={16}
                    color={i === cycle.length - 1 ? C.borderLight : C.textSecondary}
                  />
                </Pressable>
                <Pressable
                  onPress={() => removeAt(i)}
                  hitSlop={8}
                  testID={`build-remove-${i}`}
                  style={({ pressed }) => [styles.slotBtn, pressed && { opacity: 0.6 }]}
                >
                  <Ionicons name="close" size={16} color={C.textTertiary} />
                </Pressable>
              </View>
            ))}
            <Text style={styles.cycleNote}>
              It repeats from the top. At {days} a week, {sessions} sessions works out at about{' '}
              {weeks} {weeks === 1 ? 'week' : 'weeks'}.
            </Text>
          </View>
        )}

        {/* ── The palette ───────────────────────────────────────────── */}
        <Text style={[styles.sectionLabel, styles.gap]}>
          ADD A SESSION{cycle.length >= MAX_CUSTOM_CYCLE ? ` · ${MAX_CUSTOM_CYCLE} IS THE MOST` : ''}
        </Text>
        <View style={styles.palette}>
          {BUILDABLE_SESSION_TYPES.map((t) => (
            <Pressable
              key={t}
              onPress={() => add(t)}
              disabled={cycle.length >= MAX_CUSTOM_CYCLE}
              testID={`build-add-${t}`}
              style={({ pressed }) => [
                styles.paletteRow,
                cycle.length >= MAX_CUSTOM_CYCLE && { opacity: 0.4 },
                pressed && { opacity: 0.8 },
              ]}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.paletteName}>{SESSION_DISPLAY_NAMES[t]}</Text>
                <Text style={styles.paletteWhat}>{WHAT_IT_IS[t]}</Text>
              </View>
              <Ionicons name="add-circle-outline" size={20} color={C.primaryText} />
            </Pressable>
          ))}
        </View>

        {/* ── How often, how long ───────────────────────────────────── */}
        <Text style={[styles.sectionLabel, styles.gap]}>DAYS A WEEK</Text>
        <View style={styles.segment}>
          {DAY_OPTIONS.map((d) => (
            <Pressable
              key={d}
              onPress={() => {
                haptic();
                setDays(d);
              }}
              testID={`build-days-${d}`}
              style={[styles.segItem, days === d && { backgroundColor: C.primaryMuted }]}
            >
              <Text style={[styles.segText, days === d && { color: C.primaryText }]}>{d}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={[styles.sectionLabel, styles.gap]}>HOW MANY SESSIONS</Text>
        <View style={styles.segmentWrap}>
          {SESSION_COUNTS.map((n) => (
            <Pressable
              key={n}
              onPress={() => {
                haptic();
                setSessions(n);
              }}
              testID={`build-sessions-${n}`}
              style={[styles.segChip, sessions === n && { backgroundColor: C.primaryMuted }]}
            >
              <Text style={[styles.segText, sessions === n && { color: C.primaryText }]}>{n}</Text>
            </Pressable>
          ))}
        </View>

        {/* ── Name it ───────────────────────────────────────────────── */}
        <Text style={[styles.sectionLabel, styles.gap]}>CALL IT SOMETHING</Text>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="Your Own Programme"
          placeholderTextColor={C.textTertiary}
          style={styles.input}
          maxLength={40}
          testID="build-name"
        />

        {/* ── What it will be ───────────────────────────────────────── */}
        {ready && (
          <View style={styles.preview} testID="build-preview">
            <View style={styles.difficultyPill}>
              <Text style={styles.difficultyPillText}>{difficulty.label.toUpperCase()}</Text>
            </View>
            <Text style={styles.previewText}>
              {bandLabel(difficulty.band)}, out of five.{' '}
              {demandOfCycle(cycle) > 0
                ? 'Mostly heavy work.'
                : demandOfCycle(cycle) < 0
                  ? 'Mostly gentle work.'
                  : 'A mix of hard and easy work.'}
            </Text>
          </View>
        )}

        {/* The other tool, named, so nobody goes looking for it here. */}
        <Pressable
          onPress={() => {
            haptic();
            router.push('/custom-session');
          }}
          testID="build-custom-session-link"
          style={({ pressed }) => [styles.aside, pressed && { opacity: 0.8 }]}
        >
          <Ionicons name="construct-outline" size={15} color={C.textTertiary} />
          <Text style={styles.asideText}>
            Want to choose the exercises themselves? That is a custom session, and it is a
            different tool.
          </Text>
          <Ionicons name="chevron-forward" size={13} color={C.textTertiary} />
        </Pressable>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 14 }]}>
        <Pressable
          onPress={start}
          disabled={!ready}
          testID="build-start"
          style={({ pressed }) => [
            styles.cta,
            { backgroundColor: ready ? go.fill : C.surfaceSecondary },
            pressed && ready && { opacity: 0.9 },
          ]}
        >
          <Text style={[styles.ctaText, { color: ready ? go.on : C.textTertiary }]}>
            {ready ? `Start it · ${cycle.length} in the cycle` : 'Add at least one session'}
          </Text>
          {ready && <Ionicons name="arrow-forward" size={17} color={go.on} />}
        </Pressable>
      </View>
    </View>
  );
}

function makeStyles(C: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: C.background },
    content: { paddingHorizontal: 18, paddingTop: 10, gap: 8 },

    lede: {
      fontSize: 13.5,
      lineHeight: 19,
      fontFamily: 'Inter_400Regular',
      color: C.textSecondary,
      marginBottom: 8,
    },
    sectionLabel: {
      fontSize: 10.5,
      letterSpacing: 1,
      fontFamily: 'Inter_700Bold',
      color: C.textTertiary,
      marginBottom: 4,
    },
    gap: { marginTop: 18 },

    empty: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      padding: 14,
      borderRadius: 14,
      borderWidth: 1,
      borderStyle: 'dashed',
      borderColor: C.border,
    },
    emptyText: {
      flex: 1,
      fontSize: 12.5,
      lineHeight: 17,
      fontFamily: 'Inter_400Regular',
      color: C.textTertiary,
    },

    cycleList: { gap: 6 },
    slot: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderRadius: 12,
      backgroundColor: C.surface,
      borderWidth: 1,
      borderColor: C.border,
    },
    slotNo: {
      width: 20,
      fontSize: 12,
      fontFamily: 'Inter_700Bold',
      color: C.textTertiary,
    },
    slotName: { flex: 1, fontSize: 14, fontFamily: 'Inter_600SemiBold', color: C.text },
    slotBtn: {
      width: 28,
      height: 28,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 8,
      backgroundColor: C.surfaceSecondary,
    },
    cycleNote: {
      fontSize: 11.5,
      lineHeight: 16,
      fontFamily: 'Inter_400Regular',
      color: C.textTertiary,
      marginTop: 4,
    },

    palette: { gap: 6 },
    paletteRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderRadius: 12,
      backgroundColor: C.surface,
      borderWidth: 1,
      borderColor: C.border,
    },
    paletteName: { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: C.text },
    paletteWhat: {
      fontSize: 11.5,
      lineHeight: 15.5,
      fontFamily: 'Inter_400Regular',
      color: C.textTertiary,
      marginTop: 1,
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
    segmentWrap: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
      padding: 4,
      borderRadius: 12,
      backgroundColor: C.surfaceSecondary,
    },
    segChip: {
      flexBasis: '30%',
      flexGrow: 1,
      alignItems: 'center',
      justifyContent: 'center',
      height: 40,
      borderRadius: 9,
    },
    segText: { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: C.textSecondary },

    input: {
      height: 48,
      borderRadius: 12,
      paddingHorizontal: 14,
      fontSize: 15,
      fontFamily: 'Inter_500Medium',
      color: C.text,
      backgroundColor: C.surface,
      borderWidth: 1,
      borderColor: C.border,
    },

    preview: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 9,
      marginTop: 18,
      padding: 12,
      borderRadius: 12,
      backgroundColor: C.primarySurface,
      borderWidth: 1,
      borderColor: C.primaryMuted,
    },
    difficultyPill: {
      paddingHorizontal: 9,
      paddingVertical: 4,
      borderRadius: 6,
      backgroundColor: C.primaryMuted,
    },
    difficultyPillText: {
      fontSize: 10,
      letterSpacing: 0.9,
      fontFamily: 'Inter_700Bold',
      color: C.primaryText,
    },
    previewText: {
      flex: 1,
      fontSize: 12,
      lineHeight: 16.5,
      fontFamily: 'Inter_500Medium',
      color: C.textSecondary,
    },

    aside: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 22, paddingRight: 2 },
    asideText: {
      flex: 1,
      fontSize: 12,
      lineHeight: 16.5,
      fontFamily: 'Inter_400Regular',
      color: C.textTertiary,
    },

    footer: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      paddingHorizontal: 18,
      paddingTop: 10,
      borderTopWidth: 1,
      borderTopColor: C.border,
      backgroundColor: C.background,
    },
    cta: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      height: 52,
      borderRadius: 15,
    },
    ctaText: { fontSize: 15.5, fontFamily: 'Inter_700Bold' },
  });
}
