import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { useScrollToTopRegister } from '@/lib/scroll-to-top-context';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Modal,
  Platform,
  ScrollView,
  Image,
  PanResponder,
  useWindowDimensions,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { EquipmentIcon } from '@/components/EquipmentIcon';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/constants/colors';
import { glowShadow } from '@/constants/shadows';
import { useAppStore, PainRegion, EquipmentTier, TIER_ORDER } from '@/lib/store';
import { getRecoverImage } from '@/lib/session-images';
import { getEffectiveTier, getEquipmentLabel } from '@/lib/workout-engine';
import { daysSince } from '@/lib/utils';
import { BodyDiagram, BODY_DIAGRAM_LABELS } from '@/components/BodyDiagram';
import CoachMark, { SpotlightRect } from '@/components/CoachMark';
import { entryStepFor, tourBackTarget } from '@/lib/tour-chain';
import { ScrollIndicator, useScrollIndicator } from '@/components/ScrollIndicator';

interface RestoreTutorialStep {
  spotlightRef: 'recovery' | 'mobility' | 'prehab';
  iconName: string;
  iconLabel: string;
  title: string;
  body: string;
}

const RESTORE_TUTORIAL: readonly RestoreTutorialStep[] = [
  {
    spotlightRef: 'recovery',
    iconName: 'pulse-outline',
    iconLabel: 'Recovery',
    title: 'A gentle full-body reset',
    body: 'A joint circuit for the days you want to move without pushing hard, good after a heavy week.',
  },
  {
    spotlightRef: 'mobility',
    iconName: 'accessibility-outline',
    iconLabel: 'Mobility',
    title: 'Stay loose, stay mobile',
    body: 'A full-body stretch session that keeps your range of motion sharp between training days.',
  },
  {
    spotlightRef: 'prehab',
    iconName: 'locate-outline',
    iconLabel: 'Prehab',
    title: 'Target a sore area',
    // Rewritten when the acute protocols landed. The old copy promised "a
    // focused circuit", which was true of what it used to build and is the
    // wrong expectation to set now: naming a sore area gets gentle isometric
    // and short-range work with a pain limit attached, and deliberately no
    // stretching of the injured tissue. Someone expecting a circuit and given
    // five holds will think it is broken unless the tour says so first.
    body: 'Name the area that hurts and you get gentle, low-load work built for it. Nothing that stretches or loads a sore muscle hard, and a pain limit to stay inside.',
  },
] as const;

// ── Regions visible on each body diagram face ────────────────────────────────
// Mirrors FRONT_REGION_SLUGS / BACK_REGION_SLUGS in BodyDiagram.tsx.
// Used by contract tests (tests/prehab-regions.check.mjs) to verify that
// every region reachable via the picker has exercises in PREHAB_BY_REGION.
export const REGION_FRONT = new Set<PainRegion>([
  'neck',
  'front_shoulder',
  'chest',
  'bicep',
  'elbow',
  'wrist',
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
  'elbow',
  'wrist',
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
      // Says what the session actually is now. It used to promise "protecting
      // and strengthening ... to reduce injury risk", which is prevention — and
      // then hand someone with a strained hamstring six ways to stretch it.
      // Picking an area now builds the low-load, pain-free protocol for that
      // area instead, so the card has to say so before they pick.
      description:
        'Pick the area that is sore. You get gentle, low-load work for it: holds and short controlled movements, nothing that stretches or strains the spot that hurts. Stay inside a pain-free range throughout.',
      cta: 'Choose Area & Start',
      sessionType: 'prehab',
    },
  };
}

// Fixed vertical chrome around the diagram inside the picker sheet: handle +
// header + BodyDiagram's own toggle rows/panel padding/label row + footer.
// Used to size the diagram so the whole body is visible without scrolling on
// as wide a range of device heights as practical, instead of the diagram
// always claiming a fixed size regardless of how much room is actually left.
const PICKER_SHEET_HEIGHT_PCT = 0.9;
const CHROME_HANDLE = 24;
const CHROME_HEADER = 68;
const CHROME_TOGGLE_ROWS = 76;
const CHROME_PANEL_PADDING = 60;
const CHROME_LABEL_ROW = 44;
const CHROME_FOOTER = 100;
const SHEET_CHROME_H =
  CHROME_HANDLE + CHROME_HEADER + CHROME_TOGGLE_ROWS + CHROME_PANEL_PADDING + CHROME_LABEL_ROW + CHROME_FOOTER;
const MIN_DIAGRAM_WIDTH = 150; // floor so regions like wrist/ankle stay easy to tap
const DEFAULT_DIAGRAM_WIDTH = 200; // BodyDiagram's own default maxWidth

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
  onConfirm: (region: PainRegion, acute: boolean) => void;
  onFullBody: () => void;
  bottomInset: number;
  testPrefix: string;
}) {
  const C = useColors();
  const { height: windowHeight } = useWindowDimensions();
  /**
   * Is this area sore today, or is it the area you are looking after?
   *
   * The two answers build genuinely different sessions — gentle isometric work
   * that never lengthens the tissue, or the fuller mobility-led circuit that
   * rotates across six weeks — and there is no way to tell them apart from the
   * region alone. Inferring it was the first attempt and it stranded anyone in a
   * long rehab block on the acute protocol forever.
   *
   * Defaults to sore. The two ways to be wrong are not equal: too gentle costs a
   * session, too much costs weeks.
   */
  const [sore, setSore] = useState(true);
  const diagramBudget = windowHeight * PICKER_SHEET_HEIGHT_PCT - SHEET_CHROME_H - bottomInset;
  const diagramMaxWidth = Math.max(
    MIN_DIAGRAM_WIDTH,
    Math.min(DEFAULT_DIAGRAM_WIDTH, Math.round(diagramBudget / 2.4))
  );

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 8 }}
        keyboardShouldPersistTaps="handled"
      >
        <BodyDiagram selected={pending} onSelect={onPendingChange} maxWidth={diagramMaxWidth} />
      </ScrollView>

      {/* Pinned footer — always visible regardless of diagram height */}
      <View
        style={{
          paddingHorizontal: 16,
          paddingTop: 10,
          paddingBottom: bottomInset + 16,
          gap: 4,
        }}
      >
        {/* How does it feel today? Only asked once a region is chosen — it is
            meaningless for the full-body circuit, and asking before the user has
            said where would be asking about nothing. */}
        {pending && (
          <View style={{ marginBottom: 10 }}>
            <Text
              style={{
                fontSize: 12,
                fontFamily: 'Inter_600SemiBold',
                color: C.textSecondary,
                marginBottom: 6,
                textAlign: 'center',
              }}
            >
              How does your {BODY_DIAGRAM_LABELS[pending].toLowerCase()} feel today?
            </Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {(
                [
                  { key: true, label: 'Sore or injured', hint: 'Gentle, low-load work' },
                  { key: false, label: 'Feels fine', hint: 'Full mobility circuit' },
                ] as const
              ).map((opt) => {
                const active = sore === opt.key;
                return (
                  <Pressable
                    key={String(opt.key)}
                    onPress={() => setSore(opt.key)}
                    testID={`${testPrefix}-sore-${opt.key ? 'yes' : 'no'}`}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: active }}
                    style={({ pressed }) => [
                      {
                        flex: 1,
                        alignItems: 'center' as const,
                        paddingVertical: 9,
                        paddingHorizontal: 8,
                        borderRadius: 12,
                        borderWidth: 1.5,
                        borderColor: active ? C.primary : C.border,
                        backgroundColor: active ? C.primary + '1a' : 'transparent',
                      },
                      pressed && { opacity: 0.7 },
                    ]}
                  >
                    <Text
                      style={{
                        fontSize: 13,
                        fontFamily: 'Inter_600SemiBold',
                        color: active ? C.primaryText : C.text,
                      }}
                    >
                      {opt.label}
                    </Text>
                    <Text
                      style={{
                        fontSize: 11,
                        fontFamily: 'Inter_400Regular',
                        color: C.textSecondary,
                        marginTop: 1,
                      }}
                    >
                      {opt.hint}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        )}

        <Pressable
          onPress={() => (pending ? onConfirm(pending, sore) : onFullBody())}
          style={({ pressed }) => [
            {
              flexDirection: 'row' as const,
              alignItems: 'center' as const,
              justifyContent: 'center' as const,
              gap: 8,
              backgroundColor: C.primary,
              borderRadius: 14,
              paddingVertical: 15,
              ...glowShadow(C.primary),
            },
            pressed && { opacity: 0.88, transform: [{ scale: 0.98 as number }] },
          ]}
          testID={pending ? `${testPrefix}-start-region` : `${testPrefix}-fullbody`}
        >
          <Ionicons name={pending ? 'play' : 'flash-outline'} size={16} color={C.textInverse} />
          <Text style={{ fontSize: 16, fontFamily: 'Inter_700Bold', color: C.textInverse }}>
            {pending ? `Start ${BODY_DIAGRAM_LABELS[pending]}` : 'Full body circuit'}
          </Text>
        </Pressable>
        {pending && (
          <Pressable
            onPress={onFullBody}
            hitSlop={8}
            style={({ pressed }) => [
              { alignItems: 'center' as const, paddingVertical: 8 },
              pressed && { opacity: 0.6 },
            ]}
            testID={`${testPrefix}-fullbody`}
          >
            <Text style={{ fontSize: 13, fontFamily: 'Inter_600SemiBold', color: C.textSecondary }}>
              or do a full body circuit instead
            </Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

function useDismissGesture(onDismiss: () => void) {
  const onDismissRef = useRef(onDismiss);
  onDismissRef.current = onDismiss;
  return useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gs) => gs.dy > 10 && Math.abs(gs.dy) > Math.abs(gs.dx),
      onPanResponderRelease: (_, gs) => {
        if (gs.dy > 60) onDismissRef.current();
      },
    })
  ).current;
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
    tourActiveTab,
    setTourActiveTab,
    tourEnterAtLastStep,
    setTourEnterAtLastStep,
    skipTour,
  } = useAppStore();
  const webTopInset = Platform.OS === 'web' ? 67 : 0;
  const webBottomInset = Platform.OS === 'web' ? 84 : 0;

  const isBeginnerExperience = userProfile?.experienceLevel === 'beginner';
  const availableTiers: EquipmentTier[] = isBeginnerExperience
    ? ['bodyweight', 'bands']
    : TIER_ORDER;
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
  const recoveryRecency = useMemo(() => {
    const matches = completedSessions.filter((s) => s.sessionType === 'prehab' && !s.displayLabel);
    if (matches.length === 0) return 'Not tried yet';
    const days = daysSince(matches[0].date);
    if (days === 0) return 'Done today';
    if (days === 1) return 'Last done yesterday';
    return `Last done ${days} days ago`;
  }, [completedSessions]);
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

  const recoveryDismiss = useDismissGesture(closeModal);
  const mobilityDismiss = useDismissGesture(closeModal);
  const prehabDismiss = useDismissGesture(closeModal);

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

  const handlePrehabRegion = (
    region: PainRegion | 'fullbody',
    displayLabel: string,
    acute = true
  ) => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    closeModal();
    router.push({
      pathname: '/session',
      params: {
        sessionType: 'prehab',
        hasAches: 'false',
        painRegion: region !== 'fullbody' ? region : '',
        // Only meaningful with a region; the full-body circuit is unchanged.
        ...(region !== 'fullbody' ? { acute: String(acute) } : {}),
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
    /** Split out of the subtitle so a long description cannot break the
     *  duration across two lines — "20-30 / min" was the reported look. */
    duration: string;
    icon: keyof typeof Ionicons.glyphMap;
    iconBg: string;
    iconColor: string;
    recency: string;
    cardAccent: string;
  }[] = [
    {
      key: 'recovery',
      title: 'Recovery',
      subtitle: 'Full-body joint circuit',
      duration: '20-30 min',
      icon: 'pulse',
      iconBg: C.categoryCooldown,
      iconColor: C.categoryCooldownText,
      recency: recoveryRecency,
      cardAccent: C.cardAccentRecovery,
    },
    {
      key: 'mobility',
      title: 'Mobility',
      subtitle: 'Full-body stretch session',
      duration: '30-40 min',
      icon: 'accessibility-outline',
      iconBg: C.categoryCooldown,
      iconColor: C.categoryCooldownText,
      recency: flexRecency,
      cardAccent: C.cardAccentMobility,
    },
    {
      key: 'prehab',
      title: 'Targeted Prehab',
      subtitle: 'Area-focused circuit',
      duration: '20-30 min',
      icon: 'locate-outline',
      iconBg: C.categoryPrehab,
      iconColor: C.categoryPrehabText,
      recency: prehabRecency,
      cardAccent: C.cardAccentPrehab,
    },
  ];

  const activeInfo = activeModal === 'mobility' ? SESSION_INFO['mobility'] : null;

  const scrollRef = useRef<ScrollView>(null);
  const scrollHint = useScrollIndicator();
  useScrollToTopRegister(
    'recover',
    useCallback(() => {
      scrollRef.current?.scrollTo({ x: 0, y: 0, animated: true });
    }, [])
  );

  // ── Guided tour: Restore's own in-page tutorial ──────────────────────────
  // Runs when the shared tour reaches this tab (index 3). This is the tour's
  // last screen-content step - hands off to Stats on its last step; skip
  // abandons the whole tour, not just Restore.
  const [tutStep, setTutStep] = useState<number | null>(null);
  const navRefs = useRef<Record<string, View | null>>({});
  const [tutSpotlight, setTutSpotlight] = useState<SpotlightRect | null>(null);

  useEffect(() => {
    if (tourActiveTab === 3) {
      // entryStepFor is what makes Back across a tab boundary land on the card
      // the user was reading rather than on this tab's first one. The flag is
      // consumed here so a later forward arrival opens at the start again.
      const at = entryStepFor(tourEnterAtLastStep, RESTORE_TUTORIAL.length);
      const t = setTimeout(() => {
        setTutStep(at);
        if (tourEnterAtLastStep) setTourEnterAtLastStep(false);
      }, 300);
      return () => clearTimeout(t);
    }
    setTutStep(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tourActiveTab]);

  useEffect(() => {
    setTutSpotlight(null);
    if (tutStep === null) return;
    const key = RESTORE_TUTORIAL[tutStep].spotlightRef;
    scrollRef.current?.scrollTo({ y: 0, animated: true });
    const timer = setTimeout(() => {
      navRefs.current[key]?.measureInWindow((x, y, w, h) => {
        if (w > 0 && h > 0) {
          setTutSpotlight({ top: y - 6, left: x - 6, width: w + 12, height: h + 12 });
        }
      });
    }, 420);
    return () => clearTimeout(timer);
  }, [tutStep]);

  const advanceRestoreTut = useCallback(() => {
    setTutStep((prev) => {
      if (prev === null) return null;
      const next = prev + 1;
      if (next >= RESTORE_TUTORIAL.length) {
        setTourActiveTab(4); // hand off to Stats
        return null;
      }
      return next;
    });
  }, [setTourActiveTab]);

  /**
   * Back one card, or to the last card of the previous tab.
   *
   * tourBackTarget is what decides which, and it knows the tour's real order -
   * Home, Train, Restore, Stats, Profile - rather than assuming tab minus one,
   * which is wrong for every tab in the chain. A null target means this is the
   * first card of the whole tour and CoachMark is not given an onPrev at all,
   * so no control renders.
   */
  const backRestoreTut = useCallback(() => {
    const target = tourBackTarget(3, tutStep);
    if (target === null) return;
    if (target.kind === 'step') {
      setTutStep(target.step);
      return;
    }
    setTutStep(null);
    setTourEnterAtLastStep(true);
    setTourActiveTab(target.tab);
  }, [tutStep, setTourActiveTab, setTourEnterAtLastStep]);

  const skipRestoreTut = useCallback(() => {
    setTutStep(null);
    skipTour();
  }, [skipTour]);

  return (
    <View style={{ flex: 1 }}>
    <ScrollView
      ref={scrollRef}
      style={styles.root}
      contentContainerStyle={[
        styles.rootContent,
        {
          paddingTop: insets.top + webTopInset,
          paddingBottom: insets.bottom + (Platform.OS === 'web' ? 84 : 50) + 24,
        },
      ]}
      showsVerticalScrollIndicator={false}
      {...scrollHint.handlers}
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
            color={isOverrideActive ? C.primaryText : C.textSecondary}
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
            color={isOverrideActive ? C.primaryText : C.textTertiary}
          />
        </Pressable>
        {isOverrideActive && (
          <Pressable
            onPress={() => clearSessionEquipmentOverride()}
            style={({ pressed }) => [styles.equipmentDismissBtn, pressed && { opacity: 0.6 }]}
            testID="recover-equipment-dismiss"
            accessibilityLabel="Clear equipment override"
            accessibilityRole="button"
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
            ref={(el) => {
              navRefs.current[row.key] = el as unknown as View | null;
            }}
            onPress={() => openModal(row.key)}
            style={({ pressed }) => [
              styles.navBtn,
              // 0d (5%) was a wash you had to look for. 1c (11%) reads as a
              // coloured card while staying well clear of the text on it — the
              // labels are the accent at full strength and were already
              // measured against this family.
              { borderColor: row.cardAccent + '66', backgroundColor: row.cardAccent + '1c' },
              pressed && { opacity: 0.8, transform: [{ scale: 0.97 }] },
            ]}
            testID={`recover-row-${row.key}`}
          >
            <View style={styles.navIcon}>
              {getRecoverImage(row.key, userProfile?.sex) ? (
                <Image
                  source={getRecoverImage(row.key, userProfile?.sex)}
                  style={styles.navIconImage}
                  resizeMode="contain"
                />
              ) : (
                <Ionicons name={row.icon} size={30} color={row.iconColor} />
              )}
            </View>
            <View style={styles.navBtnText}>
              <Text style={[styles.navLabel, { color: row.cardAccent }]}>{row.title}</Text>
              <Text style={styles.navSub}>{row.subtitle}</Text>
              {/* Duration and recency on one quiet line. Both are facts you
                  glance at rather than read, and keeping the duration out of
                  the description above is what stops "20-30 min" splitting
                  across two lines now the artwork takes more of the row. */}
              <Text style={styles.navRecency}>
                {row.duration} · {row.recency}
              </Text>
            </View>
            {/* Full strength, not the 53% the fill and border use: this arrow is
                the only thing on the card that says "this opens something", so
                it is a meaningful icon and owes 3:1 against the tint it sits on.
                At 53% every row's arrow measured under 2:1. */}
            <Ionicons name="chevron-forward" size={16} color={row.cardAccent} />
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
          <Pressable
            style={styles.pickerSheet}
            onPress={(e) => e.stopPropagation()}
            {...recoveryDismiss.panHandlers}
          >
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
                accessibilityLabel="Close"
                accessibilityRole="button"
              >
                <Ionicons name="close" size={20} color={C.textSecondary} />
              </Pressable>
            </View>

            <RegionBodyPicker
              pending={recoveryPending}
              onPendingChange={setRecoveryPending}
              onConfirm={(region, acute) => handlePrehabRegion(region, 'Recovery', acute)}
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
            {...mobilityDismiss.panHandlers}
          >
            <View style={styles.sheetHandle} />

            {activeInfo && (
              <>
                <View style={styles.sheetHeader}>
                  <View style={[styles.sheetIconWrap, { backgroundColor: activeInfo.iconBg }]}>
                    <Image
                      source={getRecoverImage('mobility', userProfile?.sex)}
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
          <Pressable
            style={styles.pickerSheet}
            onPress={(e) => e.stopPropagation()}
            {...prehabDismiss.panHandlers}
          >
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
                accessibilityLabel="Close"
                accessibilityRole="button"
              >
                <Ionicons name="close" size={20} color={C.textSecondary} />
              </Pressable>
            </View>

            <RegionBodyPicker
              pending={prehabPending}
              onPendingChange={setPrehabPending}
              onConfirm={(region, acute) => handlePrehabRegion(region, 'Targeted Prehab', acute)}
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
                <Text style={{ fontFamily: 'Inter_600SemiBold', color: C.primaryText }}>
                  {getEquipmentLabel(draftEffectiveTier)}
                </Text>
              </Text>
            </View>
          )}

          {isBeginnerExperience && (
            <View style={styles.beginnerNote}>
              <Ionicons name="shield-checkmark-outline" size={13} color={C.primaryText} />
              <Text style={styles.beginnerNoteText}>
                Bodyweight & Bands - unlock more in profile
              </Text>
            </View>
          )}

          {TIER_ORDER.map((tier) => {
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
                    color={isActive ? C.textInverse : isAvailable ? C.primaryText : C.textTertiary}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text
                    style={[
                      styles.tierLabel,
                      isActive && { color: C.primaryText },
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
    {/* Prehab sits below the fold on a short screen, and it is the one people
        arrive at this tab looking for. */}
    <ScrollIndicator {...scrollHint.state} top={8} bottom={92} />

    {tutStep !== null && (
      <CoachMark
        visible
        title={RESTORE_TUTORIAL[tutStep].title}
        body={RESTORE_TUTORIAL[tutStep].body}
        step={tutStep + 1}
        total={RESTORE_TUTORIAL.length}
        onNext={advanceRestoreTut}
        onSkip={skipRestoreTut}
        onPrev={tourBackTarget(3, tutStep) ? backRestoreTut : undefined}
        bottomOffset={insets.bottom + (Platform.OS === 'web' ? 84 : 50) + 16}
        iconName={RESTORE_TUTORIAL[tutStep].iconName}
        iconLabel={RESTORE_TUTORIAL[tutStep].iconLabel}
        spotlightRect={tutSpotlight ?? undefined}
      />
    )}
    </View>
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
    /**
     * THE ARTWORK IS THE CARD, not a bullet point beside it.
     *
     * Reported as "the images are too small and the boxes are such a dull
     * colour all too similar to each other". Both were true. At 90pt square the
     * figure sat in the corner of a card twice its height, so most of every row
     * was empty tinted space.
     *
     * Sized as a share of the ROW in both directions, not by a fixed box and
     * not by an aspect ratio. An aspect ratio was the first attempt and it only
     * suits one of the three: Recovery's foam-roll figure is landscape (600x359)
     * while Targeted Prehab's is a standing figure (272x600). One ratio makes
     * two of them small. Giving the box the full height and a share of the width
     * lets resizeMode="contain" fit each artwork to whichever edge binds, so all
     * three end up as large as their own shape allows.
     *
     * Still no scrolling: the rows are flex: 1 and divide the space they get, so
     * this scales with the phone instead of assuming one.
     */
    navIcon: {
      width: '37%' as any,
      height: '94%' as any,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    navIconImage: { width: '100%' as any, height: '100%' as any },
    navBtnText: { flex: 1 },
    // The title carries the card. At 16 it was the same weight as the body copy
    // under it and the row read as three lines of text with a picture; at 20/700
    // there is a clear first thing to look at.
    navLabel: { fontSize: 20, fontFamily: 'Inter_700Bold', color: C.text, letterSpacing: -0.3 },
    navSub: { fontSize: 13, fontFamily: 'Inter_400Regular', color: C.textSecondary, marginTop: 3 },
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
      ...glowShadow(C.primary),
    },
    startBtnText: { fontSize: 16, fontFamily: 'Inter_700Bold', color: C.textInverse },

    pickerSheet: {
      backgroundColor: C.surface,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      paddingTop: 10,
      // Kept in sync with PICKER_SHEET_HEIGHT_PCT, which RegionBodyPicker uses
      // to size the body diagram to fit this sheet without scrolling.
      height: `${PICKER_SHEET_HEIGHT_PCT * 100}%`,
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
      color: C.primaryText,
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
      color: C.primaryText,
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
