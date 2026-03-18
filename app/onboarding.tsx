import React, { useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Platform,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import Colors from '@/constants/colors';
import { EquipmentTier, ExperienceLevel, useAppStore } from '@/lib/store';
import { getEquipmentLabel } from '@/lib/workout-engine';

type OnboardingStep = 'experience' | 'equipment';

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

export default function OnboardingScreen() {
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState<OnboardingStep>('experience');
  const [selectedExperience, setSelectedExperience] = useState<ExperienceLevel | null>(null);
  const [selectedTier, setSelectedTier] = useState<EquipmentTier | null>(null);
  const { setEquipmentTier, setOnboardingComplete, setUserProfile } = useAppStore();

  const hapticTap = () => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleExperienceSelect = (exp: ExperienceLevel) => {
    hapticTap();
    setSelectedExperience(exp);
    if (exp === 'beginner') setSelectedTier('bodyweight');
    else setSelectedTier(null);
  };

  const handleExperienceContinue = () => {
    if (!selectedExperience) return;
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setUserProfile({ experienceLevel: selectedExperience });
    setStep('equipment');
  };

  const handleTierSelect = (tier: EquipmentTier) => {
    hapticTap();
    setSelectedTier(tier);
  };

  const handleTierContinue = () => {
    if (!selectedTier || !selectedExperience) return;
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setEquipmentTier(selectedTier);
    setOnboardingComplete(true);
    router.replace('/(tabs)');
  };

  const goBack = () => {
    if (step === 'equipment') {
      setStep('experience');
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

  return (
    <View style={[styles.container, { paddingTop: insets.top + webTopInset, paddingBottom: insets.bottom + (Platform.OS === 'web' ? 34 : 20) }]}>
      <View style={styles.topBar}>
        <Pressable onPress={goBack} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color={Colors.text} />
        </Pressable>
        <View style={styles.stepPills}>
          <View style={[styles.stepPill, styles.stepPillDone]} />
          <View style={[styles.stepPill, styles.stepPillActive]} />
        </View>
        <View style={{ width: 40 }} />
      </View>

      <Animated.View entering={FadeInUp.delay(50).duration(400)} style={[styles.header, { marginTop: 20 }]}>
        <Text style={styles.title}>Your equipment</Text>
        <Text style={styles.subtitle}>
          {isBeginnerRestricted
            ? 'Starting with bodyweight or bands — perfect for building foundations safely'
            : 'Choose what you have access to'}
        </Text>
        {isBeginnerRestricted && (
          <View style={styles.restrictedBanner}>
            <Ionicons name="shield-checkmark-outline" size={16} color={Colors.primary} />
            <Text style={styles.restrictedText}>
              As a beginner, we recommend starting light. You can unlock more equipment in your profile later.
            </Text>
          </View>
        )}
      </Animated.View>

      <View style={styles.options}>
        {ALL_TIERS.map((item, index) => {
          const isAvailable = availableTiers.includes(item.tier);
          const isSelected = selectedTier === item.tier;
          return (
            <Animated.View key={item.tier} entering={FadeInDown.delay(100 + index * 80).duration(400)}>
              <Pressable
                onPress={() => isAvailable && handleTierSelect(item.tier)}
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
                    <View style={[styles.radio, isSelected && styles.radioSelected]}>
                      {isSelected && <View style={styles.radioInner} />}
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
          disabled={!selectedTier}
          style={({ pressed }) => [
            styles.continueButton,
            !selectedTier && styles.continueButtonDisabled,
            pressed && selectedTier && { opacity: 0.9, transform: [{ scale: 0.98 }] },
          ]}
        >
          <Text style={[styles.continueText, !selectedTier && styles.continueTextDisabled]}>
            Get Started
          </Text>
          <Ionicons
            name="arrow-forward"
            size={20}
            color={selectedTier ? Colors.textInverse : Colors.textTertiary}
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
    marginBottom: 28,
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
});
