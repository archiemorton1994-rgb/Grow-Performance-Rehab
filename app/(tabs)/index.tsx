import React, { useMemo, useState, useEffect } from 'react';
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
import Svg, { Circle, G } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useColors } from '@/constants/colors';
import { SessionType, useAppStore, STRENGTH_SESSION_TYPES } from '@/lib/store';
import { getTimeOfDayGreeting, kgToDisplayUnit, displayUnitToKg, daysSince } from '@/lib/utils';
import { SESSION_META, getSessionColors, SessionMeta } from '@/lib/session-meta';
import { getEquipmentLabel, getEquipmentIcon, getEffectiveTier } from '@/lib/workout-engine';
import { scheduleBodyweightReminder, cancelBodyweightReminder } from '@/lib/notifications';

// ─── Weekly Progress Ring ─────────────────────────────────────────────────────
function WeeklyRing({
  count,
  goal,
  activeColor,
  trackColor,
  textColor,
  size = 56,
}: {
  count: number;
  goal: number;
  activeColor: string;
  trackColor: string;
  textColor: string;
  size?: number;
}) {
  const SIZE = size;
  const SW = 5;
  const radius = (SIZE - SW) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = goal > 0 ? Math.min(count / goal, 1) : 0;
  const offset = circumference * (1 - progress);
  const done = count >= goal;

  return (
    <View style={{ width: SIZE, height: SIZE, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={SIZE} height={SIZE} style={{ position: 'absolute' }}>
        <G rotation="-90" origin={`${SIZE / 2},${SIZE / 2}`}>
          <Circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={radius}
            stroke={trackColor}
            strokeWidth={SW}
            fill="none"
          />
          {progress > 0 && (
            <Circle
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={radius}
              stroke={activeColor}
              strokeWidth={SW}
              fill="none"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              strokeLinecap="round"
            />
          )}
        </G>
      </Svg>
      {done ? (
        <Ionicons name="checkmark" size={24} color={activeColor} />
      ) : (
        <Text
          style={{
            fontSize: 20,
            fontFamily: 'Inter_700Bold',
            color: textColor,
            textAlign: 'center',
          }}
        >
          {count}
        </Text>
      )}
    </View>
  );
}

function getContextMessageHome(
  completedCount: number,
  testWeekFrequency: number,
  testWeek: boolean
): string {
  if (completedCount === 0) return "Welcome to your program. Let's build something lasting.";
  if (testWeek) return "Test week is here - show yourself how far you've come.";
  const sessionsToTest = testWeekFrequency - (completedCount % testWeekFrequency);
  if (sessionsToTest <= 2) {
    const s = sessionsToTest === 1 ? 'session' : 'sessions';
    return `${sessionsToTest} ${s} until your next strength test - finish strong.`;
  }
  if (completedCount === 1) return 'First session in the books. The habit has begun.';
  const cycleSession = completedCount % 9;
  if (cycleSession === 0) return 'New cycle started. Each one builds on the last.';
  if (cycleSession >= 7) return 'Final stretch of this cycle - finish it strong.';
  if (completedCount < 6) return 'Early days - this is where the foundations are laid.';
  return 'Momentum is building. Every session moves the needle.';
}

const SESSION_IMAGES: Record<string, any> = {
  squat: require('@/assets/images/sessions/squat.png'),
  bench: require('@/assets/images/sessions/bench.png'),
  deadlift: require('@/assets/images/sessions/deadlift.png'),
  conditioning: require('@/assets/images/sessions/conditioning.png'),
  prehab: require('@/assets/images/sessions/targeted-prehab.png'),
  flexibility: require('@/assets/images/sessions/mobility.png'),
  custom: require('@/assets/images/sessions/custom.png'),
};

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
    isTestWeekDue,
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
  } = useAppStore();

  const isBeginnerExperience = userProfile?.experienceLevel === 'beginner';
  const ALL_TIERS = [
    'bodyweight',
    'bands',
    'dumbbells',
    'kettlebells',
    'barbell',
    'fullgym',
  ] as const;
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
  const testWeek = isTestWeekDue();
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

  const sessionsInBlock =
    !testWeek && strengthCount > 0 ? strengthCount % testWeekFrequency || testWeekFrequency : 0;
  const sessionsUntilTest = testWeekFrequency - sessionsInBlock;
  const showBlockProgress = strengthCount >= 1 && !testWeek;

  // ─── Your Program card computed values ─────────────────────────────────
  const progCycleNumber = Math.floor(strengthCount / 3) + 1;
  const programContextMsg = getContextMessageHome(strengthCount, testWeekFrequency, testWeek);

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

  return (
    <>
      <View
        style={[
          styles.container,
          {
            paddingTop: insets.top + webTopInset,
            paddingBottom: Platform.OS === 'web' ? 84 : tabBarHeight,
          },
        ]}
      >
        <View style={styles.inner}>
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
                <Text style={styles.testWeekPillText}>Test Week</Text>
              </View>
            )}
            <Pressable
              onPress={() => router.push('/(tabs)/profile')}
              style={({ pressed }) => [styles.headerAvatar, pressed && { opacity: 0.8 }]}
              testID="home-profile-avatar"
            >
              {profilePhotoUri ? (
                <Image source={{ uri: profilePhotoUri }} style={styles.headerAvatarImg} />
              ) : (
                <Text style={styles.headerAvatarInitial}>
                  {firstName ? firstName[0].toUpperCase() : '?'}
                </Text>
              )}
            </Pressable>
          </Animated.View>

          {/* Hero card - always the unified Today block (or first-session chooser for brand-new users) */}
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
                  <View
                    style={[
                      styles.firstChoiceIcon,
                      { backgroundColor: '#111111', overflow: 'hidden' },
                    ]}
                  >
                    <Image
                      source={SESSION_IMAGES[type]}
                      style={styles.firstChoiceImage}
                      resizeMode="cover"
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
                <View
                  style={[styles.todayIcon, { backgroundColor: '#111111', overflow: 'hidden' }]}
                >
                  <Image
                    source={SESSION_IMAGES[suggestedSession]}
                    style={styles.todayIconImage}
                    resizeMode="cover"
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
                <Ionicons
                  name={getEquipmentIcon(todayEffectiveTier) as any}
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
                <Ionicons name="flash" size={18} color="#000000" />
                <Text style={styles.startBtnText}>
                  {testWeek ? 'Start Strength Test' : 'Start Session'}
                </Text>
              </Pressable>
            </Animated.View>
          )}

          {/* Block progress — standalone slim row between hero card and stats strip */}
          {completedSessions.length > 0 && showBlockProgress && (
            <Animated.View entering={FadeInDown.delay(75).duration(380)} style={styles.blockRow}>
              <Ionicons name="stats-chart" size={12} color={C.textTertiary} />
              <View style={styles.blockBarTrack}>
                <View
                  style={[
                    styles.blockBarFill,
                    { width: `${Math.round((sessionsInBlock / testWeekFrequency) * 100)}%` as any },
                  ]}
                />
              </View>
              <Text
                style={[styles.blockProgressLabel, sessionsUntilTest <= 2 && { color: C.warning }]}
              >
                {sessionsUntilTest <= 2
                  ? `Test week in ${sessionsUntilTest} session${sessionsUntilTest !== 1 ? 's' : ''}`
                  : `Block ${sessionsInBlock} / ${testWeekFrequency}`}
              </Text>
            </Animated.View>
          )}

          {/* Summary cards — 2×2 grid */}
          <Animated.View entering={FadeInDown.delay(120).duration(380)} style={styles.summaryGrid}>
            {/* Week Streak */}
            <View style={styles.summaryCard}>
              <View style={styles.summaryIconBox}>
                <WeeklyRing
                  count={streak}
                  goal={4}
                  activeColor={streak > 0 ? C.primary : 'transparent'}
                  trackColor="rgba(255,255,255,0.08)"
                  textColor={C.text}
                  size={72}
                />
              </View>
              <Text style={styles.summaryCardTitle}>WEEK STREAK</Text>
              <Text style={styles.summaryCardSub}>
                {streak > 0 ? 'Keep it going' : 'Get started'}
              </Text>
            </View>

            {/* This Week */}
            <Pressable
              style={styles.summaryCard}
              onPress={() => {
                if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push('/(tabs)/workouts');
              }}
              testID="weekly-ring-tap"
            >
              <View style={styles.summaryIconBox}>
                <WeeklyRing
                  count={weekCount}
                  goal={goal}
                  activeColor={weekCount >= goal ? (C.success ?? C.primary) : C.primary}
                  trackColor="rgba(255,255,255,0.08)"
                  textColor={C.text}
                  size={72}
                />
              </View>
              <Text style={styles.summaryCardTitle}>THIS WEEK</Text>
              <Text style={styles.summaryCardSub}>
                {weekCount} Workout{weekCount !== 1 ? 's' : ''}
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
              <View style={styles.summaryIconBox}>
                <Ionicons name="barbell" size={36} color={C.textSecondary} />
                <Text style={styles.summaryBigNum}>{completedSessions.length}</Text>
              </View>
              <Text style={styles.summaryCardTitle}>TOTAL</Text>
              <Text style={styles.summaryCardSub}>Workouts</Text>
            </Pressable>

            {/* Achievements */}
            <Pressable
              style={styles.summaryCard}
              onPress={() => {
                if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push('/(tabs)/profile');
              }}
              testID="summary-achievements"
            >
              <View style={styles.summaryIconBox}>
                <Ionicons name="trophy" size={36} color={C.warning} />
                <Text style={styles.summaryBigNum}>{earnedBadges.length}</Text>
              </View>
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
              >
                <Ionicons name="close" size={16} color={C.textTertiary} />
              </Pressable>
            </Animated.View>
          ) : milestoneHit !== null ? (
            <Animated.View
              entering={FadeInDown.delay(180).duration(380)}
              style={styles.milestoneCard}
            >
              <View style={styles.milestoneIcon}>
                <Ionicons name="trophy" size={20} color={C.warning} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.milestoneTitle}>{milestoneHit} sessions completed</Text>
                <Text style={styles.milestoneSub}>
                  You just unlocked a new milestone - keep it going.
                </Text>
              </View>
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
              >
                <Ionicons name="close" size={16} color={C.textTertiary} />
              </Pressable>
            </Animated.View>
          )}

          {/* Your Program — slim nav row; play pill starts today's session in one tap */}
          {strengthCount > 0 && (
            <Animated.View
              entering={FadeInDown.delay(250).duration(380)}
              style={styles.programCard}
            >
              <Pressable
                onPress={() => {
                  if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  router.push('/program');
                }}
                testID="home-program-card"
              >
                <View style={styles.programCardHeaderRow}>
                  <View style={styles.programCardLeft}>
                    <Ionicons name="podium-outline" size={15} color={C.primary} />
                    <Text style={styles.programCardTitle}>Your Program</Text>
                    <View style={styles.programCycleBadge}>
                      <Text style={styles.programCycleBadgeText}>Cycle {progCycleNumber}</Text>
                    </View>
                  </View>
                  {!activeSession ? (
                    <Pressable
                      onPress={(e) => {
                        e.stopPropagation();
                        if (Platform.OS !== 'web')
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                        handleStartSuggested();
                      }}
                      style={styles.programPlayPill}
                      hitSlop={8}
                      testID="home-program-play"
                    >
                      <Ionicons name="play" size={13} color={C.textInverse} />
                    </Pressable>
                  ) : (
                    <Ionicons name="chevron-forward" size={15} color={C.textTertiary} />
                  )}
                </View>
                <Text style={styles.programCardSummary}>{programContextMsg}</Text>
              </Pressable>
            </Animated.View>
          )}

          {/* Achievements — gold row, always at the bottom of the feed */}
          <Animated.View entering={FadeInDown.delay(270).duration(380)}>
            <Pressable
              onPress={() => {
                if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push('/achievements');
              }}
              style={({ pressed }) => [styles.achievementsRow, pressed && { opacity: 0.8 }]}
              testID="home-achievements-row"
            >
              <View style={styles.achievementsIconWrap}>
                <Ionicons name="trophy" size={15} color={C.achievementGold} />
              </View>
              <Text style={styles.achievementsLabel}>Achievements</Text>
              {earnedBadges.length > 0 && (
                <View style={styles.badgeCountChip}>
                  <Text style={styles.badgeCountChipText}>{earnedBadges.length}</Text>
                </View>
              )}
              <Ionicons name="chevron-forward" size={14} color={C.achievementGold + '88'} />
            </Pressable>
          </Animated.View>
        </View>
      </View>

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
            {(
              ['bodyweight', 'bands', 'dumbbells', 'kettlebells', 'barbell', 'fullgym'] as const
            ).map((tier) => {
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
                  <Ionicons
                    name={getEquipmentIcon(tier) as any}
                    size={20}
                    color={selected ? C.primary : C.textSecondary}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={[modalStyles.tierLabel, { color: selected ? C.primary : C.text }]}>
                      {getEquipmentLabel(tier)}
                    </Text>
                  </View>
                  {selected && <Ionicons name="checkmark-circle" size={20} color={C.primary} />}
                  {locked && (
                    <Ionicons name="lock-closed-outline" size={16} color={C.textTertiary} />
                  )}
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
    inner: { flex: 1, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12, gap: 16 },

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
      shadowColor: C.shadow,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.18,
      shadowRadius: 14,
      elevation: Platform.OS !== 'web' ? 5 : 0,
    },
    todayCardTop: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 18 },
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
      width: 64,
      height: 64,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      marginLeft: 12,
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
    startBtnText: { fontSize: 16, fontFamily: 'Inter_700Bold', color: '#000000' },

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
      padding: 16,
      alignItems: 'center' as const,
      borderWidth: 1,
      borderColor: C.borderLight,
      gap: 6,
    },
    summaryIconBox: {
      width: 88,
      height: 88,
      borderRadius: 22,
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

    achievementsRow: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      gap: 10,
      backgroundColor: C.achievementGoldBg,
      borderRadius: 14,
      paddingHorizontal: 14,
      paddingVertical: 13,
      borderWidth: 1,
      borderColor: C.achievementGoldBorder,
    },
    achievementsIconWrap: {
      width: 30,
      height: 30,
      borderRadius: 8,
      backgroundColor: C.achievementGoldMuted,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
    },
    achievementsLabel: {
      flex: 1,
      fontSize: 14,
      fontFamily: 'Inter_600SemiBold',
      color: C.achievementGold,
    },
    badgeCountChip: {
      backgroundColor: C.achievementGoldMuted,
      borderRadius: 10,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderWidth: 1,
      borderColor: C.achievementGoldBorder,
    },
    badgeCountChipText: { fontSize: 11, fontFamily: 'Inter_600SemiBold', color: C.achievementGold },

    // ─── Your Program card ─────────────────────────────────────────────────
    programCard: {
      backgroundColor: C.surface,
      borderRadius: 16,
      padding: 16,
      borderWidth: 1,
      borderColor: C.borderLight,
    },
    programCardHeaderRow: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      justifyContent: 'space-between' as const,
    },
    programCardLeft: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      gap: 8,
    },
    programCardTitle: { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: C.text },
    programCycleBadge: {
      backgroundColor: C.primaryMuted,
      borderRadius: 10,
      paddingHorizontal: 8,
      paddingVertical: 3,
    },
    programCycleBadgeText: { fontSize: 11, fontFamily: 'Inter_600SemiBold', color: C.primary },
    programCardSummary: {
      fontSize: 12,
      fontFamily: 'Inter_400Regular',
      color: C.textSecondary,
      marginTop: 6,
    },
    programPlayPill: {
      width: 30,
      height: 30,
      borderRadius: 15,
      backgroundColor: C.primary,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
    },
  });
}
