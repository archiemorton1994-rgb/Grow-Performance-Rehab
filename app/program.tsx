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
import { SessionType, useAppStore, CompletedSession } from '@/lib/store';
import { countLiftingSessions, rotatesSessions } from '@/lib/session-type';
import { sessionTimeline } from '@/lib/your-sessions';
import { getSessionImage } from '@/lib/session-images';
import {
  SESSION_META,
  getSessionColors,
  SessionMeta,
  SESSION_DISPLAY_NAMES,
} from '@/lib/session-meta';
import { getEquipmentLabel, getEffectiveTier } from '@/lib/workout-engine';
import { nonStrengthContextMessage, programContextMessage } from '@/lib/program-copy';
import { ScrollIndicator, useScrollIndicator } from '@/components/ScrollIndicator';
import { ProgrammeHub } from '@/components/ProgrammeHub';
import { ChooseProgramme } from '@/components/ChooseProgramme';
import { daysSince } from '@/lib/utils';
import { resumeParams } from '@/lib/resume-params';

/** How many completed sessions the history timeline looks back over. Enough to
 *  show a rhythm, short enough to still fit on a phone above the next one. */
const RECENT_TIMELINE = 4;

/*
 * THE TIMELINE ARTWORK COMES FROM lib/session-images.ts NOW.
 *
 * This screen kept its own three-entry map of squat, bench and deadlift
 * photographs, keyed by the STORED id. Two things were wrong with that the
 * moment the rotation became Lower, Upper and Full Body: every row on the
 * timeline fell through to a plain outline icon, because the map had no entry
 * for the ids the rotation now uses; and a completed session stored under
 * 'squat' drew a barbell back squat beside the words "Lower Body", which is the
 * app disagreeing with itself.
 *
 * getSessionImage is keyed by the session the app BUILDS, so the picture always
 * matches the name printed under it, and the female artwork arrives here too.
 */

/*
 * THE LINE UNDER THE HEADER LIVES IN lib/program-copy.ts, not here.
 *
 * Both halves of it do: programContextMessage for somebody on the barbell
 * rotation, nonStrengthContextMessage for everybody else. They are pure, so
 * tests run them rather than reading this screen for phrases.
 *
 * Neither one counts down to a strength test any more. That branch is gone with
 * test weeks themselves, and with it the whole cycle arithmetic this screen used
 * to carry: a "sessions until test" tile, a trophy on the timeline row a test
 * was due on, and a dot marking every twelfth session as a test.
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
  /**
   * THE CHOOSER IS NOW SOMEWHERE YOU GO, NOT WHERE YOU LAND.
   *
   * This screen used to open on the programme chooser for everybody who was not
   * enrolled, with the rotation view hidden behind a quiet link at the foot of
   * it. That made "Your Programme" a page about programmes rather than a page
   * about the person's training, and for the majority of users - who are on no
   * programme and, by Archie's own plan, never need to be - it answered the
   * question "what am I training" with "choose one of these seven".
   *
   * So the rotation view is the default and browsing is a button on it. Nothing
   * is taken away: the chooser is one tap from the top of the screen and says
   * the same things it always did.
   */
  const [browsing, setBrowsing] = React.useState(false);

  const {
    completedSessions,
    isOnStrengthProgramme,
    getCurrentSessionType,
    getThisWeekCount,
    getStreakDays,
    weeklyStreakGoal,
    equipmentTiers,
    sessionEquipmentOverride,
    activeSession,
    clearActiveSession,
    programme,
    userProfile,
    cycleStartOffset,
  } = useAppStore();

  const suggestedNext = getCurrentSessionType();
  /**
   * WHETHER TO DRAW A ROTATION AT ALL.
   *
   * Two questions, and this screen only used to ask one. isOnStrengthProgramme
   * asks whether their recent training has been lifting; rotatesSessions asks
   * whether they are on the rotation in the first place, which a beginner with
   * no earned rung is not - they are offered Full Body every session. Missing
   * the second is how Your Programme came to mark Upper Body as "current" while
   * Home offered Full Body to the same person in the same minute.
   */
  const onRotation = isOnStrengthProgramme() && rotatesSessions(userProfile);

  /**
   * Every session that put a weight through the body, counted through
   * trainTypeOf rather than against the three lift-named ids.
   *
   * That list stopped naming a session the app builds, so somebody training
   * Lower, Upper and Full Body counted zero: this screen told them they were on
   * cycle 1, drew them at position 0 of the arc, and handed the line under the
   * header a session count of nought however long they had been training.
   */
  const strengthCount = useMemo(() => countLiftingSessions(completedSessions), [completedSessions]);

  const profileEquipment =
    equipmentTiers && equipmentTiers.length > 0 ? equipmentTiers : ['bodyweight' as const];
  const todayTiers = sessionEquipmentOverride ?? profileEquipment;
  const todayEffectiveTier = getEffectiveTier(todayTiers);

  const progCycleNumber = Math.floor(strengthCount / 3) + 1;
  /**
   * A twelve-session block, purely so the arc dots have a length to draw.
   *
   * It used to be the user's test-week frequency, with 'never' aliased to 12.
   * Test weeks are retired and there is no frequency left to read, so the alias
   * is all that survives.
   */
  const progCycleLength = 12;
  const progCyclePos = strengthCount % progCycleLength;

  // What this person actually trains, most-used first, used in place of the
  // subtitle that named three barbell lifts.
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

  const contextMsg = onRotation
    ? programContextMessage(strengthCount)
    : nonStrengthContextMessage({
        sessionCount: completedSessions.length,
        mix: trainingMix,
        weekCount: getThisWeekCount(),
        weeklyGoal: weeklyStreakGoal,
        streakWeeks: getStreakDays(),
      });

  /**
   * THE ROWS, BUILT BY lib/your-sessions.ts RATHER THAN HERE.
   *
   * Not tidiness: the row marked "current" has to be the session Home offers,
   * and this screen worked it out a second time with two thirds of the rule
   * missing. It ignored `cycleStartOffset`, so the first-session chooser would
   * have made it disagree with Home for two people in three, and it ignored the
   * beginner rule entirely. Both screens ask one function now, and a check runs
   * it against the real store across every experience level, session count and
   * offset.
   */
  const timeline = useMemo(
    () =>
      sessionTimeline({
        rotates: rotatesSessions(userProfile),
        onRotation: isOnStrengthProgramme(),
        liftingCount: strengthCount,
        cycleStartOffset,
        recentTypes: completedSessions.slice(0, RECENT_TIMELINE).map((s) => s.sessionType),
        suggestedNext,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [strengthCount, onRotation, completedSessions, suggestedNext, cycleStartOffset, userProfile]
  );

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
          <Text style={styles.headerTitle}>Your Programme</Text>
        </View>
        {/* The rotation's own badge, so it belongs to the rotation view. */}
        {!programme && !browsing && onRotation && (
          <View style={styles.cycleBadge}>
            <Text style={styles.cycleBadgeText}>Cycle {progCycleNumber}</Text>
          </View>
        )}
      </View>

      {/**
       * ENROLLED, SO THE HUB. OTHERWISE THEIR OWN SESSIONS, unless they asked
       * to browse.
       *
       * The order of those last two has been swapped. This screen opened on the
       * chooser for everybody who was not enrolled, which made a page called
       * "Your Programme" into a page about OUR programmes: somebody who trains
       * three times a week, on nothing, and by the plan never needs to be on
       * anything, opened it and was shown seven things to sign up to and a
       * quiet link at the bottom to see what they were already doing.
       *
       * Now it answers the question it is named after first, and browsing is a
       * button on it. Nothing was removed from the chooser and nothing about it
       * changed, including the sentence saying nobody needs one.
       */}
      {programme ? (
        <ProgrammeHub />
      ) : browsing ? (
        <ChooseProgramme onKeepRotation={() => setBrowsing(false)} />
      ) : (
      <>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
        {...scrollHint.handlers}
      >
        {/* Subtitle. It named the three barbell lifts, which stopped being
            sessions the app builds and was the last place on any screen still
            printing them at somebody. The rotation is what it has always been
            underneath: Lower, Upper, Full. */}
        <Text style={styles.subtitle}>
          {onRotation
            ? `Lower Body · Upper Body · Full Body · ${getEquipmentLabel(todayEffectiveTier)}`
            : `${trainingMix} · ${getEquipmentLabel(todayEffectiveTier)}`}
        </Text>

        {/* THE WAY ON TO A PROGRAMME, on the screen that used to BE the way on.
            Said as an offer rather than a prompt: this page is about what they
            already train, and a programme is one of the things they could do
            next rather than something missing from their account. */}
        <Pressable
          onPress={() => {
            if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setBrowsing(true);
          }}
          testID="program-browse-programmes"
          accessibilityRole="button"
          style={({ pressed }) => [styles.browseBtn, pressed && { opacity: 0.85 }]}
        >
          <Ionicons name="albums-outline" size={18} color={C.primaryText} />
          <View style={{ flex: 1 }}>
            <Text style={styles.browseTitle}>Browse programmes</Text>
            <Text style={styles.browseSub}>
              Optional. Pick one and your sessions are chosen for you, week by week.
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={C.textTertiary} />
        </Pressable>

        {/* Stats row. "Until test" is meaningless to someone who is not being
            tested, so it is replaced rather than left showing a countdown to an
            event that will never arrive. */}
        <View style={styles.cycleInfo}>
          <View style={styles.cycleCard}>
            {onRotation ? (
              <Text style={styles.cycleValue}>Cycle {progCycleNumber}</Text>
            ) : (
              <Text style={styles.cycleNumber}>{getThisWeekCount()}</Text>
            )}
            <Text style={styles.cycleLabel}>{onRotation ? 'of your program' : 'this week'}</Text>
          </View>
          <View style={styles.cycleDivider} />
          <View style={styles.cycleCard}>
            <Text style={styles.cycleNumber}>{completedSessions.length}</Text>
            <Text style={styles.cycleLabel}>sessions done</Text>
          </View>
          <View style={styles.cycleDivider} />
          {/* This used to be a live countdown to the next strength test. Test
              weeks are retired, so it shows the week streak for everybody, which
              is what the non-strength branch always showed. */}
          <View style={styles.cycleCard}>
            <Text style={styles.cycleNumber}>{getStreakDays()}</Text>
            <Text style={styles.cycleLabel}>week streak</Text>
          </View>
        </View>

        {/* Arc dots — position within a cycle, so only meaningful on one. */}
        {onRotation && (
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
                  ]}
                >
                  {isCompleted && <Ionicons name="checkmark" size={10} color={C.textInverse} />}
                  {isCurrent && <View style={styles.currentPulse} />}
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
                  isCompleted && styles.timelineCardDone,
                  pressed && isCurrent && { opacity: 0.9 },
                ]}
              >
                <View style={[styles.cardIcon, { backgroundColor: C.surface }]}>
                  <Image
                    source={getSessionImage(item.sessionType, userProfile?.sex)}
                    style={{ width: 28, height: 28 }}
                    resizeMode="contain"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.cardTitle, isCompleted && styles.cardTitleDone]}>
                    {SESSION_DISPLAY_NAMES[item.sessionType]}
                  </Text>
                  <Text style={styles.cardSub}>{itemMeta.subtitle}</Text>
                  {!isCompleted && (
                    <Text style={styles.cardRecency}>{lastTrained[item.sessionType]}</Text>
                  )}
                </View>
                {isCurrent && !activeSession && (
                  <View style={styles.startPill}>
                    <Ionicons name="play" size={14} color={C.textInverse} />
                  </View>
                )}
                {isCompleted && <Ionicons name="checkmark-circle" size={20} color={C.primaryText} />}
              </Pressable>
            </View>
          );
        })}
      </ScrollView>
      <ScrollIndicator {...scrollHint.state} top={8} bottom={24} />
      </>
      )}
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
      borderRadius: 10,
    },
    headerTitle: { fontSize: 18, fontFamily: 'Inter_700Bold', color: C.text },
    cycleBadge: {
      backgroundColor: C.primaryMuted,
      borderRadius: 10,
      paddingHorizontal: 10,
      paddingVertical: 4,
    },
    cycleBadgeText: { fontSize: 12, fontFamily: 'Inter_600SemiBold', color: C.primaryText },

    content: { paddingHorizontal: 20, paddingTop: 16, gap: 10 },

    subtitle: {
      fontSize: 13,
      fontFamily: 'Inter_500Medium',
      color: C.textSecondary,
      marginBottom: 2,
    },

    browseBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      padding: 12,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: C.primaryMuted,
      backgroundColor: C.primarySurface,
    },
    browseTitle: { fontSize: 14, fontFamily: 'Inter_700Bold', color: C.text },
    browseSub: {
      fontSize: 11.5,
      lineHeight: 16,
      fontFamily: 'Inter_400Regular',
      color: C.textSecondary,
      marginTop: 1,
    },

    cycleInfo: {
      flexDirection: 'row',
      backgroundColor: C.surface,
      borderRadius: 14,
      padding: 16,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: C.borderLight,
    },
    cycleCard: { flex: 1, alignItems: 'center' },
    cycleValue: { fontSize: 15, fontFamily: 'Inter_700Bold', color: C.primaryText },
    cycleNumber: { fontSize: 22, fontFamily: 'Inter_700Bold', color: C.primaryText },
    cycleLabel: {
      fontSize: 10,
      fontFamily: 'Inter_500Medium',
      color: C.textSecondary,
      marginTop: 2,
      textAlign: 'center',
    },
    cycleDivider: { width: 1, height: 32, backgroundColor: C.border },

    arcCard: {
      backgroundColor: C.surface,
      borderRadius: 14,
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
    timelineCardDone: { opacity: 0.6 },
    cardIcon: {
      width: 36,
      height: 36,
      borderRadius: 10,
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
      fontSize: 10,
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
  });
}
