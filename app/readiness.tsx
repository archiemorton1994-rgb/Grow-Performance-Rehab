import React, { useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Platform,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import Colors from '@/constants/colors';
import { EnergyLevel, PainArea, SessionType, useAppStore } from '@/lib/store';
import { getSessionLabel, getSessionSubtitle } from '@/lib/workout-engine';

type Step = 'aches' | 'painArea' | 'energy';

export default function ReadinessScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ sessionType: string }>();
  const sessionType = (params.sessionType || 'squat') as SessionType;

  const [step, setStep] = useState<Step>('aches');
  const [hasAches, setHasAches] = useState(false);
  const [painArea, setPainArea] = useState<PainArea | undefined>();
  const [energy, setEnergy] = useState<EnergyLevel | undefined>();

  const hapticTap = () => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleAches = (val: boolean) => {
    hapticTap();
    setHasAches(val);
    if (val) {
      setStep('painArea');
    } else {
      setStep('energy');
    }
  };

  const handlePainArea = (area: PainArea) => {
    hapticTap();
    setPainArea(area);
    setStep('energy');
  };

  const handleEnergy = (level: EnergyLevel) => {
    hapticTap();
    setEnergy(level);
    router.push({
      pathname: '/session',
      params: {
        sessionType,
        hasAches: hasAches ? 'true' : 'false',
        painArea: painArea || '',
        energy: level,
      },
    });
  };

  const webTopInset = Platform.OS === 'web' ? 67 : 0;

  const renderStep = () => {
    switch (step) {
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
              >
                <Ionicons name="alert-circle-outline" size={28} color={Colors.warning} />
                <Text style={styles.bigButtonText}>Yes</Text>
              </Pressable>
              <Pressable
                onPress={() => handleAches(false)}
                style={({ pressed }) => [styles.bigButton, styles.bigButtonFilled, pressed && { opacity: 0.8 }]}
              >
                <Ionicons name="checkmark-circle-outline" size={28} color={Colors.textInverse} />
                <Text style={[styles.bigButtonText, { color: Colors.textInverse }]}>No</Text>
              </Pressable>
            </View>
          </Animated.View>
        );

      case 'painArea':
        return (
          <Animated.View key="painArea" entering={FadeInDown.duration(400)} style={styles.stepContent}>
            <View style={styles.questionIcon}>
              <Ionicons name="body-outline" size={28} color={Colors.warning} />
            </View>
            <Text style={styles.question}>Where does it hurt?</Text>
            <Text style={styles.questionSub}>We will swap exercises for that area</Text>
            <View style={styles.areaButtons}>
              {([
                { area: 'upper' as PainArea, label: 'Upper Body', icon: 'hand-left-outline' as const },
                { area: 'back' as PainArea, label: 'Back', icon: 'swap-vertical-outline' as const },
                { area: 'legs' as PainArea, label: 'Legs', icon: 'footsteps-outline' as const },
              ]).map((item) => (
                <Pressable
                  key={item.area}
                  onPress={() => handlePainArea(item.area)}
                  style={({ pressed }) => [styles.areaButton, pressed && { opacity: 0.8, transform: [{ scale: 0.97 }] }]}
                >
                  <View style={styles.areaIconWrap}>
                    <Ionicons name={item.icon} size={24} color={Colors.primary} />
                  </View>
                  <Text style={styles.areaLabel}>{item.label}</Text>
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
    }
  };

  const stepNumber = step === 'aches' ? 1 : step === 'painArea' ? 2 : hasAches ? 3 : 2;
  const totalSteps = hasAches ? 3 : 2;

  return (
    <View style={[styles.container, { paddingTop: insets.top + webTopInset }]}>
      <View style={styles.topBar}>
        <Pressable onPress={() => step === 'aches' ? router.back() : setStep(step === 'energy' ? (hasAches ? 'painArea' : 'aches') : 'aches')} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color={Colors.text} />
        </Pressable>
        <View style={styles.sessionInfo}>
          <Text style={styles.sessionLabel}>{getSessionLabel(sessionType)}</Text>
          <Text style={styles.sessionSub}>{getSessionSubtitle(sessionType)}</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.progressContainer}>
        <View style={styles.progressTrack}>
          <Animated.View style={[styles.progressFill, { width: `${(stepNumber / totalSteps) * 100}%` }]} />
        </View>
        <Text style={styles.stepIndicator}>Step {stepNumber} of {totalSteps}</Text>
      </View>

      {renderStep()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sessionInfo: {
    flex: 1,
    alignItems: 'center',
  },
  sessionLabel: {
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.text,
  },
  sessionSub: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    color: Colors.textSecondary,
  },
  progressContainer: {
    paddingHorizontal: 24,
    marginBottom: 8,
  },
  progressTrack: {
    height: 4,
    backgroundColor: Colors.surfaceTertiary,
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.primary,
    borderRadius: 2,
  },
  stepIndicator: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
    color: Colors.textTertiary,
    textAlign: 'center',
  },
  stepContent: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 40,
    alignItems: 'center',
  },
  questionIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: Colors.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  question: {
    fontSize: 24,
    fontFamily: 'Inter_700Bold',
    color: Colors.text,
    textAlign: 'center',
    marginBottom: 6,
  },
  questionSub: {
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: 36,
  },
  bigButtons: {
    flexDirection: 'row',
    gap: 14,
    width: '100%',
  },
  bigButton: {
    flex: 1,
    paddingVertical: 28,
    borderRadius: 16,
    alignItems: 'center',
    gap: 10,
  },
  bigButtonOutline: {
    backgroundColor: Colors.surface,
    borderWidth: 2,
    borderColor: Colors.border,
  },
  bigButtonFilled: {
    backgroundColor: Colors.primary,
  },
  bigButtonText: {
    fontSize: 18,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.text,
  },
  areaButtons: {
    width: '100%',
    gap: 10,
  },
  areaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  areaIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: Colors.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  areaLabel: {
    flex: 1,
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.text,
  },
  energyButtons: {
    width: '100%',
    gap: 10,
  },
  energyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  energyIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  energyContent: {
    flex: 1,
  },
  energyLabel: {
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.text,
  },
  energySublabel: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    color: Colors.textSecondary,
    marginTop: 1,
  },
});
