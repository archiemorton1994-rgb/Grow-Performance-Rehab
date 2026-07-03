import React, { useMemo, useState, useEffect, useRef } from 'react';
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
import Svg, { Circle, G } from 'react-native-svg';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, {
  FadeInDown,
  useSharedValue,
  useAnimatedStyle,
  withSequence,
  withTiming,
  withDelay,
} from 'react-native-reanimated';
import { useColors } from '@/constants/colors';
import { SessionType, useAppStore, STRENGTH_SESSION_TYPES } from '@/lib/store';
import { getTimeOfDayGreeting, kgToDisplayUnit, displayUnitToKg } from '@/lib/utils';
import { SESSION_META, getSessionColors, SessionMeta, SessionColorPair } from '@/lib/session-meta';
import { getEquipmentLabel, getEquipmentIcon, getEffectiveTier } from '@/lib/workout-engine';
import { scheduleBodyweightReminder, cancelBodyweightReminder } from '@/lib/notifications';
import { BADGE_MAP, Badge } from '@/lib/badges';

// ─── Weekly Progress Ring ─────────────────────────────────────────────────────
function WeeklyRing({
  count, goal, activeColor, trackColor, textColor,
}: { count: number; goal: number; activeColor: string; trackColor: string; textColor: string }) {
  const SIZE = 70;
  const SW = 6;
  const radius = (SIZE - SW) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = goal > 0 ? Math.min(count / goal, 1) : 0;
  const offset = circumference * (1 - progress);
  const done = count >= goal;

  return (
    <View style={{ width: SIZE, height: SIZE, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={SIZE} height={SIZE} style={{ position: 'absolute' }}>
        <G rotation="-90" origin={`${SIZE / 2},${SIZE / 2}`}>
          <Circle cx={SIZE / 2} cy={SIZE / 2} r={radius} stroke={trackColor} strokeWidth={SW} fill="none" />
          {progress > 0 && (
            <Circle
              cx={SIZE / 2} cy={SIZE / 2} r={radius}
              stroke={activeColor} strokeWidth={SW} fill="none"
              strokeDasharray={circumference} strokeDashoffset={offset}
              strokeLinecap="round"
            />
          )}
        </G>
      </Svg>
      {done ? (
        <Ionicons name="checkmark" size={24} color={activeColor} />
      ) : (
        <Text style={{ fontSize: 20, fontFamily: 'Inter_700Bold', color: textColor, textAlign: 'center' }}>
          {count}
        </Text>
      )}
    </View>
  );
}

// ─── Weekly Session Dots ──────────────────────────────────────────────────────
const WEEK_DAY_LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

// Priority order for picking the dominant session colour on multi-session days
const SESSION_TYPE_PRIORITY: SessionType[] = [
  'squat', 'bench', 'deadlift', 'conditioning', 'prehab', 'flexibility', 'custom',
];

function WeekDots({
  completedSessions,
  sessionColors,
  emptyColor,
}: {
  completedSessions: { date: string; sessionType: SessionType }[];
  sessionColors: Record<SessionType, SessionColorPair>;
  emptyColor: string;
}) {
  // Map day index (0=Mon … 6=Sun) → dominant session type for that day
  const daySessionMap = useMemo(() => {
    const now = new Date();
    const dow = now.getDay();
    const mondayOffset = dow === 0 ? -6 : 1 - dow;
    const monday = new Date(now);
    monday.setDate(now.getDate() + mondayOffset);
    monday.setHours(0, 0, 0, 0);

    const result = new Map<number, SessionType>();
    for (const s of completedSessions) {
      const d = new Date(s.date);
      d.setHours(0, 0, 0, 0);
      const diff = Math.floor((d.getTime() - monday.getTime()) / 86400000);
      if (diff < 0 || diff > 6) continue;
      const existing = result.get(diff);
      if (!existing) {
        result.set(diff, s.sessionType);
      } else {
        // Keep the higher-priority type
        const existingPri = SESSION_TYPE_PRIORITY.indexOf(existing);
        const newPri = SESSION_TYPE_PRIORITY.indexOf(s.sessionType);
        if (newPri < existingPri) result.set(diff, s.sessionType);
      }
    }
    return result;
  }, [completedSessions]);

  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
      {WEEK_DAY_LETTERS.map((letter, i) => {
        const sessionType = daySessionMap.get(i);
        const dotColor = sessionType ? sessionColors[sessionType].color : emptyColor;
        return (
          <View key={i} style={{ alignItems: 'center', gap: 5 }}>
            <Text style={{ fontSize: 10, fontFamily: 'Inter_500Medium', color: emptyColor }}>{letter}</Text>
            <View style={{
              width: 8, height: 8, borderRadius: 4,
              backgroundColor: dotColor,
            }} />
          </View>
        );
      })}
    </View>
  );
}

// ─── Animated Badge Dot ───────────────────────────────────────────────────────
function AnimatedBadgeDot({ badge, animate }: { badge: Badge; animate: boolean }) {
  const scale = useSharedValue(1);
  const glowOpacity = useSharedValue(0);

  useEffect(() => {
    if (!animate) return;
    scale.value = withSequence(
      withTiming(0.6, { duration: 80 }),
      withTiming(1.2, { duration: 200 }),
      withTiming(1.0, { duration: 160 }),
    );
    glowOpacity.value = withSequence(
      withTiming(1, { duration: 120 }),
      withDelay(320, withTiming(0, { duration: 220 })),
    );
  }, [animate]);

  const dotAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const glowAnimStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
  }));

  return (
    <Animated.View style={dotAnimStyle}>
      <View style={{
        width: 26, height: 26, borderRadius: 8,
        alignItems: 'center', justifyContent: 'center', borderWidth: 1,
        backgroundColor: badge.color + '22', borderColor: badge.color + '55',
      }}>
        <Ionicons name={badge.icon as any} size={12} color={badge.color} />
      </View>
      <Animated.View
        pointerEvents="none"
        style={[{
          position: 'absolute', top: -3, left: -3, right: -3, bottom: -3,
          borderRadius: 10, borderWidth: 2, borderColor: badge.color,
        }, glowAnimStyle]}
      />
    </Animated.View>
  );
}

// Muscle-group → session type mapping for the freshness strip
const MUSCLE_GROUPS: { key: string; label: string; sessions: SessionType[] }[] = [
  { key: 'legs',      label: 'Legs',      sessions: ['squat'] },
  { key: 'push',      label: 'Push',      sessions: ['bench'] },
  { key: 'pull',      label: 'Pull',      sessions: ['deadlift'] },
  { key: 'core',      label: 'Core',      sessions: ['prehab', 'flexibility'] },
  { key: 'fullbody',  label: 'Full Body', sessions: ['conditioning'] },
];

const SESSION_IMAGES: Record<string, any> = {
  squat:        require('@/assets/images/sessions/lower-body.png'),
  bench:        require('@/assets/images/sessions/upper-body.png'),
  deadlift:     require('@/assets/images/sessions/full-body.png'),
  conditioning: require('@/assets/images/sessions/conditioning.png'),
  prehab:       require('@/assets/images/sessions/targeted-prehab.png'),
  flexibility:  require('@/assets/images/sessions/mobility.png'),
  custom:       require('@/assets/images/sessions/custom.png'),
};



export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const C = useColors();
  const tabBarHeight = insets.bottom + 50;
  const {
    getEffectiveTier: storeGetEffectiveTier,
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
    getBestORM,
    oneRepMaxes,
    weightUnit,
    equipmentTiers,
    sessionEquipmentOverride,
    setSessionEquipmentOverride,
    clearSessionEquipmentOverride,
    bodyweightUpdatedAt,
    setWeightReminderSnoozedAt,
    bodyweightReminderEnabled,
    earnedBadges,
  } = useAppStore();

  // ─── Badge animation tracking ────────────────────────────────────────────
  const prevBadgeCountRef = useRef(earnedBadges.length);
  const [animatingBadgeId, setAnimatingBadgeId] = useState<string | null>(null);

  useEffect(() => {
    if (earnedBadges.length > prevBadgeCountRef.current) {
      const newestId = earnedBadges[earnedBadges.length - 1] ?? null;
      prevBadgeCountRef.current = earnedBadges.length;
      if (newestId) {
        setAnimatingBadgeId(newestId);
        const t = setTimeout(() => setAnimatingBadgeId(null), 800);
        return () => clearTimeout(t);
      }
    } else {
      prevBadgeCountRef.current = earnedBadges.length;
    }
  }, [earnedBadges.length]);
  // ─────────────────────────────────────────────────────────────────────────

  const isBeginnerExperience = userProfile?.experienceLevel === 'beginner';
  const ALL_TIERS = ['bodyweight', 'bands', 'dumbbells', 'kettlebells', 'barbell', 'fullgym'] as const;
  const availableTiers = isBeginnerExperience
    ? (['bodyweight', 'bands'] as const)
    : ALL_TIERS;

  const profileEquipment = (equipmentTiers && equipmentTiers.length > 0) ? equipmentTiers : ['bodyweight' as const];
  const todayTiers = sessionEquipmentOverride ?? profileEquipment;
  const todayEffectiveTier = getEffectiveTier(todayTiers);

  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetDraft, setSheetDraft] = useState<typeof ALL_TIERS[number][]>([]);

  const openEquipmentSheet = () => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSheetDraft([...todayTiers]);
    setSheetOpen(true);
  };

  const handleDraftToggle = (tier: typeof ALL_TIERS[number]) => {
    if (!(availableTiers as readonly string[]).includes(tier)) return;
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSheetDraft((prev) => {
      if (tier === 'fullgym') {
        return prev.includes('fullgym') ? prev.filter(t => t !== 'fullgym') : [...ALL_TIERS];
      }
      if (prev.includes(tier)) {
        const next = prev.filter(t => t !== tier && t !== 'fullgym');
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

  const effectiveTier = storeGetEffectiveTier();
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
    const startOfToday = new Date(); startOfToday.setHours(0, 0, 0, 0);
    const startOfLast = new Date(lastSession.date); startOfLast.setHours(0, 0, 0, 0);
    return Math.floor((startOfToday.getTime() - startOfLast.getTime()) / 86400000);
  }, [lastSession]);

  const lastSessionRelativeLabel =
    daysSinceLast === null ? null
    : daysSinceLast <= 0 ? 'today'
    : daysSinceLast === 1 ? 'yesterday'
    : `${daysSinceLast} days ago`;

  const MILESTONE_VALUES = [1, 5, 10, 25, 50, 100, 150, 200];
  const milestoneHit =
    lastSession && daysSinceLast !== null && daysSinceLast <= 1
    && MILESTONE_VALUES.includes(completedSessions.length)
      ? completedSessions.length
      : null;

  const calibrationComplete =
    completedSessions.length === 3
    && daysSinceLast !== null && daysSinceLast <= 1;

  // Warn when the user has an established streak but this week's sessions
  // haven't hit the goal yet. Only show from Wednesday onwards to avoid
  // alarming people who simply haven't trained early in the week.
  const goal = weeklyStreakGoal ?? 2;
  const missedStreakWarning =
    completedSessions.length >= 3
    && streak > 0
    && weekCount < goal
    && new Date().getDay() >= 3;

  const SESSION_TYPE_META = useMemo(() => {
    const colors = getSessionColors(C);
    const result = {} as Record<SessionType, SessionMeta & SessionColorPair>;
    (Object.keys(SESSION_META) as SessionType[]).forEach(type => {
      result[type] = { ...SESSION_META[type], ...colors[type] };
    });
    return result;
  }, [C]);

  const suggestedMeta = SESSION_TYPE_META[suggestedSession];

  const strengthCount = useMemo(
    () => completedSessions.filter(s => STRENGTH_SESSION_TYPES.includes(s.sessionType)).length,
    [completedSessions],
  );

  const sessionsInBlock = !testWeek && strengthCount > 0
    ? (strengthCount % testWeekFrequency || testWeekFrequency)
    : 0;
  const sessionsUntilTest = testWeekFrequency - sessionsInBlock;
  const showBlockProgress = strengthCount >= 1 && !testWeek;

  const { topLift, ormGain } = useMemo(() => {
    const lifts: SessionType[] = ['squat', 'deadlift', 'bench'];
    let bestLift: SessionType | null = null;
    let bestWeight = 0;
    for (const lift of lifts) {
      const orm = getBestORM(lift);
      if (orm && orm.weight > bestWeight) { bestWeight = orm.weight; bestLift = lift; }
    }
    if (!bestLift) return { topLift: null, ormGain: 0 };
    const firstWeight = oneRepMaxes.filter(o => o.lift === bestLift).at(-1)?.weight ?? null;
    return {
      topLift: { lift: bestLift as SessionType, weight: bestWeight },
      ormGain: firstWeight && firstWeight < bestWeight ? Math.round(bestWeight - firstWeight) : 0,
    };
  }, [oneRepMaxes, getBestORM]);

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
    const displayVal = userProfile.bodyweightKg > 0
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

  // Days since each muscle group was last trained (newest session wins per group)
  const muscleFreshness = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    return MUSCLE_GROUPS.map((group) => {
      const last = completedSessions.find((s) => group.sessions.includes(s.sessionType));
      if (!last) return { ...group, days: null };
      const d = new Date(last.date); d.setHours(0, 0, 0, 0);
      const days = Math.floor((today.getTime() - d.getTime()) / 86400000);
      return { ...group, days };
    });
  }, [completedSessions]);

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
          onPress: () => { clearActiveSession(); onContinue(); },
        },
      ]
    );
  };

  const handleStartSuggested = () => {
    const go = () => {
      if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const equipmentOverrideParam = sessionEquipmentOverride ? JSON.stringify(sessionEquipmentOverride) : undefined;
      router.push({
        pathname: '/readiness',
        params: { sessionType: suggestedSession, isTestWeek: testWeek ? 'true' : 'false', equipmentOverride: equipmentOverrideParam },
      });
    };
    if (activeSession) { confirmReplaceActive(go); return; }
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
    if (activeSession) { confirmReplaceActive(go); return; }
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
      },
    });
  };

  const handleDiscardActiveSession = () => {
    Alert.alert(
      'Discard session?',
      'Your in-progress session will be lost.',
      [
        { text: 'Keep it', style: 'cancel' },
        { text: 'Discard', style: 'destructive', onPress: () => clearActiveSession() },
      ]
    );
  };

  const lastSessionDurationLabel = lastSession?.durationSeconds && lastSession.durationSeconds > 0
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
            <Text style={styles.greetingText} numberOfLines={1}>{greetingText}</Text>
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
            {([
              { type: 'squat' as const, label: 'Lower Body', sub: 'Quads · Glutes · Hamstrings', color: C.primary, bg: C.primaryMuted },
              { type: 'bench' as const, label: 'Upper Body', sub: 'Chest · Shoulders · Triceps', color: C.badgeVolumeText, bg: C.badgeVolume },
              { type: 'deadlift' as const, label: 'Full Body', sub: 'Back · Hips · Legs', color: C.categoryNeuroText, bg: C.categoryNeuro },
            ] as const).map(({ type, label, sub, color, bg }) => (
              <Pressable
                key={type}
                onPress={() => handleFirstSessionChoice(type)}
                style={({ pressed }) => [styles.firstChoiceRow, pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] }]}
                testID={`first-session-${type}`}
              >
                <View style={[styles.firstChoiceIcon, { backgroundColor: bg }]}>
                  <Image source={SESSION_IMAGES[type]} style={styles.firstChoiceImage} resizeMode="contain" />
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
          <Animated.View entering={FadeInDown.delay(60).duration(380)} style={[styles.todayCard, { backgroundColor: 'transparent', overflow: 'hidden' }]}>
            <LinearGradient
              colors={[suggestedMeta.bg, C.surface]}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
              style={StyleSheet.absoluteFillObject}
            />
            <View style={styles.todayCardTop}>
              <View style={{ flex: 1 }}>
                <Text style={styles.todayLabel}>Today</Text>
                <Text style={styles.todaySessionName}>{suggestedMeta.label}</Text>
                <Text style={styles.todaySessionSub}>{suggestedMeta.subtitle}</Text>
              </View>
              <View style={[styles.todayIcon, { backgroundColor: suggestedMeta.bg }]}>
                <Image source={SESSION_IMAGES[suggestedSession]} style={styles.todayIconImage} resizeMode="contain" />
              </View>
            </View>
            {lastSession && lastSessionRelativeLabel && (
              <Text style={styles.lastInline}>
                You last did {SESSION_TYPE_META[lastSession.sessionType].label.toLowerCase()} {lastSessionRelativeLabel}
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
              <Text style={[styles.equipmentChipText, sessionEquipmentOverride !== null && styles.equipmentChipTextOverride]}>
                {sessionEquipmentOverride !== null ? 'Today: ' : ''}{getEquipmentLabel(todayEffectiveTier)}
              </Text>
              {sessionEquipmentOverride !== null && <View style={styles.overrideDot} />}
              <Ionicons name="chevron-down" size={12} color={sessionEquipmentOverride !== null ? C.primary : C.textTertiary} />
            </Pressable>
            <Pressable
              onPress={handleStartSuggested}
              style={({ pressed }) => [styles.startBtn, pressed && { opacity: 0.88, transform: [{ scale: 0.98 }] }]}
              testID="start-suggested-session"
            >
              <Ionicons name="flash" size={18} color={C.textInverse} />
              <Text style={styles.startBtnText}>{testWeek ? 'Start Strength Test' : 'Start Session'}</Text>
            </Pressable>
          </Animated.View>
        )}

        {/* Block progress — standalone slim row between hero card and freshness chips */}
        {completedSessions.length > 0 && showBlockProgress && (
          <Animated.View entering={FadeInDown.delay(75).duration(380)} style={styles.blockRow}>
            <Ionicons name="stats-chart" size={12} color={C.textTertiary} />
            <View style={styles.blockBarTrack}>
              <View style={[styles.blockBarFill, { width: `${Math.round((sessionsInBlock / testWeekFrequency) * 100)}%` as any }]} />
            </View>
            <Text style={[styles.blockProgressLabel, sessionsUntilTest <= 2 && { color: C.warning }]}>
              {sessionsUntilTest <= 2
                ? `Test week in ${sessionsUntilTest} session${sessionsUntilTest !== 1 ? 's' : ''}`
                : `Block ${sessionsInBlock} / ${testWeekFrequency}`}
            </Text>
          </Animated.View>
        )}

        {/* Muscle freshness strip — only once there are sessions to compute from */}
        {completedSessions.length > 0 && (
          <Animated.View entering={FadeInDown.delay(90).duration(380)}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.freshnessRow}
            >
              {muscleFreshness.map(({ key, label, days }) => {
                const readySoon = days === 2;
                const recovering = days !== null && days <= 1;
                const chipBg = recovering ? C.errorLight : readySoon ? C.warningLight : C.primaryMuted;
                const chipColor = recovering ? C.error : readySoon ? C.warning : C.primary;
                const dayLabel = days === null ? 'Fresh'
                  : days === 0 ? 'Today'
                  : `${days}d`;
                return (
                  <View key={key} style={[styles.freshnessChip, { backgroundColor: chipBg }]}>
                    <View style={[styles.freshnessDot, { backgroundColor: chipColor }]} />
                    <Text style={[styles.freshnessLabel, { color: chipColor }]}>{label}</Text>
                    <Text style={[styles.freshnessDays, { color: chipColor }]}>· {dayLabel}</Text>
                  </View>
                );
              })}
            </ScrollView>
          </Animated.View>
        )}

        {/* Stats strip - always visible */}
        <Animated.View entering={FadeInDown.delay(120).duration(380)} style={styles.statsStrip}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{streak}</Text>
            <Text style={styles.statLabel}>Week Streak</Text>
          </View>
          <View style={styles.statDivider} />
          <Pressable
            style={styles.statItem}
            onPress={() => {
              if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.push('/(tabs)/workouts');
            }}
            testID="weekly-ring-tap"
          >
            <WeeklyRing
              count={weekCount}
              goal={goal}
              activeColor={weekCount >= goal ? C.success ?? C.primary : C.primary}
              trackColor={C.borderLight}
              textColor={C.text}
            />
            <Text style={[styles.statLabel, { marginTop: 4 }]}>
              {weekCount >= goal ? 'Goal Hit ✓' : 'This Week'}
            </Text>
          </Pressable>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{completedSessions.length}</Text>
            <Text style={styles.statLabel}>Total</Text>
          </View>
        </Animated.View>

        {/* Weekly session dots — which days this week had a session */}
        {completedSessions.length > 0 && (
          <Animated.View entering={FadeInDown.delay(130).duration(380)} style={styles.weekDotsRow}>
            <WeekDots
              completedSessions={completedSessions}
              sessionColors={getSessionColors(C)}
              emptyColor={C.borderLight}
            />
          </Animated.View>
        )}

        {/* Achievements strip — always visible so users can browse locked badges too */}
        <Animated.View entering={FadeInDown.delay(140).duration(380)}>
          <Pressable
            onPress={() => {
              if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.push('/achievements');
            }}
            style={({ pressed }) => [styles.achievementsRow, pressed && { opacity: 0.8 }]}
            testID="home-achievements-row"
          >
            <View style={styles.achievementsIcons}>
              {earnedBadges.length > 0 ? (
                <>
                  {[...earnedBadges].reverse().slice(0, 5).map((id, idx, arr) => {
                    const badge = BADGE_MAP.get(id);
                    if (!badge) return null;
                    const isLast = idx === arr.length - 1;
                    const showCount = isLast && earnedBadges.length > 5;
                    return (
                      <View key={id} style={{ position: 'relative' }}>
                        <AnimatedBadgeDot badge={badge} animate={id === animatingBadgeId} />
                        {showCount && (
                          <View style={styles.badgeCountBubble}>
                            <Text style={styles.badgeCountText}>{earnedBadges.length}</Text>
                          </View>
                        )}
                      </View>
                    );
                  })}
                </>
              ) : (
                <View style={[styles.achievementsDot, { backgroundColor: C.surfaceSecondary, borderColor: C.borderLight }]}>
                  <Ionicons name="trophy-outline" size={12} color={C.textTertiary} />
                </View>
              )}
            </View>
            <Text style={styles.achievementsSeeAll}>
              {earnedBadges.length === 0 ? 'Earn your first badge' : 'See all'}
            </Text>
            <Ionicons name="chevron-forward" size={14} color={C.textTertiary} />
          </Pressable>
        </Animated.View>

        {/* Strength progress insight - compact pill chip */}
        {topLift && completedSessions.length > 0 && (
          <Animated.View entering={FadeInDown.delay(150).duration(380)}>
            <View style={styles.strengthInsightPill}>
              <Ionicons name="barbell-outline" size={13} color={C.primary} />
              <Text style={styles.insightLiftLabel}>
                {topLift.lift.charAt(0).toUpperCase() + topLift.lift.slice(1)} 1RM
              </Text>
              <Text style={styles.insightLiftValue}>
                {kgToDisplayUnit(topLift.weight, weightUnit)} {weightUnit}
              </Text>
              {ormGain > 0 && (
                <View style={styles.gainBadge}>
                  <Ionicons name="trending-up" size={10} color={C.primary} />
                  <Text style={styles.gainBadgeText}>+{kgToDisplayUnit(ormGain, weightUnit)}{weightUnit}</Text>
                </View>
              )}
            </View>
          </Animated.View>
        )}

        {/* Secondary actionable card - priority: resume > milestone > broken streak (mutually exclusive) */}
        {activeSession ? (
          <Animated.View entering={FadeInDown.delay(180).duration(380)} style={styles.resumeSecondary}>
            <View style={styles.resumeIcon}>
              <Ionicons name="time-outline" size={20} color={C.warning} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.resumeTitle}>Session in progress</Text>
              <Text style={styles.resumeSub}>
                {SESSION_META[activeSession.sessionType]?.label ?? activeSession.sessionName} · {activeSession.completedSetsCount}/{activeSession.totalSets} sets
              </Text>
            </View>
            <Pressable
              onPress={handleResume}
              style={({ pressed }) => [styles.resumeBtnSm, pressed && { opacity: 0.85, transform: [{ scale: 0.97 }] }]}
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
          <Animated.View entering={FadeInDown.delay(180).duration(380)} style={styles.milestoneCard}>
            <View style={styles.milestoneIcon}>
              <Ionicons name="trophy" size={20} color={C.warning} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.milestoneTitle}>{milestoneHit} sessions completed</Text>
              <Text style={styles.milestoneSub}>You just unlocked a new milestone - keep it going.</Text>
            </View>
          </Animated.View>
        ) : calibrationComplete ? (
          <Animated.View entering={FadeInDown.delay(180).duration(380)} style={styles.calibrationCompleteCard}>
            <View style={styles.calibrationCompleteIcon}>
              <Ionicons name="checkmark-circle" size={20} color={C.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.calibrationCompleteTitle}>You're all set</Text>
              <Text style={styles.calibrationCompleteSub}>Sessions are now fully personalised to you.</Text>
            </View>
          </Animated.View>
        ) : missedStreakWarning ? (
          <Animated.View entering={FadeInDown.delay(180).duration(380)} style={styles.warningCard}>
            <View style={styles.warningIcon}>
              <Ionicons name="alarm-outline" size={20} color={C.warning} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.warningTitle}>Streak at risk this week</Text>
              <Text style={styles.warningSub}>
                {weekCount === 0
                  ? `No sessions yet this week — hit ${goal} to keep your streak going.`
                  : `${weekCount}/${goal} sessions this week — ${goal - weekCount} more to keep your streak alive.`}
              </Text>
            </View>
          </Animated.View>
        ) : null}

        {/* Calibration progress — visible after sessions 1 and 2 only (suppressed when a higher-priority banner shows) */}
        {completedSessions.length >= 1 && completedSessions.length < 3 && !activeSession && milestoneHit === null && (
          <Animated.View entering={FadeInDown.delay(210).duration(380)} style={styles.calibrationCard}>
            <View style={styles.calibrationTop}>
              <Ionicons name="analytics-outline" size={14} color={C.primary} />
              <Text style={styles.calibrationTitle}>Getting to know you</Text>
              <Text style={styles.calibrationCount}>{completedSessions.length} / 3</Text>
            </View>
            <View style={styles.calibrationTrack}>
              <View style={[styles.calibrationFill, { width: `${Math.round((completedSessions.length / 3) * 100)}%` as any }]} />
            </View>
            <Text style={styles.calibrationSub}>
              Complete your first 3 sessions to unlock fully personalised programming.
            </Text>
          </Animated.View>
        )}

        {/* Bodyweight reminder */}
        {showWeightReminder && (
          <Animated.View entering={FadeInDown.delay(240).duration(380)} style={styles.weightReminderCard}>
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
              style={({ pressed }) => [styles.weightUpdateBtn, { backgroundColor: C.primary }, pressed && { opacity: 0.85 }]}
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
          <View style={[modalStyles.sheet, { paddingBottom: insets.bottom + 20, backgroundColor: C.surface }]}>
            <View style={modalStyles.handle} />
            <Text style={[modalStyles.sheetTitle, { color: C.text }]}>Update Bodyweight</Text>
            <Text style={[modalStyles.sheetSubtitle, { color: C.textSecondary, marginBottom: 20, marginTop: 4 }]}>
              Accurate bodyweight improves suggested loads for every session.
            </Text>
            <View style={styles.weightInputRow}>
              <TextInput
                style={[styles.weightInput, { borderColor: C.border, color: C.text, backgroundColor: C.surfaceSecondary }]}
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
              style={({ pressed }) => [modalStyles.confirmBtn, { backgroundColor: C.primary }, pressed && { opacity: 0.88 }]}
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
        <View style={[modalStyles.sheet, { paddingBottom: insets.bottom + 16, backgroundColor: C.surface }]}>
          <View style={modalStyles.handle} />
          <View style={modalStyles.sheetHeader}>
            <View>
              <Text style={[modalStyles.sheetTitle, { color: C.text }]}>Equipment today</Text>
              <Text style={[modalStyles.sheetSubtitle, { color: C.textSecondary }]}>This only affects the current session</Text>
            </View>
            {sessionEquipmentOverride !== null && (
              <Pressable onPress={resetEquipmentToProfile} style={[modalStyles.resetBtn, { backgroundColor: C.primaryMuted, borderColor: C.primary + '40' }]}>
                <Text style={[modalStyles.resetBtnText, { color: C.primary }]}>Reset</Text>
              </Pressable>
            )}
          </View>
          {sheetDraft.length > 0 && (
            <View style={[modalStyles.bestMatchRow, { backgroundColor: C.primaryMuted, borderColor: C.primary + '22' }]}>
              <Text style={[modalStyles.bestMatchText, { color: C.textSecondary }]}>
                Best match:{' '}
                <Text style={{ fontFamily: 'Inter_600SemiBold', color: C.primary }}>
                  {getEquipmentLabel(getEffectiveTier(sheetDraft))}
                </Text>
              </Text>
            </View>
          )}
          <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 360 }}>
            {(['bodyweight', 'bands', 'dumbbells', 'kettlebells', 'barbell', 'fullgym'] as const).map((tier) => {
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
                    <Text style={[modalStyles.tierLabel, { color: selected ? C.primary : C.text }]}>{getEquipmentLabel(tier)}</Text>
                  </View>
                  {selected && <Ionicons name="checkmark-circle" size={20} color={C.primary} />}
                  {locked && <Ionicons name="lock-closed-outline" size={16} color={C.textTertiary} />}
                </Pressable>
              );
            })}
          </ScrollView>
          <Pressable
            onPress={confirmEquipment}
            style={({ pressed }) => [modalStyles.confirmBtn, { backgroundColor: C.primary }, pressed && { opacity: 0.88 }]}
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
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingTop: 12, paddingHorizontal: 20,
  },
  handle: { width: 36, height: 4, backgroundColor: '#D1D5DB', borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  sheetHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 },
  sheetTitle: { fontSize: 18, fontFamily: 'Inter_700Bold', marginBottom: 2 },
  sheetSubtitle: { fontSize: 13, fontFamily: 'Inter_400Regular' },
  resetBtn: { borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1 },
  resetBtnText: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  bestMatchRow: { borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, marginBottom: 12 },
  bestMatchText: { fontSize: 13, fontFamily: 'Inter_400Regular' },
  tierRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 14, paddingHorizontal: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  tierLabel: { fontSize: 15, fontFamily: 'Inter_500Medium' },
  confirmBtn: { borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginTop: 16 },
  confirmBtnText: { fontSize: 16, fontFamily: 'Inter_700Bold' },
});

function makeStyles(C: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: C.background },
    inner: { flex: 1, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12, gap: 12 },

    header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    greetingText: { fontSize: 24, fontFamily: 'Inter_700Bold', color: C.text },
    headerAvatar: {
      width: 38, height: 38, borderRadius: 19,
      backgroundColor: C.primaryMuted,
      alignItems: 'center', justifyContent: 'center',
      overflow: 'hidden',
    },
    headerAvatarImg: { width: 38, height: 38, borderRadius: 19 },
    headerAvatarInitial: { fontSize: 15, fontFamily: 'Inter_700Bold', color: C.primary },
    testWeekPill: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: C.warningLight, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: C.warning },
    testWeekPillText: { fontSize: 11, fontFamily: 'Inter_600SemiBold', color: C.warning },

    todayCard: {
      backgroundColor: C.surface, borderRadius: 20,
      padding: 20, borderWidth: 1.5, borderColor: C.primary,
      shadowColor: C.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 12,
      elevation: Platform.OS !== 'web' ? 4 : 0,
    },
    todayCardTop: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 18 },
    todayLabel: { fontSize: 11, fontFamily: 'Inter_600SemiBold', color: C.primary, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 },
    todaySessionName: { fontSize: 26, fontFamily: 'Inter_700Bold', color: C.text, marginBottom: 4 },
    todaySessionSub: { fontSize: 13, fontFamily: 'Inter_400Regular', color: C.textSecondary },
    todayIcon: { width: 64, height: 64, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginLeft: 12, flexShrink: 0 },
    startBtn: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
      backgroundColor: C.primary, borderRadius: 14, paddingVertical: 14,
    },
    startBtnText: { fontSize: 16, fontFamily: 'Inter_700Bold', color: C.textInverse },

    equipmentChip: {
      flexDirection: 'row' as const, alignItems: 'center' as const, gap: 6,
      alignSelf: 'flex-start' as const,
      backgroundColor: C.surfaceSecondary ?? C.borderLight, borderRadius: 20,
      paddingHorizontal: 12, paddingVertical: 6, marginBottom: 10,
      borderWidth: 1, borderColor: C.borderLight,
    },
    equipmentChipOverride: {
      backgroundColor: C.primaryMuted, borderColor: C.primary + '40',
    },
    equipmentChipText: { fontSize: 12, fontFamily: 'Inter_500Medium', color: C.textSecondary },
    equipmentChipTextOverride: { color: C.primary, fontFamily: 'Inter_600SemiBold' },
    overrideDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: C.primary },

    blockRow: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 8 },
    blockProgressRow: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 8 },
    blockBarTrack: { flex: 1, height: 4, backgroundColor: C.borderLight, borderRadius: 2, overflow: 'hidden' as const },
    blockBarFill: { height: 4, backgroundColor: C.primary, borderRadius: 2 },
    blockProgressLabel: { fontSize: 11, fontFamily: 'Inter_500Medium', color: C.textTertiary },
    weekDotsRow: {
      backgroundColor: C.surface, borderRadius: 14,
      paddingHorizontal: 14, paddingVertical: 12,
      borderWidth: 1, borderColor: C.borderLight,
    },
    strengthInsightPill: {
      flexDirection: 'row' as const, alignItems: 'center' as const, gap: 8,
      alignSelf: 'flex-start' as const,
      backgroundColor: C.primaryMuted, borderRadius: 20,
      paddingHorizontal: 12, paddingVertical: 7,
      borderWidth: 1, borderColor: C.primary + '22',
    },
    strengthInsightCard: {
      flexDirection: 'row' as const, alignItems: 'center' as const, gap: 8,
      backgroundColor: C.primaryMuted, borderRadius: 12,
      paddingHorizontal: 14, paddingVertical: 10,
      borderWidth: 1, borderColor: C.primary + '22',
    },
    insightLiftLabel: { fontSize: 12, fontFamily: 'Inter_500Medium', color: C.textSecondary },
    insightLiftValue: { fontSize: 13, fontFamily: 'Inter_700Bold', color: C.text },
    gainBadge: {
      flexDirection: 'row' as const, alignItems: 'center' as const, gap: 3,
      backgroundColor: C.surface, borderRadius: 8,
      paddingHorizontal: 8, paddingVertical: 4,
      borderWidth: 1, borderColor: C.primary + '30',
    },
    gainBadgeText: { fontSize: 11, fontFamily: 'Inter_600SemiBold', color: C.primary },
    progressionChip: {
      flexDirection: 'row', alignItems: 'center', gap: 5,
      marginBottom: 10,
    },
    progressionChipText: { fontSize: 12, fontFamily: 'Inter_500Medium', color: C.textTertiary },

    statsStrip: {
      flexDirection: 'row', paddingVertical: 4, paddingHorizontal: 4,
    },
    statItem: { flex: 1, alignItems: 'center' },
    statValue: { fontSize: 20, fontFamily: 'Inter_700Bold', color: C.text },
    statGoal: { fontSize: 14, fontFamily: 'Inter_500Medium', color: C.textTertiary },
    statLabel: { fontSize: 11, fontFamily: 'Inter_500Medium', color: C.textTertiary, marginTop: 2 },
    statDivider: { width: 1, backgroundColor: C.borderLight, marginVertical: 6 },

    lastInline: {
      fontSize: 12, fontFamily: 'Inter_500Medium', color: C.textTertiary,
      marginTop: -8, marginBottom: 14,
    },

    milestoneCard: {
      flexDirection: 'row', alignItems: 'center', gap: 12,
      backgroundColor: C.warningLight, borderRadius: 14,
      paddingHorizontal: 14, paddingVertical: 12,
      borderWidth: 1, borderColor: C.warning,
    },
    milestoneIcon: {
      width: 36, height: 36, borderRadius: 10,
      alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      backgroundColor: C.surface,
    },
    milestoneTitle: { fontSize: 14, fontFamily: 'Inter_700Bold', color: C.text },
    milestoneSub: { fontSize: 12, fontFamily: 'Inter_400Regular', color: C.textSecondary, marginTop: 1 },

    warningCard: {
      flexDirection: 'row', alignItems: 'center', gap: 12,
      backgroundColor: C.surface, borderRadius: 14,
      paddingHorizontal: 14, paddingVertical: 12,
      borderWidth: 1, borderColor: C.borderLight,
    },
    warningIcon: {
      width: 36, height: 36, borderRadius: 10,
      alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      backgroundColor: C.warningLight,
    },
    warningTitle: { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: C.text },
    warningSub: { fontSize: 12, fontFamily: 'Inter_400Regular', color: C.textSecondary, marginTop: 1 },

    resumeSecondary: {
      flexDirection: 'row', alignItems: 'center', gap: 12,
      backgroundColor: C.surface, borderRadius: 14,
      paddingHorizontal: 14, paddingVertical: 12,
      borderWidth: 1, borderColor: C.warning,
    },
    resumeIcon: {
      width: 36, height: 36, borderRadius: 10,
      alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      backgroundColor: C.warningLight,
    },
    resumeTitle: { fontSize: 13, fontFamily: 'Inter_700Bold', color: C.text },
    resumeSub: { fontSize: 12, fontFamily: 'Inter_400Regular', color: C.textSecondary, marginTop: 1 },
    resumeBtnSm: {
      flexDirection: 'row', alignItems: 'center', gap: 5,
      backgroundColor: C.warning, borderRadius: 10,
      paddingHorizontal: 12, paddingVertical: 8,
    },
    resumeBtnSmText: { fontSize: 13, fontFamily: 'Inter_700Bold', color: C.textInverse },
    resumeDiscardBtn: {
      width: 28, height: 28, borderRadius: 8,
      alignItems: 'center', justifyContent: 'center',
    },


    firstChoiceRow: {
      flexDirection: 'row', alignItems: 'center', gap: 12,
      paddingVertical: 11, borderTopWidth: 1, borderTopColor: C.borderLight,
    },
    firstChoiceIcon: {
      width: 48, height: 48, borderRadius: 13,
      alignItems: 'center', justifyContent: 'center', flexShrink: 0,
    },
    firstChoiceImage: { width: 34, height: 34 },
    todayIconImage: { width: 46, height: 46 },
    firstChoiceLabel: { fontSize: 15, fontFamily: 'Inter_700Bold', marginBottom: 2 },
    firstChoiceSub: { fontSize: 12, fontFamily: 'Inter_400Regular', color: C.textSecondary },

    calibrationCompleteCard: {
      flexDirection: 'row', alignItems: 'center', gap: 12,
      backgroundColor: C.primaryMuted, borderRadius: 14,
      paddingHorizontal: 14, paddingVertical: 12,
      borderWidth: 1, borderColor: C.primary + '44',
    },
    calibrationCompleteIcon: {
      width: 36, height: 36, borderRadius: 10,
      alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      backgroundColor: C.surface,
    },
    calibrationCompleteTitle: { fontSize: 14, fontFamily: 'Inter_700Bold', color: C.primary },
    calibrationCompleteSub: { fontSize: 12, fontFamily: 'Inter_400Regular', color: C.textSecondary, marginTop: 1 },

    calibrationCard: {
      backgroundColor: C.primaryMuted, borderRadius: 14,
      padding: 14, borderWidth: 1, borderColor: C.primary + '22',
    },
    calibrationTop: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 6, marginBottom: 8 },
    calibrationTitle: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: C.primary, flex: 1 },
    calibrationCount: { fontSize: 12, fontFamily: 'Inter_600SemiBold', color: C.primary },
    calibrationTrack: { height: 4, backgroundColor: C.primary + '22', borderRadius: 2, overflow: 'hidden' as const, marginBottom: 8 },
    calibrationFill: { height: 4, backgroundColor: C.primary, borderRadius: 2 },
    calibrationSub: { fontSize: 12, fontFamily: 'Inter_400Regular', color: C.textSecondary },

    weightReminderCard: {
      flexDirection: 'row' as const, alignItems: 'center' as const, gap: 10,
      backgroundColor: C.primarySurface, borderRadius: 14,
      paddingHorizontal: 12, paddingVertical: 12,
      borderWidth: 1, borderColor: C.primary + '30',
    },
    weightReminderIcon: {
      width: 36, height: 36, borderRadius: 10,
      alignItems: 'center' as const, justifyContent: 'center' as const, flexShrink: 0,
    },
    weightReminderTitle: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: C.text },
    weightReminderSub: { fontSize: 11, fontFamily: 'Inter_400Regular', color: C.textSecondary, marginTop: 1 },
    weightUpdateBtn: {
      borderRadius: 10, paddingHorizontal: 11, paddingVertical: 7, flexShrink: 0,
    },
    weightUpdateBtnText: { fontSize: 12, fontFamily: 'Inter_700Bold' },
    weightReminderDismiss: {
      width: 26, height: 26, borderRadius: 8,
      alignItems: 'center' as const, justifyContent: 'center' as const,
    },
    weightInputRow: {
      flexDirection: 'row' as const, alignItems: 'center' as const, gap: 10, marginBottom: 16,
    },
    weightInput: {
      flex: 1, borderWidth: 1.5, borderRadius: 12,
      paddingHorizontal: 16, paddingVertical: 12,
      fontSize: 22, fontFamily: 'Inter_600SemiBold',
      textAlign: 'center' as const,
    },
    weightInputUnit: { fontSize: 16, fontFamily: 'Inter_500Medium' },

    achievementsRow: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      gap: 10,
      backgroundColor: C.surface,
      borderRadius: 14,
      paddingHorizontal: 14,
      paddingVertical: 12,
      borderWidth: 1,
      borderColor: C.borderLight,
    },
    achievementsIcons: {
      flexDirection: 'row' as const,
      gap: 4,
    },
    achievementsDot: {
      width: 26,
      height: 26,
      borderRadius: 8,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
      borderWidth: 1,
    },
    achievementsLabel: {
      flex: 1,
      fontSize: 13,
      fontFamily: 'Inter_500Medium',
      color: C.textSecondary,
    },
    achievementsSeeAll: {
      flex: 1,
      fontSize: 12,
      fontFamily: 'Inter_500Medium',
      color: C.textTertiary,
      textAlign: 'right' as const,
    },
    badgeCountBubble: {
      position: 'absolute' as const,
      top: -5, right: -5,
      minWidth: 16, height: 16, borderRadius: 8,
      backgroundColor: C.primary,
      alignItems: 'center' as const, justifyContent: 'center' as const,
      paddingHorizontal: 3,
    },
    badgeCountText: { fontSize: 9, fontFamily: 'Inter_700Bold', color: C.textInverse },

    freshnessRow: {
      flexDirection: 'row' as const,
      gap: 8,
      paddingVertical: 2,
    },
    freshnessChip: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      gap: 5,
      borderRadius: 20,
      paddingHorizontal: 12,
      paddingVertical: 7,
    },
    freshnessDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
    },
    freshnessLabel: {
      fontSize: 12,
      fontFamily: 'Inter_600SemiBold',
    },
    freshnessDays: {
      fontSize: 12,
      fontFamily: 'Inter_400Regular',
    },
  });
}
