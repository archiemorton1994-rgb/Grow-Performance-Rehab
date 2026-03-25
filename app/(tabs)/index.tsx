import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Platform,
  ScrollView,
  LayoutChangeEvent,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown } from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import { useColors } from '@/constants/colors';
import { SessionType, useAppStore } from '@/lib/store';
import { getEquipmentLabel } from '@/lib/workout-engine';
import { formatDate, getTimeOfDayGreeting } from '@/lib/utils';

const MILESTONE_SESSIONS = [1, 5, 10, 25, 50, 100, 150, 200];
const WEEKLY_GOAL = 3;

function getNextMilestone(count: number): number {
  for (const m of MILESTONE_SESSIONS) {
    if (m > count) return m;
  }
  return Math.ceil((count + 1) / 50) * 50;
}

const SESSION_TYPE_META: Record<SessionType, { label: string; subtitle: string; icon: keyof typeof Ionicons.glyphMap; color: string; bg: string }> = {
  squat: { label: 'Lower Body', subtitle: 'Quads · Glutes · Hamstrings', icon: 'fitness-outline', color: '#2f6b46', bg: '#e8f2ec' },
  bench: { label: 'Upper Body', subtitle: 'Chest · Shoulders · Triceps', icon: 'body-outline', color: '#4285f4', bg: '#e8f0fe' },
  deadlift: { label: 'Full Body', subtitle: 'Back · Hips · Legs', icon: 'barbell-outline', color: '#9c27b0', bg: '#f3e5f5' },
  conditioning: { label: 'Conditioning', subtitle: 'Cardio & Stamina', icon: 'flame-outline', color: '#e65100', bg: '#fbe9e7' },
  prehab: { label: 'Prehab', subtitle: 'Joint health & Mobility', icon: 'shield-checkmark-outline', color: '#00897b', bg: '#e0f2f1' },
  flexibility: { label: 'Flexibility', subtitle: 'Stretching & Recovery', icon: 'leaf-outline', color: '#558b2f', bg: '#f1f8e9' },
};

const PRIMARY_SESSIONS: SessionType[] = ['squat', 'bench', 'deadlift'];
const SECONDARY_SESSIONS: SessionType[] = ['conditioning', 'prehab', 'flexibility'];

function WeeklyRing({ weekCount, C }: { weekCount: number; C: ReturnType<typeof useColors> }) {
  const size = 36;
  const strokeWidth = 4;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.min(weekCount / WEEKLY_GOAL, 1);
  const strokeDashoffset = circumference * (1 - progress);

  return (
    <Svg width={size} height={size} style={{ transform: [{ rotate: '-90deg' }] }}>
      <Circle cx={size / 2} cy={size / 2} r={radius} stroke={C.borderLight} strokeWidth={strokeWidth} fill="none" />
      <Circle
        cx={size / 2} cy={size / 2} r={radius}
        stroke={C.primary} strokeWidth={strokeWidth} fill="none"
        strokeDasharray={circumference} strokeDashoffset={strokeDashoffset}
        strokeLinecap="round"
      />
    </Svg>
  );
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const C = useColors();
  const {
    equipmentTiers,
    getEffectiveTier,
    completedCount,
    completedSessions,
    getCurrentSessionType,
    getStreakDays,
    getThisWeekCount,
    isTestWeekDue,
    userProfile,
  } = useAppStore();

  const effectiveTier = getEffectiveTier();
  const suggestedSession = getCurrentSessionType();
  const streak = getStreakDays();
  const weekCount = getThisWeekCount();
  const testWeek = isTestWeekDue();
  const firstName = userProfile.name ? userProfile.name.split(' ')[0] : null;
  const greeting = getTimeOfDayGreeting();
  const greetingText = firstName ? `${greeting}, ${firstName}` : greeting;

  const profileIncomplete = !userProfile.name || userProfile.bodyweightKg === 0;
  const [nudgeDismissed, setNudgeDismissed] = useState(false);
  const showNudge = profileIncomplete && !nudgeDismissed;

  const lastSession = completedSessions.length > 0 ? completedSessions[0] : null;

  const handleSelect = (sessionType: SessionType) => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (sessionType === 'prehab' || sessionType === 'flexibility') {
      router.push({
        pathname: '/session',
        params: { sessionType, hasAches: 'false', painRegion: '', energy: 'normal', timeAvailable: '60', isTestWeek: 'false', equipment: effectiveTier },
      });
    } else if (sessionType === 'conditioning') {
      router.push({
        pathname: '/readiness',
        params: { sessionType, isTestWeek: 'false' },
      });
    } else {
      router.push({
        pathname: '/readiness',
        params: { sessionType, isTestWeek: testWeek ? 'true' : 'false' },
      });
    }
  };

  const [milestoneTrackWidth, setMilestoneTrackWidth] = useState(0);
  const handleMilestoneTrackLayout = (e: LayoutChangeEvent) => {
    setMilestoneTrackWidth(e.nativeEvent.layout.width);
  };

  const webTopInset = Platform.OS === 'web' ? 67 : 0;
  const webBottomInset = Platform.OS === 'web' ? 34 : 0;

  const tierLabel = equipmentTiers.length > 1
    ? `${getEquipmentLabel(effectiveTier)} + ${equipmentTiers.length - 1} more`
    : getEquipmentLabel(effectiveTier);

  const styles = useMemo(() => makeStyles(C), [C]);

  const renderSessionCard = (sessionType: SessionType, index: number, small = false) => {
    const meta = SESSION_TYPE_META[sessionType];
    const isSuggested = sessionType === suggestedSession && PRIMARY_SESSIONS.includes(sessionType);
    return (
      <Animated.View key={sessionType} entering={FadeInDown.delay(100 + index * 50).duration(350)}>
        <Pressable
          onPress={() => handleSelect(sessionType)}
          style={({ pressed }) => [
            styles.sessionCard,
            small && styles.sessionCardSmall,
            isSuggested && styles.sessionCardSuggested,
            !isSuggested && small && styles.sessionCardDashed,
            pressed && { opacity: 0.92, transform: [{ scale: 0.98 }] },
          ]}
          testID={`session-${sessionType}`}
        >
          <View style={[styles.sessionIconWrap, { backgroundColor: meta.bg }]}>
            <Ionicons name={meta.icon} size={small ? 20 : 24} color={meta.color} />
          </View>
          <View style={styles.sessionCardContent}>
            <View style={styles.sessionCardTop}>
              <Text style={[styles.sessionCardLabel, small && styles.sessionCardLabelSmall]}>{meta.label}</Text>
              {isSuggested && (
                <View style={styles.suggestedBadge}>
                  <Text style={styles.suggestedBadgeText}>SUGGESTED</Text>
                </View>
              )}
            </View>
            {!small && (
              <Text style={styles.sessionCardSubtitle}>{meta.subtitle}</Text>
            )}
          </View>
          <Ionicons name="chevron-forward" size={16} color={C.textTertiary} />
        </Pressable>
      </Animated.View>
    );
  };

  return (
    <ScrollView
      style={[styles.container]}
      contentContainerStyle={[
        styles.content,
        {
          paddingTop: insets.top + webTopInset + 12,
          paddingBottom: insets.bottom + webBottomInset + 20,
        },
      ]}
      showsVerticalScrollIndicator={false}
    >
      <Animated.View entering={FadeInDown.duration(400)} style={styles.header}>
        <View>
          <Text style={styles.greetingText}>{greetingText}</Text>
          <Text style={styles.tierText}>{tierLabel}</Text>
        </View>
        {testWeek && (
          <View style={styles.testWeekPill}>
            <Ionicons name="trophy" size={13} color="#e65100" />
            <Text style={styles.testWeekPillText}>Strength Test</Text>
          </View>
        )}
      </Animated.View>

      {showNudge && (
        <Animated.View entering={FadeInDown.delay(40).duration(350)} style={styles.nudgeCard}>
          <Ionicons name="person-circle-outline" size={22} color={C.primary} />
          <Text style={styles.nudgeText}>Complete your profile to personalise your sessions</Text>
          <View style={styles.nudgeActions}>
            <Pressable
              onPress={() => router.push('/(tabs)/profile')}
              style={styles.nudgeBtn}
            >
              <Text style={styles.nudgeBtnText}>Set up</Text>
            </Pressable>
            <Pressable onPress={() => setNudgeDismissed(true)} style={styles.nudgeClose}>
              <Ionicons name="close" size={16} color={C.textTertiary} />
            </Pressable>
          </View>
        </Animated.View>
      )}

      <Animated.View entering={FadeInDown.delay(60).duration(400)} style={styles.sessionCards}>
        {PRIMARY_SESSIONS.map((type, i) => renderSessionCard(type, i, false))}

        <View style={styles.moreDivider}>
          <View style={[styles.moreDividerLine, { backgroundColor: C.borderLight }]} />
          <Text style={styles.moreDividerText}>More sessions</Text>
          <View style={[styles.moreDividerLine, { backgroundColor: C.borderLight }]} />
        </View>

        {SECONDARY_SESSIONS.map((type, i) => renderSessionCard(type, i + 3, true))}
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(480).duration(400)} style={styles.statsRow}>
        <View style={styles.statCard}>
          <View style={[styles.statIcon, { backgroundColor: C.primaryMuted }]}>
            <Ionicons name="flame-outline" size={18} color={C.primary} />
          </View>
          <Text style={styles.statNumber}>{streak}</Text>
          <Text style={styles.statLabel}>Day Streak</Text>
        </View>
        <View style={[styles.statCard, styles.weekStatCard]}>
          <View style={styles.weekStatTop}>
            <View style={[styles.statIcon, { backgroundColor: '#e8f0fe', marginBottom: 0 }]}>
              <Ionicons name="calendar-outline" size={18} color="#4285f4" />
            </View>
            <WeeklyRing weekCount={weekCount} C={C} />
          </View>
          <Text style={styles.statNumber}>{weekCount}/{WEEKLY_GOAL}</Text>
          <Text style={styles.statLabel}>This Week</Text>
        </View>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(520).duration(400)} style={styles.milestoneCard}>
        <View style={styles.milestoneCardTop}>
          <View style={[styles.statIcon, { backgroundColor: C.primaryMuted, marginBottom: 0 }]}>
            <Ionicons name="trophy-outline" size={18} color={C.primary} />
          </View>
          <View style={styles.milestoneCardInfo}>
            <Text style={styles.milestoneCardCount}>
              {completedCount}/{getNextMilestone(completedCount)} sessions
            </Text>
            <Text style={styles.milestoneCardSub}>
              {getNextMilestone(completedCount) - completedCount} to next milestone
            </Text>
          </View>
        </View>
        <View style={styles.milestoneBarTrack} onLayout={handleMilestoneTrackLayout}>
          <View style={[
            styles.milestoneBarFill,
            { width: milestoneTrackWidth * Math.min(completedCount / getNextMilestone(completedCount), 1) },
          ]} />
        </View>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(560).duration(400)}>
        {lastSession ? (
          <View style={styles.lastSessionCard}>
            <View style={styles.lastSessionLeft}>
              <View style={[styles.lastSessionIcon, { backgroundColor: SESSION_TYPE_META[lastSession.sessionType].bg }]}>
                <Ionicons name={SESSION_TYPE_META[lastSession.sessionType].icon} size={18} color={SESSION_TYPE_META[lastSession.sessionType].color} />
              </View>
              <View>
                <Text style={styles.lastSessionTitle}>Last: {SESSION_TYPE_META[lastSession.sessionType].label}</Text>
                <Text style={styles.lastSessionDate}>{formatDate(lastSession.date)}</Text>
              </View>
            </View>
            <Pressable
              onPress={() => handleSelect(lastSession.sessionType)}
              style={({ pressed }) => [styles.repeatBtn, pressed && { opacity: 0.8 }]}
            >
              <Ionicons name="refresh" size={14} color={C.primary} />
              <Text style={styles.repeatBtnText}>Repeat</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.firstSessionCard}>
            <Ionicons name="sparkles-outline" size={20} color={C.primary} />
            <Text style={styles.firstSessionText}>Start your first session to begin tracking your progress</Text>
          </View>
        )}
      </Animated.View>
    </ScrollView>
  );
}

function makeStyles(C: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: C.background },
    content: { paddingHorizontal: 20 },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
    greetingText: { fontSize: 24, fontFamily: 'Inter_700Bold', color: C.text },
    tierText: { fontSize: 13, fontFamily: 'Inter_500Medium', color: C.textSecondary, marginTop: 2 },
    testWeekPill: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#fff3e0', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: '#ffe0b2' },
    testWeekPillText: { fontSize: 12, fontFamily: 'Inter_600SemiBold', color: '#e65100' },

    nudgeCard: {
      flexDirection: 'row', alignItems: 'center', gap: 10,
      backgroundColor: C.primarySurface, borderRadius: 12,
      paddingHorizontal: 14, paddingVertical: 10,
      borderWidth: 1, borderColor: C.primaryMuted,
      marginBottom: 12,
    },
    nudgeText: { flex: 1, fontSize: 13, fontFamily: 'Inter_400Regular', color: C.text },
    nudgeActions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    nudgeBtn: { backgroundColor: C.primary, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
    nudgeBtnText: { fontSize: 12, fontFamily: 'Inter_600SemiBold', color: '#fff' },
    nudgeClose: { padding: 4 },

    sessionCards: { gap: 7, marginBottom: 14 },
    sessionCard: {
      flexDirection: 'row', alignItems: 'center',
      backgroundColor: C.surface, borderRadius: 16,
      paddingHorizontal: 14, paddingVertical: 13,
      borderWidth: 1, borderColor: C.borderLight, gap: 12,
    },
    sessionCardSmall: { paddingVertical: 10 },
    sessionCardSuggested: { borderColor: C.primary, borderWidth: 2, backgroundColor: C.primarySurface },
    sessionCardDashed: { borderStyle: 'dashed' as const },
    sessionIconWrap: { width: 44, height: 44, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
    sessionCardContent: { flex: 1 },
    sessionCardTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    sessionCardLabel: { fontSize: 16, fontFamily: 'Inter_700Bold', color: C.text },
    sessionCardLabelSmall: { fontSize: 15 },
    sessionCardSubtitle: { fontSize: 12, fontFamily: 'Inter_400Regular', color: C.textSecondary, marginTop: 2 },
    suggestedBadge: { backgroundColor: C.primary, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
    suggestedBadgeText: { fontSize: 9, fontFamily: 'Inter_700Bold', color: C.textInverse, letterSpacing: 0.5 },

    moreDivider: { flexDirection: 'row', alignItems: 'center', gap: 8, marginVertical: 2 },
    moreDividerLine: { flex: 1, height: 1 },
    moreDividerText: { fontSize: 11, fontFamily: 'Inter_500Medium', color: C.textTertiary },

    statsRow: { flexDirection: 'row', gap: 10, marginBottom: 10 },
    statCard: { flex: 1, backgroundColor: C.surface, borderRadius: 14, padding: 12, alignItems: 'center', borderWidth: 1, borderColor: C.borderLight },
    weekStatCard: { gap: 0 },
    weekStatTop: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
    statIcon: { width: 32, height: 32, borderRadius: 9, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
    statNumber: { fontSize: 20, fontFamily: 'Inter_700Bold', color: C.text },
    statLabel: { fontSize: 11, fontFamily: 'Inter_500Medium', color: C.textSecondary, marginTop: 1 },

    milestoneCard: { backgroundColor: C.surface, borderRadius: 14, padding: 12, borderWidth: 1, borderColor: C.borderLight, marginBottom: 10 },
    milestoneCardTop: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
    milestoneCardInfo: { flex: 1 },
    milestoneCardCount: { fontSize: 14, fontFamily: 'Inter_700Bold', color: C.text },
    milestoneCardSub: { fontSize: 11, fontFamily: 'Inter_400Regular', color: C.textSecondary, marginTop: 1 },
    milestoneBarTrack: { height: 5, backgroundColor: C.surfaceTertiary, borderRadius: 3, overflow: 'hidden' },
    milestoneBarFill: { height: '100%', backgroundColor: C.primary, borderRadius: 3 },

    lastSessionCard: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      backgroundColor: C.surface, borderRadius: 14,
      paddingHorizontal: 14, paddingVertical: 12,
      borderWidth: 1, borderColor: C.borderLight,
    },
    lastSessionLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    lastSessionIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
    lastSessionTitle: { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: C.text },
    lastSessionDate: { fontSize: 12, fontFamily: 'Inter_400Regular', color: C.textSecondary, marginTop: 1 },
    repeatBtn: {
      flexDirection: 'row', alignItems: 'center', gap: 5,
      borderWidth: 1, borderColor: C.primary,
      borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6,
    },
    repeatBtnText: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: C.primary },

    firstSessionCard: {
      flexDirection: 'row', alignItems: 'center', gap: 10,
      backgroundColor: C.surface, borderRadius: 14,
      paddingHorizontal: 14, paddingVertical: 12,
      borderWidth: 1, borderColor: C.borderLight,
    },
    firstSessionText: { flex: 1, fontSize: 13, fontFamily: 'Inter_400Regular', color: C.textSecondary },
  });
}
