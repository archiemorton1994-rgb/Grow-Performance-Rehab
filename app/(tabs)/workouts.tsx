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
import Animated, { FadeInDown } from 'react-native-reanimated';
import Colors from '@/constants/colors';
import { SessionType, useAppStore } from '@/lib/store';
import { getSessionLabel, getSessionSubtitle, getEquipmentLabel } from '@/lib/workout-engine';

const SESSION_ORDER: SessionType[] = ['squat', 'bench', 'deadlift'];

const SESSION_ICONS: Record<SessionType, keyof typeof Ionicons.glyphMap> = {
  squat: 'fitness',
  bench: 'body',
  deadlift: 'barbell',
  conditioning: 'flame-outline',
  prehab: 'shield-checkmark-outline',
  flexibility: 'leaf-outline',
};

const SESSION_COLORS: Record<SessionType, { bg: string; accent: string }> = {
  squat: { bg: Colors.primaryMuted, accent: Colors.primary },
  bench: { bg: '#e8f0fe', accent: '#4285f4' },
  deadlift: { bg: '#fce8e6', accent: '#ea4335' },
  conditioning: { bg: '#fbe9e7', accent: '#e65100' },
  prehab: { bg: '#fff3e0', accent: '#e65100' },
  flexibility: { bg: '#e8f5e9', accent: '#2e7d32' },
};

export default function WorkoutsScreen() {
  const insets = useSafeAreaInsets();
  const { completedCount, equipmentTier, completedSessions, isTestWeekDue, testWeekFrequency } = useAppStore();
  const webTopInset = Platform.OS === 'web' ? 67 : 0;
  const testWeek = isTestWeekDue();

  const handleStart = (sessionType: SessionType, isTest: boolean) => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push({ pathname: '/readiness', params: { sessionType, isTestWeek: isTest ? 'true' : 'false' } });
  };

  const timelineItems: { sessionType: SessionType; status: 'completed' | 'current' | 'upcoming'; isTestMarker: boolean }[] = [];

  for (let i = 0; i < 9; i++) {
    const sessionIndex = i % 3;
    const sessionType = SESSION_ORDER[sessionIndex];
    let status: 'completed' | 'current' | 'upcoming';

    if (i < completedCount % 9) {
      status = 'completed';
    } else if (i === completedCount % 9) {
      status = 'current';
    } else {
      status = 'upcoming';
    }

    const sessionNumber = completedCount - (completedCount % 9) + i + 1;
    const isTestMarker = sessionNumber % testWeekFrequency === 0;

    timelineItems.push({ sessionType, status, isTestMarker });
  }

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
      <Text style={styles.title}>Program</Text>
      <Text style={styles.subtitle}>3-day rotation with {getEquipmentLabel(equipmentTier)}</Text>

      <View style={styles.cycleInfo}>
        <View style={styles.cycleCard}>
          <Text style={styles.cycleNumber}>{Math.floor(completedCount / 3) + 1}</Text>
          <Text style={styles.cycleLabel}>Current Cycle</Text>
        </View>
        <View style={styles.cycleDivider} />
        <View style={styles.cycleCard}>
          <Text style={styles.cycleNumber}>{completedCount}</Text>
          <Text style={styles.cycleLabel}>Sessions Done</Text>
        </View>
        <View style={styles.cycleDivider} />
        <View style={styles.cycleCard}>
          <Text style={styles.cycleNumber}>
            {completedCount > 0 ? testWeekFrequency - (completedCount % testWeekFrequency) : testWeekFrequency}
          </Text>
          <Text style={styles.cycleLabel}>To Test Week</Text>
        </View>
      </View>

      <View style={styles.timeline}>
        {timelineItems.map((item, index) => {
          const colors = SESSION_COLORS[item.sessionType];
          const isCurrent = item.status === 'current';
          const isCompleted = item.status === 'completed';

          return (
            <Animated.View key={index} entering={FadeInDown.delay(index * 50).duration(400)}>
              <View style={styles.timelineRow}>
                <View style={styles.timelineTrack}>
                  <View style={[
                    styles.timelineDot,
                    isCompleted && styles.timelineDotDone,
                    isCurrent && styles.timelineDotCurrent,
                    isCurrent && testWeek && styles.timelineDotTest,
                  ]}>
                    {isCompleted && <Ionicons name="checkmark" size={12} color={Colors.textInverse} />}
                    {isCurrent && <View style={[styles.currentPulse, testWeek && { backgroundColor: '#e65100' }]} />}
                  </View>
                  {index < timelineItems.length - 1 && (
                    <View style={[styles.timelineLine, isCompleted && styles.timelineLineDone]} />
                  )}
                </View>

                <Pressable
                  onPress={() => isCurrent ? handleStart(item.sessionType, testWeek) : null}
                  disabled={!isCurrent}
                  style={({ pressed }) => [
                    styles.timelineCard,
                    isCurrent && styles.timelineCardCurrent,
                    isCurrent && testWeek && styles.timelineCardTest,
                    isCompleted && styles.timelineCardDone,
                    pressed && isCurrent && { opacity: 0.9, transform: [{ scale: 0.98 }] },
                  ]}
                >
                  <View style={[styles.cardIcon, { backgroundColor: colors.bg }]}>
                    <Ionicons name={isCurrent && testWeek ? 'trophy' : SESSION_ICONS[item.sessionType]} size={20} color={isCurrent && testWeek ? '#e65100' : colors.accent} />
                  </View>
                  <View style={styles.cardContent}>
                    <Text style={[styles.cardTitle, isCompleted && styles.cardTitleDone]}>
                      {getSessionLabel(item.sessionType)}
                    </Text>
                    <Text style={styles.cardSub}>
                      {isCurrent && testWeek ? 'Strength Test' : getSessionSubtitle(item.sessionType)}
                    </Text>
                  </View>
                  {isCurrent && (
                    <View style={[styles.startPill, testWeek && { backgroundColor: '#e65100' }]}>
                      <Ionicons name="play" size={14} color={Colors.textInverse} />
                    </View>
                  )}
                  {isCompleted && (
                    <Ionicons name="checkmark-circle" size={22} color={Colors.primary} />
                  )}
                  {item.isTestMarker && !isCurrent && (
                    <View style={styles.testMarker}>
                      <Ionicons name="trophy-outline" size={14} color="#e65100" />
                    </View>
                  )}
                </Pressable>
              </View>
            </Animated.View>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { paddingHorizontal: 20 },
  title: { fontSize: 26, fontFamily: 'Inter_700Bold', color: Colors.text },
  subtitle: { fontSize: 14, fontFamily: 'Inter_500Medium', color: Colors.textSecondary, marginTop: 2, marginBottom: 20 },
  cycleInfo: { flexDirection: 'row', backgroundColor: Colors.surface, borderRadius: 16, padding: 18, marginBottom: 24, borderWidth: 1, borderColor: Colors.borderLight, alignItems: 'center' },
  cycleCard: { flex: 1, alignItems: 'center' },
  cycleNumber: { fontSize: 28, fontFamily: 'Inter_700Bold', color: Colors.primary },
  cycleLabel: { fontSize: 12, fontFamily: 'Inter_500Medium', color: Colors.textSecondary, marginTop: 2 },
  cycleDivider: { width: 1, height: 36, backgroundColor: Colors.border },
  timeline: {},
  timelineRow: { flexDirection: 'row' },
  timelineTrack: { width: 30, alignItems: 'center' },
  timelineDot: { width: 20, height: 20, borderRadius: 10, backgroundColor: Colors.surfaceTertiary, borderWidth: 2, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center', zIndex: 1 },
  timelineDotDone: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  timelineDotCurrent: { backgroundColor: Colors.surface, borderColor: Colors.primary, borderWidth: 3 },
  timelineDotTest: { borderColor: '#e65100' },
  currentPulse: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.primary },
  timelineLine: { width: 2, flex: 1, backgroundColor: Colors.border, marginVertical: -2 },
  timelineLineDone: { backgroundColor: Colors.primary },
  timelineCard: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface, borderRadius: 14, padding: 14, marginLeft: 12, marginBottom: 8, borderWidth: 1, borderColor: Colors.borderLight },
  timelineCardCurrent: { borderColor: Colors.primary, borderWidth: 2 },
  timelineCardTest: { borderColor: '#e65100' },
  timelineCardDone: { opacity: 0.7 },
  cardIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  cardContent: { flex: 1 },
  cardTitle: { fontSize: 15, fontFamily: 'Inter_600SemiBold', color: Colors.text },
  cardTitleDone: { textDecorationLine: 'line-through' as const, color: Colors.textSecondary },
  cardSub: { fontSize: 12, fontFamily: 'Inter_400Regular', color: Colors.textSecondary, marginTop: 1 },
  startPill: { width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  testMarker: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#fff3e0', alignItems: 'center', justifyContent: 'center' },
});
