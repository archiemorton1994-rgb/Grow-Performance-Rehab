import React, { useMemo } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { GrowIcon } from '@/components/GrowIcon';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useColors } from '@/constants/colors';
import { useAppStore } from '@/lib/store';
import {
  getCoachBriefing,
  getCoachSnapshot,
  messageSignature,
  weekdayForTrainingWeek,
  type CoachAction,
  type CoachMessage,
} from '@/lib/coach';

/**
 * The assistant in full: everything it has noticed, not just the top three.
 *
 * WHY THERE ARE TWO SURFACES
 * ──────────────────────────
 * The home-screen panel shows three, because three at once is a briefing and
 * six is a to-do list nobody reads. But the app now has a dozen things it can
 * observe, and a user who only ever sees the top three has no way of knowing
 * the other nine were considered at all. That is the difference between an app
 * that nags and one that has actually looked.
 *
 * So the panel is the summary and this is the file behind it. Same source, same
 * order, same wording — lib/coach.ts builds one set of buckets and both read
 * from it, which is the only reason they can never contradict each other.
 *
 * Grouped by what somebody would DO about each thing rather than by tone.
 * "What needs me" and "what is going well" are two different visits, and on a
 * screen somebody navigated to on purpose they should not be interleaved.
 *
 * SAPPHIRE THROUGHOUT, for the same reason the panel is: this is the one part
 * of the app that is not the app talking about your session. See the note on
 * the assistant palette in constants/colors.ts.
 */

function Row({
  message,
  isNew,
  onAction,
  onDismiss,
  C,
}: {
  message: CoachMessage;
  isNew: boolean;
  onAction: (a: CoachAction) => void;
  onDismiss?: (id: string) => void;
  C: ReturnType<typeof useColors>;
}) {
  const tone =
    message.tone === 'caution' ? C.warning : message.tone === 'good' ? C.primaryText : C.assistantInk;
  return (
    <View style={[styles.row, { borderColor: C.borderLight, backgroundColor: C.surface }]}>
      <View
        style={[
          styles.rowIcon,
          { backgroundColor: message.tone === 'caution' ? C.surfaceTertiary : C.assistantMuted },
        ]}
      >
        <Ionicons name={message.icon as never} size={17} color={tone} />
      </View>
      <View style={{ flex: 1, gap: 4 }}>
        <View style={styles.titleRow}>
          <Text style={[styles.title, { color: C.text }]}>{message.title}</Text>
          {isNew && (
            <View style={[styles.newPill, { backgroundColor: C.assistantFill }]}>
              <Text style={[styles.newPillText, { color: C.assistantOnFill }]}>NEW</Text>
            </View>
          )}
        </View>
        <Text style={[styles.body, { color: C.textSecondary }]}>{message.body}</Text>
        {message.action && (
          <Pressable
            onPress={() => {
              if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              onAction(message.action!);
            }}
            style={({ pressed }) => [
              styles.action,
              { backgroundColor: C.assistantMuted },
              pressed && { opacity: 0.8 },
            ]}
            testID={`assistant-action-${message.id}`}
          >
            <Text style={[styles.actionText, { color: C.assistantInk }]}>
              {message.action.label}
            </Text>
            <Ionicons name="arrow-forward" size={12} color={C.assistantInk} />
          </Pressable>
        )}
      </View>
      {message.dismissible && onDismiss && (
        <Pressable
          onPress={() => onDismiss(message.id)}
          hitSlop={10}
          testID={`assistant-dismiss-${message.id}`}
          accessibilityLabel="Dismiss this"
          accessibilityRole="button"
        >
          <Ionicons name="close" size={15} color={C.textTertiary} />
        </Pressable>
      )}
    </View>
  );
}

function Section({
  title,
  subtitle,
  count,
  children,
  C,
}: {
  title: string;
  subtitle: string;
  count: number;
  children: React.ReactNode;
  C: ReturnType<typeof useColors>;
}) {
  return (
    <View style={{ gap: 10 }}>
      <View style={styles.sectionHead}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.sectionTitle, { color: C.text }]}>{title}</Text>
          <Text style={[styles.sectionSub, { color: C.textSecondary }]}>{subtitle}</Text>
        </View>
        <View style={[styles.countPill, { backgroundColor: C.assistantMuted }]}>
          <Text style={[styles.countPillText, { color: C.assistantInk }]}>{count}</Text>
        </View>
      </View>
      {children}
    </View>
  );
}

export default function AssistantScreen() {
  const insets = useSafeAreaInsets();
  const C = useColors();
  const {
    completedSessions,
    weeklyStreakGoal,
    getStreakDays,
    getThisWeekCount,
    getAllExerciseProgress,
    exerciseStuckStreak,
    oneRepMaxes,
    weightUnit,
    coachDismissedAt,
    dismissCoachMessage,
    coachSeen,
    balanceNudgeDismissedAt,
    dismissBalanceNudge,
    isWeightReminderVisible,
  } = useAppStore();

  const goal = weeklyStreakGoal ?? 2;
  const streak = getStreakDays();
  const weekCount = getThisWeekCount();
  const daysSinceLast = useMemo(() => {
    const latest = completedSessions[0];
    if (!latest) return null;
    return Math.floor((Date.now() - new Date(latest.date).getTime()) / 86400000);
  }, [completedSessions]);

  const consecutiveActiveWeeks = useMemo(() => {
    const now = Date.now();
    let count = 0;
    for (let w = 1; w <= 8; w++) {
      const weekStart = now - w * 7 * 86400000;
      const weekEnd = now - (w - 1) * 7 * 86400000;
      const has = completedSessions.some((s) => {
        const d = new Date(s.date).getTime();
        return d >= weekStart && d < weekEnd;
      });
      if (!has) break;
      count++;
    }
    return count;
  }, [completedSessions]);

  const input = useMemo(() => {
    const sessionTypes = completedSessions.map((s) => s.sessionType);
    return {
      sessionCount: completedSessions.length,
      weekCount,
      weeklyGoal: goal,
      streak,
      consecutiveActiveWeeks,
      daysSinceLast,
      weekday: weekdayForTrainingWeek(new Date()),
      bodyweightStale: isWeightReminderVisible(),
      balance: {
        sessionTypes,
        everTrained: sessionTypes,
        dismissedAt: balanceNudgeDismissedAt,
        now: Date.now(),
      },
      sessions: completedSessions,
      progress: getAllExerciseProgress(),
      stuckStreak: exerciseStuckStreak,
      hasOneRepMax: oneRepMaxes.length > 0,
      weightUnit,
      dismissedAt: coachDismissedAt,
      now: Date.now(),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    completedSessions,
    weekCount,
    goal,
    streak,
    consecutiveActiveWeeks,
    daysSinceLast,
    coachDismissedAt,
    balanceNudgeDismissedAt,
  ]);

  const briefing = useMemo(() => getCoachBriefing(input), [input]);
  const snapshot = useMemo(() => getCoachSnapshot(input), [input]);

  const onAction = (a: CoachAction) => {
    if (a.kind === 'start-session') {
      router.push(a.sessionType ? `/readiness?sessionType=${a.sessionType}` : '/readiness');
    } else if (a.kind === 'log-weight' || a.kind === 'open-progress') {
      router.push('/(tabs)/workouts?tab=progress');
    } else {
      router.push('/(tabs)/workouts');
    }
  };
  const onDismiss = (id: string) => {
    if (id === 'balance') dismissBalanceNudge(Date.now());
    else dismissCoachMessage(id, Date.now());
  };
  const isNew = (m: CoachMessage) => coachSeen[messageSignature(m)] === undefined;

  const trend =
    snapshot.volumeDeltaPct === null
      ? '-'
      : `${snapshot.volumeDeltaPct > 0 ? '+' : ''}${snapshot.volumeDeltaPct}%`;

  return (
    <View style={{ flex: 1, backgroundColor: C.background }}>
      {/* The header is the same sapphire block the panel opens with, so
          arriving here reads as the same thing getting bigger rather than as a
          different screen. */}
      <View style={[styles.header, { backgroundColor: C.assistantFill, paddingTop: insets.top + 12 }]}>
        <View style={styles.headerTop}>
          <Pressable
            onPress={() => router.back()}
            hitSlop={12}
            testID="assistant-close"
            accessibilityLabel="Close"
            accessibilityRole="button"
          >
            <Ionicons name="chevron-down" size={22} color={C.assistantOnFill} />
          </Pressable>
          <View style={styles.headerTitleRow}>
            <Ionicons name="sparkles" size={15} color={C.assistantOnFill} />
            <Text style={[styles.headerTitle, { color: C.assistantOnFill }]}>Assistant</Text>
          </View>
          <View style={{ width: 22 }} />
        </View>
        <View style={styles.glanceRow} testID="assistant-glance">
          {[
            { v: `${snapshot.weekCount}/${snapshot.weeklyGoal}`, l: 'THIS WEEK' },
            { v: String(snapshot.streak), l: 'WEEK STREAK' },
            { v: trend, l: 'VS LAST MONTH' },
            { v: String(completedSessions.length), l: 'SESSIONS' },
          ].map((s, i) => (
            <React.Fragment key={s.l}>
              {i > 0 && (
                <View style={[styles.glanceDivider, { backgroundColor: C.assistantOnFill }]} />
              )}
              <View style={{ flex: 1, alignItems: 'center', gap: 1 }}>
                <Text style={[styles.glanceValue, { color: C.assistantOnFill }]}>{s.v}</Text>
                <Text style={[styles.glanceLabel, { color: C.assistantOnFill }]}>{s.l}</Text>
              </View>
            </React.Fragment>
          ))}
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 40, gap: 26 }}
        showsVerticalScrollIndicator={false}
      >
        {snapshot.nextSession && (
          <Animated.View entering={FadeInDown.duration(300)}>
            <Pressable
              onPress={() =>
                onAction({
                  label: snapshot.nextSession!.label,
                  kind: 'start-session',
                  sessionType: snapshot.nextSession!.type,
                })
              }
              style={({ pressed }) => [
                styles.suggestion,
                { backgroundColor: C.assistantSurface, borderColor: C.assistantMuted },
                pressed && { opacity: 0.85 },
              ]}
              testID="assistant-next-session"
            >
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={[styles.suggestionLabel, { color: C.assistantInk }]}>
                  SUGGESTED NEXT
                </Text>
                <Text style={[styles.suggestionTitle, { color: C.text }]}>
                  {snapshot.nextSession.label}
                </Text>
                <Text style={[styles.suggestionReason, { color: C.textSecondary }]}>
                  {snapshot.nextSession.reason}
                </Text>
              </View>
              <Ionicons name="arrow-forward-circle" size={30} color={C.assistantInk} />
            </Pressable>
          </Animated.View>
        )}

        {briefing.needsYou.length > 0 && (
          <Section
            title="Needs you"
            subtitle="Worth doing something about"
            count={briefing.needsYou.length}
            C={C}
          >
            {briefing.needsYou.map((m) => (
              <Row key={m.id} message={m} isNew={isNew(m)} onAction={onAction} onDismiss={onDismiss} C={C} />
            ))}
          </Section>
        )}

        {briefing.goingWell.length > 0 && (
          <Section
            title="Going well"
            subtitle="What the numbers have been doing"
            count={briefing.goingWell.length}
            C={C}
          >
            {briefing.goingWell.map((m) => (
              <Row key={m.id} message={m} isNew={isNew(m)} onAction={onAction} C={C} />
            ))}
          </Section>
        )}

        {briefing.yourTraining.length > 0 && (
          <Section
            title="Your training"
            subtitle="Observations, neither good nor bad"
            count={briefing.yourTraining.length}
            C={C}
          >
            {briefing.yourTraining.map((m) => (
              <Row key={m.id} message={m} isNew={isNew(m)} onAction={onAction} onDismiss={onDismiss} C={C} />
            ))}
          </Section>
        )}

        {briefing.total === 0 && (
          <View style={[styles.empty, { borderColor: C.borderLight, backgroundColor: C.surface }]}>
            <GrowIcon name="check" size={34} color={C.primaryText} />
            <Text style={[styles.emptyTitle, { color: C.text }]}>Nothing to flag</Text>
            <Text style={[styles.emptyBody, { color: C.textSecondary }]}>
              Your training is balanced and your numbers are current. Train a few more sessions and
              there will be more here to read.
            </Text>
          </View>
        )}

        {/* Deliberately shows every note, including ones waved away on the home
            screen. There they compete for a slot; here somebody has navigated to
            a reference on purpose, and a reference that hides the page you
            dismissed three weeks ago is a bad reference. */}
        <Section
          title="How the app works"
          subtitle="The things worth knowing about what it does on your behalf"
          count={briefing.howItWorks.length}
          C={C}
        >
          {briefing.howItWorks.map((m) => (
            <Row key={m.id} message={m} isNew={false} onAction={onAction} C={C} />
          ))}
        </Section>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 16, paddingBottom: 14, gap: 14 },
  headerTop: { flexDirection: 'row', alignItems: 'center' },
  headerTitleRow: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  headerTitle: {
    fontSize: 13,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  glanceRow: { flexDirection: 'row', alignItems: 'center' },
  glanceDivider: { width: 1, height: 24, opacity: 0.25 },
  glanceValue: { fontSize: 18, fontFamily: 'Inter_700Bold' },
  glanceLabel: { fontSize: 8.5, fontFamily: 'Inter_500Medium', letterSpacing: 0.4, opacity: 0.75 },

  suggestion: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
  },
  suggestionLabel: { fontSize: 9, fontFamily: 'Inter_700Bold', letterSpacing: 0.8 },
  suggestionTitle: { fontSize: 17, fontFamily: 'Inter_700Bold' },
  suggestionReason: { fontSize: 13, fontFamily: 'Inter_400Regular' },

  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  sectionTitle: { fontSize: 17, fontFamily: 'Inter_700Bold' },
  sectionSub: { fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 1 },
  countPill: { minWidth: 24, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 10 },
  countPillText: { fontSize: 12, fontFamily: 'Inter_700Bold', textAlign: 'center' },

  row: {
    flexDirection: 'row',
    gap: 11,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'flex-start',
  },
  rowIcon: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  title: { fontSize: 15, fontFamily: 'Inter_600SemiBold', flexShrink: 1 },
  newPill: { paddingHorizontal: 5, paddingVertical: 1, borderRadius: 3 },
  newPillText: { fontSize: 8, fontFamily: 'Inter_700Bold', letterSpacing: 0.5 },
  body: { fontSize: 13.5, fontFamily: 'Inter_400Regular', lineHeight: 19 },
  action: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 9,
    marginTop: 4,
  },
  actionText: { fontSize: 12.5, fontFamily: 'Inter_600SemiBold' },

  empty: { padding: 22, borderRadius: 14, borderWidth: 1, alignItems: 'center', gap: 6 },
  emptyTitle: { fontSize: 16, fontFamily: 'Inter_700Bold' },
  emptyBody: { fontSize: 13, fontFamily: 'Inter_400Regular', textAlign: 'center', lineHeight: 19 },
});
