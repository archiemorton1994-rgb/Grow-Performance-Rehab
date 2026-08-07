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
import { SessionType, useAppStore, STRENGTH_SESSION_TYPES } from '@/lib/store';
import { getSessionImage } from '@/lib/session-images';
import { getTimeOfDayGreeting, kgToDisplayUnit, displayUnitToKg, daysSince } from '@/lib/utils';
import {
  SESSION_META,
  SESSION_SHORT_LABELS,
  getSessionColors,
  SessionMeta,
} from '@/lib/session-meta';
import { getEquipmentLabel, getEffectiveTier } from '@/lib/workout-engine';
import { EquipmentIcon } from '@/components/EquipmentIcon';
import { scheduleBodyweightReminder, cancelBodyweightReminder } from '@/lib/notifications';
import CoachMark, { SpotlightRect } from '@/components/CoachMark';

interface HomeTutorialStep {
  spotlightRef: 'session' | 'block' | 'streak' | 'program' | 'achievements';
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
    body: "This card always shows today's recommended session. Tap Start and the whole workout gets built for you.",
  },
  {
    spotlightRef: 'block',
    iconName: 'stats-chart-outline',
    iconLabel: 'Progress',
    title: 'Your training block',
    body: "Shows how many sessions until your next test week, and which cycle you're on overall.",
  },
  {
    spotlightRef: 'streak',
    iconName: 'flame-outline',
    iconLabel: 'Streak',
    title: 'Keep the streak alive',
    body: 'Counts consistent weeks, not perfect ones. Hit your weekly goal and this keeps climbing.',
  },
  {
    spotlightRef: 'program',
    iconName: 'repeat-outline',
    iconLabel: 'Program',
    title: 'Your program rotation',
    body: "Rotates through Squat, Bench, and Deadlift. This shows which one's next and how far through the cycle you are.",
  },
  {
    spotlightRef: 'achievements',
    iconName: 'trophy-outline',
    iconLabel: 'Badges',
    title: "Badges you've earned",
    body: 'Milestones, strength PBs, and consistency streaks all unlock badges here. Tap in anytime to see the full list.',
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
    getTrainingBalanceNudge,
    dismissBalanceNudge,
    balanceNudgeDismissedAt,
  } = useAppStore();

  // Recomputed when the history or the dismissal changes, not on every render:
  // the rule reads the whole session list. Date.now() is deliberately captured
  // here rather than inside the selector so the memo has something stable to
  // key on — the dismissal window is measured in days, so a timestamp that is
  // a render old cannot change the answer.
  const balanceNudge = useMemo(
    () => getTrainingBalanceNudge(Date.now()),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [completedSessions, balanceNudgeDismissedAt]
  );

  const isBeginnerExperience = userProfile?.experienceLevel === 'beginner';
  const ALL_TIERS = ['bodyweight', 'bands', 'dumbbells', 'kettlebells', 'fullgym'] as const;
  const availableTiers = isBeginnerExperience ? (['bodyweight', 'bands'] as const) : ALL_TIERS;

  const profileEquipment =
    equipmentTiers && equipmentTiers.length > 0 ? equipmentTiers : ['bodyweight' as const];
  const todayTiers = sessionEquipmentOverride ?? profileEquipment;
  const todayEffectiveTier = getEffectiveTier(todayTiers);

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
  const firstName = userProfile.name ? userProfile.name.split(' ')[0] : null;
  const greeting = getTimeOfDayGreeting();
  const greetingText = firstName ? `${greeting}, ${firstName}` : greeting;
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
  const missedStreakWarning =
    completedSessions.length >= 3 && streak > 0 && weekCount < goal && new Date().getDay() >= 3;

  const [deloadDismissed, setDeloadDismissed] = useState(false);
  const [deloadExpanded, setDeloadExpanded] = useState(false);
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

  const suggestedMeta = SESSION_TYPE_META[suggestedSession];

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

  const showWeightReminder = isWeightReminderVisible();

  useEffect(() => {
    if (bodyweightReminderEnabled) {
      void scheduleBodyweightReminder(bodyweightUpdatedAt, completedSessions.length > 0);
    } else {
      void cancelBodyweightReminder();
    }
  }, [bodyweightUpdatedAt, completedSessions.length, bodyweightReminderEnabled]);

  const daysSinceWeightUpdate = useMemo(() => {
    if (!bodyweightUpdatedAt) return null;
    return Math.floor((Date.now() - new Date(bodyweightUpdatedAt).getTime()) / 86400000);
  }, [bodyweightUpdatedAt]);

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

  const handleSnoozeReminder = () => {
    setWeightReminderSnoozedAt(new Date().toISOString());
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
      params: {
        sessionType: activeSession.sessionType,
        hasAches: activeSession.hasAches ? 'true' : 'false',
        painRegion: activeSession.painRegion ?? '',
        energy: activeSession.energy,
        timeAvailable: activeSession.timeAvailable,
        isTestWeek: activeSession.isTestWeek ? 'true' : 'false',
        equipment: activeSession.equipmentTier,
        ...(activeSession.displayLabel ? { displayLabel: activeSession.displayLabel } : {}),
      },
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
  const homeEffectiveTutorial = useMemo(
    () => HOME_TUTORIAL.filter((s) => s.spotlightRef !== 'block' || showBlockProgress),
    [showBlockProgress]
  );
  const [tutStep, setTutStep] = useState<number | null>(null);
  const sessionCardRef = useRef<View>(null);
  const blockRowRef = useRef<View>(null);
  const streakTileRef = useRef<View>(null);
  const programTileRef = useRef<View>(null);
  const achievementsTileRef = useRef<View>(null);
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
      block: blockRowRef,
      streak: streakTileRef,
      program: programTileRef,
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
        setTourActiveTab(1); // hand off to Profile
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
            <View style={{ flex: 1 }}>
              <Text style={styles.greetingText} numberOfLines={1}>
                {greetingText}
              </Text>
            </View>
            {testWeek && (
              <View style={styles.testWeekPill}>
                <Ionicons name="trophy" size={13} color={C.categoryPrehabText} />
                <Text style={styles.testWeekPillText}>
                  Test Week · {testWeekProgress.completed + 1} of {testWeekProgress.total}
                </Text>
              </View>
            )}
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
                <Ionicons name="person" size={18} color={C.primary} />
              )}
            </Pressable>
          </Animated.View>

          {/* Deload week suggestion — shown after 4+ consecutive active weeks */}
          {consecutiveActiveWeeks >= 4 && !deloadDismissed && completedSessions.length >= 4 && (
            <Animated.View entering={FadeInDown.duration(300)} style={styles.deloadBanner}>
              <Pressable
                onPress={() => setDeloadExpanded((v) => !v)}
                style={styles.deloadBannerContent}
              >
                <Ionicons name="moon-outline" size={18} color={C.energyBadge} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.deloadBannerTitle, { color: C.text }]}>
                    {consecutiveActiveWeeks} weeks straight, might be time for a deload
                  </Text>
                  {deloadExpanded ? (
                    <Text style={[styles.deloadBannerSub, { color: C.textSecondary }]}>
                      {
                        'Drop to 50–60% of your normal loads this week, keep the same structure. It flushes fatigue, lets joints recover, and supercompensates, so your next block starts sharper.'
                      }
                    </Text>
                  ) : (
                    <Text style={[styles.deloadBannerSub, { color: C.textSecondary }]}>
                      A lighter week now means more progress long-term. Tap to learn more.
                    </Text>
                  )}
                </View>
                <Ionicons
                  name={deloadExpanded ? 'chevron-up' : 'chevron-down'}
                  size={13}
                  color={C.energyBadge}
                />
              </Pressable>
              <Pressable
                onPress={() => setDeloadDismissed(true)}
                hitSlop={10}
                testID="deload-banner-dismiss"
                accessibilityLabel="Dismiss"
                accessibilityRole="button"
              >
                <Ionicons name="close" size={14} color={C.textTertiary} />
              </Pressable>
            </Animated.View>
          )}

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
                {(
                  [
                    {
                      type: 'squat' as const,
                      label: SESSION_META.squat.label,
                      sub: 'Quads · Glutes · Hamstrings',
                      color: C.primary,
                      bg: C.primaryMuted,
                    },
                    {
                      type: 'bench' as const,
                      label: SESSION_META.bench.label,
                      sub: 'Chest · Shoulders · Triceps',
                      color: C.badgeVolumeText,
                      bg: C.badgeVolume,
                    },
                    {
                      type: 'deadlift' as const,
                      label: SESSION_META.deadlift.label,
                      sub: 'Back · Hips · Legs',
                      color: C.categoryNeuroText,
                      bg: C.categoryNeuro,
                    },
                  ] as const
                ).map(({ type, label, sub, color, bg }) => (
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
                      <Text style={[styles.firstChoiceLabel, { color }]}>{label}</Text>
                      <Text style={styles.firstChoiceSub}>{sub}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={C.textTertiary} />
                  </Pressable>
                ))}
              </Animated.View>
            ) : (
              <Animated.View entering={FadeInDown.delay(60).duration(380)} style={styles.todayCard}>
                <LinearGradient
                  colors={[suggestedMeta.color + '18', 'transparent']}
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
                    You last did {SESSION_TYPE_META[lastSession.sessionType].label.toLowerCase()}{' '}
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
                    color={sessionEquipmentOverride !== null ? C.primary : C.textSecondary}
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
                    color={sessionEquipmentOverride !== null ? C.primary : C.textTertiary}
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
            <View ref={blockRowRef} collapsable={false}>
              <Animated.View entering={FadeInDown.delay(75).duration(380)} style={styles.blockRow}>
                <Ionicons name="stats-chart" size={12} color={C.textTertiary} />
                <View style={styles.blockBarTrack}>
                  <View
                    style={[
                      styles.blockBarFill,
                      { width: `${Math.round((sessionsInBlock / cycleLength) * 100)}%` as any },
                    ]}
                  />
                </View>
                <Text
                  style={[styles.blockProgressLabel, sessionsUntilTest <= 2 && { color: C.warning }]}
                  numberOfLines={1}
                >
                  {sessionsUntilTest <= 2
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
                {streak > 0 ? 'Keep it going' : 'Get started'}
              </Text>
            </View>

            {/* Your Program */}
            <Pressable
              ref={programTileRef}
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
              ref={achievementsTileRef}
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
                <Ionicons name="checkmark-circle" size={20} color={C.primary} />
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

          {/* Calibration progress — visible after sessions 1 and 2 only (suppressed when a higher-priority banner shows) */}
          {completedSessions.length >= 1 &&
            completedSessions.length < 3 &&
            !activeSession &&
            milestoneHit === null && (
              <Animated.View
                entering={FadeInDown.delay(210).duration(380)}
                style={styles.calibrationCard}
              >
                <View style={styles.calibrationTop}>
                  <Ionicons name="analytics-outline" size={14} color={C.primary} />
                  <Text style={styles.calibrationTitle}>Getting to know you</Text>
                  <Text style={styles.calibrationCount}>{completedSessions.length} / 3</Text>
                </View>
                <View style={styles.calibrationTrack}>
                  <View
                    style={[
                      styles.calibrationFill,
                      { width: `${Math.round((completedSessions.length / 3) * 100)}%` as any },
                    ]}
                  />
                </View>
                <Text style={styles.calibrationSub}>
                  Complete your first 3 sessions to unlock fully personalised programming.
                </Text>
              </Animated.View>
            )}

          {/* Bodyweight reminder */}
          {showWeightReminder && (
            <Animated.View
              entering={FadeInDown.delay(240).duration(380)}
              style={styles.weightReminderCard}
            >
              <View style={[styles.weightReminderIcon, { backgroundColor: C.primarySurface }]}>
                <Ionicons name="body-outline" size={20} color={C.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.weightReminderTitle}>Update your bodyweight</Text>
                <Text style={styles.weightReminderSub}>
                  {userProfile.bodyweightKg > 0
                    ? `${kgToDisplayUnit(userProfile.bodyweightKg, weightUnit)} ${weightUnit}${daysSinceWeightUpdate !== null ? ` · updated ${daysSinceWeightUpdate}d ago` : ''}`
                    : 'Keeping this current improves load suggestions'}
                </Text>
              </View>
              <Pressable
                onPress={handleOpenWeightModal}
                style={({ pressed }) => [
                  styles.weightUpdateBtn,
                  { backgroundColor: C.primary },
                  pressed && { opacity: 0.85 },
                ]}
                testID="weight-reminder-update"
              >
                <Text style={[styles.weightUpdateBtnText, { color: C.textInverse }]}>Update</Text>
              </Pressable>
              <Pressable
                onPress={handleSnoozeReminder}
                hitSlop={10}
                style={styles.weightReminderDismiss}
                testID="weight-reminder-dismiss"
                accessibilityLabel="Snooze reminder"
                accessibilityRole="button"
              >
                <Ionicons name="close" size={16} color={C.textTertiary} />
              </Pressable>
            </Animated.View>
          )}

          {/* Training balance — the app's only observation about WHAT you
              train rather than whether you trained.

              Phrased as something noticed, not something to fix, and it can be
              dismissed for a fortnight. It will not appear for anyone whose
              gap might be deliberate: see lib/training-balance.ts, where most
              of the logic is about staying quiet. */}
          {balanceNudge && (
            <Animated.View
              entering={FadeInDown.delay(260).duration(380)}
              style={styles.weightReminderCard}
              testID="balance-nudge"
            >
              <View style={[styles.weightReminderIcon, { backgroundColor: C.primarySurface }]}>
                <Ionicons name="git-compare-outline" size={20} color={C.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.weightReminderTitle}>Your training mix</Text>
                <Text style={styles.weightReminderSub}>{balanceNudge.message}</Text>
              </View>
              <Pressable
                onPress={() => {
                  if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  router.push({
                    pathname: '/readiness',
                    params: { sessionType: balanceNudge.suggestion, isTestWeek: 'false' },
                  });
                }}
                style={({ pressed }) => [
                  styles.weightUpdateBtn,
                  { backgroundColor: C.primary },
                  pressed && { opacity: 0.85 },
                ]}
                testID="balance-nudge-action"
              >
                <Text style={[styles.weightUpdateBtnText, { color: C.textInverse }]}>Train it</Text>
              </Pressable>
              <Pressable
                onPress={() => dismissBalanceNudge(Date.now())}
                hitSlop={10}
                style={styles.weightReminderDismiss}
                testID="balance-nudge-dismiss"
                accessibilityLabel="Dismiss"
                accessibilityRole="button"
              >
                <Ionicons name="close" size={16} color={C.textTertiary} />
              </Pressable>
            </Animated.View>
          )}
        </ScrollView>
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
        onRequestClose={() => setWeightModalOpen(false)}
      >
        <Pressable style={modalStyles.backdrop} onPress={() => setWeightModalOpen(false)} />
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
                <Text style={[modalStyles.resetBtnText, { color: C.primary }]}>Reset</Text>
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
                <Text style={{ fontFamily: 'Inter_600SemiBold', color: C.primary }}>
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
                      color={selected ? C.primary : C.textSecondary}
                    />
                    <View style={{ flex: 1 }}>
                      <Text
                        style={[modalStyles.tierLabel, { color: selected ? C.primary : C.text }]}
                      >
                        {getEquipmentLabel(tier)}
                      </Text>
                    </View>
                    {selected && <Ionicons name="checkmark-circle" size={20} color={C.primary} />}
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
    headerAvatarInitial: { fontSize: 15, fontFamily: 'Inter_700Bold', color: C.primary },
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
      color: C.primary,
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
    equipmentChipTextOverride: { color: C.primary, fontFamily: 'Inter_600SemiBold' },
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
    firstChoiceLabel: { fontSize: 15, fontFamily: 'Inter_700Bold', marginBottom: 2 },
    firstChoiceSub: { fontSize: 12, fontFamily: 'Inter_400Regular', color: C.textSecondary },

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
    calibrationCompleteTitle: { fontSize: 14, fontFamily: 'Inter_700Bold', color: C.primary },
    calibrationCompleteSub: {
      fontSize: 12,
      fontFamily: 'Inter_400Regular',
      color: C.textSecondary,
      marginTop: 1,
    },

    calibrationCard: {
      backgroundColor: C.surface,
      borderRadius: 14,
      padding: 14,
      borderWidth: 1,
      borderColor: C.border,
    },
    calibrationTop: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      gap: 6,
      marginBottom: 8,
    },
    calibrationTitle: {
      fontSize: 13,
      fontFamily: 'Inter_600SemiBold',
      color: C.textSecondary,
      flex: 1,
    },
    calibrationCount: { fontSize: 12, fontFamily: 'Inter_600SemiBold', color: C.primary },
    calibrationTrack: {
      height: 4,
      backgroundColor: C.primary + '22',
      borderRadius: 2,
      overflow: 'hidden' as const,
      marginBottom: 8,
    },
    calibrationFill: { height: 4, backgroundColor: C.primary, borderRadius: 2 },
    calibrationSub: { fontSize: 12, fontFamily: 'Inter_400Regular', color: C.textSecondary },

    weightReminderCard: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      gap: 10,
      backgroundColor: C.primarySurface,
      borderRadius: 14,
      paddingHorizontal: 12,
      paddingVertical: 12,
      borderWidth: 1,
      borderColor: C.primary + '30',
    },
    weightReminderIcon: {
      width: 36,
      height: 36,
      borderRadius: 10,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
      flexShrink: 0,
    },
    weightReminderTitle: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: C.text },
    weightReminderSub: {
      fontSize: 11,
      fontFamily: 'Inter_400Regular',
      color: C.textSecondary,
      marginTop: 1,
    },
    weightUpdateBtn: {
      borderRadius: 10,
      paddingHorizontal: 11,
      paddingVertical: 7,
      flexShrink: 0,
    },
    weightUpdateBtnText: { fontSize: 12, fontFamily: 'Inter_700Bold' },
    weightReminderDismiss: {
      width: 26,
      height: 26,
      borderRadius: 8,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
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
    deloadBanner: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      backgroundColor: 'rgba(124,110,240,0.08)',
      borderRadius: 14,
      borderWidth: 1,
      borderColor: 'rgba(124,110,240,0.20)',
      paddingHorizontal: 14,
      paddingVertical: 10,
      marginBottom: 10,
      gap: 8,
    },
    deloadBannerContent: {
      flex: 1,
      flexDirection: 'row' as const,
      alignItems: 'flex-start' as const,
      gap: 10,
    },
    deloadBannerTitle: {
      fontSize: 13,
      fontFamily: 'Inter_600SemiBold',
      marginBottom: 2,
    },
    deloadBannerSub: {
      fontSize: 12,
      fontFamily: 'Inter_400Regular',
    },
  });
}
