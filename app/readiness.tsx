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

type Step = 'equipment' | 'aches' | 'painCategory' | 'painRegion' | 'energy' | 'time';

const ALL_TIERS: EquipmentTier[] = ['bodyweight', 'bands', 'dumbbells', 'kettlebells', 'fullgym'];

const TIER_DESCRIPTIONS: Record<EquipmentTier, string> = {
  bodyweight: 'No equipment needed',
  bands: 'Resistance bands only',
  dumbbells: 'Dumbbells available',
  kettlebells: 'Kettlebells available',
  fullgym: 'Full gym access',
};

export default function ReadinessScreen() {
  const insets = useSafeAreaInsets();
  const C = useColors();
  const params = useLocalSearchParams<{ sessionType: string; isTestWeek: string }>();
  const sessionType = (params.sessionType || 'squat') as SessionType;
  const isTestWeek = params.isTestWeek === 'true';

  const { equipmentTiers, userProfile, lastReadinessEnergy, lastReadinessTime, setLastReadiness } = useAppStore();

  const isBeginnerExperience = userProfile.experienceLevel === 'beginner';
  const availableTiers: EquipmentTier[] = isBeginnerExperience
    ? ['bodyweight', 'bands']
    : ALL_TIERS;

  const initialTiers = (equipmentTiers && equipmentTiers.length > 0)
    ? equipmentTiers.filter(t => availableTiers.includes(t))
    : ['bodyweight' as EquipmentTier];

  const [step, setStep] = useState<Step>('equipment');
  const [selectedEquipments, setSelectedEquipments] = useState<EquipmentTier[]>(
    initialTiers.length > 0 ? initialTiers : ['bodyweight']
  );
  const [hasAches, setHasAches] = useState(false);
  const [painCategory, setPainCategory] = useState<keyof typeof PAIN_CATEGORIES | undefined>();
  const [painRegion, setPainRegion] = useState<PainRegion | undefined>();
  const [energy, setEnergy] = useState<EnergyLevel>(lastReadinessEnergy);

  const BYPASS_TYPES: SessionType[] = ['prehab', 'flexibility'];
  useEffect(() => {
    if (BYPASS_TYPES.includes(sessionType)) {
      const tier = getEffectiveTier(selectedEquipments);
      router.replace({
        pathname: '/session',
        params: { sessionType, hasAches: 'false', painRegion: '', energy: 'normal', timeAvailable: '60', isTestWeek: 'false', equipment: tier },
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
        const next = prev.filter(t => t !== tier);
        return next.length > 0 ? next : [tier];
      }
      return [...prev, tier];
    });
  };

  const handleEquipmentNext = () => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (sessionType === 'conditioning') {
      setStep('energy');
    } else {
      setStep('aches');
    }
  };

  const handleAches = (val: boolean) => {
    hapticTap();
    setHasAches(val);
    if (val) {
      setStep('painCategory');
    } else {
      if (isTestWeek) {
        router.push({
          pathname: '/session',
          params: { sessionType, hasAches: 'false', painRegion: '', energy: 'normal', timeAvailable: '60', isTestWeek: 'true', equipment: getEffectiveTier(selectedEquipments) },
        });
      } else {
        setStep('energy');
      }
    }
  };

  const handlePainCategory = (cat: keyof typeof PAIN_CATEGORIES) => {
    hapticTap();
    setPainCategory(cat);
    setStep('painRegion');
  };

  const handlePainRegion = (region: PainRegion) => {
    hapticTap();
    setPainRegion(region);
    if (isTestWeek) {
      router.push({
        pathname: '/session',
        params: { sessionType, hasAches: 'true', painRegion: region, energy: 'normal', timeAvailable: '60', isTestWeek: 'true', equipment: getEffectiveTier(selectedEquipments) },
      });
    } else {
      setStep('energy');
    }
  };

  const handleEnergy = (level: EnergyLevel) => {
    hapticTap();
    setEnergy(level);
    setStep('time');
  };

  const handleTime = (time: TimeAvailable) => {
    hapticTap();
    setLastReadiness(energy, time);
    router.push({
      pathname: '/session',
      params: {
        sessionType,
        hasAches: hasAches ? 'true' : 'false',
        painRegion: painRegion || '',
        energy: energy || 'normal',
        timeAvailable: time,
        isTestWeek: 'false',
        equipment: getEffectiveTier(selectedEquipments),
      },
    });
  };

  const goBack = () => {
    switch (step) {
      case 'equipment': router.back(); break;
      case 'aches': setStep('equipment'); break;
      case 'painCategory': setStep('aches'); break;
      case 'painRegion': setStep('painCategory'); break;
      case 'energy':
        if (sessionType === 'conditioning') setStep('equipment');
        else setStep(hasAches ? 'painRegion' : 'aches');
        break;
      case 'time': setStep('energy'); break;
    }
  };

  const webTopInset = Platform.OS === 'web' ? 67 : 0;

  const getStepInfo = () => {
    if (sessionType === 'conditioning') {
      switch (step) {
        case 'equipment': return { num: 1, total: 3 };
        case 'energy': return { num: 2, total: 3 };
        case 'time': return { num: 3, total: 3 };
        default: return { num: 1, total: 3 };
      }
    }
    if (isTestWeek) {
      const total = hasAches ? 4 : 2;
      if (step === 'equipment') return { num: 1, total };
      if (step === 'aches') return { num: 2, total };
      if (step === 'painCategory') return { num: 3, total: 4 };
      return { num: 4, total: 4 };
    }
    const total = hasAches ? 6 : 4;
    switch (step) {
      case 'equipment': return { num: 1, total };
      case 'aches': return { num: 2, total };
      case 'painCategory': return { num: 3, total };
      case 'painRegion': return { num: 4, total };
      case 'energy': return { num: hasAches ? 5 : 3, total };
      case 'time': return { num: hasAches ? 6 : 4, total };
    }
  };

  const stepInfo = getStepInfo();

  const CATEGORY_ICONS: Record<string, { icon: keyof typeof Ionicons.glyphMap; color: string }> = {
    upper: { icon: 'hand-left-outline', color: '#4285f4' },
    torso: { icon: 'swap-vertical-outline', color: '#e65100' },
    lower: { icon: 'footsteps-outline', color: C.primary },
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
  };

  const effectiveTier = getEffectiveTier(selectedEquipments);
  const styles = useMemo(() => makeStyles(C), [C]);

  const renderStep = () => {
    switch (step) {
      case 'equipment':
        return (
          <Animated.View key="equipment" entering={FadeInDown.duration(400)} style={styles.stepContent}>
            <View style={styles.questionIcon}>
              <Ionicons name="barbell-outline" size={28} color={C.primary} />
            </View>
            <Text style={styles.question}>What equipment do you have?</Text>
            <Text style={styles.questionSub}>Check everything available today</Text>
            {isBeginnerExperience && (
              <View style={styles.beginnerNote}>
                <Ionicons name="shield-checkmark-outline" size={14} color={C.primary} />
                <Text style={styles.beginnerNoteText}>Bodyweight and bands — perfect for building safe foundations</Text>
              </View>
            )}
            {selectedEquipments.length > 0 && (
              <View style={styles.effectiveTierBadge}>
                <Text style={styles.effectiveTierText}>
                  Best match: <Text style={{ fontFamily: 'Inter_600SemiBold', color: C.primary }}>{getEquipmentLabel(effectiveTier)}</Text>
                </Text>
              </View>
            )}
            <View style={styles.areaButtons}>
              {ALL_TIERS.map((tier) => {
                const isAvailable = availableTiers.includes(tier);
                const isActive = selectedEquipments.includes(tier);
                return (
                  <Pressable
                    key={tier}
                    onPress={() => handleTierToggle(tier)}
                    style={({ pressed }) => [
                      styles.areaButton,
                      isActive && styles.areaButtonActive,
                      !isAvailable && styles.areaButtonLocked,
                      pressed && isAvailable && { opacity: 0.8, transform: [{ scale: 0.97 }] },
                    ]}
                    testID={`equipment-${tier}`}
                  >
                    <View style={[styles.areaIconWrap, { backgroundColor: isActive ? C.primary : isAvailable ? C.primaryMuted : C.surfaceTertiary }]}>
                      <Ionicons
                        name={getEquipmentIcon(tier) as keyof typeof Ionicons.glyphMap}
                        size={22}
                        color={isActive ? C.textInverse : isAvailable ? C.primary : C.textTertiary}
                      />
                    </View>
                    <View style={styles.areaCatContent}>
                      <Text style={[styles.areaLabel, isActive && { color: C.primary }, !isAvailable && { color: C.textTertiary }]}>{getEquipmentLabel(tier)}</Text>
                      <Text style={styles.areaSublabel}>{isAvailable ? TIER_DESCRIPTIONS[tier] : 'Update experience level in profile to unlock'}</Text>
                    </View>
                    {!isAvailable
                      ? <Ionicons name="lock-closed-outline" size={18} color={C.textTertiary} />
                      : (
                        <View style={[styles.checkbox, isActive && styles.checkboxSelected]}>
                          {isActive && <Ionicons name="checkmark" size={13} color={C.textInverse} />}
                        </View>
                      )
                    }
                  </Pressable>
                );
              })}
            </View>
            <Pressable
              onPress={handleEquipmentNext}
              disabled={selectedEquipments.length === 0}
              style={({ pressed }) => [
                styles.nextButton,
                selectedEquipments.length === 0 && styles.nextButtonDisabled,
                pressed && selectedEquipments.length > 0 && { opacity: 0.9, transform: [{ scale: 0.98 }] },
              ]}
            >
              <Text style={[styles.nextButtonText, selectedEquipments.length === 0 && styles.nextButtonTextDisabled]}>Next</Text>
              <Ionicons name="arrow-forward" size={18} color={selectedEquipments.length > 0 ? C.textInverse : C.textTertiary} />
            </Pressable>
          </Animated.View>
        );

      case 'aches':
        return (
          <Animated.View key="aches" entering={FadeInDown.duration(400)} style={styles.stepContent}>
            <View style={styles.questionIcon}>
              <Ionicons name="medical-outline" size={28} color={C.primary} />
            </View>
            <Text style={styles.question}>Any aches or pains today?</Text>
            <Text style={styles.questionSub}>This helps us adjust your workout</Text>
            <View style={styles.bigButtons}>
              <Pressable
                onPress={() => handleAches(true)}
                style={({ pressed }) => [styles.bigButton, styles.bigButtonOutline, pressed && { opacity: 0.8 }]}
                testID="aches-yes"
              >
                <Ionicons name="alert-circle-outline" size={28} color={C.warning} />
                <Text style={styles.bigButtonText}>Yes</Text>
              </Pressable>
              <Pressable
                onPress={() => handleAches(false)}
                style={({ pressed }) => [styles.bigButton, styles.bigButtonFilled, pressed && { opacity: 0.8 }]}
                testID="aches-no"
              >
                <Ionicons name="checkmark-circle-outline" size={28} color={C.textInverse} />
                <Text style={[styles.bigButtonText, { color: C.textInverse }]}>No</Text>
              </Pressable>
            </View>
          </Animated.View>
        );

      case 'painCategory':
        return (
          <Animated.View key="painCat" entering={FadeInDown.duration(400)} style={styles.stepContent}>
            <View style={styles.questionIcon}>
              <Ionicons name="body-outline" size={28} color={C.warning} />
            </View>
            <Text style={styles.question}>What area?</Text>
            <Text style={styles.questionSub}>Select the body region</Text>
            <View style={styles.areaButtons}>
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

      case 'painRegion':
        const regions = painCategory ? PAIN_CATEGORIES[painCategory as keyof typeof PAIN_CATEGORIES].regions : [];
        return (
          <Animated.View key="painRegion" entering={FadeInDown.duration(400)} style={styles.stepContent}>
            <View style={styles.questionIcon}>
              <Ionicons name="locate-outline" size={28} color={C.warning} />
            </View>
            <Text style={styles.question}>Specific area?</Text>
            <Text style={styles.questionSub}>We will swap exercises for this region</Text>
            <View style={styles.areaButtons}>
              {regions.map((r) => (
                <Pressable
                  key={r.id}
                  onPress={() => handlePainRegion(r.id)}
                  style={({ pressed }) => [styles.areaButton, pressed && { opacity: 0.8, transform: [{ scale: 0.97 }] }]}
                  testID={`pain-region-${r.id}`}
                >
                  <View style={[styles.areaIconWrap, { backgroundColor: C.warningLight }]}>
                    <Ionicons name={REGION_ICONS[r.id]} size={22} color={C.warning} />
                  </View>
                  <Text style={[styles.areaLabel, { flex: 1 }]}>{r.label}</Text>
                  <Ionicons name="chevron-forward" size={18} color={C.textTertiary} />
                </Pressable>
              ))}
            </View>
          </Animated.View>
        );

      case 'energy':
        return (
          <Animated.View key="energy" entering={FadeInDown.duration(400)} style={styles.stepContent}>
            <View style={styles.questionIcon}>
              <Ionicons name="flash-outline" size={28} color={C.primary} />
            </View>
            <Text style={styles.question}>How is your energy?</Text>
            <Text style={styles.questionSub}>Sets and finisher adjust to match</Text>
            <View style={styles.energyButtons}>
              {([
                { level: 'low' as EnergyLevel, label: 'Low', sublabel: 'Fewer sets, easy finisher', icon: 'battery-dead-outline' as const, color: C.textTertiary },
                { level: 'normal' as EnergyLevel, label: 'Normal', sublabel: 'Standard session', icon: 'battery-half-outline' as const, color: C.primary },
                { level: 'high' as EnergyLevel, label: 'High', sublabel: 'Extra set, harder finisher', icon: 'battery-full-outline' as const, color: C.primaryLight },
              ]).map((item) => (
                <Pressable
                  key={item.level}
                  onPress={() => handleEnergy(item.level)}
                  style={({ pressed }) => [
                    styles.energyButton,
                    energy === item.level && styles.energyButtonSelected,
                    pressed && { opacity: 0.8, transform: [{ scale: 0.97 }] },
                  ]}
                  testID={`energy-${item.level}`}
                >
                  <View style={[styles.energyIconWrap, { backgroundColor: item.level === 'normal' ? C.primaryMuted : C.surfaceTertiary }]}>
                    <Ionicons name={item.icon} size={22} color={item.color} />
                  </View>
                  <View style={styles.energyContent}>
                    <Text style={styles.energyLabel}>{item.label}</Text>
                    <Text style={styles.energySublabel}>{item.sublabel}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={C.textTertiary} />
                </Pressable>
              ))}
            </View>
          </Animated.View>
        );

      case 'time':
        return (
          <Animated.View key="time" entering={FadeInDown.duration(400)} style={styles.stepContent}>
            <View style={styles.questionIcon}>
              <Ionicons name="time-outline" size={28} color={C.primary} />
            </View>
            <Text style={styles.question}>How much time?</Text>
            <Text style={styles.questionSub}>Shorter sessions focus on main lifts</Text>
            <View style={styles.energyButtons}>
              {([
                { time: '30' as TimeAvailable, label: '30 min', sublabel: 'Main lift + 1 accessory', icon: 'timer-outline' as const },
                { time: '45' as TimeAvailable, label: '45 min', sublabel: 'Main lift + accessories + finisher', icon: 'time-outline' as const },
                { time: '60' as TimeAvailable, label: '60 min', sublabel: 'Full session with warm-up', icon: 'hourglass-outline' as const },
              ]).map((item) => (
                <Pressable
                  key={item.time}
                  onPress={() => handleTime(item.time)}
                  style={({ pressed }) => [
                    styles.energyButton,
                    lastReadinessTime === item.time && styles.energyButtonSelected,
                    pressed && { opacity: 0.8, transform: [{ scale: 0.97 }] },
                  ]}
                  testID={`time-${item.time}`}
                >
                  <View style={[styles.energyIconWrap, { backgroundColor: C.primaryMuted }]}>
                    <Ionicons name={item.icon} size={22} color={C.primary} />
                  </View>
                  <View style={styles.energyContent}>
                    <Text style={styles.energyLabel}>{item.label}</Text>
                    <Text style={styles.energySublabel}>{item.sublabel}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={C.textTertiary} />
                </Pressable>
              ))}
            </View>
          </Animated.View>
        );
    }
  };

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

      <View style={styles.progressContainer}>
        <View style={styles.progressTrack}>
          <Animated.View style={[styles.progressFill, { width: `${(stepInfo.num / stepInfo.total) * 100}%` }]} />
        </View>
        <Text style={styles.stepIndicator}>Step {stepInfo.num} of {stepInfo.total}</Text>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ flexGrow: 1 }} showsVerticalScrollIndicator={false}>
        {renderStep()}
      </ScrollView>
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
    progressFill: { height: '100%', backgroundColor: C.primary, borderRadius: 2 },
    stepIndicator: { fontSize: 12, fontFamily: 'Inter_500Medium', color: C.textTertiary, textAlign: 'center' },
    stepContent: { flex: 1, paddingHorizontal: 24, paddingTop: 32, alignItems: 'center', paddingBottom: 20 },
    questionIcon: { width: 56, height: 56, borderRadius: 16, backgroundColor: C.primaryMuted, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
    question: { fontSize: 24, fontFamily: 'Inter_700Bold', color: C.text, textAlign: 'center', marginBottom: 6 },
    questionSub: { fontSize: 15, fontFamily: 'Inter_400Regular', color: C.textSecondary, textAlign: 'center', marginBottom: 20 },
    effectiveTierBadge: { backgroundColor: C.primaryMuted, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6, marginBottom: 12, borderWidth: 1, borderColor: C.primaryLight },
    effectiveTierText: { fontSize: 12, fontFamily: 'Inter_400Regular', color: C.textSecondary },
    beginnerNote: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.primaryMuted, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 12, borderWidth: 1, borderColor: C.primaryLight },
    beginnerNoteText: { flex: 1, fontSize: 12, fontFamily: 'Inter_400Regular', color: C.text },
    bigButtons: { flexDirection: 'row', gap: 14, width: '100%' },
    bigButton: { flex: 1, paddingVertical: 28, borderRadius: 16, alignItems: 'center', gap: 10 },
    bigButtonOutline: { backgroundColor: C.surface, borderWidth: 2, borderColor: C.border },
    bigButtonFilled: { backgroundColor: C.primary },
    bigButtonText: { fontSize: 18, fontFamily: 'Inter_600SemiBold', color: C.text },
    areaButtons: { width: '100%', gap: 10 },
    areaButton: {
      flexDirection: 'row', alignItems: 'center', gap: 14,
      backgroundColor: C.surface, borderRadius: 14,
      paddingHorizontal: 16, paddingVertical: 14,
      borderWidth: 1, borderColor: C.borderLight,
    },
    areaButtonActive: { borderColor: C.primary, backgroundColor: C.primarySurface },
    areaButtonLocked: { opacity: 0.6 },
    areaIconWrap: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    areaCatContent: { flex: 1 },
    areaLabel: { fontSize: 15, fontFamily: 'Inter_600SemiBold', color: C.text },
    areaSublabel: { fontSize: 12, fontFamily: 'Inter_400Regular', color: C.textSecondary, marginTop: 1 },
    checkbox: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },
    checkboxSelected: { backgroundColor: C.primary, borderColor: C.primary },
    nextButton: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
      backgroundColor: C.primary, borderRadius: 14, paddingVertical: 16,
      width: '100%', marginTop: 20,
    },
    nextButtonDisabled: { backgroundColor: C.surfaceTertiary },
    nextButtonText: { fontSize: 16, fontFamily: 'Inter_700Bold', color: C.textInverse },
    nextButtonTextDisabled: { color: C.textTertiary },
    energyButtons: { width: '100%', gap: 10 },
    energyButton: {
      flexDirection: 'row', alignItems: 'center', gap: 14,
      backgroundColor: C.surface, borderRadius: 14,
      paddingHorizontal: 16, paddingVertical: 14,
      borderWidth: 1, borderColor: C.borderLight,
    },
    energyButtonSelected: { borderColor: C.primary, backgroundColor: C.primarySurface },
    energyIconWrap: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    energyContent: { flex: 1 },
    energyLabel: { fontSize: 16, fontFamily: 'Inter_600SemiBold', color: C.text },
    energySublabel: { fontSize: 12, fontFamily: 'Inter_400Regular', color: C.textSecondary, marginTop: 1 },
  });
}
