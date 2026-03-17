import React, { useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  Platform,
  Alert,
  TextInput,
  Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown } from 'react-native-reanimated';
import Colors from '@/constants/colors';
import { EquipmentTier, SessionType, ExperienceLevel, FitnessGoal, useAppStore } from '@/lib/store';
import { getEquipmentLabel, getEquipmentIcon, getSessionLabel, getPainRegionLabel } from '@/lib/workout-engine';

const ALL_TIERS: EquipmentTier[] = ['bodyweight', 'bands', 'dumbbells', 'kettlebells', 'fullgym'];
const LIFTS: SessionType[] = ['squat', 'bench', 'deadlift'];

const EXPERIENCE_OPTIONS: { value: ExperienceLevel; label: string; desc: string }[] = [
  { value: 'beginner', label: 'Beginner', desc: 'New to gym or returning after a long break' },
  { value: 'intermediate', label: 'Intermediate', desc: '1–3 years consistent training' },
  { value: 'advanced', label: 'Advanced', desc: '3+ years, familiar with main lifts' },
];

const GOAL_OPTIONS: { value: FitnessGoal; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { value: 'strength', label: 'Build Strength', icon: 'barbell-outline' },
  { value: 'muscle', label: 'Build Muscle', icon: 'body-outline' },
  { value: 'fat_loss', label: 'Fat Loss', icon: 'flame-outline' },
  { value: 'fitness', label: 'General Fitness', icon: 'heart-outline' },
  { value: 'rehab', label: 'Rehab & Recover', icon: 'medical-outline' },
];

const SESSION_MILESTONES = [1, 5, 10, 25, 50, 100, 150, 200];

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
    userProfile,
    setUserProfile,
  } = useAppStore();

  const streak = getStreakDays();
  const weekCount = getThisWeekCount();
  const recentSessions = completedSessions.slice(0, 8);
  const nextMilestone = SESSION_MILESTONES.find(m => m > completedCount) ?? null;

  const [editNameModal, setEditNameModal] = useState(false);
  const [editName, setEditName] = useState(userProfile.name);
  const [showEquipmentModal, setShowEquipmentModal] = useState(false);

  const webTopInset = Platform.OS === 'web' ? 67 : 0;

  const handleTierChange = (tier: EquipmentTier) => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setEquipmentTier(tier);
    setShowEquipmentModal(false);
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

  const saveName = () => {
    setUserProfile({ name: editName.trim() });
    setEditNameModal(false);
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days} days ago`;
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  };

  const displayName = userProfile.name || 'Your Name';
  const milestoneProgress = nextMilestone
    ? Math.min(completedCount / nextMilestone, 1)
    : 1;

  const earnedMilestones = SESSION_MILESTONES.filter(m => completedCount >= m);
  const bestStreak = streak;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + webTopInset + 8, paddingBottom: insets.bottom + (Platform.OS === 'web' ? 34 : 0) + 100 },
      ]}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      {/* Hero Profile Card */}
      <Animated.View entering={FadeInDown.delay(0).duration(500)} style={styles.heroCard}>
        <View style={styles.heroLeft}>
          <Pressable onPress={() => { setEditName(userProfile.name); setEditNameModal(true); }} style={styles.avatarContainer}>
            <View style={styles.avatar}>
              <Text style={styles.avatarInitial}>
                {userProfile.name ? userProfile.name[0].toUpperCase() : '?'}
              </Text>
            </View>
            <View style={styles.avatarEdit}>
              <Ionicons name="pencil" size={10} color="#fff" />
            </View>
          </Pressable>
          <View style={styles.heroInfo}>
            <Pressable onPress={() => { setEditName(userProfile.name); setEditNameModal(true); }}>
              <Text style={styles.heroName}>{displayName}</Text>
            </Pressable>
            <View style={styles.heroTags}>
              <View style={styles.heroTag}>
                <Text style={styles.heroTagText}>
                  {EXPERIENCE_OPTIONS.find(e => e.value === userProfile.experienceLevel)?.label ?? 'Beginner'}
                </Text>
              </View>
              <View style={[styles.heroTag, { backgroundColor: Colors.primaryMuted }]}>
                <Text style={[styles.heroTagText, { color: Colors.primaryDark }]}>
                  {GOAL_OPTIONS.find(g => g.value === userProfile.goal)?.label ?? 'Fitness'}
                </Text>
              </View>
            </View>
          </View>
        </View>
      </Animated.View>

      {/* Stats Row */}
      <Animated.View entering={FadeInDown.delay(80).duration(500)} style={styles.statsGrid}>
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

      {/* Milestone Progress */}
      {(nextMilestone !== null || completedCount > 0) && (
        <Animated.View entering={FadeInDown.delay(120).duration(500)} style={styles.section}>
          <Text style={styles.sectionTitle}>Your Journey</Text>
          {nextMilestone !== null ? (
            <View style={styles.milestoneCard}>
              <View style={styles.milestoneTop}>
                <Ionicons name="flag-outline" size={18} color={Colors.primary} />
                <Text style={styles.milestoneLabel}>
                  {completedCount} / {nextMilestone} sessions to next milestone
                </Text>
              </View>
              <View style={styles.milestoneTrack}>
                <View style={[styles.milestoneFill, { width: `${milestoneProgress * 100}%` as any }]} />
              </View>
            </View>
          ) : (
            <View style={styles.milestoneCard}>
              <Ionicons name="trophy" size={20} color="#f59e0b" />
              <Text style={styles.milestoneLabel}>All milestones achieved — legend!</Text>
            </View>
          )}
          {earnedMilestones.length > 0 && (
            <View style={styles.badgesRow}>
              {earnedMilestones.map(m => (
                <View key={m} style={styles.badge}>
                  <Ionicons name="trophy" size={14} color="#f59e0b" />
                  <Text style={styles.badgeText}>{m}</Text>
                </View>
              ))}
            </View>
          )}
        </Animated.View>
      )}

      {/* KPI Strength Stats */}
      <Animated.View entering={FadeInDown.delay(160).duration(500)} style={styles.section}>
        <Text style={styles.sectionTitle}>Strength KPIs</Text>
        <View style={styles.ormCards}>
          {LIFTS.map((lift) => {
            const best = getBestORM(lift);
            const history = oneRepMaxes
              .filter(o => o.lift === lift)
              .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
              .slice(0, 4);
            const isImproving = history.length >= 2 && history[0].weight > history[1].weight;
            return (
              <View key={lift} style={styles.ormCard}>
                <View style={styles.ormHeader}>
                  <View>
                    <Text style={styles.ormLift}>{getSessionLabel(lift)}</Text>
                    <Text style={styles.ormSub}>KPI Lift</Text>
                  </View>
                  <View style={styles.ormRight}>
                    <Text style={styles.ormBest}>{best ? `${best.weight} kg` : '—'}</Text>
                    {isImproving && (
                      <View style={styles.improvingBadge}>
                        <Ionicons name="trending-up" size={12} color={Colors.primary} />
                        <Text style={styles.improvingText}>PB</Text>
                      </View>
                    )}
                  </View>
                </View>
                {history.length > 1 ? (
                  <View style={styles.ormHistory}>
                    {history.map((h, i) => {
                      const prev = history[i + 1];
                      const diff = prev ? h.weight - prev.weight : null;
                      return (
                        <View key={i} style={styles.ormHistoryRow}>
                          <Text style={styles.ormHistoryWeight}>{h.weight} kg</Text>
                          {diff !== null && diff !== 0 && (
                            <Text style={[styles.ormDiff, { color: diff > 0 ? Colors.primary : '#e53e3e' }]}>
                              {diff > 0 ? `+${diff}` : diff} kg
                            </Text>
                          )}
                          <Text style={styles.ormHistoryDate}>{formatDate(h.date)}</Text>
                        </View>
                      );
                    })}
                  </View>
                ) : history.length === 1 ? (
                  <Text style={styles.ormEmpty}>Complete another test week to track progress</Text>
                ) : (
                  <Text style={styles.ormEmpty}>Complete a test week to record your KPI</Text>
                )}
              </View>
            );
          })}
        </View>
      </Animated.View>

      {/* Profile Settings */}
      <Animated.View entering={FadeInDown.delay(200).duration(500)} style={styles.section}>
        <Text style={styles.sectionTitle}>Settings</Text>

        {/* Equipment */}
        <Pressable onPress={() => setShowEquipmentModal(true)} style={styles.settingRow}>
          <View style={styles.settingLeft}>
            <Ionicons name={getEquipmentIcon(equipmentTier) as any} size={20} color={Colors.primary} />
            <View>
              <Text style={styles.settingLabel}>Equipment</Text>
              <Text style={styles.settingValue}>{getEquipmentLabel(equipmentTier)}</Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={18} color={Colors.textTertiary} />
        </Pressable>

        {/* Experience Level */}
        <View style={styles.settingSection}>
          <Text style={styles.settingSubTitle}>Experience Level</Text>
          {EXPERIENCE_OPTIONS.map(opt => (
            <Pressable
              key={opt.value}
              onPress={() => { setUserProfile({ experienceLevel: opt.value }); if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
              style={[styles.optionRow, userProfile.experienceLevel === opt.value && styles.optionRowActive]}
            >
              <View style={styles.optionLeft}>
                <Text style={[styles.optionLabel, userProfile.experienceLevel === opt.value && styles.optionLabelActive]}>{opt.label}</Text>
                <Text style={styles.optionDesc}>{opt.desc}</Text>
              </View>
              {userProfile.experienceLevel === opt.value && <Ionicons name="checkmark-circle" size={20} color={Colors.primary} />}
            </Pressable>
          ))}
        </View>

        {/* Goal */}
        <View style={styles.settingSection}>
          <Text style={styles.settingSubTitle}>Primary Goal</Text>
          <View style={styles.goalGrid}>
            {GOAL_OPTIONS.map(opt => (
              <Pressable
                key={opt.value}
                onPress={() => { setUserProfile({ goal: opt.value }); if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
                style={[styles.goalOption, userProfile.goal === opt.value && styles.goalOptionActive]}
              >
                <Ionicons name={opt.icon} size={20} color={userProfile.goal === opt.value ? Colors.primary : Colors.textTertiary} />
                <Text style={[styles.goalLabel, userProfile.goal === opt.value && styles.goalLabelActive]}>
                  {opt.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Test Week Frequency */}
        <Pressable onPress={toggleTestFrequency} style={styles.settingRow} testID="test-freq-toggle">
          <View style={styles.settingLeft}>
            <Ionicons name="calendar-outline" size={20} color={Colors.primary} />
            <View>
              <Text style={styles.settingLabel}>Test Week Frequency</Text>
              <Text style={styles.settingValue}>
                Every {testWeekFrequency === 12 ? '12 sessions' : '18 sessions'}
              </Text>
            </View>
          </View>
          <View style={styles.togglePill}>
            <Text style={styles.toggleText}>Tap to change</Text>
          </View>
        </Pressable>
      </Animated.View>

      {/* Recent Sessions */}
      <Animated.View entering={FadeInDown.delay(240).duration(500)} style={styles.section}>
        <Text style={styles.sectionTitle}>Recent Sessions</Text>
        {recentSessions.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="barbell-outline" size={32} color={Colors.textTertiary} />
            <Text style={styles.emptyText}>No sessions yet</Text>
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
                      {topWeight > 0 && (
                        <Text style={styles.historyWeight}>{topWeight} kg top</Text>
                      )}
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(280).duration(500)} style={styles.section}>
        <Pressable onPress={handleReset} style={({ pressed }) => [styles.resetButton, pressed && { opacity: 0.8 }]} testID="reset-progress">
          <Ionicons name="refresh-outline" size={18} color={Colors.error} />
          <Text style={styles.resetText}>Reset All Progress</Text>
        </Pressable>
      </Animated.View>

      {/* Edit Name Modal */}
      <Modal visible={editNameModal} transparent animationType="fade" onRequestClose={() => setEditNameModal(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setEditNameModal(false)}>
          <Pressable style={styles.modalContent} onPress={e => e.stopPropagation()}>
            <Text style={styles.modalTitle}>Your Name</Text>
            <TextInput
              style={styles.nameInput}
              value={editName}
              onChangeText={setEditName}
              placeholder="Enter your name"
              placeholderTextColor={Colors.textTertiary}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={saveName}
            />
            <Pressable onPress={saveName} style={styles.saveBtn}>
              <Text style={styles.saveBtnText}>Save</Text>
            </Pressable>
            <Pressable onPress={() => setEditNameModal(false)} style={styles.cancelBtn}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Equipment Modal */}
      <Modal visible={showEquipmentModal} transparent animationType="slide" onRequestClose={() => setShowEquipmentModal(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setShowEquipmentModal(false)}>
          <Pressable style={[styles.modalContent, { width: '100%', maxWidth: 400, paddingBottom: 24 }]} onPress={e => e.stopPropagation()}>
            <Text style={styles.modalTitle}>Select Equipment</Text>
            <Text style={styles.modalSub}>Choose what you have available for your workouts</Text>
            {ALL_TIERS.map((tier) => {
              const isActive = tier === equipmentTier;
              return (
                <Pressable key={tier} onPress={() => handleTierChange(tier)} style={[styles.equipOption, isActive && styles.equipOptionActive]} testID={`tier-${tier}`}>
                  <Ionicons name={getEquipmentIcon(tier) as any} size={22} color={isActive ? Colors.primary : Colors.textTertiary} />
                  <Text style={[styles.equipLabel, isActive && styles.equipLabelActive]}>{getEquipmentLabel(tier)}</Text>
                  {isActive && <Ionicons name="checkmark-circle" size={20} color={Colors.primary} />}
                </Pressable>
              );
            })}
            <Pressable onPress={() => setShowEquipmentModal(false)} style={styles.cancelBtn}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { paddingHorizontal: 20 },
  heroCard: { backgroundColor: Colors.surface, borderRadius: 18, padding: 18, marginBottom: 16, borderWidth: 1, borderColor: Colors.borderLight },
  heroLeft: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  avatarContainer: { position: 'relative' },
  avatar: { width: 60, height: 60, borderRadius: 30, backgroundColor: Colors.primaryMuted, alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { fontSize: 26, fontFamily: 'Inter_700Bold', color: Colors.primary },
  avatarEdit: { position: 'absolute', bottom: 0, right: 0, width: 20, height: 20, borderRadius: 10, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  heroInfo: { flex: 1 },
  heroName: { fontSize: 20, fontFamily: 'Inter_700Bold', color: Colors.text, marginBottom: 6 },
  heroTags: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  heroTag: { paddingHorizontal: 8, paddingVertical: 3, backgroundColor: Colors.surfaceTertiary, borderRadius: 6 },
  heroTagText: { fontSize: 11, fontFamily: 'Inter_500Medium', color: Colors.textSecondary },
  statsGrid: { flexDirection: 'row', backgroundColor: Colors.surface, borderRadius: 16, padding: 18, marginBottom: 20, borderWidth: 1, borderColor: Colors.borderLight, alignItems: 'center' },
  statItem: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 26, fontFamily: 'Inter_700Bold', color: Colors.primary },
  statLabel: { fontSize: 12, fontFamily: 'Inter_500Medium', color: Colors.textSecondary, marginTop: 2 },
  statDivider: { width: 1, height: 32, backgroundColor: Colors.border },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 18, fontFamily: 'Inter_700Bold', color: Colors.text, marginBottom: 12 },
  milestoneCard: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: Colors.surface, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: Colors.borderLight, marginBottom: 10 },
  milestoneTop: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  milestoneLabel: { fontSize: 14, fontFamily: 'Inter_500Medium', color: Colors.text, flex: 1 },
  milestoneTrack: { height: 6, backgroundColor: Colors.surfaceTertiary, borderRadius: 3, overflow: 'hidden' },
  milestoneFill: { height: '100%', backgroundColor: Colors.primary, borderRadius: 3 },
  badgesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#fef9c3', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  badgeText: { fontSize: 12, fontFamily: 'Inter_600SemiBold', color: '#92400e' },
  ormCards: { gap: 10 },
  ormCard: { backgroundColor: Colors.surface, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: Colors.borderLight },
  ormHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  ormLift: { fontSize: 16, fontFamily: 'Inter_600SemiBold', color: Colors.text },
  ormSub: { fontSize: 11, fontFamily: 'Inter_400Regular', color: Colors.textTertiary },
  ormRight: { alignItems: 'flex-end', gap: 4 },
  ormBest: { fontSize: 20, fontFamily: 'Inter_700Bold', color: Colors.primary },
  improvingBadge: { flexDirection: 'row', alignItems: 'center', gap: 2, backgroundColor: Colors.primaryMuted, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  improvingText: { fontSize: 10, fontFamily: 'Inter_600SemiBold', color: Colors.primary },
  ormHistory: { gap: 5, borderTopWidth: 1, borderTopColor: Colors.borderLight, paddingTop: 8 },
  ormHistoryRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  ormHistoryWeight: { fontSize: 14, fontFamily: 'Inter_500Medium', color: Colors.textSecondary, flex: 1 },
  ormDiff: { fontSize: 12, fontFamily: 'Inter_600SemiBold' },
  ormHistoryDate: { fontSize: 12, fontFamily: 'Inter_400Regular', color: Colors.textTertiary },
  ormEmpty: { fontSize: 13, fontFamily: 'Inter_400Regular', color: Colors.textTertiary },
  settingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: Colors.surface, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: Colors.borderLight, marginBottom: 8 },
  settingLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  settingLabel: { fontSize: 14, fontFamily: 'Inter_500Medium', color: Colors.text },
  settingValue: { fontSize: 12, fontFamily: 'Inter_400Regular', color: Colors.textSecondary, marginTop: 2 },
  settingSubTitle: { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: Colors.text, marginBottom: 8, marginTop: 4 },
  settingSection: { backgroundColor: Colors.surface, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: Colors.borderLight, marginBottom: 8 },
  togglePill: { backgroundColor: Colors.surfaceTertiary, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  toggleText: { fontSize: 12, fontFamily: 'Inter_500Medium', color: Colors.textSecondary },
  optionRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 4, borderRadius: 10, gap: 8, marginBottom: 2 },
  optionRowActive: { backgroundColor: Colors.primarySurface },
  optionLeft: { flex: 1 },
  optionLabel: { fontSize: 14, fontFamily: 'Inter_500Medium', color: Colors.text },
  optionLabelActive: { fontFamily: 'Inter_600SemiBold', color: Colors.primaryDark },
  optionDesc: { fontSize: 12, fontFamily: 'Inter_400Regular', color: Colors.textTertiary, marginTop: 1 },
  goalGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  goalOption: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: Colors.borderLight, backgroundColor: Colors.surfaceTertiary },
  goalOptionActive: { borderColor: Colors.primary, backgroundColor: Colors.primarySurface },
  goalLabel: { fontSize: 13, fontFamily: 'Inter_500Medium', color: Colors.textSecondary },
  goalLabelActive: { color: Colors.primaryDark, fontFamily: 'Inter_600SemiBold' },
  emptyState: { alignItems: 'center', backgroundColor: Colors.surface, borderRadius: 14, padding: 32, borderWidth: 1, borderColor: Colors.borderLight },
  emptyText: { fontSize: 16, fontFamily: 'Inter_600SemiBold', color: Colors.text, marginTop: 12 },
  emptySubtext: { fontSize: 13, fontFamily: 'Inter_400Regular', color: Colors.textSecondary, marginTop: 4, textAlign: 'center' },
  historyList: { gap: 8 },
  historyItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: Colors.borderLight, gap: 12 },
  historyDot: { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
  historyContent: { flex: 1 },
  historyTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 3 },
  historyTitle: { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: Colors.text },
  testBadge: { backgroundColor: '#fff3e0', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4 },
  testBadgeText: { fontSize: 9, fontFamily: 'Inter_700Bold', color: '#e65100' },
  historyMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  historyDate: { fontSize: 12, fontFamily: 'Inter_400Regular', color: Colors.textSecondary },
  historyTime: { fontSize: 12, fontFamily: 'Inter_500Medium', color: Colors.textTertiary },
  historyWeight: { fontSize: 12, fontFamily: 'Inter_600SemiBold', color: Colors.primary },
  resetButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 12, backgroundColor: Colors.errorLight },
  resetText: { fontSize: 15, fontFamily: 'Inter_600SemiBold', color: Colors.error },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  modalContent: { backgroundColor: Colors.surface, borderRadius: 20, padding: 24, alignItems: 'center', width: '100%', maxWidth: 340 },
  modalTitle: { fontSize: 18, fontFamily: 'Inter_700Bold', color: Colors.text, marginBottom: 6 },
  modalSub: { fontSize: 13, fontFamily: 'Inter_400Regular', color: Colors.textSecondary, marginBottom: 16, textAlign: 'center' },
  nameInput: { width: '100%', height: 48, borderRadius: 12, backgroundColor: Colors.surfaceTertiary, paddingHorizontal: 16, fontSize: 16, fontFamily: 'Inter_500Medium', color: Colors.text, borderWidth: 1, borderColor: Colors.borderLight, marginBottom: 16 },
  saveBtn: { width: '100%', backgroundColor: Colors.primary, paddingVertical: 14, borderRadius: 12, alignItems: 'center', marginBottom: 8 },
  saveBtnText: { fontSize: 15, fontFamily: 'Inter_600SemiBold', color: Colors.textInverse },
  cancelBtn: { paddingVertical: 10 },
  cancelBtnText: { fontSize: 14, fontFamily: 'Inter_500Medium', color: Colors.textSecondary },
  equipOption: { flexDirection: 'row', alignItems: 'center', gap: 12, width: '100%', paddingVertical: 14, paddingHorizontal: 16, borderRadius: 12, borderWidth: 1, borderColor: Colors.borderLight, marginBottom: 8 },
  equipOptionActive: { borderColor: Colors.primary, backgroundColor: Colors.primarySurface },
  equipLabel: { flex: 1, fontSize: 15, fontFamily: 'Inter_500Medium', color: Colors.text },
  equipLabelActive: { fontFamily: 'Inter_600SemiBold', color: Colors.primaryDark },
});
