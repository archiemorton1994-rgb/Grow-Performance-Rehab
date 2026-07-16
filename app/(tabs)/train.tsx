import React, { useMemo, useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Platform,
  Alert,
  Image,
  Modal,
  useWindowDimensions,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { EquipmentIcon } from '@/components/EquipmentIcon';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useColors } from '@/constants/colors';
import { EquipmentTier, SessionType, TIER_ORDER, useAppStore } from '@/lib/store';
import { getEquipmentLabel, getEffectiveTier } from '@/lib/workout-engine';
import { SESSION_META as SESSION_META_LABELS, getSessionColors } from '@/lib/session-meta';

const SESSION_ORDER: SessionType[] = ['squat', 'bench', 'deadlift'];

const KPI_SESSION_TYPES: SessionType[] = ['squat', 'bench', 'deadlift', 'custom'];

const WEEKLY_SESSION_TYPES_UI: SessionType[] = [
  'lower_body',
  'upper_body',
  'full_body',
  'conditioning',
];

const SESSION_IMAGES: Record<SessionType, any> = {
  squat: require('@/assets/images/sessions/squat.png'),
  bench: require('@/assets/images/sessions/bench.png'),
  deadlift: require('@/assets/images/sessions/deadlift.png'),
  conditioning: require('@/assets/images/sessions/conditioning.png'),
  prehab: require('@/assets/images/sessions/targeted-prehab.png'),
  flexibility: require('@/assets/images/sessions/mobility.png'),
  custom: require('@/assets/images/sessions/custom.png'),
  lower_body: require('@/assets/images/sessions/lower-body.png'),
  upper_body: require('@/assets/images/sessions/upper-body.png'),
  full_body: require('@/assets/images/sessions/full-body.png'),
};

const ALL_TIERS: EquipmentTier[] = ['bodyweight', 'bands', 'dumbbells', 'kettlebells', 'fullgym'];

const TIER_DESCRIPTIONS: Record<EquipmentTier, string> = {
  bodyweight: 'No equipment needed',
  bands: 'Resistance bands only',
  dumbbells: 'Dumbbells available',
  kettlebells: 'Kettlebells available',
  fullgym: 'Everything - cables, machines, full setup',
};

export default function TrainScreen() {
  const insets = useSafeAreaInsets();
  const { height: screenHeight } = useWindowDimensions();
  const C = useColors();
  const {
    completedSessions,
    isTestWeekDue,
    testWeekFrequency,
    activeSession,
    clearActiveSession,
    equipmentTiers,
    userProfile,
    sessionEquipmentOverride,
    setSessionEquipmentOverride,
    clearSessionEquipmentOverride,
  } = useAppStore();

  const prevSessionCount = useRef(completedSessions.length);
  useEffect(() => {
    if (completedSessions.length > prevSessionCount.current) {
      clearSessionEquipmentOverride();
    }
    prevSessionCount.current = completedSessions.length;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [completedSessions.length]);

  const isBeginnerExperience = userProfile?.experienceLevel === 'beginner';
  const availableTiers: EquipmentTier[] = isBeginnerExperience
    ? ['bodyweight', 'bands']
    : ALL_TIERS;

  const profileEquipment: EquipmentTier[] =
    equipmentTiers && equipmentTiers.length > 0 ? equipmentTiers : ['bodyweight'];

  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetDraft, setSheetDraft] = useState<EquipmentTier[]>([]);

  const todayTiers = sessionEquipmentOverride ?? profileEquipment;
  const todayEffectiveTier = getEffectiveTier(todayTiers);

  const webTopInset = Platform.OS === 'web' ? 67 : 0;
  const testWeek = isTestWeekDue();

  const SESSION_META = useMemo(() => {
    const colors = getSessionColors(C);
    const result = {} as Record<
      SessionType,
      {
        label: string;
        subtitle: string;
        icon: keyof typeof Ionicons.glyphMap;
        color: string;
        bg: string;
      }
    >;
    (Object.keys(SESSION_META_LABELS) as SessionType[]).forEach((type) => {
      result[type] = { ...SESSION_META_LABELS[type], ...colors[type] };
    });
    return result;
  }, [C]);

  const openEquipmentSheet = () => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSheetDraft([...todayTiers]);
    setSheetOpen(true);
  };

  const handleDraftToggle = (tier: EquipmentTier) => {
    if (!availableTiers.includes(tier)) return;
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSheetDraft((prev) => {
      if (tier === 'fullgym') {
        if (prev.includes('fullgym')) {
          return prev.filter((t) => t !== 'fullgym');
        } else {
          return [...TIER_ORDER];
        }
      }
      if (prev.includes(tier)) {
        const next = prev.filter((t) => t !== tier && t !== 'fullgym');
        return next.length > 0 ? next : [tier];
      }
      return [...prev, tier];
    });
  };

  const confirmEquipment = () => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSessionEquipmentOverride(sheetDraft);
    setSheetOpen(false);
  };

  const resetToProfile = () => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    clearSessionEquipmentOverride();
    setSheetOpen(false);
  };

  const handleResume = () => {
    if (!activeSession) return;
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push({
      pathname: '/session',
      params: {
        sessionType: activeSession.sessionType,
        hasAches: activeSession.hasAches ? 'true' : 'false',
        painRegion: activeSession.painRegion ?? '',
        energy: activeSession.energy,
        timeAvailable: activeSession.timeAvailable,
        isTestWeek: activeSession.isTestWeek ? 'true' : 'false',
        equipment: activeSession.equipmentTier,
        ...(activeSession.displayLabel ? { displayLabel: activeSession.displayLabel } : {}),
      },
    });
  };

  const showActiveSessionPrompt = (onDiscard: () => void) => {
    Alert.alert(
      'Session in progress',
      'You have an unfinished session. Resume it or discard it to start a new one.',
      [
        { text: 'Resume', onPress: handleResume },
        {
          text: 'Discard',
          style: 'destructive',
          onPress: () => {
            clearActiveSession();
            onDiscard();
          },
        },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const equipmentOverrideParam = sessionEquipmentOverride
    ? JSON.stringify(sessionEquipmentOverride)
    : undefined;

  const handleSelect = (sessionType: SessionType) => {
    const navigate = () => {
      if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      if (sessionType === 'custom') {
        router.push({ pathname: '/custom-session' });
      } else if (sessionType === 'prehab') {
        router.push({
          pathname: '/readiness',
          params: { sessionType, isTestWeek: 'false', equipmentOverride: equipmentOverrideParam },
        });
      } else if (sessionType === 'flexibility') {
        router.push({
          pathname: '/session',
          params: {
            sessionType,
            hasAches: 'false',
            painRegion: '',
            energy: 'normal',
            timeAvailable: '60',
            isTestWeek: 'false',
            equipment: todayEffectiveTier,
          },
        });
      } else if (sessionType === 'conditioning') {
        router.push({
          pathname: '/readiness',
          params: { sessionType, isTestWeek: 'false', equipmentOverride: equipmentOverrideParam },
        });
      } else if (
        sessionType === 'upper_body' ||
        sessionType === 'lower_body' ||
        sessionType === 'full_body'
      ) {
        router.push({
          pathname: '/readiness',
          params: { sessionType, isTestWeek: 'false', equipmentOverride: equipmentOverrideParam },
        });
      } else {
        router.push({
          pathname: '/readiness',
          params: {
            sessionType,
            isTestWeek: testWeek ? 'true' : 'false',
            equipmentOverride: equipmentOverrideParam,
          },
        });
      }
    };
    if (activeSession) {
      showActiveSessionPrompt(navigate);
      return;
    }
    navigate();
  };

  const styles = useMemo(() => makeStyles(C), [C]);
  const compactCards = screenHeight < 670;

  const draftEffectiveTier = getEffectiveTier(sheetDraft.length > 0 ? sheetDraft : ['bodyweight']);
  const isOverrideActive = sessionEquipmentOverride !== null;

  return (
    <>
      <View
        style={[
          styles.container,
          styles.content,
          {
            paddingTop: insets.top + webTopInset + 16,
            paddingBottom: insets.bottom + (Platform.OS === 'web' ? 84 : 50),
          },
        ]}
      >
        <Text style={styles.title}>Train</Text>
        {!activeSession && <Text style={styles.subtitle}>Choose a session to start</Text>}

        {/* Equipment chip */}
        <View style={styles.equipmentChipRow}>
          <Pressable
            onPress={openEquipmentSheet}
            style={({ pressed }) => [
              styles.equipmentChip,
              isOverrideActive && styles.equipmentChipOverride,
              pressed && { opacity: 0.8 },
            ]}
            testID="train-equipment-chip"
          >
            <EquipmentIcon
              tier={todayEffectiveTier}
              size={13}
              color={isOverrideActive ? C.primary : C.textSecondary}
            />
            <Text
              style={[
                styles.equipmentChipText,
                isOverrideActive && styles.equipmentChipTextOverride,
              ]}
            >
              {isOverrideActive ? 'Today: ' : ''}
              {getEquipmentLabel(todayEffectiveTier)}
            </Text>
            {isOverrideActive && <View style={styles.overrideDot} />}
            <Ionicons
              name="chevron-down"
              size={12}
              color={isOverrideActive ? C.primary : C.textTertiary}
            />
          </Pressable>
          {isOverrideActive && (
            <Pressable
              onPress={() => {
                clearSessionEquipmentOverride();
                if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }}
              hitSlop={8}
              style={styles.equipmentDismissBtn}
              testID="train-equipment-dismiss"
            >
              <Ionicons name="close-circle" size={18} color={C.textTertiary} />
            </Pressable>
          )}
        </View>

        {/* Resume banner */}
        {activeSession && (
          <Animated.View entering={FadeInDown.duration(350)} style={[styles.resumeBanner, { marginBottom: 10 }]}>
            <View style={styles.resumeBannerLeft}>
              <Ionicons name="time-outline" size={20} color={C.warning} />
              <View>
                <Text style={styles.resumeBannerTitle}>Session in progress</Text>
                <Text style={styles.resumeBannerSub}>
                  {activeSession.displayLabel ??
                    SESSION_META_LABELS[activeSession.sessionType]?.label}{' '}
                  · {activeSession.completedSetsCount}/{activeSession.totalSets} sets
                </Text>
              </View>
            </View>
            <Pressable
              onPress={handleResume}
              style={({ pressed }) => [styles.resumeBannerBtn, pressed && { opacity: 0.85 }]}
              testID="train-resume-session"
            >
              <Text style={styles.resumeBannerBtnText}>Resume</Text>
            </Pressable>
          </Animated.View>
        )}

        {/* KPI Sessions */}
        <Text style={styles.sectionHeading}>KPI Sessions</Text>
        <Animated.View entering={FadeInDown.delay(0).duration(380)} style={styles.sessionGrid}>
          {KPI_SESSION_TYPES.map((type) => {
            const meta = SESSION_META[type];
            return (
              <Pressable
                key={type}
                onPress={() => handleSelect(type)}
                style={({ pressed }) => [
                  styles.sessionCard,
                  pressed && { opacity: 0.88, transform: [{ scale: 0.97 }] },
                ]}
                testID={`train-session-${type}`}
              >
                <View style={[styles.sessionCardIcon, compactCards && { height: 68 }]}>
                  <Image
                    source={SESSION_IMAGES[type]}
                    style={styles.sessionCardImage}
                    resizeMode="cover"
                  />
                </View>
                <Text style={styles.sessionCardLabel} numberOfLines={1}>
                  {meta.label}
                </Text>
                <Text style={styles.sessionCardSub} numberOfLines={1}>
                  {meta.subtitle}
                </Text>
              </Pressable>
            );
          })}
        </Animated.View>

        {/* Additional Sessions */}
        <Text style={[styles.sectionHeading, { marginTop: activeSession ? 4 : 8 }]}>Additional Sessions</Text>
        <Animated.View entering={FadeInDown.delay(60).duration(380)} style={styles.sessionGrid}>
          {WEEKLY_SESSION_TYPES_UI.map((type) => {
            const meta = SESSION_META[type];
            return (
              <Pressable
                key={type}
                onPress={() => handleSelect(type)}
                style={({ pressed }) => [
                  styles.sessionCard,
                  pressed && { opacity: 0.88, transform: [{ scale: 0.97 }] },
                ]}
                testID={`train-session-${type}`}
              >
                <View style={[styles.sessionCardIcon, compactCards && { height: 68 }]}>
                  <Image
                    source={SESSION_IMAGES[type]}
                    style={styles.sessionCardImage}
                    resizeMode="cover"
                  />
                </View>
                <Text style={styles.sessionCardLabel} numberOfLines={1}>
                  {meta.label}
                </Text>
                <Text style={styles.sessionCardSub} numberOfLines={1}>
                  {meta.subtitle}
                </Text>
              </Pressable>
            );
          })}
        </Animated.View>
      </View>

      {/* Equipment picker sheet */}
      <Modal
        visible={sheetOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setSheetOpen(false)}
      >
        <Pressable style={styles.sheetBackdrop} onPress={() => setSheetOpen(false)} />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHeader}>
            <View>
              <Text style={styles.sheetTitle}>Equipment today</Text>
              <Text style={styles.sheetSubtitle}>This only affects the current session</Text>
            </View>
            {isOverrideActive && (
              <Pressable onPress={resetToProfile} style={styles.resetBtn}>
                <Text style={styles.resetBtnText}>Reset</Text>
              </Pressable>
            )}
          </View>

          {sheetDraft.length > 0 && (
            <View style={styles.bestMatchRow}>
              <Text style={styles.bestMatchText}>
                Best match:{' '}
                <Text style={{ fontFamily: 'Inter_600SemiBold', color: C.primary }}>
                  {getEquipmentLabel(draftEffectiveTier)}
                </Text>
              </Text>
            </View>
          )}

          {isBeginnerExperience && (
            <View style={styles.beginnerNote}>
              <Ionicons name="shield-checkmark-outline" size={13} color={C.primary} />
              <Text style={styles.beginnerNoteText}>
                Bodyweight & Bands - unlock more in profile
              </Text>
            </View>
          )}

          {ALL_TIERS.map((tier) => {
            const isAvailable = availableTiers.includes(tier);
            const isActive = sheetDraft.includes(tier);
            return (
              <Pressable
                key={tier}
                onPress={() => handleDraftToggle(tier)}
                style={({ pressed }) => [
                  styles.tierRow,
                  isActive && styles.tierRowActive,
                  !isAvailable && styles.tierRowLocked,
                  pressed && isAvailable && { opacity: 0.8 },
                ]}
                testID={`sheet-equipment-${tier}`}
              >
                <View
                  style={[
                    styles.tierIcon,
                    {
                      backgroundColor: isActive
                        ? C.primary
                        : isAvailable
                          ? C.primaryMuted
                          : C.surfaceTertiary,
                    },
                  ]}
                >
                  <EquipmentIcon
                    tier={tier}
                    size={16}
                    color={isActive ? C.textInverse : isAvailable ? C.primary : C.textTertiary}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text
                    style={[
                      styles.tierLabel,
                      isActive && { color: C.primary },
                      !isAvailable && { color: C.textTertiary },
                    ]}
                  >
                    {getEquipmentLabel(tier)}
                  </Text>
                  <Text style={styles.tierSub}>
                    {isAvailable ? TIER_DESCRIPTIONS[tier] : 'Unlock in profile'}
                  </Text>
                </View>
                {!isAvailable ? (
                  <Ionicons name="lock-closed-outline" size={14} color={C.textTertiary} />
                ) : (
                  <View style={[styles.tierCheck, isActive && styles.tierCheckActive]}>
                    {isActive && <Ionicons name="checkmark" size={11} color={C.textInverse} />}
                  </View>
                )}
              </Pressable>
            );
          })}

          <Pressable
            onPress={confirmEquipment}
            disabled={sheetDraft.length === 0}
            style={({ pressed }) => [
              styles.confirmBtn,
              sheetDraft.length === 0 && { opacity: 0.4 },
              pressed && sheetDraft.length > 0 && { opacity: 0.88, transform: [{ scale: 0.98 }] },
            ]}
            testID="sheet-equipment-confirm"
          >
            <Ionicons name="checkmark-circle" size={18} color={C.textInverse} />
            <Text style={styles.confirmBtnText}>Use this equipment</Text>
          </Pressable>
        </View>
      </Modal>
    </>
  );
}

function makeStyles(C: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: C.background },
    content: { paddingHorizontal: 20 },
    title: { fontSize: 26, fontFamily: 'Inter_700Bold', color: C.text },
    subtitle: {
      fontSize: 13,
      fontFamily: 'Inter_500Medium',
      color: C.textSecondary,
      marginTop: 2,
      marginBottom: 10,
    },

    equipmentChipRow: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      alignSelf: 'flex-start' as const,
      gap: 6,
      marginBottom: 16,
    },
    equipmentChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      backgroundColor: C.surface,
      borderRadius: 20,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderWidth: 1,
      borderColor: C.borderLight,
    },
    equipmentDismissBtn: { padding: 2 },
    equipmentChipOverride: {
      borderColor: C.primary,
      backgroundColor: C.primarySurface,
    },
    equipmentChipText: {
      fontSize: 12,
      fontFamily: 'Inter_500Medium',
      color: C.textSecondary,
    },
    equipmentChipTextOverride: {
      color: C.primary,
      fontFamily: 'Inter_600SemiBold',
    },
    overrideDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: C.primary,
    },

    resumeBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: C.warningLight,
      borderRadius: 14,
      paddingHorizontal: 14,
      paddingVertical: 12,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: C.warning,
    },
    resumeBannerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
    resumeBannerTitle: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: C.warning },
    resumeBannerSub: {
      fontSize: 11,
      fontFamily: 'Inter_400Regular',
      color: C.warning,
      marginTop: 1,
    },
    resumeBannerBtn: {
      backgroundColor: C.warning,
      borderRadius: 10,
      paddingHorizontal: 14,
      paddingVertical: 8,
    },
    resumeBannerBtnText: { fontSize: 13, fontFamily: 'Inter_700Bold', color: C.textInverse },

    sectionHeading: {
      fontSize: 13,
      fontFamily: 'Inter_600SemiBold',
      color: C.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.8,
      marginBottom: 6,
      marginTop: 2,
    },
    sessionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 10 },
    sessionCard: {
      width: '47%',
      backgroundColor: C.surface,
      borderRadius: 14,
      padding: 8,
      borderWidth: 1,
      borderColor: C.borderLight,
    },
    sessionCardIcon: {
      width: '100%',
      height: 80,
      borderRadius: 10,
      backgroundColor: '#111111',
      overflow: 'hidden',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 6,
    },
    sessionCardImage: { width: '100%', height: '100%' },
    sessionCardLabel: { fontSize: 12, fontFamily: 'Inter_700Bold', color: C.text, marginBottom: 3 },
    sessionCardSub: { fontSize: 11, fontFamily: 'Inter_400Regular', color: C.textSecondary },

    // Equipment sheet
    sheetBackdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.45)',
    },
    sheet: {
      backgroundColor: C.surface,
      borderTopLeftRadius: 22,
      borderTopRightRadius: 22,
      paddingHorizontal: 20,
      paddingTop: 10,
      gap: 8,
    },
    sheetHandle: {
      width: 36,
      height: 4,
      borderRadius: 2,
      backgroundColor: C.border,
      alignSelf: 'center',
      marginBottom: 6,
    },
    sheetHeader: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      marginBottom: 2,
    },
    sheetTitle: { fontSize: 17, fontFamily: 'Inter_700Bold', color: C.text },
    sheetSubtitle: {
      fontSize: 12,
      fontFamily: 'Inter_400Regular',
      color: C.textSecondary,
      marginTop: 2,
    },
    resetBtn: {
      paddingHorizontal: 12,
      paddingVertical: 5,
      backgroundColor: C.surfaceTertiary,
      borderRadius: 10,
    },
    resetBtnText: { fontSize: 12, fontFamily: 'Inter_600SemiBold', color: C.textSecondary },
    bestMatchRow: {
      backgroundColor: C.primarySurface,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 7,
    },
    bestMatchText: { fontSize: 12, fontFamily: 'Inter_400Regular', color: C.textSecondary },
    beginnerNote: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: C.primarySurface,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 7,
    },
    beginnerNoteText: { fontSize: 12, fontFamily: 'Inter_400Regular', color: C.primary, flex: 1 },
    tierRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: C.background,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderWidth: 1,
      borderColor: C.borderLight,
    },
    tierRowActive: { borderColor: C.primary, backgroundColor: C.primarySurface },
    tierRowLocked: { opacity: 0.45 },
    tierIcon: {
      width: 34,
      height: 34,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
    },
    tierLabel: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: C.text },
    tierSub: { fontSize: 11, fontFamily: 'Inter_400Regular', color: C.textSecondary, marginTop: 1 },
    tierCheck: {
      width: 20,
      height: 20,
      borderRadius: 10,
      borderWidth: 1.5,
      borderColor: C.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    tierCheckActive: { backgroundColor: C.primary, borderColor: C.primary },
    confirmBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: C.primary,
      borderRadius: 14,
      paddingVertical: 14,
      marginTop: 4,
    },
    confirmBtnText: { fontSize: 15, fontFamily: 'Inter_700Bold', color: C.textInverse },
  });
}
