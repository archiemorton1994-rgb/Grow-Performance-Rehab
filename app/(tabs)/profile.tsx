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
  Switch,
  Linking,
  Image,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { EquipmentIcon } from '@/components/EquipmentIcon';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useColors } from '@/constants/colors';
import {
  EquipmentTier,
  ExperienceLevel,
  FitnessGoal,
  Sex,
  TIER_ORDER,
  WeightUnit,
  useAppStore,
} from '@/lib/store';
import {
  isNotificationsSupported,
  requestNotificationPermission,
  scheduleWorkoutReminder,
  cancelWorkoutReminder,
  formatReminderTime,
  REMINDER_TIME_OPTIONS,
  STREAK_TIME_OPTIONS,
  scheduleMissedWorkoutNudge,
  cancelMissedWorkoutNudge,
  scheduleStreakProtectionAlert,
  cancelStreakProtectionAlert,
  scheduleBodyweightReminder,
  cancelBodyweightReminder,
} from '@/lib/notifications';
import { getEquipmentLabel, getEffectiveTier } from '@/lib/workout-engine';
import { useAuth, useSubscription } from '@/lib/auth-context';
import { getApiUrl } from '@/lib/query-client';
import { kgToDisplayUnit, displayUnitToKg } from '@/lib/utils';
import { router } from 'expo-router';

const ALL_TIERS: EquipmentTier[] = ['bodyweight', 'bands', 'dumbbells', 'kettlebells', 'fullgym'];

function getLegalUrls() {
  try {
    const base = getApiUrl().replace(/\/$/, '');
    return { privacyUrl: `${base}/privacy`, termsUrl: `${base}/terms` };
  } catch {
    return {
      privacyUrl: 'https://growperformance.app/privacy',
      termsUrl: 'https://growperformance.app/terms',
    };
  }
}
const { privacyUrl, termsUrl } = getLegalUrls();

const EXPERIENCE_OPTIONS: { value: ExperienceLevel; label: string; desc: string }[] = [
  { value: 'beginner', label: 'Beginner', desc: 'New to gym or returning after a long break' },
  { value: 'intermediate', label: 'Intermediate', desc: '1-3 years consistent training' },
  { value: 'advanced', label: 'Advanced', desc: '3+ years, familiar with main lifts' },
];

const GOAL_OPTIONS: { value: FitnessGoal; label: string; icon: keyof typeof Ionicons.glyphMap }[] =
  [
    { value: 'strength', label: 'Build Strength', icon: 'barbell-outline' },
    { value: 'muscle', label: 'Build Muscle', icon: 'body-outline' },
    { value: 'power', label: 'Power & Speed', icon: 'flash-outline' },
    { value: 'fat_loss', label: 'Fat Loss', icon: 'flame-outline' },
    { value: 'fitness', label: 'General Fitness', icon: 'heart-outline' },
    { value: 'rehab', label: 'Rehab & Recover', icon: 'medical-outline' },
  ];

type ActiveModal = 'edit' | 'equipment' | 'settings' | 'bodyweight' | null;

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const C = useColors();
  const {
    equipmentTiers,
    setEquipmentTiers,
    completedSessions,
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
    reminderEnabled,
    setReminderEnabled,
    reminderTime,
    setReminderTime,
    nudgeEnabled,
    setNudgeEnabled,
    streakProtectionEnabled,
    setStreakProtectionEnabled,
    streakProtectionTime,
    setStreakProtectionTime,
    bodyweightReminderEnabled,
    setBodyweightReminderEnabled,
    profilePhotoUri,
    setProfilePhotoUri,
    getBestORM,
    oneRepMaxes,
    isWeightReminderVisible,
    tourComplete,
    setTourComplete,
    weeklyStreakGoal,
    setWeeklyStreakGoal,
  } = useAppStore();

  const { user, signOut } = useAuth();
  const { isActive: hasActiveSubscription, isOnTrial, expiryDate } = useSubscription();

  const effectiveTier = storeGetEffectiveTier();
  const streak = getStreakDays();
  const weekCount = getThisWeekCount();
  const webTopInset = Platform.OS === 'web' ? 67 : 0;

  const [activeModal, setActiveModal] = useState<ActiveModal>(null);
  const [returnToSettings, setReturnToSettings] = useState(false);

  const [bwText, setBwText] = useState('');

  // Closes the current sub-modal. If it was opened from inside the Settings
  // sheet, re-opens Settings so the user lands back where they came from.
  const dismissModal = () => {
    if (returnToSettings) {
      setReturnToSettings(false);
      setActiveModal('settings');
    } else {
      setActiveModal(null);
    }
  };

  const openFromSettings = (kind: 'edit' | 'equipment' | 'bodyweight') => {
    setReturnToSettings(true);
    if (kind === 'edit') openEdit();
    else if (kind === 'equipment') openEquipment();
    else openBodyweight();
  };

  const openBodyweight = () => {
    const display =
      userProfile.bodyweightKg > 0
        ? String(kgToDisplayUnit(userProfile.bodyweightKg, weightUnit))
        : '';
    setBwText(display);
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setActiveModal('bodyweight');
  };

  const saveBodyweight = () => {
    const val = parseFloat(bwText);
    const hasBwText = bwText.trim().length > 0;
    if (hasBwText && !(val > 0)) return;
    if (val > 0) {
      setUserProfile({ bodyweightKg: displayUnitToKg(val, weightUnit) });
    }
    dismissModal();
    if (Platform.OS !== 'web' && val > 0)
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const [editName, setEditName] = useState('');
  const [editWeight, setEditWeight] = useState('');
  const [editSex, setEditSex] = useState<Sex>('male');
  const [editExp, setEditExp] = useState<ExperienceLevel>('beginner');
  const [editGoals, setEditGoals] = useState<FitnessGoal[]>(['fitness']);
  const [editTiers, setEditTiers] = useState<EquipmentTier[]>(['bodyweight']);

  const openEdit = () => {
    setEditName(userProfile.name);
    setEditWeight(
      userProfile.bodyweightKg > 0
        ? String(kgToDisplayUnit(userProfile.bodyweightKg, weightUnit))
        : ''
    );
    setEditSex(userProfile.sex ?? 'male');
    setEditExp(userProfile.experienceLevel);
    setEditGoals(userProfile.goals?.length ? userProfile.goals : ['fitness']);
    setActiveModal('edit');
  };

  const openEquipment = () => {
    setEditTiers(
      equipmentTiers && equipmentTiers.length > 0 ? [...equipmentTiers] : ['bodyweight']
    );
    setActiveModal('equipment');
  };

  const toggleEditGoal = (g: FitnessGoal) => {
    setEditGoals((prev) => {
      if (prev.includes(g)) {
        const next = prev.filter((x) => x !== g);
        return next.length > 0 ? next : [g];
      }
      if (prev.length >= 2) return [prev[1], g];
      return [...prev, g];
    });
  };

  const toggleEditTier = (tier: EquipmentTier) => {
    const isLocked =
      userProfile.experienceLevel === 'beginner' && !['bodyweight', 'bands'].includes(tier);
    if (isLocked) return;
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setEditTiers((prev) => {
      if (tier === 'fullgym') {
        if (prev.includes('fullgym')) {
          return prev.filter((t) => t !== 'fullgym');
        } else {
          const available =
            userProfile.experienceLevel === 'beginner' ? ['bodyweight', 'bands'] : [...TIER_ORDER];
          return available as EquipmentTier[];
        }
      }
      if (prev.includes(tier)) {
        const next = prev.filter((t) => t !== tier && t !== 'fullgym');
        return next.length > 0 ? next : [tier];
      }
      return [...prev, tier];
    });
  };

  const editWeightTrimmed = editWeight.trim();
  const editWeightParsed = /^\d+(\.\d+)?$/.test(editWeightTrimmed)
    ? parseFloat(editWeightTrimmed)
    : NaN;
  // Bodyweight is required to save. Empty / whitespace / non-numeric / 0 / negative
  // all fail validation - the Save button is disabled and an inline error is shown.
  // This prevents the silent "save did nothing" bug where the field fell back to the
  // existing bodyweight without telling the user the new value wasn't applied.
  const editWeightValid =
    editWeightTrimmed !== '' && !isNaN(editWeightParsed) && editWeightParsed > 0;

  const saveEdit = () => {
    if (!editWeightValid) return;
    setUserProfile({
      name: editName.trim(),
      bodyweightKg: displayUnitToKg(editWeightParsed, weightUnit),
      sex: editSex,
      experienceLevel: editExp,
      goals: editGoals,
    });
    dismissModal();
  };

  const saveEquipment = () => {
    setEquipmentTiers(editTiers);
    dismissModal();
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
            if (Platform.OS !== 'web')
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            resetProgress();
            setActiveModal(null);
          },
        },
      ]
    );
  };

  const handleSignOut = () => {
    if (Platform.OS === 'web') {
      signOut();
      return;
    }
    Alert.alert('Sign out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: signOut },
    ]);
  };

  const handleSendFeedback = () => {
    Linking.openURL('mailto:feedback@growperformance.app?subject=App Feedback').catch(() => {});
  };

  const handleReminderToggle = async (value: boolean) => {
    if (!isNotificationsSupported()) return;
    if (value) {
      const granted = await requestNotificationPermission();
      if (!granted) {
        Alert.alert(
          'Notifications Disabled',
          'Please enable notifications for Grow in your device Settings to use workout reminders.',
          [{ text: 'OK' }]
        );
        return;
      }
      setReminderEnabled(true);
      await scheduleWorkoutReminder(reminderTime);
      if (Platform.OS !== 'web')
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      setReminderEnabled(false);
      await cancelWorkoutReminder();
      if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const handleReminderTimeChange = async (time: string) => {
    setReminderTime(time);
    if (reminderEnabled) {
      await scheduleWorkoutReminder(time);
    }
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handlePickPhoto = async () => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow access to your photo library in Settings.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]?.uri) {
      setProfilePhotoUri(result.assets[0].uri);
      if (Platform.OS !== 'web')
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  };

  const displayName = userProfile.name || 'Set your name';
  const expLabel =
    EXPERIENCE_OPTIONS.find((e) => e.value === userProfile.experienceLevel)?.label ?? 'Beginner';
  const activeGoals = userProfile.goals?.length ? userProfile.goals : ['fitness' as FitnessGoal];
  const firstGoalLabel = GOAL_OPTIONS.find((o) => o.value === activeGoals[0])?.label ?? 'Fitness';

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
        <Animated.View entering={FadeInDown.delay(0).duration(400)} style={styles.heroSection}>
          <Text style={styles.heroName}>{displayName}</Text>
          <Pressable style={styles.avatarWrap} onPress={handlePickPhoto} testID="profile-avatar">
            <View style={styles.avatar}>
              {profilePhotoUri ? (
                <Image source={{ uri: profilePhotoUri }} style={styles.avatarPhoto} />
              ) : (
                <Text style={styles.avatarInitial}>
                  {userProfile.name ? userProfile.name[0].toUpperCase() : '?'}
                </Text>
              )}
            </View>
            <View style={styles.avatarEditBadge}>
              <Ionicons name="camera" size={13} color="#fff" />
            </View>
          </Pressable>
          <View style={styles.heroTags}>
            <View style={styles.tagGreen}>
              <Text style={styles.tagGreenText}>{expLabel}</Text>
            </View>
            {activeGoals.map((g) => {
              const opt = GOAL_OPTIONS.find((o) => o.value === g);
              return (
                <View key={g} style={styles.tagGreen}>
                  <Text style={styles.tagGreenText}>{opt?.label ?? g}</Text>
                </View>
              );
            })}
          </View>
          {userProfile.bodyweightKg > 0 && (
            <View style={styles.bwPill}>
              <Text style={styles.bwPillText}>
                {kgToDisplayUnit(userProfile.bodyweightKg, weightUnit)} {weightUnit}
              </Text>
            </View>
          )}
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(60).duration(400)} style={styles.statsCard}>
          <View style={styles.stat}>
            <View style={styles.statNumRow}>
              <Text style={styles.statVal}>{completedSessions.length}</Text>
              <Ionicons
                name="barbell-outline"
                size={15}
                color={C.primaryDark}
                style={styles.statIcon}
              />
            </View>
            <Text style={styles.statLbl}>Sessions</Text>
          </View>
          <View style={styles.stat}>
            <View style={styles.statNumRow}>
              <Text style={styles.statVal}>{streak}</Text>
              <Ionicons
                name="calendar-outline"
                size={15}
                color={C.primaryDark}
                style={styles.statIcon}
              />
            </View>
            <Text style={styles.statLbl}>Week Streak</Text>
          </View>
          <View style={styles.stat}>
            <View style={styles.statNumRow}>
              <Text style={styles.statVal}>{weekCount}</Text>
              <Ionicons
                name="calendar-outline"
                size={15}
                color={C.primaryDark}
                style={styles.statIcon}
              />
            </View>
            <Text style={styles.statLbl}>This Week</Text>
          </View>
        </Animated.View>

        {/* Strength-to-bodyweight ratio strip - only shown when 1RM data + bodyweight are both set */}
        {oneRepMaxes.length > 0 &&
          userProfile.bodyweightKg > 0 &&
          (() => {
            const lifts = (['squat', 'bench', 'deadlift'] as const)
              .map((lift) => ({ lift, orm: getBestORM(lift) }))
              .filter((x) => x.orm !== null);
            if (lifts.length === 0) return null;
            const bwDisplay = kgToDisplayUnit(userProfile.bodyweightKg, weightUnit);
            return (
              <Animated.View entering={FadeInDown.delay(90).duration(400)} style={styles.ratioCard}>
                <Text style={styles.ratioCardTitle}>YOUR STRENGTH PROGRESS</Text>
                <Text style={styles.ratioCardSub}>Bodyweight Multipliers</Text>
                <View style={styles.ratioItemsRow}>
                  {lifts.map(({ lift, orm }) => {
                    const liftDisplay = kgToDisplayUnit(orm!.weight, weightUnit);
                    const ratio = bwDisplay > 0 ? (liftDisplay / bwDisplay).toFixed(1) : null;
                    return ratio ? (
                      <View key={lift} style={styles.ratioItem}>
                        <Text style={styles.ratioVal}>{ratio}×</Text>
                        <Text style={styles.ratioLbl}>
                          {lift.charAt(0).toUpperCase() + lift.slice(1)}
                        </Text>
                      </View>
                    ) : null;
                  })}
                </View>
              </Animated.View>
            );
          })()}

        {/* Strength 1RM prompt — shown when no lifts have been logged yet */}
        {oneRepMaxes.length === 0 && (
          <Animated.View entering={FadeInDown.delay(90).duration(400)} style={{ marginBottom: 12 }}>
            <View
              style={[styles.ratioCard, { flexDirection: 'row', alignItems: 'center', gap: 14 }]}
            >
              <View
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  backgroundColor: C.primarySurface,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons name="barbell-outline" size={22} color={C.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.ratioCardTitle}>STRENGTH PROGRESS</Text>
                <Text style={styles.ratioCardSub}>
                  Log a 1RM to track your bodyweight multipliers
                </Text>
              </View>
            </View>
          </Animated.View>
        )}

        {/* Subscription card */}
        <Animated.View entering={FadeInDown.delay(120).duration(400)} style={{ marginBottom: 12 }}>
          {hasActiveSubscription ? (
            <Pressable
              onPress={() => {
                const url =
                  Platform.OS === 'ios'
                    ? 'itms-apps://apps.apple.com/account/subscriptions'
                    : 'https://play.google.com/store/account/subscriptions';
                Linking.openURL(url).catch(() => {});
              }}
              style={({ pressed }) => [styles.infoCard, pressed && { opacity: 0.85 }]}
              testID="manage-subscription-btn"
            >
              <View style={styles.infoCardIconWrap}>
                <Ionicons name="checkmark-circle" size={24} color={C.primaryDark} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.infoCardTitle}>
                  {isOnTrial ? 'FREE TRIAL ACTIVE' : 'GROW MONTHLY'}
                </Text>
                <Text style={styles.infoCardSub}>
                  {isOnTrial && expiryDate
                    ? (() => {
                        const daysLeft = Math.max(
                          0,
                          Math.ceil(
                            (new Date(expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
                          )
                        );
                        return daysLeft > 0 ? `Expires in ${daysLeft} days` : 'Tap to manage';
                      })()
                    : expiryDate
                      ? `Renews ${new Date(expiryDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`
                      : 'Active'}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={C.textTertiary} />
            </Pressable>
          ) : (
            <Pressable
              onPress={() => router.push('/subscription')}
              style={({ pressed }) => [styles.infoCard, pressed && { opacity: 0.9 }]}
              testID="subscribe-cta"
            >
              <View style={styles.infoCardIconWrap}>
                <Ionicons name="lock-closed-outline" size={22} color={C.textSecondary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.infoCardTitle}>SUBSCRIBE TO GROW</Text>
                <Text style={styles.infoCardSub}>£4.99/month · cancel anytime</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={C.textTertiary} />
            </Pressable>
          )}
        </Animated.View>

        {/* Single Settings entry - everything else lives behind here */}
        <Animated.View entering={FadeInDown.delay(180).duration(400)}>
          <Pressable
            onPress={() => {
              if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setActiveModal('settings');
            }}
            style={({ pressed }) => [
              styles.infoCard,
              pressed && { opacity: 0.8, transform: [{ scale: 0.99 }] },
            ]}
            testID="open-settings"
          >
            <View style={styles.infoCardIconWrap}>
              <Ionicons name="settings-outline" size={22} color={C.textSecondary} />
            </View>
            <View style={styles.navBtnText}>
              <Text style={styles.infoCardTitle}>SETTINGS</Text>
              <Text style={styles.infoCardSub}>
                Profile • Equipment • Reminders • Units • Account
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={C.textTertiary} />
          </Pressable>
        </Animated.View>
      </ScrollView>

      {/* Edit Details Modal */}
      <Modal
        visible={activeModal === 'edit'}
        transparent
        animationType="slide"
        onRequestClose={dismissModal}
      >
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

            <Text style={styles.inputLabel}>Bodyweight ({weightUnit})</Text>
            <TextInput
              style={[styles.input, !editWeightValid && { borderColor: C.error }]}
              value={editWeight}
              onChangeText={setEditWeight}
              placeholder={weightUnit === 'kg' ? 'e.g. 80' : 'e.g. 176'}
              placeholderTextColor={C.textTertiary}
              keyboardType="decimal-pad"
              returnKeyType="done"
            />
            {!editWeightValid && (
              <Text
                style={{
                  fontSize: 12,
                  fontFamily: 'Inter_400Regular',
                  color: C.error,
                  marginTop: -6,
                  marginBottom: 6,
                }}
              >
                Enter a valid bodyweight
              </Text>
            )}

            <Text style={styles.inputLabel}>Biological Sex</Text>
            <Text style={styles.inputHint}>
              Used to calibrate starting weights for your sessions
            </Text>
            <View style={styles.optionGroup}>
              {(
                [
                  { value: 'male', label: 'Male' },
                  { value: 'female', label: 'Female' },
                  { value: 'other', label: 'Other' },
                ] as { value: Sex; label: string }[]
              ).map((opt) => (
                <Pressable
                  key={opt.value}
                  onPress={() => setEditSex(opt.value)}
                  style={[styles.optionChip, editSex === opt.value && styles.optionChipActive]}
                >
                  <Text
                    style={[
                      styles.optionChipText,
                      editSex === opt.value && styles.optionChipTextActive,
                    ]}
                  >
                    {opt.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.inputLabel}>Experience Level</Text>
            <View style={styles.optionGroup}>
              {EXPERIENCE_OPTIONS.map((opt) => (
                <Pressable
                  key={opt.value}
                  onPress={() => setEditExp(opt.value)}
                  style={[styles.optionChip, editExp === opt.value && styles.optionChipActive]}
                >
                  <Text
                    style={[
                      styles.optionChipText,
                      editExp === opt.value && styles.optionChipTextActive,
                    ]}
                  >
                    {opt.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.inputLabel}>Goals</Text>
            <Text style={styles.inputHint}>Pick up to 2 - they shape your weights and volume</Text>
            <View style={styles.goalGroup}>
              {GOAL_OPTIONS.map((opt) => {
                const isActive = editGoals.includes(opt.value);
                return (
                  <Pressable
                    key={opt.value}
                    onPress={() => toggleEditGoal(opt.value)}
                    style={[styles.goalChip, isActive && styles.goalChipActive]}
                  >
                    <Ionicons
                      name={opt.icon}
                      size={16}
                      color={isActive ? C.primary : C.textTertiary}
                    />
                    <Text style={[styles.goalChipText, isActive && styles.goalChipTextActive]}>
                      {opt.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Pressable
              onPress={saveEdit}
              disabled={!editWeightValid}
              style={[styles.saveBtn, !editWeightValid && { opacity: 0.4 }]}
            >
              <Text style={styles.saveBtnText}>Save Details</Text>
            </Pressable>
            <Pressable onPress={dismissModal} style={styles.cancelBtn}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Equipment Modal */}
      <Modal
        visible={activeModal === 'equipment'}
        transparent
        animationType="slide"
        onRequestClose={dismissModal}
      >
        <View style={styles.sheetOverlay}>
          <View style={[styles.sheet, { paddingBottom: insets.bottom + 24 }]}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Equipment</Text>
            <Text style={styles.sheetSub}>
              Select everything available to you - we use the best match for each session
            </Text>
            {userProfile.experienceLevel === 'beginner' && (
              <View style={styles.upgradeNote}>
                <Ionicons name="information-circle-outline" size={15} color={C.primary} />
                <Text style={styles.upgradeNoteText}>
                  Beginner mode: No Equipment and bands only. Update your experience level in Edit
                  Details to unlock all equipment.
                </Text>
              </View>
            )}
            {editTiers.length > 0 && (
              <View style={styles.effectiveBadge}>
                <Text style={styles.effectiveBadgeText}>
                  Best match:{' '}
                  <Text style={{ fontFamily: 'Inter_600SemiBold', color: C.primary }}>
                    {getEquipmentLabel(getEffectiveTier(editTiers))}
                  </Text>
                </Text>
              </View>
            )}
            {ALL_TIERS.map((tier) => {
              const isActive = editTiers.includes(tier);
              const isLocked =
                userProfile.experienceLevel === 'beginner' &&
                !['bodyweight', 'bands'].includes(tier);
              return (
                <Pressable
                  key={tier}
                  onPress={() => toggleEditTier(tier)}
                  style={[
                    styles.equipRow,
                    isActive && styles.equipRowActive,
                    isLocked && styles.equipRowLocked,
                  ]}
                  testID={`tier-${tier}`}
                >
                  <EquipmentIcon
                    tier={tier}
                    size={22}
                    color={isActive ? C.primary : isLocked ? C.textTertiary : C.textSecondary}
                  />
                  <Text
                    style={[
                      styles.equipLabel,
                      isActive && styles.equipLabelActive,
                      isLocked && styles.equipLabelLocked,
                    ]}
                  >
                    {getEquipmentLabel(tier)}
                  </Text>
                  {isLocked ? (
                    <Ionicons name="lock-closed-outline" size={18} color={C.textTertiary} />
                  ) : (
                    <View style={[styles.equipCheckbox, isActive && styles.equipCheckboxActive]}>
                      {isActive && <Ionicons name="checkmark" size={13} color={C.textInverse} />}
                    </View>
                  )}
                </Pressable>
              );
            })}
            <Pressable onPress={saveEquipment} style={[styles.saveBtn, { marginTop: 16 }]}>
              <Text style={styles.saveBtnText}>Save Equipment</Text>
            </Pressable>
            <Pressable onPress={dismissModal} style={styles.cancelBtn}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Body Weight Modal */}
      <Modal
        visible={activeModal === 'bodyweight'}
        transparent
        animationType="fade"
        onRequestClose={dismissModal}
      >
        <Pressable style={styles.bwOverlay} onPress={dismissModal}>
          <Pressable style={styles.bwCard} onPress={(e) => e.stopPropagation()}>
            <View style={styles.bwIconWrap}>
              <Ionicons name="scale-outline" size={28} color={C.primary} />
            </View>
            <Text style={styles.bwTitle}>Body Weight</Text>
            <Text style={styles.bwSub}>
              {userProfile.bodyweightKg > 0
                ? `Current: ${kgToDisplayUnit(userProfile.bodyweightKg, weightUnit)} ${weightUnit}`
                : 'Enter your body weight to calibrate session loads'}
            </Text>
            <View style={styles.bwInputRow}>
              <TextInput
                style={[
                  styles.bwInput,
                  bwText.trim().length > 0 && !(parseFloat(bwText) > 0) && styles.bwInputError,
                ]}
                value={bwText}
                onChangeText={setBwText}
                placeholder={weightUnit === 'kg' ? 'e.g. 80' : 'e.g. 176'}
                placeholderTextColor={C.textTertiary}
                keyboardType="decimal-pad"
                returnKeyType="done"
                onSubmitEditing={saveBodyweight}
                autoFocus
              />
              <Text style={styles.bwUnit}>{weightUnit}</Text>
            </View>
            {bwText.trim().length > 0 && !(parseFloat(bwText) > 0) && (
              <Text style={styles.bwErrorText}>Please enter a positive number</Text>
            )}
            <Pressable
              onPress={saveBodyweight}
              style={[
                styles.bwSaveBtn,
                bwText.trim().length > 0 &&
                  !(parseFloat(bwText) > 0) && { backgroundColor: C.border, opacity: 0.7 },
              ]}
              disabled={bwText.trim().length > 0 && !(parseFloat(bwText) > 0)}
              testID="save-bodyweight"
            >
              <Text style={styles.bwSaveBtnText}>Save</Text>
            </Pressable>
            <Pressable onPress={dismissModal} style={styles.cancelBtn}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Settings Modal */}
      <Modal
        visible={activeModal === 'settings'}
        transparent
        animationType="slide"
        onRequestClose={() => setActiveModal(null)}
      >
        <View style={styles.sheetOverlay}>
          <View style={[styles.sheet, { paddingBottom: insets.bottom + 24, maxHeight: '88%' }]}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Settings</Text>

            <ScrollView
              showsVerticalScrollIndicator={false}
              style={{ flexShrink: 1 }}
              contentContainerStyle={{ paddingBottom: 8 }}
            >
              {/* Account */}
              <Text style={styles.settingSectionLabel}>Account</Text>
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

              <View style={styles.settingDivider} />

              {/* Profile rows - open the existing modals via the returnToSettings flag */}
              <Text style={styles.settingSectionLabel}>Profile</Text>
              <Pressable
                onPress={() => openFromSettings('edit')}
                style={({ pressed }) => [styles.settingsLinkRow, pressed && { opacity: 0.7 }]}
                testID="open-edit-details"
              >
                <View style={[styles.navIcon, { backgroundColor: C.primaryMuted }]}>
                  <Ionicons name="person-outline" size={20} color={C.primary} />
                </View>
                <View style={styles.navBtnText}>
                  <Text style={styles.navLabel}>Edit Details</Text>
                  <Text style={styles.navSub}>{editDetailsSubtitle}</Text>
                </View>
                <Ionicons name="chevron-forward" size={14} color={C.textTertiary} />
              </Pressable>

              <Pressable
                onPress={() => openFromSettings('equipment')}
                style={({ pressed }) => [styles.settingsLinkRow, pressed && { opacity: 0.7 }]}
              >
                <View style={[styles.navIcon, { backgroundColor: C.categoryMechanical }]}>
                  <EquipmentIcon tier={effectiveTier} size={20} color={C.categoryMechanicalText} />
                </View>
                <View style={styles.navBtnText}>
                  <Text style={styles.navLabel}>Equipment</Text>
                  <Text style={styles.navSub}>{equipmentSubtitle}</Text>
                </View>
                <Ionicons name="chevron-forward" size={14} color={C.textTertiary} />
              </Pressable>

              <Pressable
                onPress={() => openFromSettings('bodyweight')}
                style={({ pressed }) => [styles.settingsLinkRow, pressed && { opacity: 0.7 }]}
                testID="open-bodyweight"
              >
                <View style={[styles.navIcon, { backgroundColor: C.primaryMuted }]}>
                  <Ionicons name="scale-outline" size={20} color={C.primary} />
                </View>
                <View style={styles.navBtnText}>
                  <Text style={styles.navLabel}>Body Weight</Text>
                  <Text style={styles.navSub}>
                    {userProfile.bodyweightKg > 0
                      ? `${kgToDisplayUnit(userProfile.bodyweightKg, weightUnit)} ${weightUnit}`
                      : 'Not set'}
                  </Text>
                </View>
                {isWeightReminderVisible() && <View style={styles.staleWeightDot} />}
                <Ionicons name="chevron-forward" size={14} color={C.textTertiary} />
              </Pressable>

              <View style={styles.settingDivider} />

              <Text style={styles.settingSectionLabel}>Preferences</Text>
              <Text style={styles.settingItemLabel}>Workout Reminders</Text>
              <Text style={styles.settingItemSub}>
                Get a daily nudge to keep your training on track
              </Text>
              {isNotificationsSupported() ? (
                <>
                  <View style={styles.reminderToggleRow}>
                    <Text style={styles.reminderToggleLabel}>
                      {reminderEnabled ? `Daily at ${formatReminderTime(reminderTime)}` : 'Off'}
                    </Text>
                    <Switch
                      value={reminderEnabled}
                      onValueChange={handleReminderToggle}
                      trackColor={{ false: C.border, true: C.primary }}
                      thumbColor={C.textInverse}
                      testID="reminder-toggle"
                    />
                  </View>
                  {reminderEnabled && (
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      style={styles.timeScroll}
                      contentContainerStyle={styles.timeScrollContent}
                    >
                      {REMINDER_TIME_OPTIONS.map((t) => (
                        <Pressable
                          key={t}
                          onPress={() => handleReminderTimeChange(t)}
                          style={[styles.timeChip, reminderTime === t && styles.timeChipActive]}
                          testID={`reminder-time-${t}`}
                        >
                          <Text
                            style={[
                              styles.timeChipText,
                              reminderTime === t && styles.timeChipTextActive,
                            ]}
                          >
                            {formatReminderTime(t)}
                          </Text>
                        </Pressable>
                      ))}
                    </ScrollView>
                  )}

                  <Text style={[styles.settingItemLabel, { marginTop: 14 }]}>
                    Missed Workout Nudge
                  </Text>
                  <Text style={styles.settingItemSub}>
                    {"Reminds you to train if you haven't opened the app in 20 hours"}
                  </Text>
                  <View style={styles.reminderToggleRow}>
                    <Text style={styles.reminderToggleLabel}>{nudgeEnabled ? 'On' : 'Off'}</Text>
                    <Switch
                      value={nudgeEnabled}
                      onValueChange={async (value) => {
                        setNudgeEnabled(value);
                        if (value) {
                          const granted = await requestNotificationPermission();
                          if (granted) {
                            void scheduleMissedWorkoutNudge();
                          } else {
                            setNudgeEnabled(false);
                          }
                        } else {
                          void cancelMissedWorkoutNudge();
                        }
                        if (Platform.OS !== 'web')
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      }}
                      trackColor={{ false: C.border, true: C.primary }}
                      thumbColor={C.textInverse}
                      testID="nudge-toggle"
                    />
                  </View>

                  <Text style={[styles.settingItemLabel, { marginTop: 14 }]}>
                    Streak Protection Alert
                  </Text>
                  <Text style={styles.settingItemSub}>
                    {"Reminds you if you haven't trained yet and your streak is at risk"}
                  </Text>
                  <View style={styles.reminderToggleRow}>
                    <Text style={styles.reminderToggleLabel}>
                      {streakProtectionEnabled && streak >= 2
                        ? `On at ${formatReminderTime(streakProtectionTime)} - ${streak}-week streak`
                        : streakProtectionEnabled
                          ? `On at ${formatReminderTime(streakProtectionTime)}`
                          : 'Off'}
                    </Text>
                    <Switch
                      value={streakProtectionEnabled}
                      onValueChange={async (value) => {
                        if (value) {
                          const granted = await requestNotificationPermission();
                          if (!granted) {
                            Alert.alert(
                              'Notifications Disabled',
                              'Please enable notifications for Grow in your device Settings to use streak alerts.',
                              [{ text: 'OK' }]
                            );
                            return;
                          }
                          setStreakProtectionEnabled(true);
                          void scheduleStreakProtectionAlert(
                            streakProtectionTime,
                            weeklyStreakGoal,
                            weekCount
                          );
                        } else {
                          setStreakProtectionEnabled(false);
                          void cancelStreakProtectionAlert();
                        }
                        if (Platform.OS !== 'web')
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      }}
                      trackColor={{ false: C.border, true: C.primary }}
                      thumbColor={C.textInverse}
                      testID="streak-protection-toggle"
                    />
                  </View>
                  {streakProtectionEnabled && (
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      style={styles.timeScroll}
                      contentContainerStyle={styles.timeScrollContent}
                    >
                      {STREAK_TIME_OPTIONS.map((t) => (
                        <Pressable
                          key={t}
                          onPress={async () => {
                            setStreakProtectionTime(t);
                            if (Platform.OS !== 'web')
                              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            void scheduleStreakProtectionAlert(t, weeklyStreakGoal, weekCount);
                          }}
                          style={[
                            styles.timeChip,
                            streakProtectionTime === t && styles.timeChipActive,
                          ]}
                          testID={`streak-time-${t}`}
                        >
                          <Text
                            style={[
                              styles.timeChipText,
                              streakProtectionTime === t && styles.timeChipTextActive,
                            ]}
                          >
                            {formatReminderTime(t)}
                          </Text>
                        </Pressable>
                      ))}
                    </ScrollView>
                  )}

                  <Text style={[styles.settingItemLabel, { marginTop: 14 }]}>
                    Bodyweight Reminder
                  </Text>
                  <Text style={styles.settingItemSub}>
                    Nudge to update your logged weight after 21 days without a change
                  </Text>
                  <View style={styles.reminderToggleRow}>
                    <Text style={styles.reminderToggleLabel}>
                      {bodyweightReminderEnabled ? 'On' : 'Off'}
                    </Text>
                    <Switch
                      value={bodyweightReminderEnabled}
                      onValueChange={async (value) => {
                        setBodyweightReminderEnabled(value);
                        if (value) {
                          const granted = await requestNotificationPermission();
                          if (granted) {
                            const { bodyweightUpdatedAt, completedSessions } =
                              useAppStore.getState();
                            void scheduleBodyweightReminder(
                              bodyweightUpdatedAt,
                              completedSessions.length > 0
                            );
                          } else {
                            setBodyweightReminderEnabled(false);
                          }
                        } else {
                          void cancelBodyweightReminder();
                        }
                        if (Platform.OS !== 'web')
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      }}
                      trackColor={{ false: C.border, true: C.primary }}
                      thumbColor={C.textInverse}
                      testID="bodyweight-reminder-toggle"
                    />
                  </View>
                </>
              ) : (
                <Text style={styles.reminderWebNote}>
                  Reminders are available on iOS and Android only.
                </Text>
              )}

              <View style={styles.settingDivider} />

              <Text style={styles.settingItemLabel}>Weekly Streak Goal</Text>
              <Text style={styles.settingItemSub}>
                Sessions per week needed to maintain your streak
              </Text>
              <View style={styles.freqRow}>
                {([2, 3, 4, 5] as const).map((n) => (
                  <Pressable
                    key={n}
                    onPress={() => {
                      setWeeklyStreakGoal(n);
                      if (Platform.OS !== 'web')
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    }}
                    style={[styles.freqBtn, weeklyStreakGoal === n && styles.freqBtnActive]}
                    testID={`weekly-goal-${n}`}
                  >
                    <Text
                      style={[
                        styles.freqBtnText,
                        weeklyStreakGoal === n && styles.freqBtnTextActive,
                      ]}
                    >
                      {n}×
                    </Text>
                  </Pressable>
                ))}
              </View>

              <View style={styles.settingDivider} />

              <Text style={styles.settingItemLabel}>Test Week Frequency</Text>
              <Text style={styles.settingItemSub}>How often to trigger a strength test week</Text>
              <View style={styles.freqRow}>
                {([12, 18] as const).map((freq) => (
                  <Pressable
                    key={freq}
                    onPress={() => {
                      setTestWeekFrequency(freq);
                      if (Platform.OS !== 'web')
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    }}
                    style={[styles.freqBtn, testWeekFrequency === freq && styles.freqBtnActive]}
                    testID="test-freq-toggle"
                  >
                    <Text
                      style={[
                        styles.freqBtnText,
                        testWeekFrequency === freq && styles.freqBtnTextActive,
                      ]}
                    >
                      Every {freq} sessions
                    </Text>
                  </Pressable>
                ))}
              </View>

              <View style={styles.settingDivider} />

              <Text style={styles.settingItemLabel}>Weight Units</Text>
              <Text style={styles.settingItemSub}>Used throughout the app for weight display</Text>
              <View style={styles.freqRow}>
                {(['kg', 'lbs'] as WeightUnit[]).map((unit) => (
                  <Pressable
                    key={unit}
                    onPress={() => {
                      setWeightUnit(unit);
                      if (Platform.OS !== 'web')
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    }}
                    style={[styles.freqBtn, weightUnit === unit && styles.freqBtnActive]}
                  >
                    <Text
                      style={[styles.freqBtnText, weightUnit === unit && styles.freqBtnTextActive]}
                    >
                      {unit}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <View style={styles.settingDivider} />

              <Pressable onPress={handleSendFeedback} style={styles.feedbackBtn}>
                <Ionicons name="mail-outline" size={18} color={C.primary} />
                <Text style={styles.feedbackText}>Send Feedback</Text>
                <Ionicons
                  name="open-outline"
                  size={14}
                  color={C.textTertiary}
                  style={{ marginLeft: 'auto' }}
                />
              </Pressable>

              <View style={styles.settingDivider} />

              <Text style={styles.settingSectionLabel}>Subscription</Text>
              {hasActiveSubscription ? (
                <Pressable
                  onPress={() => {
                    const url =
                      Platform.OS === 'ios'
                        ? 'itms-apps://apps.apple.com/account/subscriptions'
                        : 'https://play.google.com/store/account/subscriptions';
                    Linking.openURL(url).catch(() => {});
                  }}
                  style={({ pressed }) => [styles.settingsLinkRow, pressed && { opacity: 0.7 }]}
                  testID="settings-manage-subscription"
                >
                  <View style={[styles.navIcon, { backgroundColor: C.primaryMuted }]}>
                    <Ionicons name="card-outline" size={20} color={C.primary} />
                  </View>
                  <View style={styles.navBtnText}>
                    <Text style={styles.navLabel}>Manage Subscription</Text>
                    <Text style={styles.navSub}>
                      {isOnTrial
                        ? 'Free trial - change or cancel anytime'
                        : 'Change plan or cancel'}
                    </Text>
                  </View>
                  <Ionicons name="open-outline" size={14} color={C.textTertiary} />
                </Pressable>
              ) : (
                <Pressable
                  onPress={() => {
                    setActiveModal(null);
                    router.push('/subscription');
                  }}
                  style={({ pressed }) => [styles.settingsLinkRow, pressed && { opacity: 0.7 }]}
                  testID="settings-subscribe"
                >
                  <View style={[styles.navIcon, { backgroundColor: C.primaryMuted }]}>
                    <Ionicons name="card-outline" size={20} color={C.primary} />
                  </View>
                  <View style={styles.navBtnText}>
                    <Text style={styles.navLabel}>Subscribe to Grow</Text>
                    <Text style={styles.navSub}>£4.99/month · cancel anytime</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={14} color={C.textTertiary} />
                </Pressable>
              )}

              {tourComplete && (
                <>
                  <View style={styles.settingDivider} />

                  <Text style={styles.settingSectionLabel}>App</Text>
                  <Pressable
                    onPress={() => {
                      if (Platform.OS !== 'web')
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setTourComplete(false);
                      setActiveModal(null);
                    }}
                    style={({ pressed }) => [styles.settingsLinkRow, pressed && { opacity: 0.7 }]}
                    testID="replay-tour"
                  >
                    <View style={[styles.navIcon, { backgroundColor: C.primaryMuted }]}>
                      <Ionicons name="map-outline" size={20} color={C.primary} />
                    </View>
                    <View style={styles.navBtnText}>
                      <Text style={styles.navLabel}>Replay Guided Tour</Text>
                      <Text style={styles.navSub}>Walk through the app again</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={14} color={C.textTertiary} />
                  </Pressable>
                </>
              )}

              <View style={styles.settingDivider} />

              <Text style={styles.settingSectionLabel}>Legal</Text>
              <Pressable
                onPress={() => Linking.openURL(termsUrl)}
                style={({ pressed }) => [styles.settingsLinkRow, pressed && { opacity: 0.7 }]}
                testID="settings-terms"
              >
                <View style={[styles.navIcon, { backgroundColor: C.primaryMuted }]}>
                  <Ionicons name="document-text-outline" size={20} color={C.primary} />
                </View>
                <View style={styles.navBtnText}>
                  <Text style={styles.navLabel}>Terms of Service</Text>
                </View>
                <Ionicons name="open-outline" size={14} color={C.textTertiary} />
              </Pressable>

              <Pressable
                onPress={() => Linking.openURL(privacyUrl)}
                style={({ pressed }) => [styles.settingsLinkRow, pressed && { opacity: 0.7 }]}
                testID="settings-privacy"
              >
                <View style={[styles.navIcon, { backgroundColor: C.primaryMuted }]}>
                  <Ionicons name="shield-checkmark-outline" size={20} color={C.primary} />
                </View>
                <View style={styles.navBtnText}>
                  <Text style={styles.navLabel}>Privacy Policy</Text>
                </View>
                <Ionicons name="open-outline" size={14} color={C.textTertiary} />
              </Pressable>

              <View style={styles.settingDivider} />

              <Pressable onPress={handleReset} style={styles.resetBtn} testID="reset-progress">
                <Ionicons name="refresh-outline" size={18} color={C.error} />
                <Text style={styles.resetText}>Reset All Progress</Text>
              </Pressable>
            </ScrollView>

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
    heroSection: {
      alignItems: 'center',
      paddingTop: 28,
      paddingBottom: 28,
      gap: 14,
    },
    avatarWrap: { position: 'relative' },
    avatar: {
      width: 100,
      height: 100,
      borderRadius: 50,
      backgroundColor: C.primaryMuted,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
      borderWidth: 2,
      borderColor: C.border,
    },
    avatarPhoto: { width: 100, height: 100, borderRadius: 50 },
    avatarInitial: { fontSize: 40, fontFamily: 'Inter_700Bold', color: C.primary },
    avatarEditBadge: {
      position: 'absolute',
      bottom: 2,
      right: 2,
      width: 26,
      height: 26,
      borderRadius: 13,
      backgroundColor: C.primary,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
      borderColor: C.background,
    },
    heroName: {
      fontSize: 28,
      fontFamily: 'Inter_700Bold',
      color: C.text,
      textAlign: 'center',
    },
    heroTags: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      justifyContent: 'center',
    },
    tagGreen: {
      paddingHorizontal: 14,
      paddingVertical: 6,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: C.primary,
      backgroundColor: 'transparent',
    },
    tagGreenText: {
      fontSize: 13,
      fontFamily: 'Inter_600SemiBold',
      color: C.primaryDark,
    },
    bwPill: {
      paddingHorizontal: 18,
      paddingVertical: 7,
      borderRadius: 20,
      backgroundColor: C.surfaceTertiary,
    },
    bwPillText: {
      fontSize: 14,
      fontFamily: 'Inter_500Medium',
      color: C.text,
    },
    statsCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: C.surface,
      borderRadius: 16,
      padding: 20,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: C.borderLight,
    },
    stat: { flex: 1, alignItems: 'center' },
    statNumRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    statVal: { fontSize: 26, fontFamily: 'Inter_700Bold', color: C.primaryDark },
    statIcon: { marginTop: 3 },
    statLbl: {
      fontSize: 11,
      fontFamily: 'Inter_500Medium',
      color: C.textSecondary,
      marginTop: 4,
      textAlign: 'center',
    },
    navGrid: { gap: 8, marginBottom: 16 },
    navBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      backgroundColor: C.surface,
      borderRadius: 14,
      padding: 14,
      borderWidth: 1,
      borderColor: C.borderLight,
    },
    navIcon: {
      width: 42,
      height: 42,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    navBtnText: { flex: 1 },
    navLabel: { fontSize: 15, fontFamily: 'Inter_600SemiBold', color: C.text },
    navSub: { fontSize: 12, fontFamily: 'Inter_400Regular', color: C.textSecondary, marginTop: 2 },
    sectionCard: {
      backgroundColor: C.surface,
      borderRadius: 16,
      padding: 18,
      marginBottom: 14,
      borderWidth: 1,
      borderColor: C.borderLight,
    },
    sectionTitle: {
      fontSize: 13,
      fontFamily: 'Inter_600SemiBold',
      color: C.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginBottom: 12,
    },
    accountRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
    accountIcon: {
      width: 34,
      height: 34,
      borderRadius: 10,
      backgroundColor: C.primaryMuted,
      alignItems: 'center',
      justifyContent: 'center',
    },
    accountEmail: { fontSize: 14, fontFamily: 'Inter_500Medium', color: C.text, flex: 1 },
    signOutBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8 },
    signOutText: { fontSize: 14, fontFamily: 'Inter_500Medium', color: C.error },
    subActiveCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: C.surface,
      borderRadius: 12,
      padding: 14,
      borderWidth: 1,
      borderColor: C.border,
      marginBottom: 12,
    },
    subActiveInfo: { flex: 1 },
    subActivePlan: { fontSize: 15, fontFamily: 'Inter_700Bold', color: C.text },
    subActiveRenewal: {
      fontSize: 12,
      fontFamily: 'Inter_400Regular',
      color: C.textSecondary,
      marginTop: 2,
    },
    subActiveBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
    subActiveBadgeText: { fontSize: 12, fontFamily: 'Inter_600SemiBold' },
    subCtaCard: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: C.primary,
      borderRadius: 14,
      padding: 18,
    },
    subCtaTitle: { fontSize: 16, fontFamily: 'Inter_700Bold', color: C.textInverse },
    subCtaSub: {
      fontSize: 12,
      fontFamily: 'Inter_400Regular',
      color: C.primarySubtext,
      marginTop: 3,
    },
    manageSubBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    manageSubText: { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: C.primary },

    sheetOverlay: { flex: 1, backgroundColor: C.overlayBg, justifyContent: 'flex-end' },
    sheet: {
      backgroundColor: C.surface,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      paddingHorizontal: 24,
      paddingTop: 16,
    },
    sheetHandle: {
      width: 36,
      height: 4,
      backgroundColor: C.border,
      borderRadius: 2,
      alignSelf: 'center',
      marginBottom: 16,
    },
    sheetTitle: { fontSize: 20, fontFamily: 'Inter_700Bold', color: C.text, marginBottom: 20 },
    sheetSub: {
      fontSize: 13,
      fontFamily: 'Inter_400Regular',
      color: C.textSecondary,
      marginBottom: 16,
      marginTop: -12,
    },

    inputLabel: {
      fontSize: 13,
      fontFamily: 'Inter_600SemiBold',
      color: C.textSecondary,
      marginBottom: 6,
      marginTop: 14,
    },
    inputHint: {
      fontSize: 11,
      fontFamily: 'Inter_400Regular',
      color: C.textTertiary,
      marginBottom: 8,
      marginTop: -4,
    },
    input: {
      backgroundColor: C.surfaceSecondary,
      borderRadius: 10,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontSize: 15,
      fontFamily: 'Inter_400Regular',
      color: C.text,
      borderWidth: 1,
      borderColor: C.borderLight,
    },
    optionGroup: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    optionChip: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 20,
      backgroundColor: C.surfaceSecondary,
      borderWidth: 1,
      borderColor: C.border,
    },
    optionChipActive: { backgroundColor: C.primaryMuted, borderColor: C.primary },
    optionChipText: { fontSize: 14, fontFamily: 'Inter_500Medium', color: C.textSecondary },
    optionChipTextActive: { color: C.primary, fontFamily: 'Inter_600SemiBold' },
    goalGroup: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    goalChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 20,
      backgroundColor: C.surfaceSecondary,
      borderWidth: 1,
      borderColor: C.border,
    },
    goalChipActive: { backgroundColor: C.primaryMuted, borderColor: C.primary },
    goalChipText: { fontSize: 13, fontFamily: 'Inter_500Medium', color: C.textTertiary },
    goalChipTextActive: { color: C.primary, fontFamily: 'Inter_600SemiBold' },
    saveBtn: {
      backgroundColor: C.primary,
      borderRadius: 12,
      paddingVertical: 14,
      alignItems: 'center',
      marginTop: 20,
    },
    saveBtnText: { fontSize: 15, fontFamily: 'Inter_700Bold', color: C.textInverse },
    cancelBtn: { paddingVertical: 14, alignItems: 'center' },
    cancelBtnText: { fontSize: 15, fontFamily: 'Inter_500Medium', color: C.textSecondary },

    upgradeNote: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 8,
      backgroundColor: C.surfaceSecondary,
      borderRadius: 8,
      padding: 10,
      marginBottom: 12,
    },
    upgradeNoteText: {
      flex: 1,
      fontSize: 12,
      fontFamily: 'Inter_400Regular',
      color: C.textSecondary,
    },
    effectiveBadge: {
      backgroundColor: C.surfaceSecondary,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 8,
      marginBottom: 12,
    },
    effectiveBadgeText: { fontSize: 12, fontFamily: 'Inter_400Regular', color: C.textSecondary },
    equipRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      paddingVertical: 12,
      paddingHorizontal: 4,
      borderRadius: 10,
      borderBottomWidth: 1,
      borderBottomColor: C.borderLight,
    },
    equipRowActive: {},
    equipRowLocked: { opacity: 0.5 },
    equipLabel: { flex: 1, fontSize: 15, fontFamily: 'Inter_500Medium', color: C.textSecondary },
    equipLabelActive: { color: C.primary, fontFamily: 'Inter_600SemiBold' },
    equipLabelLocked: { color: C.textTertiary },
    equipCheckbox: {
      width: 22,
      height: 22,
      borderRadius: 11,
      borderWidth: 2,
      borderColor: C.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    equipCheckboxActive: { backgroundColor: C.primary, borderColor: C.primary },

    ratioCard: {
      backgroundColor: C.surface,
      borderRadius: 16,
      paddingHorizontal: 20,
      paddingTop: 18,
      paddingBottom: 20,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: C.borderLight,
      gap: 4,
    },
    ratioCardTitle: {
      fontSize: 14,
      fontFamily: 'Inter_700Bold',
      color: C.text,
      textTransform: 'uppercase' as const,
      letterSpacing: 0.8,
    },
    ratioCardSub: {
      fontSize: 12,
      fontFamily: 'Inter_400Regular',
      color: C.textSecondary,
      marginBottom: 12,
    },
    ratioItemsRow: { flexDirection: 'row' as const, alignItems: 'center' as const },
    ratioItem: { flex: 1, alignItems: 'center' as const },
    ratioVal: { fontSize: 26, fontFamily: 'Inter_700Bold', color: C.primaryDark },
    ratioLbl: {
      fontSize: 12,
      fontFamily: 'Inter_500Medium',
      color: C.textSecondary,
      marginTop: 4,
    },
    infoCard: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      gap: 14,
      backgroundColor: C.surface,
      borderRadius: 16,
      padding: 16,
      borderWidth: 1,
      borderColor: C.borderLight,
    },
    infoCardIconWrap: {
      width: 44,
      height: 44,
      borderRadius: 12,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
      backgroundColor: C.surfaceTertiary,
    },
    infoCardTitle: {
      fontSize: 13,
      fontFamily: 'Inter_700Bold',
      color: C.text,
      textTransform: 'uppercase' as const,
      letterSpacing: 0.6,
      marginBottom: 3,
    },
    infoCardSub: {
      fontSize: 12,
      fontFamily: 'Inter_400Regular',
      color: C.textSecondary,
    },
    settingSectionLabel: {
      fontSize: 11,
      fontFamily: 'Inter_600SemiBold',
      color: C.textTertiary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginTop: 4,
      marginBottom: 12,
    },
    settingsLinkRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 10 },
    staleWeightDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.warning },
    subStripActive: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: C.surface,
      borderRadius: 14,
      padding: 14,
      borderWidth: 1,
      borderColor: C.borderLight,
    },
    subStripIcon: {
      width: 36,
      height: 36,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: C.primaryMuted,
    },
    subStripTitle: { fontSize: 14, fontFamily: 'Inter_700Bold', color: C.text },
    subStripSub: {
      fontSize: 12,
      fontFamily: 'Inter_400Regular',
      color: C.textSecondary,
      marginTop: 2,
    },
    subStripCta: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: C.primary,
      borderRadius: 14,
      padding: 16,
    },
    subStripCtaTitle: { fontSize: 15, fontFamily: 'Inter_700Bold', color: C.textInverse },
    subStripCtaSub: {
      fontSize: 12,
      fontFamily: 'Inter_400Regular',
      color: C.primarySubtext,
      marginTop: 2,
    },
    settingItemLabel: {
      fontSize: 14,
      fontFamily: 'Inter_600SemiBold',
      color: C.text,
      marginBottom: 2,
    },
    settingItemSub: {
      fontSize: 12,
      fontFamily: 'Inter_400Regular',
      color: C.textSecondary,
      marginBottom: 10,
    },
    settingDivider: { height: 1, backgroundColor: C.borderLight, marginVertical: 16 },
    freqRow: { flexDirection: 'row', gap: 10 },
    freqBtn: {
      flex: 1,
      paddingVertical: 10,
      borderRadius: 10,
      alignItems: 'center',
      backgroundColor: C.surfaceSecondary,
      borderWidth: 1,
      borderColor: C.border,
    },
    freqBtnActive: { backgroundColor: C.primaryMuted, borderColor: C.primary },
    freqBtnText: { fontSize: 13, fontFamily: 'Inter_500Medium', color: C.textSecondary },
    freqBtnTextActive: { color: C.primary, fontFamily: 'Inter_600SemiBold' },
    reminderToggleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 4,
      marginBottom: 8,
    },
    reminderToggleLabel: { fontSize: 14, fontFamily: 'Inter_500Medium', color: C.text },
    timeScroll: { marginBottom: 4 },
    timeScrollContent: { gap: 8, paddingRight: 4 },
    timeChip: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 20,
      backgroundColor: C.surfaceSecondary,
      borderWidth: 1,
      borderColor: C.border,
    },
    timeChipActive: { backgroundColor: C.primaryMuted, borderColor: C.primary },
    timeChipText: { fontSize: 13, fontFamily: 'Inter_500Medium', color: C.textSecondary },
    timeChipTextActive: { color: C.primary, fontFamily: 'Inter_600SemiBold' },
    reminderWebNote: {
      fontSize: 13,
      fontFamily: 'Inter_400Regular',
      color: C.textTertiary,
      marginBottom: 4,
    },
    feedbackBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingVertical: 12,
    },
    feedbackText: { fontSize: 14, fontFamily: 'Inter_500Medium', color: C.primary },
    resetBtn: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12 },
    resetText: { fontSize: 14, fontFamily: 'Inter_500Medium', color: C.error },

    // Body weight quick-edit modal
    bwOverlay: {
      flex: 1,
      backgroundColor: C.overlayBgLight,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 24,
    },
    bwCard: {
      width: '100%',
      backgroundColor: C.surface,
      borderRadius: 20,
      padding: 24,
      alignItems: 'center',
    },
    bwIconWrap: {
      width: 56,
      height: 56,
      borderRadius: 16,
      backgroundColor: C.primaryMuted,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 14,
    },
    bwTitle: {
      fontSize: 20,
      fontFamily: 'Inter_700Bold',
      color: C.text,
      marginBottom: 6,
      textAlign: 'center',
    },
    bwSub: {
      fontSize: 13,
      fontFamily: 'Inter_400Regular',
      color: C.textSecondary,
      textAlign: 'center',
      marginBottom: 20,
      lineHeight: 18,
    },
    bwInputRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginBottom: 20,
      alignSelf: 'stretch',
    },
    bwInput: {
      flex: 1,
      height: 48,
      backgroundColor: C.surfaceTertiary,
      borderRadius: 12,
      borderWidth: 1.5,
      borderColor: C.primary,
      paddingHorizontal: 14,
      fontSize: 18,
      fontFamily: 'Inter_600SemiBold',
      color: C.text,
      textAlign: 'center',
    },
    bwInputError: { borderColor: C.error },
    bwErrorText: {
      fontSize: 12,
      fontFamily: 'Inter_400Regular',
      color: C.error,
      alignSelf: 'flex-start',
      marginBottom: 10,
      marginTop: 2,
    },
    bwUnit: { fontSize: 16, fontFamily: 'Inter_600SemiBold', color: C.textSecondary, minWidth: 28 },
    bwSaveBtn: {
      width: '100%',
      backgroundColor: C.primary,
      borderRadius: 12,
      paddingVertical: 14,
      alignItems: 'center',
      marginBottom: 8,
    },
    bwSaveBtnText: { fontSize: 15, fontFamily: 'Inter_700Bold', color: C.textInverse },
  });
}
