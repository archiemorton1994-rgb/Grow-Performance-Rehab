import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Platform,
  ScrollView,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useColors } from '@/constants/colors';
import { EquipmentTier, EnergyLevel, PainRegion, SessionType, TimeAvailable, PAIN_CATEGORIES, TIER_ORDER, useAppStore } from '@/lib/store';
import { getSessionLabel, getSessionSubtitle, getEquipmentLabel, getEquipmentIcon, getEffectiveTier } from '@/lib/workout-engine';

type Step = 'main' | 'painCategory' | 'painRegion' | 'prehabFocus';

const ALL_TIERS: EquipmentTier[] = ['bodyweight', 'bands', 'dumbbells', 'kettlebells', 'barbell', 'fullgym'];

const TIER_DESCRIPTIONS: Record<EquipmentTier, string> = {
  bodyweight: 'No equipment needed',
  bands: 'Resistance bands only',
  dumbbells: 'Dumbbells available',
  kettlebells: 'Kettlebells available',
  barbell: 'Barbell and squat rack',
  fullgym: 'Everything - cables, machines, full setup',
};

export default function ReadinessScreen() {
  const insets = useSafeAreaInsets();
  const C = useColors();
  const params = useLocalSearchParams<{
    sessionType: string;
    isTestWeek: string;
    energy?: string;
    timeAvailable?: string;
  }>();
  const sessionType = (params.sessionType || 'squat') as SessionType;
  const isTestWeek = params.isTestWeek === 'true';

  const { equipmentTiers, userProfile, lastReadinessEnergy, lastReadinessTime, lastPainRegion, setLastReadiness } = useAppStore();

  const isBeginnerExperience = userProfile.experienceLevel === 'beginner';
  const availableTiers: EquipmentTier[] = isBeginnerExperience
    ? ['bodyweight', 'bands']
    : ALL_TIERS;

  const initialTiers = (equipmentTiers && equipmentTiers.length > 0)
    ? equipmentTiers.filter(t => availableTiers.includes(t))
    : ['bodyweight' as EquipmentTier];

  const [step, setStep] = useState<Step>('main');
  const [selectedEquipments, setSelectedEquipments] = useState<EquipmentTier[]>(
    initialTiers.length > 0 ? initialTiers : ['bodyweight']
  );
  const [hasAches, setHasAches] = useState(false);
  const [painCategory, setPainCategory] = useState<keyof typeof PAIN_CATEGORIES | undefined>();
  const [painRegion, setPainRegion] = useState<PainRegion | undefined>();
  const [energy, setEnergy] = useState<EnergyLevel>(lastReadinessEnergy);
  const [timeAvailable, setTimeAvailable] = useState<TimeAvailable>(lastReadinessTime);

  useEffect(() => {
    if (sessionType === 'prehab') {
      setStep('prehabFocus');
    } else if (sessionType === 'flexibility') {
      const tier = getEffectiveTier(selectedEquipments);
      router.replace({
        pathname: '/session',
        params: { sessionType, hasAches: 'false', painRegion: '', energy: 'normal', timeAvailable: '60', isTestWeek: 'false', equipment: tier },
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

  const handleStart = () => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (hasAches) {
      setStep('painCategory');
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

  const handlePainCategory = (cat: keyof typeof PAIN_CATEGORIES) => {
    hapticTap();
    setPainCategory(cat);
    setStep('painRegion');
  };

  const handleSkipToAllRegions = () => {
    hapticTap();
    setPainCategory(undefined);
    setStep('painRegion');
  };

  const handlePainRegion = (region: PainRegion) => {
    hapticTap();
    setPainRegion(region);
    setLastReadiness(energy, timeAvailable, region);
    if (isTestWeek) {
      router.push({
        pathname: '/session',
        params: {
          sessionType,
          hasAches: 'true',
          painRegion: region,
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
          painRegion: region,
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
      },
    });
  };

  const goBack = () => {
    switch (step) {
      case 'main': router.back(); break;
      case 'prehabFocus': router.back(); break;
      case 'painCategory': setStep('main'); break;
      case 'painRegion': setStep('painCategory'); break;
    }
  };

  const webTopInset = Platform.OS === 'web' ? 67 : 0;
  const effectiveTier = getEffectiveTier(selectedEquipments);
  const styles = useMemo(() => makeStyles(C), [C]);

  const CATEGORY_ICONS: Record<string, { icon: keyof typeof Ionicons.glyphMap; color: string }> = {
    upper: { icon: 'hand-left-outline', color: '#4285f4' },
    torso: { icon: 'swap-vertical-outline', color: '#e65100' },
    lower: { icon: 'footsteps-outline', color: C.primary },
    upper_muscles: { icon: 'barbell-outline', color: '#9c27b0' },
    lower_muscles: { icon: 'walk-outline', color: '#ff5722' },
  };

  const REGION_ICONS: Record<PainRegion, keyof typeof Ionicons.glyphMap> = {
    front_shoulder: 'arrow-up-outline',
    rear_shoulder: 'arrow-down-outline',
    elbow_wrist: 'hand-right-outline',
    neck: 'resize-outline',
    lower_back: 'chevron-down-circle-outline',
    upper_back: 'chevron-up-circle-outline',
    core_ribs: 'ellipse-outline',
    knee: 'radio-button-on-outline',
    hip_groin: 'contract-outline',
    ankle_achilles: 'footsteps-outline',
    calf_shin: 'trending-down-outline',
    chest: 'body-outline',
    bicep: 'hand-right-outline',
    tricep: 'hand-left-outline',
    quads: 'walk-outline',
    hamstrings: 'trending-down-outline',
    glutes: 'ellipse-outline',
    lat_mid_back: 'arrow-back-circle-outline',
  };

  const renderMain = () => (
    <Animated.View key="main" entering={FadeInDown.duration(350)} style={{ flex: 1 }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.mainContent}
      >
        {/* Equipment */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Equipment today</Text>
          {isBeginnerExperience && (
            <View style={styles.beginnerNote}>
              <Ionicons name="shield-checkmark-outline" size={13} color={C.primary} />
              <Text style={styles.beginnerNoteText}>No Equipment & bands - great for building safe foundations</Text>
            </View>
          )}
          {selectedEquipments.length > 0 && (
            <View style={styles.effectiveTierBadge}>
              <Text style={styles.effectiveTierText}>
                Best match:{' '}
                <Text style={{ fontFamily: 'Inter_600SemiBold', color: C.primary }}>{getEquipmentLabel(effectiveTier)}</Text>
              </Text>
            </View>
          )}
          <View style={styles.tierList}>
            {ALL_TIERS.map((tier) => {
              const isAvailable = availableTiers.includes(tier);
              const isActive = selectedEquipments.includes(tier);
              return (
                <Pressable
                  key={tier}
                  onPress={() => handleTierToggle(tier)}
                  style={({ pressed }) => [
                    styles.tierRow,
                    isActive && styles.tierRowActive,
                    !isAvailable && styles.tierRowLocked,
                    pressed && isAvailable && { opacity: 0.8 },
                  ]}
                  testID={`equipment-${tier}`}
                >
                  <View style={[styles.tierIcon, { backgroundColor: isActive ? C.primary : isAvailable ? C.primaryMuted : C.surfaceTertiary }]}>
                    <Ionicons
                      name={getEquipmentIcon(tier) as keyof typeof Ionicons.glyphMap}
                      size={18}
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
                    ? <Ionicons name="lock-closed-outline" size={16} color={C.textTertiary} />
                    : (
                      <View style={[styles.tierCheck, isActive && styles.tierCheckActive]}>
                        {isActive && <Ionicons name="checkmark" size={12} color={C.textInverse} />}
                      </View>
                    )
                  }
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.divider} />

        {/* Aches */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Any pain or soreness?</Text>
          <View style={styles.pillRow}>
            <Pressable
              onPress={() => { hapticTap(); setHasAches(false); }}
              style={[styles.pill, !hasAches && styles.pillActive]}
              testID="aches-no"
            >
              <Ionicons name="checkmark-circle-outline" size={16} color={!hasAches ? C.textInverse : C.textSecondary} />
              <Text style={[styles.pillText, !hasAches && styles.pillTextActive]}>No</Text>
            </Pressable>
            <Pressable
              onPress={() => { hapticTap(); setHasAches(true); }}
              style={[styles.pill, styles.pillAches, hasAches && styles.pillAchesActive]}
              testID="aches-yes"
            >
              <Ionicons name="alert-circle-outline" size={16} color={hasAches ? '#fff' : C.warning} />
              <Text style={[styles.pillText, { color: hasAches ? '#fff' : C.warning }]}>Yes →</Text>
            </Pressable>
          </View>
          {hasAches && (
            <Text style={styles.achesHint}>Tap Start to select which area - exercises will be adjusted</Text>
          )}
        </View>

        {!isTestWeek && (
          <>
            <View style={styles.divider} />

            {/* Energy */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Energy level</Text>
              <View style={styles.pillRow}>
                {([
                  { level: 'low' as EnergyLevel, label: 'Low', icon: 'battery-dead-outline' as const },
                  { level: 'normal' as EnergyLevel, label: 'Normal', icon: 'battery-half-outline' as const },
                  { level: 'high' as EnergyLevel, label: 'High', icon: 'battery-full-outline' as const },
                ]).map((item) => (
                  <Pressable
                    key={item.level}
                    onPress={() => { hapticTap(); setEnergy(item.level); }}
                    style={[styles.pill, styles.pillFlex, energy === item.level && styles.pillActive]}
                    testID={`energy-${item.level}`}
                  >
                    <Ionicons name={item.icon} size={15} color={energy === item.level ? C.textInverse : C.textSecondary} />
                    <Text style={[styles.pillText, energy === item.level && styles.pillTextActive]}>{item.label}</Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <View style={styles.divider} />

            {/* Time */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Time available</Text>
              <View style={styles.pillRow}>
                {([
                  { time: '30' as TimeAvailable, label: '30 min' },
                  { time: '45' as TimeAvailable, label: '45 min' },
                  { time: '60' as TimeAvailable, label: '60 min' },
                ]).map((item) => (
                  <Pressable
                    key={item.time}
                    onPress={() => { hapticTap(); setTimeAvailable(item.time); }}
                    style={[styles.pill, styles.pillFlex, timeAvailable === item.time && styles.pillActive]}
                    testID={`time-${item.time}`}
                  >
                    <Text style={[styles.pillText, timeAvailable === item.time && styles.pillTextActive]}>{item.label}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          </>
        )}

        <Pressable
          onPress={handleStart}
          disabled={selectedEquipments.length === 0}
          style={({ pressed }) => [
            styles.startButton,
            selectedEquipments.length === 0 && styles.startButtonDisabled,
            pressed && selectedEquipments.length > 0 && { opacity: 0.9, transform: [{ scale: 0.98 }] },
          ]}
          testID="readiness-start"
        >
          {hasAches
            ? <><Ionicons name="chevron-forward" size={18} color={C.textInverse} /><Text style={styles.startButtonText}>Next - select area</Text></>
            : <><Ionicons name="flash" size={18} color={C.textInverse} /><Text style={styles.startButtonText}>Start Session</Text></>
          }
        </Pressable>
      </ScrollView>
    </Animated.View>
  );

  const renderPrehabFocus = () => (
    <Animated.View key="prehabFocus" entering={FadeInDown.duration(350)} style={{ flex: 1 }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 32, alignItems: 'stretch' }}
      >
        <View style={[styles.questionIcon, { alignSelf: 'center', width: 48, height: 48, borderRadius: 14, marginBottom: 12 }]}>
          <Ionicons name="body-outline" size={24} color={C.primary} />
        </View>
        <Text style={[styles.question, { textAlign: 'center', fontSize: 20, marginBottom: 4 }]}>What area to target today?</Text>
        <Text style={[styles.questionSub, { textAlign: 'center', marginBottom: 14 }]}>Your circuit will focus on this region</Text>
        <View style={{ width: '100%', gap: 7 }}>
          <Pressable
            key="fullbody"
            onPress={() => handlePrehabFocus('fullbody')}
            style={({ pressed }) => [styles.areaButton, { borderColor: C.primary, backgroundColor: C.primarySurface, paddingVertical: 10 }, pressed && { opacity: 0.8, transform: [{ scale: 0.97 }] }]}
            testID="prehab-fullbody"
          >
            <View style={[styles.areaIconWrap, { backgroundColor: C.primaryMuted, width: 36, height: 36, borderRadius: 10 }]}>
              <Ionicons name="flash-outline" size={18} color={C.primary} />
            </View>
            <Text style={[styles.areaLabel, { flex: 1, color: C.primary }]}>Full body circuit</Text>
            <Ionicons name="chevron-forward" size={16} color={C.primary} />
          </Pressable>
          {(Object.keys(PAIN_CATEGORIES) as Array<keyof typeof PAIN_CATEGORIES>).map((catKey) => {
            const cat = PAIN_CATEGORIES[catKey];
            const iconInfo = CATEGORY_ICONS[catKey];
            return (
              <View key={catKey}>
                <View style={styles.sectionHeaderRow}>
                  <Ionicons name={iconInfo.icon} size={13} color={iconInfo.color} />
                  <Text style={[styles.sectionHeaderLabel, { color: iconInfo.color }]}>{cat.label}</Text>
                </View>
                {cat.regions.map((r) => (
                  <Pressable
                    key={r.id}
                    onPress={() => handlePrehabFocus(r.id)}
                    style={({ pressed }) => [styles.areaButton, { paddingVertical: 10, marginBottom: 7 }, pressed && { opacity: 0.8, transform: [{ scale: 0.97 }] }]}
                    testID={`prehab-region-${r.id}`}
                  >
                    <View style={[styles.areaIconWrap, { backgroundColor: C.primaryMuted, width: 36, height: 36, borderRadius: 10 }]}>
                      <Ionicons name={REGION_ICONS[r.id]} size={18} color={C.primary} />
                    </View>
                    <Text style={[styles.areaLabel, { flex: 1 }]}>{r.label}</Text>
                    <Ionicons name="chevron-forward" size={16} color={C.textTertiary} />
                  </Pressable>
                ))}
              </View>
            );
          })}
        </View>
      </ScrollView>
    </Animated.View>
  );

  const renderPainCategory = () => (
    <Animated.View key="painCat" entering={FadeInDown.duration(350)} style={styles.stepContent}>
      <View style={styles.questionIcon}>
        <Ionicons name="body-outline" size={28} color={C.warning} />
      </View>
      <Text style={styles.question}>Any pain or muscle soreness?</Text>
      <Text style={styles.questionSub}>Select the affected area - we'll adjust exercises</Text>
      <View style={styles.areaButtons}>
        <Pressable
          onPress={handleSkipToAllRegions}
          style={({ pressed }) => [
            styles.areaButton,
            { borderColor: C.warning, backgroundColor: C.warningLight },
            pressed && { opacity: 0.8, transform: [{ scale: 0.97 }] },
          ]}
          testID="pain-cat-all"
        >
          <View style={[styles.areaIconWrap, { backgroundColor: C.warning + '22' }]}>
            <Ionicons name="list-outline" size={24} color={C.warning} />
          </View>
          <View style={styles.areaCatContent}>
            <Text style={[styles.areaLabel, { color: C.warning }]}>All areas</Text>
            <Text style={styles.areaSublabel}>Skip straight to the region picker</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={C.warning} />
        </Pressable>
        {(Object.keys(PAIN_CATEGORIES) as Array<keyof typeof PAIN_CATEGORIES>).map((key) => {
          const cat = PAIN_CATEGORIES[key];
          const iconInfo = CATEGORY_ICONS[key];
          return (
            <Pressable
              key={key}
              onPress={() => handlePainCategory(key)}
              style={({ pressed }) => [styles.areaButton, pressed && { opacity: 0.8, transform: [{ scale: 0.97 }] }]}
              testID={`pain-cat-${key}`}
            >
              <View style={[styles.areaIconWrap, { backgroundColor: C.primaryMuted }]}>
                <Ionicons name={iconInfo.icon} size={24} color={iconInfo.color} />
              </View>
              <View style={styles.areaCatContent}>
                <Text style={styles.areaLabel}>{cat.label}</Text>
                <Text style={styles.areaSublabel}>{cat.regions.length} regions</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={C.textTertiary} />
            </Pressable>
          );
        })}
      </View>
    </Animated.View>
  );

  const renderPainRegion = () => {
    if (!painCategory) {
      return (
        <Animated.View key="painRegion-all" entering={FadeInDown.duration(350)} style={{ flex: 1 }}>
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 32, alignItems: 'stretch' }}
          >
            <View style={[styles.questionIcon, { alignSelf: 'center', width: 48, height: 48, borderRadius: 14, marginBottom: 12, backgroundColor: C.warningLight }]}>
              <Ionicons name="locate-outline" size={24} color={C.warning} />
            </View>
            <Text style={[styles.question, { textAlign: 'center', fontSize: 20, marginBottom: 4 }]}>Which area is affected?</Text>
            <Text style={[styles.questionSub, { textAlign: 'center', marginBottom: 14 }]}>We'll swap exercises for this region</Text>
            <View style={{ width: '100%', gap: 7 }}>
              {(Object.keys(PAIN_CATEGORIES) as Array<keyof typeof PAIN_CATEGORIES>).map((catKey) => {
                const cat = PAIN_CATEGORIES[catKey];
                const iconInfo = CATEGORY_ICONS[catKey];
                return (
                  <View key={catKey}>
                    <View style={styles.sectionHeaderRow}>
                      <Ionicons name={iconInfo.icon} size={13} color={iconInfo.color} />
                      <Text style={[styles.sectionHeaderLabel, { color: iconInfo.color }]}>{cat.label}</Text>
                    </View>
                    {cat.regions.map((r) => {
                      const isLast = lastPainRegion === r.id;
                      return (
                        <Pressable
                          key={r.id}
                          onPress={() => handlePainRegion(r.id)}
                          style={({ pressed }) => [styles.areaButton, { paddingVertical: 10, marginBottom: 7 }, isLast && { borderWidth: 1.5, borderColor: C.warning }, pressed && { opacity: 0.8, transform: [{ scale: 0.97 }] }]}
                          testID={`pain-region-${r.id}`}
                        >
                          <View style={[styles.areaIconWrap, { backgroundColor: C.warningLight, width: 36, height: 36, borderRadius: 10 }]}>
                            <Ionicons name={REGION_ICONS[r.id]} size={18} color={C.warning} />
                          </View>
                          <Text style={[styles.areaLabel, { flex: 1 }]}>{r.label}</Text>
                          {isLast && (
                            <View style={{ backgroundColor: C.warningLight, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, marginRight: 4 }}>
                              <Text style={{ fontSize: 10, color: C.warning, fontFamily: 'Inter_600SemiBold' }}>Last</Text>
                            </View>
                          )}
                          <Ionicons name="chevron-forward" size={16} color={C.textTertiary} />
                        </Pressable>
                      );
                    })}
                  </View>
                );
              })}
            </View>
          </ScrollView>
        </Animated.View>
      );
    }

    const regions = PAIN_CATEGORIES[painCategory].regions;
    return (
      <Animated.View key="painRegion" entering={FadeInDown.duration(350)} style={{ flex: 1 }}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ flexGrow: 1 }}
        >
          <View style={styles.stepContent}>
            <View style={styles.questionIcon}>
              <Ionicons name="locate-outline" size={28} color={C.warning} />
            </View>
            <Text style={styles.question}>Specific area?</Text>
            <Text style={styles.questionSub}>We will swap exercises for this region</Text>
            <View style={styles.areaButtons}>
              {regions.map((r) => {
                const isLast = lastPainRegion === r.id;
                return (
                  <Pressable
                    key={r.id}
                    onPress={() => handlePainRegion(r.id)}
                    style={({ pressed }) => [styles.areaButton, isLast && { borderWidth: 1.5, borderColor: C.warning }, pressed && { opacity: 0.8, transform: [{ scale: 0.97 }] }]}
                    testID={`pain-region-${r.id}`}
                  >
                    <View style={[styles.areaIconWrap, { backgroundColor: C.warningLight }]}>
                      <Ionicons name={REGION_ICONS[r.id]} size={22} color={C.warning} />
                    </View>
                    <Text style={[styles.areaLabel, { flex: 1 }]}>{r.label}</Text>
                    {isLast && (
                      <View style={{ backgroundColor: C.warningLight, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, marginRight: 4 }}>
                        <Text style={{ fontSize: 10, color: C.warning, fontFamily: 'Inter_600SemiBold' }}>Last</Text>
                      </View>
                    )}
                    <Ionicons name="chevron-forward" size={18} color={C.textTertiary} />
                  </Pressable>
                );
              })}
            </View>
          </View>
        </ScrollView>
      </Animated.View>
    );
  };

  const isPainStep = step === 'painCategory' || step === 'painRegion';

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
            <Animated.View style={[styles.progressFill, { width: step === 'painCategory' ? '50%' : '100%' }]} />
          </View>
          <Text style={styles.stepIndicator}>
            {step === 'painCategory' ? 'Step 1 of 2' : 'Step 2 of 2'} - Pain Region
          </Text>
        </View>
      )}

      {step === 'main' && renderMain()}
      {step === 'prehabFocus' && renderPrehabFocus()}
      {step === 'painCategory' && (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ flexGrow: 1 }} showsVerticalScrollIndicator={false}>
          {renderPainCategory()}
        </ScrollView>
      )}
      {step === 'painRegion' && renderPainRegion()}
    </View>
  );
}

function makeStyles(C: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: C.background },
    topBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 },
    backButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
    sessionInfo: { flex: 1, alignItems: 'center' },
    sessionLabel: { fontSize: 16, fontFamily: 'Inter_600SemiBold', color: C.text },
    sessionSub: { fontSize: 12, fontFamily: 'Inter_400Regular', color: C.textSecondary },
    progressContainer: { paddingHorizontal: 24, marginBottom: 8 },
    progressTrack: { height: 4, backgroundColor: C.surfaceTertiary, borderRadius: 2, overflow: 'hidden', marginBottom: 8 },
    progressFill: { height: '100%', backgroundColor: C.warning, borderRadius: 2 },
    stepIndicator: { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: C.textSecondary, textAlign: 'center' },

    mainContent: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 32 },
    section: { paddingVertical: 16 },
    sectionTitle: { fontSize: 14, fontFamily: 'Inter_700Bold', color: C.text, marginBottom: 10, textTransform: 'uppercase' as const, letterSpacing: 0.5 },
    divider: { height: 1, backgroundColor: C.borderLight },

    effectiveTierBadge: { backgroundColor: C.primaryMuted, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6, marginBottom: 10, borderWidth: 1, borderColor: C.primaryLight, alignSelf: 'flex-start' as const },
    effectiveTierText: { fontSize: 12, fontFamily: 'Inter_400Regular', color: C.textSecondary },
    beginnerNote: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.primaryMuted, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7, marginBottom: 10, borderWidth: 1, borderColor: C.primaryLight },
    beginnerNoteText: { flex: 1, fontSize: 12, fontFamily: 'Inter_400Regular', color: C.text },

    tierList: { gap: 8 },
    tierRow: {
      flexDirection: 'row', alignItems: 'center', gap: 12,
      backgroundColor: C.surface, borderRadius: 12,
      paddingHorizontal: 14, paddingVertical: 12,
      borderWidth: 1, borderColor: C.borderLight,
    },
    tierRowActive: { borderColor: C.primary, backgroundColor: C.primarySurface },
    tierRowLocked: { opacity: 0.55 },
    tierIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
    tierLabel: { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: C.text },
    tierSub: { fontSize: 11, fontFamily: 'Inter_400Regular', color: C.textSecondary, marginTop: 1 },
    tierCheck: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },
    tierCheckActive: { backgroundColor: C.primary, borderColor: C.primary },

    pillRow: { flexDirection: 'row', gap: 8 },
    pill: {
      flexDirection: 'row', alignItems: 'center', gap: 6,
      paddingHorizontal: 14, paddingVertical: 10,
      borderRadius: 20, borderWidth: 1.5, borderColor: C.borderLight,
      backgroundColor: C.surface,
    },
    pillFlex: { flex: 1, justifyContent: 'center' },
    pillActive: { backgroundColor: C.primary, borderColor: C.primary },
    pillAches: { borderColor: C.warning },
    pillAchesActive: { backgroundColor: C.warning, borderColor: C.warning },
    pillText: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: C.textSecondary },
    pillTextActive: { color: C.textInverse },

    achesHint: { fontSize: 12, fontFamily: 'Inter_400Regular', color: C.warning, marginTop: 8, fontStyle: 'italic' as const },

    startButton: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
      backgroundColor: C.primary, borderRadius: 14, paddingVertical: 17,
      marginTop: 24,
    },
    startButtonDisabled: { backgroundColor: C.surfaceTertiary },
    startButtonText: { fontSize: 16, fontFamily: 'Inter_700Bold', color: C.textInverse },

    stepContent: { flex: 1, paddingHorizontal: 24, paddingTop: 32, alignItems: 'center', paddingBottom: 20 },
    questionIcon: { width: 56, height: 56, borderRadius: 16, backgroundColor: C.primaryMuted, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
    question: { fontSize: 24, fontFamily: 'Inter_700Bold', color: C.text, textAlign: 'center', marginBottom: 6 },
    questionSub: { fontSize: 15, fontFamily: 'Inter_400Regular', color: C.textSecondary, textAlign: 'center', marginBottom: 20 },
    areaButtons: { width: '100%', gap: 10 },
    areaButton: {
      flexDirection: 'row', alignItems: 'center', gap: 14,
      backgroundColor: C.surface, borderRadius: 14,
      paddingHorizontal: 16, paddingVertical: 14,
      borderWidth: 1, borderColor: C.borderLight,
    },
    areaIconWrap: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    areaCatContent: { flex: 1 },
    areaLabel: { fontSize: 15, fontFamily: 'Inter_600SemiBold', color: C.text },
    areaSublabel: { fontSize: 12, fontFamily: 'Inter_400Regular', color: C.textSecondary, marginTop: 1 },
    sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 14, marginBottom: 8 },
    sectionHeaderLabel: { fontSize: 11, fontFamily: 'Inter_700Bold', textTransform: 'uppercase' as const, letterSpacing: 0.6 },
  });
}
