import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BackHandler,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, {
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useColors } from '@/constants/colors';
import {
  EquipmentTier,
  ExperienceLevel,
  FitnessGoal,
  Sex,
  SessionType,
  TIER_ORDER,
  useAppStore,
} from '@/lib/store';

const EXPERIENCE_OPTIONS: {
  value: ExperienceLevel;
  label: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  {
    value: 'beginner',
    label: 'Just getting started',
    description: 'New to structured training',
    icon: 'leaf-outline',
  },
  {
    value: 'intermediate',
    label: '1–3 years training',
    description: 'Comfortable with the basics',
    icon: 'barbell-outline',
  },
  {
    value: 'advanced',
    label: '3+ years, know my numbers',
    description: 'Experienced lifter',
    icon: 'trophy-outline',
  },
];

const SEX_OPTIONS: {
  value: Sex;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  { value: 'male', label: 'Male', icon: 'male-outline' },
  { value: 'female', label: 'Female', icon: 'female-outline' },
  { value: 'other', label: 'Prefer not to say', icon: 'person-outline' },
];

const GOAL_OPTIONS: {
  value: FitnessGoal;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  { value: 'strength', label: 'Build Strength', icon: 'barbell-outline' },
  { value: 'muscle', label: 'Build Muscle', icon: 'body-outline' },
  { value: 'power', label: 'Power & Speed', icon: 'flash-outline' },
  { value: 'fat_loss', label: 'Lose Fat', icon: 'flame-outline' },
  { value: 'fitness', label: 'General Fitness', icon: 'heart-outline' },
  { value: 'rehab', label: 'Rehabilitation', icon: 'medical-outline' },
];

const EQUIPMENT_OPTIONS: {
  value: EquipmentTier;
  label: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  { value: 'bodyweight', label: 'No Equipment', description: 'No equipment needed', icon: 'body-outline' },
  { value: 'bands', label: 'Resistance Bands', description: 'Bands and tubes', icon: 'git-compare-outline' },
  { value: 'dumbbells', label: 'Dumbbells', description: 'Adjustable dumbbells', icon: 'barbell-outline' },
  { value: 'kettlebells', label: 'Kettlebells', description: 'Kettlebells available', icon: 'fitness-outline' },
  { value: 'fullgym', label: 'Full Gym', description: 'Squat rack + barbell', icon: 'business-outline' },
];

function experienceLabel(e: ExperienceLevel | null): string {
  switch (e) {
    case 'beginner': return 'Beginner';
    case 'intermediate': return 'Intermediate';
    case 'advanced': return 'Advanced';
    default: return '';
  }
}

function goalLabel(g: FitnessGoal | null): string {
  const found = GOAL_OPTIONS.find(o => o.value === g);
  return found?.label ?? '';
}

function equipmentLabel(tiers: EquipmentTier[]): string {
  if (tiers.includes('fullgym')) return 'Full Gym';
  if (tiers.includes('kettlebells')) return 'Kettlebells';
  if (tiers.includes('dumbbells')) return 'Dumbbells';
  if (tiers.includes('bands')) return 'Bands';
  return 'No Equipment';
}

export default function OnboardingScreen() {
  const C = useColors();
  const styles = useMemo(() => makeStyles(C), [C]);
  const insets = useSafeAreaInsets();
  const { width: SCREEN_WIDTH } = useWindowDimensions();
  const scrollRef = useRef<ScrollView>(null);
  const { setEquipmentTiers, setOnboardingComplete, setUserProfile, addOneRepMax } = useAppStore();

  const [currentIndex, setCurrentIndex] = useState(0);

  const [name, setName] = useState('');
  const [sex, setSex] = useState<Sex | null>(null);
  const [experience, setExperience] = useState<ExperienceLevel | null>(null);
  const [bodyweight, setBodyweight] = useState('');
  const [goals, setGoals] = useState<FitnessGoal[]>([]);
  const [equipment, setEquipment] = useState<EquipmentTier[]>([]);
  const [ormSquat, setOrmSquat] = useState('');
  const [ormBench, setOrmBench] = useState('');
  const [ormDeadlift, setOrmDeadlift] = useState('');

  const nameInputRef = useRef<TextInput>(null);
  const bwInputRef = useRef<TextInput>(null);

  const handleNextRef = useRef<() => void>(() => {});
  const handleBackRef = useRef<() => void>(() => {});

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gs) =>
        Math.abs(gs.dx) > 15 && Math.abs(gs.dx) > Math.abs(gs.dy) * 1.5,
      onPanResponderRelease: (_, gs) => {
        if (gs.dx < -50) handleNextRef.current();
        else if (gs.dx > 50) handleBackRef.current();
      },
    })
  ).current;

  const checkScale = useSharedValue(0);
  const checkOpacity = useSharedValue(0);
  const celebTitleOpacity = useSharedValue(0);
  const celebSummaryOpacity = useSharedValue(0);

  const webTop = Platform.OS === 'web' ? 67 : 0;
  const webBottom = Platform.OS === 'web' ? 34 : 0;

  const haptic = useCallback(() => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const hapticMedium = useCallback(() => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, []);

  useEffect(() => {
    if (experience === 'beginner') {
      setEquipment(['bodyweight']);
    } else if (experience !== null) {
      setEquipment([]);
    }
  }, [experience]);

  useEffect(() => {
    if (currentIndex === 1) {
      setTimeout(() => nameInputRef.current?.focus(), 350);
    } else if (currentIndex === 4) {
      setTimeout(() => bwInputRef.current?.focus(), 350);
    } else if (currentIndex === 8) {
      checkScale.value = withDelay(200, withSpring(1, { damping: 12, stiffness: 180 }));
      checkOpacity.value = withDelay(200, withTiming(1, { duration: 250 }));
      celebTitleOpacity.value = withDelay(600, withTiming(1, { duration: 400 }));
      celebSummaryOpacity.value = withDelay(900, withTiming(1, { duration: 400 }));
    }
  }, [currentIndex]);

  const checkAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: checkScale.value }],
    opacity: checkOpacity.value,
  }));
  const celebTitleStyle = useAnimatedStyle(() => ({ opacity: celebTitleOpacity.value }));
  const celebSummaryStyle = useAnimatedStyle(() => ({ opacity: celebSummaryOpacity.value }));

  const goTo = useCallback((index: number) => {
    scrollRef.current?.scrollTo({ x: SCREEN_WIDTH * index, animated: true });
    setCurrentIndex(index);
  }, [SCREEN_WIDTH]);

  const canContinue = useCallback((): boolean => {
    switch (currentIndex) {
      case 0: return true;
      case 1: return name.trim().length > 0;
      case 2: return sex !== null;
      case 3: return experience !== null;
      case 4: return parseFloat(bodyweight) > 0;
      case 5: return goals.length > 0;
      case 6: return equipment.length > 0;
      case 7: return true;
      default: return false;
    }
  }, [currentIndex, name, sex, experience, bodyweight, goals, equipment]);

  const saveAndComplete = useCallback(() => {
    setUserProfile({
      name: name.trim(),
      sex: sex ?? 'other',
      experienceLevel: experience ?? 'beginner',
      goals: goals.length > 0 ? goals : ['fitness'],
      bodyweightKg: parseFloat(bodyweight) || 75,
    });
    setEquipmentTiers(equipment);
  }, [name, sex, experience, bodyweight, goals, equipment, setUserProfile, setEquipmentTiers]);

  const handleNext = useCallback(() => {
    if (!canContinue()) return;
    hapticMedium();
    Keyboard.dismiss();
    if (currentIndex < 7) {
      goTo(currentIndex + 1);
    } else if (currentIndex === 7) {
      saveAndComplete();
      goTo(8);
    }
  }, [canContinue, hapticMedium, currentIndex, goTo, saveAndComplete]);

  const handleBack = useCallback(() => {
    if (currentIndex <= 0) return;
    haptic();
    Keyboard.dismiss();
    goTo(currentIndex - 1);
  }, [currentIndex, haptic, goTo]);

  useEffect(() => {
    handleNextRef.current = handleNext;
    handleBackRef.current = handleBack;
  }, [handleNext, handleBack]);

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (currentIndex > 0) {
        handleBack();
        return true;
      }
      return false;
    });
    return () => subscription.remove();
  }, [currentIndex, handleBack]);

  const handleComplete = useCallback(() => {
    hapticMedium();
    const today = new Date().toISOString().split('T')[0];
    const lifts: { lift: SessionType; value: string }[] = [
      { lift: 'squat', value: ormSquat },
      { lift: 'bench', value: ormBench },
      { lift: 'deadlift', value: ormDeadlift },
    ];
    for (const { lift, value } of lifts) {
      const kg = parseFloat(value);
      if (kg > 0) addOneRepMax({ lift, weight: kg, reps: 1, date: today, unit: 'kg' });
    }
    setOnboardingComplete(true);
    router.replace('/(tabs)');
  }, [hapticMedium, ormSquat, ormBench, ormDeadlift, addOneRepMax, setOnboardingComplete]);

  const handleSkipLifts = useCallback(() => {
    haptic();
    Keyboard.dismiss();
    saveAndComplete();
    goTo(8);
  }, [haptic, saveAndComplete, goTo]);

  const toggleGoal = useCallback((goal: FitnessGoal) => {
    haptic();
    setGoals(prev =>
      prev.includes(goal) ? prev.filter(g => g !== goal) : [...prev, goal]
    );
  }, [haptic]);

  const toggleEquipment = useCallback((tier: EquipmentTier) => {
    haptic();
    setEquipment(prev => {
      if (tier === 'fullgym') {
        return prev.includes('fullgym') ? prev.filter(t => t !== 'fullgym') : [...TIER_ORDER];
      }
      return prev.includes(tier) ? prev.filter(t => t !== tier) : [...prev, tier];
    });
  }, [haptic]);

  const available = experience === 'beginner' ? ['bodyweight', 'bands'] : TIER_ORDER;
  const showProgress = currentIndex >= 1;
  const progressFraction = showProgress ? Math.min(currentIndex / 8, 1) : 0;
  const showBack = currentIndex > 0;
  const showContinue = currentIndex < 8;
  const canGo = canContinue();

  const topPad = insets.top + webTop;
  const bottomPad = insets.bottom + webBottom;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={0}
    >
      <View style={[styles.root, { backgroundColor: C.background }]} {...panResponder.panHandlers}>
        {/* Header */}
        <View style={[styles.header, { paddingTop: topPad + 10, paddingHorizontal: 20 }]}>
          {showBack ? (
            <Pressable onPress={handleBack} style={styles.backBtn} testID="onboarding-back">
              <Ionicons name="chevron-back" size={24} color={C.text} />
            </Pressable>
          ) : (
            <View style={styles.backPlaceholder} />
          )}
          {showProgress && (
            <View style={styles.progressTrack}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${progressFraction * 100}%` },
                ]}
              />
            </View>
          )}
          <View style={styles.backPlaceholder} />
        </View>

        {/* Scrollable screens */}
        <ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          scrollEnabled={false}
          showsHorizontalScrollIndicator={false}
          style={{ flex: 1 }}
        >
          {/* Screen 0: Welcome */}
          <View style={[styles.screen, { width: SCREEN_WIDTH }]}>
            <Animated.View entering={FadeInDown.duration(500)} style={styles.screenContent}>
              <Image
                source={require('@/assets/images/logo.jpeg')}
                style={styles.welcomeLogoImage}
                resizeMode="cover"
              />
              <View style={styles.welcomeDivider} />
              <Text style={styles.welcomeSubtitle}>
                Build your training profile.{'\n'}Takes less than 2 minutes.
              </Text>
              <View style={styles.welcomePillRow}>
                {['Personalised loads', 'Pain adaptive', 'Tracks progress'].map(p => (
                  <View key={p} style={styles.welcomePill}>
                    <Ionicons name="checkmark" size={11} color={C.primary} />
                    <Text style={styles.welcomePillText}>{p}</Text>
                  </View>
                ))}
              </View>
            </Animated.View>
          </View>

          {/* Screen 1: Name */}
          <View style={[styles.screen, { width: SCREEN_WIDTH }]}>
            <View style={styles.screenContent}>
              <View style={styles.iconCircle}>
                <Ionicons name="person-circle-outline" size={56} color={C.primary} />
              </View>
              <Text style={styles.question}>What should we call you?</Text>
              <Text style={styles.hint}>Personalises your experience</Text>
              <View style={styles.inputWrap}>
                <TextInput
                  ref={nameInputRef}
                  style={styles.textInput}
                  value={name}
                  onChangeText={setName}
                  placeholder="Your name"
                  placeholderTextColor={C.textTertiary}
                  returnKeyType="next"
                  onSubmitEditing={handleNext}
                  autoCapitalize="words"
                  autoCorrect={false}
                  testID="name-input"
                />
              </View>
            </View>
          </View>

          {/* Screen 2: Biological Sex */}
          <View style={[styles.screen, { width: SCREEN_WIDTH }]}>
            <View style={styles.screenContent}>
              <View style={styles.iconCircle}>
                <Ionicons name="stats-chart-outline" size={56} color={C.primary} />
              </View>
              <Text style={styles.question}>Your biological sex</Text>
              <Text style={styles.hint}>Helps us calibrate your lifting loads</Text>
              <View style={styles.optionList}>
                {SEX_OPTIONS.map(opt => {
                  const selected = sex === opt.value;
                  return (
                    <Pressable
                      key={opt.value}
                      onPress={() => { haptic(); setSex(opt.value); }}
                      style={({ pressed }) => [
                        styles.optionCard,
                        selected && styles.optionCardSelected,
                        pressed && styles.optionCardPressed,
                      ]}
                      testID={`sex-${opt.value}`}
                    >
                      <View style={[styles.optionIcon, selected && styles.optionIconSelected]}>
                        <Ionicons name={opt.icon} size={22} color={selected ? C.textInverse : C.primary} />
                      </View>
                      <Text style={[styles.optionLabel, { flex: 1 }, selected && styles.optionLabelSelected]}>
                        {opt.label}
                      </Text>
                      <View style={[styles.radio, selected && styles.radioSelected]}>
                        {selected && <View style={styles.radioDot} />}
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </View>

          {/* Screen 3: Experience */}
          <View style={[styles.screen, { width: SCREEN_WIDTH }]}>
            <View style={styles.screenContent}>
              <View style={styles.iconCircle}>
                <Ionicons name="barbell-outline" size={56} color={C.primary} />
              </View>
              <Text style={styles.question}>How long have you been training?</Text>
              <Text style={styles.hint}>Sets the right starting weights</Text>
              <View style={styles.optionList}>
                {EXPERIENCE_OPTIONS.map(opt => {
                  const selected = experience === opt.value;
                  return (
                    <Pressable
                      key={opt.value}
                      onPress={() => { haptic(); setExperience(opt.value); }}
                      style={({ pressed }) => [
                        styles.optionCard,
                        selected && styles.optionCardSelected,
                        pressed && styles.optionCardPressed,
                      ]}
                      testID={`experience-${opt.value}`}
                    >
                      <View style={[styles.optionIcon, selected && styles.optionIconSelected]}>
                        <Ionicons name={opt.icon} size={22} color={selected ? C.textInverse : C.primary} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.optionLabel, selected && styles.optionLabelSelected]}>
                          {opt.label}
                        </Text>
                        <Text style={[styles.optionDesc, selected && styles.optionDescSelected]}>
                          {opt.description}
                        </Text>
                      </View>
                      <View style={[styles.radio, selected && styles.radioSelected]}>
                        {selected && <View style={styles.radioDot} />}
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </View>

          {/* Screen 4: Bodyweight */}
          <View style={[styles.screen, { width: SCREEN_WIDTH }]}>
            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={[styles.screenScrollContent, { paddingBottom: 24 }]}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.iconCircle}>
                <Ionicons name="scale-outline" size={56} color={C.primary} />
              </View>
              <Text style={styles.question}>Your current bodyweight</Text>
              <Text style={styles.hint}>Used to personalise your lifting loads</Text>
              <View style={[styles.inputWrap, styles.numericInputWrap]}>
                <TextInput
                  ref={bwInputRef}
                  style={[styles.textInput, styles.numericInput]}
                  value={bodyweight}
                  onChangeText={setBodyweight}
                  placeholder="75"
                  placeholderTextColor={C.textTertiary}
                  keyboardType="decimal-pad"
                  returnKeyType="next"
                  onSubmitEditing={handleNext}
                  selectTextOnFocus
                  testID="bodyweight-input"
                />
                <Text style={styles.unitLabel}>kg</Text>
              </View>
            </ScrollView>
          </View>

          {/* Screen 5: Goals */}
          <View style={[styles.screen, { width: SCREEN_WIDTH }]}>
            <View style={styles.screenContent}>
              <View style={styles.iconCircle}>
                <Ionicons name="flag-outline" size={56} color={C.primary} />
              </View>
              <Text style={styles.question}>What are you training for?</Text>
              <Text style={styles.hint}>Select all that apply</Text>
              <View style={styles.chipGrid}>
                {GOAL_OPTIONS.map(opt => {
                  const selected = goals.includes(opt.value);
                  return (
                    <Pressable
                      key={opt.value}
                      onPress={() => toggleGoal(opt.value)}
                      style={[styles.chip, selected && styles.chipSelected]}
                      testID={`goal-${opt.value}`}
                    >
                      <Ionicons
                        name={opt.icon}
                        size={16}
                        color={selected ? C.primary : C.textSecondary}
                      />
                      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                        {opt.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </View>

          {/* Screen 6: Equipment */}
          <View style={[styles.screen, { width: SCREEN_WIDTH }]}>
            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={[styles.screenScrollContent, { paddingBottom: 16 }]}
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.iconCircle}>
                <Ionicons name="fitness-outline" size={56} color={C.primary} />
              </View>
              <Text style={styles.question}>What do you have access to?</Text>
              <Text style={styles.hint}>Select everything available to you</Text>
              <View style={styles.optionList}>
                {EQUIPMENT_OPTIONS.filter(opt => (available as string[]).includes(opt.value)).map(opt => {
                  const selected = equipment.includes(opt.value);
                  return (
                    <Pressable
                      key={opt.value}
                      onPress={() => toggleEquipment(opt.value)}
                      style={({ pressed }) => [
                        styles.optionCard,
                        selected && styles.optionCardSelected,
                        pressed && styles.optionCardPressed,
                      ]}
                      testID={`equipment-${opt.value}`}
                    >
                      <View style={[styles.optionIcon, selected && styles.optionIconSelected]}>
                        <Ionicons
                          name={opt.icon}
                          size={22}
                          color={selected ? C.textInverse : C.primary}
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[
                          styles.optionLabel,
                          selected && styles.optionLabelSelected,
                        ]}>
                          {opt.label}
                        </Text>
                        <Text style={styles.optionDesc}>{opt.description}</Text>
                      </View>
                      <View style={[
                        styles.checkBox,
                        selected && styles.checkBoxSelected,
                      ]}>
                        {selected && <Ionicons name="checkmark" size={14} color={C.textInverse} />}
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            </ScrollView>
          </View>

          {/* Screen 7: Key Lifts (optional) */}
          <View style={[styles.screen, { width: SCREEN_WIDTH }]}>
            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={[styles.screenScrollContent, { paddingBottom: 24 }]}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.iconCircle}>
                <Ionicons name="podium-outline" size={56} color={C.primary} />
              </View>
              <Text style={styles.question}>Your best lifts</Text>
              <Text style={styles.hint}>Optional — used to set starting weights precisely</Text>
              <View style={styles.liftRows}>
                <LiftInput
                  label="Back Squat"
                  value={ormSquat}
                  onChangeText={setOrmSquat}
                  testID="orm-squat"
                />
                <LiftInput
                  label="Bench Press"
                  value={ormBench}
                  onChangeText={setOrmBench}
                  testID="orm-bench"
                />
                <LiftInput
                  label="Deadlift"
                  value={ormDeadlift}
                  onChangeText={setOrmDeadlift}
                  testID="orm-deadlift"
                />
              </View>
              <Pressable onPress={handleSkipLifts} style={styles.skipLink}>
                <Text style={styles.skipText}>Skip — add these later</Text>
              </Pressable>
            </ScrollView>
          </View>

          {/* Screen 8: Profile Built! */}
          <View style={[styles.screen, { width: SCREEN_WIDTH }]}>
            <View style={[styles.screenContent, styles.celebContent]}>
              <Animated.View style={[styles.celebIconWrap, checkAnimStyle]}>
                <Ionicons name="checkmark-circle" size={96} color={C.primary} />
              </Animated.View>
              <Animated.Text style={[styles.celebTitle, celebTitleStyle]}>
                Profile Built!
              </Animated.Text>
              <Animated.Text style={[styles.celebName, celebTitleStyle]}>
                {name.trim()
                  ? `Your profile is ready, ${name.trim().split(' ')[0]}`
                  : 'Your profile is ready'}
              </Animated.Text>
              <Animated.View style={[styles.celebSummary, celebSummaryStyle]}>
                <CelebSummaryPill
                  icon="barbell-outline"
                  label={experienceLabel(experience)}
                />
                <CelebSummaryPill
                  icon="flag-outline"
                  label={goalLabel(goals[0] ?? null)}
                />
                <CelebSummaryPill
                  icon="fitness-outline"
                  label={equipmentLabel(equipment)}
                />
              </Animated.View>
              <Animated.View style={[{ width: '100%', marginTop: 40 }, celebSummaryStyle]}>
                <Text style={styles.profileReadySub}>Your first session is ready</Text>
                <Pressable
                  onPress={handleComplete}
                  style={({ pressed }) => [
                    styles.continueBtn,
                    pressed && styles.continueBtnPressed,
                  ]}
                  testID="profile-built-cta"
                >
                  <Text style={styles.continueBtnText}>Start Training</Text>
                  <Ionicons name="arrow-forward" size={20} color={C.textInverse} />
                </Pressable>
              </Animated.View>
            </View>
          </View>
        </ScrollView>

        {/* Footer */}
        {showContinue && (
          <View style={[styles.footer, { paddingBottom: bottomPad + 16, paddingHorizontal: 24 }]}>
            <Pressable
              onPress={handleNext}
              disabled={!canGo}
              accessibilityState={{ disabled: !canGo }}
              style={({ pressed }) => [
                styles.continueBtn,
                !canGo && styles.continueBtnDisabled,
                pressed && canGo && styles.continueBtnPressed,
              ]}
              testID={currentIndex === 0 ? 'get-started-btn' : 'continue-btn'}
            >
              <Text style={[styles.continueBtnText, !canGo && styles.continueBtnTextDisabled]}>
                {currentIndex === 0 ? 'Get Started' : currentIndex === 7 ? 'Save & Continue' : 'Continue'}
              </Text>
              <Ionicons
                name={currentIndex === 0 ? 'chevron-forward' : 'arrow-forward'}
                size={20}
                color={canGo ? C.textInverse : C.textTertiary}
              />
            </Pressable>
          </View>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

function LiftInput({
  label, value, onChangeText, testID,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  testID?: string;
}) {
  const C = useColors();
  const liftStyles = useMemo(() => makeLiftStyles(C), [C]);
  return (
    <View style={liftStyles.row}>
      <View style={liftStyles.iconWrap}>
        <Ionicons name="barbell-outline" size={20} color={C.primary} />
      </View>
      <Text style={liftStyles.label}>{label}</Text>
      <View style={liftStyles.inputSide}>
        <TextInput
          style={liftStyles.input}
          value={value}
          onChangeText={onChangeText}
          keyboardType="decimal-pad"
          placeholder="—"
          placeholderTextColor={C.textTertiary}
          selectTextOnFocus
          testID={testID}
        />
        <Text style={liftStyles.unit}>kg</Text>
      </View>
    </View>
  );
}

function CelebSummaryPill({ icon, label }: { icon: keyof typeof Ionicons.glyphMap; label: string }) {
  const C = useColors();
  const celebStyles = useMemo(() => makeCelebStyles(C), [C]);
  if (!label) return null;
  return (
    <View style={celebStyles.pill}>
      <Ionicons name={icon} size={14} color={C.primary} />
      <Text style={celebStyles.pillText}>{label}</Text>
    </View>
  );
}

function makeStyles(C: ReturnType<typeof useColors>) { return StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingBottom: 10,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: C.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: C.borderLight,
  },
  backPlaceholder: { width: 38 },
  progressTrack: {
    flex: 1,
    height: 4,
    backgroundColor: C.surfaceTertiary,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: C.primary,
    borderRadius: 2,
  },
  screen: { flexShrink: 0 },
  screenContent: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 28,
  },
  screenScrollContent: {
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 28,
  },
  iconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: C.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  question: {
    fontSize: 26,
    fontFamily: 'Inter_700Bold',
    color: C.text,
    textAlign: 'center',
    lineHeight: 34,
    marginBottom: 8,
  },
  hint: {
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
    color: C.textSecondary,
    textAlign: 'center',
    marginBottom: 28,
  },
  optionList: { width: '100%', gap: 10 },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.surface,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderWidth: 1.5,
    borderColor: C.borderLight,
    gap: 12,
  },
  optionCardSelected: {
    borderColor: C.primary,
    backgroundColor: C.primarySurface,
  },
  optionCardPressed: { opacity: 0.88 },
  optionIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: C.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionIconSelected: { backgroundColor: C.primary },
  optionLabel: {
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
    color: C.text,
  },
  optionLabelSelected: { color: C.primaryDark },
  optionDesc: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    color: C.textSecondary,
    marginTop: 1,
  },
  optionDescSelected: { color: C.primary },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: C.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioSelected: { borderColor: C.primary },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: C.primary,
  },
  checkBox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: C.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkBoxSelected: {
    backgroundColor: C.primary,
    borderColor: C.primary,
  },
  inputWrap: { width: '100%' },
  textInput: {
    height: 54,
    borderWidth: 1.5,
    borderColor: C.border,
    borderRadius: 14,
    paddingHorizontal: 18,
    fontSize: 18,
    fontFamily: 'Inter_600SemiBold',
    color: C.text,
    backgroundColor: C.surface,
    width: '100%',
  },
  numericInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    justifyContent: 'center',
  },
  numericInput: { width: 140, textAlign: 'center' },
  unitLabel: {
    fontSize: 18,
    fontFamily: 'Inter_600SemiBold',
    color: C.textSecondary,
  },
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'center',
    width: '100%',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 50,
    borderWidth: 1.5,
    borderColor: C.border,
    backgroundColor: C.surface,
  },
  chipSelected: {
    borderColor: C.primary,
    backgroundColor: C.primaryMuted,
  },
  chipText: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    color: C.textSecondary,
  },
  chipTextSelected: { color: C.primaryDark },
  liftRows: { width: '100%', marginTop: 4 },
  skipLink: { marginTop: 16, alignSelf: 'center', padding: 8 },
  skipText: {
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
    color: C.textSecondary,
    textDecorationLine: 'underline',
  },
  footer: { paddingTop: 12 },
  continueBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.primary,
    borderRadius: 16,
    height: 54,
    gap: 8,
  },
  continueBtnDisabled: { backgroundColor: C.surfaceTertiary },
  continueBtnPressed: { opacity: 0.88, transform: [{ scale: 0.98 }] },
  continueBtnText: {
    fontSize: 17,
    fontFamily: 'Inter_700Bold',
    color: C.textInverse,
  },
  continueBtnTextDisabled: { color: C.textTertiary },
  profileReadySub: {
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
    color: C.textSecondary,
    textAlign: 'center',
    marginBottom: 16,
  },
  celebContent: { justifyContent: 'center', paddingTop: 0 },
  celebIconWrap: { marginBottom: 20 },
  celebTitle: {
    fontSize: 34,
    fontFamily: 'Inter_700Bold',
    color: C.text,
    textAlign: 'center',
    marginBottom: 8,
  },
  celebName: {
    fontSize: 18,
    fontFamily: 'Inter_500Medium',
    color: C.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
  },
  celebSummary: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  welcomeLogoImage: {
    width: 160,
    height: 160,
    borderRadius: 80,
    marginBottom: 28,
  },
  welcomeTagline: {
    fontSize: 15,
    fontFamily: 'Inter_500Medium',
    color: C.textSecondary,
    letterSpacing: 1.2,
    marginTop: 4,
    marginBottom: 24,
  },
  welcomeDivider: {
    width: 40,
    height: 3,
    backgroundColor: C.primaryMuted,
    borderRadius: 2,
    marginBottom: 24,
  },
  welcomeSubtitle: {
    fontSize: 17,
    fontFamily: 'Inter_500Medium',
    color: C.text,
    textAlign: 'center',
    lineHeight: 26,
    marginBottom: 28,
  },
  welcomePillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
  },
  welcomePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: C.primaryMuted,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 50,
  },
  welcomePillText: {
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
    color: C.primaryDark,
  },
}); }

function makeLiftStyles(C: ReturnType<typeof useColors>) { return StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: C.borderLight,
    gap: 12,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: C.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    flex: 1,
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
    color: C.text,
  },
  inputSide: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  input: {
    width: 72,
    height: 40,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: C.border,
    backgroundColor: C.surface,
    textAlign: 'center',
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
    color: C.text,
    paddingHorizontal: 8,
  },
  unit: { fontSize: 13, fontFamily: 'Inter_400Regular', color: C.textTertiary, width: 22 },
}); }

function makeCelebStyles(C: ReturnType<typeof useColors>) { return StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: C.primaryMuted,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 50,
  },
  pillText: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
    color: C.primaryDark,
  },
}); }
