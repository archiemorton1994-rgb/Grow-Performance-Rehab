import React, { useMemo, useState, useEffect } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Platform,
  Modal,
  TextInput,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useColors } from '@/constants/colors';
import { SessionType, useAppStore } from '@/lib/store';
import { getEquipmentLabel } from '@/lib/workout-engine';
import { formatDate, getTimeOfDayGreeting, kgToDisplayUnit, displayUnitToKg } from '@/lib/utils';

const WEEKLY_GOAL = 3;

const SESSION_TYPE_META: Record<SessionType, { label: string; subtitle: string; icon: keyof typeof Ionicons.glyphMap; color: string; bg: string }> = {
  squat:        { label: 'Lower Body',   subtitle: 'Quads · Glutes · Hamstrings', icon: 'fitness-outline',           color: '#2f6b46', bg: '#e8f2ec' },
  bench:        { label: 'Upper Body',   subtitle: 'Chest · Shoulders · Triceps', icon: 'body-outline',              color: '#4285f4', bg: '#e8f0fe' },
  deadlift:     { label: 'Full Body',    subtitle: 'Back · Hips · Legs',          icon: 'barbell-outline',           color: '#9c27b0', bg: '#f3e5f5' },
  conditioning: { label: 'Conditioning', subtitle: 'Cardio & Stamina',            icon: 'flame-outline',             color: '#e65100', bg: '#fbe9e7' },
  prehab:       { label: 'Prehab',       subtitle: 'Joint health & Mobility',     icon: 'shield-checkmark-outline',  color: '#00897b', bg: '#e0f2f1' },
  flexibility:  { label: 'Flexibility',  subtitle: 'Stretching & Recovery',       icon: 'leaf-outline',              color: '#558b2f', bg: '#f1f8e9' },
};

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const C = useColors();
  const tabBarHeight = useBottomTabBarHeight();
  const {
    equipmentTiers,
    getEffectiveTier,
    completedCount,
    completedSessions,
    getCurrentSessionType,
    getStreakDays,
    getThisWeekCount,
    isTestWeekDue,
    userProfile,
    weightUnit,
    setUserProfile,
    lastWeightPromptedAt,
    setLastWeightPromptedAt,
    hasHydrated,
  } = useAppStore();

  const effectiveTier = getEffectiveTier();
  const suggestedSession = getCurrentSessionType();
  const streak = getStreakDays();
  const weekCount = getThisWeekCount();
  const testWeek = isTestWeekDue();
  const firstName = userProfile.name ? userProfile.name.split(' ')[0] : null;
  const greeting = getTimeOfDayGreeting();
  const greetingText = firstName ? `${greeting}, ${firstName}` : greeting;
  const lastSession = completedSessions.length > 0 ? completedSessions[0] : null;

  const tierLabel = equipmentTiers.length > 1
    ? `${getEquipmentLabel(effectiveTier)} + ${equipmentTiers.length - 1} more`
    : getEquipmentLabel(effectiveTier);

  const suggestedMeta = SESSION_TYPE_META[suggestedSession];

  const webTopInset = Platform.OS === 'web' ? 67 : 0;
  const styles = useMemo(() => makeStyles(C), [C]);

  // Weekly weight prompt state
  const [showWeightPrompt, setShowWeightPrompt] = useState(false);
  const [weightPromptText, setWeightPromptText] = useState('');

  useEffect(() => {
    if (!hasHydrated) return;
    const shouldPrompt = !lastWeightPromptedAt || (Date.now() - lastWeightPromptedAt > SEVEN_DAYS_MS);
    if (shouldPrompt && !showWeightPrompt) {
      const currentDisplay = userProfile.bodyweightKg > 0
        ? String(kgToDisplayUnit(userProfile.bodyweightKg, weightUnit))
        : '';
      setWeightPromptText(currentDisplay);
      setShowWeightPrompt(true);
    }
  }, [hasHydrated, lastWeightPromptedAt]);

  const dismissWeightPrompt = () => {
    setLastWeightPromptedAt(Date.now());
    setShowWeightPrompt(false);
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const confirmWeightPrompt = () => {
    const val = parseFloat(weightPromptText);
    if (val > 0) {
      setUserProfile({ bodyweightKg: displayUnitToKg(val, weightUnit) });
    }
    setLastWeightPromptedAt(Date.now());
    setShowWeightPrompt(false);
    if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const handleStartSuggested = () => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push({
      pathname: '/readiness',
      params: { sessionType: suggestedSession, isTestWeek: testWeek ? 'true' : 'false' },
    });
  };

  const handleRepeatSameSettings = () => {
    if (!lastSession) return;
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push({
      pathname: '/session',
      params: {
        sessionType: lastSession.sessionType,
        hasAches: lastSession.hadAches ? 'true' : 'false',
        painRegion: lastSession.painRegion || '',
        energy: lastSession.energy,
        timeAvailable: lastSession.timeAvailable,
        isTestWeek: 'false',
        equipment: lastSession.equipmentTier,
      },
    });
  };

  const handleRepeatCustomise = () => {
    if (!lastSession) return;
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const type = lastSession.sessionType;
    if (type === 'prehab' || type === 'flexibility') {
      router.push({
        pathname: '/session',
        params: { sessionType: type, hasAches: 'false', painRegion: '', energy: 'normal', timeAvailable: '60', isTestWeek: 'false', equipment: effectiveTier },
      });
    } else if (type === 'conditioning') {
      router.push({ pathname: '/readiness', params: { sessionType: type, isTestWeek: 'false' } });
    } else {
      router.push({ pathname: '/readiness', params: { sessionType: type, isTestWeek: testWeek ? 'true' : 'false' } });
    }
  };

  return (
    <View
      style={[
        styles.container,
        {
          paddingTop: insets.top + webTopInset,
          paddingBottom: Platform.OS === 'web' ? 84 : tabBarHeight,
        },
      ]}
    >
      <View style={styles.inner}>

        {/* Header */}
        <Animated.View entering={FadeInDown.duration(350)} style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.greetingText} numberOfLines={1}>{greetingText}</Text>
            <Text style={styles.tierText}>{tierLabel}</Text>
          </View>
          {testWeek && (
            <View style={styles.testWeekPill}>
              <Ionicons name="trophy" size={13} color="#e65100" />
              <Text style={styles.testWeekPillText}>Test Week</Text>
            </View>
          )}
        </Animated.View>

        {/* Today's Session card */}
        <Animated.View entering={FadeInDown.delay(60).duration(380)} style={styles.todayCard}>
          <View style={styles.todayCardTop}>
            <View style={{ flex: 1 }}>
              <Text style={styles.todayLabel}>Today's Session</Text>
              <Text style={styles.todaySessionName}>{suggestedMeta.label}</Text>
              <Text style={styles.todaySessionSub}>{suggestedMeta.subtitle}</Text>
            </View>
            <View style={[styles.todayIcon, { backgroundColor: suggestedMeta.bg }]}>
              <Ionicons name={suggestedMeta.icon} size={32} color={suggestedMeta.color} />
            </View>
          </View>
          <Pressable
            onPress={handleStartSuggested}
            style={({ pressed }) => [styles.startBtn, pressed && { opacity: 0.88, transform: [{ scale: 0.98 }] }]}
            testID="start-suggested-session"
          >
            <Ionicons name="flash" size={18} color="#fff" />
            <Text style={styles.startBtnText}>{testWeek ? 'Start Strength Test' : 'Start Session'}</Text>
          </Pressable>
        </Animated.View>

        {/* Stats strip */}
        <Animated.View entering={FadeInDown.delay(120).duration(380)} style={styles.statsStrip}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{streak}</Text>
            <Text style={styles.statLabel}>Day Streak</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{weekCount}<Text style={styles.statGoal}>/{WEEKLY_GOAL}</Text></Text>
            <Text style={styles.statLabel}>This Week</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{completedCount}</Text>
            <Text style={styles.statLabel}>Total</Text>
          </View>
        </Animated.View>

        {/* Last session repeat row */}
        <Animated.View entering={FadeInDown.delay(180).duration(380)}>
          {lastSession ? (
            <View style={styles.lastCard}>
              <View style={styles.lastCardTop}>
                <View style={[styles.lastIcon, { backgroundColor: SESSION_TYPE_META[lastSession.sessionType].bg }]}>
                  <Ionicons name={SESSION_TYPE_META[lastSession.sessionType].icon} size={16} color={SESSION_TYPE_META[lastSession.sessionType].color} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.lastTitle}>Last: {SESSION_TYPE_META[lastSession.sessionType].label}</Text>
                  <Text style={styles.lastDate}>{formatDate(lastSession.date)}</Text>
                </View>
              </View>
              <View style={styles.repeatRow}>
                <Pressable
                  onPress={handleRepeatSameSettings}
                  style={({ pressed }) => [styles.repeatBtnFilled, pressed && { opacity: 0.85, transform: [{ scale: 0.97 }] }]}
                  testID="repeat-same-settings"
                >
                  <Ionicons name="flash" size={14} color="#fff" />
                  <Text style={styles.repeatBtnFilledText}>Same settings</Text>
                </Pressable>
                <Pressable
                  onPress={handleRepeatCustomise}
                  style={({ pressed }) => [styles.repeatBtnOutline, pressed && { opacity: 0.8 }]}
                  testID="repeat-customise"
                >
                  <Ionicons name="options-outline" size={14} color={C.primary} />
                  <Text style={styles.repeatBtnOutlineText}>Customise</Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <View style={styles.firstCard}>
              <Ionicons name="sparkles-outline" size={20} color={C.primary} />
              <Text style={styles.firstCardText}>Complete your first session to start tracking progress</Text>
            </View>
          )}
        </Animated.View>

      </View>

      {/* Weekly weight prompt modal */}
      <Modal visible={showWeightPrompt} transparent animationType="fade" onRequestClose={dismissWeightPrompt}>
        <Pressable style={styles.promptOverlay} onPress={dismissWeightPrompt}>
          <Pressable style={styles.promptCard} onPress={(e) => e.stopPropagation()}>
            <View style={styles.promptIconWrap}>
              <Ionicons name="scale-outline" size={28} color={C.primary} />
            </View>
            <Text style={styles.promptTitle}>Update Your Weight</Text>
            <Text style={styles.promptSub}>
              {userProfile.bodyweightKg > 0
                ? `Your last recorded weight is ${kgToDisplayUnit(userProfile.bodyweightKg, weightUnit)} ${weightUnit}. Still accurate?`
                : 'Enter your body weight to help calibrate your sessions.'}
            </Text>
            <View style={styles.promptInputRow}>
              <TextInput
                style={styles.promptInput}
                value={weightPromptText}
                onChangeText={setWeightPromptText}
                placeholder={weightUnit === 'kg' ? 'e.g. 80' : 'e.g. 176'}
                placeholderTextColor={C.textTertiary}
                keyboardType="decimal-pad"
                returnKeyType="done"
                autoFocus
              />
              <Text style={styles.promptUnit}>{weightUnit}</Text>
            </View>
            <Pressable
              onPress={confirmWeightPrompt}
              style={styles.promptConfirmBtn}
              testID="weight-prompt-confirm"
            >
              <Text style={styles.promptConfirmText}>
                {parseFloat(weightPromptText) > 0 ? 'Save & Continue' : 'Skip for now'}
              </Text>
            </Pressable>
            <Pressable onPress={dismissWeightPrompt} style={styles.promptDismissBtn}>
              <Text style={styles.promptDismissText}>Remind me later</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

function makeStyles(C: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: C.background },
    inner: { flex: 1, paddingHorizontal: 20, justifyContent: 'space-between', paddingTop: 16, paddingBottom: 12 },

    header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    greetingText: { fontSize: 24, fontFamily: 'Inter_700Bold', color: C.text },
    tierText: { fontSize: 13, fontFamily: 'Inter_500Medium', color: C.textSecondary, marginTop: 2 },
    testWeekPill: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#fff3e0', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: '#ffe0b2' },
    testWeekPillText: { fontSize: 11, fontFamily: 'Inter_600SemiBold', color: '#e65100' },

    todayCard: {
      backgroundColor: C.surface, borderRadius: 20,
      padding: 20, borderWidth: 1.5, borderColor: C.primary,
      shadowColor: C.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 12, elevation: 4,
    },
    todayCardTop: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 18 },
    todayLabel: { fontSize: 11, fontFamily: 'Inter_600SemiBold', color: C.primary, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 },
    todaySessionName: { fontSize: 26, fontFamily: 'Inter_700Bold', color: C.text, marginBottom: 4 },
    todaySessionSub: { fontSize: 13, fontFamily: 'Inter_400Regular', color: C.textSecondary },
    todayIcon: { width: 64, height: 64, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginLeft: 12, flexShrink: 0 },
    startBtn: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
      backgroundColor: C.primary, borderRadius: 14, paddingVertical: 14,
    },
    startBtnText: { fontSize: 16, fontFamily: 'Inter_700Bold', color: '#fff' },

    statsStrip: {
      flexDirection: 'row', backgroundColor: C.surface,
      borderRadius: 16, paddingVertical: 16,
      borderWidth: 1, borderColor: C.borderLight,
    },
    statItem: { flex: 1, alignItems: 'center' },
    statValue: { fontSize: 24, fontFamily: 'Inter_700Bold', color: C.text },
    statGoal: { fontSize: 16, fontFamily: 'Inter_500Medium', color: C.textTertiary },
    statLabel: { fontSize: 11, fontFamily: 'Inter_500Medium', color: C.textSecondary, marginTop: 2 },
    statDivider: { width: 1, backgroundColor: C.border, marginVertical: 4 },

    lastCard: {
      backgroundColor: C.surface, borderRadius: 16,
      paddingHorizontal: 16, paddingTop: 14, paddingBottom: 14,
      borderWidth: 1, borderColor: C.borderLight,
    },
    lastCardTop: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
    lastIcon: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
    lastTitle: { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: C.text },
    lastDate: { fontSize: 12, fontFamily: 'Inter_400Regular', color: C.textSecondary, marginTop: 1 },
    repeatRow: { flexDirection: 'row', gap: 8 },
    repeatBtnFilled: {
      flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5,
      backgroundColor: C.primary, borderRadius: 10, paddingVertical: 9,
    },
    repeatBtnFilledText: { fontSize: 13, fontFamily: 'Inter_700Bold', color: '#fff' },
    repeatBtnOutline: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5,
      borderWidth: 1.5, borderColor: C.primary,
      borderRadius: 10, paddingHorizontal: 14, paddingVertical: 9,
    },
    repeatBtnOutlineText: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: C.primary },

    firstCard: {
      flexDirection: 'row', alignItems: 'center', gap: 10,
      backgroundColor: C.surface, borderRadius: 14,
      paddingHorizontal: 14, paddingVertical: 14,
      borderWidth: 1, borderColor: C.borderLight,
    },
    firstCardText: { flex: 1, fontSize: 13, fontFamily: 'Inter_400Regular', color: C.textSecondary },

    // Weekly weight prompt modal
    promptOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 },
    promptCard: { width: '100%', backgroundColor: C.surface, borderRadius: 20, padding: 24, alignItems: 'center' },
    promptIconWrap: { width: 56, height: 56, borderRadius: 16, backgroundColor: C.primarySurface, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
    promptTitle: { fontSize: 20, fontFamily: 'Inter_700Bold', color: C.text, marginBottom: 8, textAlign: 'center' },
    promptSub: { fontSize: 14, fontFamily: 'Inter_400Regular', color: C.textSecondary, textAlign: 'center', lineHeight: 20, marginBottom: 20 },
    promptInputRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 20, alignSelf: 'stretch' },
    promptInput: {
      flex: 1, height: 48, backgroundColor: C.surfaceTertiary, borderRadius: 12,
      borderWidth: 1.5, borderColor: C.primary, paddingHorizontal: 14,
      fontSize: 18, fontFamily: 'Inter_600SemiBold', color: C.text, textAlign: 'center',
    },
    promptUnit: { fontSize: 16, fontFamily: 'Inter_600SemiBold', color: C.textSecondary, minWidth: 28 },
    promptConfirmBtn: { width: '100%', backgroundColor: C.primary, borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginBottom: 10 },
    promptConfirmText: { fontSize: 15, fontFamily: 'Inter_700Bold', color: '#fff' },
    promptDismissBtn: { paddingVertical: 10 },
    promptDismissText: { fontSize: 14, fontFamily: 'Inter_500Medium', color: C.textTertiary },
  });
}
