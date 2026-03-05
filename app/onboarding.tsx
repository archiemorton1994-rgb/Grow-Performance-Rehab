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
import { EquipmentTier, useAppStore } from '@/lib/store';
import { getEquipmentLabel } from '@/lib/workout-engine';

const TIERS: { tier: EquipmentTier; icon: keyof typeof Ionicons.glyphMap; description: string }[] = [
  { tier: 'bodyweight', icon: 'body-outline', description: 'Home workouts with minimal gear' },
  { tier: 'dumbbells', icon: 'fitness-outline', description: 'Adjustable dumbbells or kettlebells' },
  { tier: 'fullgym', icon: 'barbell-outline', description: 'Squat rack, bench, and barbell' },
];

export default function OnboardingScreen() {
  const insets = useSafeAreaInsets();
  const [selected, setSelected] = useState<EquipmentTier | null>(null);
  const { setEquipmentTier, setOnboardingComplete } = useAppStore();

  const handleSelect = (tier: EquipmentTier) => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelected(tier);
  };

  const handleContinue = () => {
    if (!selected) return;
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setEquipmentTier(selected);
    setOnboardingComplete(true);
    router.replace('/(tabs)');
  };

  const webTopInset = Platform.OS === 'web' ? 67 : 0;

  return (
    <View style={[styles.container, { paddingTop: insets.top + webTopInset + 40 }]}>
      <Animated.View entering={FadeInUp.delay(100).duration(600)} style={styles.header}>
        <View style={styles.iconContainer}>
          <Ionicons name="leaf" size={32} color={Colors.primary} />
        </View>
        <Text style={styles.title}>Welcome to Grow</Text>
        <Text style={styles.subtitle}>
          What equipment do you have access to?
        </Text>
      </Animated.View>

      <View style={styles.options}>
        {TIERS.map((item, index) => {
          const isSelected = selected === item.tier;
          return (
            <Animated.View key={item.tier} entering={FadeInDown.delay(200 + index * 100).duration(500)}>
              <Pressable
                onPress={() => handleSelect(item.tier)}
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
                    {getEquipmentLabel(item.tier)}
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

      <View style={[styles.footer, { paddingBottom: insets.bottom + (Platform.OS === 'web' ? 34 : 20) }]}>
        <Pressable
          onPress={handleContinue}
          disabled={!selected}
          style={({ pressed }) => [
            styles.continueButton,
            !selected && styles.continueButtonDisabled,
            pressed && selected && { opacity: 0.9, transform: [{ scale: 0.98 }] },
          ]}
        >
          <Text style={[styles.continueText, !selected && styles.continueTextDisabled]}>
            Get Started
          </Text>
          <Ionicons
            name="arrow-forward"
            size={20}
            color={selected ? Colors.textInverse : Colors.textTertiary}
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
  header: {
    alignItems: 'center',
    marginBottom: 40,
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
    fontSize: 16,
    fontFamily: 'Inter_400Regular',
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  options: {
    gap: 12,
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
    flex: 1,
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
