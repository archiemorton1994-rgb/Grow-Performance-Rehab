import React from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  Platform,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
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
    icon: 'trending-down-outline',
    color: Colors.primary,
    bg: Colors.primaryMuted,
  },
  {
    type: 'bench',
    label: 'Upper Body',
    subtitle: 'Push pattern',
    muscles: 'Chest · Shoulders · Triceps',
    icon: 'arrow-up-outline',
    color: '#4285f4',
    bg: '#e8f0fe',
  },
  {
    type: 'deadlift',
    label: 'Full Body',
    subtitle: 'Hinge pattern',
    muscles: 'Posterior Chain · Back · Core',
    icon: 'body-outline',
    color: '#9c27b0',
    bg: '#f3e5f5',
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
  } = useAppStore();

  const suggestedSession = getCurrentSessionType();
  const streak = getStreakDays();
  const weekCount = getThisWeekCount();
  const testWeek = isTestWeekDue();

  const handleSelect = (sessionType: SessionType) => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push({
      pathname: '/readiness',
      params: { sessionType, isTestWeek: testWeek ? 'true' : 'false' },
    });
  };

  const webTopInset = Platform.OS === 'web' ? 67 : 0;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[
        styles.content,
        {
          paddingTop: insets.top + webTopInset + 16,
          paddingBottom: insets.bottom + (Platform.OS === 'web' ? 34 : 0) + 100,
        },
      ]}
      showsVerticalScrollIndicator={false}
    >
      <Animated.View entering={FadeInUp.duration(500)} style={styles.greeting}>
        <View style={styles.greetingLeft}>
          <Text style={styles.greetingText}>Ready to grow</Text>
          <Text style={styles.tierText}>{getEquipmentLabel(equipmentTier)}</Text>
        </View>
        <View style={styles.avatarCircle}>
          <Ionicons name="body" size={22} color={Colors.primary} />
        </View>
      </Animated.View>

      {testWeek && (
        <Animated.View entering={FadeInDown.delay(100).duration(500)}>
          <View style={styles.testWeekBanner}>
            <View style={styles.testWeekIcon}>
              <Ionicons name="trophy" size={20} color="#e65100" />
            </View>
            <View style={styles.testWeekContent}>
              <Text style={styles.testWeekTitle}>1RM Test Week</Text>
              <Text style={styles.testWeekSub}>Time to test your strength progress</Text>
            </View>
          </View>
        </Animated.View>
      )}

      <Animated.View entering={FadeInDown.delay(150).duration(500)} style={styles.section}>
        <Text style={styles.sectionTitle}>Choose your session</Text>
        <Text style={styles.sectionSub}>Select what you want to train today</Text>
        <View style={styles.sessionCards}>
          {SESSION_OPTIONS.map((opt, i) => {
            const isSuggested = opt.type === suggestedSession;
            return (
              <Animated.View key={opt.type} entering={FadeInDown.delay(200 + i * 80).duration(400)}>
                <Pressable
                  onPress={() => handleSelect(opt.type)}
                  style={({ pressed }) => [
                    styles.sessionCard,
                    isSuggested && styles.sessionCardSuggested,
                    pressed && { opacity: 0.92, transform: [{ scale: 0.98 }] },
                  ]}
                  testID={`session-${opt.type}`}
                >
                  <View style={[styles.sessionIconWrap, { backgroundColor: opt.bg }]}>
                    <Ionicons name={opt.icon} size={28} color={opt.color} />
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
                    <Text style={styles.sessionCardSub}>{opt.subtitle}</Text>
                    <Text style={styles.sessionCardMuscles}>{opt.muscles}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={Colors.textTertiary} />
                </Pressable>
              </Animated.View>
            );
          })}
        </View>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(500).duration(500)} style={styles.statsRow}>
        <View style={styles.statCard}>
          <View style={[styles.statIcon, { backgroundColor: Colors.primaryMuted }]}>
            <Ionicons name="flame-outline" size={20} color={Colors.primary} />
          </View>
          <Text style={styles.statNumber}>{streak}</Text>
          <Text style={styles.statLabel}>Day Streak</Text>
        </View>
        <View style={styles.statCard}>
          <View style={[styles.statIcon, { backgroundColor: '#e8f0fe' }]}>
            <Ionicons name="calendar-outline" size={20} color="#4285f4" />
          </View>
          <Text style={styles.statNumber}>{weekCount}</Text>
          <Text style={styles.statLabel}>This Week</Text>
        </View>
        <View style={styles.statCard}>
          <View style={[styles.statIcon, { backgroundColor: '#fce8e6' }]}>
            <Ionicons name="trophy-outline" size={20} color="#ea4335" />
          </View>
          <Text style={styles.statNumber}>{completedCount}</Text>
          <Text style={styles.statLabel}>Total</Text>
        </View>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(650).duration(500)} style={styles.infoRow}>
        <View style={styles.infoCard}>
          <Ionicons name="medical-outline" size={18} color={Colors.warning} />
          <Text style={styles.infoText}>Pain adaptive — 11 body regions</Text>
        </View>
        <View style={styles.infoCard}>
          <Ionicons name="time-outline" size={18} color={Colors.primary} />
          <Text style={styles.infoText}>30 · 45 · 60 min options</Text>
        </View>
      </Animated.View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { paddingHorizontal: 20 },
  greeting: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 },
  greetingLeft: {},
  greetingText: { fontSize: 26, fontFamily: 'Inter_700Bold', color: Colors.text },
  tierText: { fontSize: 14, fontFamily: 'Inter_500Medium', color: Colors.textSecondary, marginTop: 2 },
  avatarCircle: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.primaryMuted, alignItems: 'center', justifyContent: 'center' },
  testWeekBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff3e0', borderRadius: 14, padding: 14, marginBottom: 14, borderWidth: 1, borderColor: '#ffe0b2' },
  testWeekIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#ffe0b2', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  testWeekContent: { flex: 1 },
  testWeekTitle: { fontSize: 15, fontFamily: 'Inter_600SemiBold', color: '#e65100' },
  testWeekSub: { fontSize: 13, fontFamily: 'Inter_400Regular', color: '#bf360c', marginTop: 1 },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 20, fontFamily: 'Inter_700Bold', color: Colors.text, marginBottom: 4 },
  sectionSub: { fontSize: 14, fontFamily: 'Inter_400Regular', color: Colors.textSecondary, marginBottom: 16 },
  sessionCards: { gap: 12 },
  sessionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    gap: 14,
  },
  sessionCardSuggested: {
    borderColor: Colors.primary,
    borderWidth: 2,
    backgroundColor: Colors.primarySurface,
  },
  sessionIconWrap: { width: 56, height: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  sessionCardContent: { flex: 1 },
  sessionCardTop: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 },
  sessionCardLabel: { fontSize: 17, fontFamily: 'Inter_700Bold', color: Colors.text },
  suggestedBadge: { backgroundColor: Colors.primary, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 5 },
  suggestedBadgeText: { fontSize: 9, fontFamily: 'Inter_700Bold', color: Colors.textInverse, letterSpacing: 0.5 },
  sessionCardSub: { fontSize: 13, fontFamily: 'Inter_500Medium', color: Colors.textSecondary },
  sessionCardMuscles: { fontSize: 12, fontFamily: 'Inter_400Regular', color: Colors.textTertiary, marginTop: 1 },
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  statCard: { flex: 1, backgroundColor: Colors.surface, borderRadius: 16, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: Colors.borderLight },
  statIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  statNumber: { fontSize: 22, fontFamily: 'Inter_700Bold', color: Colors.text },
  statLabel: { fontSize: 12, fontFamily: 'Inter_500Medium', color: Colors.textSecondary, marginTop: 2 },
  infoRow: { gap: 8, marginBottom: 10 },
  infoCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: Colors.borderLight, gap: 10 },
  infoText: { fontSize: 13, fontFamily: 'Inter_400Regular', color: Colors.textSecondary, flex: 1 },
});
