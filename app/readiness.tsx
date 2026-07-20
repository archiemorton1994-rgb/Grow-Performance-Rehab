import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { View, Text, Pressable, StyleSheet, Platform, ScrollView } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { EquipmentIcon } from '@/components/EquipmentIcon';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useColors } from '@/constants/colors';
import CoachMark, { SpotlightRect } from '@/components/CoachMark';
import {
  EquipmentTier,
  EnergyLevel,
  PainRegion,
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
} from '@/lib/workout-engine';
import { BodyDiagram } from '@/components/BodyDiagram';

type Step = 'main' | 'painRegion' | 'prehabFocus';

const ALL_TIERS: EquipmentTier[] = ['bodyweight', 'bands', 'dumbbells', 'kettlebells', 'fullgym'];

const TIER_DESCRIPTIONS: Record<EquipmentTier, string> = {
  bodyweight: 'No equipment',
  bands: 'Bands only',
  dumbbells: 'Available',
  kettlebells: 'Available',
  fullgym: 'Everything',
};

// ─── Readiness tutorial content ───────────────────────────────────────────

const READINESS_TUTORIAL = [
  {
    iconName: 'battery-half-outline',
    iconLabel: 'Energy',
    upArrowFraction: 0.25,
    title: 'How are you feeling?',
    body: 'Pick your energy honestly — low energy gets a lighter session, high energy pushes harder. We adjust the weight automatically.',
  },
  {
    iconName: 'time-outline',
    iconLabel: 'Time',
    upArrowFraction: 0.5,
    title: 'How long have you got?',
    body: '30 min = core lift only. 45 min adds accessories and prehab. 60 min is the full session with a finisher.',
  },
  {
    iconName: 'medical-outline',
    iconLabel: 'Pain',
    upArrowFraction: 0.75,
    title: 'Any pain today?',
    body: "Tap a region if anything is sore — we'll automatically swap exercises away from that area so you can train safely.",
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
  } = useAppStore();

  const isBeginnerExperience = userProfile.experienceLevel === 'beginner';
  const availableTiers: EquipmentTier[] = isBeginnerExperience
    ? ['bodyweight', 'bands']
    : ALL_TIERS;

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
  const [diagramPrehabRegion, setDiagramPrehabRegion] = useState<PainRegion | undefined>(undefined);
  const [painDiagramAreaH, setPainDiagramAreaH] = useState(0);
  const [coachStep, setCoachStep] = useState<number | null>(null);

  // ── Spotlight refs for each readiness tutorial section ──────────────────
  const energyRef = useRef<View>(null);
  const timeRef = useRef<View>(null);
  const painRef = useRef<View>(null);
  const [readinessSpotlight, setReadinessSpotlight] = useState<SpotlightRect | null>(null);

  // Measure the spotlighted section whenever the tutorial step changes.
  // Clear the spotlight immediately on step change to avoid showing a stale rect
  // from the previous step while the new measurement is pending (fast-tap safety).
  useEffect(() => {
    setReadinessSpotlight(null);
    if (coachStep === null) return;
    const refs = [energyRef, timeRef, painRef];
    const target = refs[coachStep];
    const timer = setTimeout(() => {
      target?.current?.measureInWindow((x, y, w, h) => {
        if (w > 0 && h > 0) {
          setReadinessSpotlight({
            top: y - 8,
            left: x - 8,
            width: w + 16,
            height: h + 16,
            borderRadius: 14,
          });
        }
      });
    }, 120);
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
    if (!readinessTutorialShown) {
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
      setStep('painRegion');
    } else {
      setLastReadiness(energy, timeAvailable);
      if (isTestWeek) {
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

  const handlePainRegion = (region: PainRegion | PainRegion[]) => {
    hapticTap();
    const primary = Array.isArray(region) ? region[0] : region;
    const regionParam = Array.isArray(region) ? region.join(',') : region;
    setPainRegion(primary);
    setLastReadiness(energy, timeAvailable, primary);
    if (isTestWeek) {
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
        },
      });
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
    }
  };

  const webTopInset = Platform.OS === 'web' ? 67 : 0;
  const webBottomInset = Platform.OS === 'web' ? 34 : 0;
  const effectiveTier = getEffectiveTier(selectedEquipments);
  const styles = useMemo(() => makeStyles(C), [C]);

  const renderMain = () => (
    <Animated.View key="main" entering={FadeInDown.duration(350)} style={{ flex: 1 }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        style={{ flex: 1 }}
        contentContainerStyle={styles.mainContent}
      >
        {isTestWeek && (
          <View style={styles.testWeekBanner}>
            <View style={styles.testWeekBannerIcon}>
              <Ionicons name="trophy" size={22} color="#F5A623" />
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
                AMRAP @ 90% — go all out. Your numbers don&apos;t lie.
              </Text>
            </View>
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
            {ALL_TIERS.map((tier) => {
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
                  ]}
                  testID={`equipment-${tier}`}
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
                  <View style={styles.tierText}>
                    <Text
                      numberOfLines={2}
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
          </View>
        </View>

        <View style={styles.divider} />

        {/* Aches — tutorial step 2 spotlight target */}
        <View style={styles.section} ref={painRef}>
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

        {!isTestWeek && (
          <>
            <View style={styles.divider} />

            {/* Energy — tutorial step 0 spotlight target */}
            <View style={styles.section} ref={energyRef}>
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

            {/* Time — tutorial step 1 spotlight target */}
            <View style={styles.section} ref={timeRef}>
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
            isTestWeek && styles.startButtonTestWeek,
            selectedEquipments.length === 0 && styles.startButtonDisabled,
            pressed &&
              selectedEquipments.length > 0 && { opacity: 0.9, transform: [{ scale: 0.98 }] },
          ]}
          testID="readiness-start"
        >
          {isTestWeek ? (
            <>
              <Ionicons name="trophy" size={18} color={C.textInverse} />
              <Text style={styles.startButtonText}>Begin Test</Text>
            </>
          ) : hasAches ? (
            <>
              <Ionicons name="arrow-forward" size={18} color={C.textInverse} />
              <Text style={styles.startButtonText}>Next — pick area →</Text>
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
        <BodyDiagram
          selected={diagramPrehabRegion}
          onSelect={setDiagramPrehabRegion}
          accentColor={C.primary}
          accentColorLight={C.primarySurface}
        />
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
          {"Tap one or more regions — we'll adjust exercises"}
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
          <BodyDiagram
            selectedRegions={diagramPainRegions}
            onSelect={togglePainRegion}
            accentColor={C.warning}
            accentColorLight={C.warningLight}
            maxWidth={painDiagramMaxWidth}
          />
        </View>
        <View style={{ width: '100%', minHeight: 52, justifyContent: 'flex-end' }}>
          {diagramPainRegions.length > 0 ? (
            <Pressable
              onPress={() => handlePainRegion(diagramPainRegions)}
              style={({ pressed }) => [
                styles.startButton,
                { width: '100%' },
                pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] },
              ]}
              testID="pain-region-confirm"
            >
              <Ionicons name="flash" size={18} color={C.textInverse} />
              <Text style={styles.startButtonText}>
                Continue
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
          ) : null}
        </View>
      </View>
    </Animated.View>
  );

  const isPainStep = step === 'painRegion';

  return (
    <View style={[styles.container, { paddingTop: insets.top + webTopInset }]}>
      <View style={styles.topBar}>
        <Pressable onPress={goBack} style={styles.backButton} testID="readiness-back">
          <Ionicons name="chevron-back" size={24} color={C.text} />
        </Pressable>
        <View style={styles.sessionInfo}>
          <Text style={styles.sessionLabel}>
            {isTestWeek ? 'Strength Test Week' : getSessionLabel(sessionType)}
          </Text>
          <Text style={styles.sessionSub}>
            {isTestWeek ? 'Strength Testing' : getSessionSubtitle(sessionType)}
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
          upArrowFraction={READINESS_TUTORIAL[coachStep].upArrowFraction}
          iconName={READINESS_TUTORIAL[coachStep].iconName}
          iconLabel={READINESS_TUTORIAL[coachStep].iconLabel}
          spotlightRect={readinessSpotlight ?? undefined}
        />
      )}
    </View>
  );
}

function makeStyles(C: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: C.background },
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
      minHeight: 58,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: C.surface,
      borderRadius: 12,
      paddingHorizontal: 10,
      paddingVertical: 8,
      borderWidth: 1,
      borderColor: C.borderLight,
    },
    tierRowActive: { borderColor: C.primary, backgroundColor: C.primarySurface },
    tierRowLocked: { opacity: 0.55 },
    tierIcon: {
      width: 30,
      height: 30,
      borderRadius: 9,
      alignItems: 'center',
      justifyContent: 'center',
    },
    tierText: { flex: 1 },
    tierLabel: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: C.text },
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
      backgroundColor: '#F5A623',
      borderRadius: 6,
      paddingHorizontal: 8,
      paddingVertical: 2,
    },
    testWeekBadgeText: {
      fontSize: 10,
      fontFamily: 'Inter_700Bold',
      color: '#fff',
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
      backgroundColor: '#F5A623',
    },
  });
}
