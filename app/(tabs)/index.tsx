import React, { useMemo } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Platform,
  Alert,
  Image,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useColors } from '@/constants/colors';
import { SessionType, useAppStore, STRENGTH_SESSION_TYPES } from '@/lib/store';
import { getTimeOfDayGreeting, kgToDisplayUnit } from '@/lib/utils';
import { SESSION_META, getSessionColors, SessionMeta, SessionColorPair } from '@/lib/session-meta';

const SESSION_IMAGES: Record<string, any> = {
  squat:        require('@/assets/images/sessions/lower-body.png'),
  bench:        require('@/assets/images/sessions/upper-body.png'),
  deadlift:     require('@/assets/images/sessions/full-body.png'),
  conditioning: require('@/assets/images/sessions/conditioning.png'),
  prehab:       require('@/assets/images/sessions/targeted-prehab.png'),
  flexibility:  require('@/assets/images/sessions/mobility.png'),
  custom:       require('@/assets/images/sessions/custom.png'),
};

const WEEKLY_GOAL = 3;


export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const C = useColors();
  const tabBarHeight = insets.bottom + 50;
  const {
    getEffectiveTier,
    completedSessions,
    getCurrentSessionType,
    getStreakDays,
    getThisWeekCount,
    isTestWeekDue,
    userProfile,
    activeSession,
    clearActiveSession,
    setCycleStartOffset,
    profilePhotoUri,
    testWeekFrequency,
    getBestORM,
    oneRepMaxes,
    weightUnit,
  } = useAppStore();

  const effectiveTier = getEffectiveTier();
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

  const missedStreakWarning =
    lastSession && streak === 0
    && daysSinceLast !== null && daysSinceLast >= 2
    && completedSessions.length >= 3;

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
      router.push({
        pathname: '/readiness',
        params: { sessionType: suggestedSession, isTestWeek: testWeek ? 'true' : 'false' },
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
          <Animated.View entering={FadeInDown.delay(60).duration(380)} style={styles.todayCard}>
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
            {showBlockProgress && (
              <View style={styles.blockProgressRow}>
                <View style={styles.blockBarTrack}>
                  <View style={[styles.blockBarFill, { width: `${Math.round((sessionsInBlock / testWeekFrequency) * 100)}%` as any }]} />
                </View>
                <Text style={[styles.blockProgressLabel, sessionsUntilTest <= 2 && { color: C.warning }]}>
                  {sessionsUntilTest <= 2
                    ? `Test week in ${sessionsUntilTest} session${sessionsUntilTest !== 1 ? 's' : ''}`
                    : `Block ${sessionsInBlock} / ${testWeekFrequency}`}
                </Text>
              </View>
            )}
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

        {/* Stats strip - always visible */}
        <Animated.View entering={FadeInDown.delay(120).duration(380)} style={styles.statsStrip}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{streak}</Text>
            <Text style={styles.statLabel}>Day Streak</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{weekCount}<Text style={styles.statGoal}>/{WEEKLY_GOAL}</Text></Text>
            <Text style={styles.statLabel}>This Week</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{completedSessions.length}</Text>
            <Text style={styles.statLabel}>Total</Text>
          </View>
        </Animated.View>

        {/* Strength progress insight - best 1RM with gain since first test */}
        {topLift && completedSessions.length > 0 && (
          <Animated.View entering={FadeInDown.delay(150).duration(380)} style={styles.strengthInsightCard}>
            <Ionicons name="barbell-outline" size={14} color={C.primary} />
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
        ) : missedStreakWarning ? (
          <Animated.View entering={FadeInDown.delay(180).duration(380)} style={styles.warningCard}>
            <View style={styles.warningIcon}>
              <Ionicons name="alarm-outline" size={20} color={C.warning} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.warningTitle}>Streak broken</Text>
              <Text style={styles.warningSub}>
                It's been {daysSinceLast} days. A short session is better than none.
              </Text>
            </View>
          </Animated.View>
        ) : null}

      </View>
    </View>
  );
}

function makeStyles(C: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: C.background },
    inner: { flex: 1, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12, gap: 18 },

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

    blockProgressRow: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 8, marginBottom: 10 },
    blockBarTrack: { flex: 1, height: 4, backgroundColor: C.borderLight, borderRadius: 2, overflow: 'hidden' as const },
    blockBarFill: { height: 4, backgroundColor: C.primary, borderRadius: 2 },
    blockProgressLabel: { fontSize: 11, fontFamily: 'Inter_500Medium', color: C.textTertiary },
    strengthInsightCard: {
      flexDirection: 'row' as const, alignItems: 'center' as const, gap: 8,
      backgroundColor: C.primaryMuted, borderRadius: 12,
      paddingHorizontal: 14, paddingVertical: 10,
      borderWidth: 1, borderColor: C.primary + '22', marginBottom: 12,
    },
    insightLiftLabel: { fontSize: 12, fontFamily: 'Inter_500Medium', color: C.textSecondary },
    insightLiftValue: { fontSize: 14, fontFamily: 'Inter_700Bold', color: C.text, flex: 1 },
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
  });
}
