import React, { useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Platform,
  Alert,
  TextInput,
  Modal,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown } from 'react-native-reanimated';
import Colors from '@/constants/colors';
import { EquipmentTier, SessionType, ExperienceLevel, FitnessGoal, Sex, useAppStore } from '@/lib/store';
import { getEquipmentLabel, getEquipmentIcon, getSessionLabel } from '@/lib/workout-engine';

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

type ActiveModal = 'edit' | 'progress' | 'records' | 'history' | 'equipment' | 'settings' | null;

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
  const webTopInset = Platform.OS === 'web' ? 67 : 0;

  const [activeModal, setActiveModal] = useState<ActiveModal>(null);

  // Edit details local state
  const [editName, setEditName] = useState('');
  const [editWeight, setEditWeight] = useState('');
  const [editSex, setEditSex] = useState<Sex>('male');
  const [editExp, setEditExp] = useState<ExperienceLevel>('beginner');
  const [editGoals, setEditGoals] = useState<FitnessGoal[]>(['fitness']);

  const openEdit = () => {
    setEditName(userProfile.name);
    setEditWeight(userProfile.bodyweightKg > 0 ? String(userProfile.bodyweightKg) : '');
    setEditSex(userProfile.sex ?? 'male');
    setEditExp(userProfile.experienceLevel);
    setEditGoals(userProfile.goals?.length ? userProfile.goals : ['fitness']);
    setActiveModal('edit');
  };

  const toggleEditGoal = (g: FitnessGoal) => {
    setEditGoals(prev => {
      if (prev.includes(g)) {
        const next = prev.filter(x => x !== g);
        return next.length > 0 ? next : [g];
      }
      if (prev.length >= 2) return [prev[1], g];
      return [...prev, g];
    });
  };

  const saveEdit = () => {
    setUserProfile({
      name: editName.trim(),
      bodyweightKg: parseFloat(editWeight) || 0,
      sex: editSex,
      experienceLevel: editExp,
      goals: editGoals,
    });
    setActiveModal(null);
  };

  const handleTierChange = (tier: EquipmentTier) => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setEquipmentTier(tier);
    setActiveModal(null);
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
            setActiveModal(null);
          },
        },
      ]
    );
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

  const earnedMilestones = SESSION_MILESTONES.filter(m => completedCount >= m);
  const nextMilestone = SESSION_MILESTONES.find(m => m > completedCount) ?? null;
  const milestoneProgress = nextMilestone ? completedCount / nextMilestone : 1;

  const displayName = userProfile.name || 'Set your name';
  const expLabel = EXPERIENCE_OPTIONS.find(e => e.value === userProfile.experienceLevel)?.label ?? 'Beginner';
  const activeGoals = userProfile.goals?.length ? userProfile.goals : ['fitness' as FitnessGoal];
  const goalLabel = activeGoals
    .map(g => GOAL_OPTIONS.find(o => o.value === g)?.label ?? 'Fitness')
    .join(' + ');

  const NAV_BUTTONS: { id: ActiveModal; label: string; icon: keyof typeof Ionicons.glyphMap; color: string; bg: string }[] = [
    { id: 'edit', label: 'Edit Details', icon: 'person-outline', color: Colors.primary, bg: Colors.primaryMuted },
    { id: 'progress', label: 'My Progress', icon: 'trophy-outline', color: '#f59e0b', bg: '#fef9c3' },
    { id: 'records', label: 'Strength KPIs', icon: 'barbell-outline', color: '#9c27b0', bg: '#f3e5f5' },
    { id: 'history', label: 'Session History', icon: 'time-outline', color: '#4285f4', bg: '#e8f0fe' },
    { id: 'equipment', label: 'Equipment', icon: getEquipmentIcon(equipmentTier) as any, color: '#00695c', bg: '#e0f2f1' },
    { id: 'settings', label: 'Settings', icon: 'settings-outline', color: Colors.textSecondary, bg: Colors.surfaceTertiary },
  ];

  return (
    <View style={[styles.container, { paddingTop: insets.top + webTopInset }]}>
      {/* Hero Card */}
      <Animated.View entering={FadeInDown.delay(0).duration(400)} style={styles.heroCard}>
        <View style={styles.avatarWrap}>
          <View style={styles.avatar}>
            <Text style={styles.avatarInitial}>
              {userProfile.name ? userProfile.name[0].toUpperCase() : '?'}
            </Text>
          </View>
        </View>
        <View style={styles.heroInfo}>
          <Text style={styles.heroName}>{displayName}</Text>
          <View style={styles.heroTags}>
            <View style={styles.tag}>
              <Text style={styles.tagText}>{expLabel}</Text>
            </View>
            {activeGoals.map(g => {
              const opt = GOAL_OPTIONS.find(o => o.value === g);
              return (
                <View key={g} style={[styles.tag, { backgroundColor: Colors.primaryMuted }]}>
                  <Text style={[styles.tagText, { color: Colors.primaryDark }]}>{opt?.label ?? g}</Text>
                </View>
              );
            })}
            {userProfile.bodyweightKg > 0 && (
              <View style={[styles.tag, { backgroundColor: '#e8f0fe' }]}>
                <Text style={[styles.tagText, { color: '#1565c0' }]}>{userProfile.bodyweightKg} kg</Text>
              </View>
            )}
            {userProfile.sex && userProfile.sex !== 'male' && (
              <View style={[styles.tag, { backgroundColor: '#f3e8ff' }]}>
                <Text style={[styles.tagText, { color: '#7e22ce' }]}>{userProfile.sex === 'female' ? 'Female' : 'Other'}</Text>
              </View>
            )}
          </View>
        </View>
      </Animated.View>

      {/* Stats Row */}
      <Animated.View entering={FadeInDown.delay(60).duration(400)} style={styles.statsRow}>
        <View style={styles.stat}>
          <Text style={styles.statVal}>{completedCount}</Text>
          <Text style={styles.statLbl}>Sessions</Text>
        </View>
        <View style={styles.statDiv} />
        <View style={styles.stat}>
          <Text style={styles.statVal}>{streak}</Text>
          <Text style={styles.statLbl}>Streak</Text>
        </View>
        <View style={styles.statDiv} />
        <View style={styles.stat}>
          <Text style={styles.statVal}>{weekCount}</Text>
          <Text style={styles.statLbl}>This Week</Text>
        </View>
      </Animated.View>

      {/* Nav Grid */}
      <Animated.View entering={FadeInDown.delay(120).duration(400)} style={styles.navGrid}>
        {NAV_BUTTONS.map((btn, i) => (
          <Pressable
            key={btn.id}
            onPress={() => { if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setActiveModal(btn.id); }}
            style={({ pressed }) => [styles.navBtn, pressed && { opacity: 0.8, transform: [{ scale: 0.97 }] }]}
          >
            <View style={[styles.navIcon, { backgroundColor: btn.bg }]}>
              <Ionicons name={btn.icon} size={22} color={btn.color} />
            </View>
            <Text style={styles.navLabel}>{btn.label}</Text>
            <Ionicons name="chevron-forward" size={14} color={Colors.textTertiary} />
          </Pressable>
        ))}
      </Animated.View>

      {/* ─── MODALS ──────────────────────────────────────────── */}

      {/* Edit Details Modal */}
      <Modal visible={activeModal === 'edit'} transparent animationType="slide" onRequestClose={() => setActiveModal(null)}>
        <View style={styles.sheetOverlay}>
          <View style={[styles.sheet, { paddingBottom: insets.bottom + 24 }]}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Edit Details</Text>

            <Text style={styles.inputLabel}>Name</Text>
            <TextInput
              style={styles.input}
              value={editName}
              onChangeText={setEditName}
              placeholder="Your name"
              placeholderTextColor={Colors.textTertiary}
              returnKeyType="next"
            />

            <Text style={styles.inputLabel}>Bodyweight (kg)</Text>
            <TextInput
              style={styles.input}
              value={editWeight}
              onChangeText={setEditWeight}
              placeholder="e.g. 80"
              placeholderTextColor={Colors.textTertiary}
              keyboardType="decimal-pad"
              returnKeyType="done"
            />

            <Text style={styles.inputLabel}>Biological Sex</Text>
            <Text style={styles.inputHint}>Used to calibrate starting weights for your sessions</Text>
            <View style={styles.optionGroup}>
              {([{ value: 'male', label: 'Male' }, { value: 'female', label: 'Female' }, { value: 'other', label: 'Other' }] as { value: Sex; label: string }[]).map(opt => (
                <Pressable
                  key={opt.value}
                  onPress={() => setEditSex(opt.value)}
                  style={[styles.optionChip, editSex === opt.value && styles.optionChipActive]}
                >
                  <Text style={[styles.optionChipText, editSex === opt.value && styles.optionChipTextActive]}>
                    {opt.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.inputLabel}>Experience Level</Text>
            <View style={styles.optionGroup}>
              {EXPERIENCE_OPTIONS.map(opt => (
                <Pressable
                  key={opt.value}
                  onPress={() => setEditExp(opt.value)}
                  style={[styles.optionChip, editExp === opt.value && styles.optionChipActive]}
                >
                  <Text style={[styles.optionChipText, editExp === opt.value && styles.optionChipTextActive]}>
                    {opt.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.inputLabel}>Goals</Text>
            <Text style={styles.inputHint}>Pick up to 2 — they shape your weights and volume</Text>
            <View style={styles.goalGroup}>
              {GOAL_OPTIONS.map(opt => {
                const isActive = editGoals.includes(opt.value);
                return (
                  <Pressable
                    key={opt.value}
                    onPress={() => toggleEditGoal(opt.value)}
                    style={[styles.goalChip, isActive && styles.goalChipActive]}
                  >
                    <Ionicons name={opt.icon} size={16} color={isActive ? Colors.primary : Colors.textTertiary} />
                    <Text style={[styles.goalChipText, isActive && styles.goalChipTextActive]}>
                      {opt.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Pressable onPress={saveEdit} style={styles.saveBtn}>
              <Text style={styles.saveBtnText}>Save Details</Text>
            </Pressable>
            <Pressable onPress={() => setActiveModal(null)} style={styles.cancelBtn}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* My Progress Modal */}
      <Modal visible={activeModal === 'progress'} transparent animationType="slide" onRequestClose={() => setActiveModal(null)}>
        <View style={styles.sheetOverlay}>
          <View style={[styles.sheet, { paddingBottom: insets.bottom + 24 }]}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>My Progress</Text>
            {nextMilestone !== null && (
              <View style={styles.milestoneCard}>
                <View style={styles.milestoneRow}>
                  <Ionicons name="flag-outline" size={18} color={Colors.primary} />
                  <Text style={styles.milestoneLabel}>{completedCount} / {nextMilestone} sessions to next milestone</Text>
                </View>
                <View style={styles.milestoneTrack}>
                  <View style={[styles.milestoneFill, { width: `${milestoneProgress * 100}%` as any }]} />
                </View>
              </View>
            )}
            <Text style={styles.subSectionTitle}>Earned Badges</Text>
            {earnedMilestones.length === 0 ? (
              <Text style={styles.emptyText}>Complete your first session to earn badges!</Text>
            ) : (
              <View style={styles.badgesGrid}>
                {SESSION_MILESTONES.map(m => {
                  const earned = completedCount >= m;
                  return (
                    <View key={m} style={[styles.badge, !earned && styles.badgeLocked]}>
                      <Ionicons name="trophy" size={18} color={earned ? '#f59e0b' : Colors.textTertiary} />
                      <Text style={[styles.badgeText, !earned && styles.badgeTextLocked]}>{m}</Text>
                    </View>
                  );
                })}
              </View>
            )}
            <Pressable onPress={() => setActiveModal(null)} style={styles.cancelBtn}>
              <Text style={styles.cancelBtnText}>Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Strength KPIs Modal */}
      <Modal visible={activeModal === 'records'} transparent animationType="slide" onRequestClose={() => setActiveModal(null)}>
        <View style={styles.sheetOverlay}>
          <ScrollView style={styles.sheetScroll} contentContainerStyle={[styles.sheetScrollContent, { paddingBottom: insets.bottom + 24 }]}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Strength KPIs</Text>
            {LIFTS.map(lift => {
              const best = getBestORM(lift);
              const history = oneRepMaxes
                .filter(o => o.lift === lift)
                .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                .slice(0, 5);
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
                        <View style={styles.pbBadge}>
                          <Ionicons name="trending-up" size={11} color={Colors.primary} />
                          <Text style={styles.pbText}>PB</Text>
                        </View>
                      )}
                    </View>
                  </View>
                  {history.length === 0 ? (
                    <Text style={styles.ormEmpty}>Complete a test week to record your KPI</Text>
                  ) : (
                    <View style={styles.ormHistory}>
                      {history.map((h, i) => {
                        const prev = history[i + 1];
                        const diff = prev ? h.weight - prev.weight : null;
                        return (
                          <View key={i} style={styles.ormRow}>
                            <Text style={styles.ormWeight}>{h.weight} kg</Text>
                            {diff !== null && diff !== 0 && (
                              <Text style={[styles.ormDiff, { color: diff > 0 ? Colors.primary : '#e53e3e' }]}>
                                {diff > 0 ? `+${diff}` : diff} kg
                              </Text>
                            )}
                            <Text style={styles.ormDate}>{formatDate(h.date)}</Text>
                          </View>
                        );
                      })}
                    </View>
                  )}
                </View>
              );
            })}
            <Pressable onPress={() => setActiveModal(null)} style={styles.cancelBtn}>
              <Text style={styles.cancelBtnText}>Close</Text>
            </Pressable>
          </ScrollView>
        </View>
      </Modal>

      {/* Session History Modal */}
      <Modal visible={activeModal === 'history'} transparent animationType="slide" onRequestClose={() => setActiveModal(null)}>
        <View style={styles.sheetOverlay}>
          <View style={[styles.sheet, { paddingBottom: insets.bottom + 24 }]}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Session History</Text>
            {completedSessions.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="barbell-outline" size={32} color={Colors.textTertiary} />
                <Text style={styles.emptyText}>No sessions yet</Text>
                <Text style={styles.emptySubText}>Start your first workout to see history here</Text>
              </View>
            ) : (
              <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 340 }}>
                {completedSessions.slice(0, 20).map(session => {
                  const topWeight = session.exerciseLogs
                    ? Math.max(0, ...session.exerciseLogs.flatMap(l => l.sets.map(s => s.weight)))
                    : 0;
                  return (
                    <View key={session.id} style={styles.histItem}>
                      <View style={[styles.histDot, { backgroundColor: session.isTestWeek ? '#e65100' : Colors.primary }]} />
                      <View style={styles.histContent}>
                        <View style={styles.histTitleRow}>
                          <Text style={styles.histTitle}>{getSessionLabel(session.sessionType)}</Text>
                          {session.isTestWeek && <View style={styles.testBadge}><Text style={styles.testBadgeText}>1RM</Text></View>}
                        </View>
                        <View style={styles.histMeta}>
                          <Text style={styles.histDate}>{formatDate(session.date)}</Text>
                          {session.timeAvailable && <Text style={styles.histMeta2}>{session.timeAvailable} min</Text>}
                          {topWeight > 0 && <Text style={styles.histWeight}>{topWeight} kg top</Text>}
                        </View>
                      </View>
                    </View>
                  );
                })}
              </ScrollView>
            )}
            <Pressable onPress={() => setActiveModal(null)} style={[styles.cancelBtn, { marginTop: 8 }]}>
              <Text style={styles.cancelBtnText}>Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Equipment Modal */}
      <Modal visible={activeModal === 'equipment'} transparent animationType="slide" onRequestClose={() => setActiveModal(null)}>
        <View style={styles.sheetOverlay}>
          <View style={[styles.sheet, { paddingBottom: insets.bottom + 24 }]}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Equipment</Text>
            <Text style={styles.sheetSub}>Choose what you have available for your workouts</Text>
            {ALL_TIERS.map(tier => {
              const isActive = tier === equipmentTier;
              return (
                <Pressable key={tier} onPress={() => handleTierChange(tier)} style={[styles.equipRow, isActive && styles.equipRowActive]} testID={`tier-${tier}`}>
                  <Ionicons name={getEquipmentIcon(tier) as any} size={22} color={isActive ? Colors.primary : Colors.textTertiary} />
                  <Text style={[styles.equipLabel, isActive && styles.equipLabelActive]}>{getEquipmentLabel(tier)}</Text>
                  {isActive && <Ionicons name="checkmark-circle" size={20} color={Colors.primary} />}
                </Pressable>
              );
            })}
            <Pressable onPress={() => setActiveModal(null)} style={styles.cancelBtn}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Settings Modal */}
      <Modal visible={activeModal === 'settings'} transparent animationType="slide" onRequestClose={() => setActiveModal(null)}>
        <View style={styles.sheetOverlay}>
          <View style={[styles.sheet, { paddingBottom: insets.bottom + 24 }]}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Settings</Text>

            <Text style={styles.settingItemLabel}>Test Week Frequency</Text>
            <Text style={styles.settingItemSub}>How often to trigger a 1RM test week</Text>
            <View style={styles.freqRow}>
              {([12, 18] as const).map(freq => (
                <Pressable
                  key={freq}
                  onPress={() => { setTestWeekFrequency(freq); if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
                  style={[styles.freqBtn, testWeekFrequency === freq && styles.freqBtnActive]}
                  testID="test-freq-toggle"
                >
                  <Text style={[styles.freqBtnText, testWeekFrequency === freq && styles.freqBtnTextActive]}>
                    Every {freq} sessions
                  </Text>
                </Pressable>
              ))}
            </View>

            <View style={styles.settingDivider} />

            <Pressable onPress={handleReset} style={styles.resetBtn} testID="reset-progress">
              <Ionicons name="refresh-outline" size={18} color={Colors.error} />
              <Text style={styles.resetText}>Reset All Progress</Text>
            </Pressable>

            <Pressable onPress={() => setActiveModal(null)} style={styles.cancelBtn}>
              <Text style={styles.cancelBtnText}>Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background, paddingHorizontal: 20 },
  heroCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: Colors.surface, borderRadius: 18, padding: 18,
    marginTop: 12, marginBottom: 14,
    borderWidth: 1, borderColor: Colors.borderLight,
  },
  avatarWrap: {},
  avatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: Colors.primaryMuted, alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { fontSize: 24, fontFamily: 'Inter_700Bold', color: Colors.primary },
  heroInfo: { flex: 1 },
  heroName: { fontSize: 20, fontFamily: 'Inter_700Bold', color: Colors.text, marginBottom: 6 },
  heroTags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tag: { paddingHorizontal: 8, paddingVertical: 3, backgroundColor: Colors.surfaceTertiary, borderRadius: 6 },
  tagText: { fontSize: 11, fontFamily: 'Inter_500Medium', color: Colors.textSecondary },
  statsRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.surface, borderRadius: 16, padding: 18,
    marginBottom: 16, borderWidth: 1, borderColor: Colors.borderLight,
  },
  stat: { flex: 1, alignItems: 'center' },
  statVal: { fontSize: 26, fontFamily: 'Inter_700Bold', color: Colors.primary },
  statLbl: { fontSize: 12, fontFamily: 'Inter_500Medium', color: Colors.textSecondary, marginTop: 2 },
  statDiv: { width: 1, height: 32, backgroundColor: Colors.border },
  navGrid: { gap: 10 },
  navBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: Colors.surface, borderRadius: 14, padding: 16,
    borderWidth: 1, borderColor: Colors.borderLight,
  },
  navIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  navLabel: { flex: 1, fontSize: 15, fontFamily: 'Inter_600SemiBold', color: Colors.text },

  // Sheet / Modal base
  sheetOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: Colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 24, paddingTop: 12 },
  sheetScroll: { backgroundColor: Colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24 },
  sheetScrollContent: { paddingHorizontal: 24, paddingTop: 12 },
  sheetHandle: { width: 40, height: 4, backgroundColor: Colors.border, borderRadius: 2, alignSelf: 'center', marginBottom: 18 },
  sheetTitle: { fontSize: 20, fontFamily: 'Inter_700Bold', color: Colors.text, marginBottom: 6 },
  sheetSub: { fontSize: 13, fontFamily: 'Inter_400Regular', color: Colors.textSecondary, marginBottom: 16 },
  subSectionTitle: { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: Colors.text, marginBottom: 10, marginTop: 16 },

  // Edit form
  inputLabel: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: Colors.text, marginBottom: 4, marginTop: 12 },
  inputHint: { fontSize: 12, fontFamily: 'Inter_400Regular', color: Colors.textTertiary, marginBottom: 6 },
  input: {
    height: 48, borderRadius: 12, backgroundColor: Colors.surfaceTertiary,
    paddingHorizontal: 16, fontSize: 16, fontFamily: 'Inter_500Medium', color: Colors.text,
    borderWidth: 1, borderColor: Colors.borderLight,
  },
  optionGroup: { flexDirection: 'row', gap: 8 },
  optionChip: { flex: 1, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: Colors.borderLight, alignItems: 'center', backgroundColor: Colors.surfaceTertiary },
  optionChipActive: { borderColor: Colors.primary, backgroundColor: Colors.primarySurface },
  optionChipText: { fontSize: 13, fontFamily: 'Inter_500Medium', color: Colors.textSecondary },
  optionChipTextActive: { color: Colors.primaryDark, fontFamily: 'Inter_600SemiBold' },
  goalGroup: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  goalChip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: Colors.borderLight, backgroundColor: Colors.surfaceTertiary },
  goalChipActive: { borderColor: Colors.primary, backgroundColor: Colors.primarySurface },
  goalChipText: { fontSize: 13, fontFamily: 'Inter_500Medium', color: Colors.textSecondary },
  goalChipTextActive: { color: Colors.primaryDark, fontFamily: 'Inter_600SemiBold' },

  // Progress
  milestoneCard: { backgroundColor: Colors.primarySurface, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: Colors.primaryMuted, marginBottom: 4 },
  milestoneRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  milestoneLabel: { fontSize: 14, fontFamily: 'Inter_500Medium', color: Colors.text, flex: 1 },
  milestoneTrack: { height: 6, backgroundColor: Colors.primaryMuted, borderRadius: 3, overflow: 'hidden' },
  milestoneFill: { height: '100%', backgroundColor: Colors.primary, borderRadius: 3 },
  badgesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  badge: { alignItems: 'center', justifyContent: 'center', width: 60, height: 60, borderRadius: 14, backgroundColor: '#fef9c3', gap: 2 },
  badgeLocked: { backgroundColor: Colors.surfaceTertiary },
  badgeText: { fontSize: 12, fontFamily: 'Inter_700Bold', color: '#92400e' },
  badgeTextLocked: { color: Colors.textTertiary },

  // KPI Records
  ormCard: { backgroundColor: Colors.surfaceTertiary, borderRadius: 14, padding: 14, marginBottom: 10 },
  ormHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  ormLift: { fontSize: 16, fontFamily: 'Inter_600SemiBold', color: Colors.text },
  ormSub: { fontSize: 11, fontFamily: 'Inter_400Regular', color: Colors.textTertiary },
  ormRight: { alignItems: 'flex-end', gap: 4 },
  ormBest: { fontSize: 20, fontFamily: 'Inter_700Bold', color: Colors.primary },
  pbBadge: { flexDirection: 'row', alignItems: 'center', gap: 2, backgroundColor: Colors.primaryMuted, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  pbText: { fontSize: 10, fontFamily: 'Inter_600SemiBold', color: Colors.primary },
  ormHistory: { gap: 5, borderTopWidth: 1, borderTopColor: Colors.borderLight, paddingTop: 8 },
  ormRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  ormWeight: { fontSize: 14, fontFamily: 'Inter_500Medium', color: Colors.textSecondary, flex: 1 },
  ormDiff: { fontSize: 12, fontFamily: 'Inter_600SemiBold' },
  ormDate: { fontSize: 12, fontFamily: 'Inter_400Regular', color: Colors.textTertiary },
  ormEmpty: { fontSize: 13, fontFamily: 'Inter_400Regular', color: Colors.textTertiary },

  // History
  emptyState: { alignItems: 'center', paddingVertical: 32 },
  emptyText: { fontSize: 16, fontFamily: 'Inter_600SemiBold', color: Colors.text, marginTop: 10 },
  emptySubText: { fontSize: 13, fontFamily: 'Inter_400Regular', color: Colors.textSecondary, marginTop: 4, textAlign: 'center' },
  histItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 12, borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  histDot: { width: 8, height: 8, borderRadius: 4 },
  histContent: { flex: 1 },
  histTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  histTitle: { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: Colors.text },
  testBadge: { backgroundColor: '#fff3e0', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4 },
  testBadgeText: { fontSize: 9, fontFamily: 'Inter_700Bold', color: '#e65100' },
  histMeta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  histDate: { fontSize: 12, fontFamily: 'Inter_400Regular', color: Colors.textSecondary },
  histMeta2: { fontSize: 12, fontFamily: 'Inter_500Medium', color: Colors.textTertiary },
  histWeight: { fontSize: 12, fontFamily: 'Inter_600SemiBold', color: Colors.primary },

  // Equipment
  equipRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, paddingHorizontal: 12, borderRadius: 12, borderWidth: 1, borderColor: Colors.borderLight, marginBottom: 8 },
  equipRowActive: { borderColor: Colors.primary, backgroundColor: Colors.primarySurface },
  equipLabel: { flex: 1, fontSize: 15, fontFamily: 'Inter_500Medium', color: Colors.text },
  equipLabelActive: { fontFamily: 'Inter_600SemiBold', color: Colors.primaryDark },

  // Settings
  settingItemLabel: { fontSize: 15, fontFamily: 'Inter_600SemiBold', color: Colors.text, marginBottom: 2 },
  settingItemSub: { fontSize: 13, fontFamily: 'Inter_400Regular', color: Colors.textSecondary, marginBottom: 12 },
  settingDivider: { height: 1, backgroundColor: Colors.borderLight, marginVertical: 16 },
  freqRow: { flexDirection: 'row', gap: 10 },
  freqBtn: { flex: 1, paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: Colors.borderLight, alignItems: 'center', backgroundColor: Colors.surfaceTertiary },
  freqBtnActive: { borderColor: Colors.primary, backgroundColor: Colors.primarySurface },
  freqBtnText: { fontSize: 13, fontFamily: 'Inter_500Medium', color: Colors.textSecondary },
  freqBtnTextActive: { color: Colors.primaryDark, fontFamily: 'Inter_600SemiBold' },
  resetBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 12, backgroundColor: Colors.errorLight },
  resetText: { fontSize: 15, fontFamily: 'Inter_600SemiBold', color: Colors.error },

  // Shared
  saveBtn: { width: '100%', backgroundColor: Colors.primary, paddingVertical: 15, borderRadius: 13, alignItems: 'center', marginTop: 20 },
  saveBtnText: { fontSize: 16, fontFamily: 'Inter_600SemiBold', color: Colors.textInverse },
  cancelBtn: { paddingVertical: 12, alignItems: 'center' },
  cancelBtnText: { fontSize: 14, fontFamily: 'Inter_500Medium', color: Colors.textSecondary },
});
