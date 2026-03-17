import React from 'react';
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
import Colors from '@/constants/colors';
import { SessionType, useAppStore } from '@/lib/store';
import { getEquipmentLabel } from '@/lib/workout-engine';

const SESSION_OPTIONS: {
  type: SessionType;
  label: string;
  subtitle: string;
  muscles: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  bg: string;
}[] = [
  {
    type: 'squat',
    label: 'Lower Body',
    subtitle: 'Squat pattern',
    muscles: 'Quads · Glutes · Hamstrings',
    icon: 'footsteps-outline',
    color: Colors.primary,
    bg: Colors.primaryMuted,
  },
  {
    type: 'bench',
    label: 'Upper Body',
    subtitle: 'Push pattern',
    muscles: 'Chest · Shoulders · Triceps',
    icon: 'hand-right-outline',
    color: '#4285f4',
    bg: '#e8f0fe',
  },
  {
    type: 'deadlift',
    label: 'Full Body',
    subtitle: 'Hinge pattern',
    muscles: 'Posterior Chain · Back · Core',
    icon: 'barbell-outline',
    color: '#9c27b0',
    bg: '#f3e5f5',
  },
  {
    type: 'conditioning',
    label: 'Conditioning',
    subtitle: 'Cardio & fat burn',
    muscles: 'Full Body · Cardiovascular',
    icon: 'flame-outline',
    color: '#e65100',
    bg: '#fbe9e7',
  },
];

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const {
    equipmentTier,
    completedCount,
    getCurrentSessionType,
    getStreakDays,
    getThisWeekCount,
    isTestWeekDue,
    userProfile,
  } = useAppStore();

  const suggestedSession = getCurrentSessionType();
  const streak = getStreakDays();
  const weekCount = getThisWeekCount();
  const testWeek = isTestWeekDue();
  const firstName = userProfile.name ? userProfile.name.split(' ')[0] : null;

  const handleSelect = (sessionType: SessionType) => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (sessionType === 'conditioning') {
      router.push({
        pathname: '/readiness',
        params: { sessionType, isTestWeek: 'false', equipment: equipmentTier },
      });
    } else {
      router.push({
        pathname: '/readiness',
        params: { sessionType, isTestWeek: testWeek ? 'true' : 'false', equipment: equipmentTier },
      });
    }
  };

  const webTopInset = Platform.OS === 'web' ? 67 : 0;
  const webBottomInset = Platform.OS === 'web' ? 34 : 0;

  return (
    <View
      style={[
        styles.container,
        {
          paddingTop: insets.top + webTopInset + 12,
          paddingBottom: insets.bottom + webBottomInset + 8,
        },
      ]}
    >
      <Animated.View entering={FadeInDown.duration(400)} style={styles.header}>
        <View>
          <Text style={styles.greetingText}>
            {firstName ? `Hey, ${firstName}` : 'Ready to train'}
          </Text>
          <Text style={styles.tierText}>{getEquipmentLabel(equipmentTier)}</Text>
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
          const isSuggested = opt.type === suggestedSession && opt.type !== 'conditioning';
          return (
            <Animated.View key={opt.type} entering={FadeInDown.delay(100 + i * 50).duration(350)} style={styles.cardWrapper}>
              <Pressable
                onPress={() => handleSelect(opt.type)}
                style={({ pressed }) => [
                  styles.sessionCard,
                  isSuggested && styles.sessionCardSuggested,
                  opt.type === 'conditioning' && styles.sessionCardConditioning,
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

      <Animated.View entering={FadeInDown.delay(380).duration(400)} style={styles.statsRow}>
        <View style={styles.statCard}>
          <View style={[styles.statIcon, { backgroundColor: Colors.primaryMuted }]}>
            <Ionicons name="flame-outline" size={18} color={Colors.primary} />
          </View>
          <Text style={styles.statNumber}>{streak}</Text>
          <Text style={styles.statLabel}>Day Streak</Text>
        </View>
        <View style={styles.statCard}>
          <View style={[styles.statIcon, { backgroundColor: '#e8f0fe' }]}>
            <Ionicons name="calendar-outline" size={18} color="#4285f4" />
          </View>
          <Text style={styles.statNumber}>{weekCount}</Text>
          <Text style={styles.statLabel}>This Week</Text>
        </View>
        <View style={styles.statCard}>
          <View style={[styles.statIcon, { backgroundColor: '#fce8e6' }]}>
            <Ionicons name="trophy-outline" size={18} color="#ea4335" />
          </View>
          <Text style={styles.statNumber}>{completedCount}</Text>
          <Text style={styles.statLabel}>Total</Text>
        </View>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(480).duration(400)} style={styles.infoRow}>
        <View style={styles.infoCard}>
          <Ionicons name="medical-outline" size={16} color={Colors.warning} />
          <Text style={styles.infoText}>Pain adaptive — 11 body regions</Text>
        </View>
        <View style={styles.infoCard}>
          <Ionicons name="time-outline" size={16} color={Colors.primary} />
          <Text style={styles.infoText}>30 · 45 · 60 min options</Text>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background, paddingHorizontal: 20 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  greetingText: { fontSize: 24, fontFamily: 'Inter_700Bold', color: Colors.text },
  tierText: { fontSize: 13, fontFamily: 'Inter_500Medium', color: Colors.textSecondary, marginTop: 2 },
  testWeekPill: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#fff3e0', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: '#ffe0b2' },
  testWeekPillText: { fontSize: 12, fontFamily: 'Inter_600SemiBold', color: '#e65100' },
  sessionCards: { flex: 1, gap: 8, marginBottom: 14 },
  cardWrapper: { flex: 1 },
  sessionCard: {
    flex: 1,
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
  sessionCardConditioning: {
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
  statIcon: { width: 32, height: 32, borderRadius: 9, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  statNumber: { fontSize: 20, fontFamily: 'Inter_700Bold', color: Colors.text },
  statLabel: { fontSize: 11, fontFamily: 'Inter_500Medium', color: Colors.textSecondary, marginTop: 1 },
  infoRow: { gap: 8 },
  infoCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface, borderRadius: 11, padding: 10, borderWidth: 1, borderColor: Colors.borderLight, gap: 8 },
  infoText: { fontSize: 12, fontFamily: 'Inter_400Regular', color: Colors.textSecondary, flex: 1 },
});
