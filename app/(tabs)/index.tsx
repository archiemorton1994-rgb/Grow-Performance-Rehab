import React, { useMemo } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Platform,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useColors } from '@/constants/colors';
import { SessionType, useAppStore } from '@/lib/store';
import { getEquipmentLabel } from '@/lib/workout-engine';
import { formatDate, getTimeOfDayGreeting } from '@/lib/utils';

const WEEKLY_GOAL = 3;

const SESSION_TYPE_LABELS: Record<SessionType, { label: string; subtitle: string; icon: keyof typeof Ionicons.glyphMap }> = {
  squat:        { label: 'Lower Body',   subtitle: 'Quads · Glutes · Hamstrings', icon: 'fitness-outline' },
  bench:        { label: 'Upper Body',   subtitle: 'Chest · Shoulders · Triceps', icon: 'body-outline' },
  deadlift:     { label: 'Full Body',    subtitle: 'Back · Hips · Legs',          icon: 'barbell-outline' },
  conditioning: { label: 'Conditioning', subtitle: 'Cardio & Stamina',            icon: 'flame-outline' },
  prehab:       { label: 'Prehab',       subtitle: 'Joint health & Mobility',     icon: 'shield-checkmark-outline' },
  flexibility:  { label: 'Flexibility',  subtitle: 'Stretching & Recovery',       icon: 'leaf-outline' },
};

const GOAL_LABELS: Record<string, string> = {
  strength: 'Strength', muscle: 'Muscle', fat_loss: 'Fat Loss', fitness: 'Fitness', rehab: 'Rehab & Recovery',
};

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const C = useColors();
  const tabBarHeight = insets.bottom + 50;
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
  const lastSession = completedSessions.length > 0 ? completedSessions[0] : null;

  const tierLabel = equipmentTiers.length > 1
    ? `${getEquipmentLabel(effectiveTier)} + ${equipmentTiers.length - 1} more`
    : getEquipmentLabel(effectiveTier);

  const SESSION_TYPE_META = useMemo(() => ({
    squat:        { ...SESSION_TYPE_LABELS.squat,        color: C.primary,           bg: C.primaryMuted },
    bench:        { ...SESSION_TYPE_LABELS.bench,        color: C.badgeVolumeText,   bg: C.badgeVolume },
    deadlift:     { ...SESSION_TYPE_LABELS.deadlift,     color: '#9c27b0',           bg: '#f3e5f5' },
    conditioning: { ...SESSION_TYPE_LABELS.conditioning, color: '#e65100',           bg: '#fbe9e7' },
    prehab:       { ...SESSION_TYPE_LABELS.prehab,       color: '#00897b',           bg: '#e0f2f1' },
    flexibility:  { ...SESSION_TYPE_LABELS.flexibility,  color: '#558b2f',           bg: '#f1f8e9' },
  }), [C]);

  const suggestedMeta = SESSION_TYPE_META[suggestedSession];
  const primaryGoalLabel = GOAL_LABELS[userProfile.goals?.[0] ?? 'fitness'] ?? 'Fitness';

  // Auto-progression indicator: show when completedCount >= 15 (autoMult >= 1.05)
  const autoMult = Math.min(1.20, 1 + Math.floor(completedCount / 3) * 0.01);
  const showProgressionNote = autoMult >= 1.05;

  const webTopInset = Platform.OS === 'web' ? 67 : 0;
  const styles = useMemo(() => makeStyles(C), [C]);

  const handleStartSuggested = () => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push({
      pathname: '/readiness',
      params: { sessionType: suggestedSession, isTestWeek: testWeek ? 'true' : 'false' },
    });
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
            <Text style={styles.tierText}>{tierLabel}</Text>
          </View>
          {testWeek && (
            <View style={styles.testWeekPill}>
              <Ionicons name="trophy" size={13} color="#e65100" />
              <Text style={styles.testWeekPillText}>Test Week</Text>
            </View>
          )}
        </Animated.View>

        {/* Today's Session card */}
        <Animated.View entering={FadeInDown.delay(60).duration(380)} style={styles.todayCard}>
          <View style={styles.todayCardTop}>
            <View style={{ flex: 1 }}>
              <Text style={styles.todayLabel}>Today's Session</Text>
              <Text style={styles.todaySessionName}>{suggestedMeta.label}</Text>
              <Text style={styles.todaySessionSub}>{suggestedMeta.subtitle}</Text>
            </View>
            <View style={[styles.todayIcon, { backgroundColor: suggestedMeta.bg }]}>
              <Ionicons name={suggestedMeta.icon} size={32} color={suggestedMeta.color} />
            </View>
          </View>
          {showProgressionNote && (
            <View style={styles.progressionChip}>
              <Ionicons name="trending-up" size={12} color={C.primary} />
              <Text style={styles.progressionChipText}>Weights have increased since last session</Text>
            </View>
          )}
          <Pressable
            onPress={handleStartSuggested}
            style={({ pressed }) => [styles.startBtn, pressed && { opacity: 0.88, transform: [{ scale: 0.98 }] }]}
            testID="start-suggested-session"
          >
            <Ionicons name="flash" size={18} color="#fff" />
            <Text style={styles.startBtnText}>{testWeek ? 'Start Strength Test' : 'Start Session'}</Text>
          </Pressable>
        </Animated.View>

        {/* Stats strip / Welcome card */}
        {completedCount === 0 ? (
          <Animated.View entering={FadeInDown.delay(120).duration(380)} style={styles.welcomeCard}>
            <Text style={styles.welcomeTitle}>
              {firstName ? `Welcome, ${firstName}` : 'Welcome to Grow'}
            </Text>
            <Text style={styles.welcomeSub}>Your profile is set up and your first session is ready.</Text>
            <View style={styles.welcomePills}>
              <View style={styles.welcomePill}>
                <Ionicons name="barbell-outline" size={12} color={C.primary} />
                <Text style={styles.welcomePillText}>{getEquipmentLabel(effectiveTier)}</Text>
              </View>
              <View style={styles.welcomePill}>
                <Ionicons name="flame-outline" size={12} color={C.primary} />
                <Text style={styles.welcomePillText}>{primaryGoalLabel}</Text>
              </View>
            </View>
          </Animated.View>
        ) : (
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
              <Text style={styles.statValue}>{completedCount}</Text>
              <Text style={styles.statLabel}>Total</Text>
            </View>
          </Animated.View>
        )}

        {/* Last session info strip (read-only) */}
        <Animated.View entering={FadeInDown.delay(180).duration(380)}>
          {lastSession ? (
            <View style={styles.lastCard}>
              <View style={[styles.lastIcon, { backgroundColor: SESSION_TYPE_META[lastSession.sessionType].bg }]}>
                <Ionicons name={SESSION_TYPE_META[lastSession.sessionType].icon} size={16} color={SESSION_TYPE_META[lastSession.sessionType].color} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.lastTitle}>Last: {SESSION_TYPE_META[lastSession.sessionType].label}</Text>
                <Text style={styles.lastDate}>
                  {formatDate(lastSession.date)}
                  {lastSessionDurationLabel ? ` · ${lastSessionDurationLabel}` : ''}
                </Text>
              </View>
              <Ionicons name="checkmark-circle" size={18} color={C.primary} style={{ opacity: 0.5 }} />
            </View>
          ) : (
            <View style={styles.firstCard}>
              <Ionicons name="sparkles-outline" size={20} color={C.primary} />
              <Text style={styles.firstCardText}>Complete your first session to start tracking progress</Text>
            </View>
          )}
        </Animated.View>

      </View>
    </View>
  );
}

function makeStyles(C: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: C.background },
    inner: { flex: 1, paddingHorizontal: 20, justifyContent: 'space-between', paddingTop: 16, paddingBottom: 12 },

    header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    greetingText: { fontSize: 24, fontFamily: 'Inter_700Bold', color: C.text },
    tierText: { fontSize: 13, fontFamily: 'Inter_500Medium', color: C.textSecondary, marginTop: 2 },
    testWeekPill: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#fff3e0', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: '#ffe0b2' },
    testWeekPillText: { fontSize: 11, fontFamily: 'Inter_600SemiBold', color: '#e65100' },

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
    startBtnText: { fontSize: 16, fontFamily: 'Inter_700Bold', color: '#fff' },

    progressionChip: {
      flexDirection: 'row', alignItems: 'center', gap: 5,
      marginBottom: 10,
    },
    progressionChipText: { fontSize: 12, fontFamily: 'Inter_500Medium', color: C.textTertiary },

    statsStrip: {
      flexDirection: 'row', backgroundColor: C.surface,
      borderRadius: 16, paddingVertical: 16,
      borderWidth: 1, borderColor: C.borderLight,
    },
    statItem: { flex: 1, alignItems: 'center' },
    statValue: { fontSize: 24, fontFamily: 'Inter_700Bold', color: C.text },
    statGoal: { fontSize: 16, fontFamily: 'Inter_500Medium', color: C.textTertiary },
    statLabel: { fontSize: 11, fontFamily: 'Inter_500Medium', color: C.textSecondary, marginTop: 2 },
    statDivider: { width: 1, backgroundColor: C.border, marginVertical: 4 },

    lastCard: {
      flexDirection: 'row', alignItems: 'center', gap: 10,
      backgroundColor: C.surface, borderRadius: 16,
      paddingHorizontal: 14, paddingVertical: 12,
      borderWidth: 1, borderColor: C.borderLight,
    },
    lastIcon: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
    lastTitle: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: C.text },
    lastDate: { fontSize: 12, fontFamily: 'Inter_400Regular', color: C.textSecondary, marginTop: 1 },

    firstCard: {
      flexDirection: 'row', alignItems: 'center', gap: 10,
      backgroundColor: C.surface, borderRadius: 14,
      paddingHorizontal: 14, paddingVertical: 14,
      borderWidth: 1, borderColor: C.borderLight,
    },
    firstCardText: { flex: 1, fontSize: 13, fontFamily: 'Inter_400Regular', color: C.textSecondary },

    welcomeCard: {
      backgroundColor: C.primarySurface, borderRadius: 16,
      paddingHorizontal: 16, paddingVertical: 16,
      borderWidth: 1, borderColor: C.primaryMuted,
    },
    welcomeTitle: { fontSize: 17, fontFamily: 'Inter_700Bold', color: C.primaryDark, marginBottom: 4 },
    welcomeSub: { fontSize: 13, fontFamily: 'Inter_400Regular', color: C.textSecondary, lineHeight: 18, marginBottom: 12 },
    welcomePills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    welcomePill: {
      flexDirection: 'row', alignItems: 'center', gap: 5,
      backgroundColor: C.primaryMuted, borderRadius: 20,
      paddingHorizontal: 10, paddingVertical: 5,
    },
    welcomePillText: { fontSize: 12, fontFamily: 'Inter_600SemiBold', color: C.primary },
  });
}
