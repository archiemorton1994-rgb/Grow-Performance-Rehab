import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { useScrollToTopRegister } from '@/lib/scroll-to-top-context';
import {
  View,
  Text,
  Pressable,
  ScrollView,
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
import { GlossaryTerm } from '@/components/GlossaryTerm';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useColors } from '@/constants/colors';
import { EquipmentTier, SessionType, TIER_ORDER, useAppStore } from '@/lib/store';
import { resumeParams } from '@/lib/resume-params';
import { getSessionImage } from '@/lib/session-images';
import { getEquipmentLabel, getEffectiveTier } from '@/lib/workout-engine';
import { SESSION_META } from '@/lib/session-meta';
import CoachMark, { SpotlightRect } from '@/components/CoachMark';
import { entryStepFor, tourBackTarget } from '@/lib/tour-chain';
import { ScrollIndicator, useScrollIndicator } from '@/components/ScrollIndicator';

interface TrainTutorialStep {
  spotlightRef: 'equipment' | 'kpi' | 'custom';
  iconName: string;
  iconLabel: string;
  title: string;
  body: string;
}

const TRAIN_TUTORIAL: readonly TrainTutorialStep[] = [
  {
    spotlightRef: 'equipment',
    iconName: 'barbell-outline',
    iconLabel: 'Equipment',
    title: 'Your equipment for today',
    body: "Tap here to change what's available just for this session, it won't touch your saved profile equipment.",
  },
  {
    spotlightRef: 'kpi',
    iconName: 'flash-outline',
    iconLabel: 'KPI',
    title: 'Your strength foundation',
    // Absorbed the old "Every other way to train" step. That one spotlighted a
    // section headed ADDITIONAL SESSIONS containing four cards named Lower
    // Body, Upper Body, Full Body and Conditioning, to say they were four ways
    // to train — a card spent telling the user what they were already reading.
    body: 'Squat, Bench and Deadlift drive your 1RM and everything else is measured against them. Below, Lower, Upper, Full Body and Conditioning cover the rest of the week.',
  },
  {
    // Same region as the step above — Custom sits in that grid — but it is a
    // different idea and was going unexplained. The builder is the only place
    // in the app that asks how long you have got, and a user who never opens it
    // never finds that out.
    spotlightRef: 'custom',
    iconName: 'construct-outline',
    iconLabel: 'Custom',
    title: 'Or build your own',
    body: 'Custom asks what you are training for and how long you have (30, 45 or 60 minutes), then builds to fit. Your warm-up, mobility, activation and main lift are always kept.',
  },
] as const;

const KPI_SESSION_TYPES: SessionType[] = ['squat', 'bench', 'deadlift', 'custom'];

const WEEKLY_SESSION_TYPES_UI: SessionType[] = [
  'lower_body',
  'upper_body',
  'full_body',
  'conditioning',
];

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
    tourActiveTab,
    setTourActiveTab,
    tourEnterAtLastStep,
    setTourEnterAtLastStep,
    skipTour,
  } = useAppStore();

  const prevSessionCount = useRef(completedSessions.length);
  useEffect(() => {
    if (completedSessions.length > prevSessionCount.current) {
      clearSessionEquipmentOverride();
    }
    prevSessionCount.current = completedSessions.length;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [completedSessions.length]);

  const scrollRef = useRef<ScrollView>(null);
  useScrollToTopRegister(
    'train',
    useCallback(() => {
      scrollRef.current?.scrollTo({ x: 0, y: 0, animated: true });
    }, [])
  );

  // ── Guided tour: Train's own in-page tutorial ────────────────────────────
  // Runs when the shared tour reaches this tab (index 2). Hands off to
  // Restore on its last step; skip abandons the whole tour, not just Train.
  const [tutStep, setTutStep] = useState<number | null>(null);
  const equipmentRef = useRef<View>(null);
  const kpiRef = useRef<View>(null);
  const additionalRef = useRef<View>(null);
  const [tutSpotlight, setTutSpotlight] = useState<SpotlightRect | null>(null);
  // Each section's distance from the top of the ScrollView's content, captured
  // via onLayout as they render. Lets the tutorial scroll a section into view
  // before measuring it — "Additional Sessions" sits below the fold on most
  // screens, so without this the tutorial would spotlight whatever happened
  // to already be on screen instead of actually scrolling to it.
  // Custom is a card INSIDE the kpi section, not a section of its own, so it
  // scrolls to the same place and only differs in what gets measured.
  const customRef = useRef<View>(null);
  const sectionScrollY = useRef<{ equipment: number; kpi: number; additional: number }>({
    equipment: 0,
    kpi: 0,
    additional: 0,
  });
  const SCROLL_TOP_PADDING = 90;
  const scrollHint = useScrollIndicator();

  useEffect(() => {
    if (tourActiveTab === 2) {
      // entryStepFor is what makes Back across a tab boundary land on the card
      // the user was reading rather than on this tab's first one. The flag is
      // consumed here so a later forward arrival opens at the start again.
      const at = entryStepFor(tourEnterAtLastStep, TRAIN_TUTORIAL.length);
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
    const refLookup = {
      equipment: equipmentRef,
      kpi: kpiRef,
      additional: additionalRef,
      custom: customRef,
    };
    const stepKey = TRAIN_TUTORIAL[tutStep].spotlightRef;
    const target = refLookup[stepKey];
    // sectionScrollY holds onLayout offsets for the three top-level SECTIONS.
    // Custom is a card within the kpi section and has no offset of its own -
    // asking for one would read undefined and scroll to NaN.
    const scrollKey = stepKey === 'custom' ? 'kpi' : stepKey;
    scrollRef.current?.scrollTo({
      y: Math.max(0, sectionScrollY.current[scrollKey] - SCROLL_TOP_PADDING),
      animated: true,
    });
    const timer = setTimeout(() => {
      target?.current?.measureInWindow((x, y, w, h) => {
        if (w > 0 && h > 0) {
          setTutSpotlight({ top: y - 6, left: x - 6, width: w + 12, height: h + 12 });
        }
      });
      // Long enough for the scrollTo animation above to actually settle —
      // measuring mid-scroll would capture a transient, wrong position.
    }, 420);
    return () => clearTimeout(timer);
  }, [tutStep]);

  const advanceTrainTut = useCallback(() => {
    setTutStep((prev) => {
      if (prev === null) return null;
      const next = prev + 1;
      if (next >= TRAIN_TUTORIAL.length) {
        setTourActiveTab(3); // hand off to Restore
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
  const backTrainTut = useCallback(() => {
    const target = tourBackTarget(2, tutStep);
    if (target === null) return;
    if (target.kind === 'step') {
      setTutStep(target.step);
      return;
    }
    setTutStep(null);
    setTourEnterAtLastStep(true);
    setTourActiveTab(target.tab);
  }, [tutStep, setTourActiveTab, setTourEnterAtLastStep]);

  const skipTrainTut = useCallback(() => {
    setTutStep(null);
    skipTour();
  }, [skipTour]);

  const isBeginnerExperience = userProfile?.experienceLevel === 'beginner';
  const availableTiers: EquipmentTier[] = isBeginnerExperience
    ? ['bodyweight', 'bands']
    : TIER_ORDER;

  const profileEquipment: EquipmentTier[] =
    equipmentTiers && equipmentTiers.length > 0 ? equipmentTiers : ['bodyweight'];

  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetDraft, setSheetDraft] = useState<EquipmentTier[]>([]);

  const todayTiers = sessionEquipmentOverride ?? profileEquipment;
  const todayEffectiveTier = getEffectiveTier(todayTiers);
  const hasFullGym = profileEquipment.includes('fullgym');

  const webTopInset = Platform.OS === 'web' ? 67 : 0;
  const testWeek = isTestWeekDue();

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
      params: resumeParams(activeSession),
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

  const compactCards = screenHeight < 670;
  const styles = useMemo(() => makeStyles(C, compactCards), [C, compactCards]);

  const draftEffectiveTier = getEffectiveTier(sheetDraft.length > 0 ? sheetDraft : ['bodyweight']);
  const isOverrideActive = sessionEquipmentOverride !== null;

  return (
    <>
      <View style={styles.container}>
        <ScrollView
          ref={scrollRef}
          style={{ flex: 1 }}
          contentContainerStyle={[
            styles.content,
            {
              paddingTop: insets.top + webTopInset + 16,
              paddingBottom: insets.bottom + (Platform.OS === 'web' ? 84 : 50),
            },
          ]}
          showsVerticalScrollIndicator={false}
          {...scrollHint.handlers}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.title}>Train</Text>
          {!activeSession && <Text style={styles.subtitle}>Choose a session to start</Text>}

          {/* Equipment chip */}
          <View
            ref={equipmentRef}
            collapsable={false}
            style={styles.equipmentChipRow}
            onLayout={(e) => {
              sectionScrollY.current.equipment = e.nativeEvent.layout.y;
            }}
          >
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
                color={isOverrideActive ? C.primaryText : C.textSecondary}
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
                color={isOverrideActive ? C.primaryText : C.textTertiary}
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
                accessibilityLabel="Clear equipment override"
                accessibilityRole="button"
              >
                <Ionicons name="close-circle" size={18} color={C.textTertiary} />
              </Pressable>
            )}
          </View>

          {/* Resume banner */}
          {activeSession && (
            <Animated.View
              entering={FadeInDown.duration(350)}
              style={[styles.resumeBanner, { marginBottom: 10 }]}
            >
              <View style={styles.resumeBannerLeft}>
                <Ionicons name="time-outline" size={20} color={C.warning} />
                <View>
                  <Text style={styles.resumeBannerTitle}>Session in progress</Text>
                  <Text style={styles.resumeBannerSub}>
                    {activeSession.displayLabel ??
                      SESSION_META[activeSession.sessionType]?.label}{' '}
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
          <View
            ref={kpiRef}
            collapsable={false}
            onLayout={(e) => {
              sectionScrollY.current.kpi = e.nativeEvent.layout.y;
            }}
          >
          <GlossaryTerm
            term="KPI Sessions"
            definition="Key Performance Indicator lifts: Squat, Bench, and Deadlift. These are the lifts your 1RM (one-rep max) and strength progress are tracked against."
            textStyle={styles.sectionHeading}
          />
          <Animated.View entering={FadeInDown.delay(0).duration(380)} style={styles.sessionGrid}>
            {KPI_SESSION_TYPES.map((type) => {
              const meta = SESSION_META[type];
              return (
                <Pressable
                  key={type}
                  ref={type === 'custom' ? customRef : undefined}
                  collapsable={type === 'custom' ? false : undefined}
                  onPress={() => handleSelect(type)}
                  style={({ pressed }) => [
                    styles.sessionCard,
                    pressed && { opacity: 0.88, transform: [{ scale: 0.97 }] },
                  ]}
                  testID={`train-session-${type}`}
                >
                  <View style={[styles.sessionCardIcon, compactCards && { height: 68 }]}>
                    <Image
                      source={getSessionImage(type, userProfile?.sex)}
                      style={styles.sessionCardImage}
                      resizeMode="contain"
                    />
                  </View>
                  <Text style={styles.sessionCardLabel} numberOfLines={1}>
                    {meta.label}
                  </Text>
                  <Text style={styles.sessionCardSub} numberOfLines={2}>
                    {meta.subtitle}
                  </Text>
                </Pressable>
              );
            })}
          </Animated.View>
          </View>

          {/* KPI equipment callout — only for non-full-gym users */}
          {!hasFullGym && (
            <Pressable
              onPress={() => router.push('/(tabs)/profile')}
              style={({ pressed }) => [styles.kpiCallout, pressed && { opacity: 0.7 }]}
              testID="train-kpi-equipment-callout"
            >
              <Ionicons name="information-circle-outline" size={14} color={C.primaryText} />
              <Text style={styles.kpiCalloutText}>
                Sessions adapt to your equipment. Add Full Gym to unlock barbell lifts and 1RM
                tracking.
              </Text>
              <Ionicons name="chevron-forward" size={12} color={C.primaryText} />
            </Pressable>
          )}

          {/* Additional Sessions */}
          <View
            ref={additionalRef}
            collapsable={false}
            onLayout={(e) => {
              sectionScrollY.current.additional = e.nativeEvent.layout.y;
            }}
          >
          <Text
            style={[
              styles.sectionHeading,
              { marginTop: activeSession ? (compactCards ? 2 : 4) : compactCards ? 4 : 8 },
            ]}
          >
            Additional Sessions
          </Text>
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
                      source={getSessionImage(type, userProfile?.sex)}
                      style={styles.sessionCardImage}
                      resizeMode="contain"
                    />
                  </View>
                  <Text style={styles.sessionCardLabel} numberOfLines={1}>
                    {meta.label}
                  </Text>
                  <Text style={styles.sessionCardSub} numberOfLines={2}>
                    {meta.subtitle}
                  </Text>
                </Pressable>
              );
            })}
          </Animated.View>
          </View>
        </ScrollView>
        {/* Full Body and Conditioning are the last two cards on this tab and
            nothing on screen said they were there. */}
        <ScrollIndicator {...scrollHint.state} top={70} bottom={92} />
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
                <Text style={{ fontFamily: 'Inter_600SemiBold', color: C.primaryText }}>
                  {getEquipmentLabel(draftEffectiveTier)}
                </Text>
              </Text>
            </View>
          )}

          {isBeginnerExperience && (
            <Pressable
              onPress={() => router.push('/(tabs)/profile')}
              style={({ pressed }) => [styles.beginnerNote, pressed && { opacity: 0.7 }]}
            >
              <Ionicons name="shield-checkmark-outline" size={13} color={C.primaryText} />
              <Text style={styles.beginnerNoteText}>
                Bodyweight & Bands. Unlock more in Profile →
              </Text>
            </Pressable>
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
            testID="sheet-equipment-confirm"
          >
            <Ionicons name="checkmark-circle" size={18} color={C.textInverse} />
            <Text style={styles.confirmBtnText}>Use this equipment</Text>
          </Pressable>
        </View>
      </Modal>

      {tutStep !== null && (
        <CoachMark
          visible
          title={TRAIN_TUTORIAL[tutStep].title}
          body={TRAIN_TUTORIAL[tutStep].body}
          step={tutStep + 1}
          total={TRAIN_TUTORIAL.length}
          onNext={advanceTrainTut}
          onSkip={skipTrainTut}
          onPrev={tourBackTarget(2, tutStep) ? backTrainTut : undefined}
          bottomOffset={insets.bottom + (Platform.OS === 'web' ? 84 : 50) + 16}
          iconName={TRAIN_TUTORIAL[tutStep].iconName}
          iconLabel={TRAIN_TUTORIAL[tutStep].iconLabel}
          spotlightRect={tutSpotlight ?? undefined}
        />
      )}
    </>
  );
}

function makeStyles(C: ReturnType<typeof useColors>, compact = false) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: C.background },
    content: { paddingHorizontal: 20 },
    title: { fontSize: 26, fontFamily: 'Inter_700Bold', color: C.text },
    subtitle: {
      fontSize: 13,
      fontFamily: 'Inter_500Medium',
      color: C.textSecondary,
      marginTop: 2,
      marginBottom: compact ? 6 : 10,
    },

    equipmentChipRow: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      alignSelf: 'flex-start' as const,
      gap: 6,
      marginBottom: compact ? 10 : 16,
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
      color: C.primaryText,
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
      marginBottom: compact ? 4 : 6,
      marginTop: compact ? 0 : 2,
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
      height: 110,
      borderRadius: 10,
      backgroundColor: C.surfaceTertiary,
      overflow: 'hidden',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 6,
    },
    sessionCardImage: { width: '100%', height: '100%' },
    sessionCardLabel: { fontSize: 12, fontFamily: 'Inter_700Bold', color: C.text, marginBottom: 3 },
    // Two lines, with room reserved for both so the cards in a row stay level
    // whether their subtitle wraps or not. At one line these were cut mid-word
    // on a narrow card — "KPI · Quads · Glutes · Ha…" — which reads as broken
    // rather than abbreviated.
    sessionCardSub: {
      fontSize: 11,
      fontFamily: 'Inter_400Regular',
      color: C.textSecondary,
      lineHeight: 15,
      minHeight: 30,
    },

    kpiCallout: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 7,
      backgroundColor: C.primarySurface,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 8,
      marginBottom: 4,
    },
    kpiCalloutText: {
      flex: 1,
      fontSize: 11,
      fontFamily: 'Inter_400Regular',
      color: C.primaryText,
      lineHeight: 15,
    },

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
    beginnerNoteText: { fontSize: 12, fontFamily: 'Inter_400Regular', color: C.primaryText, flex: 1 },
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
