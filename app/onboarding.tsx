import React, { useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Platform,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import Colors from '@/constants/colors';
import { EquipmentTier, ExperienceLevel, SessionType, TIER_ORDER, useAppStore } from '@/lib/store';
import { getEquipmentLabel, getEffectiveTier } from '@/lib/workout-engine';

type OnboardingStep = 'experience' | 'equipment' | 'oneRepMax';

const EXPERIENCE_OPTIONS: {
  value: ExperienceLevel;
  label: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  { value: 'beginner', label: 'New to the gym', description: 'Building the basics — we start safe and simple', icon: 'leaf-outline' },
  { value: 'intermediate', label: 'Experienced gym-goer', description: '1+ years of consistent training', icon: 'barbell-outline' },
];

const ALL_TIERS: { tier: EquipmentTier; icon: keyof typeof Ionicons.glyphMap; description: string }[] = [
  { tier: 'bodyweight', icon: 'body-outline', description: 'Home workouts with no gear' },
  { tier: 'bands', icon: 'git-compare-outline', description: 'Resistance bands only' },
  { tier: 'dumbbells', icon: 'barbell-outline', description: 'Adjustable dumbbells' },
  { tier: 'kettlebells', icon: 'fitness-outline', description: 'Kettlebells available' },
  { tier: 'fullgym', icon: 'business-outline', description: 'Squat rack, bench and barbell' },
];

function getAvailableTiers(experience: ExperienceLevel): EquipmentTier[] {
  if (experience === 'beginner') return ['bodyweight', 'bands'];
  return ['bodyweight', 'bands', 'dumbbells', 'kettlebells', 'fullgym'];
}

function OrmInput({
  label,
  icon,
  value,
  onChangeText,
  testID,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  value: string;
  onChangeText: (v: string) => void;
  testID?: string;
}) {
  return (
    <View style={ormStyles.row}>
      <View style={ormStyles.iconWrap}>
        <Ionicons name={icon} size={20} color={Colors.primary} />
      </View>
      <View style={ormStyles.labelWrap}>
        <Text style={ormStyles.label}>{label}</Text>
      </View>
      <View style={ormStyles.inputWrap}>
        <TextInput
          style={ormStyles.input}
          value={value}
          onChangeText={onChangeText}
          keyboardType="numeric"
          placeholder="—"
          placeholderTextColor={Colors.textTertiary}
          returnKeyType="next"
          selectTextOnFocus
          testID={testID}
        />
        <Text style={ormStyles.unit}>kg</Text>
      </View>
    </View>
  );
}

const ormStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  iconWrap: { width: 36, height: 36, borderRadius: 10, backgroundColor: Colors.primaryMuted, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  labelWrap: { flex: 1 },
  label: { fontSize: 15, fontFamily: 'Inter_600SemiBold', color: Colors.text },
  inputWrap: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  input: { width: 72, height: 40, borderRadius: 10, borderWidth: 1.5, borderColor: Colors.border, backgroundColor: Colors.surface, textAlign: 'center', fontSize: 16, fontFamily: 'Inter_600SemiBold', color: Colors.text, paddingHorizontal: 8 },
  unit: { fontSize: 13, fontFamily: 'Inter_400Regular', color: Colors.textTertiary, width: 22 },
});

export default function OnboardingScreen() {
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState<OnboardingStep>('experience');
  const [selectedExperience, setSelectedExperience] = useState<ExperienceLevel | null>(null);
  const [selectedTiers, setSelectedTiers] = useState<EquipmentTier[]>([]);
  const [ormSquat, setOrmSquat] = useState('');
  const [ormBench, setOrmBench] = useState('');
  const [ormDeadlift, setOrmDeadlift] = useState('');
  const { setEquipmentTiers, setOnboardingComplete, setUserProfile, addOneRepMax } = useAppStore();

  const hapticTap = () => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleExperienceSelect = (exp: ExperienceLevel) => {
    hapticTap();
    setSelectedExperience(exp);
    if (exp === 'beginner') {
      setSelectedTiers(['bodyweight']);
    } else {
      setSelectedTiers([]);
    }
  };

  const handleExperienceContinue = () => {
    if (!selectedExperience) return;
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setUserProfile({ experienceLevel: selectedExperience });
    setStep('equipment');
  };

  const handleTierToggle = (tier: EquipmentTier) => {
    if (!selectedExperience) return;
    const available = getAvailableTiers(selectedExperience);
    if (!available.includes(tier)) return;
    hapticTap();

    setSelectedTiers((prev) => {
      if (tier === 'fullgym') {
        if (prev.includes('fullgym')) {
          return prev.filter(t => t !== 'fullgym');
        } else {
          return [...TIER_ORDER];
        }
      }
      if (prev.includes(tier)) {
        return prev.filter(t => t !== tier);
      }
      return [...prev, tier];
    });
  };

  const handleTierContinue = () => {
    if (selectedTiers.length === 0 || !selectedExperience) return;
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setEquipmentTiers(selectedTiers);
    if (selectedExperience === 'beginner') {
      setOnboardingComplete(true);
      router.replace('/(tabs)');
    } else {
      setStep('oneRepMax');
    }
  };

  const handleOneRepMaxContinue = () => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const today = new Date().toISOString().split('T')[0];
    const lifts: { lift: SessionType; value: string }[] = [
      { lift: 'squat', value: ormSquat },
      { lift: 'bench', value: ormBench },
      { lift: 'deadlift', value: ormDeadlift },
    ];
    for (const { lift, value } of lifts) {
      const kg = parseFloat(value);
      if (kg > 0) {
        addOneRepMax({ lift, weight: kg, reps: 1, date: today, unit: 'kg' });
      }
    }
    setOnboardingComplete(true);
    router.replace('/(tabs)');
  };

  const handleOneRepMaxSkip = () => {
    setOnboardingComplete(true);
    router.replace('/(tabs)');
  };

  const goBack = () => {
    if (step === 'equipment') {
      setStep('experience');
    } else if (step === 'oneRepMax') {
      setStep('equipment');
    }
  };

  const webTopInset = Platform.OS === 'web' ? 67 : 0;
  const availableTiers = selectedExperience ? getAvailableTiers(selectedExperience) : ALL_TIERS.map(t => t.tier);
  const isBeginnerRestricted = selectedExperience === 'beginner';

  if (step === 'experience') {
    return (
      <View style={[styles.container, { paddingTop: insets.top + webTopInset + 40, paddingBottom: insets.bottom + (Platform.OS === 'web' ? 34 : 20) }]}>
        <Animated.View entering={FadeInUp.delay(100).duration(600)} style={styles.header}>
          <View style={styles.iconContainer}>
            <Ionicons name="leaf" size={32} color={Colors.primary} />
          </View>
          <Text style={styles.title}>Welcome to Grow</Text>
          <Text style={styles.subtitle}>
            How long have you been training?
          </Text>
        </Animated.View>

        <View style={styles.options}>
          {EXPERIENCE_OPTIONS.map((item, index) => {
            const isSelected = selectedExperience === item.value;
            return (
              <Animated.View key={item.value} entering={FadeInDown.delay(200 + index * 100).duration(500)}>
                <Pressable
                  onPress={() => handleExperienceSelect(item.value)}
                  style={({ pressed }) => [
                    styles.option,
                    isSelected && styles.optionSelected,
                    pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] },
                  ]}
                >
                  <View style={[styles.optionIcon, isSelected && styles.optionIconSelected]}>
                    <Ionicons
                      name={item.icon}
                      size={24}
                      color={isSelected ? Colors.textInverse : Colors.primary}
                    />
                  </View>
                  <View style={styles.optionContent}>
                    <Text style={[styles.optionTitle, isSelected && styles.optionTitleSelected]}>
                      {item.label}
                    </Text>
                    <Text style={[styles.optionDescription, isSelected && styles.optionDescSelected]}>
                      {item.description}
                    </Text>
                  </View>
                  <View style={[styles.radio, isSelected && styles.radioSelected]}>
                    {isSelected && <View style={styles.radioInner} />}
                  </View>
                </Pressable>
              </Animated.View>
            );
          })}
        </View>

        <View style={styles.footer}>
          <Pressable
            onPress={handleExperienceContinue}
            disabled={!selectedExperience}
            style={({ pressed }) => [
              styles.continueButton,
              !selectedExperience && styles.continueButtonDisabled,
              pressed && selectedExperience && { opacity: 0.9, transform: [{ scale: 0.98 }] },
            ]}
          >
            <Text style={[styles.continueText, !selectedExperience && styles.continueTextDisabled]}>
              Continue
            </Text>
            <Ionicons
              name="arrow-forward"
              size={20}
              color={selectedExperience ? Colors.textInverse : Colors.textTertiary}
            />
          </Pressable>
        </View>
      </View>
    );
  }

  if (step === 'oneRepMax') {
    return (
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={insets.top + webTopInset}
      >
        <View style={[styles.container, { paddingTop: insets.top + webTopInset, paddingBottom: insets.bottom + (Platform.OS === 'web' ? 34 : 20) }]}>
          <View style={styles.topBar}>
            <Pressable onPress={goBack} style={styles.backButton}>
              <Ionicons name="chevron-back" size={24} color={Colors.text} />
            </Pressable>
            <View style={styles.stepPills}>
              <View style={[styles.stepPill, styles.stepPillDone]} />
              <View style={[styles.stepPill, styles.stepPillDone]} />
              <View style={[styles.stepPill, styles.stepPillActive]} />
            </View>
            <View style={{ width: 40 }} />
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ flexGrow: 1 }}
          >
            <Animated.View entering={FadeInUp.delay(50).duration(400)} style={[styles.header, { marginTop: 20 }]}>
              <View style={styles.iconContainer}>
                <Ionicons name="trophy-outline" size={32} color={Colors.primary} />
              </View>
              <Text style={styles.title}>Your 1-rep maxes</Text>
              <Text style={styles.subtitle}>
                Enter your best single-rep lifts so we can suggest accurate weights from day one.
              </Text>
            </Animated.View>

            <Animated.View entering={FadeInDown.delay(150).duration(400)} style={styles.ormContainer}>
              <OrmInput
                label="Squat"
                icon="trending-up-outline"
                value={ormSquat}
                onChangeText={setOrmSquat}
                testID="orm-squat"
              />
              <OrmInput
                label="Bench Press"
                icon="barbell-outline"
                value={ormBench}
                onChangeText={setOrmBench}
                testID="orm-bench"
              />
              <OrmInput
                label="Deadlift"
                icon="arrow-up-outline"
                value={ormDeadlift}
                onChangeText={setOrmDeadlift}
                testID="orm-deadlift"
              />
              <Text style={styles.ormHint}>Leave blank if you are not sure — you can always add these later.</Text>
            </Animated.View>
          </ScrollView>

          <View style={styles.footer}>
            <Pressable
              onPress={handleOneRepMaxContinue}
              style={({ pressed }) => [
                styles.continueButton,
                pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] },
              ]}
              testID="orm-continue"
            >
              <Text style={styles.continueText}>Get Started</Text>
              <Ionicons name="arrow-forward" size={20} color={Colors.textInverse} />
            </Pressable>
            <Pressable onPress={handleOneRepMaxSkip} style={styles.skipButton} testID="orm-skip">
              <Text style={styles.skipText}>Skip for now</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    );
  }

  const canContinue = selectedTiers.length > 0;

  return (
    <View style={[styles.container, { paddingTop: insets.top + webTopInset, paddingBottom: insets.bottom + (Platform.OS === 'web' ? 34 : 20) }]}>
      <View style={styles.topBar}>
        <Pressable onPress={goBack} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color={Colors.text} />
        </Pressable>
        <View style={styles.stepPills}>
          <View style={[styles.stepPill, styles.stepPillDone]} />
          <View style={[styles.stepPill, styles.stepPillActive]} />
          {selectedExperience !== 'beginner' && (
            <View style={[styles.stepPill, styles.stepPillPending]} />
          )}
        </View>
        <View style={{ width: 40 }} />
      </View>

      <Animated.View entering={FadeInUp.delay(50).duration(400)} style={[styles.header, { marginTop: 20 }]}>
        <Text style={styles.title}>Your equipment</Text>
        <Text style={styles.subtitle}>
          {isBeginnerRestricted
            ? 'Select what you have access to'
            : 'Check everything available to you'}
        </Text>
        {isBeginnerRestricted && (
          <View style={styles.restrictedBanner}>
            <Ionicons name="shield-checkmark-outline" size={16} color={Colors.primary} />
            <Text style={styles.restrictedText}>
              As a beginner, we recommend starting light. You can unlock more equipment in your profile later.
            </Text>
          </View>
        )}
        {selectedTiers.length > 0 && (
          <Text style={styles.selectionHint}>
            Best match: <Text style={{ color: Colors.primary, fontFamily: 'Inter_600SemiBold' }}>{getEquipmentLabel(getEffectiveTier(selectedTiers))}</Text>
          </Text>
        )}
      </Animated.View>

      <View style={styles.options}>
        {ALL_TIERS.map((item, index) => {
          const isAvailable = availableTiers.includes(item.tier);
          const isSelected = selectedTiers.includes(item.tier);
          return (
            <Animated.View key={item.tier} entering={FadeInDown.delay(100 + index * 80).duration(400)}>
              <Pressable
                onPress={() => handleTierToggle(item.tier)}
                style={({ pressed }) => [
                  styles.option,
                  isSelected && styles.optionSelected,
                  !isAvailable && styles.optionLocked,
                  pressed && isAvailable && { opacity: 0.9, transform: [{ scale: 0.98 }] },
                ]}
              >
                <View style={[styles.optionIcon, isSelected && styles.optionIconSelected, !isAvailable && styles.optionIconLocked]}>
                  <Ionicons
                    name={item.icon}
                    size={24}
                    color={isSelected ? Colors.textInverse : isAvailable ? Colors.primary : Colors.textTertiary}
                  />
                </View>
                <View style={styles.optionContent}>
                  <Text style={[styles.optionTitle, isSelected && styles.optionTitleSelected, !isAvailable && styles.optionTitleLocked]}>
                    {getEquipmentLabel(item.tier)}
                  </Text>
                  <Text style={[styles.optionDescription, isSelected && styles.optionDescSelected]}>
                    {isAvailable ? item.description : 'Unlock after gaining experience'}
                  </Text>
                </View>
                {!isAvailable
                  ? <Ionicons name="lock-closed-outline" size={18} color={Colors.textTertiary} />
                  : (
                    <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
                      {isSelected && <Ionicons name="checkmark" size={14} color={Colors.textInverse} />}
                    </View>
                  )
                }
              </Pressable>
            </Animated.View>
          );
        })}
      </View>

      <View style={styles.footer}>
        <Pressable
          onPress={handleTierContinue}
          disabled={!canContinue}
          style={({ pressed }) => [
            styles.continueButton,
            !canContinue && styles.continueButtonDisabled,
            pressed && canContinue && { opacity: 0.9, transform: [{ scale: 0.98 }] },
          ]}
        >
          <Text style={[styles.continueText, !canContinue && styles.continueTextDisabled]}>
            {selectedExperience === 'beginner' ? 'Get Started' : 'Continue'}
          </Text>
          <Ionicons
            name="arrow-forward"
            size={20}
            color={canContinue ? Colors.textInverse : Colors.textTertiary}
          />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    paddingHorizontal: 24,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepPills: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  stepPill: {
    width: 32,
    height: 4,
    borderRadius: 2,
  },
  stepPillDone: {
    backgroundColor: Colors.primary,
  },
  stepPillActive: {
    backgroundColor: Colors.primary,
    opacity: 0.4,
  },
  header: {
    alignItems: 'center',
    marginBottom: 20,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: Colors.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontFamily: 'Inter_700Bold',
    color: Colors.text,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  selectionHint: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    color: Colors.textSecondary,
    marginTop: 8,
  },
  restrictedBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: Colors.primaryMuted,
    borderRadius: 12,
    padding: 12,
    marginTop: 12,
    borderWidth: 1,
    borderColor: Colors.primaryLight,
  },
  restrictedText: {
    flex: 1,
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    color: Colors.primaryDark,
    lineHeight: 19,
  },
  options: {
    gap: 10,
    flex: 1,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 2,
    borderColor: Colors.border,
  },
  optionSelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primarySurface,
  },
  optionLocked: {
    opacity: 0.5,
    borderColor: Colors.borderLight,
  },
  optionIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: Colors.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  optionIconSelected: {
    backgroundColor: Colors.primary,
  },
  optionIconLocked: {
    backgroundColor: Colors.surfaceTertiary,
  },
  optionContent: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.text,
    marginBottom: 2,
  },
  optionTitleSelected: {
    color: Colors.primaryDark,
  },
  optionTitleLocked: {
    color: Colors.textTertiary,
  },
  optionDescription: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    color: Colors.textSecondary,
  },
  optionDescSelected: {
    color: Colors.primaryLight,
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  radioSelected: {
    borderColor: Colors.primary,
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: Colors.primary,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  checkboxSelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primary,
  },
  footer: {
    paddingTop: 16,
    justifyContent: 'flex-end',
  },
  continueButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    borderRadius: 14,
    paddingVertical: 16,
    gap: 8,
  },
  continueButtonDisabled: {
    backgroundColor: Colors.surfaceTertiary,
  },
  continueText: {
    fontSize: 17,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.textInverse,
  },
  continueTextDisabled: {
    color: Colors.textTertiary,
  },
  stepPillPending: {
    backgroundColor: Colors.borderLight,
  },
  ormContainer: {
    marginTop: 8,
    backgroundColor: Colors.surface,
    borderRadius: 16,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  ormHint: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    color: Colors.textTertiary,
    textAlign: 'center',
    paddingVertical: 14,
  },
  skipButton: {
    alignItems: 'center',
    paddingVertical: 14,
  },
  skipText: {
    fontSize: 15,
    fontFamily: 'Inter_500Medium',
    color: Colors.textSecondary,
  },
});
