import React, { useState, useMemo } from 'react';
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
  Linking,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useColors } from '@/constants/colors';
import { EquipmentTier, ExperienceLevel, FitnessGoal, Sex, TIER_ORDER, WeightUnit, useAppStore } from '@/lib/store';
import { getEquipmentLabel, getEquipmentIcon, getEffectiveTier } from '@/lib/workout-engine';
import { useAuth, useSubscription } from '@/lib/auth-context';
import { router } from 'expo-router';

const ALL_TIERS: EquipmentTier[] = ['bodyweight', 'bands', 'dumbbells', 'kettlebells', 'fullgym'];

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

type ActiveModal = 'edit' | 'equipment' | 'settings' | null;

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const C = useColors();
  const {
    equipmentTiers,
    setEquipmentTiers,
    completedCount,
    getStreakDays,
    getThisWeekCount,
    resetProgress,
    testWeekFrequency,
    setTestWeekFrequency,
    userProfile,
    setUserProfile,
    getEffectiveTier: storeGetEffectiveTier,
    weightUnit,
    setWeightUnit,
  } = useAppStore();

  const { user, signOut } = useAuth();
  const { isActive: hasActiveSubscription, isOnTrial, expiryDate } = useSubscription();

  const effectiveTier = storeGetEffectiveTier();
  const streak = getStreakDays();
  const weekCount = getThisWeekCount();
  const webTopInset = Platform.OS === 'web' ? 67 : 0;

  const [activeModal, setActiveModal] = useState<ActiveModal>(null);

  const [editName, setEditName] = useState('');
  const [editWeight, setEditWeight] = useState('');
  const [editSex, setEditSex] = useState<Sex>('male');
  const [editExp, setEditExp] = useState<ExperienceLevel>('beginner');
  const [editGoals, setEditGoals] = useState<FitnessGoal[]>(['fitness']);
  const [editTiers, setEditTiers] = useState<EquipmentTier[]>(['bodyweight']);

  const openEdit = () => {
    setEditName(userProfile.name);
    setEditWeight(userProfile.bodyweightKg > 0 ? String(userProfile.bodyweightKg) : '');
    setEditSex(userProfile.sex ?? 'male');
    setEditExp(userProfile.experienceLevel);
    setEditGoals(userProfile.goals?.length ? userProfile.goals : ['fitness']);
    setActiveModal('edit');
  };

  const openEquipment = () => {
    setEditTiers(equipmentTiers && equipmentTiers.length > 0 ? [...equipmentTiers] : ['bodyweight']);
    setActiveModal('equipment');
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

  const toggleEditTier = (tier: EquipmentTier) => {
    const isLocked = userProfile.experienceLevel === 'beginner' && !['bodyweight', 'bands'].includes(tier);
    if (isLocked) return;
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setEditTiers((prev) => {
      if (tier === 'fullgym') {
        if (prev.includes('fullgym')) {
          return prev.filter(t => t !== 'fullgym');
        } else {
          const available = userProfile.experienceLevel === 'beginner' ? ['bodyweight', 'bands'] : [...TIER_ORDER];
          return available as EquipmentTier[];
        }
      }
      if (prev.includes(tier)) {
        const next = prev.filter(t => t !== tier);
        return next.length > 0 ? next : [tier];
      }
      return [...prev, tier];
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

  const saveEquipment = () => {
    setEquipmentTiers(editTiers);
    setActiveModal(null);
  };

  const handleReset = () => {
    Alert.alert(
      'Reset Progress',
      'This will clear all your workout history, stats, and strength test records. This cannot be undone.',
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

  const handleSignOut = () => {
    if (Platform.OS === 'web') { signOut(); return; }
    Alert.alert('Sign out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: signOut },
    ]);
  };

  const handleSendFeedback = () => {
    Linking.openURL('mailto:feedback@growapp.com?subject=App Feedback').catch(() => {});
  };

  const displayName = userProfile.name || 'Set your name';
  const expLabel = EXPERIENCE_OPTIONS.find(e => e.value === userProfile.experienceLevel)?.label ?? 'Beginner';
  const activeGoals = userProfile.goals?.length ? userProfile.goals : ['fitness' as FitnessGoal];
  const firstGoalLabel = GOAL_OPTIONS.find(o => o.value === activeGoals[0])?.label ?? 'Fitness';
  const goalLabel = activeGoals
    .map(g => GOAL_OPTIONS.find(o => o.value === g)?.label ?? 'Fitness')
    .join(' + ');

  const equipmentSubtitle = getEquipmentLabel(effectiveTier);
  const editDetailsSubtitle = `${expLabel} · ${firstGoalLabel}`;

  const styles = useMemo(() => makeStyles(C), [C]);

  return (
    <View style={[styles.root, { paddingTop: insets.top + webTopInset }]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.container, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
      >
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
                  <View key={g} style={[styles.tag, { backgroundColor: C.primaryMuted }]}>
                    <Text style={[styles.tagText, { color: C.primaryDark }]}>{opt?.label ?? g}</Text>
                  </View>
                );
              })}
              {userProfile.bodyweightKg > 0 && (
                <View style={[styles.tag, { backgroundColor: '#e8f0fe' }]}>
                  <Text style={[styles.tagText, { color: '#1565c0' }]}>{userProfile.bodyweightKg} kg</Text>
                </View>
              )}
            </View>
          </View>
        </Animated.View>

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

        <Animated.View entering={FadeInDown.delay(120).duration(400)} style={styles.navGrid}>
          <Pressable
            onPress={() => { if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); openEdit(); }}
            style={({ pressed }) => [styles.navBtn, pressed && { opacity: 0.8, transform: [{ scale: 0.97 }] }]}
          >
            <View style={[styles.navIcon, { backgroundColor: C.primaryMuted }]}>
              <Ionicons name="person-outline" size={22} color={C.primary} />
            </View>
            <View style={styles.navBtnText}>
              <Text style={styles.navLabel}>Edit Details</Text>
              <Text style={styles.navSub}>{editDetailsSubtitle}</Text>
            </View>
            <Ionicons name="chevron-forward" size={14} color={C.textTertiary} />
          </Pressable>

          <Pressable
            onPress={() => { if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); openEquipment(); }}
            style={({ pressed }) => [styles.navBtn, pressed && { opacity: 0.8, transform: [{ scale: 0.97 }] }]}
          >
            <View style={[styles.navIcon, { backgroundColor: '#e0f2f1' }]}>
              <Ionicons name={getEquipmentIcon(effectiveTier) as keyof typeof Ionicons.glyphMap} size={22} color="#00695c" />
            </View>
            <View style={styles.navBtnText}>
              <Text style={styles.navLabel}>Equipment</Text>
              <Text style={styles.navSub}>{equipmentSubtitle}</Text>
            </View>
            <Ionicons name="chevron-forward" size={14} color={C.textTertiary} />
          </Pressable>

          <Pressable
            onPress={() => { if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setActiveModal('settings'); }}
            style={({ pressed }) => [styles.navBtn, pressed && { opacity: 0.8, transform: [{ scale: 0.97 }] }]}
          >
            <View style={[styles.navIcon, { backgroundColor: C.surfaceTertiary }]}>
              <Ionicons name="settings-outline" size={22} color={C.textSecondary} />
            </View>
            <View style={styles.navBtnText}>
              <Text style={styles.navLabel}>Settings</Text>
              <Text style={styles.navSub}>Test week · Units · Feedback</Text>
            </View>
            <Ionicons name="chevron-forward" size={14} color={C.textTertiary} />
          </Pressable>
        </Animated.View>

        {/* Account Section */}
        <Animated.View entering={FadeInDown.delay(180).duration(400)} style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Account</Text>
          <View style={styles.accountRow}>
            <View style={styles.accountIcon}>
              <Ionicons name="mail-outline" size={18} color={C.primary} />
            </View>
            <Text style={styles.accountEmail} numberOfLines={1}>
              {user?.email ?? 'Not signed in'}
            </Text>
          </View>
          <Pressable onPress={handleSignOut} style={styles.signOutBtn} testID="sign-out-btn">
            <Ionicons name="log-out-outline" size={16} color={C.error} />
            <Text style={styles.signOutText}>Sign out</Text>
          </Pressable>
        </Animated.View>

        {/* Subscription Section */}
        <Animated.View entering={FadeInDown.delay(240).duration(400)} style={[styles.sectionCard, { marginBottom: 0 }]}>
          <Text style={styles.sectionTitle}>Subscription</Text>
          {hasActiveSubscription ? (
            <View style={styles.subActiveCard}>
              <View style={styles.subActiveInfo}>
                <Text style={styles.subActivePlan}>Grow Monthly</Text>
                <Text style={styles.subActiveRenewal}>
                  {isOnTrial
                    ? 'Free trial — cancel anytime'
                    : expiryDate
                      ? `Renews ${new Date(expiryDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`
                      : 'Active — renews monthly'}
                </Text>
              </View>
              <View style={[styles.subActiveBadge, { backgroundColor: C.primaryMuted }]}>
                <Text style={[styles.subActiveBadgeText, { color: C.primary }]}>
                  {isOnTrial ? 'Trial' : 'Active'}
                </Text>
              </View>
            </View>
          ) : (
            <Pressable
              onPress={() => router.push('/subscription')}
              style={styles.subCtaCard}
              testID="subscribe-cta"
            >
              <View>
                <Text style={styles.subCtaTitle}>Subscribe to Grow</Text>
                <Text style={styles.subCtaSub}>£9.99/month · cancel anytime</Text>
              </View>
              <Ionicons name="arrow-forward-circle" size={28} color="#fff" />
            </Pressable>
          )}
          {hasActiveSubscription && (
            <Pressable
              onPress={() => {
                const url = Platform.OS === 'ios'
                  ? 'itms-apps://apps.apple.com/account/subscriptions'
                  : 'https://play.google.com/store/account/subscriptions';
                Linking.openURL(url).catch(() => {});
              }}
              style={styles.manageSubBtn}
              testID="manage-subscription-btn"
            >
              <Text style={styles.manageSubText}>Manage Subscription</Text>
              <Ionicons name="open-outline" size={13} color={C.primary} />
            </Pressable>
          )}
        </Animated.View>
      </ScrollView>

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
              placeholderTextColor={C.textTertiary}
              returnKeyType="next"
            />

            <Text style={styles.inputLabel}>Bodyweight (kg)</Text>
            <TextInput
              style={styles.input}
              value={editWeight}
              onChangeText={setEditWeight}
              placeholder="e.g. 80"
              placeholderTextColor={C.textTertiary}
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
                    <Ionicons name={opt.icon} size={16} color={isActive ? C.primary : C.textTertiary} />
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

      {/* Equipment Modal */}
      <Modal visible={activeModal === 'equipment'} transparent animationType="slide" onRequestClose={() => setActiveModal(null)}>
        <View style={styles.sheetOverlay}>
          <View style={[styles.sheet, { paddingBottom: insets.bottom + 24 }]}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Equipment</Text>
            <Text style={styles.sheetSub}>
              Select everything available to you — we use the best match for each session
            </Text>
            {userProfile.experienceLevel === 'beginner' && (
              <View style={styles.upgradeNote}>
                <Ionicons name="information-circle-outline" size={15} color={C.primary} />
                <Text style={styles.upgradeNoteText}>
                  Beginner mode: Bodyweight and bands only. Update your experience level in Edit Details to unlock all equipment.
                </Text>
              </View>
            )}
            {editTiers.length > 0 && (
              <View style={styles.effectiveBadge}>
                <Text style={styles.effectiveBadgeText}>
                  Best match: <Text style={{ fontFamily: 'Inter_600SemiBold', color: C.primary }}>{getEquipmentLabel(getEffectiveTier(editTiers))}</Text>
                </Text>
              </View>
            )}
            {ALL_TIERS.map(tier => {
              const isActive = editTiers.includes(tier);
              const isLocked = userProfile.experienceLevel === 'beginner' && !['bodyweight', 'bands'].includes(tier);
              return (
                <Pressable
                  key={tier}
                  onPress={() => toggleEditTier(tier)}
                  style={[styles.equipRow, isActive && styles.equipRowActive, isLocked && styles.equipRowLocked]}
                  testID={`tier-${tier}`}
                >
                  <Ionicons
                    name={getEquipmentIcon(tier) as any}
                    size={22}
                    color={isActive ? C.primary : isLocked ? C.textTertiary : C.textSecondary}
                  />
                  <Text style={[styles.equipLabel, isActive && styles.equipLabelActive, isLocked && styles.equipLabelLocked]}>
                    {getEquipmentLabel(tier)}
                  </Text>
                  {isLocked
                    ? <Ionicons name="lock-closed-outline" size={18} color={C.textTertiary} />
                    : (
                      <View style={[styles.equipCheckbox, isActive && styles.equipCheckboxActive]}>
                        {isActive && <Ionicons name="checkmark" size={13} color={C.textInverse} />}
                      </View>
                    )
                  }
                </Pressable>
              );
            })}
            <Pressable onPress={saveEquipment} style={[styles.saveBtn, { marginTop: 16 }]}>
              <Text style={styles.saveBtnText}>Save Equipment</Text>
            </Pressable>
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
            <Text style={styles.settingItemSub}>How often to trigger a strength test week</Text>
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

            <Text style={styles.settingItemLabel}>Weight Units</Text>
            <Text style={styles.settingItemSub}>Used throughout the app for weight display</Text>
            <View style={styles.freqRow}>
              {(['kg', 'lbs'] as WeightUnit[]).map(unit => (
                <Pressable
                  key={unit}
                  onPress={() => { setWeightUnit(unit); if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
                  style={[styles.freqBtn, weightUnit === unit && styles.freqBtnActive]}
                >
                  <Text style={[styles.freqBtnText, weightUnit === unit && styles.freqBtnTextActive]}>
                    {unit}
                  </Text>
                </Pressable>
              ))}
            </View>

            <View style={styles.settingDivider} />

            <Pressable onPress={handleSendFeedback} style={styles.feedbackBtn}>
              <Ionicons name="mail-outline" size={18} color={C.primary} />
              <Text style={styles.feedbackText}>Send Feedback</Text>
              <Ionicons name="open-outline" size={14} color={C.textTertiary} style={{ marginLeft: 'auto' }} />
            </Pressable>

            <View style={styles.settingDivider} />

            <Pressable onPress={handleReset} style={styles.resetBtn} testID="reset-progress">
              <Ionicons name="refresh-outline" size={18} color={C.error} />
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

function makeStyles(C: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: C.background },
    scroll: { flex: 1 },
    container: { paddingHorizontal: 20 },
    heroCard: {
      flexDirection: 'row', alignItems: 'center', gap: 14,
      backgroundColor: C.surface, borderRadius: 18, padding: 18,
      marginTop: 12, marginBottom: 14, borderWidth: 1, borderColor: C.borderLight,
    },
    avatarWrap: {},
    avatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: C.primaryMuted, alignItems: 'center', justifyContent: 'center' },
    avatarInitial: { fontSize: 24, fontFamily: 'Inter_700Bold', color: C.primary },
    heroInfo: { flex: 1 },
    heroName: { fontSize: 20, fontFamily: 'Inter_700Bold', color: C.text, marginBottom: 6 },
    heroTags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    tag: { paddingHorizontal: 8, paddingVertical: 3, backgroundColor: C.surfaceTertiary, borderRadius: 6 },
    tagText: { fontSize: 11, fontFamily: 'Inter_500Medium', color: C.textSecondary },
    statsRow: {
      flexDirection: 'row', alignItems: 'center',
      backgroundColor: C.surface, borderRadius: 16, padding: 18,
      marginBottom: 16, borderWidth: 1, borderColor: C.borderLight,
    },
    stat: { flex: 1, alignItems: 'center' },
    statVal: { fontSize: 26, fontFamily: 'Inter_700Bold', color: C.primary },
    statLbl: { fontSize: 11, fontFamily: 'Inter_500Medium', color: C.textSecondary, marginTop: 2, textAlign: 'center' },
    statDiv: { width: 1, height: 36, backgroundColor: C.border },
    navGrid: { gap: 8, marginBottom: 16 },
    navBtn: {
      flexDirection: 'row', alignItems: 'center', gap: 14,
      backgroundColor: C.surface, borderRadius: 14, padding: 14,
      borderWidth: 1, borderColor: C.borderLight,
    },
    navIcon: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    navBtnText: { flex: 1 },
    navLabel: { fontSize: 15, fontFamily: 'Inter_600SemiBold', color: C.text },
    navSub: { fontSize: 12, fontFamily: 'Inter_400Regular', color: C.textSecondary, marginTop: 2 },
    sectionCard: {
      backgroundColor: C.surface, borderRadius: 16, padding: 18,
      marginBottom: 14, borderWidth: 1, borderColor: C.borderLight,
    },
    sectionTitle: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: C.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 },
    accountRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
    accountIcon: { width: 34, height: 34, borderRadius: 10, backgroundColor: C.primaryMuted, alignItems: 'center', justifyContent: 'center' },
    accountEmail: { fontSize: 14, fontFamily: 'Inter_500Medium', color: C.text, flex: 1 },
    signOutBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8 },
    signOutText: { fontSize: 14, fontFamily: 'Inter_500Medium', color: C.error },
    subActiveCard: {
      flexDirection: 'row', alignItems: 'center',
      backgroundColor: C.primarySurface, borderRadius: 12, padding: 14,
      borderWidth: 1, borderColor: C.primaryMuted, marginBottom: 12,
    },
    subActiveInfo: { flex: 1 },
    subActivePlan: { fontSize: 15, fontFamily: 'Inter_700Bold', color: C.text },
    subActiveRenewal: { fontSize: 12, fontFamily: 'Inter_400Regular', color: C.textSecondary, marginTop: 2 },
    subActiveBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
    subActiveBadgeText: { fontSize: 12, fontFamily: 'Inter_600SemiBold' },
    subCtaCard: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      backgroundColor: C.primary, borderRadius: 14, padding: 18,
    },
    subCtaTitle: { fontSize: 16, fontFamily: 'Inter_700Bold', color: '#fff' },
    subCtaSub: { fontSize: 12, fontFamily: 'Inter_400Regular', color: 'rgba(255,255,255,0.8)', marginTop: 3 },
    manageSubBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    manageSubText: { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: C.primary },

    sheetOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    sheet: { backgroundColor: C.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 24, paddingTop: 16 },
    sheetHandle: { width: 36, height: 4, backgroundColor: C.border, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
    sheetTitle: { fontSize: 20, fontFamily: 'Inter_700Bold', color: C.text, marginBottom: 20 },
    sheetSub: { fontSize: 13, fontFamily: 'Inter_400Regular', color: C.textSecondary, marginBottom: 16, marginTop: -12 },

    inputLabel: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: C.textSecondary, marginBottom: 6, marginTop: 14 },
    inputHint: { fontSize: 11, fontFamily: 'Inter_400Regular', color: C.textTertiary, marginBottom: 8, marginTop: -4 },
    input: {
      backgroundColor: C.surfaceSecondary, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12,
      fontSize: 15, fontFamily: 'Inter_400Regular', color: C.text,
      borderWidth: 1, borderColor: C.borderLight,
    },
    optionGroup: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    optionChip: {
      paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
      backgroundColor: C.surfaceSecondary, borderWidth: 1, borderColor: C.border,
    },
    optionChipActive: { backgroundColor: C.primaryMuted, borderColor: C.primary },
    optionChipText: { fontSize: 14, fontFamily: 'Inter_500Medium', color: C.textSecondary },
    optionChipTextActive: { color: C.primary, fontFamily: 'Inter_600SemiBold' },
    goalGroup: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    goalChip: {
      flexDirection: 'row', alignItems: 'center', gap: 6,
      paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20,
      backgroundColor: C.surfaceSecondary, borderWidth: 1, borderColor: C.border,
    },
    goalChipActive: { backgroundColor: C.primaryMuted, borderColor: C.primary },
    goalChipText: { fontSize: 13, fontFamily: 'Inter_500Medium', color: C.textTertiary },
    goalChipTextActive: { color: C.primary, fontFamily: 'Inter_600SemiBold' },
    saveBtn: { backgroundColor: C.primary, borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 20 },
    saveBtnText: { fontSize: 15, fontFamily: 'Inter_700Bold', color: C.textInverse },
    cancelBtn: { paddingVertical: 14, alignItems: 'center' },
    cancelBtnText: { fontSize: 15, fontFamily: 'Inter_500Medium', color: C.textSecondary },

    upgradeNote: {
      flexDirection: 'row', alignItems: 'flex-start', gap: 8,
      backgroundColor: C.primaryMuted, borderRadius: 8, padding: 10, marginBottom: 12,
    },
    upgradeNoteText: { flex: 1, fontSize: 12, fontFamily: 'Inter_400Regular', color: C.textSecondary },
    effectiveBadge: { backgroundColor: C.surfaceSecondary, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 12 },
    effectiveBadgeText: { fontSize: 12, fontFamily: 'Inter_400Regular', color: C.textSecondary },
    equipRow: {
      flexDirection: 'row', alignItems: 'center', gap: 14,
      paddingVertical: 12, paddingHorizontal: 4, borderRadius: 10,
      borderBottomWidth: 1, borderBottomColor: C.borderLight,
    },
    equipRowActive: {},
    equipRowLocked: { opacity: 0.5 },
    equipLabel: { flex: 1, fontSize: 15, fontFamily: 'Inter_500Medium', color: C.textSecondary },
    equipLabelActive: { color: C.primary, fontFamily: 'Inter_600SemiBold' },
    equipLabelLocked: { color: C.textTertiary },
    equipCheckbox: {
      width: 22, height: 22, borderRadius: 11,
      borderWidth: 2, borderColor: C.border, alignItems: 'center', justifyContent: 'center',
    },
    equipCheckboxActive: { backgroundColor: C.primary, borderColor: C.primary },

    settingItemLabel: { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: C.text, marginBottom: 2 },
    settingItemSub: { fontSize: 12, fontFamily: 'Inter_400Regular', color: C.textSecondary, marginBottom: 10 },
    settingDivider: { height: 1, backgroundColor: C.borderLight, marginVertical: 16 },
    freqRow: { flexDirection: 'row', gap: 10 },
    freqBtn: {
      flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center',
      backgroundColor: C.surfaceSecondary, borderWidth: 1, borderColor: C.border,
    },
    freqBtnActive: { backgroundColor: C.primaryMuted, borderColor: C.primary },
    freqBtnText: { fontSize: 13, fontFamily: 'Inter_500Medium', color: C.textSecondary },
    freqBtnTextActive: { color: C.primary, fontFamily: 'Inter_600SemiBold' },
    feedbackBtn: {
      flexDirection: 'row', alignItems: 'center', gap: 10,
      paddingVertical: 12,
    },
    feedbackText: { fontSize: 14, fontFamily: 'Inter_500Medium', color: C.primary },
    resetBtn: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12 },
    resetText: { fontSize: 14, fontFamily: 'Inter_500Medium', color: C.error },
  });
}
