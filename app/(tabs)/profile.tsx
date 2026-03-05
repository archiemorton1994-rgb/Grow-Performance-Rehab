import React from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  Platform,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown } from 'react-native-reanimated';
import Colors from '@/constants/colors';
import { EquipmentTier, SessionType, TestWeekFrequency, useAppStore } from '@/lib/store';
import { getEquipmentLabel, getSessionLabel, getPainRegionLabel } from '@/lib/workout-engine';

const TIERS: EquipmentTier[] = ['bodyweight', 'dumbbells', 'fullgym'];
const LIFTS: SessionType[] = ['squat', 'bench', 'deadlift'];

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const {
    equipmentTier,
    setEquipmentTier,
    completedCount,
    completedSessions,
    getStreakDays,
    getThisWeekCount,
    resetProgress,
    getBestORM,
    oneRepMaxes,
    testWeekFrequency,
    setTestWeekFrequency,
  } = useAppStore();

  const streak = getStreakDays();
  const weekCount = getThisWeekCount();
  const recentSessions = completedSessions.slice(0, 10);

  const webTopInset = Platform.OS === 'web' ? 67 : 0;

  const handleTierChange = (tier: EquipmentTier) => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setEquipmentTier(tier);
  };

  const handleReset = () => {
    Alert.alert(
      'Reset Progress',
      'This will clear all your workout history, stats, and 1RM records. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: () => {
            if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            resetProgress();
          },
        },
      ]
    );
  };

  const toggleTestFrequency = () => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setTestWeekFrequency(testWeekFrequency === 12 ? 18 : 12);
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days} days ago`;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

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
      <Text style={styles.title}>Profile</Text>

      <Animated.View entering={FadeInDown.delay(100).duration(500)} style={styles.statsGrid}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{completedCount}</Text>
          <Text style={styles.statLabel}>Sessions</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{streak}</Text>
          <Text style={styles.statLabel}>Day Streak</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{weekCount}</Text>
          <Text style={styles.statLabel}>This Week</Text>
        </View>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(150).duration(500)} style={styles.section}>
        <Text style={styles.sectionTitle}>Strength Stats</Text>
        <View style={styles.ormCards}>
          {LIFTS.map((lift) => {
            const best = getBestORM(lift);
            const history = oneRepMaxes.filter(o => o.lift === lift).slice(0, 3);
            return (
              <View key={lift} style={styles.ormCard}>
                <View style={styles.ormHeader}>
                  <Text style={styles.ormLift}>{getSessionLabel(lift).replace(' Day', '')}</Text>
                  <Text style={styles.ormBest}>
                    {best ? `${best.weight} kg` : '—'}
                  </Text>
                </View>
                {history.length > 0 ? (
                  <View style={styles.ormHistory}>
                    {history.map((h, i) => (
                      <View key={i} style={styles.ormHistoryRow}>
                        <Text style={styles.ormHistoryWeight}>{h.weight} kg</Text>
                        <Text style={styles.ormHistoryDate}>{formatDate(h.date)}</Text>
                      </View>
                    ))}
                  </View>
                ) : (
                  <Text style={styles.ormEmpty}>Complete a test week to record</Text>
                )}
              </View>
            );
          })}
        </View>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(200).duration(500)} style={styles.section}>
        <Text style={styles.sectionTitle}>Equipment</Text>
        <View style={styles.tierOptions}>
          {TIERS.map((tier) => {
            const isActive = tier === equipmentTier;
            return (
              <Pressable
                key={tier}
                onPress={() => handleTierChange(tier)}
                style={({ pressed }) => [styles.tierOption, isActive && styles.tierOptionActive, pressed && { opacity: 0.8 }]}
                testID={`tier-${tier}`}
              >
                <Text style={[styles.tierText, isActive && styles.tierTextActive]}>
                  {getEquipmentLabel(tier)}
                </Text>
                {isActive && <Ionicons name="checkmark-circle" size={20} color={Colors.primary} />}
              </Pressable>
            );
          })}
        </View>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(250).duration(500)} style={styles.section}>
        <Text style={styles.sectionTitle}>Test Week Frequency</Text>
        <Pressable onPress={toggleTestFrequency} style={styles.freqOption} testID="test-freq-toggle">
          <View style={styles.freqContent}>
            <Text style={styles.freqLabel}>
              Every {testWeekFrequency === 12 ? '4 cycles (12 sessions)' : '6 cycles (18 sessions)'}
            </Text>
            <Text style={styles.freqSub}>
              {completedCount > 0 ? `Next test in ${testWeekFrequency - (completedCount % testWeekFrequency)} sessions` : 'Starts after first sessions'}
            </Text>
          </View>
          <View style={styles.freqToggle}>
            <Text style={styles.freqToggleText}>Change</Text>
          </View>
        </Pressable>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(300).duration(500)} style={styles.section}>
        <Text style={styles.sectionTitle}>Recent Sessions</Text>
        {recentSessions.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="barbell-outline" size={32} color={Colors.textTertiary} />
            <Text style={styles.emptyText}>No sessions completed yet</Text>
            <Text style={styles.emptySubtext}>Start your first workout to see history here</Text>
          </View>
        ) : (
          <View style={styles.historyList}>
            {recentSessions.map((session) => {
              const topWeight = session.exerciseLogs
                ? Math.max(0, ...session.exerciseLogs.flatMap(l => l.sets.map(s => s.weight)))
                : 0;
              return (
                <View key={session.id} style={styles.historyItem}>
                  <View style={[styles.historyDot, { backgroundColor: session.isTestWeek ? '#e65100' : Colors.primary }]} />
                  <View style={styles.historyContent}>
                    <View style={styles.historyTitleRow}>
                      <Text style={styles.historyTitle}>{getSessionLabel(session.sessionType)}</Text>
                      {session.isTestWeek && (
                        <View style={styles.testBadge}>
                          <Text style={styles.testBadgeText}>1RM</Text>
                        </View>
                      )}
                    </View>
                    <View style={styles.historyMeta}>
                      <Text style={styles.historyDate}>{formatDate(session.date)}</Text>
                      {session.timeAvailable && (
                        <Text style={styles.historyTime}>{session.timeAvailable} min</Text>
                      )}
                      {session.hadAches && session.painRegion && (
                        <View style={[styles.historyTag, { backgroundColor: Colors.badgeComfort }]}>
                          <Text style={[styles.historyTagText, { color: Colors.badgeComfortText }]}>
                            {getPainRegionLabel(session.painRegion)}
                          </Text>
                        </View>
                      )}
                      {topWeight > 0 && (
                        <Text style={styles.historyWeight}>{topWeight} kg</Text>
                      )}
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(400).duration(500)} style={styles.section}>
        <Pressable
          onPress={handleReset}
          style={({ pressed }) => [styles.resetButton, pressed && { opacity: 0.8 }]}
          testID="reset-progress"
        >
          <Ionicons name="refresh-outline" size={18} color={Colors.error} />
          <Text style={styles.resetText}>Reset All Progress</Text>
        </Pressable>
      </Animated.View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { paddingHorizontal: 20 },
  title: { fontSize: 26, fontFamily: 'Inter_700Bold', color: Colors.text, marginBottom: 20 },
  statsGrid: { flexDirection: 'row', backgroundColor: Colors.surface, borderRadius: 16, padding: 18, marginBottom: 28, borderWidth: 1, borderColor: Colors.borderLight, alignItems: 'center' },
  statItem: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 26, fontFamily: 'Inter_700Bold', color: Colors.primary },
  statLabel: { fontSize: 12, fontFamily: 'Inter_500Medium', color: Colors.textSecondary, marginTop: 2 },
  statDivider: { width: 1, height: 32, backgroundColor: Colors.border },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 18, fontFamily: 'Inter_700Bold', color: Colors.text, marginBottom: 12 },
  ormCards: { gap: 10 },
  ormCard: { backgroundColor: Colors.surface, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: Colors.borderLight },
  ormHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  ormLift: { fontSize: 16, fontFamily: 'Inter_600SemiBold', color: Colors.text },
  ormBest: { fontSize: 18, fontFamily: 'Inter_700Bold', color: Colors.primary },
  ormHistory: { gap: 4 },
  ormHistoryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  ormHistoryWeight: { fontSize: 14, fontFamily: 'Inter_500Medium', color: Colors.textSecondary },
  ormHistoryDate: { fontSize: 12, fontFamily: 'Inter_400Regular', color: Colors.textTertiary },
  ormEmpty: { fontSize: 13, fontFamily: 'Inter_400Regular', color: Colors.textTertiary },
  tierOptions: { gap: 8 },
  tierOption: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: Colors.surface, borderRadius: 12, padding: 16, borderWidth: 1, borderColor: Colors.borderLight },
  tierOptionActive: { borderColor: Colors.primary, backgroundColor: Colors.primarySurface },
  tierText: { fontSize: 15, fontFamily: 'Inter_500Medium', color: Colors.text },
  tierTextActive: { fontFamily: 'Inter_600SemiBold', color: Colors.primaryDark },
  freqOption: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: Colors.borderLight },
  freqContent: { flex: 1 },
  freqLabel: { fontSize: 15, fontFamily: 'Inter_600SemiBold', color: Colors.text },
  freqSub: { fontSize: 13, fontFamily: 'Inter_400Regular', color: Colors.textSecondary, marginTop: 2 },
  freqToggle: { backgroundColor: Colors.primaryMuted, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  freqToggleText: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: Colors.primary },
  emptyState: { alignItems: 'center', backgroundColor: Colors.surface, borderRadius: 14, padding: 32, borderWidth: 1, borderColor: Colors.borderLight },
  emptyText: { fontSize: 16, fontFamily: 'Inter_600SemiBold', color: Colors.text, marginTop: 12 },
  emptySubtext: { fontSize: 13, fontFamily: 'Inter_400Regular', color: Colors.textSecondary, marginTop: 4, textAlign: 'center' },
  historyList: { gap: 8 },
  historyItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: Colors.borderLight },
  historyDot: { width: 8, height: 8, borderRadius: 4, marginRight: 12 },
  historyContent: { flex: 1 },
  historyTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  historyTitle: { fontSize: 15, fontFamily: 'Inter_600SemiBold', color: Colors.text },
  testBadge: { backgroundColor: '#fff3e0', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4 },
  testBadgeText: { fontSize: 9, fontFamily: 'Inter_700Bold', color: '#e65100' },
  historyMeta: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3, flexWrap: 'wrap' },
  historyDate: { fontSize: 12, fontFamily: 'Inter_400Regular', color: Colors.textSecondary },
  historyTime: { fontSize: 12, fontFamily: 'Inter_500Medium', color: Colors.textTertiary },
  historyTag: { paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4 },
  historyTagText: { fontSize: 10, fontFamily: 'Inter_600SemiBold' },
  historyWeight: { fontSize: 12, fontFamily: 'Inter_600SemiBold', color: Colors.primary },
  resetButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 12, backgroundColor: Colors.errorLight },
  resetText: { fontSize: 15, fontFamily: 'Inter_600SemiBold', color: Colors.error },
});
