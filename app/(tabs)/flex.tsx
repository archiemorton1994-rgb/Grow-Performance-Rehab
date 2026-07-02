import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Modal,
  Platform,
  ScrollView,
  Image,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/constants/colors';
import { useAppStore, PainRegion, EquipmentTier, TIER_ORDER } from '@/lib/store';
import { getEffectiveTier, getEquipmentLabel, getEquipmentIcon } from '@/lib/workout-engine';
import { daysSince } from '@/lib/utils';

const FLEX_IMAGES: Record<string, any> = {
  recovery:    require('@/assets/images/sessions/recovery.png'),
  mobility:    require('@/assets/images/sessions/mobility.png'),
  prehab:      require('@/assets/images/sessions/targeted-prehab.png'),
  conditioning: require('@/assets/images/sessions/conditioning.png'),
};

const ALL_TIERS: EquipmentTier[] = ['bodyweight', 'bands', 'dumbbells', 'kettlebells', 'barbell', 'fullgym'];

const PREHAB_REGION_LIST: Array<{ region: PainRegion; label: string; icon: string }> = [
  { region: 'neck',           label: 'Neck',             icon: 'scan-outline' },
  { region: 'front_shoulder', label: 'Front Shoulder',   icon: 'fitness-outline' },
  { region: 'rear_shoulder',  label: 'Rear Shoulder',    icon: 'fitness-outline' },
  { region: 'elbow_wrist',    label: 'Elbow / Wrist',    icon: 'hand-left-outline' },
  { region: 'upper_back',     label: 'Upper Back',       icon: 'arrow-up-outline' },
  { region: 'lower_back',     label: 'Lower Back',       icon: 'arrow-down-outline' },
  { region: 'core_ribs',      label: 'Core / Ribs',      icon: 'shield-outline' },
  { region: 'hip_groin',      label: 'Hip / Groin',      icon: 'walk-outline' },
  { region: 'knee',           label: 'Knee',             icon: 'walk-outline' },
  { region: 'ankle_achilles', label: 'Ankle / Achilles', icon: 'footsteps-outline' },
  { region: 'calf_shin',      label: 'Calf / Shin',      icon: 'footsteps-outline' },
];

const TIER_DESCRIPTIONS: Record<EquipmentTier, string> = {
  bodyweight: 'No equipment needed',
  bands: 'Resistance bands only',
  dumbbells: 'Dumbbells available',
  kettlebells: 'Kettlebells available',
  barbell: 'Barbell and squat rack',
  fullgym: 'Everything — cables, machines, full setup',
};

type ModalType = 'recovery' | 'mobility' | 'prehab' | 'conditioning' | null;
type ConditioningLevel = 'beginner' | 'intermediate' | 'advanced';

function getFlexRecency(completedSessions: any[], sessionType: 'prehab' | 'flexibility' | 'conditioning'): string {
  const matches = completedSessions.filter(s => s.sessionType === sessionType);
  if (matches.length === 0) return 'Not tried yet';
  const days = daysSince(matches[0].date);
  if (days === 0) return 'Done today';
  if (days === 1) return 'Last done yesterday';
  return `Last done ${days} days ago`;
}

type FlexSessionInfo = {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconBg: string;
  iconColor: string;
  duration: string;
  description: string;
  cta: string;
  sessionType: 'prehab' | 'flexibility';
};

function getSessionInfo(C: ReturnType<typeof useColors>): Record<Exclude<ModalType, 'conditioning' | null>, FlexSessionInfo> {
  return {
    recovery: {
      title: 'Recovery',
      icon: 'shield-checkmark',
      iconBg: C.categoryCooldown,
      iconColor: C.categoryCooldownText,
      duration: 'Full-body joint circuit · 20–30 min',
      description: 'A gentle circuit targeting common trouble spots. Perfect after a hard training block or on a rest day. Select a focus area or choose Full Body for a complete joint reset.',
      cta: 'Start Recovery',
      sessionType: 'prehab',
    },
    mobility: {
      title: 'Mobility',
      icon: 'accessibility-outline',
      iconBg: C.categoryCooldown,
      iconColor: C.categoryCooldownText,
      duration: 'Full-body stretch session · 30–40 min',
      description: 'Long-hold stretches for the full body. Improves range of motion and helps you move and feel better between training days. Best done when your muscles are slightly warm.',
      cta: 'Start Mobility',
      sessionType: 'flexibility',
    },
    prehab: {
      title: 'Targeted Prehab',
      icon: 'locate-outline',
      iconBg: C.categoryPrehab,
      iconColor: C.categoryPrehabText,
      duration: 'Area-focused circuit · 20–30 min',
      description: 'Select a region that needs attention. The session focuses on protecting and strengthening that specific area to reduce injury risk and improve long-term function.',
      cta: 'Choose Area & Start',
      sessionType: 'prehab',
    },
  };
}

type ConditioningLevelDef = {
  key: ConditioningLevel;
  label: string;
  description: string;
  energy: string;
  timeAvailable: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
};

function getConditioningLevels(C: ReturnType<typeof useColors>): ConditioningLevelDef[] {
  return [
    {
      key: 'beginner',
      label: 'Beginner',
      description: 'Steady pace · 30 min',
      energy: 'low',
      timeAvailable: '30',
      icon: 'walk',
      color: C.success,
    },
    {
      key: 'intermediate',
      label: 'Intermediate',
      description: 'Moderate intensity · 45 min',
      energy: 'normal',
      timeAvailable: '45',
      icon: 'bicycle',
      color: C.warning,
    },
    {
      key: 'advanced',
      label: 'Advanced',
      description: 'High intensity · 60 min',
      energy: 'high',
      timeAvailable: '60',
      icon: 'flame',
      color: C.error,
    },
  ];
}

export default function FlexScreen() {
  const insets = useSafeAreaInsets();
  const C = useColors();
  const {
    completedSessions,
    equipmentTiers,
    userProfile,
    sessionEquipmentOverride,
    setSessionEquipmentOverride,
    clearSessionEquipmentOverride,
  } = useAppStore();
  const webTopInset = Platform.OS === 'web' ? 67 : 0;
  const webBottomInset = Platform.OS === 'web' ? 84 : 0;

  const isBeginnerExperience = userProfile?.experienceLevel === 'beginner';
  const availableTiers: EquipmentTier[] = isBeginnerExperience ? ['bodyweight', 'bands'] : ALL_TIERS;
  const profileEquipment: EquipmentTier[] = (equipmentTiers && equipmentTiers.length > 0) ? equipmentTiers : ['bodyweight'];
  const todayTiers = sessionEquipmentOverride ?? profileEquipment;
  const todayEffectiveTier = getEffectiveTier(todayTiers);
  const isOverrideActive = sessionEquipmentOverride !== null;

  const [activeModal, setActiveModal] = useState<ModalType>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetDraft, setSheetDraft] = useState<EquipmentTier[]>([]);
  const draftEffectiveTier = getEffectiveTier(sheetDraft.length > 0 ? sheetDraft : ['bodyweight']);

  const prehabRecency = useMemo(() => getFlexRecency(completedSessions, 'prehab'), [completedSessions]);
  const flexRecency = useMemo(() => getFlexRecency(completedSessions, 'flexibility'), [completedSessions]);
  const condRecency = useMemo(() => getFlexRecency(completedSessions, 'conditioning'), [completedSessions]);

  const SESSION_INFO = useMemo(() => getSessionInfo(C), [C]);
  const CONDITIONING_LEVELS = useMemo(() => getConditioningLevels(C), [C]);
  const styles = useMemo(() => makeStyles(C), [C]);

  const openModal = (type: NonNullable<ModalType>) => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setActiveModal(type);
  };

  const closeModal = () => {
    setActiveModal(null);
  };

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
          return prev.filter(t => t !== 'fullgym');
        } else {
          return [...TIER_ORDER];
        }
      }
      if (prev.includes(tier)) {
        const next = prev.filter(t => t !== tier && t !== 'fullgym');
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

  const handleStart = (sessionType: 'prehab' | 'flexibility') => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    closeModal();
    const equipmentOverrideParam = sessionEquipmentOverride ? JSON.stringify(sessionEquipmentOverride) : undefined;
    router.push({ pathname: '/readiness', params: { sessionType, isTestWeek: 'false', ...(equipmentOverrideParam ? { equipmentOverride: equipmentOverrideParam } : {}) } });
  };

  const handlePrehabRegion = (region: PainRegion | 'fullbody') => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    closeModal();
    router.push({
      pathname: '/session',
      params: {
        sessionType: 'prehab',
        hasAches: 'false',
        painRegion: region !== 'fullbody' ? region : '',
        energy: 'normal',
        timeAvailable: '60',
        isTestWeek: 'false',
        equipment: todayEffectiveTier,
      },
    });
  };

  const handleConditioningStart = (level: typeof CONDITIONING_LEVELS[number]) => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    closeModal();
    const equipmentOverrideParam = sessionEquipmentOverride ? JSON.stringify(sessionEquipmentOverride) : undefined;
    router.push({
      pathname: '/readiness',
      params: {
        sessionType: 'conditioning',
        isTestWeek: 'false',
        energy: level.energy,
        timeAvailable: level.timeAvailable,
        ...(equipmentOverrideParam ? { equipmentOverride: equipmentOverrideParam } : {}),
      },
    });
  };

  const ROWS: Array<{
    key: NonNullable<ModalType>;
    title: string;
    subtitle: string;
    icon: keyof typeof Ionicons.glyphMap;
    iconBg: string;
    iconColor: string;
    recency: string;
  }> = [
    {
      key: 'recovery',
      title: 'Recovery',
      subtitle: 'Full-body joint circuit · 20–30 min',
      icon: 'shield-checkmark',
      iconBg: C.categoryCooldown,
      iconColor: C.categoryCooldownText,
      recency: prehabRecency,
    },
    {
      key: 'mobility',
      title: 'Mobility',
      subtitle: 'Full-body stretch session · 30–40 min',
      icon: 'accessibility-outline',
      iconBg: C.categoryCooldown,
      iconColor: C.categoryCooldownText,
      recency: flexRecency,
    },
    {
      key: 'prehab',
      title: 'Targeted Prehab',
      subtitle: 'Area-focused circuit · 20–30 min',
      icon: 'locate-outline',
      iconBg: C.categoryPrehab,
      iconColor: C.categoryPrehabText,
      recency: prehabRecency,
    },
    {
      key: 'conditioning',
      title: 'Conditioning',
      subtitle: 'HIIT & cardio circuit · 30–60 min',
      icon: 'thunderstorm',
      iconBg: C.categoryFinisher,
      iconColor: C.categoryFinisherText,
      recency: condRecency,
    },
  ];

  const activeInfo = activeModal && activeModal !== 'conditioning' ? SESSION_INFO[activeModal] : null;

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[
        styles.rootContent,
        {
          paddingTop: insets.top + webTopInset,
          paddingBottom: insets.bottom + webBottomInset + 24,
        },
      ]}
      showsVerticalScrollIndicator={false}
    >
      <View style={[styles.header, { paddingBottom: 8 }]}>
        <Text style={styles.title}>Rest & Restore</Text>
        <Text style={styles.subtitle}>Recovery, mobility, prehab and conditioning</Text>
      </View>

      {/* Equipment chip */}
      <View style={styles.equipmentChipRow}>
        <Pressable
          onPress={openEquipmentSheet}
          style={({ pressed }) => [
            styles.equipmentChip,
            isOverrideActive && styles.equipmentChipOverride,
            pressed && { opacity: 0.75 },
          ]}
          testID="flex-equipment-chip"
        >
          {isOverrideActive && <View style={styles.overrideDot} />}
          <Ionicons
            name={getEquipmentIcon(todayEffectiveTier) as keyof typeof Ionicons.glyphMap}
            size={13}
            color={isOverrideActive ? C.primary : C.textSecondary}
          />
          <Text style={[styles.equipmentChipText, isOverrideActive && styles.equipmentChipTextOverride]}>
            {isOverrideActive ? `Today: ${getEquipmentLabel(todayEffectiveTier)}` : getEquipmentLabel(todayEffectiveTier)}
          </Text>
          <Ionicons name="chevron-down" size={11} color={isOverrideActive ? C.primary : C.textTertiary} />
        </Pressable>
        {isOverrideActive && (
          <Pressable
            onPress={() => clearSessionEquipmentOverride()}
            style={({ pressed }) => [styles.equipmentDismissBtn, pressed && { opacity: 0.6 }]}
            testID="flex-equipment-dismiss"
          >
            <Ionicons name="close" size={14} color={C.textSecondary} />
          </Pressable>
        )}
      </View>

      {/* Nav card list - intrinsic height, no overflow:hidden anywhere.
          The outer navGrid ring supplies the border. Corner rounding is applied
          directly to the first/last row Pressables (navBtnFirst/navBtnLast),
          which is the only approach that survives RN Web resize/reflow. */}
      <View style={styles.navGrid}>
        <View style={styles.navGridInner}>
          {ROWS.map((row, i) => (
            <React.Fragment key={row.key}>
              {i > 0 && <View style={styles.navDivider} />}
              <Pressable
                onPress={() => openModal(row.key)}
                style={({ pressed }) => [
                  styles.navBtn,
                  i === 0 && styles.navBtnFirst,
                  i === ROWS.length - 1 && styles.navBtnLast,
                  pressed && { opacity: 0.8, transform: [{ scale: 0.97 }] },
                ]}
                testID={`flex-row-${row.key}`}
              >
                <View style={[styles.navIcon, { backgroundColor: row.iconBg }]}>
                  <Image source={FLEX_IMAGES[row.key]} style={styles.navIconImage} resizeMode="contain" />
                </View>
                <View style={styles.navBtnText}>
                  <Text style={styles.navLabel}>{row.title}</Text>
                  <Text style={styles.navSub}>{row.subtitle}</Text>
                  <Text style={styles.navRecency}>{row.recency}</Text>
                </View>
                <Ionicons name="chevron-forward" size={14} color={C.textTertiary} />
              </Pressable>
            </React.Fragment>
          ))}
        </View>
      </View>

      {/* Recovery / Mobility sheet */}
      <Modal
        visible={activeModal === 'recovery' || activeModal === 'mobility'}
        transparent
        animationType="slide"
        onRequestClose={closeModal}
      >
        <Pressable style={styles.sheetOverlay} onPress={closeModal}>
          <Pressable style={[styles.sheet, { paddingBottom: insets.bottom + 24 }]} onPress={(e) => e.stopPropagation()}>
            <View style={styles.sheetHandle} />

            {activeInfo && (
              <>
                <View style={styles.sheetHeader}>
                  <View style={[styles.sheetIconWrap, { backgroundColor: activeInfo.iconBg }]}>
                    <Image source={activeModal ? FLEX_IMAGES[activeModal] : FLEX_IMAGES.recovery} style={styles.sheetIconImage} resizeMode="contain" />
                  </View>
                  <View style={styles.sheetHeaderText}>
                    <Text style={styles.sheetTitle}>{activeInfo.title}</Text>
                    <Text style={styles.sheetDuration}>{activeInfo.duration}</Text>
                  </View>
                  <Pressable
                    onPress={closeModal}
                    style={styles.closeBtn}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons name="close" size={20} color={C.textSecondary} />
                  </Pressable>
                </View>

                <Text style={styles.sheetDesc}>{activeInfo.description}</Text>

                <Pressable
                  onPress={() => handleStart(activeInfo.sessionType)}
                  style={({ pressed }) => [
                    styles.startBtn,
                    pressed && { opacity: 0.88, transform: [{ scale: 0.98 }] },
                  ]}
                  testID={`flex-start-${activeModal}`}
                >
                  <Ionicons name="play" size={16} color={C.textInverse} />
                  <Text style={styles.startBtnText}>{activeInfo.cta}</Text>
                </Pressable>
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>

      {/* Targeted Prehab — region picker sheet */}
      <Modal
        visible={activeModal === 'prehab'}
        transparent
        animationType="slide"
        onRequestClose={closeModal}
      >
        <Pressable style={styles.sheetOverlay} onPress={closeModal}>
          <Pressable style={styles.prehabSheet} onPress={(e) => e.stopPropagation()}>
            <View style={styles.sheetHandle} />

            <View style={[styles.sheetHeader, { paddingHorizontal: 20 }]}>
              <View style={[styles.sheetIconWrap, { backgroundColor: C.categoryPrehab }]}>
                <Image source={FLEX_IMAGES.prehab} style={styles.sheetIconImage} resizeMode="contain" />
              </View>
              <View style={styles.sheetHeaderText}>
                <Text style={styles.sheetTitle}>Targeted Prehab</Text>
                <Text style={styles.sheetDuration}>Choose a region to target</Text>
              </View>
              <Pressable
                onPress={closeModal}
                style={styles.closeBtn}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close" size={20} color={C.textSecondary} />
              </Pressable>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.prehabScroll}
              keyboardShouldPersistTaps="handled"
            >
              {/* Full body option */}
              <Pressable
                onPress={() => handlePrehabRegion('fullbody')}
                style={({ pressed }) => [
                  styles.prehabRegionBtn,
                  { borderColor: C.primary, backgroundColor: C.primarySurface },
                  pressed && { opacity: 0.8, transform: [{ scale: 0.97 }] },
                ]}
                testID="prehab-fullbody"
              >
                <View style={[styles.prehabRegionIcon, { backgroundColor: C.primaryMuted }]}>
                  <Ionicons name="flash-outline" size={18} color={C.primary} />
                </View>
                <Text style={[styles.prehabRegionLabel, { flex: 1, color: C.primary }]}>Full body circuit</Text>
                <Ionicons name="chevron-forward" size={16} color={C.primary} />
              </Pressable>

              {/* Divider */}
              <View style={styles.prehabDividerRow}>
                <View style={styles.prehabDividerLine} />
                <Text style={styles.prehabDividerText}>or target a specific area</Text>
                <View style={styles.prehabDividerLine} />
              </View>

              {/* Region list — single tap launches session */}
              {PREHAB_REGION_LIST.map(({ region, label, icon }) => (
                <Pressable
                  key={region}
                  onPress={() => handlePrehabRegion(region)}
                  style={({ pressed }) => [
                    styles.prehabRegionBtn,
                    pressed && { opacity: 0.8, transform: [{ scale: 0.97 }] },
                  ]}
                  testID={`prehab-region-${region}`}
                >
                  <View style={[styles.prehabRegionIcon, { backgroundColor: C.surfaceTertiary }]}>
                    <Ionicons name={icon as any} size={18} color={C.textSecondary} />
                  </View>
                  <Text style={[styles.prehabRegionLabel, { flex: 1 }]}>{label}</Text>
                  <Ionicons name="chevron-forward" size={16} color={C.textTertiary} />
                </Pressable>
              ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Conditioning level-selection sheet */}
      <Modal
        visible={activeModal === 'conditioning'}
        transparent
        animationType="slide"
        onRequestClose={closeModal}
      >
        <Pressable style={styles.sheetOverlay} onPress={closeModal}>
          <Pressable style={[styles.sheet, { paddingBottom: insets.bottom + 24 }]} onPress={(e) => e.stopPropagation()}>
            <View style={styles.sheetHandle} />

            <View style={styles.sheetHeader}>
              <View style={[styles.sheetIconWrap, { backgroundColor: C.categoryFinisher }]}>
                <Ionicons name="thunderstorm" size={26} color={C.categoryFinisherText} />
              </View>
              <View style={styles.sheetHeaderText}>
                <Text style={styles.sheetTitle}>Conditioning</Text>
                <Text style={styles.sheetDuration}>HIIT & cardio circuit · choose intensity</Text>
              </View>
              <Pressable
                onPress={closeModal}
                style={styles.closeBtn}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close" size={20} color={C.textSecondary} />
              </Pressable>
            </View>

            <Text style={styles.sheetDesc}>
              Pick your intensity. Your session will be matched to your equipment and the selected level - from a steady aerobic circuit to a high-intensity HIIT blast.
            </Text>

            <View style={styles.levelList}>
              {CONDITIONING_LEVELS.map((level) => (
                <Pressable
                  key={level.key}
                  onPress={() => handleConditioningStart(level)}
                  style={({ pressed }) => [
                    styles.levelBtn,
                    pressed && { opacity: 0.8, transform: [{ scale: 0.98 }] },
                  ]}
                  testID={`flex-conditioning-${level.key}`}
                >
                  <View style={[styles.levelIconWrap, { backgroundColor: level.color + '22' }]}>
                    <Ionicons name={level.icon} size={20} color={level.color} />
                  </View>
                  <View style={styles.levelTextWrap}>
                    <Text style={styles.levelLabel}>{level.label}</Text>
                    <Text style={styles.levelDesc}>{level.description}</Text>
                  </View>
                  <Ionicons name="arrow-forward" size={16} color={level.color} />
                </Pressable>
              ))}
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Equipment override sheet */}
      <Modal
        visible={sheetOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setSheetOpen(false)}
      >
        <Pressable style={styles.sheetBackdrop} onPress={() => setSheetOpen(false)} />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 16, gap: 8 }]}>
          <View style={styles.sheetHandle} />
          <View style={[styles.sheetHeader, { justifyContent: 'space-between', alignItems: 'flex-start', gap: 0, marginBottom: 2 }]}>
            <View>
              <Text style={[styles.sheetTitle, { fontSize: 17 }]}>Equipment today</Text>
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
              <Text style={styles.beginnerNoteText}>Bodyweight & Bands — unlock more in profile</Text>
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
                testID={`flex-sheet-equipment-${tier}`}
              >
                <View style={[styles.tierIcon, { backgroundColor: isActive ? C.primary : isAvailable ? C.primaryMuted : C.surfaceTertiary }]}>
                  <Ionicons
                    name={getEquipmentIcon(tier) as keyof typeof Ionicons.glyphMap}
                    size={16}
                    color={isActive ? C.textInverse : isAvailable ? C.primary : C.textTertiary}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.tierLabel, isActive && { color: C.primary }, !isAvailable && { color: C.textTertiary }]}>
                    {getEquipmentLabel(tier)}
                  </Text>
                  <Text style={styles.tierSub}>{isAvailable ? TIER_DESCRIPTIONS[tier] : 'Unlock in profile'}</Text>
                </View>
                {!isAvailable
                  ? <Ionicons name="lock-closed-outline" size={14} color={C.textTertiary} />
                  : (
                    <View style={[styles.tierCheck, isActive && styles.tierCheckActive]}>
                      {isActive && <Ionicons name="checkmark" size={11} color={C.textInverse} />}
                    </View>
                  )
                }
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
            testID="flex-sheet-equipment-confirm"
          >
            <Ionicons name="checkmark-circle" size={18} color={C.textInverse} />
            <Text style={styles.confirmBtnText}>Use this equipment</Text>
          </Pressable>
        </View>
      </Modal>
    </ScrollView>
  );
}

function makeStyles(C: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: C.background },
    rootContent: { flexGrow: 1 },

    header: {
      paddingHorizontal: 20,
      paddingTop: 16,
    },
    title: { fontSize: 26, fontFamily: 'Inter_700Bold', color: C.text },
    subtitle: { fontSize: 13, fontFamily: 'Inter_500Medium', color: C.textSecondary, marginTop: 2 },

    navGrid: {
      marginHorizontal: 16,
      marginTop: 20,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: C.borderLight,
    },
    navGridInner: {
      borderRadius: 17,
      backgroundColor: C.surface,
    },
    navDivider: { height: 1, backgroundColor: C.borderLight, marginHorizontal: 16 },
    navBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 16,
      minHeight: 82,
      gap: 14,
      backgroundColor: C.surface,
    },
    navBtnFirst: { borderTopLeftRadius: 17, borderTopRightRadius: 17 },
    navBtnLast: { borderBottomLeftRadius: 17, borderBottomRightRadius: 17 },
    navIcon: {
      width: 52,
      height: 52,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    navIconImage: { width: 38, height: 38 },
    navBtnText: { flex: 1 },
    navLabel: { fontSize: 16, fontFamily: 'Inter_600SemiBold', color: C.text },
    navSub: { fontSize: 12, fontFamily: 'Inter_400Regular', color: C.textSecondary, marginTop: 2 },
    navRecency: { fontSize: 11, fontFamily: 'Inter_400Regular', color: C.textTertiary, marginTop: 2 },

    sheetOverlay: {
      flex: 1,
      justifyContent: 'flex-end',
      backgroundColor: 'rgba(0,0,0,0.45)',
    },
    sheet: {
      backgroundColor: C.surface,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      paddingHorizontal: 24,
      paddingTop: 10,
    },
    sheetHandle: {
      width: 36,
      height: 4,
      borderRadius: 2,
      backgroundColor: C.border,
      alignSelf: 'center',
      marginBottom: 20,
    },
    sheetHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      marginBottom: 16,
    },
    sheetIconWrap: {
      width: 52,
      height: 52,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
    },
    sheetIconImage: { width: 38, height: 38 },
    sheetHeaderText: { flex: 1 },
    sheetTitle: { fontSize: 20, fontFamily: 'Inter_700Bold', color: C.text },
    sheetDuration: { fontSize: 13, fontFamily: 'Inter_400Regular', color: C.textSecondary, marginTop: 3 },
    closeBtn: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: C.surfaceTertiary,
      alignItems: 'center',
      justifyContent: 'center',
    },

    sheetDesc: {
      fontSize: 14,
      fontFamily: 'Inter_400Regular',
      color: C.textSecondary,
      lineHeight: 21,
      marginBottom: 24,
    },

    startBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: C.primary,
      borderRadius: 14,
      paddingVertical: 15,
      shadowColor: C.primary,
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.35,
      shadowRadius: 8,
      elevation: 5,
    },
    startBtnText: { fontSize: 16, fontFamily: 'Inter_700Bold', color: C.textInverse },

    levelList: {
      gap: 10,
    },
    levelBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: C.borderLight,
      backgroundColor: C.surfaceSecondary,
      paddingHorizontal: 16,
      paddingVertical: 14,
    },
    levelIconWrap: {
      width: 40,
      height: 40,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    levelTextWrap: { flex: 1 },
    levelLabel: { fontSize: 16, fontFamily: 'Inter_600SemiBold', color: C.text },
    levelDesc: { fontSize: 12, fontFamily: 'Inter_400Regular', color: C.textSecondary, marginTop: 2 },

    prehabSheet: {
      backgroundColor: C.surface,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      paddingTop: 10,
      maxHeight: '90%',
    },
    prehabScroll: {
      paddingHorizontal: 20,
      paddingBottom: 16,
    },
    prehabDividerRow: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      gap: 10,
      marginTop: 16,
      marginBottom: 4,
      width: '100%',
    },
    prehabDividerLine: {
      flex: 1,
      height: 1,
      backgroundColor: C.borderLight,
    },
    prehabDividerText: {
      fontSize: 11,
      fontFamily: 'Inter_400Regular',
      color: C.textTertiary,
    },
    prehabRegionBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: C.borderLight,
      backgroundColor: C.surfaceSecondary,
      paddingHorizontal: 14,
      paddingVertical: 11,
      marginBottom: 6,
    },
    prehabRegionIcon: {
      width: 34,
      height: 34,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
    },
    prehabRegionLabel: {
      fontSize: 15,
      fontFamily: 'Inter_500Medium',
      color: C.text,
    },

    equipmentChipRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginBottom: 12,
    },
    equipmentChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      backgroundColor: C.surfaceSecondary,
      borderRadius: 20,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderWidth: 1,
      borderColor: C.borderLight,
    },
    equipmentChipOverride: {
      backgroundColor: C.primarySurface,
      borderColor: C.primary,
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
    equipmentDismissBtn: {
      width: 26,
      height: 26,
      borderRadius: 13,
      backgroundColor: C.surfaceTertiary,
      alignItems: 'center',
      justifyContent: 'center',
    },

    sheetBackdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.45)',
    },
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
    resetBtnText: {
      fontSize: 12,
      fontFamily: 'Inter_600SemiBold',
      color: C.textSecondary,
    },
    bestMatchRow: {
      backgroundColor: C.primarySurface,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 7,
    },
    bestMatchText: {
      fontSize: 12,
      fontFamily: 'Inter_400Regular',
      color: C.textSecondary,
    },
    beginnerNote: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: C.primarySurface,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 7,
    },
    beginnerNoteText: {
      fontSize: 12,
      fontFamily: 'Inter_400Regular',
      color: C.primary,
      flex: 1,
    },
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
    tierRowActive: {
      borderColor: C.primary,
      backgroundColor: C.primarySurface,
    },
    tierRowLocked: { opacity: 0.45 },
    tierIcon: {
      width: 34,
      height: 34,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
    },
    tierLabel: {
      fontSize: 13,
      fontFamily: 'Inter_600SemiBold',
      color: C.text,
    },
    tierSub: {
      fontSize: 11,
      fontFamily: 'Inter_400Regular',
      color: C.textSecondary,
      marginTop: 1,
    },
    tierCheck: {
      width: 20,
      height: 20,
      borderRadius: 10,
      borderWidth: 1.5,
      borderColor: C.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    tierCheckActive: {
      backgroundColor: C.primary,
      borderColor: C.primary,
    },
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
    confirmBtnText: {
      fontSize: 15,
      fontFamily: 'Inter_700Bold',
      color: C.textInverse,
    },
  });
}
