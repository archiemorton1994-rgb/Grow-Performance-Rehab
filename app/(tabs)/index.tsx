import React, { useState } from 'react';
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
import Colors from '@/constants/colors';
import { SessionType, useAppStore } from '@/lib/store';
import { getEquipmentLabel } from '@/lib/workout-engine';

const MILESTONE_SESSIONS = [1, 5, 10, 25, 50, 100, 150, 200];
const WEEKLY_GOAL = 3;

function getNextMilestone(count: number): number {
  for (const m of MILESTONE_SESSIONS) {
    if (m > count) return m;
  }
  return Math.ceil((count + 1) / 50) * 50;
}

function WeeklyRing({ weekCount }: { weekCount: number }) {
  const size = 36;
  const strokeWidth = 4;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.min(weekCount / WEEKLY_GOAL, 1);
  const strokeDashoffset = circumference * (1 - progress);

  return (
    <Svg width={size} height={size} style={{ transform: [{ rotate: '-90deg' }] }}>
      <Circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        stroke={Colors.borderLight}
        strokeWidth={strokeWidth}
        fill="none"
      />
      <Circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        stroke={Colors.primary}
        strokeWidth={strokeWidth}
        fill="none"
        strokeDasharray={circumference}
        strokeDashoffset={strokeDashoffset}
        strokeLinecap="round"
      />
    </Svg>
  );
}

const SESSION_OPTIONS: {
  type: SessionType;
  label: string;
  muscles: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  bg: string;
  dashed?: boolean;
}[] = [
  {
    type: 'squat',
    label: 'Lower Body',
    muscles: 'Quads · Glutes · Hamstrings',
    icon: 'walk-outline',
    color: Colors.primary,
    bg: Colors.primaryMuted,
  },
  {
    type: 'bench',
    label: 'Upper Body',
    muscles: 'Chest · Shoulders · Triceps',
    icon: 'body-outline',
    color: '#4285f4',
    bg: '#e8f0fe',
  },
  {
    type: 'deadlift',
    label: 'Full Body',
    muscles: 'Posterior Chain · Back · Core',
    icon: 'man-outline',
    color: '#9c27b0',
    bg: '#f3e5f5',
  },
  {
    type: 'conditioning',
    label: 'Conditioning',
    muscles: 'Full Body · Cardiovascular',
    icon: 'flame-outline',
    color: '#e65100',
    bg: '#fbe9e7',
    dashed: true,
  },
  {
    type: 'prehab',
    label: 'Prehab',
    muscles: 'Joint Health · Injury Prevention',
    icon: 'shield-checkmark-outline',
    color: '#00897b',
    bg: '#e0f2f1',
    dashed: true,
  },
  {
    type: 'flexibility',
    label: 'Flexibility',
    muscles: 'Stretch · Mobility · Recovery',
    icon: 'leaf-outline',
    color: '#558b2f',
    bg: '#f1f8e9',
    dashed: true,
  },
];

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const {
    equipmentTiers,
    getEffectiveTier,
    completedCount,
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
          <Text style={styles.greetingText}>
            {firstName ? `Hey, ${firstName}` : 'Ready to train'}
          </Text>
          <Text style={styles.tierText}>{tierLabel}</Text>
        </View>
        {testWeek && (
          <View style={styles.testWeekPill}>
            <Ionicons name="trophy" size={13} color="#e65100" />
            <Text style={styles.testWeekPillText}>Strength Test</Text>
          </View>
        )}
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(80).duration(400)} style={styles.sessionCards}>
        {SESSION_OPTIONS.map((opt, i) => {
          const isSuggested = opt.type === suggestedSession && !['conditioning', 'prehab', 'flexibility'].includes(opt.type);
          return (
            <Animated.View key={opt.type} entering={FadeInDown.delay(100 + i * 50).duration(350)}>
              <Pressable
                onPress={() => handleSelect(opt.type)}
                style={({ pressed }) => [
                  styles.sessionCard,
                  isSuggested && styles.sessionCardSuggested,
                  opt.dashed && !isSuggested && styles.sessionCardDashed,
                  pressed && { opacity: 0.92, transform: [{ scale: 0.98 }] },
                ]}
                testID={`session-${opt.type}`}
              >
                <View style={[styles.sessionIconWrap, { backgroundColor: opt.bg }]}>
                  <Ionicons name={opt.icon} size={24} color={opt.color} />
                </View>
                <View style={styles.sessionCardContent}>
                  <View style={styles.sessionCardTop}>
                    <Text style={styles.sessionCardLabel}>{opt.label}</Text>
                    {isSuggested && (
                      <View style={styles.suggestedBadge}>
                        <Text style={styles.suggestedBadgeText}>SUGGESTED</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.sessionCardMuscles}>{opt.muscles}</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={Colors.textTertiary} />
              </Pressable>
            </Animated.View>
          );
        })}
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(480).duration(400)} style={styles.statsRow}>
        <View style={styles.statCard}>
          <View style={[styles.statIcon, { backgroundColor: Colors.primaryMuted }]}>
            <Ionicons name="flame-outline" size={18} color={Colors.primary} />
          </View>
          <Text style={styles.statNumber}>{streak}</Text>
          <Text style={styles.statLabel}>Day Streak</Text>
        </View>
        <View style={[styles.statCard, styles.weekStatCard]}>
          <View style={styles.weekStatTop}>
            <View style={[styles.statIcon, { backgroundColor: '#e8f0fe', marginBottom: 0 }]}>
              <Ionicons name="calendar-outline" size={18} color="#4285f4" />
            </View>
            <WeeklyRing weekCount={weekCount} />
          </View>
          <Text style={styles.statNumber}>{weekCount}/{WEEKLY_GOAL}</Text>
          <Text style={styles.statLabel}>This Week</Text>
        </View>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(520).duration(400)} style={styles.milestoneCard}>
        <View style={styles.milestoneCardTop}>
          <View style={[styles.statIcon, { backgroundColor: Colors.primaryMuted, marginBottom: 0 }]}>
            <Ionicons name="trophy-outline" size={18} color={Colors.primary} />
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

      <Animated.View entering={FadeInDown.delay(560).duration(400)} style={styles.infoRow}>
        <View style={styles.infoCard}>
          <Ionicons name="medical-outline" size={16} color={Colors.warning} />
          <Text style={styles.infoText}>Pain adaptive — 11 body regions</Text>
        </View>
        <View style={styles.infoCard}>
          <Ionicons name="time-outline" size={16} color={Colors.primary} />
          <Text style={styles.infoText}>30 · 45 · 60 min options</Text>
        </View>
      </Animated.View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { paddingHorizontal: 20 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  greetingText: { fontSize: 24, fontFamily: 'Inter_700Bold', color: Colors.text },
  tierText: { fontSize: 13, fontFamily: 'Inter_500Medium', color: Colors.textSecondary, marginTop: 2 },
  testWeekPill: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#fff3e0', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: '#ffe0b2' },
  testWeekPillText: { fontSize: 12, fontFamily: 'Inter_600SemiBold', color: '#e65100' },
  sessionCards: { gap: 8, marginBottom: 14 },
  sessionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    gap: 12,
  },
  sessionCardSuggested: {
    borderColor: Colors.primary,
    borderWidth: 2,
    backgroundColor: Colors.primarySurface,
  },
  sessionCardDashed: {
    borderStyle: 'dashed' as const,
  },
  sessionIconWrap: { width: 46, height: 46, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  sessionCardContent: { flex: 1 },
  sessionCardTop: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 },
  sessionCardLabel: { fontSize: 16, fontFamily: 'Inter_700Bold', color: Colors.text },
  suggestedBadge: { backgroundColor: Colors.primary, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  suggestedBadgeText: { fontSize: 9, fontFamily: 'Inter_700Bold', color: Colors.textInverse, letterSpacing: 0.5 },
  sessionCardMuscles: { fontSize: 12, fontFamily: 'Inter_400Regular', color: Colors.textTertiary },
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  statCard: { flex: 1, backgroundColor: Colors.surface, borderRadius: 14, padding: 12, alignItems: 'center', borderWidth: 1, borderColor: Colors.borderLight },
  weekStatCard: { gap: 0 },
  weekStatTop: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  statIcon: { width: 32, height: 32, borderRadius: 9, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  statNumber: { fontSize: 20, fontFamily: 'Inter_700Bold', color: Colors.text },
  statLabel: { fontSize: 11, fontFamily: 'Inter_500Medium', color: Colors.textSecondary, marginTop: 1 },
  milestoneCard: { backgroundColor: Colors.surface, borderRadius: 14, padding: 12, borderWidth: 1, borderColor: Colors.borderLight, marginBottom: 10 },
  milestoneCardTop: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  milestoneCardInfo: { flex: 1 },
  milestoneCardCount: { fontSize: 14, fontFamily: 'Inter_700Bold', color: Colors.text },
  milestoneCardSub: { fontSize: 11, fontFamily: 'Inter_400Regular', color: Colors.textSecondary, marginTop: 1 },
  milestoneBarTrack: { height: 5, backgroundColor: Colors.surfaceTertiary, borderRadius: 3, overflow: 'hidden' },
  milestoneBarFill: { height: '100%', backgroundColor: Colors.primary, borderRadius: 3 },
  infoRow: { gap: 8 },
  infoCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface, borderRadius: 11, padding: 10, borderWidth: 1, borderColor: Colors.borderLight, gap: 8 },
  infoText: { fontSize: 12, fontFamily: 'Inter_400Regular', color: Colors.textSecondary, flex: 1 },
});
