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
import { EquipmentIcon } from '@/components/EquipmentIcon';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/constants/colors';
import { useAppStore, PainRegion, EquipmentTier, TIER_ORDER } from '@/lib/store';
import { getEffectiveTier, getEquipmentLabel } from '@/lib/workout-engine';
import { daysSince } from '@/lib/utils';
import { BodyDiagram, BODY_DIAGRAM_LABELS } from '@/components/BodyDiagram';

// ── Regions visible on each body diagram face ────────────────────────────────
// Mirrors FRONT_REGION_SLUGS / BACK_REGION_SLUGS in BodyDiagram.tsx.
// Used by contract tests (tests/prehab-regions.check.mjs) to verify that
// every region reachable via the picker has exercises in PREHAB_BY_REGION.
export const REGION_FRONT = new Set<PainRegion>([
  'neck',
  'front_shoulder',
  'chest',
  'bicep',
  'elbow_wrist',
  'core_ribs',
  'hip_groin',
  'quads',
  'knee',
  'calf_shin',
  'ankle_achilles',
  'upper_back',
]);

export const REGION_BACK = new Set<PainRegion>([
  'neck',
  'rear_shoulder',
  'tricep',
  'elbow_wrist',
  'upper_back',
  'lat_mid_back',
  'lower_back',
  'hip_groin',
  'glutes',
  'hamstrings',
  'knee',
  'calf_shin',
  'ankle_achilles',
]);

const RECOVER_IMAGES: Record<string, any> = {
  recovery: require('@/assets/images/sessions/recovery.png'),
  mobility: require('@/assets/images/sessions/mobility.png'),
  prehab: require('@/assets/images/sessions/targeted-prehab.png'),
};

const ALL_TIERS: EquipmentTier[] = ['bodyweight', 'bands', 'dumbbells', 'kettlebells', 'fullgym'];

const TIER_DESCRIPTIONS: Record<EquipmentTier, string> = {
  bodyweight: 'No equipment needed',
  bands: 'Resistance bands only',
  dumbbells: 'Dumbbells available',
  kettlebells: 'Kettlebells available',
  fullgym: 'Everything - cables, machines, full setup',
};

type ModalType = 'recovery' | 'mobility' | 'prehab' | null;

function getFlexRecency(completedSessions: any[], sessionType: 'prehab' | 'flexibility'): string {
  const matches = completedSessions.filter((s) => s.sessionType === sessionType);
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

function getSessionInfo(
  C: ReturnType<typeof useColors>
): Record<Exclude<ModalType, null>, FlexSessionInfo> {
  return {
    recovery: {
      title: 'Recovery',
      icon: 'pulse',
      iconBg: C.categoryCooldown,
      iconColor: C.categoryCooldownText,
      duration: 'Full-body joint circuit · 20-30 min',
      description:
        'A gentle circuit targeting common trouble spots. Perfect after a hard training block or on a rest day. Select a focus area or choose Full Body for a complete joint reset.',
      cta: 'Start Recovery',
      sessionType: 'prehab',
    },
    mobility: {
      title: 'Mobility',
      icon: 'accessibility-outline',
      iconBg: C.categoryCooldown,
      iconColor: C.categoryCooldownText,
      duration: 'Full-body stretch session · 30-40 min',
      description:
        'Long-hold stretches for the full body. Improves range of motion and helps you move and feel better between training days. Best done when your muscles are slightly warm.',
      cta: 'Start Mobility',
      sessionType: 'flexibility',
    },
    prehab: {
      title: 'Targeted Prehab',
      icon: 'locate-outline',
      iconBg: C.categoryPrehab,
      iconColor: C.categoryPrehabText,
      duration: 'Area-focused circuit · 20-30 min',
      description:
        'Select a region that needs attention. The session focuses on protecting and strengthening that specific area to reduce injury risk and improve long-term function.',
      cta: 'Choose Area & Start',
      sessionType: 'prehab',
    },
  };
}

function RegionBodyPicker({
  pending,
  onPendingChange,
  onConfirm,
  onFullBody,
  bottomInset,
  testPrefix,
}: {
  pending: PainRegion | undefined;
  onPendingChange: (r: PainRegion | undefined) => void;
  onConfirm: (region: PainRegion) => void;
  onFullBody: () => void;
  bottomInset: number;
  testPrefix: string;
}) {
  const C = useColors();
  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 8 }}
        keyboardShouldPersistTaps="handled"
      >
        <BodyDiagram selected={pending} onSelect={onPendingChange} />
      </ScrollView>

      {/* Pinned footer — always visible regardless of diagram height */}
      <View
        style={{
          paddingHorizontal: 16,
          paddingTop: 10,
          paddingBottom: bottomInset + 16,
          gap: 10,
        }}
      >
        {pending && (
          <Pressable
            onPress={() => onConfirm(pending)}
            style={({ pressed }) => [
              {
                flexDirection: 'row' as const,
                alignItems: 'center' as const,
                justifyContent: 'center' as const,
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
              pressed && { opacity: 0.88, transform: [{ scale: 0.98 as number }] },
            ]}
            testID={`${testPrefix}-start-region`}
          >
            <Ionicons name="play" size={16} color={C.textInverse} />
            <Text style={{ fontSize: 16, fontFamily: 'Inter_700Bold', color: C.textInverse }}>
              Start {BODY_DIAGRAM_LABELS[pending]}
            </Text>
          </Pressable>
        )}
        <Pressable
          onPress={onFullBody}
          style={({ pressed }) => [
            {
              flexDirection: 'row' as const,
              alignItems: 'center' as const,
              justifyContent: 'center' as const,
              gap: 8,
              backgroundColor: pending ? C.surfaceTertiary : C.primary,
              borderRadius: 14,
              paddingVertical: 15,
              borderWidth: pending ? 1 : 0,
              borderColor: C.borderLight,
              ...(pending
                ? {}
                : {
                    shadowColor: C.primary,
                    shadowOffset: { width: 0, height: 3 },
                    shadowOpacity: 0.35,
                    shadowRadius: 8,
                    elevation: 5,
                  }),
            },
            pressed && { opacity: 0.88, transform: [{ scale: 0.98 as number }] },
          ]}
          testID={`${testPrefix}-fullbody`}
        >
          <Ionicons
            name="flash-outline"
            size={16}
            color={pending ? C.textSecondary : C.textInverse}
          />
          <Text
            style={{
              fontSize: 16,
              fontFamily: 'Inter_700Bold',
              color: pending ? C.textSecondary : C.textInverse,
            }}
          >
            Full body circuit
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

export default function RecoverScreen() {
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
  const availableTiers: EquipmentTier[] = isBeginnerExperience
    ? ['bodyweight', 'bands']
    : ALL_TIERS;
  const profileEquipment: EquipmentTier[] =
    equipmentTiers && equipmentTiers.length > 0 ? equipmentTiers : ['bodyweight'];
  const todayTiers = sessionEquipmentOverride ?? profileEquipment;
  const todayEffectiveTier = getEffectiveTier(todayTiers);
  const isOverrideActive = sessionEquipmentOverride !== null;

  const [activeModal, setActiveModal] = useState<ModalType>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetDraft, setSheetDraft] = useState<EquipmentTier[]>([]);

  const [recoveryPending, setRecoveryPending] = useState<PainRegion | undefined>(undefined);
  const [prehabPending, setPrehabPending] = useState<PainRegion | undefined>(undefined);
  const draftEffectiveTier = getEffectiveTier(sheetDraft.length > 0 ? sheetDraft : ['bodyweight']);

  const prehabRecency = useMemo(
    () => getFlexRecency(completedSessions, 'prehab'),
    [completedSessions]
  );
  const flexRecency = useMemo(
    () => getFlexRecency(completedSessions, 'flexibility'),
    [completedSessions]
  );

  const SESSION_INFO = useMemo(() => getSessionInfo(C), [C]);
  const styles = useMemo(() => makeStyles(C), [C]);

  const openModal = (type: NonNullable<ModalType>) => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setActiveModal(type);
  };

  const closeModal = () => {
    setActiveModal(null);
    setRecoveryPending(undefined);
    setPrehabPending(undefined);
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

  const handleStart = (sessionType: 'prehab' | 'flexibility') => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    closeModal();
    const equipmentOverrideParam = sessionEquipmentOverride
      ? JSON.stringify(sessionEquipmentOverride)
      : undefined;
    router.push({
      pathname: '/readiness',
      params: {
        sessionType,
        isTestWeek: 'false',
        ...(equipmentOverrideParam ? { equipmentOverride: equipmentOverrideParam } : {}),
      },
    });
  };

  const handlePrehabRegion = (region: PainRegion | 'fullbody', displayLabel: string) => {
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
        displayLabel,
      },
    });
  };

  const ROWS: {
    key: NonNullable<ModalType>;
    title: string;
    subtitle: string;
    icon: keyof typeof Ionicons.glyphMap;
    iconBg: string;
    iconColor: string;
    recency: string;
    cardAccent: string;
  }[] = [
    {
      key: 'recovery',
      title: 'Recovery',
      subtitle: 'Full-body joint circuit · 20-30 min',
      icon: 'pulse',
      iconBg: C.categoryCooldown,
      iconColor: C.categoryCooldownText,
      recency: prehabRecency,
      cardAccent: '#0d9488',
    },
    {
      key: 'mobility',
      title: 'Mobility',
      subtitle: 'Full-body stretch session · 30-40 min',
      icon: 'accessibility-outline',
      iconBg: C.categoryCooldown,
      iconColor: C.categoryCooldownText,
      recency: flexRecency,
      cardAccent: '#6366f1',
    },
    {
      key: 'prehab',
      title: 'Targeted Prehab',
      subtitle: 'Area-focused circuit · 20-30 min',
      icon: 'locate-outline',
      iconBg: C.categoryPrehab,
      iconColor: C.categoryPrehabText,
      recency: prehabRecency,
      cardAccent: '#f59e0b',
    },
  ];

  const activeInfo = activeModal === 'mobility' ? SESSION_INFO['mobility'] : null;

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[
        styles.rootContent,
        {
          paddingTop: insets.top + webTopInset,
          paddingBottom: insets.bottom + (Platform.OS === 'web' ? 84 : 50) + 24,
        },
      ]}
      showsVerticalScrollIndicator={false}
    >
      <View style={[styles.header, { paddingBottom: 8 }]}>
        <Text style={styles.title}>Restore</Text>
        <Text style={styles.subtitle}>Choose a session to start</Text>
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
          testID="recover-equipment-chip"
        >
          {isOverrideActive && <View style={styles.overrideDot} />}
          <EquipmentIcon
            tier={todayEffectiveTier}
            size={13}
            color={isOverrideActive ? C.primary : C.textSecondary}
          />
          <Text
            style={[styles.equipmentChipText, isOverrideActive && styles.equipmentChipTextOverride]}
          >
            {isOverrideActive
              ? `Today: ${getEquipmentLabel(todayEffectiveTier)}`
              : getEquipmentLabel(todayEffectiveTier)}
          </Text>
          <Ionicons
            name="chevron-down"
            size={11}
            color={isOverrideActive ? C.primary : C.textTertiary}
          />
        </Pressable>
        {isOverrideActive && (
          <Pressable
            onPress={() => clearSessionEquipmentOverride()}
            style={({ pressed }) => [styles.equipmentDismissBtn, pressed && { opacity: 0.6 }]}
            testID="recover-equipment-dismiss"
          >
            <Ionicons name="close" size={14} color={C.textSecondary} />
          </Pressable>
        )}
      </View>

      {/* Nav card list - fills available height with evenly-spaced independent cards */}
      <View style={styles.navList}>
        {ROWS.map((row) => (
          <Pressable
            key={row.key}
            onPress={() => openModal(row.key)}
            style={({ pressed }) => [
              styles.navBtn,
              { borderColor: row.cardAccent + '55', backgroundColor: row.cardAccent + '0d' },
              pressed && { opacity: 0.8, transform: [{ scale: 0.97 }] },
            ]}
            testID={`recover-row-${row.key}`}
          >
            <View
              style={[
                styles.navIcon,
                { backgroundColor: row.cardAccent + '22', overflow: 'hidden' },
              ]}
            >
              {RECOVER_IMAGES[row.key] ? (
                <Image
                  source={RECOVER_IMAGES[row.key]}
                  style={styles.navIconImage}
                  resizeMode="cover"
                />
              ) : (
                <Ionicons name={row.icon} size={30} color={row.iconColor} />
              )}
            </View>
            <View style={styles.navBtnText}>
              <Text style={[styles.navLabel, { color: row.cardAccent }]}>{row.title}</Text>
              <Text style={styles.navSub}>{row.subtitle}</Text>
              <Text style={styles.navRecency}>{row.recency}</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={row.cardAccent + '88'} />
          </Pressable>
        ))}
      </View>

      {/* Recovery — body diagram region picker */}
      <Modal
        visible={activeModal === 'recovery'}
        transparent
        animationType="slide"
        onRequestClose={closeModal}
      >
        <Pressable style={styles.sheetOverlay} onPress={closeModal}>
          <Pressable style={styles.pickerSheet} onPress={(e) => e.stopPropagation()}>
            <View style={styles.sheetHandle} />

            <View style={[styles.sheetHeader, { paddingHorizontal: 20 }]}>
              <View style={[styles.sheetIconWrap, { backgroundColor: C.categoryCooldown }]}>
                <Ionicons name="pulse" size={26} color={C.categoryCooldownText} />
              </View>
              <View style={styles.sheetHeaderText}>
                <Text style={styles.sheetTitle}>Recovery</Text>
                <Text style={styles.sheetDuration}>Full-body joint circuit · 20-30 min</Text>
              </View>
              <Pressable
                onPress={closeModal}
                style={styles.closeBtn}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close" size={20} color={C.textSecondary} />
              </Pressable>
            </View>

            <RegionBodyPicker
              pending={recoveryPending}
              onPendingChange={setRecoveryPending}
              onConfirm={(region) => handlePrehabRegion(region, 'Recovery')}
              onFullBody={() => handlePrehabRegion('fullbody', 'Recovery')}
              bottomInset={insets.bottom}
              testPrefix="recovery"
            />
          </Pressable>
        </Pressable>
      </Modal>

      {/* Mobility sheet */}
      <Modal
        visible={activeModal === 'mobility'}
        transparent
        animationType="slide"
        onRequestClose={closeModal}
      >
        <Pressable style={styles.sheetOverlay} onPress={closeModal}>
          <Pressable
            style={[styles.sheet, { paddingBottom: insets.bottom + 24 }]}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.sheetHandle} />

            {activeInfo && (
              <>
                <View style={styles.sheetHeader}>
                  <View style={[styles.sheetIconWrap, { backgroundColor: activeInfo.iconBg }]}>
                    <Image
                      source={RECOVER_IMAGES['mobility']}
                      style={styles.sheetIconImage}
                      resizeMode="contain"
                    />
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
                  testID="recover-start-mobility"
                >
                  <Ionicons name="play" size={18} color={C.textInverse} />
                  <Text style={styles.startBtnText}>{activeInfo.cta}</Text>
                </Pressable>
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>

      {/* Targeted Prehab — body diagram region picker */}
      <Modal
        visible={activeModal === 'prehab'}
        transparent
        animationType="slide"
        onRequestClose={closeModal}
      >
        <Pressable style={styles.sheetOverlay} onPress={closeModal}>
          <Pressable style={styles.pickerSheet} onPress={(e) => e.stopPropagation()}>
            <View style={styles.sheetHandle} />

            <View style={[styles.sheetHeader, { paddingHorizontal: 20 }]}>
              <View style={[styles.sheetIconWrap, { backgroundColor: C.categoryPrehab }]}>
                <Ionicons name="locate-outline" size={26} color={C.categoryPrehabText} />
              </View>
              <View style={styles.sheetHeaderText}>
                <Text style={styles.sheetTitle}>Targeted Prehab</Text>
                <Text style={styles.sheetDuration}>Area-focused circuit · 20-30 min</Text>
              </View>
              <Pressable
                onPress={closeModal}
                style={styles.closeBtn}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close" size={20} color={C.textSecondary} />
              </Pressable>
            </View>

            <RegionBodyPicker
              pending={prehabPending}
              onPendingChange={setPrehabPending}
              onConfirm={(region) => handlePrehabRegion(region, 'Targeted Prehab')}
              onFullBody={() => handlePrehabRegion('fullbody', 'Targeted Prehab')}
              bottomInset={insets.bottom}
              testPrefix="prehab"
            />
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
          <View
            style={[
              styles.sheetHeader,
              {
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                gap: 0,
                marginBottom: 2,
              },
            ]}
          >
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
                testID={`recover-sheet-equipment-${tier}`}
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
            testID="recover-sheet-equipment-confirm"
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

    navList: {
      flex: 1,
      paddingHorizontal: 16,
      paddingTop: 16,
      paddingBottom: 8,
      gap: 12,
    },
    navBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingVertical: 20,
      gap: 16,
      backgroundColor: C.surface,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: C.borderLight,
    },
    navIcon: {
      width: 72,
      height: 72,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    navIconImage: { width: '100%' as any, height: '100%' as any },
    navBtnText: { flex: 1 },
    navLabel: { fontSize: 16, fontFamily: 'Inter_600SemiBold', color: C.text },
    navSub: { fontSize: 12, fontFamily: 'Inter_400Regular', color: C.textSecondary, marginTop: 2 },
    navRecency: {
      fontSize: 11,
      fontFamily: 'Inter_400Regular',
      color: C.textTertiary,
      marginTop: 2,
    },

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
    sheetDuration: {
      fontSize: 12,
      fontFamily: 'Inter_400Regular',
      color: C.textSecondary,
      marginTop: 3,
    },
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

    pickerSheet: {
      backgroundColor: C.surface,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      paddingTop: 10,
      height: '78%',
    },

    equipmentChipRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginBottom: 12,
      paddingHorizontal: 20,
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
