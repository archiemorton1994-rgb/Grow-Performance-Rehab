import React, { useMemo } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  Platform,
  Alert,
  Image,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/constants/colors';
import {
  SessionType,
  useAppStore,
  STRENGTH_SESSION_TYPES,
  CompletedSession,
  SESSION_ORDER,
} from '@/lib/store';
import {
  SESSION_META,
  getSessionColors,
  SessionMeta,
  SESSION_DISPLAY_NAMES,
} from '@/lib/session-meta';
import { getEquipmentLabel, getEffectiveTier } from '@/lib/workout-engine';
import { programContextMessage, sessionsUntilTest } from '@/lib/test-week-copy';
import { nonStrengthContextMessage } from '@/lib/program-copy';
import { ScrollIndicator, useScrollIndicator } from '@/components/ScrollIndicator';
import { daysSince } from '@/lib/utils';
import { resumeParams } from '@/lib/resume-params';

/** How many completed sessions the non-barbell timeline looks back over. Enough
 *  to show a rhythm, short enough to still fit on a phone above the next one. */
const NON_KPI_TIMELINE = 4;

// ─── Session PNG images ───────────────────────────────────────────────────────
const SESSION_IMAGES: Partial<Record<string, any>> = {
  squat: require('@/assets/images/sessions/squat.png'),
  bench: require('@/assets/images/sessions/bench.png'),
  deadlift: require('@/assets/images/sessions/deadlift.png'),
};

/*
 * getContextMessage MOVED TO lib/test-week-copy.ts as programContextMessage,
 * and not only for tidiness.
 *
 * It took a plain `testWeekFrequency: number`, and the caller passed
 * `cycleLength` - which is the frequency with 'never' aliased to 12 so the arc
 * dots below have something to draw. So somebody who had switched strength
 * tests off, and still trains the barbell lifts, was told "2 sessions until
 * your next strength test" about a schedule they had cancelled. If they went
 * looking for it they found nothing, because isTestWeekDue is permanently false
 * for them.
 *
 * The replacement takes the real TestWeekFrequency, gates every sentence that
 * mentions a test on it, and is run by tests/test-week-honesty.check.mjs rather
 * than read.
 */

function getLastTrainedLabel(
  completedSessions: CompletedSession[],
  sessionType: SessionType
): string {
  const matches = completedSessions.filter((s) => s.sessionType === sessionType);
  if (matches.length === 0) return 'Not done yet';
  const days = daysSince(matches[0].date);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  return `${days} days ago`;
}

// ─────────────────────────────────────────────────────────────────────────────

export default function ProgramScreen() {
  const insets = useSafeAreaInsets();
  const scrollHint = useScrollIndicator();
  const C = useColors();
  const webTopInset = Platform.OS === 'web' ? 67 : 0;

  const {
    completedSessions,
    testWeekFrequency,
    isTestWeekDue,
    isOnStrengthProgramme,
    getCurrentSessionType,
    getThisWeekCount,
    getStreakDays,
    weeklyStreakGoal,
    equipmentTiers,
    sessionEquipmentOverride,
    activeSession,
    clearActiveSession,
  } = useAppStore();

  const onStrengthProgramme = isOnStrengthProgramme();
  /**
   * A DUE TEST ONLY MEANS ANYTHING ON THE BARBELL ROTATION.
   *
   * isTestWeekDue() is about the strength-session count and knows nothing about
   * what the user has been training lately. Someone who did twelve barbell
   * sessions and then six weeks of conditioning is off the programme by
   * isOnStrengthProgramme's own reckoning, and still has a test outstanding -
   * so this screen drew a trophy and the words "Strength Test" over their next
   * conditioning session, and the start button sent isTestWeek:'true' with it.
   */
  const testWeek = isTestWeekDue() && onStrengthProgramme;
  const suggestedNext = getCurrentSessionType();

  const strengthCount = useMemo(
    () => completedSessions.filter((s) => STRENGTH_SESSION_TYPES.includes(s.sessionType)).length,
    [completedSessions]
  );

  const profileEquipment =
    equipmentTiers && equipmentTiers.length > 0 ? equipmentTiers : ['bodyweight' as const];
  const todayTiers = sessionEquipmentOverride ?? profileEquipment;
  const todayEffectiveTier = getEffectiveTier(todayTiers);

  const progCycleNumber = Math.floor(strengthCount / 3) + 1;
  // With test weeks off there is no cycle to be part-way through, so fall back
  // to the default block length purely so the dots have something to draw.
  // (The whole of this screen is still the three-lift rotation by construction
  // — making it speak a non-KPI plan is the next piece of work, not this one.)
  const cycleLength = testWeekFrequency === 'never' ? 12 : testWeekFrequency;
  const progCyclePos = strengthCount % cycleLength;
  const progCycleLength = cycleLength;
  // null when strength tests are off, which is what stops the tile below from
  // counting down to an event that will never arrive.
  const progSessToTest = sessionsUntilTest(testWeekFrequency, strengthCount);

  // What this person actually trains, most-used first — used in place of the
  // hardcoded "Squat · Bench · Deadlift" subtitle.
  const trainingMix = useMemo(() => {
    const counts = new Map<SessionType, number>();
    for (const s of completedSessions) {
      counts.set(s.sessionType, (counts.get(s.sessionType) ?? 0) + 1);
    }
    const top = [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([t]) => SESSION_DISPLAY_NAMES[t]);
    return top.length > 0 ? top.join(' · ') : 'Your own mix';
  }, [completedSessions]);

  const contextMsg = onStrengthProgramme
    ? programContextMessage(testWeekFrequency, strengthCount, testWeek)
    : nonStrengthContextMessage({
        sessionCount: completedSessions.length,
        mix: trainingMix,
        weekCount: getThisWeekCount(),
        weeklyGoal: weeklyStreakGoal,
        streakWeeks: getStreakDays(),
      });

  const timeline = useMemo(() => {
    const items: {
      sessionType: SessionType;
      status: 'completed' | 'current' | 'upcoming';
      isTestMarker: boolean;
    }[] = [];

    // Not on the barbell rotation? Then do not draw one.
    //
    // This screen used to build its timeline from SESSION_ORDER[i % 3]
    // unconditionally, so someone who has never lifted a barbell opened "Your
    // Program" and was shown a nine-row squat/bench/deadlift cycle with "Not
    // done yet" beside every one of them. The rest of the app had already been
    // taught not to assume that; this screen had not, which made it the loudest
    // remaining contradiction in the app.
    //
    // Their programme is what they actually do, so it is drawn from history:
    // the last few sessions completed, then whatever the home card is
    // suggesting next. Same decision function as the home card, so the two can
    // never disagree about which programme someone is on.
    if (!onStrengthProgramme) {
      const recent = completedSessions.slice(0, NON_KPI_TIMELINE).reverse();
      for (const s of recent) {
        items.push({ sessionType: s.sessionType, status: 'completed', isTestMarker: false });
      }
      items.push({ sessionType: suggestedNext, status: 'current', isTestMarker: false });
      return items;
    }

    const tlLen = Math.min(cycleLength, 9);
    const posInCycle = strengthCount % tlLen;
    for (let i = 0; i < tlLen; i++) {
      const sessionType = SESSION_ORDER[i % 3];
      const status: 'completed' | 'current' | 'upcoming' =
        i < posInCycle ? 'completed' : i === posInCycle ? 'current' : 'upcoming';
      const sessionNumber = strengthCount - posInCycle + i + 1;
      const isTestMarker = testWeekFrequency !== 'never' && sessionNumber % cycleLength === 0;
      items.push({ sessionType, status, isTestMarker });
    }
    return items;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [strengthCount, testWeekFrequency, onStrengthProgramme, completedSessions, suggestedNext]);

  /**
   * Every session type, not just the three barbell lifts.
   *
   * It was built over SESSION_ORDER only, so a timeline row for a conditioning,
   * mobility or full-body session looked up a key the map did not have and
   * rendered a blank line. The `as Record<SessionType, string>` cast is what
   * stopped the typechecker saying so.
   */
  const lastTrained = useMemo(() => {
    const result = {} as Record<SessionType, string>;
    for (const type of Object.keys(SESSION_META) as SessionType[]) {
      result[type] = getLastTrainedLabel(completedSessions, type);
    }
    return result;
  }, [completedSessions]);

  const SESSION_TYPE_META = useMemo(() => {
    const colors = getSessionColors(C);
    const result = {} as Record<
      SessionType,
      SessionMeta & ReturnType<typeof getSessionColors>[SessionType]
    >;
    (Object.keys(SESSION_META) as SessionType[]).forEach((type) => {
      result[type] = { ...SESSION_META[type], ...colors[type] };
    });
    return result;
  }, [C]);

  const confirmReplaceActive = (onContinue: () => void) => {
    Alert.alert(
      'A session is already in progress',
      'Resume your current session, or discard it and start the new one?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Resume current',
          onPress: () => {
            if (!activeSession) return;
            if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            router.push({
              pathname: '/session',
              params: resumeParams(activeSession),
            });
          },
        },
        {
          text: 'Discard & start new',
          style: 'destructive',
          onPress: () => {
            clearActiveSession();
            onContinue();
          },
        },
      ]
    );
  };

  const handleStartCurrent = () => {
    const currentItem = timeline.find((i) => i.status === 'current');
    if (!currentItem) return;
    const go = () => {
      if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const equipmentOverrideParam = sessionEquipmentOverride
        ? JSON.stringify(sessionEquipmentOverride)
        : undefined;
      router.push({
        pathname: '/readiness',
        params: {
          sessionType: currentItem.sessionType,
          isTestWeek: testWeek ? 'true' : 'false',
          equipmentOverride: equipmentOverrideParam,
        },
      });
    };
    if (activeSession) {
      confirmReplaceActive(go);
      return;
    }
    go();
  };

  const styles = useMemo(() => makeStyles(C), [C]);

  return (
    <View style={[styles.container, { paddingTop: insets.top + webTopInset }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.6 }]}
          testID="program-back"
          accessibilityLabel="Back"
          accessibilityRole="button"
        >
          <Ionicons name="chevron-back" size={24} color={C.text} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Your Program</Text>
        </View>
        {onStrengthProgramme && (
          <View style={styles.cycleBadge}>
            <Text style={styles.cycleBadgeText}>Cycle {progCycleNumber}</Text>
          </View>
        )}
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
        {...scrollHint.handlers}
      >
        {/* Subtitle */}
        <Text style={styles.subtitle}>
          {onStrengthProgramme
            ? `Squat · Bench · Deadlift · ${getEquipmentLabel(todayEffectiveTier)}`
            : `${trainingMix} · ${getEquipmentLabel(todayEffectiveTier)}`}
        </Text>

        {/* Stats row. "Until test" is meaningless to someone who is not being
            tested, so it is replaced rather than left showing a countdown to an
            event that will never arrive. */}
        <View style={styles.cycleInfo}>
          <View style={styles.cycleCard}>
            {onStrengthProgramme ? (
              <Text style={styles.cycleValue}>Cycle {progCycleNumber}</Text>
            ) : (
              <Text style={styles.cycleNumber}>{getThisWeekCount()}</Text>
            )}
            <Text style={styles.cycleLabel}>
              {onStrengthProgramme ? 'of your program' : 'this week'}
            </Text>
          </View>
          <View style={styles.cycleDivider} />
          <View style={styles.cycleCard}>
            <Text style={styles.cycleNumber}>{completedSessions.length}</Text>
            <Text style={styles.cycleLabel}>sessions done</Text>
          </View>
          <View style={styles.cycleDivider} />
          {/*
            THE GATE IS THE FREQUENCY, NOT THE PROGRAMME.

            This read onStrengthProgramme, which is about what the user trains.
            Whether a test is coming is about what they agreed to, and the two
            are different people: somebody who squats, benches and deadlifts and
            turned strength tests OFF is on the strength programme and is never
            tested. They were shown a live countdown to it. progSessToTest is
            null for them now and they get their week streak, which is the same
            thing the non-strength branch already showed.
          */}
          <View style={styles.cycleCard}>
            <Text style={styles.cycleNumber}>
              {progSessToTest !== null ? progSessToTest : getStreakDays()}
            </Text>
            <Text style={styles.cycleLabel}>
              {progSessToTest !== null ? 'until test' : 'week streak'}
            </Text>
          </View>
        </View>

        {/* Arc dots — position within a cycle, so only meaningful on one. */}
        {onStrengthProgramme && (
        <View style={styles.arcCard}>
          <View style={styles.arcHeader}>
            <Text style={styles.arcLabel}>
              Session {progCyclePos + 1} of {progCycleLength}
            </Text>
            <Text style={styles.arcSublabel}>current cycle</Text>
          </View>
          <View style={styles.arcDots}>
            {Array.from({ length: progCycleLength }, (_, i) => {
              const isDone = i < progCyclePos;
              const isCur = i === progCyclePos;
              return (
                <View
                  key={i}
                  style={[
                    styles.arcDot,
                    isDone && styles.arcDotDone,
                    isCur && styles.arcDotCurrent,
                  ]}
                />
              );
            })}
          </View>
        </View>
        )}

        {/* Context message */}
        <View style={styles.contextRow}>
          <View style={styles.contextDot} />
          <Text style={styles.contextText}>{contextMsg}</Text>
        </View>

        {/* Timeline */}
        {timeline.map((item, index) => {
          const isCurrent = item.status === 'current';
          const isCompleted = item.status === 'completed';
          const itemMeta = SESSION_TYPE_META[item.sessionType];
          return (
            <View key={index} style={styles.timelineRow}>
              <View style={styles.timelineTrack}>
                <View
                  style={[
                    styles.timelineDot,
                    isCompleted && styles.timelineDotDone,
                    isCurrent && styles.timelineDotCurrent,
                    isCurrent && testWeek && styles.timelineDotTest,
                  ]}
                >
                  {isCompleted && <Ionicons name="checkmark" size={10} color={C.textInverse} />}
                  {isCurrent && (
                    <View
                      style={[
                        styles.currentPulse,
                        testWeek && { backgroundColor: C.categoryPrehabText },
                      ]}
                    />
                  )}
                </View>
                {index < timeline.length - 1 && (
                  <View style={[styles.timelineLine, isCompleted && styles.timelineLineDone]} />
                )}
              </View>
              <Pressable
                onPress={() => {
                  if (isCurrent) handleStartCurrent();
                }}
                disabled={!isCurrent}
                style={({ pressed }) => [
                  styles.timelineCard,
                  isCurrent && styles.timelineCardCurrent,
                  isCurrent && testWeek && styles.timelineCardTest,
                  isCompleted && styles.timelineCardDone,
                  pressed && isCurrent && { opacity: 0.9 },
                ]}
              >
                <View style={[styles.cardIcon, { backgroundColor: C.surface }]}>
                  {isCurrent && testWeek ? (
                    <Ionicons name="trophy" size={18} color={C.categoryPrehabText} />
                  ) : SESSION_IMAGES[item.sessionType] ? (
                    <Image
                      source={SESSION_IMAGES[item.sessionType]}
                      style={{ width: 28, height: 28 }}
                      resizeMode="contain"
                    />
                  ) : (
                    <Ionicons name={itemMeta.icon as any} size={18} color={itemMeta.color} />
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.cardTitle, isCompleted && styles.cardTitleDone]}>
                    {SESSION_DISPLAY_NAMES[item.sessionType]}
                  </Text>
                  <Text style={styles.cardSub}>
                    {isCurrent && testWeek ? 'Strength Test' : itemMeta.subtitle}
                  </Text>
                  {!isCompleted && (
                    <Text style={styles.cardRecency}>{lastTrained[item.sessionType]}</Text>
                  )}
                </View>
                {isCurrent && !activeSession && (
                  <View style={[styles.startPill, testWeek && styles.startPillTest]}>
                    <Ionicons name="play" size={14} color={C.textInverse} />
                  </View>
                )}
                {isCompleted && <Ionicons name="checkmark-circle" size={20} color={C.primaryText} />}
                {item.isTestMarker && !isCurrent && (
                  <View style={styles.testMarker}>
                    <Ionicons name="trophy-outline" size={12} color={C.categoryPrehabText} />
                  </View>
                )}
              </Pressable>
            </View>
          );
        })}
      </ScrollView>
      <ScrollIndicator {...scrollHint.state} top={8} bottom={24} />
    </View>
  );
}

function makeStyles(C: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: C.background },

    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 12,
      gap: 8,
      borderBottomWidth: 1,
      borderBottomColor: C.borderLight,
    },
    backBtn: {
      width: 36,
      height: 36,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 8,
    },
    headerTitle: { fontSize: 20, fontFamily: 'Inter_700Bold', color: C.text },
    cycleBadge: {
      backgroundColor: C.primaryMuted,
      borderRadius: 8,
      paddingHorizontal: 10,
      paddingVertical: 4,
    },
    cycleBadgeText: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: C.primaryText },

    content: { paddingHorizontal: 20, paddingTop: 16, gap: 10 },

    subtitle: {
      fontSize: 13,
      fontFamily: 'Inter_500Medium',
      color: C.textSecondary,
      marginBottom: 2,
    },

    cycleInfo: {
      flexDirection: 'row',
      backgroundColor: C.surface,
      borderRadius: 12,
      padding: 16,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: C.borderLight,
    },
    cycleCard: { flex: 1, alignItems: 'center' },
    cycleValue: { fontSize: 15, fontFamily: 'Inter_700Bold', color: C.primaryText },
    cycleNumber: { fontSize: 20, fontFamily: 'Inter_700Bold', color: C.primaryText },
    cycleLabel: {
      fontSize: 11,
      fontFamily: 'Inter_500Medium',
      color: C.textSecondary,
      marginTop: 2,
      textAlign: 'center',
    },
    cycleDivider: { width: 1, height: 32, backgroundColor: C.border },

    arcCard: {
      backgroundColor: C.surface,
      borderRadius: 12,
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderWidth: 1,
      borderColor: C.borderLight,
    },
    arcHeader: {
      flexDirection: 'row',
      alignItems: 'baseline',
      gap: 6,
      marginBottom: 10,
    },
    arcLabel: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: C.text },
    arcSublabel: { fontSize: 11, fontFamily: 'Inter_400Regular', color: C.textTertiary },
    arcDots: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
    arcDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: C.surfaceTertiary,
      borderWidth: 1,
      borderColor: C.border,
    },
    arcDotDone: { backgroundColor: C.primary, borderColor: C.primary },
    arcDotCurrent: {
      backgroundColor: C.primary,
      borderColor: C.primary,
      width: 10,
      height: 10,
      borderRadius: 5,
    },

    contextRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 8,
      paddingHorizontal: 2,
    },
    contextDot: {
      width: 5,
      height: 5,
      borderRadius: 2.5,
      backgroundColor: C.primary,
      marginTop: 6,
      flexShrink: 0,
    },
    contextText: {
      flex: 1,
      fontSize: 13,
      fontFamily: 'Inter_500Medium',
      color: C.textSecondary,
      lineHeight: 18,
    },

    timelineRow: { flexDirection: 'row' },
    timelineTrack: { width: 28, alignItems: 'center' },
    timelineDot: {
      width: 18,
      height: 18,
      borderRadius: 9,
      backgroundColor: C.surfaceTertiary,
      borderWidth: 1.5,
      borderColor: C.border,
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1,
    },
    timelineDotDone: { backgroundColor: C.primary, borderColor: C.primary },
    timelineDotCurrent: {
      backgroundColor: C.surface,
      borderColor: C.primary,
      borderWidth: 2.5,
    },
    timelineDotTest: { borderColor: C.categoryPrehabText },
    currentPulse: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: C.primary },
    timelineLine: { width: 2, flex: 1, backgroundColor: C.border, marginVertical: -2 },
    timelineLineDone: { backgroundColor: C.primary },
    timelineCard: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: C.surface,
      borderRadius: 12,
      padding: 12,
      marginLeft: 10,
      marginBottom: 6,
      borderWidth: 1,
      borderColor: C.borderLight,
    },
    timelineCardCurrent: { borderColor: C.primary, borderWidth: 1.5 },
    timelineCardTest: { borderColor: C.categoryPrehabText },
    timelineCardDone: { opacity: 0.6 },
    cardIcon: {
      width: 36,
      height: 36,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 10,
    },
    cardTitle: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: C.text },
    cardTitleDone: { textDecorationLine: 'line-through', color: C.textSecondary },
    cardSub: {
      fontSize: 11,
      fontFamily: 'Inter_400Regular',
      color: C.textSecondary,
      marginTop: 1,
    },
    cardRecency: {
      fontSize: 11,
      fontFamily: 'Inter_400Regular',
      color: C.textTertiary,
      marginTop: 1,
    },
    startPill: {
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: C.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    startPillTest: { backgroundColor: C.categoryPrehabText },
    testMarker: {
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: C.categoryPrehab,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
}
