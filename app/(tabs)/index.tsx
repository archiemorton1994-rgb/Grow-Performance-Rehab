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
  useWindowDimensions,
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
import { useAppStore, type EquipmentTier } from '@/lib/store';
import { withKeptSupplies } from '@/lib/kit';
import { countLiftingSessions, rotatesSessions } from '@/lib/session-type';
import { getSessionImage } from '@/lib/session-images';
import { nameOf } from '@/lib/programme';
import {
  FIRST_SESSION_COPY,
  HOME_TUTORIAL,
  heroEyebrow,
  heroProgrammeName,
  homeHero,
  programmePlace,
  programmePlaceLine,
  programmeTile,
  programmeTileHref,
} from '@/lib/home-screen';
import { FIRST_SESSION_CHOICES, offsetForFirstSession } from '@/lib/your-sessions';
import { countedEarned } from '@/lib/badges';
import { getTimeOfDayGreeting, kgToDisplayUnit, displayUnitToKg } from '@/lib/utils';
import { SESSION_META, SESSION_SHORT_LABELS } from '@/lib/session-meta';
import { getEquipmentLabel, getEffectiveTier } from '@/lib/workout-engine';
import { EquipmentIcon } from '@/components/EquipmentIcon';
import { scheduleBodyweightReminder, cancelBodyweightReminder } from '@/lib/notifications';
import CoachMark, { SpotlightRect } from '@/components/CoachMark';
import { entryStepFor, tourBackTarget } from '@/lib/tour-chain';
import { ScrollIndicator, useScrollIndicator } from '@/components/ScrollIndicator';
import { CoachButton, CoachBubble } from '@/components/CoachBubble';
import {
  getCoachBriefing,
  getCoachMessages,
  getCoachSnapshot,
  hasActionableAdvice,
  messageSignature,
  weekdayForTrainingWeek,
  type CoachAction,
} from '@/lib/coach';
import { resumeParams } from '@/lib/resume-params';
import { photoSource } from '@/lib/profile-photo';

/**
 * THE TOUR CARDS LIVE IN lib/home-screen.ts.
 *
 * Data with no React in it, so tests/guided-tour.check.mjs and
 * tests/tour-finale.check.mjs RUN the cards and read the sentence the user
 * gets, rather than matching a regular expression over this screen - which
 * matched the comments explaining the copy as readily as the copy itself. The
 * Train tab made the same move for the same reason; see lib/train-screen.ts.
 */

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
    programme,
    getProgrammePosition,
    getProgrammeDrift,
    getCurrentSessionType,
    getStreakDays,
    getThisWeekCount,
    weeklyStreakGoal,
    isWeightReminderVisible,
    userProfile,
    setUserProfile,
    activeSession,
    clearActiveSession,
    profilePhotoUri,
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
    tourEnterAtLastStep,
    setTourEnterAtLastStep,
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
    setCycleStartOffset,
  } = useAppStore();

  const [coachOpen, setCoachOpen] = useState(false);
  const [photoFailed, setPhotoFailed] = useState(false);

  /*
   * THE BEGINNER EQUIPMENT LOCK IS GONE FROM THIS SHEET TOO.
   *
   * A beginner used to see dumbbells, kettlebells and the gym greyed out with a
   * padlock beside each. The library builds the strength sessions and carries
   * its own level, so the level decides the exercise and the kit answer decides
   * only what it may be done with. See lib/sign-up.ts.
   */
  const ALL_TIERS = ['bodyweight', 'bands', 'dumbbells', 'kettlebells', 'fullgym'] as const;

  const profileEquipment =
    equipmentTiers && equipmentTiers.length > 0 ? equipmentTiers : ['bodyweight' as const];
  const todayTiers = sessionEquipmentOverride ?? profileEquipment;
  const todayEffectiveTier = getEffectiveTier(todayTiers);
  /*
   * THE BARBELL CALLOUT IS GONE, and so is the reason it was here.
   *
   * It read "Named after the barbell lifts - every session adapts to the
   * equipment you have", and it was shown to anybody without a full gym who was
   * not on a programme. It was an apology for the programmes being called Squat
   * and Bench, on a card that no longer offers them, to a person who may well
   * never open one. The kit promise it was making is on the Train tab, where the
   * sessions are, and it is made to everybody there rather than only to the
   * people the app decided were short of equipment.
   */

  const [sheetOpen, setSheetOpen] = useState(false);
  // The draft holds whatever the person owns, which can include kit that is
  // not one of the tiles (a bench). The tiles are still ALL_TIERS.
  const [sheetDraft, setSheetDraft] = useState<EquipmentTier[]>([]);

  const openEquipmentSheet = () => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSheetDraft([...todayTiers]);
    setSheetOpen(true);
  };

  const handleDraftToggle = (tier: EquipmentTier) => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSheetDraft((prev) => {
      if (tier === 'fullgym') {
        return prev.includes('fullgym')
          ? prev.filter((t) => t !== 'fullgym')
          : withKeptSupplies(ALL_TIERS, prev);
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
  /**
   * The block's name, and null unless a block is really choosing sessions.
   *
   * Enrolled is not the same as running. A paused block is still stored, still
   * has a position, and is still the thing this screen used to name over
   * today's session - while getCurrentSessionType had already handed the day
   * back to the plain rotation. The card named a programme that was not
   * choosing it. heroProgrammeName is the one rule for that, shared with the
   * place line and the easier-week note below.
   */
  const enrolledName = programme ? nameOf(programme) : null;
  const programmeName = heroProgrammeName(
    programme && enrolledName ? { name: enrolledName, paused: programme.paused } : null
  );
  /**
   * A block has finished and its report has not been opened.
   *
   * The one state where the programme tile stops being about where you are and
   * starts being about what you just did.
   */
  const reportReady = useAppStore((s) => s.pendingProgrammeReportId) !== null;
  /**
   * The pounds fault, if this account has it. Null for almost everybody.
   *
   * Recomputed when the profile or the maxes move, which is exactly when
   * answering the card changes the answer to null and takes it off the screen.
   */
  const getUnitCorrection = useAppStore((s) => s.getUnitCorrection);
  const resolveUnitCorrection = useAppStore((s) => s.resolveUnitCorrection);
  const unitFix = useMemo(
    () => getUnitCorrection(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [getUnitCorrection, userProfile.bodyweightKg, bodyweightUpdatedAt, oneRepMaxes]
  );
  /**
   * Where in the block they are, and null the moment the block is not running.
   *
   * getProgrammePosition answers for a PAUSED block too, on purpose: the hub
   * shows somebody where they will pick up. Home read that straight, so a
   * paused block went on counting sessions here and, worse, went on announcing
   * "Easier week" for a deload week that nothing was applying. programmePlace
   * is the guard, and everything drawn from the block goes through it.
   */
  const tilePlace = programmePlace(programme, getProgrammePosition());
  const placeLine = programmePlaceLine(tilePlace);
  const streak = getStreakDays();
  const weekCount = getThisWeekCount();
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
      drift: getProgrammeDrift(),
      programmeName,
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
    /**
     * WITHOUT THIS, WAVING A MESSAGE AWAY DID NOTHING.
     *
     * Tapping the small x records the dismissal, but nothing here changed, so
     * the panel was never rebuilt and the message sat exactly where it was.
     * The home tab stays mounted, so it stayed for the rest of the visit rather
     * than the rest of the render. app/assistant.tsx has always had this in its
     * own list, which is why the same x works there and not here.
     */
    coachDismissedAt,
    oneRepMaxes.length,
    exerciseStuckStreak,
  ]);

  const coachMessages = useMemo(() => getCoachMessages(coachInput), [coachInput]);
  const coachSnapshot = useMemo(() => getCoachSnapshot(coachInput), [coachInput]);
  /**
   * How much the panel is NOT showing.
   *
   * Same buckets, same order - getCoachBriefing and getCoachMessages both read
   * what buildCoachBuckets produced, so this number can never disagree with
   * what the full screen then lists.
   */
  const coachMore = useMemo(() => {
    const total = getCoachBriefing(coachInput).total;
    return Math.max(0, total - coachMessages.length);
  }, [coachInput, coachMessages.length]);

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
      if (action.kind === 'open-programme') {
        router.push('/program');
        return;
      }
      // A coach message can name a specific session (the balance nudge does);
      // otherwise it means "the one you were going to do anyway".
      router.push({
        pathname: '/readiness',
        params: { sessionType: action.sessionType ?? suggestedSession },
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [suggestedSession]
  );

  const suggestedMeta = SESSION_META[suggestedSession];

  /**
   * How many times this person has put a weight through their body.
   *
   * Counted through trainTypeOf (see lib/session-type.ts), not against the three
   * lift-named ids. That list stopped naming a session the app builds, so
   * everybody training Lower, Upper and Full Body counted zero, and somebody two
   * hundred sessions in read as brand new.
   *
   * What it decides now is whether the first-session chooser is shown at all:
   * nought lifting sessions means the rotation has no position to carry and the
   * app would otherwise be picking for them.
   */
  const strengthCount = useMemo(() => countLiftingSessions(completedSessions), [completedSessions]);

  /**
   * WHICH HERO CARD: the session, or the one-off chooser.
   *
   * Both the rotation rule and the pause rule are shared rather than rewritten
   * here. A beginner never sees the chooser because there is nothing to choose,
   * and a paused block does not count as one that is choosing, so somebody who
   * paused gets their own rotation back on the same card everybody else has.
   */
  const heroMode = homeHero({
    // Enrolled at all, PAUSED INCLUDED, unlike every other read on this screen.
    // Somebody who paused Joint Health has no lifting history, and treating
    // that as "never met you" put a first-session chooser in front of a person
    // three weeks into a block. See homeHero.
    hasProgramme: programme !== null,
    rotates: rotatesSessions(userProfile),
    liftingCount: strengthCount,
  });

  /** The tile's four lines, in whichever of its four states applies. */
  const tile = programmeTile({
    reportReady,
    enrolledName,
    paused: programme?.paused,
    place: tilePlace,
    nextSessionLabel: SESSION_SHORT_LABELS[suggestedSession],
  });

  /*
   * THE BLOCK-PROGRESS ROW IS GONE, along with the cycle it counted.
   *
   * It was a slim bar under the hero saying "Cycle 2 · Block 6 / 12", and
   * "Test week in 2 sessions" as one came due. Every word of it was about the
   * strength test cycle, which is retired, so there is nothing left for it to
   * count. Anyone on a programme still has the tile above it, which says where
   * they are in the block that is actually running.
   */

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
  /**
   * HOME DOES NOT SCROLL, on any phone anybody is holding.
   *
   * One fixed tile size cannot do that: what fills a 6.7 inch screen overflows
   * a 5.5 inch one. Two can. 800 is the line - a 390x844 or 375x812 phone gets
   * the comfortable size, a 360x780 gets the compact one, both measured in the
   * exported build rather than guessed at.
   */
  const { height: windowHeight } = useWindowDimensions();
  const compactTiles = windowHeight < 800;
  const styles = useMemo(() => makeStyles(C, compactTiles), [C, compactTiles]);

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

  /**
   * Out of the recommendation and into the whole catalogue.
   *
   * No active-session guard here on purpose. Train raises its own "Session in
   * progress" alert when a card is picked (showActiveSessionPrompt, with
   * Resume / Discard / Cancel), so the guard is not lost by leaving it out, it
   * just happens one screen later and with better options than this screen
   * could offer. Duplicating it here would mean two alerts to dismiss to reach
   * a tab that is safe to look at.
   */
  const handleTrainSomethingElse = useCallback(() => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push('/(tabs)/train');
  }, []);

  const handleStartSuggested = () => {
    const go = () => {
      if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      // A custom session is built, not generated — generateWorkout returns []
      // for it, so sending one through readiness ends in an empty workout.
      //
      // The rotation cannot suggest one any more: off a programme it answers
      // Lower, Upper or Full Body, and the session list of a programme is drawn
      // from BUILDABLE_SESSION_TYPES, which has no 'custom' in it. The guard
      // stays because a custom programme's cycle is stored on the device and
      // synced back from the server, so it is not this screen's to assume is
      // well formed.
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

  /**
   * THE FIRST SESSION, AND THE ONLY CALLER setCycleStartOffset HAS.
   *
   * The stored offset is what makes the pick stick: with no lifting history the
   * suggestion is SESSION_ORDER[offset], so writing the index of what they chose
   * means tomorrow's card already says it, and the two after it follow in order.
   * Written BEFORE the navigation, so backing out of readiness still leaves the
   * choice made rather than dropping them back on this card.
   */
  const handleStartFirstSession = (type: (typeof FIRST_SESSION_CHOICES)[number]) => {
    const offset = offsetForFirstSession(type);
    if (offset >= 0) setCycleStartOffset(offset);
    const go = () => {
      if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      router.push({
        pathname: '/readiness',
        params: {
          sessionType: type,
          equipmentOverride: sessionEquipmentOverride
            ? JSON.stringify(sessionEquipmentOverride)
            : undefined,
        },
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

  /**
   * How long ago the unfinished session was saved, in words.
   *
   * Empty for one saved today, because "today" beside a Resume button is noise.
   */
  const activeSessionAge = useMemo(() => {
    if (!activeSession?.savedAt) return '';
    const then = new Date(activeSession.savedAt);
    const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    const days = Math.round((startOfDay(new Date()) - startOfDay(then)) / 86400000);
    if (days <= 0) return '';
    if (days === 1) return 'yesterday';
    return `${days} days ago`;
  }, [activeSession]);

  const handleDiscardActiveSession = () => {
    Alert.alert(
      'Start fresh?',
      `${activeSession?.completedSetsCount ?? 0} logged ${
        (activeSession?.completedSetsCount ?? 0) === 1 ? 'set' : 'sets'
      } will be lost. Your history and your weights are not affected.`,
      [
        { text: 'Keep it', style: 'cancel' },
        { text: 'Start fresh', style: 'destructive', onPress: () => clearActiveSession() },
      ]
    );
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
  // Nothing to filter any more: the step that needed a training block to exist
  // was cut, along with the other four that described a screen a first-run user
  // has not filled in yet. Kept as a memo so the shape below is unchanged.
  const homeEffectiveTutorial = useMemo(() => HOME_TUTORIAL, []);
  const [tutStep, setTutStep] = useState<number | null>(null);
  const sessionCardRef = useRef<View>(null);
  const streakTileRef = useRef<View>(null);
  const coachButtonRef = useRef<View>(null);
  // One ref, two render branches. The hero card is either the first-session
  // chooser or the today card and never both, so whichever is mounted is the
  // one that measures - which is also why the button has to exist in BOTH
  // branches or this step spotlights nothing for a brand-new user.
  const trainElseRef = useRef<View>(null);
  const programmeTileRef = useRef<View>(null);
  const achievementsTileRef = useRef<View>(null);
  const [tutSpotlight, setTutSpotlight] = useState<SpotlightRect | null>(null);
  const scrollHint = useScrollIndicator();

  useEffect(() => {
    if (tourActiveTab === 0) {
      // entryStepFor is what makes Back across a tab boundary land on the card
      // the user was reading rather than on this tab's first one. The flag is
      // consumed here so a later forward arrival opens at the start again.
      const at = entryStepFor(tourEnterAtLastStep, homeEffectiveTutorial.length);
      const t = setTimeout(() => {
        setTutStep(at);
        if (tourEnterAtLastStep) setTourEnterAtLastStep(false);
      }, 300);
      return () => clearTimeout(t);
    }
    setTutStep(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tourActiveTab]);

  useEffect(() => {
    setTutSpotlight(null);
    if (tutStep === null || homeEffectiveTutorial[tutStep] == null) return;
    const refLookup = {
      session: sessionCardRef,
      programme: programmeTileRef,
      coach: coachButtonRef,
      streak: streakTileRef,
      achievements: achievementsTileRef,
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

  /**
   * Back one card, or to the last card of the previous tab.
   *
   * tourBackTarget is what decides which, and it knows the tour's real order -
   * Home, Train, Restore, Stats, Profile - rather than assuming tab minus one,
   * which is wrong for every tab in the chain. A null target means this is the
   * first card of the whole tour and CoachMark is not given an onPrev at all,
   * so no control renders.
   */
  const backHomeTut = useCallback(() => {
    const target = tourBackTarget(0, tutStep);
    if (target === null) return;
    if (target.kind === 'step') {
      setTutStep(target.step);
      return;
    }
    setTutStep(null);
    setTourEnterAtLastStep(true);
    setTourActiveTab(target.tab);
  }, [tutStep, setTourActiveTab, setTourEnterAtLastStep]);

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
            // The tab bar is 83pt (49 + inset) and tabBarHeight already
            // rounds that up to 84. The old +24 on top of it reserved 108pt of
            // screen for an 83pt bar, which is 25pt of a screen that was 83pt
            // short. +8 is a clear gap, not a hole.
            { paddingBottom: Platform.OS === 'web' ? 84 + 8 : tabBarHeight + 8 },
          ]}
          showsVerticalScrollIndicator={false}
          {...scrollHint.handlers}
        >
          {/* Header */}
          <Animated.View entering={FadeInDown.duration(350)} style={styles.header}>
            {/* Greeting and name are stacked rather than run together on one
                line: at 24px "Good evening Archie" has to share the row with the
                coach button and the avatar, and the name is what loses.
                adjustsFontSizeToFit is a native-only prop, so on web it did not
                shrink — it simply cut the name off. */}
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
              {profilePhotoUri && !photoFailed ? (
                <Image
                  source={{ uri: photoSource(profilePhotoUri) }}
                  style={styles.headerAvatarImg}
                  // A saved photo whose file has gone falls back to the initial
                  // rather than an empty circle. See lib/profile-photo.ts.
                  onError={() => setPhotoFailed(true)}
                />
              ) : firstName ? (
                <Text style={styles.headerAvatarInitial}>{firstName[0].toUpperCase()}</Text>
              ) : (
                <Ionicons name="person" size={18} color={C.primaryText} />
              )}
            </Pressable>
          </Animated.View>

          {/* Hero card - the session, or the one-off first-session chooser */}
          {/* Glow wrapper: pulses green after the tab tour completes */}
          <View ref={sessionCardRef} collapsable={false}>
          <Animated.View style={cardGlowStyle}>
            {/**
              * ONE THING IN THIS BOX: the session Grow is suggesting.
              *
              * IT USED TO BRANCH ON THE PROGRAMME, and for most people that
              * meant a card headed "No programme yet" with a button to go and
              * get one. Grow's first screen, for the majority of its users, was
              * an advert for the one feature the plan calls optional - and it
              * offered no way to train at all beyond a quiet "Train something
              * else" link. A paused block was worse: `programme` was still set,
              * so the card went on naming a block that had been stopped and
              * counting sessions towards it, while the app was quietly building
              * the plain rotation instead.
              *
              * So the branch is on whether the app KNOWS what to suggest. It
              * almost always does, programme or no programme. The one case it
              * does not is somebody who rotates their sessions and has never
              * lifted here, and they are asked rather than guessed at.
              */}
            {heroMode === 'chooser' ? (
              <Animated.View
                entering={FadeInDown.delay(60).duration(380)}
                style={styles.todayCard}
                testID="home-first-session"
              >
                {/* The SAME eyebrow the other branch draws, from the same
                    function. This card stands in for the Today card and has to
                    read as it, not as a different screen. */}
                <Text style={styles.todayLabel} numberOfLines={1}>
                  {heroEyebrow(null)}
                </Text>
                <Text style={styles.chooserTitle} numberOfLines={1}>
                  {FIRST_SESSION_COPY.title}
                </Text>
                <Text style={[styles.todaySessionSub, { marginBottom: 12 }]} numberOfLines={1}>
                  {FIRST_SESSION_COPY.body}
                </Text>
                <View style={styles.chooserRow}>
                  {FIRST_SESSION_CHOICES.map((type) => (
                    <Pressable
                      key={type}
                      onPress={() => handleStartFirstSession(type)}
                      style={({ pressed }) => [styles.chooserTile, pressed && { opacity: 0.85 }]}
                      testID={`home-first-session-${type}`}
                      accessibilityRole="button"
                      accessibilityLabel={`Start with ${SESSION_META[type].label}`}
                    >
                      <Text style={styles.chooserTileText}>{SESSION_META[type].label}</Text>
                    </Pressable>
                  ))}
                </View>
                <View style={styles.chipRow}>
                  <View ref={trainElseRef} collapsable={false} style={styles.trainElseWrap}>
                    <Pressable
                      onPress={handleTrainSomethingElse}
                      style={({ pressed }) => [styles.trainElseBtn, pressed && { opacity: 0.8 }]}
                      testID="home-train-something-else"
                      accessibilityRole="button"
                      accessibilityLabel="Train something else"
                    >
                      <Ionicons name="grid-outline" size={15} color={C.primaryText} />
                      <Text style={styles.trainElseText}>Train something else</Text>
                      <Ionicons name="chevron-forward" size={13} color={C.primaryText} />
                    </Pressable>
                  </View>
                </View>
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
                    {/* The eyebrow names the block this session belongs to, so
                        the box is unmistakably the programme's rather than a
                        suggestion from nowhere. It is the sentence that was
                        missing when somebody opened Home and found a Squat
                        Session they had never asked for - and it says plain
                        "Today" when nothing is choosing, rather than naming a
                        block that is paused or absent. */}
                    <Text style={styles.todayLabel} numberOfLines={1}>
                      {heroEyebrow(programmeName)}
                    </Text>
                    {/*
                      numberOfLines is load-bearing, not tidiness.

                      The session artwork used to be 112pt and set this row's
                      height on its own. At 76 the text column wins instead, and
                      the column is only ~182pt wide - so without this the card
                      would be one line taller on the days squat comes up (its
                      subtitle is longer than deadlift's) and the whole screen
                      would fit on some days and not others.
                    */}
                    <Text style={styles.todaySessionName} numberOfLines={1}>
                      {suggestedMeta.label}
                    </Text>
                    <Text style={styles.todaySessionSub} numberOfLines={1}>
                      {placeLine ?? suggestedMeta.subtitle}
                    </Text>
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
                <View style={styles.chipRow}>
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
                <View ref={trainElseRef} collapsable={false} style={styles.trainElseWrap}>
                  <Pressable
                    onPress={handleTrainSomethingElse}
                    style={({ pressed }) => [styles.trainElseBtn, pressed && { opacity: 0.8 }]}
                    testID="home-train-something-else"
                    accessibilityRole="button"
                    accessibilityLabel="Train something else"
                  >
                    <Ionicons name="grid-outline" size={14} color={C.primaryText} />
                    <Text style={styles.trainElseText}>Train something else</Text>
                    <Ionicons name="chevron-forward" size={12} color={C.primaryText} />
                  </Pressable>
                </View>
                </View>
                <Pressable
                  onPress={handleStartSuggested}
                  style={({ pressed }) => [
                    styles.startBtn,
                    pressed && { opacity: 0.88, transform: [{ scale: 0.98 }] },
                  ]}
                  testID="start-suggested-session"
                >
                  <Ionicons name="flash" size={18} color={C.primaryDarkText} />
                  <Text style={styles.startBtnText}>Start Session</Text>
                </Pressable>
              </Animated.View>
            )}
          </Animated.View>
          </View>

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
              ref={programmeTileRef}
              collapsable={false}
              style={styles.summaryCard}
              /* The testID never changes. This is one tile with two states, and
                 the tour spotlights it by name - an id that moves when a block
                 finishes is a tour that breaks for exactly the people who have
                 been using the app longest. */
              onPress={() => {
                if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push(programmeTileHref(reportReady));
              }}
              testID="your-program-card"
              accessibilityLabel={
                reportReady
                  ? 'Read your programme report'
                  : enrolledName
                    ? 'Your programme'
                    : 'Your sessions'
              }
            >
              <Image
                source={HOME_ICONS.yourProgram}
                style={styles.summaryCardImage}
                resizeMode="contain"
              />
              {/* ALL FOUR LINES COME FROM ONE FUNCTION, in lib/home-screen.ts,
                  so a check can run every state of this tile and read the
                  strings back rather than matching them in this file.

                  The four lines are ALWAYS drawn, and the number is a space
                  when there is no number. Home is sized not to scroll and these
                  tiles are a fixed height, so dropping an element out of one
                  state is a layout change rather than a copy one: this tile
                  would stand a line shorter than the three beside it.

                  Off a programme it is no longer an invitation to get one. It
                  says YOUR SESSIONS and names the next, because a person
                  training without a programme is not missing anything. */}
              <Text style={styles.summaryCycleLabel}>{tile.label}</Text>
              <Text style={styles.summaryBigNum}>{tile.number}</Text>
              <Text style={styles.summaryCardTitle} numberOfLines={1}>
                {tile.title}
              </Text>
              <Text style={styles.summaryCardSub} numberOfLines={1}>
                {tile.subtitle}
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
              <Text style={styles.summaryCardTitle}>TOTAL WORKOUTS</Text>
            </Pressable>

            {/* Achievements */}
            <Pressable
              ref={achievementsTileRef}
              collapsable={false}
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
              {/* THE SAME RULE THE ACHIEVEMENTS SCREEN COUNTS BY.
                  This read earnedBadges.length, which includes badges the app
                  has stopped awarding, while achievements.tsx shows "x of y"
                  through countedEarned, which leaves them out. Anyone holding a
                  retired badge - a strength test week, a movement screen - saw
                  one number here and a smaller one on the very next screen. One
                  function, so the two cannot disagree again. */}
              <Text style={styles.summaryBigNum}>{countedEarned(earnedBadges)}</Text>
              <Text style={styles.summaryCardTitle}>ACHIEVEMENTS</Text>
            </Pressable>
          </Animated.View>

          {/* Secondary actionable card - priority: the pounds fault > resume >
              milestone > broken streak (mutually exclusive).

              The pounds fault leads because the weights behind the Resume button
              are the wrong weights, so sending somebody into a session before
              asking would be the app knowing and not saying. */}
          {unitFix ? (
            <Animated.View
              entering={FadeInDown.delay(180).duration(380)}
              style={styles.unitFixCard}
              testID="unit-fix-card"
            >
              <View style={styles.unitFixHead}>
                <Ionicons name="alert-circle" size={19} color={C.warning} />
                <Text style={styles.unitFixTitle}>
                  {unitFix.certain
                    ? 'Your weights were recorded in the wrong unit'
                    : 'Can we check your bodyweight?'}
                </Text>
              </View>
              <Text style={styles.unitFixBody}>
                {unitFix.certain
                  ? `We have you down as ${unitFix.storedKg} kg, which we recorded from what you typed when you set up. It should have been ${unitFix.correctedKg} kg. That was our fault, and it has been making your weights too heavy${unitFix.lifts.length > 0 ? ', along with your best lifts' : ''}.`
                  : `We have you down as ${unitFix.storedKg} kg. You train in pounds, and there was a fault in our setup screen that recorded pounds as kilos, so this may have meant ${unitFix.correctedKg} kg${unitFix.lifts.length > 0 ? '. Your best lifts would be the same' : ''}.`}
              </Text>
              <View style={styles.unitFixActions}>
                <Pressable
                  onPress={() => {
                    if (Platform.OS !== 'web')
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    resolveUnitCorrection('pounds');
                  }}
                  testID="unit-fix-accept"
                  style={({ pressed }) => [
                    styles.unitFixPrimary,
                    { backgroundColor: C.primaryDark },
                    pressed && { opacity: 0.9 },
                  ]}
                >
                  <Text style={[styles.unitFixPrimaryText, { color: C.primaryDarkText }]}>
                    {unitFix.certain
                      ? `Put it right, I am ${unitFix.correctedKg} kg`
                      : `Yes, I am ${unitFix.correctedKg} kg`}
                  </Text>
                </Pressable>
                {/* Not offered when the recorded figure is impossible as a
                    bodyweight. Asking "no, I really am 340 kg" would be the app
                    pretending not to know something it does know, and
                    setUserProfile would refuse the value anyway, so the card
                    would simply come back for ever. */}
                {!unitFix.certain && (
                  <Pressable
                    onPress={() => resolveUnitCorrection('kilograms')}
                    testID="unit-fix-keep"
                    style={({ pressed }) => [styles.unitFixSecondary, pressed && { opacity: 0.8 }]}
                  >
                    <Text style={styles.unitFixSecondaryText}>
                      No, {unitFix.storedKg} kg is right
                    </Text>
                  </Pressable>
                )}
              </View>
            </Animated.View>
          ) : activeSession ? (
            <Animated.View
              entering={FadeInDown.delay(180).duration(380)}
              style={styles.resumeSecondary}
            >
              <View style={styles.resumeIcon}>
                <Ionicons name="time-outline" size={20} color={C.warning} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.resumeTitle}>Session in progress</Text>
                {/* The age matters now that a session survives a week rather
                    than a day. "12/24 sets" from this morning and "12/24 sets"
                    from last Tuesday are different decisions, and the X beside
                    this is the other half of that decision. */}
                <Text style={styles.resumeSub}>
                  {activeSession.displayLabel ??
                    SESSION_META[activeSession.sessionType]?.label ??
                    activeSession.sessionName}{' '}
                  · {activeSession.completedSetsCount}/{activeSession.totalSets} sets
                  {activeSessionAge ? ` · ${activeSessionAge}` : ''}
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
        {/* Home fits one screen on an iPhone 12 and up. On a 667pt SE it does
            not, and nothing used to say so. */}
        <ScrollIndicator {...scrollHint.state} top={8} bottom={96} />

        {/* The assistant's bubble. Rendered OUTSIDE the ScrollView so it floats
            over the page rather than adding to its height — the whole point of
            this change was that advice must not make the home screen scroll.
            Not a Modal; see the note in CoachBubble. */}
        {coachOpen && (
          <CoachBubble
            messages={coachMessages}
            snapshot={coachSnapshot}
            seen={seenAtOpen.current}
            moreCount={coachMore}
            onOpenAll={() => {
              setCoachOpen(false);
              router.push('/assistant');
            }}
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
            {ALL_TIERS.map((tier) => {
              const selected = sheetDraft.includes(tier);
              return (
                <Pressable
                  key={tier}
                  onPress={() => handleDraftToggle(tier)}
                  style={({ pressed }) => [
                    modalStyles.tierRow,
                    { borderBottomColor: C.borderLight },
                    selected && { backgroundColor: C.primaryMuted },
                    pressed && { opacity: 0.7 },
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
                </Pressable>
              );
            })}
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
          onPrev={tourBackTarget(0, tutStep) ? backHomeTut : undefined}
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

function makeStyles(C: ReturnType<typeof useColors>, compactTiles = false) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: C.background },
    // Home is meant to fit on one screen. Every number here was measured
    // against a 390x844 device, not chosen: see the budget in the commit that
    // introduced them. Four 16px gaps were 64px of air on a screen that was
    // 197px over.
    // flexGrow so the content fills the phone when it is shorter than one.
    // On a returning user the card and the four tiles come up short and the
    // slack was sitting as a dead band above the tab bar; the grid below
    // absorbs it instead.
    inner: {
      // Anything the capped grid leaves over goes between the blocks rather
      // than into a band under the last one, which is the gap that was
      // reported before the tiles were allowed to stretch at all.
      justifyContent: 'space-between' as const,
      paddingHorizontal: 20,
      paddingTop: 12,
      paddingBottom: 24,
      gap: 12,
      flexGrow: 1,
    },

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
    todayCard: {
      backgroundColor: C.surface,
      borderRadius: 20,
      padding: 16,
      borderWidth: 1,
      borderColor: C.border,
      ...shadowStyle(C.shadow, 0.18, 14, 6, 5),
    },
    todayCardTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
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
    // 112 was the single tallest thing on the home screen and the session
    // artwork is perfectly legible smaller. This is 36px of the ~197 that had
    // to come out.
    todayIcon: {
      width: 76,
      height: 76,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      marginLeft: 14,
      flexShrink: 0,
    },
    todayIconImage: { width: '100%' as any, height: '100%' as any },
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

    /**
     * Deliberately quieter than startBtn, and deliberately not silent.
     *
     * It sits directly above the primary button, so it has to be obviously the
     * second choice - no fill, a hairline border, the accent as ink rather than
     * as background. But it is the only thing on this screen that says the rest
     * of the app exists, so it is a real button and not a text link.
     */
    // The equipment chip and this share a row. Stacked they cost 90px on a
    // screen that had to lose 197; side by side they cost 41 and read as what
    // they are, two secondary controls above one primary button.
    chipRow: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      gap: 8,
      marginBottom: 10,
    },
    trainElseWrap: { flex: 1 },
    trainElseBtn: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
      gap: 5,
      borderRadius: 12,
      paddingVertical: 8,
      paddingHorizontal: 8,
      borderWidth: 1,
      borderColor: C.border,
      backgroundColor: C.surfaceSecondary,
    },
    trainElseText: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: C.primaryText },

    equipmentChip: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      gap: 6,
      alignSelf: 'flex-start' as const,
      backgroundColor: C.surfaceSecondary,
      borderRadius: 20,
      paddingHorizontal: 11,
      paddingVertical: 6,
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

    /**
     * FIXED. Not flexible, not stretched, not sharing the leftover.
     *
     * Two rounds were spent trying to make these fill whatever space the phone
     * had left, and both went wrong in the same way. Letting the grid grow put
     * the page on a scrollbar. Bounding the grid but letting the picture take
     * the slack grew the tiles to 185 points with an 84 point logo marooned in
     * the middle - "the boxes are still too big and the logos not big enough".
     * Removing the picture's ceiling was worse still: an Image with flex and no
     * height falls back on its own aspect ratio, so a 219 px square asset made
     * a 301 point tile.
     *
     * So the tile is a known size and the picture is a known size, and the
     * space the screen has left over is spread between the blocks by `inner`
     * instead. 136 is a smaller box than it was and 54 is a larger logo, which
     * is the direction the complaint pointed in.
     */
    summaryGrid: {
      flexDirection: 'row' as const,
      flexWrap: 'wrap' as const,
      gap: 10,
    },
    summaryCard: {
      width: '47%' as any,
      // A floor, so the two tiles in a row match even though Your Program
      // carries an extra line. Not a ceiling: at a large system text size the
      // words are allowed to make the tile taller rather than be clipped.
      minHeight: compactTiles ? 114 : 136,
      justifyContent: 'center' as const,
      backgroundColor: C.surface,
      borderRadius: 18,
      padding: 10,
      alignItems: 'center' as const,
      borderWidth: 1,
      borderColor: C.borderLight,
      gap: 2,
    },
    summaryCardImage: {
      width: '100%' as any,
      height: compactTiles ? 40 : 54,
      marginBottom: 2,
    },
    // 11pt, and the tile's gap is 2 rather than 3. Every point the words give
    // up here is a point the picture gets, four times over.
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
      marginTop: -6,
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

    /**
     * THE FIRST-SESSION CHOOSER, SIZED TO THE CARD IT REPLACES.
     *
     * Home does not scroll and the hero is the tallest thing on it, so this
     * branch has to come in at or under the Today card or the grid below it
     * goes off the bottom of a 390x844 screen. Three side-by-side tiles of
     * words, no artwork: a picture in each would have been about 40pt of extra
     * height for three names everybody can already read.
     *
     * The title is its own size rather than todaySessionName's 28pt, which is
     * built for one or two words and wraps a question onto three lines.
     */
    chooserTitle: {
      fontSize: 20,
      fontFamily: 'Inter_700Bold',
      color: C.text,
      marginBottom: 4,
    },
    chooserRow: {
      flexDirection: 'row' as const,
      gap: 8,
      marginBottom: 12,
    },
    chooserTile: {
      flex: 1,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
      paddingVertical: 12,
      paddingHorizontal: 6,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: C.border,
      backgroundColor: C.surfaceSecondary,
    },
    chooserTileText: {
      fontSize: 13,
      fontFamily: 'Inter_700Bold',
      color: C.text,
      textAlign: 'center' as const,
    },

    unitFixCard: {
      gap: 10,
      backgroundColor: C.surface,
      borderRadius: 14,
      paddingHorizontal: 14,
      paddingVertical: 13,
      borderWidth: 1,
      borderColor: C.warning,
    },
    unitFixHead: { flexDirection: 'row', alignItems: 'center', gap: 9 },
    unitFixTitle: {
      flex: 1,
      fontSize: 14,
      fontFamily: 'Inter_700Bold',
      color: C.text,
    },
    unitFixBody: {
      fontSize: 12.5,
      lineHeight: 18,
      fontFamily: 'Inter_400Regular',
      color: C.textSecondary,
    },
    unitFixActions: { gap: 8 },
    unitFixPrimary: { borderRadius: 11, paddingVertical: 12, alignItems: 'center' },
    unitFixPrimaryText: { fontSize: 13.5, fontFamily: 'Inter_700Bold' },
    unitFixSecondary: { paddingVertical: 9, alignItems: 'center' },
    unitFixSecondaryText: {
      fontSize: 12.5,
      fontFamily: 'Inter_600SemiBold',
      color: C.textTertiary,
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
