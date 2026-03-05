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
import { useAppStore } from '@/lib/store';
import {
  getSessionLabel,
  getSessionSubtitle,
  getEquipmentLabel,
} from '@/lib/workout-engine';

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const {
    equipmentTier,
    completedCount,
    getCurrentSessionType,
    getStreakDays,
    getThisWeekCount,
    isTestWeekDue,
    getBestORM,
  } = useAppStore();

  const sessionType = getCurrentSessionType();
  const streak = getStreakDays();
  const weekCount = getThisWeekCount();
  const testWeek = isTestWeekDue();

  const handleStart = () => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (testWeek) {
      router.push({ pathname: '/readiness', params: { sessionType, isTestWeek: 'true' } });
    } else {
      router.push({ pathname: '/readiness', params: { sessionType, isTestWeek: 'false' } });
    }
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

      <Animated.View entering={FadeInDown.delay(150).duration(500)}>
        <Pressable
          onPress={handleStart}
          style={({ pressed }) => [
            styles.heroCard,
            testWeek && styles.heroCardTest,
            pressed && { opacity: 0.95, transform: [{ scale: 0.98 }] },
          ]}
          testID="start-session"
        >
          <View style={styles.heroContent}>
            <View style={styles.heroBadge}>
              <Text style={styles.heroBadgeText}>{testWeek ? 'TEST DAY' : 'UP NEXT'}</Text>
            </View>
            <Text style={styles.heroTitle}>{getSessionLabel(sessionType)}</Text>
            <Text style={styles.heroSub}>
              {testWeek ? 'Max effort testing protocol' : getSessionSubtitle(sessionType)}
            </Text>
            <View style={styles.heroAction}>
              <View style={styles.heroButton}>
                <Ionicons name="play" size={18} color={Colors.textInverse} />
                <Text style={styles.heroButtonText}>
                  {testWeek ? 'Start Test' : 'Start Session'}
                </Text>
              </View>
            </View>
          </View>
          <View style={styles.heroDecor}>
            <Ionicons name={testWeek ? 'trophy' : 'barbell'} size={64} color="rgba(255,255,255,0.15)" />
          </View>
        </Pressable>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(300).duration(500)} style={styles.statsRow}>
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

      <Animated.View entering={FadeInDown.delay(450).duration(500)} style={styles.section}>
        <Text style={styles.sectionTitle}>How It Works</Text>
        <View style={styles.infoCards}>
          <View style={styles.infoCard}>
            <View style={[styles.infoIcon, { backgroundColor: Colors.primaryMuted }]}>
              <Ionicons name="shuffle-outline" size={20} color={Colors.primary} />
            </View>
            <View style={styles.infoContent}>
              <Text style={styles.infoTitle}>Smart Rotation</Text>
              <Text style={styles.infoDesc}>Squat, Bench, Deadlift days cycle automatically</Text>
            </View>
          </View>
          <View style={styles.infoCard}>
            <View style={[styles.infoIcon, { backgroundColor: Colors.warningLight }]}>
              <Ionicons name="medical-outline" size={20} color={Colors.warning} />
            </View>
            <View style={styles.infoContent}>
              <Text style={styles.infoTitle}>Pain Adaptive</Text>
              <Text style={styles.infoDesc}>11 specific body regions with comfort swaps</Text>
            </View>
          </View>
          <View style={styles.infoCard}>
            <View style={[styles.infoIcon, { backgroundColor: '#e8f0fe' }]}>
              <Ionicons name="flash-outline" size={20} color="#4285f4" />
            </View>
            <View style={styles.infoContent}>
              <Text style={styles.infoTitle}>Energy + Time Matched</Text>
              <Text style={styles.infoDesc}>Volume adjusts to energy and available time</Text>
            </View>
          </View>
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
  heroCard: { backgroundColor: Colors.primary, borderRadius: 20, padding: 24, marginBottom: 20, overflow: 'hidden', position: 'relative' },
  heroCardTest: { backgroundColor: '#e65100' },
  heroContent: { zIndex: 1 },
  heroBadge: { alignSelf: 'flex-start', backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, marginBottom: 14 },
  heroBadgeText: { fontSize: 11, fontFamily: 'Inter_700Bold', color: Colors.textInverse, letterSpacing: 1 },
  heroTitle: { fontSize: 24, fontFamily: 'Inter_700Bold', color: Colors.textInverse, marginBottom: 4 },
  heroSub: { fontSize: 15, fontFamily: 'Inter_400Regular', color: 'rgba(255,255,255,0.8)', marginBottom: 20 },
  heroAction: { flexDirection: 'row' },
  heroButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 18, paddingVertical: 10, borderRadius: 12, gap: 8 },
  heroButtonText: { fontSize: 15, fontFamily: 'Inter_600SemiBold', color: Colors.textInverse },
  heroDecor: { position: 'absolute', right: 16, bottom: 16, opacity: 0.5 },
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 28 },
  statCard: { flex: 1, backgroundColor: Colors.surface, borderRadius: 16, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: Colors.borderLight },
  statIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  statNumber: { fontSize: 22, fontFamily: 'Inter_700Bold', color: Colors.text },
  statLabel: { fontSize: 12, fontFamily: 'Inter_500Medium', color: Colors.textSecondary, marginTop: 2 },
  section: { marginBottom: 20 },
  sectionTitle: { fontSize: 18, fontFamily: 'Inter_700Bold', color: Colors.text, marginBottom: 14 },
  infoCards: { gap: 10 },
  infoCard: { flexDirection: 'row', backgroundColor: Colors.surface, borderRadius: 14, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: Colors.borderLight },
  infoIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 14 },
  infoContent: { flex: 1 },
  infoTitle: { fontSize: 15, fontFamily: 'Inter_600SemiBold', color: Colors.text },
  infoDesc: { fontSize: 13, fontFamily: 'Inter_400Regular', color: Colors.textSecondary, marginTop: 1 },
});
