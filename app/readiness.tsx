import React, { useState } from 'react';
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
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import Colors from '@/constants/colors';
import { EquipmentTier, EnergyLevel, PainRegion, SessionType, TimeAvailable, PAIN_CATEGORIES, useAppStore } from '@/lib/store';
import { getSessionLabel, getSessionSubtitle, getEquipmentLabel, getEquipmentIcon } from '@/lib/workout-engine';

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
  const params = useLocalSearchParams<{ sessionType: string; isTestWeek: string; equipment: string }>();
  const sessionType = (params.sessionType || 'squat') as SessionType;
  const isTestWeek = params.isTestWeek === 'true';

  const { equipmentTier: profileTier } = useAppStore();
  const defaultTier = (ALL_TIERS.includes(params.equipment as EquipmentTier) ? params.equipment : profileTier) as EquipmentTier;

  const [step, setStep] = useState<Step>('equipment');
  const [selectedEquipment, setSelectedEquipment] = useState<EquipmentTier>(defaultTier);
  const [hasAches, setHasAches] = useState(false);
  const [painCategory, setPainCategory] = useState<keyof typeof PAIN_CATEGORIES | undefined>();
  const [painRegion, setPainRegion] = useState<PainRegion | undefined>();
  const [energy, setEnergy] = useState<EnergyLevel | undefined>();

  const hapticTap = () => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleEquipment = (tier: EquipmentTier) => {
    hapticTap();
    setSelectedEquipment(tier);
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
          params: { sessionType, hasAches: 'false', painRegion: '', energy: 'normal', timeAvailable: '60', isTestWeek: 'true', equipment: selectedEquipment },
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
        params: { sessionType, hasAches: 'true', painRegion: region, energy: 'normal', timeAvailable: '60', isTestWeek: 'true', equipment: selectedEquipment },
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
    router.push({
      pathname: '/session',
      params: {
        sessionType,
        hasAches: hasAches ? 'true' : 'false',
        painRegion: painRegion || '',
        energy: energy || 'normal',
        timeAvailable: time,
        isTestWeek: 'false',
        equipment: selectedEquipment,
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
    lower: { icon: 'footsteps-outline', color: Colors.primary },
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

  const renderStep = () => {
    switch (step) {
      case 'equipment':
        return (
          <Animated.View key="equipment" entering={FadeInDown.duration(400)} style={styles.stepContent}>
            <View style={styles.questionIcon}>
              <Ionicons name="barbell-outline" size={28} color={Colors.primary} />
            </View>
            <Text style={styles.question}>What equipment do you have?</Text>
            <Text style={styles.questionSub}>Your session is built around this</Text>
            <View style={styles.areaButtons}>
              {ALL_TIERS.map((tier) => {
                const isActive = selectedEquipment === tier;
                return (
                  <Pressable
                    key={tier}
                    onPress={() => handleEquipment(tier)}
                    style={({ pressed }) => [
                      styles.areaButton,
                      isActive && styles.areaButtonActive,
                      pressed && { opacity: 0.8, transform: [{ scale: 0.97 }] },
                    ]}
                    testID={`equipment-${tier}`}
                  >
                    <View style={[styles.areaIconWrap, { backgroundColor: isActive ? Colors.primary : Colors.primaryMuted }]}>
                      <Ionicons
                        name={getEquipmentIcon(tier) as keyof typeof Ionicons.glyphMap}
                        size={22}
                        color={isActive ? Colors.textInverse : Colors.primary}
                      />
                    </View>
                    <View style={styles.areaCatContent}>
                      <Text style={[styles.areaLabel, isActive && { color: Colors.primary }]}>{getEquipmentLabel(tier)}</Text>
                      <Text style={styles.areaSublabel}>{TIER_DESCRIPTIONS[tier]}</Text>
                    </View>
                    {isActive
                      ? <Ionicons name="checkmark-circle" size={22} color={Colors.primary} />
                      : <Ionicons name="chevron-forward" size={18} color={Colors.textTertiary} />
                    }
                  </Pressable>
                );
              })}
            </View>
          </Animated.View>
        );

      case 'aches':
        return (
          <Animated.View key="aches" entering={FadeInDown.duration(400)} style={styles.stepContent}>
            <View style={styles.questionIcon}>
              <Ionicons name="medical-outline" size={28} color={Colors.primary} />
            </View>
            <Text style={styles.question}>Any aches or pains today?</Text>
            <Text style={styles.questionSub}>This helps us adjust your workout</Text>
            <View style={styles.bigButtons}>
              <Pressable
                onPress={() => handleAches(true)}
                style={({ pressed }) => [styles.bigButton, styles.bigButtonOutline, pressed && { opacity: 0.8 }]}
                testID="aches-yes"
              >
                <Ionicons name="alert-circle-outline" size={28} color={Colors.warning} />
                <Text style={styles.bigButtonText}>Yes</Text>
              </Pressable>
              <Pressable
                onPress={() => handleAches(false)}
                style={({ pressed }) => [styles.bigButton, styles.bigButtonFilled, pressed && { opacity: 0.8 }]}
                testID="aches-no"
              >
                <Ionicons name="checkmark-circle-outline" size={28} color={Colors.textInverse} />
                <Text style={[styles.bigButtonText, { color: Colors.textInverse }]}>No</Text>
              </Pressable>
            </View>
          </Animated.View>
        );

      case 'painCategory':
        return (
          <Animated.View key="painCat" entering={FadeInDown.duration(400)} style={styles.stepContent}>
            <View style={styles.questionIcon}>
              <Ionicons name="body-outline" size={28} color={Colors.warning} />
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
                    <View style={[styles.areaIconWrap, { backgroundColor: Colors.primaryMuted }]}>
                      <Ionicons name={iconInfo.icon} size={24} color={iconInfo.color} />
                    </View>
                    <View style={styles.areaCatContent}>
                      <Text style={styles.areaLabel}>{cat.label}</Text>
                      <Text style={styles.areaSublabel}>{cat.regions.length} regions</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={Colors.textTertiary} />
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
              <Ionicons name="locate-outline" size={28} color={Colors.warning} />
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
                  <View style={[styles.areaIconWrap, { backgroundColor: Colors.warningLight }]}>
                    <Ionicons name={REGION_ICONS[r.id]} size={22} color={Colors.warning} />
                  </View>
                  <Text style={[styles.areaLabel, { flex: 1 }]}>{r.label}</Text>
                  <Ionicons name="chevron-forward" size={18} color={Colors.textTertiary} />
                </Pressable>
              ))}
            </View>
          </Animated.View>
        );

      case 'energy':
        return (
          <Animated.View key="energy" entering={FadeInDown.duration(400)} style={styles.stepContent}>
            <View style={styles.questionIcon}>
              <Ionicons name="flash-outline" size={28} color={Colors.primary} />
            </View>
            <Text style={styles.question}>How is your energy?</Text>
            <Text style={styles.questionSub}>Sets and finisher adjust to match</Text>
            <View style={styles.energyButtons}>
              {([
                { level: 'low' as EnergyLevel, label: 'Low', sublabel: 'Fewer sets, easy finisher', icon: 'battery-dead-outline' as const, color: Colors.textTertiary },
                { level: 'normal' as EnergyLevel, label: 'Normal', sublabel: 'Standard session', icon: 'battery-half-outline' as const, color: Colors.primary },
                { level: 'high' as EnergyLevel, label: 'High', sublabel: 'Extra set, harder finisher', icon: 'battery-full-outline' as const, color: Colors.primaryLight },
              ]).map((item) => (
                <Pressable
                  key={item.level}
                  onPress={() => handleEnergy(item.level)}
                  style={({ pressed }) => [styles.energyButton, pressed && { opacity: 0.8, transform: [{ scale: 0.97 }] }]}
                  testID={`energy-${item.level}`}
                >
                  <View style={[styles.energyIconWrap, { backgroundColor: item.level === 'normal' ? Colors.primaryMuted : Colors.surfaceTertiary }]}>
                    <Ionicons name={item.icon} size={22} color={item.color} />
                  </View>
                  <View style={styles.energyContent}>
                    <Text style={styles.energyLabel}>{item.label}</Text>
                    <Text style={styles.energySublabel}>{item.sublabel}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={Colors.textTertiary} />
                </Pressable>
              ))}
            </View>
          </Animated.View>
        );

      case 'time':
        return (
          <Animated.View key="time" entering={FadeInDown.duration(400)} style={styles.stepContent}>
            <View style={styles.questionIcon}>
              <Ionicons name="time-outline" size={28} color={Colors.primary} />
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
                  style={({ pressed }) => [styles.energyButton, pressed && { opacity: 0.8, transform: [{ scale: 0.97 }] }]}
                  testID={`time-${item.time}`}
                >
                  <View style={[styles.energyIconWrap, { backgroundColor: Colors.primaryMuted }]}>
                    <Ionicons name={item.icon} size={22} color={Colors.primary} />
                  </View>
                  <View style={styles.energyContent}>
                    <Text style={styles.energyLabel}>{item.label}</Text>
                    <Text style={styles.energySublabel}>{item.sublabel}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={Colors.textTertiary} />
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
          <Ionicons name="chevron-back" size={24} color={Colors.text} />
        </Pressable>
        <View style={styles.sessionInfo}>
          <Text style={styles.sessionLabel}>
            {isTestWeek ? '1RM Test Week' : getSessionLabel(sessionType)}
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  topBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 },
  backButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  sessionInfo: { flex: 1, alignItems: 'center' },
  sessionLabel: { fontSize: 16, fontFamily: 'Inter_600SemiBold', color: Colors.text },
  sessionSub: { fontSize: 12, fontFamily: 'Inter_400Regular', color: Colors.textSecondary },
  progressContainer: { paddingHorizontal: 24, marginBottom: 8 },
  progressTrack: { height: 4, backgroundColor: Colors.surfaceTertiary, borderRadius: 2, overflow: 'hidden', marginBottom: 8 },
  progressFill: { height: '100%', backgroundColor: Colors.primary, borderRadius: 2 },
  stepIndicator: { fontSize: 12, fontFamily: 'Inter_500Medium', color: Colors.textTertiary, textAlign: 'center' },
  stepContent: { flex: 1, paddingHorizontal: 24, paddingTop: 40, alignItems: 'center' },
  questionIcon: { width: 56, height: 56, borderRadius: 16, backgroundColor: Colors.primaryMuted, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  question: { fontSize: 24, fontFamily: 'Inter_700Bold', color: Colors.text, textAlign: 'center', marginBottom: 6 },
  questionSub: { fontSize: 15, fontFamily: 'Inter_400Regular', color: Colors.textSecondary, textAlign: 'center', marginBottom: 36 },
  bigButtons: { flexDirection: 'row', gap: 14, width: '100%' },
  bigButton: { flex: 1, paddingVertical: 28, borderRadius: 16, alignItems: 'center', gap: 10 },
  bigButtonOutline: { backgroundColor: Colors.surface, borderWidth: 2, borderColor: Colors.border },
  bigButtonFilled: { backgroundColor: Colors.primary },
  bigButtonText: { fontSize: 18, fontFamily: 'Inter_600SemiBold', color: Colors.text },
  areaButtons: { width: '100%', gap: 10 },
  areaButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: Colors.borderLight },
  areaButtonActive: { borderColor: Colors.primary, borderWidth: 2, backgroundColor: Colors.primarySurface },
  areaIconWrap: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 14 },
  areaLabel: { fontSize: 16, fontFamily: 'Inter_600SemiBold', color: Colors.text },
  areaCatContent: { flex: 1 },
  areaSublabel: { fontSize: 12, fontFamily: 'Inter_400Regular', color: Colors.textSecondary, marginTop: 1 },
  energyButtons: { width: '100%', gap: 10 },
  energyButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: Colors.borderLight },
  energyIconWrap: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 14 },
  energyContent: { flex: 1 },
  energyLabel: { fontSize: 16, fontFamily: 'Inter_600SemiBold', color: Colors.text },
  energySublabel: { fontSize: 13, fontFamily: 'Inter_400Regular', color: Colors.textSecondary, marginTop: 1 },
});
