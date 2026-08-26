import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { useScrollToTopRegister } from '@/lib/scroll-to-top-context';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Platform,
  Alert,
  Image,
  Modal,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, {
  FadeInDown,
  FadeInUp,
  FadeOutDown,
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useColors } from '@/constants/colors';
import { shadowStyle } from '@/constants/shadows';
import { useAppStore, STRENGTH_SESSION_TYPES } from '@/lib/store';
import { getSessionImage } from '@/lib/session-images';
import { getTimeOfDayGreeting, kgToDisplayUnit, displayUnitToKg } from '@/lib/utils';
import { SESSION_META, SESSION_SHORT_LABELS } from '@/lib/session-meta';
import { getEquipmentLabel, getEffectiveTier, COMEBACK_SESSIONS } from '@/lib/workout-engine';
import { EquipmentIcon } from '@/components/EquipmentIcon';
import { scheduleBodyweightReminder, cancelBodyweightReminder } from '@/lib/notifications';
import CoachMark, { SpotlightRect } from '@/components/CoachMark';
import { CoachButton, CoachBubble } from '@/components/CoachBubble';
import {
  getCoachMessages,
  getCoachSnapshot,
  hasActionableAdvice,
  messageSignature,
  weekdayForTrainingWeek,
  type CoachAction,
} from '@/lib/coach';
import { resumeParams } from '@/lib/resume-params';

/**
 * THE TOUR, REBUILT — and mostly by deleting.
 *
 * It ran to eighteen cards across five tabs before the user had done anything,
 * and length was the whole problem: nobody reads eighteen, so the ones that
 * mattered were never reached. It is twelve now, and the cuts followed three
 * rules.
 *
 * DO NOT NARRATE AN EMPTY SCREEN. Five steps described data a first-run user
 * does not have — a training block with no sessions in it, a program rotation
 * that has not started, badges nobody has earned, charts that "fill in as you
 * log". Being told about a number you cannot see teaches you the app is talking
 * to someone else.
 *
 * SAY IT ONCE. The streak was explained on Home, again on Profile and again on
 * Stats. It is explained here, and nowhere else.
 *
 * EARN THE STEP. Anything self-evident from its own heading went. "Additional
 * Sessions" is a heading above four named cards; a card explaining that they
 * are four ways to train is a card spent on nothing.
 *
 * What went IN is the assistant, which was in the app and in no tour — the one
 * place that says what the app has noticed about your training, behind a button
 * most people would never press unprompted.
 */
interface HomeTutorialStep {
  spotlightRef: 'session' | 'coach' | 'streak';
  iconName: string;
  iconLabel: string;
  title: string;
  body: string;
}

const HOME_TUTORIAL: readonly HomeTutorialStep[] = [
  {
    spotlightRef: 'session',
    iconName: 'flash-outline',
    iconLabel: 'Today',
    title: 'Start here every day',
    body: "This card always shows what to train today, rotating through Squat, Bench and Deadlift. Tap Start and the whole session gets built for you.",
  },
  {
    spotlightRef: 'coach',
    iconName: 'chatbubble-ellipses-outline',
    iconLabel: 'Assistant',
    title: 'What the app has noticed',
    body: 'Everything it has to say lives behind this button: when you are due a lighter week, when one side of your training is getting thin, when a weight looks stale. It stays out of your way until you open it.',
  },
  {
    spotlightRef: 'streak',
    iconName: 'flame-outline',
    iconLabel: 'Streak',
    title: 'Consistent, not perfect',
    body: 'Your streak counts weeks you hit your goal, not days in a row. Miss a session and it survives; miss a week and it starts again.',
  },
] as const;

const HOME_ICONS = {
  weekStreak: require('@/assets/images/home/week-streak.png'),
  yourProgram: require('@/assets/images/home/your-program.png'),
  totalWorkouts: require('@/assets/images/home/total-workouts.png'),
  achievements: require('@/assets/images/home/achievements.png'),
} as const;

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const C = useColors();
  const tabBarHeight = insets.bottom + 50;
  const {
    completedSessions,
    getCurrentSessionType,
    getStreakDays,
    getThisWeekCount,
    weeklyStreakGoal,
    getTestWeekProgress,
    getReturnWindow,
    isWeightReminderVisible,
    userProfile,
    setUserProfile,
    activeSession,
    clearActiveSession,
    setCycleStartOffset,
    profilePhotoUri,
    testWeekFrequency,
    weightUnit,
    equipmentTiers,
    sessionEquipmentOverride,
    setSessionEquipmentOverride,
    clearSessionEquipmentOverride,
    bodyweightUpdatedAt,
    setWeightReminderSnoozedAt,
    bodyweightReminderEnabled,
    earnedBadges,
    calibrationBannerDismissed,
    setCalibrationBannerDismissed,
    tourJustCompleted,
    setTourJustCompleted,
    tourActiveTab,
    setTourActiveTab,
    skipTour,
    balanceNudgeDismissedAt,
    dismissBalanceNudge,
    coachDismissedAt,
    dismissCoachMessage,
    coachSeen,
    markCoachSeen,
    exerciseStuckStreak,
    oneRepMaxes,
    getAllExerciseProgress,
  } = useAppStore();

  const [coachOpen, setCoachOpen] = useState(false);

  const isBeginnerExperience = userProfile?.experienceLevel === 'beginner';
  const ALL_TIERS = ['bodyweight', 'bands', 'dumbbells', 'kettlebells', 'fullgym'] as const;
  const availableTiers = isBeginnerExperience ? (['bodyweight', 'bands'] as const) : ALL_TIERS;

  const profileEquipment =
    equipmentTiers && equipmentTiers.length > 0 ? equipmentTiers : ['bodyweight' as const];
  const todayTiers = sessionEquipmentOverride ?? profileEquipment;
  const todayEffectiveTier = getEffectiveTier(todayTiers);
  const hasFullGym = profileEquipment.includes('fullgym');

  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetDraft, setSheetDraft] = useState<(typeof ALL_TIERS)[number][]>([]);

  const openEquipmentSheet = () => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSheetDraft([...todayTiers]);
    setSheetOpen(true);
  };

  const handleDraftToggle = (tier: (typeof ALL_TIERS)[number]) => {
    if (!(availableTiers as readonly string[]).includes(tier)) return;
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSheetDraft((prev) => {
      if (tier === 'fullgym') {
        return prev.includes('fullgym') ? prev.filter((t) => t !== 'fullgym') : [...ALL_TIERS];
      }
      if (prev.includes(tier)) {
        const next = prev.filter((t) => t !== tier && t !== 'fullgym');
        return next.length > 0 ? next : [tier];
      }
      return [...prev, tier];
    });
  };

  const confirmEquipment = () => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSessionEquipmentOverride([...sheetDraft]);
    setSheetOpen(false);
  };

  const resetEquipmentToProfile = () => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    clearSessionEquipmentOverride();
    setSheetOpen(false);
  };

  const suggestedSession = getCurrentSessionType();
  const streak = getStreakDays();
  const weekCount = getThisWeekCount();
  const testWeekProgress = getTestWeekProgress();
  const testWeek = testWeekProgress.active;
  const testHeld = testWeekProgress.held;
  const firstName = userProfile.name ? userProfile.name.split(' ')[0] : null;
  const greeting = getTimeOfDayGreeting();
  const lastSession = completedSessions.length > 0 ? completedSessions[0] : null;

  const daysSinceLast = useMemo(() => {
    if (!lastSession) return null;
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const startOfLast = new Date(lastSession.date);
    startOfLast.setHours(0, 0, 0, 0);
    return Math.floor((startOfToday.getTime() - startOfLast.getTime()) / 86400000);
  }, [lastSession]);

  const lastSessionRelativeLabel =
    daysSinceLast === null
      ? null
      : daysSinceLast <= 0
        ? 'today'
        : daysSinceLast === 1
          ? 'yesterday'
          : `${daysSinceLast} days ago`;

  const MILESTONE_VALUES = [1, 5, 10, 25, 50, 100, 150, 200];
  const milestoneHit =
    lastSession &&
    daysSinceLast !== null &&
    daysSinceLast <= 1 &&
    MILESTONE_VALUES.includes(completedSessions.length)
      ? completedSessions.length
      : null;

  const calibrationComplete =
    completedSessions.length === 3 &&
    daysSinceLast !== null &&
    daysSinceLast <= 1 &&
    !calibrationBannerDismissed;

  // Warn when the user has an established streak but this week's sessions
  // haven't hit the goal yet. Only show from Wednesday onwards to avoid
  // alarming people who simply haven't trained early in the week.
  const goal = weeklyStreakGoal ?? 2;
  // Sunday is 7 here, not 0. The training week runs Monday to Sunday, so the
  // raw getDay() numbering hid this on the single last day it could be acted
  // on. weekdayForTrainingWeek is shared with lib/coach.ts so the two rules
  // cannot drift apart again.
  const missedStreakWarning =
    completedSessions.length >= 3 &&
    streak > 0 &&
    weekCount < goal &&
    weekdayForTrainingWeek(new Date()) >= 3;

  const [milestoneToastDismissed, setMilestoneToastDismissed] = useState(false);

  const consecutiveActiveWeeks = useMemo(() => {
    const now = Date.now();
    let count = 0;
    for (let w = 1; w <= 8; w++) {
      const weekStart = now - w * 7 * 86400000;
      const weekEnd = now - (w - 1) * 7 * 86400000;
      const hasSession = completedSessions.some((s) => {
        const d = new Date(s.date).getTime();
        return d >= weekStart && d < weekEnd;
      });
      if (!hasSession) break;
      count++;
    }
    return count;
  }, [completedSessions]);

  /**
   * Everything the app has to say, gathered once.
   *
   * This replaces five separate advisory cards that each rendered themselves
   * into the scroll — a deload banner, a streak warning, a calibration bar, a
   * bodyweight reminder and a training-balance nudge. Any two of them at once
   * pushed the session card off the screen. The rules moved to lib/coach.ts so
   * they can be read and tested in one place instead of being spread across
   * five conditions in a JSX tree.
   */
  /**
   * Built once and read by both the messages and the snapshot strip above
   * them, so the two can never disagree about the same week.
   */
  const coachInput = useMemo(() => {
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
      // What the training itself has been doing. All of it already stored; see
      // lib/coach-insights.ts for what gets read out of it.
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
    balanceNudgeDismissedAt,
  ]);

  const coachMessages = useMemo(() => getCoachMessages(coachInput), [coachInput]);
  const coachSnapshot = useMemo(() => getCoachSnapshot(coachInput), [coachInput]);

  /**
   * The button answers "has anything changed since you last looked".
   *
   * Not "is any of this a problem" - that is hasActionableAdvice, and it is the
   * right question for a red alert dot and the wrong one for this. The marker
   * here is a different GLYPH rather than a warning dot, so it reads as an
   * invitation rather than an alarm, and a personal best set an hour ago is
   * exactly the kind of thing worth being invited to look at.
   *
   * What it must not do is light for something already read. A user who has
   * seen the knee message four times does not need a fifth badge for it, which
   * is why the signature carries the title and not just the id.
   */
  const coachHasNews = useMemo(
    () => coachMessages.some((m) => coachSeen[messageSignature(m)] === undefined),
    [coachMessages, coachSeen]
  );

  /**
   * The seen map AS IT WAS when the panel was opened.
   *
   * Opening marks everything seen, so rendering against the live map meant the
   * NEW markers were cleared in the same tick they would have been drawn in and
   * nobody ever saw one. Freezing it at open time means the markers survive the
   * visit they belong to and are gone by the next.
   */
  const seenAtOpen = useRef<Record<string, number>>({});

  const handleCoachAction = useCallback(
    (action: CoachAction) => {
      setCoachOpen(false);
      if (action.kind === 'log-weight') {
        handleOpenWeightModal();
        return;
      }
      if (action.kind === 'open-stats') {
        router.push('/(tabs)/workouts');
        return;
      }
      // A coach message can name a specific session (the balance nudge does);
      // otherwise it means "the one you were going to do anyway".
      router.push({
        pathname: '/readiness',
        params: {
          sessionType: action.sessionType ?? suggestedSession,
          isTestWeek: action.sessionType ? 'false' : testWeek ? 'true' : 'false',
        },
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [suggestedSession, testWeek]
  );

  const suggestedMeta = SESSION_META[suggestedSession];

  const strengthCount = useMemo(
    () => completedSessions.filter((s) => STRENGTH_SESSION_TYPES.includes(s.sessionType)).length,
    [completedSessions]
  );

  // With test weeks off there is nothing to count down to, so the whole block
  // bar is hidden rather than left ticking toward an event that will never
  // arrive. cycleLength keeps the arithmetic below numeric either way.
  const testsOn = testWeekFrequency !== 'never';
  const cycleLength = testWeekFrequency === 'never' ? 12 : testWeekFrequency;
  const sessionsInBlock =
    !testWeek && strengthCount > 0 ? strengthCount % cycleLength || cycleLength : 0;
  const sessionsUntilTest = cycleLength - sessionsInBlock;
  const showBlockProgress = testsOn && strengthCount >= 1 && !testWeek;
  /**
   * Sessions still owed before a withheld test is offered.
   *
   * The block is finished — that is why the test came due — but nobody walks
   * out of a layoff into a max-effort attempt, so it waits until the baseline
   * is back (see getTestWeekProgress in lib/store.ts). Left to the arithmetic
   * above, the row counted a block that had already ended: "Test week in 0
   * sessions" while no test was on offer, then "Block 1 / 12" as though a
   * fresh block had started. Both read as a stuck counter.
   */
  const sessionsUntilTestResumes = testHeld
    ? Math.max(0, COMEBACK_SESSIONS - (getReturnWindow()?.sessionsBack ?? 0))
    : 0;
  // How many full test-week blocks they've already been through, counted from
  // actual completed test weeks (not derived from strengthCount / frequency)
  // so it stays correct even if testWeekFrequency is changed mid-program or a
  // test was deferred. The block they're currently working through is always
  // one past however many they've finished.
  const testWeeksCompleted = useMemo(
    () => completedSessions.filter((s) => s.isTestWeek).length,
    [completedSessions]
  );
  const blockCycleNumber = testWeeksCompleted + 1;

  const progCycleNumber = Math.floor(strengthCount / 3) + 1;

  // ─── Bodyweight reminder logic ──────────────────────────────────────────
  const [weightModalOpen, setWeightModalOpen] = useState(false);
  const [draftWeight, setDraftWeight] = useState('');

  useEffect(() => {
    if (bodyweightReminderEnabled) {
      void scheduleBodyweightReminder(bodyweightUpdatedAt, completedSessions.length > 0);
    } else {
      void cancelBodyweightReminder();
    }
  }, [bodyweightUpdatedAt, completedSessions.length, bodyweightReminderEnabled]);

  const handleOpenWeightModal = () => {
    const displayVal =
      userProfile.bodyweightKg > 0
        ? String(kgToDisplayUnit(userProfile.bodyweightKg, weightUnit))
        : '';
    setDraftWeight(displayVal);
    setWeightModalOpen(true);
  };

  const handleSaveWeight = () => {
    const parsed = parseFloat(draftWeight);
    if (!isNaN(parsed) && parsed > 0) {
      setUserProfile({ bodyweightKg: displayUnitToKg(parsed, weightUnit) });
      setWeightReminderSnoozedAt(null); // reset snooze — successful update clears it
    }
    setWeightModalOpen(false);
  };

  /** Closing the weight prompt without saving means "not now" — the reminder
   *  backs off rather than reappearing the moment the assistant is opened. */
  const dismissWeightModal = () => {
    setWeightReminderSnoozedAt(new Date().toISOString());
    setWeightModalOpen(false);
  };
  // ────────────────────────────────────────────────────────────────────────

  // ── Post-tour session card pulse ─────────────────────────────────────────
  const pulseBorder = useSharedValue(0);

  useEffect(() => {
    if (tourJustCompleted) {
      pulseBorder.value = withSequence(
        withTiming(1, { duration: 200 }),
        withRepeat(
          withSequence(withTiming(0.2, { duration: 350 }), withTiming(1.0, { duration: 350 })),
          2,
          false
        ),
        withTiming(0, { duration: 300 })
      );
      const timer = setTimeout(() => {
        setTourJustCompleted(false);
      }, 2200);
      return () => clearTimeout(timer);
    }
  }, [tourJustCompleted]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (milestoneHit === null) return;
    setMilestoneToastDismissed(false);
    const timer = setTimeout(() => setMilestoneToastDismissed(true), 3500);
    return () => clearTimeout(timer);
  }, [milestoneHit]); // eslint-disable-line react-hooks/exhaustive-deps

  const cardGlowStyle = useAnimatedStyle(() => ({
    borderRadius: 20,
    shadowColor: C.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: pulseBorder.value * 0.75,
    shadowRadius: pulseBorder.value * 20,
    elevation: pulseBorder.value * 10,
  }));
  // ─────────────────────────────────────────────────────────────────────────

  const webTopInset = Platform.OS === 'web' ? 67 : 0;
  const styles = useMemo(() => makeStyles(C), [C]);

  const confirmReplaceActive = (onContinue: () => void) => {
    Alert.alert(
      'A session is already in progress',
      'Resume your current session, or discard it and start the new one?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Resume current', onPress: handleResume },
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

  const handleStartSuggested = () => {
    const go = () => {
      if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      // A custom session is built, not generated — generateWorkout returns []
      // for it. Someone whose only sessions are their own gets suggested their
      // own, and that suggestion has to lead to the builder. Sending it through
      // readiness would end in an empty workout, which is why the suggestion
      // used to be a generated full-body session they had never chosen.
      if (suggestedSession === 'custom') {
        router.push('/custom-session');
        return;
      }
      const equipmentOverrideParam = sessionEquipmentOverride
        ? JSON.stringify(sessionEquipmentOverride)
        : undefined;
      router.push({
        pathname: '/readiness',
        params: {
          sessionType: suggestedSession,
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

  const handleFirstSessionChoice = (type: 'squat' | 'bench' | 'deadlift') => {
    const go = () => {
      if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const offsets: Record<string, number> = { squat: 0, bench: 1, deadlift: 2 };
      setCycleStartOffset(offsets[type]);
      router.push({
        pathname: '/readiness',
        params: { sessionType: type, isTestWeek: 'false' },
      });
    };
    if (activeSession) {
      confirmReplaceActive(go);
      return;
    }
    go();
  };

  const handleResume = () => {
    if (!activeSession) return;
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push({
      pathname: '/session',
      params: resumeParams(activeSession),
    });
  };

  const handleDiscardActiveSession = () => {
    Alert.alert('Discard session?', 'Your in-progress session will be lost.', [
      { text: 'Keep it', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: () => clearActiveSession() },
    ]);
  };

  const lastSessionDurationLabel =
    lastSession?.durationSeconds && lastSession.durationSeconds > 0
      ? (() => {
          const mins = Math.round(lastSession.durationSeconds / 60);
          if (mins < 60) return `${mins}m`;
          const h = Math.floor(mins / 60);
          const m = mins % 60;
          return m > 0 ? `${h}h ${m}m` : `${h}h`;
        })()
      : null;

  const scrollRef = useRef<ScrollView>(null);
  useScrollToTopRegister(
    'index',
    useCallback(() => {
      scrollRef.current?.scrollTo({ x: 0, y: 0, animated: true });
    }, [])
  );

  // ── Guided tour: Home's own in-page tutorial ─────────────────────────────
  // Runs when the shared tour reaches this tab (index 0). Hands off to
  // Profile on its last step; skip abandons the whole tour, not just Home.
  // The block-progress row only renders once showBlockProgress is true (a
  // brand-new user with zero sessions doesn't have one yet) - skip that step
  // entirely rather than spotlighting nothing.
  // Nothing to filter any more: the step that needed a training block to exist
  // was cut, along with the other four that described a screen a first-run user
  // has not filled in yet. Kept as a memo so the shape below is unchanged.
  const homeEffectiveTutorial = useMemo(() => HOME_TUTORIAL, []);
  const [tutStep, setTutStep] = useState<number | null>(null);
  const sessionCardRef = useRef<View>(null);
  const streakTileRef = useRef<View>(null);
  const coachButtonRef = useRef<View>(null);
  const [tutSpotlight, setTutSpotlight] = useState<SpotlightRect | null>(null);

  useEffect(() => {
    if (tourActiveTab === 0) {
      const t = setTimeout(() => setTutStep(0), 300);
      return () => clearTimeout(t);
    }
    setTutStep(null);
  }, [tourActiveTab]);

  useEffect(() => {
    setTutSpotlight(null);
    if (tutStep === null || homeEffectiveTutorial[tutStep] == null) return;
    const refLookup = {
      session: sessionCardRef,
      coach: coachButtonRef,
      streak: streakTileRef,
    };
    const target = refLookup[homeEffectiveTutorial[tutStep].spotlightRef];
    scrollRef.current?.scrollTo({ y: 0, animated: true });
    const timer = setTimeout(() => {
      target?.current?.measureInWindow((x, y, w, h) => {
        if (w > 0 && h > 0) {
          setTutSpotlight({ top: y - 6, left: x - 6, width: w + 12, height: h + 12 });
        }
      });
    }, 420);
    return () => clearTimeout(timer);
  }, [tutStep, homeEffectiveTutorial]);

  const advanceHomeTut = useCallback(() => {
    setTutStep((prev) => {
      if (prev === null) return null;
      const next = prev + 1;
      if (next >= homeEffectiveTutorial.length) {
        setTourActiveTab(2); // hand off to Train
        return null;
      }
      return next;
    });
  }, [setTourActiveTab, homeEffectiveTutorial]);

  const skipHomeTut = useCallback(() => {
    setTutStep(null);
    skipTour();
  }, [skipTour]);

  return (
    <>
      <View
        style={[
          styles.container,
          {
            paddingTop: insets.top + webTopInset,
          },
        ]}
      >
        <ScrollView
          ref={scrollRef}
          style={{ flex: 1 }}
          contentContainerStyle={[
            styles.inner,
            { paddingBottom: Platform.OS === 'web' ? 84 + 24 : tabBarHeight + 24 },
          ]}
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <Animated.View entering={FadeInDown.duration(350)} style={styles.header}>
            {/* Greeting and name are stacked rather than run together on one
                line: at 24px "Good evening Archie" has to share the row with the
                test-week pill, the coach button and the avatar, and the name is
                what loses. adjustsFontSizeToFit is a native-only prop, so on web
                it did not shrink — it simply cut the name off. */}
            <View style={{ flex: 1 }}>
              {firstName ? (
                <>
                  <Text style={styles.greetingEyebrow}>{greeting}</Text>
                  <Text style={styles.greetingText} numberOfLines={1}>
                    {firstName}
                  </Text>
                </>
              ) : (
                <Text style={styles.greetingText} numberOfLines={1}>
                  {greeting}
                </Text>
              )}
            </View>
            {testWeek && (
              <View style={styles.testWeekPill}>
                <Ionicons name="trophy" size={13} color={C.categoryPrehabText} />
                <Text style={styles.testWeekPillText}>
                  Test Week · {testWeekProgress.completed + 1} of {testWeekProgress.total}
                </Text>
              </View>
            )}
            <View ref={coachButtonRef} collapsable={false}>
              <CoachButton
                onPress={() => {
                  if (!coachOpen) {
                    // Freeze what was already seen BEFORE marking, or the NEW
                    // markers clear in the same tick they would be drawn in.
                    seenAtOpen.current = coachSeen;
                    markCoachSeen(coachMessages.map(messageSignature), Date.now());
                  }
                  setCoachOpen((v) => !v);
                }}
                hasNews={coachHasNews}
                open={coachOpen}
              />
            </View>
            <Pressable
              onPress={() => router.push('/(tabs)/profile')}
              style={({ pressed }) => [styles.headerAvatar, pressed && { opacity: 0.8 }]}
              testID="home-profile-avatar"
              accessibilityLabel="Open profile"
              accessibilityRole="button"
            >
              {profilePhotoUri ? (
                <Image source={{ uri: profilePhotoUri }} style={styles.headerAvatarImg} />
              ) : firstName ? (
                <Text style={styles.headerAvatarInitial}>{firstName[0].toUpperCase()}</Text>
              ) : (
                <Ionicons name="person" size={18} color={C.primaryText} />
              )}
            </Pressable>
          </Animated.View>

          {/* Hero card - always the unified Today block (or first-session chooser for brand-new users) */}
          {/* Glow wrapper: pulses green after the tab tour completes */}
          <View ref={sessionCardRef} collapsable={false}>
          <Animated.View style={cardGlowStyle}>
            {completedSessions.length === 0 ? (
              <Animated.View entering={FadeInDown.delay(60).duration(380)} style={styles.todayCard}>
                <Text style={styles.todayLabel}>Choose Your First Session</Text>
                <Text style={[styles.todaySessionSub, { marginBottom: 16 }]}>
                  Pick where to start - your program rotates automatically from here.
                </Text>
                {/* One accent for all three, on purpose. Squat, bench and
                    deadlift are the same kind of thing — a KPI barbell session
                    — and they are already told apart by their name, their
                    subtitle and their illustration. Giving them a green, a blue
                    and a purple said "three different kinds of thing", which is
                    not true, and it was the first screen a new user saw. */}
                {(
                  [
                    {
                      type: 'squat' as const,
                      label: SESSION_META.squat.label,
                      sub: 'Quads · Glutes · Hamstrings',
                    },
                    {
                      type: 'bench' as const,
                      label: SESSION_META.bench.label,
                      sub: 'Chest · Shoulders · Triceps',
                    },
                    {
                      type: 'deadlift' as const,
                      label: SESSION_META.deadlift.label,
                      sub: 'Back · Hips · Legs',
                    },
                  ] as const
                ).map(({ type, label, sub }) => (
                  <Pressable
                    key={type}
                    onPress={() => handleFirstSessionChoice(type)}
                    style={({ pressed }) => [
                      styles.firstChoiceRow,
                      pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] },
                    ]}
                    testID={`first-session-${type}`}
                  >
                    <View style={styles.firstChoiceIcon}>
                      <Image
                        source={getSessionImage(type, userProfile?.sex)}
                        style={styles.firstChoiceImage}
                        resizeMode="contain"
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.firstChoiceLabel}>{label}</Text>
                      <Text style={styles.firstChoiceSub}>{sub}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={C.textTertiary} />
                  </Pressable>
                ))}
                {/* THE SAME PROMISE THE TRAIN TAB MAKES, ON THE SCREEN THAT
                    SHOWS IT FIRST.

                    These three are named after the barbell lifts and drawn
                    with a barbell, and for someone who chose No Equipment that
                    is the very first thing the app shows them - three pictures
                    of kit they just said they do not have. The sessions do
                    adapt, and Train says so in as many words; this is the
                    screen a brand-new user actually lands on, and it said
                    nothing at all. */}
                {!hasFullGym && (
                  <Pressable
                    onPress={() => router.push('/(tabs)/profile')}
                    style={({ pressed }) => [styles.kitCallout, pressed && { opacity: 0.7 }]}
                    testID="home-first-session-kit-note"
                    accessibilityRole="button"
                  >
                    <Ionicons
                      name="information-circle-outline"
                      size={14}
                      color={C.primaryText}
                    />
                    <Text style={styles.kitCalloutText}>
                      Named after the barbell lifts - every session adapts to the equipment you
                      have.
                    </Text>
                    <Ionicons name="chevron-forward" size={12} color={C.primaryText} />
                  </Pressable>
                )}
              </Animated.View>
            ) : (
              <Animated.View entering={FadeInDown.delay(60).duration(380)} style={styles.todayCard}>
                {/* The brand accent, not the session's own colour. This wash
                    changed hue with whatever session came up next — green one
                    day, blue the next — which made the same card look like a
                    different card for no reason a user could name. */}
                <LinearGradient
                  colors={[C.primaryText + '18', 'transparent']}
                  style={[StyleSheet.absoluteFill, { borderRadius: 20, pointerEvents: 'none' }]}
                  start={{ x: 0.5, y: 0 }}
                  end={{ x: 0.5, y: 0.65 }}
                />
                <View style={styles.todayCardTop}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.todayLabel}>Today</Text>
                    <Text style={styles.todaySessionName}>{suggestedMeta.label}</Text>
                    <Text style={styles.todaySessionSub}>{suggestedMeta.subtitle}</Text>
                  </View>
                  <View style={styles.todayIcon}>
                    <Image
                      source={getSessionImage(suggestedSession, userProfile?.sex)}
                      style={styles.todayIconImage}
                      resizeMode="contain"
                    />
                  </View>
                </View>
                {lastSession && lastSessionRelativeLabel && (
                  <Text style={styles.lastInline}>
                    You last did {SESSION_META[lastSession.sessionType].label.toLowerCase()}{' '}
                    {lastSessionRelativeLabel}
                    {lastSessionDurationLabel ? ` · ${lastSessionDurationLabel}` : ''}
                  </Text>
                )}
                <Pressable
                  onPress={openEquipmentSheet}
                  style={({ pressed }) => [
                    styles.equipmentChip,
                    sessionEquipmentOverride !== null && styles.equipmentChipOverride,
                    pressed && { opacity: 0.8 },
                  ]}
                  testID="home-equipment-chip"
                >
                  <EquipmentIcon
                    tier={todayEffectiveTier}
                    size={13}
                    color={sessionEquipmentOverride !== null ? C.primaryText : C.textSecondary}
                  />
                  <Text
                    style={[
                      styles.equipmentChipText,
                      sessionEquipmentOverride !== null && styles.equipmentChipTextOverride,
                    ]}
                  >
                    {sessionEquipmentOverride !== null ? 'Today: ' : ''}
                    {getEquipmentLabel(todayEffectiveTier)}
                  </Text>
                  {sessionEquipmentOverride !== null && <View style={styles.overrideDot} />}
                  <Ionicons
                    name="chevron-down"
                    size={12}
                    color={sessionEquipmentOverride !== null ? C.primaryText : C.textTertiary}
                  />
                </Pressable>
                <Pressable
                  onPress={handleStartSuggested}
                  style={({ pressed }) => [
                    styles.startBtn,
                    pressed && { opacity: 0.88, transform: [{ scale: 0.98 }] },
                  ]}
                  testID="start-suggested-session"
                >
                  <Ionicons name="flash" size={18} color={C.primaryDarkText} />
                  <Text style={styles.startBtnText}>
                    {testWeek
                      ? `Test ${SESSION_SHORT_LABELS[suggestedSession] ?? 'Strength'} 1RM`
                      : 'Start Session'}
                  </Text>
                </Pressable>
              </Animated.View>
            )}
          </Animated.View>
          </View>

          {/* Block progress — standalone slim row between hero card and stats strip */}
          {completedSessions.length > 0 && showBlockProgress && (
            <View collapsable={false}>
              <Animated.View entering={FadeInDown.delay(75).duration(380)} style={styles.blockRow}>
                <Ionicons name="stats-chart" size={12} color={C.textTertiary} />
                <View style={styles.blockBarTrack}>
                  <View
                    style={[
                      styles.blockBarFill,
                      {
                        width: (testHeld
                          ? '100%'
                          : `${Math.round((sessionsInBlock / cycleLength) * 100)}%`) as any,
                      },
                    ]}
                  />
                </View>
                <Text
                  style={[
                    styles.blockProgressLabel,
                    !testHeld && sessionsUntilTest <= 2 && { color: C.warning },
                  ]}
                  numberOfLines={1}
                >
                  {testHeld
                    ? `Strength test on hold · ${sessionsUntilTestResumes} session${sessionsUntilTestResumes !== 1 ? 's' : ''} to go`
                    : sessionsUntilTest <= 2
                      ? `Test week in ${sessionsUntilTest} session${sessionsUntilTest !== 1 ? 's' : ''}`
                      : `Cycle ${blockCycleNumber} · Block ${sessionsInBlock} / ${cycleLength}`}
                </Text>
              </Animated.View>
            </View>
          )}

          {/* Summary cards — 2×2 grid */}
          <Animated.View entering={FadeInDown.delay(120).duration(380)} style={styles.summaryGrid}>
            {/* Week Streak */}
            <View ref={streakTileRef} collapsable={false} style={styles.summaryCard}>
              <Image
                source={HOME_ICONS.weekStreak}
                style={styles.summaryCardImage}
                resizeMode="contain"
              />
              <Text style={styles.summaryBigNum}>{streak}</Text>
              <Text style={styles.summaryCardTitle}>WEEK STREAK</Text>
              <Text style={styles.summaryCardSub}>
                {/*
                  A week only joins the streak once it has hit the goal, so this
                  reads 0 for the whole of somebody's first week. It used to say
                  "Get started" underneath that 0 — to a person who had just
                  finished a session and come back to the home screen. When the
                  current week is under way, say how far into it they are
                  instead; the streak number itself is honest and stays.
                */}
                {streak > 0
                  ? 'Keep it going'
                  : weekCount > 0
                    ? `${weekCount} of ${goal} this week`
                    : 'Get started'}
              </Text>
            </View>

            {/* Your Program */}
            <Pressable
              style={styles.summaryCard}
              onPress={() => {
                if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push('/program');
              }}
              testID="your-program-card"
            >
              <Image
                source={HOME_ICONS.yourProgram}
                style={styles.summaryCardImage}
                resizeMode="contain"
              />
              <Text style={styles.summaryCycleLabel}>CYCLE</Text>
              <Text style={styles.summaryBigNum}>{progCycleNumber}</Text>
              <Text style={styles.summaryCardTitle}>YOUR PROGRAM</Text>
              <Text style={styles.summaryCardSub}>
                {strengthCount === 0 ? 'Get started' : `Session ${(strengthCount % 3) + 1} of 3`}
              </Text>
            </Pressable>

            {/* Total */}
            <Pressable
              style={styles.summaryCard}
              onPress={() => {
                if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push('/past-sessions');
              }}
              testID="total-sessions-tap"
            >
              <Image
                source={HOME_ICONS.totalWorkouts}
                style={styles.summaryCardImage}
                resizeMode="contain"
              />
              <Text style={styles.summaryBigNum}>{completedSessions.length}</Text>
              <Text style={styles.summaryCardTitle}>TOTAL</Text>
              <Text style={styles.summaryCardSub}>Workouts</Text>
            </Pressable>

            {/* Achievements */}
            <Pressable
              style={styles.summaryCard}
              onPress={() => {
                if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push('/achievements');
              }}
              testID="summary-achievements"
            >
              <Image
                source={HOME_ICONS.achievements}
                style={styles.summaryCardImage}
                resizeMode="contain"
              />
              <Text style={styles.summaryBigNum}>{earnedBadges.length}</Text>
              <Text style={styles.summaryCardTitle}>ACHIEVEMENTS</Text>
              <Text style={styles.summaryCardSub}>Unlocked</Text>
            </Pressable>
          </Animated.View>

          {/* Secondary actionable card - priority: resume > milestone > broken streak (mutually exclusive) */}
          {activeSession ? (
            <Animated.View
              entering={FadeInDown.delay(180).duration(380)}
              style={styles.resumeSecondary}
            >
              <View style={styles.resumeIcon}>
                <Ionicons name="time-outline" size={20} color={C.warning} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.resumeTitle}>Session in progress</Text>
                <Text style={styles.resumeSub}>
                  {activeSession.displayLabel ??
                    SESSION_META[activeSession.sessionType]?.label ??
                    activeSession.sessionName}{' '}
                  · {activeSession.completedSetsCount}/{activeSession.totalSets} sets
                </Text>
              </View>
              <Pressable
                onPress={handleResume}
                style={({ pressed }) => [
                  styles.resumeBtnSm,
                  pressed && { opacity: 0.85, transform: [{ scale: 0.97 }] },
                ]}
                testID="resume-session"
              >
                <Ionicons name="play" size={14} color={C.textInverse} />
                <Text style={styles.resumeBtnSmText}>Resume</Text>
              </Pressable>
              <Pressable
                onPress={handleDiscardActiveSession}
                hitSlop={10}
                style={styles.resumeDiscardBtn}
                testID="discard-active-session"
                accessibilityLabel="Discard session"
                accessibilityRole="button"
              >
                <Ionicons name="close" size={16} color={C.textTertiary} />
              </Pressable>
            </Animated.View>
          ) : calibrationComplete ? (
            <Animated.View
              entering={FadeInDown.delay(180).duration(380)}
              style={styles.calibrationCompleteCard}
            >
              <View style={styles.calibrationCompleteIcon}>
                <Ionicons name="checkmark-circle" size={20} color={C.primaryText} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.calibrationCompleteTitle}>{"You're all set"}</Text>
                <Text style={styles.calibrationCompleteSub}>
                  Sessions are now fully personalised to you.
                </Text>
              </View>
              <Pressable
                onPress={() => setCalibrationBannerDismissed(true)}
                hitSlop={10}
                style={styles.resumeDiscardBtn}
                testID="calibration-banner-dismiss"
                accessibilityLabel="Dismiss"
                accessibilityRole="button"
              >
                <Ionicons name="close" size={16} color={C.textTertiary} />
              </Pressable>
            </Animated.View>
          ) : missedStreakWarning ? (
            <Animated.View
              entering={FadeInDown.delay(180).duration(380)}
              style={styles.warningCard}
            >
              <View style={styles.warningIcon}>
                <Ionicons name="alarm-outline" size={20} color={C.warning} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.warningTitle}>Streak at risk this week</Text>
                <Text style={styles.warningSub}>
                  {weekCount === 0
                    ? `No sessions yet this week - hit ${goal} to keep your streak going.`
                    : `${weekCount}/${goal} sessions this week - ${goal - weekCount} more to keep your streak alive.`}
                </Text>
              </View>
            </Animated.View>
          ) : null}

        </ScrollView>

        {/* The assistant's bubble. Rendered OUTSIDE the ScrollView so it floats
            over the page rather than adding to its height — the whole point of
            this change was that advice must not make the home screen scroll.
            Not a Modal; see the note in CoachBubble. */}
        {coachOpen && (
          <CoachBubble
            messages={coachMessages}
            snapshot={coachSnapshot}
            seen={seenAtOpen.current}
            onClose={() => setCoachOpen(false)}
            onAction={handleCoachAction}
            onDismiss={(id) => {
              // Balance keeps its own field because it is persisted on every
              // existing device; everything else goes in the generic record.
              if (id === 'balance') dismissBalanceNudge(Date.now());
              else dismissCoachMessage(id, Date.now());
            }}
            top={insets.top + (Platform.OS === 'web' ? 67 : 0) + 62}
            tailRight={38}
          />
        )}
      </View>

      {/* Milestone toast — floats above tab bar, auto-dismisses after 3.5 s */}
      {milestoneHit !== null && !milestoneToastDismissed && (
        <Animated.View
          entering={FadeInUp.springify().damping(18).stiffness(160)}
          exiting={FadeOutDown.duration(280)}
          style={[styles.milestoneToast, { bottom: tabBarHeight + 12 }]}
        >
          <View style={styles.milestoneToastIcon}>
            <Ionicons name="trophy" size={20} color={C.warning} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.milestoneToastTitle}>{milestoneHit} sessions completed</Text>
            <Text style={styles.milestoneToastSub}>That&apos;s a real milestone. Nice work.</Text>
          </View>
          <Pressable
            onPress={() => setMilestoneToastDismissed(true)}
            hitSlop={12}
            accessibilityLabel="Dismiss"
            accessibilityRole="button"
          >
            <Ionicons name="close" size={16} color={C.textTertiary} />
          </Pressable>
        </Animated.View>
      )}

      {/* Bodyweight update modal */}
      <Modal
        visible={weightModalOpen}
        transparent
        animationType="slide"
        onRequestClose={dismissWeightModal}
      >
        <Pressable style={modalStyles.backdrop} onPress={dismissWeightModal} />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View
            style={[
              modalStyles.sheet,
              { paddingBottom: insets.bottom + 20, backgroundColor: C.surface },
            ]}
          >
            <View style={modalStyles.handle} />
            <Text style={[modalStyles.sheetTitle, { color: C.text }]}>Update Bodyweight</Text>
            <Text
              style={[
                modalStyles.sheetSubtitle,
                { color: C.textSecondary, marginBottom: 20, marginTop: 4 },
              ]}
            >
              Accurate bodyweight improves suggested loads for every session.
            </Text>
            <View style={styles.weightInputRow}>
              <TextInput
                style={[
                  styles.weightInput,
                  { borderColor: C.border, color: C.text, backgroundColor: C.surfaceSecondary },
                ]}
                value={draftWeight}
                onChangeText={setDraftWeight}
                keyboardType="decimal-pad"
                placeholder={weightUnit === 'kg' ? 'e.g. 80' : 'e.g. 176'}
                placeholderTextColor={C.textTertiary}
                selectTextOnFocus
                autoFocus
              />
              <Text style={[styles.weightInputUnit, { color: C.textSecondary }]}>{weightUnit}</Text>
            </View>
            <Pressable
              onPress={handleSaveWeight}
              style={({ pressed }) => [
                modalStyles.confirmBtn,
                { backgroundColor: C.primary },
                pressed && { opacity: 0.88 },
              ]}
              testID="weight-save-btn"
            >
              <Text style={[modalStyles.confirmBtnText, { color: C.textInverse }]}>Save</Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Equipment picker sheet — shared with Train tab via store */}
      <Modal
        visible={sheetOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setSheetOpen(false)}
      >
        <Pressable style={modalStyles.backdrop} onPress={() => setSheetOpen(false)} />
        <View
          style={[
            modalStyles.sheet,
            { paddingBottom: insets.bottom + 16, backgroundColor: C.surface },
          ]}
        >
          <View style={modalStyles.handle} />
          <View style={modalStyles.sheetHeader}>
            <View>
              <Text style={[modalStyles.sheetTitle, { color: C.text }]}>Equipment today</Text>
              <Text style={[modalStyles.sheetSubtitle, { color: C.textSecondary }]}>
                This only affects the current session
              </Text>
            </View>
            {sessionEquipmentOverride !== null && (
              <Pressable
                onPress={resetEquipmentToProfile}
                style={[
                  modalStyles.resetBtn,
                  { backgroundColor: C.primaryMuted, borderColor: C.primary + '40' },
                ]}
              >
                <Text style={[modalStyles.resetBtnText, { color: C.primaryText }]}>Reset</Text>
              </Pressable>
            )}
          </View>
          {sheetDraft.length > 0 && (
            <View
              style={[
                modalStyles.bestMatchRow,
                { backgroundColor: C.primaryMuted, borderColor: C.primary + '22' },
              ]}
            >
              <Text style={[modalStyles.bestMatchText, { color: C.textSecondary }]}>
                Best match:{' '}
                <Text style={{ fontFamily: 'Inter_600SemiBold', color: C.primaryText }}>
                  {getEquipmentLabel(getEffectiveTier(sheetDraft))}
                </Text>
              </Text>
            </View>
          )}
          <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 360 }}>
            {(['bodyweight', 'bands', 'dumbbells', 'kettlebells', 'fullgym'] as const).map(
              (tier) => {
                const locked = !(availableTiers as readonly string[]).includes(tier);
                const selected = sheetDraft.includes(tier);
                return (
                  <Pressable
                    key={tier}
                    onPress={() => handleDraftToggle(tier)}
                    disabled={locked}
                    style={({ pressed }) => [
                      modalStyles.tierRow,
                      { borderBottomColor: C.borderLight },
                      selected && { backgroundColor: C.primaryMuted },
                      locked && { opacity: 0.4 },
                      pressed && !locked && { opacity: 0.7 },
                    ]}
                  >
                    <EquipmentIcon
                      tier={tier}
                      size={20}
                      color={selected ? C.primaryText : C.textSecondary}
                    />
                    <View style={{ flex: 1 }}>
                      <Text
                        style={[modalStyles.tierLabel, { color: selected ? C.primaryText : C.text }]}
                      >
                        {getEquipmentLabel(tier)}
                      </Text>
                    </View>
                    {selected && <Ionicons name="checkmark-circle" size={20} color={C.primaryText} />}
                    {locked && (
                      <Ionicons name="lock-closed-outline" size={16} color={C.textTertiary} />
                    )}
                  </Pressable>
                );
              }
            )}
          </ScrollView>
          <Pressable
            onPress={confirmEquipment}
            style={({ pressed }) => [
              modalStyles.confirmBtn,
              { backgroundColor: C.primary },
              pressed && { opacity: 0.88 },
            ]}
          >
            <Text style={[modalStyles.confirmBtnText, { color: C.textInverse }]}>Confirm</Text>
          </Pressable>
        </View>
      </Modal>

      {tutStep !== null && homeEffectiveTutorial[tutStep] != null && (
        <CoachMark
          visible
          title={homeEffectiveTutorial[tutStep].title}
          body={homeEffectiveTutorial[tutStep].body}
          step={tutStep + 1}
          total={homeEffectiveTutorial.length}
          onNext={advanceHomeTut}
          onSkip={skipHomeTut}
          bottomOffset={(Platform.OS === 'web' ? 84 : tabBarHeight) + 16}
          iconName={homeEffectiveTutorial[tutStep].iconName}
          iconLabel={homeEffectiveTutorial[tutStep].iconLabel}
          spotlightRect={tutSpotlight ?? undefined}
        />
      )}
    </>
  );
}

const modalStyles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 12,
    paddingHorizontal: 20,
  },
  handle: {
    width: 36,
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sheetTitle: { fontSize: 18, fontFamily: 'Inter_700Bold', marginBottom: 2 },
  sheetSubtitle: { fontSize: 13, fontFamily: 'Inter_400Regular' },
  resetBtn: { borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1 },
  resetBtnText: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  bestMatchRow: {
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    marginBottom: 12,
  },
  bestMatchText: { fontSize: 13, fontFamily: 'Inter_400Regular' },
  tierRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  tierLabel: { fontSize: 15, fontFamily: 'Inter_500Medium' },
  confirmBtn: { borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginTop: 16 },
  confirmBtnText: { fontSize: 16, fontFamily: 'Inter_700Bold' },
});

function makeStyles(C: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: C.background },
    inner: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 24, gap: 16 },

    header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    greetingEyebrow: { fontSize: 13, fontFamily: 'Inter_500Medium', color: C.textSecondary },
    greetingText: { fontSize: 24, fontFamily: 'Inter_700Bold', color: C.text },
    headerAvatar: {
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor: C.primaryMuted,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    headerAvatarImg: { width: 38, height: 38, borderRadius: 19 },
    headerAvatarInitial: { fontSize: 15, fontFamily: 'Inter_700Bold', color: C.primaryText },
    testWeekPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      backgroundColor: C.warningLight,
      borderRadius: 20,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderWidth: 1,
      borderColor: C.warning,
    },
    testWeekPillText: { fontSize: 11, fontFamily: 'Inter_600SemiBold', color: C.warning },

    todayCard: {
      backgroundColor: C.surface,
      borderRadius: 20,
      padding: 20,
      borderWidth: 1,
      borderColor: C.border,
      ...shadowStyle(C.shadow, 0.18, 14, 6, 5),
    },
    todayCardTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 18 },
    todayLabel: {
      fontSize: 11,
      fontFamily: 'Inter_600SemiBold',
      color: C.primaryText,
      textTransform: 'uppercase',
      letterSpacing: 0.8,
      marginBottom: 6,
    },
    todaySessionName: { fontSize: 28, fontFamily: 'Inter_700Bold', color: C.text, marginBottom: 4 },
    todaySessionSub: { fontSize: 13, fontFamily: 'Inter_400Regular', color: C.textSecondary },
    todayIcon: {
      width: 112,
      height: 112,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      marginLeft: 14,
      flexShrink: 0,
    },
    startBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: C.primaryDark,
      borderRadius: 14,
      paddingVertical: 15,
    },
    startBtnText: { fontSize: 16, fontFamily: 'Inter_700Bold', color: C.primaryDarkText },

    equipmentChip: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      gap: 6,
      alignSelf: 'flex-start' as const,
      backgroundColor: C.surfaceSecondary,
      borderRadius: 20,
      paddingHorizontal: 12,
      paddingVertical: 6,
      marginBottom: 10,
      borderWidth: 1,
      borderColor: C.border,
    },
    equipmentChipOverride: {
      backgroundColor: C.primaryMuted,
      borderColor: C.primary + '40',
    },
    equipmentChipText: { fontSize: 12, fontFamily: 'Inter_500Medium', color: C.textSecondary },
    equipmentChipTextOverride: { color: C.primaryText, fontFamily: 'Inter_600SemiBold' },
    overrideDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: C.primary },

    blockRow: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 8 },
    blockProgressRow: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 8 },
    blockBarTrack: {
      flex: 1,
      height: 4,
      backgroundColor: C.borderLight,
      borderRadius: 2,
      overflow: 'hidden' as const,
    },
    blockBarFill: { height: 4, backgroundColor: C.primary, borderRadius: 2 },
    blockProgressLabel: { fontSize: 11, fontFamily: 'Inter_500Medium', color: C.textTertiary },
    summaryGrid: {
      flexDirection: 'row' as const,
      flexWrap: 'wrap' as const,
      gap: 12,
    },
    summaryCard: {
      width: '47%' as any,
      // The Your Program tile carries an extra line, so without a floor the two
      // tiles in a row are different heights and the 2x2 grid steps.
      minHeight: 148,
      justifyContent: 'center' as const,
      backgroundColor: C.surface,
      borderRadius: 18,
      padding: 12,
      alignItems: 'center' as const,
      borderWidth: 1,
      borderColor: C.borderLight,
      gap: 4,
    },
    summaryCardImage: {
      width: 52,
      height: 52,
      marginBottom: 2,
    },
    summaryIconBox: {
      width: 72,
      height: 72,
      borderRadius: 18,
      backgroundColor: C.surfaceSecondary,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
      marginBottom: 2,
      gap: 2,
    },
    summaryCardTitle: {
      fontSize: 11,
      fontFamily: 'Inter_700Bold',
      color: C.text,
      letterSpacing: 0.8,
      textAlign: 'center' as const,
    },
    summaryCardSub: {
      fontSize: 12,
      fontFamily: 'Inter_500Medium',
      color: C.textSecondary,
      textAlign: 'center' as const,
    },
    summaryBigNum: {
      fontSize: 22,
      fontFamily: 'Inter_700Bold',
      color: C.text,
      lineHeight: 26,
      textAlign: 'center' as const,
    },
    summaryCycleLabel: {
      fontSize: 8,
      fontFamily: 'Inter_700Bold',
      color: C.textSecondary,
      letterSpacing: 0.6,
      lineHeight: 9,
    },

    lastInline: {
      fontSize: 12,
      fontFamily: 'Inter_500Medium',
      color: C.textTertiary,
      marginTop: -8,
      marginBottom: 14,
    },

    milestoneCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: C.warningLight,
      borderRadius: 14,
      paddingHorizontal: 14,
      paddingVertical: 12,
      borderWidth: 1,
      borderColor: C.warning,
    },
    milestoneToast: {
      position: 'absolute',
      left: 16,
      right: 16,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: C.warningLight,
      borderRadius: 16,
      paddingHorizontal: 14,
      paddingVertical: 14,
      borderWidth: 1,
      borderColor: C.warning,
      ...shadowStyle('#000', 0.18, 14, 4, 8),
    },
    milestoneToastIcon: {
      width: 36,
      height: 36,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
      backgroundColor: C.surface,
    },
    milestoneToastTitle: { fontSize: 14, fontFamily: 'Inter_700Bold', color: C.text },
    milestoneToastSub: {
      fontSize: 12,
      fontFamily: 'Inter_400Regular',
      color: C.textSecondary,
      marginTop: 1,
    },
    milestoneIcon: {
      width: 36,
      height: 36,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
      backgroundColor: C.surface,
    },
    milestoneTitle: { fontSize: 14, fontFamily: 'Inter_700Bold', color: C.text },
    milestoneSub: {
      fontSize: 12,
      fontFamily: 'Inter_400Regular',
      color: C.textSecondary,
      marginTop: 1,
    },

    warningCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: C.surface,
      borderRadius: 14,
      paddingHorizontal: 14,
      paddingVertical: 12,
      borderWidth: 1,
      borderColor: C.borderLight,
    },
    warningIcon: {
      width: 36,
      height: 36,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
      backgroundColor: C.warningLight,
    },
    warningTitle: { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: C.text },
    warningSub: {
      fontSize: 12,
      fontFamily: 'Inter_400Regular',
      color: C.textSecondary,
      marginTop: 1,
    },

    resumeSecondary: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: C.surface,
      borderRadius: 14,
      paddingHorizontal: 14,
      paddingVertical: 12,
      borderWidth: 1,
      borderColor: C.warning,
    },
    resumeIcon: {
      width: 36,
      height: 36,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
      backgroundColor: C.warningLight,
    },
    resumeTitle: { fontSize: 13, fontFamily: 'Inter_700Bold', color: C.text },
    resumeSub: {
      fontSize: 12,
      fontFamily: 'Inter_400Regular',
      color: C.textSecondary,
      marginTop: 1,
    },
    resumeBtnSm: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      backgroundColor: C.warning,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    resumeBtnSmText: { fontSize: 13, fontFamily: 'Inter_700Bold', color: C.textInverse },
    resumeDiscardBtn: {
      width: 28,
      height: 28,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
    },

    firstChoiceRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 11,
      borderTopWidth: 1,
      borderTopColor: C.borderLight,
    },
    firstChoiceIcon: {
      width: 56,
      height: 56,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
      overflow: 'hidden',
    },
    firstChoiceImage: { width: '100%' as any, height: '100%' as any },
    todayIconImage: { width: '100%' as any, height: '100%' as any },
    firstChoiceLabel: {
      fontSize: 15,
      fontFamily: 'Inter_700Bold',
      color: C.primaryText,
      marginBottom: 2,
    },
    firstChoiceSub: { fontSize: 12, fontFamily: 'Inter_400Regular', color: C.textSecondary },

    kitCallout: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      gap: 7,
      backgroundColor: C.primarySurface,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 8,
      marginTop: 12,
    },
    kitCalloutText: {
      flex: 1,
      fontSize: 11,
      fontFamily: 'Inter_400Regular',
      color: C.primaryText,
      lineHeight: 15,
    },

    calibrationCompleteCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: C.surface,
      borderRadius: 14,
      paddingHorizontal: 14,
      paddingVertical: 12,
      borderWidth: 1,
      borderColor: C.border,
    },
    calibrationCompleteIcon: {
      width: 36,
      height: 36,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
      backgroundColor: C.surfaceSecondary,
    },
    calibrationCompleteTitle: { fontSize: 14, fontFamily: 'Inter_700Bold', color: C.primaryText },
    calibrationCompleteSub: {
      fontSize: 12,
      fontFamily: 'Inter_400Regular',
      color: C.textSecondary,
      marginTop: 1,
    },


    weightInputRow: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      gap: 10,
      marginBottom: 16,
    },
    weightInput: {
      flex: 1,
      borderWidth: 1.5,
      borderRadius: 12,
      paddingHorizontal: 16,
      paddingVertical: 12,
      fontSize: 22,
      fontFamily: 'Inter_600SemiBold',
      textAlign: 'center' as const,
    },
    weightInputUnit: { fontSize: 16, fontFamily: 'Inter_500Medium' },
  });
}
