import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  View,
  Text,
  Image,
  Pressable,
  StyleSheet,
  Platform,
  ScrollView,
  Modal,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useColors } from '@/constants/colors';
import { cardShadow } from '@/constants/shadows';
import CoachMark, { SpotlightRect } from '@/components/CoachMark';
import {
  EquipmentTier,
  EnergyLevel,
  PainRegion,
  PainSeverity,
  SessionType,
  TimeAvailable,
  TIER_ORDER,
  useAppStore,
} from '@/lib/store';
import {
  getSessionLabel,
  getSessionSubtitle,
  getEquipmentLabel,
  getEffectiveTier,
  getPainRegionLabel,
} from '@/lib/workout-engine';
import { BodyDiagram } from '@/components/BodyDiagram';

type Step = 'main' | 'painRegion' | 'severeConfirm' | 'prehabFocus';

const PAIN_SEVERITY_OPTIONS: { value: PainSeverity; label: string }[] = [
  { value: 'mild', label: 'Mild' },
  { value: 'moderate', label: 'Moderate' },
  { value: 'severe', label: 'Severe' },
];

const TIER_DESCRIPTIONS: Record<EquipmentTier, string> = {
  bodyweight: 'No equipment',
  bands: 'Bands only',
  dumbbells: 'Available',
  kettlebells: 'Available',
  fullgym: 'Everything',
};

const EQUIPMENT_IMAGES: Record<EquipmentTier, any> = {
  bodyweight: require('@/assets/images/equipment/bodyweight.png'),
  bands: require('@/assets/images/equipment/bands.png'),
  dumbbells: require('@/assets/images/equipment/dumbbells.png'),
  kettlebells: require('@/assets/images/equipment/kettlebells.png'),
  fullgym: require('@/assets/images/equipment/fullgym.png'),
};

// ─── Readiness tutorial content ───────────────────────────────────────────

// Order matches the page's actual top-to-bottom layout (Pain, then Energy,
// then Time) so the tutorial scrolls one direction instead of zigzagging up
// and down the page between steps.
const READINESS_TUTORIAL = [
  {
    iconName: 'medical-outline',
    iconLabel: 'Pain',
    title: 'Any pain today?',
    body: "Tap a region if anything is sore, and we'll automatically swap exercises away from that area so you can train safely.",
  },
  {
    iconName: 'battery-half-outline',
    iconLabel: 'Energy',
    title: 'How are you feeling?',
    body: 'Pick your energy honestly: low energy gets a lighter session, high energy pushes harder. We adjust the weight automatically.',
  },
  {
    iconName: 'time-outline',
    iconLabel: 'Time',
    title: 'How long have you got?',
    body: '30 min = core lift only. 45 min adds accessories and prehab. 60 min is the full session with a finisher.',
  },
] as const;

export default function ReadinessScreen() {
  const insets = useSafeAreaInsets();
  const C = useColors();
  const params = useLocalSearchParams<{
    sessionType: string;
    isTestWeek: string;
    energy?: string;
    timeAvailable?: string;
    equipmentOverride?: string;
    displayLabel?: string;
  }>();
  const sessionType = (params.sessionType || 'squat') as SessionType;
  const isTestWeek = params.isTestWeek === 'true';

  const {
    equipmentTiers,
    userProfile,
    lastReadinessEnergy,
    lastReadinessTime,
    lastPainRegion,
    setLastReadiness,
    readinessTutorialShown,
    setReadinessTutorialShown,
    deferTestWeek,
    setTestWeekFrequency,
    completedSessions,
  } = useAppStore();
  // Once a due test is postponed, treat the rest of this screen as a normal
  // session for good — the user still needs a plan for today.
  const [testPostponed, setTestPostponed] = useState(false);

  // First-ever test week gets one explainer before it starts. Derived from
  // history rather than a stored "seen" flag: once any test is completed this
  // is false forever, so tests two and three of the same block never repeat it,
  // and nothing new needs persisting or migrating. Someone who backs out of
  // their very first test does see it again, which is the right outcome.
  const hasTestedBefore = completedSessions.some((s) => s.isTestWeek);
  const [introDismissed, setIntroDismissed] = useState(false);
  const effectiveTestWeek = isTestWeek && !testPostponed;
  const showTestIntro = effectiveTestWeek && !hasTestedBefore && !introDismissed;
  const handlePostponeTest = () => {
    hapticTap();
    deferTestWeek();
    setTestPostponed(true);
  };

  // Turning tests off in the moment they are being imposed, rather than only in
  // a settings sheet the user has no reason to be looking at. Not deferring —
  // deferring keeps the test due until it is taken, which is the opposite of
  // what "I don't train these lifts" means. Reversible from Profile > Settings.
  const [testsDisabled, setTestsDisabled] = useState(false);
  const handleDisableTests = () => {
    hapticTap();
    setTestWeekFrequency('never');
    setTestsDisabled(true);
    setTestPostponed(true);
  };

  const isBeginnerExperience = userProfile.experienceLevel === 'beginner';
  const availableTiers: EquipmentTier[] = isBeginnerExperience
    ? ['bodyweight', 'bands']
    : TIER_ORDER;

  const overrideTiers: EquipmentTier[] | null = (() => {
    if (!params.equipmentOverride) return null;
    try {
      const parsed = JSON.parse(params.equipmentOverride) as EquipmentTier[];
      const filtered = parsed.filter((t) => availableTiers.includes(t));
      return filtered.length > 0 ? filtered : null;
    } catch {
      return null;
    }
  })();

  const initialTiers =
    overrideTiers ??
    (equipmentTiers && equipmentTiers.length > 0
      ? equipmentTiers.filter((t) => availableTiers.includes(t))
      : ['bodyweight' as EquipmentTier]);

  const [step, setStep] = useState<Step>('main');
  const [selectedEquipments, setSelectedEquipments] = useState<EquipmentTier[]>(
    initialTiers.length > 0 ? initialTiers : ['bodyweight']
  );
  const [hasAches, setHasAches] = useState(false);

  const [, setPainRegion] = useState<PainRegion | undefined>();
  const [energy, setEnergy] = useState<EnergyLevel>(lastReadinessEnergy);
  const [timeAvailable, setTimeAvailable] = useState<TimeAvailable>(lastReadinessTime);
  const [diagramPainRegions, setDiagramPainRegions] = useState<PainRegion[]>([]);
  const togglePainRegion = (r: PainRegion | undefined) => {
    if (!r) return;
    setDiagramPainRegions((prev) =>
      prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r]
    );
  };
  const [painSeverity, setPainSeverity] = useState<PainSeverity>('moderate');
  const [diagramPrehabRegion, setDiagramPrehabRegion] = useState<PainRegion | undefined>(undefined);
  const [painDiagramAreaH, setPainDiagramAreaH] = useState(0);
  const [coachStep, setCoachStep] = useState<number | null>(null);

  // ── Spotlight refs for each readiness tutorial section ──────────────────
  const painRef = useRef<View>(null);
  const energyRef = useRef<View>(null);
  const timeRef = useRef<View>(null);
  const [readinessSpotlight, setReadinessSpotlight] = useState<SpotlightRect | null>(null);
  // 'main' step's ScrollView + each section's distance from its top, captured
  // via onLayout as sections render. Lets the tutorial scroll a section into
  // view before measuring it — Energy/Time/Pain sit below Equipment on the
  // page, so without this the tutorial would just measure (and spotlight)
  // whatever happened to already be on screen, which is usually wrong.
  const mainScrollRef = useRef<ScrollView>(null);
  const sectionScrollY = useRef<{ pain: number; energy: number; time: number }>({
    pain: 0,
    energy: 0,
    time: 0,
  });
  const SCROLL_TOP_PADDING = 90;

  // Measure the spotlighted section whenever the tutorial step changes.
  // Clear the spotlight immediately on step change to avoid showing a stale rect
  // from the previous step while the new measurement is pending (fast-tap safety).
  useEffect(() => {
    setReadinessSpotlight(null);
    if (coachStep === null) return;
    const stepKeys = ['pain', 'energy', 'time'] as const;
    const refs = [painRef, energyRef, timeRef];
    const stepKey = stepKeys[coachStep];
    const target = refs[coachStep];
    mainScrollRef.current?.scrollTo({
      y: Math.max(0, sectionScrollY.current[stepKey] - SCROLL_TOP_PADDING),
      animated: true,
    });
    const timer = setTimeout(() => {
      target?.current?.measureInWindow((x, y, w, h) => {
        if (w > 0 && h > 0) {
          setReadinessSpotlight({
            top: y - 8,
            left: x - 8,
            width: w + 16,
            height: h + 16,
          });
        }
      });
      // Long enough for the scrollTo animation above to actually settle —
      // measuring mid-scroll would capture a transient, wrong position.
    }, 420);
    return () => clearTimeout(timer);
  }, [coachStep]); // eslint-disable-line react-hooks/exhaustive-deps

  const advanceCoach = useCallback(() => {
    setCoachStep((prev) => {
      if (prev === null) return null;
      const next = prev + 1;
      if (next >= READINESS_TUTORIAL.length) {
        setReadinessTutorialShown(true);
        return null;
      }
      return next;
    });
  }, [setReadinessTutorialShown]);

  const skipCoach = useCallback(() => {
    setCoachStep(null);
    setReadinessTutorialShown(true);
  }, [setReadinessTutorialShown]);

  useEffect(() => {
    // Energy/Time sections (and their refs) don't render during a test week,
    // so the tutorial would start with nothing to measure or spotlight.
    if (!readinessTutorialShown && !isTestWeek) {
      const timer = setTimeout(() => setCoachStep(0), 600);
      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (sessionType === 'prehab') {
      setStep('prehabFocus');
    } else if (sessionType === 'flexibility') {
      const tier = getEffectiveTier(selectedEquipments);
      router.replace({
        pathname: '/session',
        params: {
          sessionType,
          hasAches: 'false',
          painRegion: '',
          energy: 'normal',
          timeAvailable: '60',
          isTestWeek: 'false',
          equipment: tier,
        },
      });
    } else if (sessionType === 'conditioning' && params.energy && params.timeAvailable) {
      // Conditioning from the Flex tab: energy + duration already chosen by the
      // level picker - skip the readiness flow and go straight to session.
      const tier = getEffectiveTier(selectedEquipments);
      router.replace({
        pathname: '/session',
        params: {
          sessionType,
          hasAches: 'false',
          painRegion: '',
          energy: params.energy,
          timeAvailable: params.timeAvailable,
          isTestWeek: 'false',
          equipment: tier,
        },
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const hapticTap = () => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleTierToggle = (tier: EquipmentTier) => {
    if (!availableTiers.includes(tier)) return;
    hapticTap();
    setSelectedEquipments((prev) => {
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

  const handleStart = () => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (hasAches) {
      setDiagramPainRegions([]);
      setPainSeverity('moderate');
      setStep('painRegion');
    } else {
      setLastReadiness(energy, timeAvailable);
      if (effectiveTestWeek) {
        router.push({
          pathname: '/session',
          params: {
            sessionType,
            hasAches: 'false',
            painRegion: '',
            energy: 'normal',
            timeAvailable: '60',
            isTestWeek: 'true',
            equipment: getEffectiveTier(selectedEquipments),
          },
        });
      } else {
        router.push({
          pathname: '/session',
          params: {
            sessionType,
            hasAches: 'false',
            painRegion: '',
            energy,
            timeAvailable,
            isTestWeek: 'false',
            equipment: getEffectiveTier(selectedEquipments),
          },
        });
      }
    }
  };

  // region is null for "general soreness, no specific area" — the fallback
  // when a user says they're sore but doesn't tap a region on the diagram.
  // severity is only passed from the primary "Start Session" CTA, where the
  // user has actually picked a value on the severity picker - the "same as
  // last time"/"not sure" fallbacks skip severity entirely rather than
  // guessing on the user's behalf.
  const handlePainRegion = (region: PainRegion | PainRegion[] | null, severity?: PainSeverity) => {
    hapticTap();
    const primary = Array.isArray(region) ? region[0] : (region ?? undefined);
    const regionParam = Array.isArray(region) ? region.join(',') : (region ?? '');
    setPainRegion(primary);
    setLastReadiness(energy, timeAvailable, primary);
    const severityParam = severity ? { painSeverity: severity } : {};
    if (effectiveTestWeek) {
      router.push({
        pathname: '/session',
        params: {
          sessionType,
          hasAches: 'true',
          painRegion: regionParam,
          energy: 'normal',
          timeAvailable: '60',
          isTestWeek: 'true',
          equipment: getEffectiveTier(selectedEquipments),
          ...severityParam,
        },
      });
    } else {
      router.push({
        pathname: '/session',
        params: {
          sessionType,
          hasAches: 'true',
          painRegion: regionParam,
          energy,
          timeAvailable,
          isTestWeek: 'false',
          equipment: getEffectiveTier(selectedEquipments),
          ...severityParam,
        },
      });
    }
  };

  // Severe pain routes through a confirming prompt before committing to the
  // strength session, offering a region-targeted Recovery/Prehab session as
  // the safer default instead.
  const confirmPainRegion = () => {
    if (painSeverity === 'severe') {
      hapticTap();
      setStep('severeConfirm');
    } else {
      handlePainRegion(diagramPainRegions, painSeverity);
    }
  };

  const handlePrehabFocus = (region: PainRegion | 'fullbody') => {
    hapticTap();
    const tier = getEffectiveTier(selectedEquipments);
    router.push({
      pathname: '/session',
      params: {
        sessionType: 'prehab',
        hasAches: 'false',
        painRegion: region !== 'fullbody' ? region : '',
        energy: 'normal',
        timeAvailable: '60',
        isTestWeek: 'false',
        equipment: tier,
        ...(params.displayLabel ? { displayLabel: params.displayLabel } : {}),
      },
    });
  };

  const goBack = () => {
    switch (step) {
      case 'main':
        router.back();
        break;
      case 'prehabFocus':
        router.back();
        break;
      case 'painRegion':
        setStep('main');
        break;
      case 'severeConfirm':
        setStep('painRegion');
        break;
    }
  };

  const webTopInset = Platform.OS === 'web' ? 67 : 0;
  const webBottomInset = Platform.OS === 'web' ? 34 : 0;
  const effectiveTier = getEffectiveTier(selectedEquipments);
  const styles = useMemo(() => makeStyles(C), [C]);

  const renderMain = () => (
    <Animated.View key="main" entering={FadeInDown.duration(350)} style={{ flex: 1 }}>
      <ScrollView
        ref={mainScrollRef}
        showsVerticalScrollIndicator={false}
        style={{ flex: 1 }}
        contentContainerStyle={styles.mainContent}
      >
        {effectiveTestWeek && (
          <View style={styles.testWeekBanner}>
            <View style={styles.testWeekBannerIcon}>
              <Ionicons name="trophy" size={22} color={C.trophy} />
            </View>
            <View style={styles.testWeekBannerContent}>
              <View style={styles.testWeekBannerRow}>
                <View style={styles.testWeekBadge}>
                  <Text style={styles.testWeekBadgeText}>TEST WEEK</Text>
                </View>
              </View>
              <Text style={styles.testWeekBannerHeadline}>
                {sessionType === 'squat'
                  ? 'Squat 1RM'
                  : sessionType === 'bench'
                    ? 'Bench Press 1RM'
                    : 'Deadlift 1RM'}{' '}
                Test
              </Text>
              <Text style={styles.testWeekBannerSub}>
                Warm up, then one all-out set.{'\n'}How many clean reps you manage sets your
                number.
              </Text>
            </View>
          </View>
        )}
        {/* Declining a test is available to everyone.
            This banner used to render only when the day's equipment was below
            dumbbells, so it read as an equipment caveat — which meant anyone on
            dumbbells or above had no way to decline a max-effort barbell test
            anywhere in the app. The equipment warning is still shown when it
            applies, but the way out no longer depends on it. */}
        {effectiveTestWeek && (
          <View style={styles.testDeferBanner}>
            <Ionicons name="alert-circle-outline" size={18} color={C.warning} />
            <View style={{ flex: 1 }}>
              <Text style={styles.testDeferText}>
                {TIER_ORDER.indexOf(effectiveTier) < TIER_ORDER.indexOf('dumbbells')
                  ? `${getEquipmentLabel(effectiveTier)} won't give a number you can trust for a real 1RM test.`
                  : 'A test week maxes out Squat, Bench and Deadlift to re-baseline your weights.'}
              </Text>
              <Pressable onPress={handlePostponeTest} hitSlop={6} testID="postpone-test-week">
                <Text style={styles.testDeferLink}>Postpone the test to next session →</Text>
              </Pressable>
              <Pressable onPress={handleDisableTests} hitSlop={6} testID="disable-test-weeks">
                <Text style={styles.testDeferLink}>
                  I don&apos;t train these lifts — turn test weeks off →
                </Text>
              </Pressable>
            </View>
          </View>
        )}
        {testPostponed && (
          <View style={styles.testDeferConfirm}>
            <Ionicons name="checkmark-circle-outline" size={16} color={C.primary} />
            <Text style={styles.testDeferConfirmText}>
              {testsDisabled
                ? "Test weeks are off. Today's a normal session — you can turn them back on in Profile › Settings."
                : "Test postponed. We'll ask again next session, today's a normal one."}
            </Text>
          </View>
        )}
        {/* Equipment */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Equipment today</Text>
          {isBeginnerExperience && (
            <View style={styles.beginnerNote}>
              <Ionicons name="shield-checkmark-outline" size={13} color={C.primary} />
              <Text style={styles.beginnerNoteText}>
                No Equipment & bands - great for building safe foundations
              </Text>
            </View>
          )}
          {overrideTiers !== null && (
            <View style={styles.beginnerNote}>
              <Ionicons name="swap-horizontal-outline" size={13} color={C.primary} />
              <Text style={styles.beginnerNoteText}>
                Pre-selected from your session choice - adjust below if needed
              </Text>
            </View>
          )}
          {selectedEquipments.length > 0 && (
            <View style={styles.effectiveTierBadge}>
              <Text style={styles.effectiveTierText}>
                Best match:{' '}
                <Text style={{ fontFamily: 'Inter_600SemiBold', color: C.primary }}>
                  {getEquipmentLabel(effectiveTier)}
                </Text>
              </Text>
            </View>
          )}
          <View style={styles.tierGrid}>
            {TIER_ORDER.map((tier) => {
              const isAvailable = availableTiers.includes(tier);
              const isActive = selectedEquipments.includes(tier);
              return (
                <Pressable
                  key={tier}
                  onPress={() => handleTierToggle(tier)}
                  style={({ pressed }) => [
                    styles.tierTile,
                    isActive && styles.tierRowActive,
                    !isAvailable && styles.tierRowLocked,
                    pressed && isAvailable && { opacity: 0.8 },
                    tier === 'fullgym' && styles.tierTileFull,
                  ]}
                  testID={`equipment-${tier}`}
                >
                  <View style={styles.tierImageWrap}>
                    <Image
                      source={EQUIPMENT_IMAGES[tier]}
                      style={styles.tierImage}
                      resizeMode="contain"
                    />
                    {!isAvailable && (
                      <View style={styles.tierLockedOverlay}>
                        <Ionicons name="lock-closed" size={18} color="rgba(255,255,255,0.7)" />
                      </View>
                    )}
                  </View>
                  <View style={styles.tierTextRow}>
                    <View style={styles.tierText}>
                      <Text
                        numberOfLines={1}
                        style={[
                          styles.tierLabel,
                          isActive && { color: C.primary },
                          !isAvailable && { color: C.textTertiary },
                        ]}
                      >
                        {getEquipmentLabel(tier)}
                      </Text>
                      <Text numberOfLines={1} style={styles.tierSub}>
                        {isAvailable ? TIER_DESCRIPTIONS[tier] : 'Unlock in profile'}
                      </Text>
                    </View>
                    {isAvailable && (
                      <View style={[styles.tierCheck, isActive && styles.tierCheckActive]}>
                        {isActive && <Ionicons name="checkmark" size={11} color={C.textInverse} />}
                      </View>
                    )}
                  </View>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.divider} />

        {/* Aches — tutorial step 0 spotlight target */}
        <View
          style={styles.section}
          ref={painRef}
          onLayout={(e) => {
            sectionScrollY.current.pain = e.nativeEvent.layout.y;
          }}
        >
          <Text style={styles.sectionTitle}>Any pain or soreness?</Text>
          <View style={styles.pillRow}>
            <Pressable
              onPress={() => {
                hapticTap();
                setHasAches(false);
              }}
              style={[styles.pill, !hasAches && styles.pillActive]}
              testID="aches-no"
            >
              <Ionicons
                name="checkmark-circle-outline"
                size={16}
                color={!hasAches ? C.textInverse : C.textSecondary}
              />
              <Text style={[styles.pillText, !hasAches && styles.pillTextActive]}>No</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                hapticTap();
                setHasAches(true);
                setDiagramPainRegions([]);
              }}
              style={[styles.pill, styles.pillAches, hasAches && styles.pillAchesActive]}
              testID="aches-yes"
            >
              <Ionicons
                name="alert-circle-outline"
                size={16}
                color={hasAches ? '#fff' : C.warning}
              />
              <Text style={[styles.pillText, { color: hasAches ? '#fff' : C.warning }]}>Yes →</Text>
            </Pressable>
          </View>
        </View>

        {!effectiveTestWeek && (
          <>
            <View style={styles.divider} />

            {/* Energy — tutorial step 1 spotlight target */}
            <View
              style={styles.section}
              ref={energyRef}
              onLayout={(e) => {
                sectionScrollY.current.energy = e.nativeEvent.layout.y;
              }}
            >
              <Text style={styles.sectionTitle}>Energy level</Text>
              <View style={styles.pillRow}>
                {[
                  {
                    level: 'low' as EnergyLevel,
                    label: 'Low',
                    icon: 'battery-dead-outline' as const,
                  },
                  {
                    level: 'normal' as EnergyLevel,
                    label: 'Normal',
                    icon: 'battery-half-outline' as const,
                  },
                  {
                    level: 'high' as EnergyLevel,
                    label: 'High',
                    icon: 'battery-full-outline' as const,
                  },
                ].map((item) => (
                  <Pressable
                    key={item.level}
                    onPress={() => {
                      hapticTap();
                      setEnergy(item.level);
                    }}
                    style={[
                      styles.pill,
                      styles.pillFlex,
                      energy === item.level && styles.pillActive,
                    ]}
                    testID={`energy-${item.level}`}
                  >
                    <Ionicons
                      name={item.icon}
                      size={15}
                      color={energy === item.level ? C.textInverse : C.textSecondary}
                    />
                    <Text style={[styles.pillText, energy === item.level && styles.pillTextActive]}>
                      {item.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <View style={styles.divider} />

            {/* Time — tutorial step 2 spotlight target */}
            <View
              style={styles.section}
              ref={timeRef}
              onLayout={(e) => {
                sectionScrollY.current.time = e.nativeEvent.layout.y;
              }}
            >
              <Text style={styles.sectionTitle}>Time available</Text>
              <View style={styles.pillRow}>
                {[
                  { time: '30' as TimeAvailable, label: '30 min' },
                  { time: '45' as TimeAvailable, label: '45 min' },
                  { time: '60' as TimeAvailable, label: '60 min' },
                ].map((item) => (
                  <Pressable
                    key={item.time}
                    onPress={() => {
                      hapticTap();
                      setTimeAvailable(item.time);
                    }}
                    style={[
                      styles.pill,
                      styles.pillFlex,
                      timeAvailable === item.time && styles.pillActive,
                    ]}
                    testID={`time-${item.time}`}
                  >
                    <Text
                      style={[
                        styles.pillText,
                        timeAvailable === item.time && styles.pillTextActive,
                      ]}
                    >
                      {item.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          </>
        )}
      </ScrollView>
      <View style={[styles.footer, { paddingBottom: insets.bottom + webBottomInset + 12 }]}>
        <Pressable
          onPress={handleStart}
          disabled={selectedEquipments.length === 0}
          style={({ pressed }) => [
            styles.startButton,
            effectiveTestWeek && styles.startButtonTestWeek,
            selectedEquipments.length === 0 && styles.startButtonDisabled,
            pressed &&
              selectedEquipments.length > 0 && { opacity: 0.9, transform: [{ scale: 0.98 }] },
          ]}
          testID="readiness-start"
        >
          {effectiveTestWeek ? (
            <>
              <Ionicons name="trophy" size={18} color={C.textInverse} />
              <Text style={styles.startButtonText}>Begin Test</Text>
            </>
          ) : hasAches ? (
            <>
              <Ionicons name="arrow-forward" size={18} color={C.textInverse} />
              <Text style={styles.startButtonText}>Next: pick area →</Text>
            </>
          ) : (
            <>
              <Ionicons name="flash" size={18} color={C.textInverse} />
              <Text style={styles.startButtonText}>Start Session</Text>
            </>
          )}
        </Pressable>
      </View>
    </Animated.View>
  );

  const renderPrehabFocus = () => (
    <Animated.View key="prehabFocus" entering={FadeInDown.duration(350)} style={{ flex: 1 }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingTop: 8,
          paddingBottom: 32,
          alignItems: 'center',
        }}
      >
        <View
          style={[
            styles.questionIcon,
            { alignSelf: 'center', width: 48, height: 48, borderRadius: 14, marginBottom: 10 },
          ]}
        >
          <Ionicons name="body-outline" size={24} color={C.primary} />
        </View>
        <Text style={[styles.question, { textAlign: 'center', fontSize: 20, marginBottom: 4 }]}>
          What area to target today?
        </Text>
        <Text style={[styles.questionSub, { textAlign: 'center', marginBottom: 4 }]}>
          Tap a region - or run a full body circuit
        </Text>
        <View style={styles.diagramCard}>
          <BodyDiagram
            selected={diagramPrehabRegion}
            onSelect={setDiagramPrehabRegion}
            accentColor={C.primary}
            accentColorLight={C.primarySurface}
          />
        </View>
        {diagramPrehabRegion ? (
          <Pressable
            onPress={() => handlePrehabFocus(diagramPrehabRegion)}
            style={({ pressed }) => [
              styles.startButton,
              { marginTop: 12, width: '100%' },
              pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] },
            ]}
            testID="prehab-region-confirm"
          >
            <Ionicons name="flash" size={18} color={C.textInverse} />
            <Text style={styles.startButtonText}>Start targeted prehab</Text>
          </Pressable>
        ) : (
          <Pressable
            onPress={() => handlePrehabFocus('fullbody')}
            style={({ pressed }) => [
              styles.startButton,
              { marginTop: 12, width: '100%' },
              pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] },
            ]}
            testID="prehab-fullbody"
          >
            <Ionicons name="flash-outline" size={18} color={C.textInverse} />
            <Text style={styles.startButtonText}>Full body circuit</Text>
          </Pressable>
        )}
      </ScrollView>
    </Animated.View>
  );

  // No-scroll layout: the diagram area is measured and the BodyDiagram width is
  // derived from the available height so the whole step (diagram + Continue)
  // always fits on screen. Vertical overhead inside BodyDiagram (panel padding,
  // toggles, label row) is ~175pt; the SVG itself is width * 2.4 tall.
  const painDiagramMaxWidth =
    painDiagramAreaH > 0
      ? Math.max(100, Math.min(200, Math.floor((painDiagramAreaH - 175) / 2.4)))
      : 200;

  const renderPainRegion = () => (
    <Animated.View key="painRegion" entering={FadeInDown.duration(350)} style={{ flex: 1 }}>
      <View
        style={{
          flex: 1,
          paddingHorizontal: 20,
          paddingTop: 4,
          paddingBottom: 16,
          alignItems: 'center',
        }}
      >
        <View
          style={[
            styles.questionIcon,
            {
              alignSelf: 'center',
              width: 44,
              height: 44,
              borderRadius: 13,
              marginBottom: 8,
              backgroundColor: C.warningLight,
            },
          ]}
        >
          <Ionicons name="locate-outline" size={22} color={C.warning} />
        </View>
        <Text style={[styles.question, { textAlign: 'center', fontSize: 20, marginBottom: 4 }]}>
          Which area is affected?
        </Text>
        <Text style={[styles.questionSub, { textAlign: 'center', marginBottom: 2 }]}>
          {"Tap one or more regions and we'll adjust your exercises"}
        </Text>
        <Pressable
          onPress={() => setStep('main')}
          hitSlop={8}
          style={{ alignSelf: 'center', marginTop: 4, marginBottom: 2 }}
        >
          <Text style={{ fontSize: 12, fontFamily: 'Inter_400Regular', color: C.textTertiary }}>
            ← Not sore after all
          </Text>
        </Pressable>
        <View
          style={{ flex: 1, width: '100%', alignItems: 'center', justifyContent: 'center' }}
          onLayout={(e) => setPainDiagramAreaH(e.nativeEvent.layout.height)}
        >
          <View style={styles.diagramCard}>
            <BodyDiagram
              selectedRegions={diagramPainRegions}
              onSelect={togglePainRegion}
              accentColor={C.warning}
              accentColorLight={C.warningLight}
              maxWidth={painDiagramMaxWidth}
            />
          </View>
        </View>
        {diagramPainRegions.length > 0 && (
          <View style={{ width: '100%', marginBottom: 10 }}>
            <Text
              style={{
                fontSize: 12,
                fontFamily: 'Inter_600SemiBold',
                color: C.textTertiary,
                marginBottom: 6,
                textAlign: 'center',
              }}
            >
              How bad is it?
            </Text>
            <View style={{ flexDirection: 'row', gap: 8, justifyContent: 'center' }}>
              {PAIN_SEVERITY_OPTIONS.map((opt) => {
                const active = painSeverity === opt.value;
                return (
                  <Pressable
                    key={opt.value}
                    onPress={() => {
                      hapticTap();
                      setPainSeverity(opt.value);
                    }}
                    style={[styles.pill, styles.pillAches, active && styles.pillAchesActive]}
                    testID={`pain-severity-${opt.value}`}
                  >
                    <Text style={[styles.pillText, active && styles.pillTextActive]}>
                      {opt.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        )}
        <View style={{ width: '100%', minHeight: 52, justifyContent: 'flex-end' }}>
          {diagramPainRegions.length > 0 ? (
            <Pressable
              onPress={confirmPainRegion}
              style={({ pressed }) => [
                styles.startButton,
                { width: '100%' },
                pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] },
              ]}
              testID="pain-region-confirm"
            >
              <Ionicons name="flash" size={18} color={C.textInverse} />
              <Text style={styles.startButtonText}>
                Start Session →
                {diagramPainRegions.length > 1 ? ` (${diagramPainRegions.length} regions)` : ''}
              </Text>
            </Pressable>
          ) : lastPainRegion ? (
            <Pressable
              onPress={() => handlePainRegion(lastPainRegion)}
              style={({ pressed }) => [
                styles.startButton,
                {
                  width: '100%',
                  backgroundColor: C.surfaceTertiary,
                  borderWidth: 1,
                  borderColor: C.warning,
                },
                pressed && { opacity: 0.8 },
              ]}
              testID="pain-region-last"
            >
              <Ionicons name="time-outline" size={16} color={C.warning} />
              <Text style={[styles.startButtonText, { color: C.warning }]}>Same as last time</Text>
            </Pressable>
          ) : (
            // Nothing tapped and no prior pain history — always give a way
            // forward rather than leaving the user stuck with only the
            // "not sore after all" link, which forces them to misreport.
            <Pressable
              onPress={() => handlePainRegion(null)}
              style={({ pressed }) => [
                styles.startButton,
                {
                  width: '100%',
                  backgroundColor: C.surfaceTertiary,
                  borderWidth: 1,
                  borderColor: C.warning,
                },
                pressed && { opacity: 0.8 },
              ]}
              testID="pain-region-general"
            >
              <Ionicons name="body-outline" size={16} color={C.warning} />
              <Text style={[styles.startButtonText, { color: C.warning }]}>
                Not sure, train carefully
              </Text>
            </Pressable>
          )}
        </View>
      </View>
    </Animated.View>
  );

  // Shown only when painSeverity === 'severe' - a confirming prompt before
  // committing to the planned strength session, since a genuinely severe
  // ache is better served by a Recovery/Prehab session targeting the same
  // region than by pushing through the original plan.
  const renderSevereConfirm = () => {
    const primaryRegion = diagramPainRegions[0];
    return (
      <Animated.View key="severeConfirm" entering={FadeInDown.duration(350)} style={{ flex: 1 }}>
        <View
          style={{
            flex: 1,
            paddingHorizontal: 24,
            paddingTop: 8,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <View
            style={[
              styles.questionIcon,
              {
                width: 52,
                height: 52,
                borderRadius: 16,
                marginBottom: 14,
                backgroundColor: C.errorLight,
              },
            ]}
          >
            <Ionicons name="alert-circle-outline" size={26} color={C.error} />
          </View>
          <Text style={[styles.question, { textAlign: 'center', fontSize: 20, marginBottom: 8 }]}>
            That sounds like more than a minor ache
          </Text>
          <Text
            style={[
              styles.questionSub,
              { textAlign: 'center', marginBottom: 28, lineHeight: 20 },
            ]}
          >
            {primaryRegion
              ? `A Recovery session targeting your ${getPainRegionLabel(primaryRegion).toLowerCase()} might serve you better today than ${getSessionLabel(sessionType)}.`
              : `A Recovery session might serve you better today than ${getSessionLabel(sessionType)}.`}
          </Text>
          <Pressable
            onPress={() => handlePrehabFocus(primaryRegion ?? 'fullbody')}
            style={({ pressed }) => [
              styles.startButton,
              { width: '100%' },
              pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] },
            ]}
            testID="severe-switch-recovery"
          >
            <Ionicons name="heart-outline" size={18} color={C.textInverse} />
            <Text style={styles.startButtonText}>Switch to Recovery Session</Text>
          </Pressable>
          <Pressable
            onPress={() => handlePainRegion(diagramPainRegions, 'severe')}
            style={({ pressed }) => [
              styles.startButton,
              {
                width: '100%',
                marginTop: 10,
                backgroundColor: C.surfaceTertiary,
                borderWidth: 1,
                borderColor: C.border,
              },
              pressed && { opacity: 0.8 },
            ]}
            testID="severe-continue-anyway"
          >
            <Text style={[styles.startButtonText, { color: C.textSecondary }]}>
              Continue with {getSessionLabel(sessionType)} anyway
            </Text>
          </Pressable>
        </View>
      </Animated.View>
    );
  };

  const isPainStep = step === 'painRegion' || step === 'severeConfirm';

  return (
    <View style={[styles.container, { paddingTop: insets.top + webTopInset }]}>
      <View style={styles.topBar}>
        <Pressable
          onPress={goBack}
          style={styles.backButton}
          testID="readiness-back"
          accessibilityLabel="Back"
          accessibilityRole="button"
        >
          <Ionicons name="chevron-back" size={24} color={C.text} />
        </Pressable>
        <View style={styles.sessionInfo}>
          <Text style={styles.sessionLabel}>
            {effectiveTestWeek ? 'Strength Test Week' : getSessionLabel(sessionType)}
          </Text>
          <Text style={styles.sessionSub}>
            {effectiveTestWeek ? 'Strength Testing' : getSessionSubtitle(sessionType)}
          </Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      {isPainStep && (
        <View style={styles.progressContainer}>
          <View style={styles.progressTrack}>
            <Animated.View style={[styles.progressFill, { width: '100%' }]} />
          </View>
          <Text style={styles.stepIndicator}>Pain Region</Text>
        </View>
      )}

      {step === 'main' && renderMain()}
      {step === 'prehabFocus' && renderPrehabFocus()}
      {step === 'painRegion' && renderPainRegion()}
      {step === 'severeConfirm' && renderSevereConfirm()}
      {coachStep !== null && step === 'main' && (
        <CoachMark
          visible
          title={READINESS_TUTORIAL[coachStep].title}
          body={READINESS_TUTORIAL[coachStep].body}
          step={coachStep + 1}
          total={READINESS_TUTORIAL.length}
          onNext={advanceCoach}
          onSkip={skipCoach}
          bottomOffset={insets.bottom + (Platform.OS === 'web' ? 34 : 0) + 80}
          iconName={READINESS_TUTORIAL[coachStep].iconName}
          iconLabel={READINESS_TUTORIAL[coachStep].iconLabel}
          spotlightRect={readinessSpotlight ?? undefined}
        />
      )}

      {/* First-ever test week: one explainer, before anything else on the
          screen can be touched. Deliberately not the multi-step spotlight tour
          used elsewhere — a test session is two exercises, so a tour would be
          four taps of chrome around one idea. */}
      <Modal visible={showTestIntro} transparent animationType="fade" onRequestClose={() => {}}>
        <View style={styles.introOverlay}>
          <View style={styles.introCard}>
            <View style={styles.introIconRing}>
              <Ionicons name="trophy" size={26} color={C.trophy} />
            </View>
            <Text style={styles.introTitle}>Your first test week</Text>
            <Text style={styles.introBody}>
              You&apos;ve earned this. Over the next three sessions you&apos;ll test each of your
              main lifts once — squat, then bench, then deadlift.
            </Text>

            <View style={styles.introSteps}>
              <View style={styles.introStep}>
                <Text style={styles.introStepNum}>1</Text>
                <Text style={styles.introStepText}>
                  Warm up through a few building sets. The weights are worked out for you.
                </Text>
              </View>
              <View style={styles.introStep}>
                <Text style={styles.introStepNum}>2</Text>
                <Text style={styles.introStepText}>
                  Then one all-out set: as many clean reps as you can manage.
                </Text>
              </View>
              <View style={styles.introStep}>
                <Text style={styles.introStepNum}>3</Text>
                <Text style={styles.introStepText}>
                  The weight and your reps give us your one-rep max — the most you could lift for
                  a single rep.
                </Text>
              </View>
            </View>

            <Text style={styles.introWarn}>
              Stop the moment your form slips. A scruffy rep doesn&apos;t count towards your
              number, and it&apos;s where people get hurt.
            </Text>

            <Pressable
              onPress={() => {
                hapticTap();
                setIntroDismissed(true);
              }}
              style={styles.introBtn}
              testID="test-week-intro-dismiss"
            >
              <Text style={styles.introBtnText}>Let&apos;s go</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function makeStyles(C: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: C.background },

    // ── First test week explainer ──────────────────────────────────────────
    introOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.55)',
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 24,
    },
    introCard: {
      width: '100%',
      backgroundColor: C.surface,
      borderRadius: 22,
      borderWidth: 1,
      borderColor: C.borderLight,
      paddingHorizontal: 22,
      paddingTop: 22,
      paddingBottom: 18,
      alignItems: 'center',
    },
    introIconRing: {
      width: 58,
      height: 58,
      borderRadius: 29,
      backgroundColor: C.trophyBg,
      borderWidth: 1,
      borderColor: C.trophyBorder,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 12,
    },
    introTitle: {
      fontSize: 21,
      fontFamily: 'Inter_700Bold',
      color: C.text,
      textAlign: 'center',
    },
    introBody: {
      fontSize: 14,
      fontFamily: 'Inter_400Regular',
      color: C.textSecondary,
      textAlign: 'center',
      lineHeight: 20,
      marginTop: 8,
    },
    introSteps: { alignSelf: 'stretch', gap: 12, marginTop: 18 },
    introStep: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
    introStepNum: {
      width: 22,
      height: 22,
      borderRadius: 11,
      backgroundColor: C.primaryMuted,
      color: C.primary,
      fontSize: 12,
      fontFamily: 'Inter_700Bold',
      textAlign: 'center',
      lineHeight: 22,
      overflow: 'hidden',
    },
    introStepText: {
      flex: 1,
      fontSize: 13.5,
      fontFamily: 'Inter_400Regular',
      color: C.text,
      lineHeight: 19,
    },
    introWarn: {
      alignSelf: 'stretch',
      marginTop: 16,
      backgroundColor: C.warningLight,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 12.5,
      fontFamily: 'Inter_500Medium',
      color: C.warning,
      lineHeight: 18,
    },
    introBtn: {
      alignSelf: 'stretch',
      marginTop: 18,
      backgroundColor: C.primary,
      borderRadius: 14,
      paddingVertical: 15,
      alignItems: 'center',
    },
    introBtnText: { fontSize: 16, fontFamily: 'Inter_700Bold', color: C.textInverse },

    topBar: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    backButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
    sessionInfo: { flex: 1, alignItems: 'center' },
    sessionLabel: { fontSize: 16, fontFamily: 'Inter_600SemiBold', color: C.text },
    sessionSub: { fontSize: 12, fontFamily: 'Inter_400Regular', color: C.textSecondary },
    progressContainer: { paddingHorizontal: 24, marginBottom: 8 },
    progressTrack: {
      height: 4,
      backgroundColor: C.surfaceTertiary,
      borderRadius: 2,
      overflow: 'hidden',
      marginBottom: 8,
    },
    progressFill: { height: '100%', backgroundColor: C.warning, borderRadius: 2 },
    stepIndicator: {
      fontSize: 14,
      fontFamily: 'Inter_600SemiBold',
      color: C.textSecondary,
      textAlign: 'center',
    },

    mainContent: { paddingHorizontal: 20, paddingTop: 6, paddingBottom: 6 },
    section: { paddingVertical: 7 },
    sectionTitle: {
      fontSize: 14,
      fontFamily: 'Inter_700Bold',
      color: C.text,
      marginBottom: 6,
      textTransform: 'uppercase' as const,
      letterSpacing: 0.5,
    },
    divider: { height: 1, backgroundColor: C.borderLight },

    effectiveTierBadge: {
      backgroundColor: C.surfaceTertiary,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 5,
      marginBottom: 8,
      borderWidth: 1,
      borderColor: C.border,
      alignSelf: 'flex-start' as const,
    },
    effectiveTierText: { fontSize: 12, fontFamily: 'Inter_400Regular', color: C.textSecondary },
    beginnerNote: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: C.surfaceSecondary,
      borderRadius: 8,
      paddingHorizontal: 10,
      paddingVertical: 7,
      marginBottom: 8,
      borderWidth: 1,
      borderColor: C.border,
    },
    beginnerNoteText: { flex: 1, fontSize: 12, fontFamily: 'Inter_400Regular', color: C.text },

    tierGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    tierTile: {
      width: '48%',
      flexDirection: 'column',
      backgroundColor: C.surface,
      borderRadius: 14,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: C.borderLight,
    },
    tierTileFull: { width: '100%' },
    tierRowActive: { borderColor: C.primary, backgroundColor: C.primarySurface },
    tierRowLocked: { opacity: 0.5 },
    tierImageWrap: {
      width: '100%',
      height: 86,
      backgroundColor: C.surfaceTertiary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    tierImage: { width: '100%', height: '100%' },
    tierLockedOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0,0,0,0.5)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    tierTextRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 10,
      paddingVertical: 8,
      gap: 6,
    },
    tierText: { flex: 1 },
    tierLabel: { fontSize: 12, fontFamily: 'Inter_600SemiBold', color: C.text },
    tierSub: {
      fontSize: 10,
      fontFamily: 'Inter_400Regular',
      color: C.textSecondary,
      marginTop: 1,
    },
    tierCheck: {
      width: 18,
      height: 18,
      borderRadius: 9,
      borderWidth: 2,
      borderColor: C.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    tierCheckActive: { backgroundColor: C.primary, borderColor: C.primary },

    pillRow: { flexDirection: 'row', gap: 8 },
    pill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 14,
      paddingVertical: 9,
      borderRadius: 20,
      borderWidth: 1.5,
      borderColor: C.borderLight,
      backgroundColor: C.surface,
    },
    pillFlex: { flex: 1, justifyContent: 'center' },
    pillActive: { backgroundColor: C.primary, borderColor: C.primary },
    pillAches: { borderColor: C.warning },
    pillAchesActive: { backgroundColor: C.warning, borderColor: C.warning },
    pillText: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: C.textSecondary },
    pillTextActive: { color: C.textInverse },

    achesHint: {
      fontSize: 12,
      fontFamily: 'Inter_400Regular',
      color: C.warning,
      marginTop: 8,
      fontStyle: 'italic' as const,
    },

    startButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: C.primary,
      borderRadius: 14,
      paddingVertical: 15,
    },
    startButtonDisabled: { backgroundColor: C.surfaceTertiary },
    startButtonText: { fontSize: 16, fontFamily: 'Inter_700Bold', color: C.textInverse },
    footer: {
      paddingHorizontal: 20,
      paddingTop: 10,
      borderTopWidth: 1,
      borderTopColor: C.borderLight,
      backgroundColor: C.background,
    },

    stepContent: {
      flex: 1,
      paddingHorizontal: 24,
      paddingTop: 32,
      alignItems: 'center',
      paddingBottom: 20,
    },
    questionIcon: {
      width: 56,
      height: 56,
      borderRadius: 16,
      backgroundColor: C.primaryMuted,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 20,
    },
    // Wraps BodyDiagram so it reads as a card like everywhere else the diagram
    // appears (Recover's sheet, the Stats panel) instead of floating directly
    // on the screen background — the diagram's own panel stays dark regardless
    // of theme, so without this frame it has nothing to visually separate it
    // from a dark-mode background of the same colour.
    diagramCard: {
      backgroundColor: C.surface,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: C.border,
      padding: 8,
      width: '100%',
      alignItems: 'center',
      ...cardShadow(C.shadow),
    },
    question: {
      fontSize: 24,
      fontFamily: 'Inter_700Bold',
      color: C.text,
      textAlign: 'center',
      marginBottom: 6,
    },
    questionSub: {
      fontSize: 15,
      fontFamily: 'Inter_400Regular',
      color: C.textSecondary,
      textAlign: 'center',
      marginBottom: 20,
    },
    areaButtons: { width: '100%', gap: 10 },
    areaButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      backgroundColor: C.surface,
      borderRadius: 14,
      paddingHorizontal: 16,
      paddingVertical: 14,
      borderWidth: 1,
      borderColor: C.borderLight,
    },
    areaIconWrap: {
      width: 44,
      height: 44,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    areaCatContent: { flex: 1 },
    areaLabel: { fontSize: 15, fontFamily: 'Inter_600SemiBold', color: C.text },
    areaSublabel: {
      fontSize: 12,
      fontFamily: 'Inter_400Regular',
      color: C.textSecondary,
      marginTop: 1,
    },
    sectionHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginTop: 14,
      marginBottom: 8,
    },
    sectionHeaderLabel: {
      fontSize: 11,
      fontFamily: 'Inter_700Bold',
      textTransform: 'uppercase' as const,
      letterSpacing: 0.6,
    },

    testWeekBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      backgroundColor: 'rgba(245,166,35,0.10)',
      borderRadius: 16,
      borderWidth: 1,
      borderColor: 'rgba(245,166,35,0.30)',
      padding: 16,
      marginBottom: 16,
    },
    testWeekBannerIcon: {
      width: 44,
      height: 44,
      borderRadius: 12,
      backgroundColor: 'rgba(245,166,35,0.15)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    testWeekBannerContent: { flex: 1 },
    testWeekBannerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
    testWeekBadge: {
      backgroundColor: C.pbFlash,
      borderRadius: 6,
      paddingHorizontal: 8,
      paddingVertical: 2,
    },
    testWeekBadgeText: {
      fontSize: 10,
      fontFamily: 'Inter_700Bold',
      color: C.pbFlashText,
      letterSpacing: 0.6,
    },
    testWeekBannerHeadline: {
      fontSize: 16,
      fontFamily: 'Inter_700Bold',
      color: C.text,
      marginBottom: 2,
    },
    testWeekBannerSub: {
      fontSize: 12,
      fontFamily: 'Inter_400Regular',
      color: C.textSecondary,
    },
    startButtonTestWeek: {
      backgroundColor: C.pbFlash,
    },
    testDeferBanner: {
      flexDirection: 'row',
      gap: 10,
      backgroundColor: C.warningLight,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: C.warning + '4d',
      padding: 14,
      marginBottom: 16,
    },
    testDeferText: {
      fontSize: 13,
      fontFamily: 'Inter_500Medium',
      color: C.text,
      lineHeight: 18,
      marginBottom: 6,
    },
    testDeferLink: {
      fontSize: 13,
      fontFamily: 'Inter_700Bold',
      color: C.warning,
    },
    testDeferConfirm: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: C.primarySurface,
      borderRadius: 12,
      padding: 12,
      marginBottom: 16,
    },
    testDeferConfirmText: {
      flex: 1,
      fontSize: 12,
      fontFamily: 'Inter_500Medium',
      color: C.primary,
      lineHeight: 17,
    },
  });
}
