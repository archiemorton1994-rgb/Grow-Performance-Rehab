import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { useScrollToTopRegister } from '@/lib/scroll-to-top-context';
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
import Svg, { Polyline, Circle, Line, Text as SvgText } from 'react-native-svg';
import * as ImagePicker from 'expo-image-picker';
import * as StoreReview from 'expo-store-review';
import Constants from 'expo-constants';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { EquipmentIcon } from '@/components/EquipmentIcon';
import { GlossaryTerm } from '@/components/GlossaryTerm';
import { StatStrip } from '@/components/StatStrip';
import CoachMark, { SpotlightRect } from '@/components/CoachMark';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useColors } from '@/constants/colors';
import {
  BodyweightLogEntry,
  EquipmentTier,
  ExperienceLevel,
  FitnessGoal,
  MAX_BODYWEIGHT_KG,
  MIN_BODYWEIGHT_KG,
  Sex,
  TIER_ORDER,
  WeightUnit,
  useAppStore,
} from '@/lib/store';
import { uploadUserData } from '@/lib/sync';
import { bodyweightIssue } from '@/lib/bodyweight';
import {
  isNotificationsSupported,
  requestNotificationPermission,
  scheduleWorkoutReminder,
  reminderAudienceFor,
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
import { subscriptionDateLabel } from '@/lib/subscription-period';
import { getApiUrl } from '@/lib/query-client';
import { kgToDisplayUnit, displayUnitToKg, formatDate, friendlyError } from '@/lib/utils';
import { router } from 'expo-router';

const EQUIPMENT_IMAGES: Record<EquipmentTier, any> = {
  bodyweight: require('@/assets/images/equipment/bodyweight.png'),
  bands: require('@/assets/images/equipment/bands.png'),
  dumbbells: require('@/assets/images/equipment/dumbbells.png'),
  kettlebells: require('@/assets/images/equipment/kettlebells.png'),
  fullgym: require('@/assets/images/equipment/fullgym.png'),
};

/** A number the user could plausibly have meant to type. Rejects "1e5", "12abc" and "". */
const TYPED_NUMBER = /^\d+(\.\d+)?$/;

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

type ActiveModal = 'edit' | 'equipment' | 'settings' | 'bodyweight' | 'bw-history' | null;

/**
 * The sections inside the settings sheet, surfaced as rows on the profile
 * screen so they can be seen and reached directly.
 *
 * `section` must match the section heading rendered inside the sheet exactly —
 * that string is the key the scroll-to-section lookup is built from, so a typo
 * here means the sheet opens at the top instead of at the section, silently.
 * settings-sections.check.mjs asserts the two lists agree.
 */
const SETTINGS_DESTINATIONS: {
  section: string;
  icon: keyof typeof Ionicons.glyphMap;
  blurb: string;
}[] = [
  { section: 'Profile', icon: 'person-outline', blurb: 'Name, bodyweight, goals, equipment' },
  { section: 'Preferences', icon: 'options-outline', blurb: 'Units, appearance, reminders' },
  { section: 'Subscription', icon: 'card-outline', blurb: 'Plan and billing' },
  { section: 'Account', icon: 'mail-outline', blurb: 'Email and sign-out' },
  { section: 'App', icon: 'information-circle-outline', blurb: 'Version, tutorial, support' },
  { section: 'Legal', icon: 'document-text-outline', blurb: 'Terms and privacy' },
];

interface ProfileTutorialStep {
  spotlightRef: 'header' | 'stats' | 'strength' | 'settings';
  iconName: string;
  iconLabel: string;
  title: string;
  body: string;
}

const PROFILE_TUTORIAL: readonly ProfileTutorialStep[] = [
  {
    spotlightRef: 'header',
    iconName: 'person-outline',
    iconLabel: 'You',
    title: 'This is you',
    // Kept, and made concrete. "They shape every session" is the kind of claim
    // a user nods at and does not believe; naming what actually changes is what
    // makes the Profile worth revisiting when their training changes.
    body: 'Your goal and experience level, taken from onboarding. They decide how heavy your sessions start, how fast the weight climbs, and whether you get a strength test at all.',
  },
  // Two steps cut. "Your training at a glance" was the third explanation of the
  // streak in one tour, over a row of zeroes. "Strength, tracked over time" said
  // "log a 1RM and this fills in" — a card describing an empty panel and asking
  // the user to come back later.
  {
    spotlightRef: 'settings',
    iconName: 'settings-outline',
    iconLabel: 'Settings',
    title: 'Everything else lives here',
    body: 'Equipment, reminders, units, light or dark, your account, and this tour if you ever want to run it again.',
  },
] as const;

// ─── Bodyweight Sparkline ──────────────────────────────────────────────────────
function BodyweightSparkline({
  entries,
  weightUnit,
  onPress,
}: {
  entries: BodyweightLogEntry[];
  weightUnit: WeightUnit;
  onPress: () => void;
}) {
  const C = useColors();
  const [chartWidth, setChartWidth] = useState(0);

  const CHART_H = 64;
  const PAD_L = 42;
  const PAD_R = 10;
  const PAD_T = 10;
  const PAD_B = 10;

  const filtered = useMemo(() => {
    const cutoffMs = Date.now() - 90 * 24 * 60 * 60 * 1000;
    const recent = entries
      .filter((e) => new Date(e.date).getTime() >= cutoffMs)
      .sort((a, b) => a.date.localeCompare(b.date));
    if (recent.length >= 2) return recent;
    return [...entries].sort((a, b) => a.date.localeCompare(b.date));
  }, [entries]);

  if (filtered.length < 1) return null;

  const fmtW = (w: number) => (w % 1 === 0 ? String(w) : w.toFixed(1));
  const unitLabel = weightUnit === 'lbs' ? 'lbs' : 'kg';

  // Single-entry: show a welcome card without a chart line
  if (filtered.length === 1) {
    const displayVal = kgToDisplayUnit(filtered[0].kg, weightUnit);
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          {
            backgroundColor: C.surface,
            borderRadius: 16,
            paddingHorizontal: 16,
            paddingTop: 14,
            paddingBottom: 14,
            marginBottom: 12,
            borderWidth: 1,
            borderColor: C.borderLight,
          },
          pressed && { opacity: 0.85 },
        ]}
      >
        <Text
          style={{
            fontSize: 13,
            fontFamily: 'Inter_600SemiBold',
            color: C.textSecondary,
            marginBottom: 10,
          }}
        >
          Bodyweight Trend
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6, marginBottom: 6 }}>
          <Text style={{ fontSize: 28, fontFamily: 'Inter_700Bold', color: C.text }}>
            {fmtW(displayVal)}
          </Text>
          <Text style={{ fontSize: 14, fontFamily: 'Inter_400Regular', color: C.textSecondary }}>
            {unitLabel}
          </Text>
        </View>
        <Text style={{ fontSize: 12, fontFamily: 'Inter_400Regular', color: C.textTertiary }}>
          Log your weight again to start seeing your trend
        </Text>
      </Pressable>
    );
  }

  const weights = filtered.map((e) => kgToDisplayUnit(e.kg, weightUnit));
  const minW = Math.min(...weights);
  const maxW = Math.max(...weights);
  const wRange = maxW === minW ? 1 : maxW - minW;

  const timestamps = filtered.map((e) => new Date(e.date).getTime());
  const minTs = timestamps[0];
  const maxTs = timestamps[timestamps.length - 1];
  const tsRange = maxTs === minTs ? 1 : maxTs - minTs;

  const plotW = Math.max(0, chartWidth - PAD_L - PAD_R);
  const plotH = CHART_H - PAD_T - PAD_B;

  const toX = (ts: number) => PAD_L + ((ts - minTs) / tsRange) * plotW;
  const toY = (w: number) =>
    maxW === minW ? PAD_T + plotH / 2 : PAD_T + plotH - ((w - minW) / wRange) * plotH;

  const points =
    chartWidth > 0
      ? filtered.map((e, i) => `${toX(timestamps[i])},${toY(weights[i])}`).join(' ')
      : '';

  const spanDays = Math.ceil((maxTs - minTs) / 86400000);
  const spanLabel = spanDays <= 0 ? '' : spanDays === 1 ? '1 day' : `${spanDays} days`;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        {
          backgroundColor: C.surface,
          borderRadius: 16,
          paddingHorizontal: 16,
          paddingTop: 14,
          paddingBottom: 12,
          marginBottom: 12,
          borderWidth: 1,
          borderColor: C.borderLight,
        },
        pressed && { opacity: 0.85 },
      ]}
    >
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 8,
        }}
      >
        <Text
          style={{
            fontSize: 13,
            fontFamily: 'Inter_600SemiBold',
            color: C.textSecondary,
          }}
        >
          Bodyweight Trend
        </Text>
        <Text style={{ fontSize: 12, fontFamily: 'Inter_400Regular', color: C.textTertiary }}>
          {filtered.length} entries{spanLabel ? ` · ${spanLabel}` : ''}
        </Text>
      </View>
      <View onLayout={(e) => setChartWidth(e.nativeEvent.layout.width)} style={{ height: CHART_H }}>
        {chartWidth > 0 && (
          <Svg width={chartWidth} height={CHART_H}>
            <Line
              x1={PAD_L}
              y1={PAD_T}
              x2={chartWidth - PAD_R}
              y2={PAD_T}
              stroke={C.borderLight}
              strokeWidth="1"
            />
            <Line
              x1={PAD_L}
              y1={CHART_H - PAD_B}
              x2={chartWidth - PAD_R}
              y2={CHART_H - PAD_B}
              stroke={C.borderLight}
              strokeWidth="1"
            />
            <SvgText
              x={PAD_L - 5}
              y={PAD_T + 4}
              fill={C.textTertiary}
              textAnchor="end"
              fontSize={10}
              fontFamily="Inter_500Medium"
            >
              {fmtW(maxW)}
            </SvgText>
            <SvgText
              x={PAD_L - 5}
              y={CHART_H - PAD_B + 4}
              fill={C.textTertiary}
              textAnchor="end"
              fontSize={10}
              fontFamily="Inter_500Medium"
            >
              {fmtW(minW)}
            </SvgText>
            <Polyline
              points={points}
              fill="none"
              stroke={C.primaryText}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {filtered.map((e, i) => (
              <Circle
                key={e.date}
                cx={toX(timestamps[i])}
                cy={toY(weights[i])}
                r={filtered.length <= 10 ? 3 : 2}
                fill={C.primaryText}
              />
            ))}
          </Svg>
        )}
      </View>
    </Pressable>
  );
}

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
    bodyweightLog,
    removeBodyweightEntry,
    themePreference,
    setThemePreference,
    tourActiveTab,
    setTourActiveTab,
    skipTour,
  } = useAppStore();

  const { user, signOut, deleteAccount } = useAuth();
  const { isActive: hasActiveSubscription, isOnTrial, expiryDate, willRenew } = useSubscription();

  const effectiveTier = storeGetEffectiveTier();
  const streak = getStreakDays();
  const weekCount = getThisWeekCount();
  const webTopInset = Platform.OS === 'web' ? 67 : 0;

  const [activeModal, setActiveModal] = useState<ActiveModal>(null);

  /**
   * Opening the settings sheet at a particular section.
   *
   * The y of each section heading is recorded on layout; when the sheet opens
   * with a pending target, it scrolls there. The delay exists because layout
   * has not run when the modal first mounts — scrolling immediately scrolls a
   * list whose sections are all still at y=0.
   */
  const [pendingSettingsSection, setPendingSettingsSection] = useState<string | null>(null);
  const settingsScrollRef = useRef<ScrollView>(null);
  const settingsSectionY = useRef<Record<string, number>>({});
  useEffect(() => {
    if (activeModal !== 'settings' || !pendingSettingsSection) return;
    const target = pendingSettingsSection;
    const timer = setTimeout(() => {
      const y = settingsSectionY.current[target];
      // No entry means the section heading never laid out under that exact
      // name. Staying at the top is the right failure: it is where the sheet
      // would have opened anyway.
      if (y !== undefined) {
        settingsScrollRef.current?.scrollTo({ y: Math.max(0, y - 8), animated: false });
      }
      setPendingSettingsSection(null);
    }, 120);
    return () => clearTimeout(timer);
  }, [activeModal, pendingSettingsSection]);
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

  // Only complain about what has actually been typed: an empty field here means
  // "never mind", and closes without changing anything.
  const bwError = bwText.trim().length === 0 ? null : bodyweightIssue(bwText, weightUnit);

  const saveBodyweight = () => {
    if (bwText.trim().length === 0) {
      dismissModal();
      return;
    }
    if (bwError !== null) return;
    setUserProfile({ bodyweightKg: displayUnitToKg(parseFloat(bwText.trim()), weightUnit) });
    dismissModal();
    if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
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

  // 1RM tracking needs a barbell, and Train already tells people so. Same
  // question, same answer, so it is asked the same way here.
  const hasFullGym = (equipmentTiers ?? []).includes('fullgym');

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
  const editWeightParsed = TYPED_NUMBER.test(editWeightTrimmed)
    ? parseFloat(editWeightTrimmed)
    : NaN;
  // Bodyweight is required to save. Empty / whitespace / non-numeric / 0 / negative
  // all fail validation - the Save button is disabled and an inline error is shown.
  // This prevents the silent "save did nothing" bug where the field fell back to the
  // existing bodyweight without telling the user the new value wasn't applied.
  // Implausible values fail the same way, and for the same reason: silently
  // accepting one leaves the app prescribing sessions that cannot be logged.
  const editWeightError =
    editWeightTrimmed === '' ? 'Enter your bodyweight' : bodyweightIssue(editWeight, weightUnit);
  const editWeightValid = editWeightError === null;
  // Onboarding requires a non-empty name to continue; mirror that here so a
  // name can't be cleared and saved empty (Home's avatar has no good fallback
  // for that state — it's a bare "?" with no explanation).
  const editNameValid = editName.trim().length > 0;

  const saveEdit = () => {
    if (!editWeightValid || !editNameValid) return;
    // Downgrading experience can make previously-selected equipment tiers
    // invalid (e.g. dumbbells while now Beginner) — filter them out so they
    // don't stay stuck in stored state with no UI path to remove them.
    const allowedTiers = editExp === 'beginner' ? ['bodyweight', 'bands'] : [...TIER_ORDER];
    setEquipmentTiers(equipmentTiers.filter((t) => allowedTiers.includes(t)));
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
      'This will clear your workout history, stats, strength tests, badges, and the weights the app has learned for you. Your next session starts from scratch. Your bodyweight log is kept. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: () => {
            if (Platform.OS !== 'web')
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            resetProgress();
            // Push the cleared state straight away, or the reset is undone by
            // the next launch: startup downloads the server copy and restores
            // it whenever the server is ahead on sessions - which, right after
            // a reset, it always is. "This cannot be undone" has to be true.
            //
            // The upload can fail (no signal, sleeping server) and says nothing
            // when it does, so resetProgress also sets a flag that blocks the
            // restore. Only an upload that genuinely succeeded clears it; until
            // then the device keeps its cleared state whatever the server says,
            // and the ordinary foreground sync will carry it up later.
            void uploadUserData(useAppStore.getState().getDataForSync()).then((ok) => {
              if (ok) useAppStore.getState().clearResetPendingUpload();
            });
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
    // The paywall's own sign-out has warned about this for a while; this one
    // did not. signOut tries a single upload capped at five seconds and then
    // clears the entire persisted store and reloads. Everything on the phone
    // goes: sessions, one-rep maxes, badges, weigh-ins, the learned weights.
    // That is deliberate, because two people sharing a handset must not share
    // an account, and it is not something to discover afterwards.
    Alert.alert(
      'Sign out?',
      'Anything not yet synced to this account will be cleared from this phone. Sign back in with the same email to get it back.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign out', style: 'destructive', onPress: signOut },
      ]
    );
  };

  const handleSendFeedback = () => {
    // Matches the address used everywhere else in the app (Privacy Policy,
    // Terms, and the actual OTP sender address) - was previously a different,
    // unrelated-looking domain (growperformance.app vs .com), which reads as
    // an inconsistency for a paid app rather than one deliberate contact channel.
    Linking.openURL('mailto:hello@growperformanceandrehab.com?subject=App Feedback').catch(
      () => {}
    );
  };

  const handleRateApp = async () => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    // Same native review sheet the automatic post-5th-session prompt uses.
    // Apple/Google throttle how often this can actually appear regardless of
    // how many times it's requested, so a manual button here is safe to add
    // alongside the automatic trigger rather than needing a separate path.
    const available = await StoreReview.isAvailableAsync();
    if (available) {
      await StoreReview.requestReview();
    } else {
      const url = StoreReview.storeUrl();
      if (url) Linking.openURL(url).catch(() => {});
    }
  };

  const performDeleteAccount = async () => {
    try {
      if (Platform.OS !== 'web')
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      await deleteAccount();
    } catch (err) {
      // Never the raw thrown message. apiRequest rejects with `${status}: ${body}`,
      // so a sleeping server put `502: <html><head><title>502 Bad Gateway…` into
      // a native alert. Apple's reviewers are required to exercise account
      // deletion (Guideline 5.1.1(v)), which makes this a path review is likely
      // to hit. friendlyError already solved this for the sign-in screen: it
      // strips the status prefix, unwraps a JSON `message`, and rejects anything
      // containing <>{} or over 120 characters — so an HTML gateway page falls
      // through to the plain sentence below.
      const msg = friendlyError(err, 'Could not delete your account. Please try again.');
      if (Platform.OS === 'web') window.alert(msg);
      else Alert.alert('Delete failed', msg);
    }
  };

  const handleDeleteAccount = () => {
    const message =
      'This permanently deletes your account and all your data: sessions, stats, achievements, everything. This cannot be undone.';
    if (Platform.OS === 'web') {
      if (window.confirm(`Delete your account?\n\n${message}`)) performDeleteAccount();
      return;
    }
    Alert.alert('Delete account', message, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: performDeleteAccount },
    ]);
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
      await scheduleWorkoutReminder(reminderTime, reminderAudience, reminderSince);
      if (Platform.OS !== 'web')
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      setReminderEnabled(false);
      await cancelWorkoutReminder();
      if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  // Through the shared helper, so turning reminders on here and the app
  // re-scheduling them on launch cannot pick two different messages.
  const hasEverSubscribed = useAppStore((st) => st.hasEverSubscribed);
  const reminderPromptKind = useAppStore((st) => st.reminderPromptKind);
  const reminderPromptSince = useAppStore((st) => st.reminderPromptSince);
  const reminderAudience = reminderAudienceFor(hasActiveSubscription, hasEverSubscribed);
  // Null when the stored clock belongs to a different audience, which reads as
  // "this one has only just started" and so keeps it daily.
  const reminderSince = reminderPromptKind === reminderAudience ? reminderPromptSince : null;

  const handleReminderTimeChange = async (time: string) => {
    setReminderTime(time);
    if (reminderEnabled) {
      await scheduleWorkoutReminder(time, reminderAudience, reminderSince);
    }
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handlePickPhoto = async () => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
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
    } catch {
      Alert.alert('Something went wrong', "Couldn't select that photo. Please try again.");
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

  const scrollRef = useRef<ScrollView>(null);
  useScrollToTopRegister(
    'profile',
    useCallback(() => {
      scrollRef.current?.scrollTo({ x: 0, y: 0, animated: true });
    }, [])
  );

  // ── Guided tour: Profile's own in-page tutorial ──────────────────────────
  // Runs when the shared tour reaches this tab (index 1). Hands off to
  // Train on its last step; skip abandons the whole tour, not just Profile.
  const [tutStep, setTutStep] = useState<number | null>(null);
  const headerRef = useRef<View>(null);
  const statsRef = useRef<View>(null);
  const strengthRef = useRef<View>(null);
  const settingsRef = useRef<View>(null);
  const [tutSpotlight, setTutSpotlight] = useState<SpotlightRect | null>(null);

  // Live scroll offset, tracked from onScroll rather than cached per-section via
  // onLayout: on react-native-web onLayout is backed by ResizeObserver, which
  // fires on size changes only. These wrappers never resize, so their layout y
  // would stay 0 forever and every step would scroll to the top.
  const scrollOffsetY = useRef(0);
  // Where a spotlit section should sit once scrolled into view — clear of the
  // header, high enough that the coach card has room beneath it.
  const SPOTLIGHT_TARGET_TOP = 150;

  useEffect(() => {
    if (tourActiveTab === 1) {
      const t = setTimeout(() => setTutStep(0), 300);
      return () => clearTimeout(t);
    }
    setTutStep(null);
  }, [tourActiveTab]);

  useEffect(() => {
    setTutSpotlight(null);
    if (tutStep === null) return;
    const refLookup = {
      header: headerRef,
      stats: statsRef,
      strength: strengthRef,
      settings: settingsRef,
    };
    const stepKey = PROFILE_TUTORIAL[tutStep].spotlightRef;
    const target = refLookup[stepKey];

    // Bring the step's own section into view before spotlighting it, rather
    // than always jumping to the top. Settings sits below the fold on a
    // populated profile: scrolling to 0 left it unmeasurable, so the spotlight
    // never appeared and the coach card was positioned against a target below
    // the bottom of the screen — which slid the card under the tab bar.
    //
    // Measure where the target currently is, then scroll by the difference.
    // This needs no cached layout offsets, so it behaves the same on native
    // and web.
    let settleTimer: ReturnType<typeof setTimeout> | undefined;
    const spotlight = () =>
      target?.current?.measureInWindow((x, y, w, h) => {
        if (w > 0 && h > 0) {
          setTutSpotlight({ top: y - 6, left: x - 6, width: w + 12, height: h + 12 });
        }
      });

    target?.current?.measureInWindow((_x, y, _w, h) => {
      if (h <= 0) return;
      const delta = y - SPOTLIGHT_TARGET_TOP;
      // Only scroll when the section genuinely sits outside a comfortable band;
      // nudging by a few pixels on every step just looks twitchy.
      if (Math.abs(delta) > 24) {
        scrollRef.current?.scrollTo({
          y: Math.max(0, scrollOffsetY.current + delta),
          animated: true,
        });
        // Long enough for the scroll animation to settle — measuring mid-scroll
        // captures a transient position and the spotlight lands wrong.
        settleTimer = setTimeout(spotlight, 420);
      } else {
        spotlight();
      }
    });

    return () => {
      if (settleTimer) clearTimeout(settleTimer);
    };
  }, [tutStep]);

  const advanceProfileTut = useCallback(() => {
    setTutStep((prev) => {
      if (prev === null) return null;
      const next = prev + 1;
      if (next >= PROFILE_TUTORIAL.length) {
        setTourActiveTab(null); // Profile is the last tab
        // ...and now the practice session the intro promised. Clearing the
        // active tab FIRST matters: the routing effect in (tabs)/_layout.tsx
        // only navigates while a tab is active, so with it null there is
        // nothing left to pull the user back out of the session.
        setTimeout(() => router.navigate('/session?demo=true' as any), 150);
        return null;
      }
      return next;
    });
  }, [setTourActiveTab]);

  const skipProfileTut = useCallback(() => {
    setTutStep(null);
    skipTour();
  }, [skipTour]);

  return (
    <View style={[styles.root, { paddingTop: insets.top + webTopInset }]}>
      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={[
          styles.container,
          { paddingBottom: insets.bottom + (Platform.OS === 'web' ? 84 : 50) + 24 },
        ]}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={(e) => {
          scrollOffsetY.current = e.nativeEvent.contentOffset.y;
        }}
      >
        <View ref={headerRef} collapsable={false}>
        <Animated.View entering={FadeInDown.delay(0).duration(400)} style={styles.heroSection}>
          <Text style={styles.heroName}>{displayName}</Text>
          <Pressable
            style={styles.avatarWrap}
            onPress={handlePickPhoto}
            testID="profile-avatar"
            accessibilityLabel="Change profile photo"
            accessibilityRole="button"
          >
            <View style={styles.avatar}>
              {profilePhotoUri ? (
                <Image source={{ uri: profilePhotoUri }} style={styles.avatarPhoto} />
              ) : userProfile.name ? (
                <Text style={styles.avatarInitial}>{userProfile.name[0].toUpperCase()}</Text>
              ) : (
                <Ionicons name="person" size={38} color={C.primaryDark} />
              )}
            </View>
            <View style={styles.avatarEditBadge}>
              <Ionicons name="camera" size={13} color={C.textInverse} />
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
        </View>

        {bodyweightLog.length >= 1 && (
          <Animated.View entering={FadeInDown.delay(50).duration(400)}>
            <BodyweightSparkline
              entries={bodyweightLog}
              weightUnit={weightUnit}
              onPress={() => setActiveModal('bw-history')}
            />
          </Animated.View>
        )}

        {/* Everything below the hero is one flat stack of unrelated cards —
            your numbers, your subscription, your settings — separated only by
            equal margins, so nothing groups and the eye has no way in. Two
            headings turn it into two sections. Same sectionHead pattern the
            Stats tab uses, so the two screens read as the same app. */}
        <View style={styles.sectionHead}>
          <Text style={styles.sectionTitle}>Your training</Text>
        </View>

        <View ref={statsRef} collapsable={false}>
        <Animated.View entering={FadeInDown.delay(60).duration(400)}>
          {/* Was a fifth hand-built copy of this card, with its own five style
              objects and an icon beside every number — three icons that carried
              no information the label did not already give, competing with the
              figure they sat next to. */}
          <StatStrip
            C={C}
            items={[
              { value: String(completedSessions.length), label: 'Sessions' },
              { value: String(streak), label: 'Week Streak' },
              { value: String(weekCount), label: 'This Week' },
            ]}
          />
        </Animated.View>
        </View>

        <View ref={strengthRef} collapsable={false}>
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
                <Text style={styles.ratioCardTitle}>Your strength progress</Text>
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

        {/* LOG A 1RM - BUT ONLY IF YOU CAN, AND WITH SOMEWHERE TO GO.

            Two faults, both found by opening this screen as a user who chose
            No Equipment. The Train tab tells that user in as many words that
            1RM tracking needs Full Gym; this card then invited them to log
            one anyway, so the app contradicted itself across two screens. And
            it was a plain View - no press handler, no destination - asking for
            something whose only entry point is the calculator two taps away on
            the Stats Strength tab, with nothing anywhere pointing at it. */}
        {oneRepMaxes.length === 0 && hasFullGym && (
          <Animated.View entering={FadeInDown.delay(90).duration(400)} style={{ marginBottom: 12 }}>
            <Pressable
              onPress={() => router.push('/(tabs)/workouts?tab=strength' as never)}
              testID="profile-log-1rm"
              accessibilityRole="button"
              accessibilityLabel="Log a one-rep max"
              style={({ pressed }) => [
                styles.ratioCard,
                { flexDirection: 'row', alignItems: 'center', gap: 14 },
                pressed && { opacity: 0.85 },
              ]}
            >
              <View
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  backgroundColor: C.primaryMuted,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons name="barbell-outline" size={22} color={C.primaryDark} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.ratioCardTitle}>Strength progress</Text>
                <Text style={styles.ratioCardSub}>
                  Log a{' '}
                  <GlossaryTerm
                    term="1RM"
                    definition="One-Rep Max: the most weight you can lift for a single clean rep of a lift. Used to calibrate your training weights."
                    textStyle={styles.ratioCardSub}
                  />{' '}
                  to track your bodyweight multipliers
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={C.textTertiary} />
            </Pressable>
          </Animated.View>
        )}
        </View>

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
                {/*
                  THREE THINGS THIS CARD USED TO CLAIM AND COULD NOT KNOW.

                  "Grow Monthly" named a billing period. This screen never asks
                  the store anything, and the paywall itself now reads the
                  period off the package because the product need not be
                  monthly at all.

                  "Renews {date}" was printed from entitlement.expirationDate,
                  which the store returns whether or not auto-renew is still on.
                  Somebody who cancelled yesterday was told their subscription
                  renews on the day it actually ends. "Active until" is true
                  either way. Saying which of the two it is needs willRenew off
                  the entitlement, which means editing the RevenueCat file, and
                  that is not a change to make unasked.

                  "Expires in N days" was Math.ceil of a millisecond gap, so it
                  rounded UP: six days and five hours printed as seven, and the
                  last day printed "1 days". A date has neither problem, and a
                  trial does not "expire" if it is about to start charging.
                */}
                <Text style={styles.infoCardTitle}>
                  {isOnTrial ? 'Free trial active' : 'Subscription active'}
                </Text>
                <Text style={styles.infoCardSub}>
                  {expiryDate
                    ? `${subscriptionDateLabel(isOnTrial, willRenew)} ${new Date(
                        expiryDate
                      ).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`
                    : 'Tap to manage'}
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
                <Text style={styles.infoCardTitle}>Subscribe to Grow</Text>
                {/* No number here. The price and the currency belong to the
                    App Store, and this screen has not asked it anything - see
                    the paywall, which fetches priceString and says nothing about
                    money at all when it cannot. A pound sign shown to somebody
                    in Ohio is wrong twice over. */}
                <Text style={styles.infoCardSub}>See the price and subscribe</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={C.textTertiary} />
            </Pressable>
          )}
        </Animated.View>

        {/* SETTINGS USED TO BE ONE ROW.
            Six destinations — Account, Profile, Preferences, Subscription, App,
            Legal — behind a single tap, named only in a bullet list crammed
            into the row's subtitle, at 12px, ending in "• Account" with no way
            to reach any one of them. Roughly everything configurable in the app
            was one undifferentiated door.

            They are rows now, and each one opens the sheet AT its own section
            rather than at the top, so "Reminders" gets you to reminders. The
            sheet is unchanged — this is a way in, not a rewrite of what is
            behind it. */}
        <View style={styles.sectionHead}>
          <Text style={styles.sectionTitle}>Settings</Text>
        </View>
        <View ref={settingsRef} collapsable={false}>
        <Animated.View entering={FadeInDown.delay(180).duration(400)} style={styles.settingsList}>
          {SETTINGS_DESTINATIONS.map((dest, i) => (
            <Pressable
              key={dest.section}
              onPress={() => {
                if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setPendingSettingsSection(dest.section);
                setActiveModal('settings');
              }}
              style={({ pressed }) => [
                styles.settingsRow,
                i > 0 && styles.settingsRowDivided,
                pressed && { opacity: 0.7 },
              ]}
              testID={i === 0 ? 'open-settings' : `open-settings-${dest.section.toLowerCase()}`}
            >
              <View style={styles.infoCardIconWrap}>
                <Ionicons name={dest.icon} size={20} color={C.textSecondary} />
              </View>
              <View style={styles.navBtnText}>
                <Text style={styles.settingsRowTitle}>{dest.section}</Text>
                <Text style={styles.infoCardSub}>{dest.blurb}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={C.textTertiary} />
            </Pressable>
          ))}
        </Animated.View>
        </View>
      </ScrollView>

      {/* Edit Details Modal */}
      <Modal
        visible={activeModal === 'edit'}
        transparent
        animationType="slide"
        onRequestClose={dismissModal}
      >
        <View style={styles.sheetOverlay}>
          {/* Capped and scrollable, with the actions pinned OUTSIDE the scroller.
              On a 4.7-inch phone this sheet needed ~706pt in a 667pt screen, so
              roughly 40pt sat off the bottom with nothing to scroll. Worse on
              every phone: tapping Bodyweight raises the number pad, which covers
              Save Details and Cancel — and a number pad has no return key, the
              backdrop was inert, and there was no scroll, so the user was simply
              stuck looking at a form they could not submit.

              Same shape the Settings sheet in this file already uses. */}
          <View style={[styles.sheet, { paddingBottom: insets.bottom + 24, maxHeight: '88%' }]}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Edit Details</Text>

            <ScrollView
              style={{ flexShrink: 1 }}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="interactive"
              contentContainerStyle={{ paddingBottom: 8 }}
            >
            <Text style={styles.inputLabel}>Name</Text>
            <TextInput
              style={[styles.input, !editNameValid && { borderColor: C.error }]}
              value={editName}
              onChangeText={setEditName}
              placeholder="Your name"
              placeholderTextColor={C.textTertiary}
              returnKeyType="next"
            />
            {!editNameValid && (
              <Text
                style={{
                  fontSize: 12,
                  fontFamily: 'Inter_400Regular',
                  color: C.error,
                  marginTop: -6,
                  marginBottom: 6,
                }}
              >
                Enter your name
              </Text>
            )}

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
            {editWeightError !== null && (
              <Text
                style={{
                  fontSize: 12,
                  lineHeight: 17,
                  fontFamily: 'Inter_400Regular',
                  color: C.error,
                  marginTop: -6,
                  marginBottom: 6,
                }}
                testID="edit-weight-error"
              >
                {editWeightError}
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
                      color={isActive ? C.primaryText : C.textTertiary}
                    />
                    <Text style={[styles.goalChipText, isActive && styles.goalChipTextActive]}>
                      {opt.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            </ScrollView>

            <Pressable
              onPress={saveEdit}
              disabled={!editWeightValid || !editNameValid}
              style={[styles.saveBtn, (!editWeightValid || !editNameValid) && { opacity: 0.4 }]}
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
          {/* Capped and scrollable, same as Edit Details. A beginner account on a
              4.7-inch phone overflowed by ~40pt, and the thing that tipped it
              over was the beginner explainer — so the people who most need to
              read it were the ones it pushed off the screen. */}
          <View style={[styles.sheet, { paddingBottom: insets.bottom + 24, maxHeight: '88%' }]}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Equipment</Text>
            <ScrollView
              style={{ flexShrink: 1 }}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 8 }}
            >
            <Text style={styles.sheetSub}>
              Select everything available to you - we use the best match for each session
            </Text>
            {userProfile.experienceLevel === 'beginner' && (
              <View style={styles.upgradeNote}>
                <Ionicons name="information-circle-outline" size={15} color={C.primaryText} />
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
                  <Text style={{ fontFamily: 'Inter_600SemiBold', color: C.primaryText }}>
                    {getEquipmentLabel(getEffectiveTier(editTiers))}
                  </Text>
                </Text>
              </View>
            )}
            {TIER_ORDER.map((tier) => {
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
                  <View
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 8,
                      overflow: 'hidden',
                      backgroundColor: C.surfaceTertiary,
                      opacity: isLocked ? 0.4 : 1,
                    }}
                  >
                    <Image
                      source={EQUIPMENT_IMAGES[tier]}
                      style={{ width: 44, height: 44 }}
                      resizeMode="contain"
                    />
                  </View>
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
            </ScrollView>
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
              <Ionicons name="scale-outline" size={28} color={C.primaryText} />
            </View>
            <Text style={styles.bwTitle}>Body Weight</Text>
            <Text style={styles.bwSub}>
              {userProfile.bodyweightKg > 0
                ? `Current: ${kgToDisplayUnit(userProfile.bodyweightKg, weightUnit)} ${weightUnit}`
                : 'Enter your body weight to calibrate session loads'}
            </Text>
            <View style={styles.bwInputRow}>
              <TextInput
                style={[styles.bwInput, bwError !== null && styles.bwInputError]}
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
            {bwError !== null && (
              <Text style={styles.bwErrorText} testID="bodyweight-error">
                {bwError}
              </Text>
            )}
            <Pressable
              onPress={saveBodyweight}
              style={[
                styles.bwSaveBtn,
                bwError !== null && { backgroundColor: C.border, opacity: 0.7 },
              ]}
              disabled={bwError !== null}
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

      {/* Bodyweight History Modal */}
      <Modal
        visible={activeModal === 'bw-history'}
        transparent
        animationType="slide"
        onRequestClose={() => setActiveModal(null)}
      >
        <View style={styles.sheetOverlay}>
          <View style={[styles.sheet, { paddingBottom: insets.bottom + 24, maxHeight: '80%' }]}>
            <View style={styles.sheetHandle} />
            <View style={styles.bwHistoryHeader}>
              <Text style={styles.sheetTitle}>Weight History</Text>
              <Pressable
                onPress={() => setActiveModal(null)}
                style={styles.bwHistoryClose}
                accessibilityLabel="Close"
                accessibilityRole="button"
              >
                <Ionicons name="close" size={22} color={C.textSecondary} />
              </Pressable>
            </View>
            {bodyweightLog.length === 0 ? (
              <Text style={styles.bwHistoryEmpty}>No entries yet.</Text>
            ) : (
              <ScrollView
                showsVerticalScrollIndicator={false}
                style={{ flexShrink: 1 }}
                contentContainerStyle={{ paddingBottom: 8 }}
              >
                {[...bodyweightLog]
                  .sort((a, b) => b.date.localeCompare(a.date))
                  .map((entry) => (
                    <View
                      key={entry.date}
                      style={[styles.bwHistoryRow, { borderBottomColor: C.borderLight }]}
                    >
                      <Text style={[styles.bwHistoryDate, { color: C.textSecondary }]}>
                        {formatDate(entry.date)}
                      </Text>
                      <View style={styles.bwHistoryRight}>
                        <Text style={[styles.bwHistoryValue, { color: C.text }]}>
                          {kgToDisplayUnit(entry.kg, weightUnit)} {weightUnit}
                        </Text>
                        <Pressable
                          onPress={() => {
                            if (Platform.OS !== 'web')
                              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            removeBodyweightEntry(entry.date);
                          }}
                          style={styles.bwHistoryDelete}
                          testID={`delete-bw-${entry.date}`}
                          accessibilityLabel="Delete entry"
                          accessibilityRole="button"
                        >
                          <Ionicons name="trash-outline" size={18} color={C.error} />
                        </Pressable>
                      </View>
                    </View>
                  ))}
              </ScrollView>
            )}
            <Pressable
              onPress={() => {
                setActiveModal(null);
                setTimeout(openBodyweight, 250);
              }}
              style={[styles.bwSaveBtn, { marginTop: 16 }]}
              testID="bw-history-log-new"
            >
              <Text style={styles.bwSaveBtnText}>Log new weight</Text>
            </Pressable>
            <Pressable onPress={() => setActiveModal(null)} style={styles.cancelBtn}>
              <Text style={styles.cancelBtnText}>Close</Text>
            </Pressable>
          </View>
        </View>
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
              ref={settingsScrollRef}
              showsVerticalScrollIndicator={false}
              style={{ flexShrink: 1 }}
              contentContainerStyle={{ paddingBottom: 8 }}
            >
              {/* Account */}
              <Text
                style={styles.settingSectionLabel}
                onLayout={(e) => {
                  settingsSectionY.current['Account'] = e.nativeEvent.layout.y;
                }}
              >
                Account
              </Text>
              <View style={styles.accountRow}>
                <View style={styles.accountIcon}>
                  <Ionicons name="mail-outline" size={18} color={C.primaryText} />
                </View>
                <Text style={styles.accountEmail} numberOfLines={1}>
                  {user?.email ?? 'Not signed in'}
                </Text>
              </View>
              <Pressable onPress={handleSignOut} style={styles.signOutBtn} testID="sign-out-btn">
                <Ionicons name="log-out-outline" size={16} color={C.error} />
                <Text style={styles.signOutText}>Sign out</Text>
              </Pressable>
              <Pressable
                onPress={handleDeleteAccount}
                style={styles.signOutBtn}
                testID="delete-account-btn"
              >
                <Ionicons name="trash-outline" size={16} color={C.error} />
                <Text style={styles.signOutText}>Delete account</Text>
              </Pressable>

              <View style={styles.settingDivider} />

              {/* Profile rows - open the existing modals via the returnToSettings flag */}
              <Text
                style={styles.settingSectionLabel}
                onLayout={(e) => {
                  settingsSectionY.current['Profile'] = e.nativeEvent.layout.y;
                }}
              >
                Profile
              </Text>
              <Pressable
                onPress={() => openFromSettings('edit')}
                style={({ pressed }) => [styles.settingsLinkRow, pressed && { opacity: 0.7 }]}
                testID="open-edit-details"
              >
                <View style={[styles.navIcon, { backgroundColor: C.primaryMuted }]}>
                  <Ionicons name="person-outline" size={20} color={C.primaryDark} />
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
                <View style={[styles.navIcon, { backgroundColor: C.primaryMuted }]}>
                  <EquipmentIcon tier={effectiveTier} size={20} />
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
                  <Ionicons name="scale-outline" size={20} color={C.primaryDark} />
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

              <Text
                style={styles.settingSectionLabel}
                onLayout={(e) => {
                  settingsSectionY.current['Preferences'] = e.nativeEvent.layout.y;
                }}
              >
                Preferences
              </Text>
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

              <Text style={styles.settingItemLabel}>Strength Test Weeks</Text>
              <Text style={styles.settingItemSub}>
                Maxing out Squat, Bench and Deadlift to re-baseline your weights. Turn it off if
                those lifts aren&apos;t part of your training.
              </Text>
              <View style={styles.freqRow}>
                {([12, 18, 'never'] as const).map((freq) => (
                  <Pressable
                    key={String(freq)}
                    onPress={() => {
                      setTestWeekFrequency(freq);
                      if (Platform.OS !== 'web')
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    }}
                    style={[styles.freqBtn, testWeekFrequency === freq && styles.freqBtnActive]}
                    testID={freq === 'never' ? 'test-freq-never' : 'test-freq-toggle'}
                  >
                    <Text
                      style={[
                        styles.freqBtnText,
                        testWeekFrequency === freq && styles.freqBtnTextActive,
                      ]}
                    >
                      {freq === 'never' ? 'Never' : `Every ${freq}`}
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

              <Text style={styles.settingItemLabel}>Appearance</Text>
              <Text style={styles.settingItemSub}>Choose your preferred colour theme</Text>
              <View style={styles.freqRow}>
                {(
                  [
                    { value: 'dark', label: 'Dark' },
                    { value: 'light', label: 'Light' },
                    { value: 'system', label: 'System' },
                  ] as const
                ).map(({ value, label }) => (
                  <Pressable
                    key={value}
                    onPress={() => {
                      setThemePreference(value);
                      if (Platform.OS !== 'web')
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    }}
                    style={[styles.freqBtn, themePreference === value && styles.freqBtnActive]}
                  >
                    <Text
                      style={[
                        styles.freqBtnText,
                        themePreference === value && styles.freqBtnTextActive,
                      ]}
                    >
                      {label}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <View style={styles.settingDivider} />

              <Pressable onPress={handleSendFeedback} style={styles.feedbackBtn}>
                <Ionicons name="mail-outline" size={18} color={C.primaryText} />
                <Text style={styles.feedbackText}>Send Feedback</Text>
                <Ionicons
                  name="open-outline"
                  size={14}
                  color={C.textTertiary}
                  style={{ marginLeft: 'auto' }}
                />
              </Pressable>

              <View style={styles.settingDivider} />

              <Text
                style={styles.settingSectionLabel}
                onLayout={(e) => {
                  settingsSectionY.current['Subscription'] = e.nativeEvent.layout.y;
                }}
              >
                Subscription
              </Text>
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
                    <Ionicons name="card-outline" size={20} color={C.primaryDark} />
                  </View>
                  <View style={styles.navBtnText}>
                    <Text style={styles.navLabel}>Manage Subscription</Text>
                    <Text style={styles.navSub}>
                      {isOnTrial
                        ? 'Free trial. Change or cancel anytime.'
                        // Not "change plan". There is one package (see
                        // fetchOffering in app/subscription.tsx), so there is
                        // nothing to change it to.
                        : 'View or cancel in the App Store'}
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
                    <Ionicons name="card-outline" size={20} color={C.primaryDark} />
                  </View>
                  <View style={styles.navBtnText}>
                    <Text style={styles.navLabel}>Subscribe to Grow</Text>
                    <Text style={styles.navSub}>See the price and subscribe</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={14} color={C.textTertiary} />
                </Pressable>
              )}

              {/* The divider and heading sit OUTSIDE the tour guard, and only
                  the replay row is inside it. They were all guarded together,
                  which meant that until the tour had been completed once, "Rate
                  Grow" and "Version" rendered under no heading at all — and,
                  once the settings rows on the profile screen started jumping
                  to sections, an "App" row that jumped nowhere because the
                  heading whose position it needed had never rendered. */}
              <View style={styles.settingDivider} />

              <Text
                style={styles.settingSectionLabel}
                onLayout={(e) => {
                  settingsSectionY.current['App'] = e.nativeEvent.layout.y;
                }}
              >
                App
              </Text>

              {tourComplete && (
                <>
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
                      <Ionicons name="map-outline" size={20} color={C.primaryDark} />
                    </View>
                    <View style={styles.navBtnText}>
                      <Text style={styles.navLabel}>Replay Guided Tour</Text>
                      <Text style={styles.navSub}>Walk through the app again</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={14} color={C.textTertiary} />
                  </Pressable>
                </>
              )}

              <Pressable
                onPress={handleRateApp}
                style={({ pressed }) => [styles.settingsLinkRow, pressed && { opacity: 0.7 }]}
                testID="rate-app"
              >
                <View style={[styles.navIcon, { backgroundColor: C.primaryMuted }]}>
                  <Ionicons name="star-outline" size={20} color={C.primaryDark} />
                </View>
                <View style={styles.navBtnText}>
                  <Text style={styles.navLabel}>Rate Grow</Text>
                  <Text style={styles.navSub}>Enjoying the app? Leave a review</Text>
                </View>
                <Ionicons name="chevron-forward" size={14} color={C.textTertiary} />
              </Pressable>

              <View style={styles.settingsLinkRow} testID="app-version">
                <View style={[styles.navIcon, { backgroundColor: C.surfaceTertiary }]}>
                  <Ionicons name="information-circle-outline" size={20} color={C.textSecondary} />
                </View>
                <View style={styles.navBtnText}>
                  <Text style={styles.navLabel}>Version</Text>
                </View>
                <Text style={styles.navSub}>{Constants.expoConfig?.version ?? 'Unknown'}</Text>
              </View>

              <View style={styles.settingDivider} />

              <Text
                style={styles.settingSectionLabel}
                onLayout={(e) => {
                  settingsSectionY.current['Legal'] = e.nativeEvent.layout.y;
                }}
              >
                Legal
              </Text>
              <Pressable
                onPress={() => Linking.openURL(termsUrl)}
                style={({ pressed }) => [styles.settingsLinkRow, pressed && { opacity: 0.7 }]}
                testID="settings-terms"
              >
                <View style={[styles.navIcon, { backgroundColor: C.primaryMuted }]}>
                  <Ionicons name="document-text-outline" size={20} color={C.primaryDark} />
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
                  <Ionicons name="shield-checkmark-outline" size={20} color={C.primaryDark} />
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

      {tutStep !== null && (
        <CoachMark
          visible
          title={PROFILE_TUTORIAL[tutStep].title}
          body={PROFILE_TUTORIAL[tutStep].body}
          step={tutStep + 1}
          total={PROFILE_TUTORIAL.length}
          onNext={advanceProfileTut}
          onSkip={skipProfileTut}
          bottomOffset={insets.bottom + (Platform.OS === 'web' ? 84 : 50) + 16}
          iconName={PROFILE_TUTORIAL[tutStep].iconName}
          iconLabel={PROFILE_TUTORIAL[tutStep].iconLabel}
          spotlightRect={tutSpotlight ?? undefined}
        />
      )}
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
    avatarInitial: { fontSize: 40, fontFamily: 'Inter_700Bold', color: C.primaryDark },
    avatarEditBadge: {
      position: 'absolute',
      bottom: 2,
      right: 2,
      width: 26,
      height: 26,
      // Half the size — a circle, not a step on the radius scale.
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
    navGrid: { gap: 8, marginBottom: 16 },
    navBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      backgroundColor: C.surface,
      borderRadius: 12,
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
    // Matches the Stats tab's heading level exactly. The two screens are the
    // same app and had no shared idea of what a section heading looks like.
    sectionHead: { marginTop: 8, marginBottom: 2 },
    sectionTitle: { fontSize: 17, fontFamily: 'Inter_700Bold', color: C.text },
    settingsList: {
      backgroundColor: C.surface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: C.borderLight,
      overflow: 'hidden',
      marginBottom: 12,
    },
    settingsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      paddingHorizontal: 16,
      paddingVertical: 13,
    },
    // A hairline between rows, not a gap: six separate cards would read as six
    // unrelated things rather than one list of places to go.
    settingsRowDivided: { borderTopWidth: 1, borderTopColor: C.borderLight },
    settingsRowTitle: { fontSize: 15, fontFamily: 'Inter_600SemiBold', color: C.text },
    accountRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
    accountIcon: {
      width: 34,
      height: 34,
      borderRadius: 8,
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
      borderRadius: 12,
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
    manageSubText: { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: C.primaryText },

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
      borderRadius: 8,
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
    optionChipTextActive: { color: C.primaryText, fontFamily: 'Inter_600SemiBold' },
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
    goalChipTextActive: { color: C.primaryText, fontFamily: 'Inter_600SemiBold' },
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
      borderRadius: 8,
      borderBottomWidth: 1,
      borderBottomColor: C.borderLight,
    },
    equipRowActive: {},
    equipRowLocked: { opacity: 0.5 },
    equipLabel: { flex: 1, fontSize: 15, fontFamily: 'Inter_500Medium', color: C.textSecondary },
    equipLabelActive: { color: C.primaryText, fontFamily: 'Inter_600SemiBold' },
    equipLabelLocked: { color: C.textTertiary },
    equipCheckbox: {
      width: 22,
      height: 22,
      // Half the size — a circle, not a step on the radius scale.
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
    // Sentence case, not caps. Every card on this screen shouted its title in
    // tracked-out capitals at 13-14px, which reads as a form field label rather
    // than a heading — and made the SUBTITLE the most readable line in the card.
    ratioCardTitle: {
      fontSize: 15,
      fontFamily: 'Inter_700Bold',
      color: C.text,
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
      fontSize: 15,
      fontFamily: 'Inter_600SemiBold',
      color: C.text,
      marginBottom: 2,
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
    staleWeightDot: { width: 8, height: 8, borderRadius: 8, backgroundColor: C.warning },
    subStripActive: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: C.surface,
      borderRadius: 12,
      padding: 14,
      borderWidth: 1,
      borderColor: C.borderLight,
    },
    subStripIcon: {
      width: 36,
      height: 36,
      borderRadius: 8,
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
      borderRadius: 12,
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
      borderRadius: 8,
      alignItems: 'center',
      backgroundColor: C.surfaceSecondary,
      borderWidth: 1,
      borderColor: C.border,
    },
    freqBtnActive: { backgroundColor: C.primaryMuted, borderColor: C.primary },
    freqBtnText: { fontSize: 13, fontFamily: 'Inter_500Medium', color: C.textSecondary },
    freqBtnTextActive: { color: C.primaryText, fontFamily: 'Inter_600SemiBold' },
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
    timeChipTextActive: { color: C.primaryText, fontFamily: 'Inter_600SemiBold' },
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
    feedbackText: { fontSize: 14, fontFamily: 'Inter_500Medium', color: C.primaryText },
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
      lineHeight: 17,
      fontFamily: 'Inter_400Regular',
      color: C.error,
      alignSelf: 'stretch',
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
    bwHistoryHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 20,
    },
    bwHistoryClose: { padding: 4 },
    bwHistoryEmpty: {
      fontSize: 14,
      fontFamily: 'Inter_400Regular',
      color: C.textTertiary,
      textAlign: 'center',
      paddingVertical: 24,
    },
    bwHistoryRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 12,
      borderBottomWidth: 1,
    },
    bwHistoryDate: {
      fontSize: 14,
      fontFamily: 'Inter_400Regular',
      flex: 1,
    },
    bwHistoryRight: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    bwHistoryValue: {
      fontSize: 15,
      fontFamily: 'Inter_600SemiBold',
    },
    bwHistoryDelete: {
      padding: 4,
    },
  });
}
