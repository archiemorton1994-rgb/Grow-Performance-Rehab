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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { GrowIcon } from '@/components/GrowIcon';
import type { GrowIconName } from '@/lib/icon-art';
import { EquipmentIcon } from '@/components/EquipmentIcon';
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
  isPlausibleOneRepMaxKg,
  MAX_BODYWEIGHT_KG,
  MAX_ONE_REP_MAX_KG,
  MIN_BODYWEIGHT_KG,
  MIN_ONE_REP_MAX_KG,
  Sex,
  SessionType,
  TestWeekFrequency,
  TIER_ORDER,
  useAppStore,
} from '@/lib/store';
import { getSessionImage } from '@/lib/session-images';
import { requestNotificationPermission, scheduleBodyweightReminder } from '@/lib/notifications';
import { ASSUMED_BODYWEIGHT_KG, TYPED_NUMBER, bodyweightIssue } from '@/lib/bodyweight';
import { displayUnitToKg, kgToDisplayUnit } from '@/lib/utils';

const EXPERIENCE_OPTIONS: {
  value: ExperienceLevel;
  label: string;
  description: string;
  icon: GrowIconName;
}[] = [
  {
    value: 'beginner',
    label: 'Just getting started',
    description: 'New to structured training',
    icon: 'leaf',
  },
  {
    value: 'intermediate',
    label: '1-3 years training',
    description: 'Comfortable with the basics',
    icon: 'dumbbell',
  },
  {
    value: 'advanced',
    label: '3+ years, know my numbers',
    description: 'Experienced lifter',
    icon: 'trophy',
  },
];

const SEX_OPTIONS: {
  value: Sex;
  label: string;
  icon: GrowIconName;
}[] = [
  { value: 'male', label: 'Male', icon: 'male' },
  { value: 'female', label: 'Female', icon: 'female' },
  { value: 'other', label: 'Prefer not to say', icon: 'person' },
];

const GOAL_OPTIONS: {
  value: FitnessGoal;
  label: string;
  icon: GrowIconName;
}[] = [
  { value: 'strength', label: 'Build Strength', icon: 'dumbbell' },
  { value: 'muscle', label: 'Build Muscle', icon: 'muscle' },
  { value: 'power', label: 'Power & Speed', icon: 'bolt' },
  { value: 'fat_loss', label: 'Lose Fat', icon: 'flame' },
  { value: 'fitness', label: 'General Fitness', icon: 'heart' },
  { value: 'rehab', label: 'Rehabilitation', icon: 'rehab' },
];

const EQUIPMENT_OPTIONS: {
  value: EquipmentTier;
  label: string;
  description: string;
}[] = [
  {
    value: 'bodyweight',
    label: 'No Equipment',
    description: 'No equipment needed',
  },
  {
    value: 'bands',
    label: 'Resistance Bands',
    description: 'Bands and tubes',
  },
  {
    value: 'dumbbells',
    label: 'Dumbbells',
    description: 'Adjustable dumbbells',
  },
  {
    value: 'kettlebells',
    label: 'Kettlebells',
    description: 'Kettlebells available',
  },
  {
    value: 'fullgym',
    label: 'Full Gym',
    description: 'Everything - cables, machines, full setup',
  },
];

const EQUIPMENT_IMAGES: Record<string, any> = {
  bodyweight: require('@/assets/images/equipment/bodyweight.png'),
  bands: require('@/assets/images/equipment/bands.png'),
  dumbbells: require('@/assets/images/equipment/dumbbells.png'),
  kettlebells: require('@/assets/images/equipment/kettlebells.png'),
  fullgym: require('@/assets/images/equipment/fullgym.png'),
};

/**
 * Three pillars rather than seven bullets under three headings. The list
 * carried the same information but as ten stacked text elements at nearly one
 * weight, which reads as a wall on a phone. One line each, an icon to anchor
 * it, and the detail moved into a single supporting sentence.
 */
const WELCOME_PILLARS = [
  {
    icon: 'sliders' as const,
    title: 'Built around you',
    body: 'Adapts to your equipment, energy and pain, with the right load every session.',
  },
  {
    icon: 'dumbbell' as const,
    title: 'Train and recover',
    body: 'Strength, conditioning, mobility and rehab, all in one plan.',
  },
  {
    icon: 'trend' as const,
    title: 'See it add up',
    body: '1RM trends, personal bests and detailed stats over time.',
  },
];

/**
 * Screen indices for the pager, in order.
 *
 * Every one of them is named, because the index is referenced from five places
 * that must agree — the canContinue switch, the handleNext boundaries, the
 * index-keyed focus/animation effects, the footer's visibility and label, and
 * the progress bar. Moving one screen means moving all of them, and the
 * failures are silent: a step whose Continue button never enables, a text field
 * that stops autofocusing, or a button that stops rendering entirely.
 *
 * Theme sits at 1, immediately after the welcome and before anything is asked.
 * It is the only question whose answer changes how every screen after it LOOKS,
 * so answering it first means the rest of onboarding is already in the user's
 * own theme rather than switching appearance at the very end. It is also a
 * no-wrong-answer question, which is a gentler opener than personal details.
 */
const WELCOME_INDEX = 0;
const THEME_INDEX = 1;
/**
 * Units sits beside theme, and before anything personal is asked, for the same
 * reason theme does: it is a no-wrong-answer question, and it changes how every
 * screen AFTER it reads. It has to come before bodyweight in particular — that
 * step used to assume kilograms whatever the user thought they were typing.
 */
const UNITS_INDEX = 2;
const NAME_INDEX = 3;
const SEX_INDEX = 4;
const EXPERIENCE_INDEX = 5;
const BODYWEIGHT_INDEX = 6;
const GOALS_INDEX = 7;
const EQUIPMENT_INDEX = 8;
const LIFTS_INDEX = 9;
const TEST_WEEK_INDEX = 10;
const CELEBRATION_INDEX = 11;


/**
 * The same for a best-lift entry, where blank is a legitimate answer — the step
 * is optional and says so. A 1RM sets the working weight directly, so 10000 here
 * prescribes a bar nobody can load and the session screen will not accept.
 */
export function oneRepMaxIssue(text: string): string | null {
  const trimmed = text.trim();
  if (trimmed === '') return null;
  if (!TYPED_NUMBER.test(trimmed)) return 'Enter a number, or leave this blank';
  if (!isPlausibleOneRepMaxKg(parseFloat(trimmed))) {
    return `Enter a best lift between ${MIN_ONE_REP_MAX_KG} and ${MAX_ONE_REP_MAX_KG} kg, or leave it blank.`;
  }
  return null;
}

function experienceLabel(e: ExperienceLevel | null): string {
  switch (e) {
    case 'beginner':
      return 'Beginner';
    case 'intermediate':
      return 'Intermediate';
    case 'advanced':
      return 'Advanced';
    default:
      return '';
  }
}

function goalLabel(g: FitnessGoal | null): string {
  const found = GOAL_OPTIONS.find((o) => o.value === g);
  return found?.label ?? '';
}

function equipmentLabel(tiers: EquipmentTier[]): string {
  if (tiers.includes('fullgym')) return 'Full Gym';
  if (tiers.includes('kettlebells')) return 'Kettlebells';
  if (tiers.includes('dumbbells')) return 'Dumbbells';
  if (tiers.includes('bands')) return 'Bands';
  return 'No Equipment';
}

/**
 * The saved answers live in AsyncStorage, which is read asynchronously, so on a
 * reload this screen can mount before there is anything to restore from. Waiting
 * for that read means the flow is built once, already holding the draft, instead
 * of starting on the welcome screen and visibly jumping a moment later.
 */
export default function OnboardingScreen() {
  const C = useColors();
  const hasHydrated = useAppStore((s) => s.hasHydrated);
  if (!hasHydrated) return <View style={{ flex: 1, backgroundColor: C.background }} />;
  return <OnboardingFlow />;
}

function OnboardingFlow() {
  const C = useColors();
  const styles = useMemo(() => makeStyles(C), [C]);
  const insets = useSafeAreaInsets();
  const { width: SCREEN_WIDTH } = useWindowDimensions();
  const scrollRef = useRef<ScrollView>(null);
  const {
    setEquipmentTiers,
    setOnboardingComplete,
    setUserProfile,
    addOneRepMax,
    bodyweightUpdatedAt,
    completedSessions,
    themePreference,
    setThemePreference,
    weightUnit,
    setWeightUnit,
    setTestWeekFrequency,
    saveOnboardingDraft,
  } = useAppStore();

  // Read once, at mount. The draft is where this flow starts, not a live source:
  // after this every answer flows one way, from component state out to the store.
  const [draft] = useState(() => useAppStore.getState().onboardingDraft);

  // Clamped, because a step from an older build (or a corrupted one) that points
  // past the last screen would strand the user on blank space: canContinue falls
  // through to false there, so the footer button is gone and there is no way on.
  const [currentIndex, setCurrentIndex] = useState(() =>
    Math.min(Math.max(Math.trunc(draft?.step ?? 0), 0), CELEBRATION_INDEX)
  );

  const [name, setName] = useState(() => draft?.name ?? '');
  const [sex, setSex] = useState<Sex | null>(() => draft?.sex ?? null);
  const [experience, setExperience] = useState<ExperienceLevel | null>(
    () => draft?.experienceLevel ?? null
  );
  const [bodyweight, setBodyweight] = useState(() => draft?.bodyweight ?? '');
  const [goals, setGoals] = useState<FitnessGoal[]>(() => draft?.goals ?? []);
  const [equipment, setEquipment] = useState<EquipmentTier[]>(() => draft?.equipmentTiers ?? []);
  const [ormSquat, setOrmSquat] = useState(() => draft?.ormSquat ?? '');
  const [ormBench, setOrmBench] = useState(() => draft?.ormBench ?? '');
  const [ormDeadlift, setOrmDeadlift] = useState(() => draft?.ormDeadlift ?? '');
  // Default to the app's existing behaviour so doing nothing keeps test weeks on.
  const [testFrequency, setTestFrequency] = useState<TestWeekFrequency>(
    () => draft?.testWeekFrequency ?? 12
  );

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

  // Answering the experience question resets the equipment picked under the old
  // answer. It must fire on a CHANGE and not on mount, or restoring a draft would
  // wipe the equipment the user had already chosen before they reloaded.
  const answeredExperience = useRef<ExperienceLevel | null>(experience);
  useEffect(() => {
    if (answeredExperience.current === experience) return;
    answeredExperience.current = experience;
    if (experience === 'beginner') {
      setEquipment(['bodyweight']);
    } else if (experience !== null) {
      setEquipment([]);
    }
  }, [experience]);

  // Persist every answer as it is given. The alternative — writing only at the
  // end — is what made a reload on step nine throw away all eight answers.
  useEffect(() => {
    saveOnboardingDraft({
      step: currentIndex,
      name,
      sex,
      experienceLevel: experience,
      bodyweight,
      goals,
      equipmentTiers: equipment,
      ormSquat,
      ormBench,
      ormDeadlift,
      testWeekFrequency: testFrequency,
    });
  }, [
    currentIndex,
    name,
    sex,
    experience,
    bodyweight,
    goals,
    equipment,
    ormSquat,
    ormBench,
    ormDeadlift,
    testFrequency,
    saveOnboardingDraft,
  ]);

  // A restored draft mounts on a later page, but the pager itself always starts
  // at offset zero, so put it where the index says. One tick late, because the
  // pages have to be laid out before an offset means anything.
  useEffect(() => {
    if (currentIndex === 0) return;
    const t = setTimeout(() => {
      scrollRef.current?.scrollTo({ x: SCREEN_WIDTH * currentIndex, animated: false });
    }, 0);
    return () => clearTimeout(t);
    // Mount only: every later move goes through goTo, which scrolls itself.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (currentIndex === NAME_INDEX) {
      setTimeout(() => nameInputRef.current?.focus(), 350);
    } else if (currentIndex === BODYWEIGHT_INDEX) {
      setTimeout(() => bwInputRef.current?.focus(), 350);
    } else if (currentIndex === CELEBRATION_INDEX) {
      checkScale.value = withDelay(200, withSpring(1, { damping: 12, stiffness: 180 }));
      checkOpacity.value = withDelay(200, withTiming(1, { duration: 250 }));
      celebTitleOpacity.value = withDelay(600, withTiming(1, { duration: 400 }));
      celebSummaryOpacity.value = withDelay(900, withTiming(1, { duration: 400 }));
      // Request notification permission, then attempt to prime the bodyweight reminder scheduler.
      // At onboarding time there are no completed sessions yet, so scheduleBodyweightReminder
      // returns early — the Home tab's useEffect will schedule it after their first session.
      (async () => {
        const granted = await requestNotificationPermission();
        if (granted) {
          await scheduleBodyweightReminder(bodyweightUpdatedAt, completedSessions.length > 0);
        }
      })();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex]);

  const checkAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: checkScale.value }],
    opacity: checkOpacity.value,
  }));
  const celebTitleStyle = useAnimatedStyle(() => ({ opacity: celebTitleOpacity.value }));
  const celebSummaryStyle = useAnimatedStyle(() => ({ opacity: celebSummaryOpacity.value }));

  const goTo = useCallback(
    (index: number) => {
      // Web: jump instantly. Animated (smooth) scrolling on web can be
      // interrupted by a mid-animation reflow, and the pager's CSS scroll-snap
      // then re-snaps back to the previous page, leaving the flow stuck.
      scrollRef.current?.scrollTo({ x: SCREEN_WIDTH * index, animated: Platform.OS !== 'web' });
      setCurrentIndex(index);
    },
    [SCREEN_WIDTH]
  );

  // Web safety net: re-assert the pager offset after each index change so a
  // browser re-snap or late reflow can never leave the scroll position
  // desynced from currentIndex.
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const t = setTimeout(() => {
      scrollRef.current?.scrollTo({ x: SCREEN_WIDTH * currentIndex, animated: false });
    }, 350);
    return () => clearTimeout(t);
  }, [currentIndex, SCREEN_WIDTH]);

  const bodyweightError = bodyweight.trim() === '' ? null : bodyweightIssue(bodyweight, weightUnit);
  const liftIssues = useMemo(
    () => [oneRepMaxIssue(ormSquat), oneRepMaxIssue(ormBench), oneRepMaxIssue(ormDeadlift)],
    [ormSquat, ormBench, ormDeadlift]
  );

  const canContinue = useCallback((): boolean => {
    switch (currentIndex) {
      case WELCOME_INDEX:
        return true;
      case UNITS_INDEX:
        // Always answerable: a unit is already set (kg by default), so there is
        // nothing to validate and nothing that can block the button.
        return true;
      case THEME_INDEX:
        return true;
      case NAME_INDEX:
        return name.trim().length > 0;
      case SEX_INDEX:
        return sex !== null;
      case EXPERIENCE_INDEX:
        return experience !== null;
      case BODYWEIGHT_INDEX:
        // Blank moves on. The step is optional and says so, so gating Continue
        // on a number made it optional in words only - which is how a question
        // nobody has to answer becomes a wall.
        return bodyweight.trim() === '' || bodyweightIssue(bodyweight, weightUnit) === null;
      case GOALS_INDEX:
        return goals.length > 0;
      case EQUIPMENT_INDEX:
        return equipment.length > 0;
      case LIFTS_INDEX:
        // Optional, so blank passes — but a number that IS given has to be one
        // the app can program from, since it becomes the working weight.
        return liftIssues.every((issue) => issue === null);
      case TEST_WEEK_INDEX:
        return true;
      default:
        return false;
    }
  }, [currentIndex, name, sex, experience, bodyweight, goals, equipment, liftIssues]);

  const saveAndComplete = useCallback(() => {
    setUserProfile({
      name: name.trim(),
      sex: sex ?? 'other',
      experienceLevel: experience ?? 'beginner',
      goals: goals.length > 0 ? goals : ['fitness'],
      // Converted from whatever unit the user picked. This used to be
      // parseFloat(bodyweight) straight into a kg field, so a US user typing
      // 176 lb was recorded as 176 KILOS and every starting weight in the app
      // was scaled from it.
      //
      // Blank is a legitimate answer - the step says so - and then the app has
      // to assume something, because the load maths needs a number. It assumes
      // ASSUMED_BODYWEIGHT_KG and the step says that figure out loud, which is
      // the difference between an assumption and a guess nobody agreed to.
      bodyweightKg: TYPED_NUMBER.test(bodyweight.trim())
        ? displayUnitToKg(parseFloat(bodyweight.trim()), weightUnit)
        : ASSUMED_BODYWEIGHT_KG,
    });
    setEquipmentTiers(equipment);
    setTestWeekFrequency(testFrequency);
  }, [
    name,
    sex,
    experience,
    bodyweight,
    goals,
    equipment,
    testFrequency,
    setUserProfile,
    setEquipmentTiers,
    setTestWeekFrequency,
  ]);

  const handleNext = useCallback(() => {
    if (!canContinue()) return;
    hapticMedium();
    Keyboard.dismiss();
    if (currentIndex < TEST_WEEK_INDEX) {
      goTo(currentIndex + 1);
    } else if (currentIndex === TEST_WEEK_INDEX) {
      // The last question, so the profile is written here. It must not be
      // written earlier: an answer given after the save is an answer that gets
      // ignored, which is exactly what happened when the save sat on the
      // best-lifts step and the test-week choice came after it.
      saveAndComplete();
      goTo(CELEBRATION_INDEX);
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
      // The lifts step already refuses to advance past an implausible entry;
      // this is the write itself, so it checks again rather than assuming.
      if (isPlausibleOneRepMaxKg(kg)) {
        addOneRepMax({ lift, weight: kg, reps: 1, date: today, unit: 'kg' });
      }
    }
    // Don't navigate directly — that would skip the auth/subscription gate
    // entirely. Every other gate screen (auth, subscription) just updates its
    // own piece of state and lets the root gate in app/_layout.tsx decide the
    // correct next screen; do the same here for consistency and correctness.
    setOnboardingComplete(true);
  }, [hapticMedium, ormSquat, ormBench, ormDeadlift, addOneRepMax, setOnboardingComplete]);

  const handleSkipLifts = useCallback(() => {
    haptic();
    Keyboard.dismiss();
    // Skipping the lifts must still land on the test-week question, not jump
    // past it — and the save now happens there, once the answer exists.
    goTo(TEST_WEEK_INDEX);
  }, [haptic, goTo]);

  const toggleGoal = useCallback(
    (goal: FitnessGoal) => {
      haptic();
      setGoals((prev) => (prev.includes(goal) ? prev.filter((g) => g !== goal) : [...prev, goal]));
    },
    [haptic]
  );

  const toggleEquipment = useCallback(
    (tier: EquipmentTier) => {
      const isLocked = experience === 'beginner' && !['bodyweight', 'bands'].includes(tier);
      if (isLocked) return;
      haptic();
      setEquipment((prev) => {
        if (tier === 'fullgym') {
          return prev.includes('fullgym') ? prev.filter((t) => t !== 'fullgym') : [...TIER_ORDER];
        }
        if (prev.includes(tier)) {
          return prev.filter((t) => t !== tier && t !== 'fullgym');
        }
        return [...prev, tier];
      });
    },
    [haptic, experience]
  );

  const available = experience === 'beginner' ? ['bodyweight', 'bands'] : TIER_ORDER;
  const showProgress = currentIndex >= 1;
  const progressFraction = showProgress ? Math.min(currentIndex / CELEBRATION_INDEX, 1) : 0;
  const showBack = currentIndex > 0;
  // Every screen except the celebration gets a footer button. Bare numbers here
  // are how the theme screen lost its Continue button when a screen was inserted
  // before it — this must track CELEBRATION_INDEX, not a literal.
  const showContinue = currentIndex < CELEBRATION_INDEX;
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
            <Pressable
              onPress={handleBack}
              style={styles.backBtn}
              testID="onboarding-back"
              accessibilityLabel="Back"
              accessibilityRole="button"
            >
              <Ionicons name="chevron-back" size={24} color={C.text} />
            </Pressable>
          ) : (
            <View style={styles.backPlaceholder} />
          )}
          {showProgress && (
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${progressFraction * 100}%` }]} />
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
              <Text style={styles.welcomeHeadline}>Build your training profile</Text>
              <View style={styles.welcomeMetaRow}>
                <GrowIcon name="clock" size={13} color={C.textSecondary} />
                <Text style={styles.welcomeMetaText}>Takes less than 2 minutes</Text>
              </View>

              <View style={styles.welcomeFeatureList}>
                {WELCOME_PILLARS.map((pillar) => (
                  <View key={pillar.title} style={styles.welcomePillar}>
                    <View style={styles.welcomePillarIcon}>
                      <GrowIcon name={pillar.icon} size={18} color={C.primaryText} />
                    </View>
                    <View style={styles.welcomePillarText}>
                      <Text style={styles.welcomePillarTitle}>{pillar.title}</Text>
                      <Text style={styles.welcomePillarBody}>{pillar.body}</Text>
                    </View>
                  </View>
                ))}
              </View>
            </Animated.View>
          </View>

          {/* Screen 1: Theme. First question asked, because it is the only one
              whose answer changes how every screen after it looks — answered
              here, the rest of onboarding runs in the user's own theme instead
              of changing appearance on the last step before the finish. */}
          <View style={[styles.screen, { width: SCREEN_WIDTH }]}>
            <View style={styles.screenContent}>
              <View style={styles.iconCircle}>
                <GrowIcon name="palette" size={56} color={C.primaryText} />
              </View>
              <Text style={styles.question}>Choose your look</Text>
              <Text style={styles.hint}>Updates live, and you can change it anytime in settings</Text>
              <View style={[styles.optionList, { marginTop: 4 }]}>
                {(
                  [
                    {
                      value: 'dark',
                      label: 'Dark',
                      icon: 'moon' as const,
                      desc: 'Dark background, easy on the eyes',
                    },
                    {
                      value: 'light',
                      label: 'Light',
                      icon: 'sun' as const,
                      desc: 'Light background, clean and bright',
                    },
                  ] as const
                ).map(({ value, label, icon, desc }) => {
                  const selected = themePreference === value;
                  return (
                    <Pressable
                      key={value}
                      onPress={() => {
                        haptic();
                        setThemePreference(value);
                      }}
                      style={({ pressed }) => [
                        styles.optionCard,
                        selected && styles.optionCardSelected,
                        pressed && styles.optionCardPressed,
                      ]}
                      testID={`theme-${value}`}
                    >
                      <View
                        style={[
                          styles.optionIcon,
                          {
                            backgroundColor: selected ? C.primaryMuted : C.surfaceTertiary,
                          },
                        ]}
                      >
                        <GrowIcon
                          name={icon}
                          size={28}
                          color={selected ? C.primaryText : C.textSecondary}
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.optionLabel, selected && styles.optionLabelSelected]}>
                          {label}
                        </Text>
                        <Text style={[styles.optionDesc, selected && styles.optionDescSelected]}>
                          {desc}
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

          {/* Screen 2: Units. Beside theme and before anything personal, because
              it is the other no-wrong-answer question and it changes how every
              screen after it READS. It has to come before bodyweight in
              particular: that step used to assume kilograms whatever the user
              thought they were typing, so someone entering 176 pounds was told
              their bodyweight was implausibly high. */}
          <View style={[styles.screen, { width: SCREEN_WIDTH }]}>
            <View style={styles.screenContent}>
              <View style={styles.iconCircle}>
                <GrowIcon name="scale" size={56} color={C.primaryText} />
              </View>
              <Text style={styles.question}>Kilos or pounds?</Text>
              <Text style={styles.hint}>
                Every weight in the app uses this, and you can change it anytime in settings
              </Text>
              <View style={[styles.optionList, { marginTop: 4 }]}>
                {(
                  [
                    {
                      value: 'kg',
                      label: 'Kilograms (kg)',
                      icon: 'dumbbell' as const,
                    },
                    {
                      value: 'lbs',
                      label: 'Pounds (lbs)',
                      icon: 'dumbbell' as const,
                    },
                  ] as const
                ).map(({ value, label, icon }) => {
                  const selected = weightUnit === value;
                  return (
                    <Pressable
                      key={value}
                      onPress={() => {
                        haptic();
                        setWeightUnit(value);
                      }}
                      style={({ pressed }) => [
                        styles.optionCard,
                        selected && styles.optionCardSelected,
                        pressed && styles.optionCardPressed,
                      ]}
                      testID={`units-${value}`}
                    >
                      <View
                        style={[
                          styles.optionIcon,
                          {
                            backgroundColor: selected ? C.primaryMuted : C.surfaceTertiary,
                          },
                        ]}
                      >
                        <GrowIcon
                          name={icon}
                          size={28}
                          color={selected ? C.primaryText : C.textSecondary}
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.optionLabel, selected && styles.optionLabelSelected]}>
                          {label}
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

          {/* Screen 3: Name */}
          <View style={[styles.screen, { width: SCREEN_WIDTH }]}>
            <View style={styles.screenContent}>
              <View style={styles.iconCircle}>
                <GrowIcon name="profile" size={56} color={C.primaryText} />
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

          {/* Screen 4: Biological Sex */}
          <View style={[styles.screen, { width: SCREEN_WIDTH }]}>
            <View style={styles.screenContent}>
              <View style={styles.iconCircle}>
                <GrowIcon name="chart" size={56} color={C.primaryText} />
              </View>
              <Text style={styles.question}>Your biological sex</Text>
              <Text style={styles.hint}>Helps us calibrate your lifting loads</Text>
              <View style={styles.optionList}>
                {SEX_OPTIONS.map((opt) => {
                  const selected = sex === opt.value;
                  return (
                    <Pressable
                      key={opt.value}
                      onPress={() => {
                        haptic();
                        setSex(opt.value);
                      }}
                      style={({ pressed }) => [
                        styles.optionCard,
                        selected && styles.optionCardSelected,
                        pressed && styles.optionCardPressed,
                      ]}
                      testID={`sex-${opt.value}`}
                    >
                      <View style={[styles.optionIcon, selected && styles.optionIconSelected]}>
                        <GrowIcon
                          name={opt.icon}
                          size={22}
                          color={selected ? C.textInverse : C.primaryText}
                        />
                      </View>
                      <Text
                        style={[
                          styles.optionLabel,
                          { flex: 1 },
                          selected && styles.optionLabelSelected,
                        ]}
                      >
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

          {/* Screen 5: Experience */}
          <View style={[styles.screen, { width: SCREEN_WIDTH }]}>
            <View style={styles.screenContent}>
              <View style={styles.iconCircle}>
                <GrowIcon name="dumbbell" size={56} color={C.primaryText} />
              </View>
              <Text style={styles.question}>How long have you been training?</Text>
              <Text style={styles.hint}>Sets the right starting weights</Text>
              <View style={styles.optionList}>
                {EXPERIENCE_OPTIONS.map((opt) => {
                  const selected = experience === opt.value;
                  return (
                    <Pressable
                      key={opt.value}
                      onPress={() => {
                        haptic();
                        setExperience(opt.value);
                      }}
                      style={({ pressed }) => [
                        styles.optionCard,
                        selected && styles.optionCardSelected,
                        pressed && styles.optionCardPressed,
                      ]}
                      testID={`experience-${opt.value}`}
                    >
                      <View style={[styles.optionIcon, selected && styles.optionIconSelected]}>
                        <GrowIcon
                          name={opt.icon}
                          size={22}
                          color={selected ? C.textInverse : C.primaryText}
                        />
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

          {/* Screen 6: Bodyweight. OPTIONAL, and it says so.
              The app used to ask for this three times: here, on opening, and
              again after the first session, via a root pop-up that could not be
              dismissed until a number was typed. Testers reported all three. It
              is asked once, here, and skipping is a real answer. */}
          <View style={[styles.screen, { width: SCREEN_WIDTH }]}>
            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={[styles.screenScrollContent, { paddingBottom: 24 }]}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.iconCircle}>
                <GrowIcon name="scale" size={56} color={C.primaryText} />
              </View>
              <Text style={styles.question}>Your current bodyweight</Text>
              {/* IT NO LONGER READS ANYONE THEIR ASSUMED WEIGHT.

                  Skipping still falls back to ASSUMED_BODYWEIGHT_KG internally,
                  because the first session has to start somewhere. Saying that
                  number out loud is a different matter: the people most likely
                  to leave this blank are the ones least likely to want a guess
                  about their weight read back to them, and the guess will be
                  furthest out for exactly those people. It was in the
                  placeholder too, sitting in the box before they typed.

                  What replaces it is also just true. Starting loads are an
                  opening bid; what actually sets the weight is the answers and
                  the reps from the first few sessions. */}
              <Text style={styles.hint}>
                Used to set your starting weights. Would rather not say? Leave it blank and the app
                will tune your weights from how your first few sessions go. You can add it any time
                in Profile.
              </Text>
              <View style={[styles.inputWrap, styles.numericInputWrap]}>
                <TextInput
                  ref={bwInputRef}
                  style={[styles.textInput, styles.numericInput]}
                  value={bodyweight}
                  onChangeText={setBodyweight}
                  placeholder="Optional"
                  placeholderTextColor={C.textTertiary}
                  keyboardType="decimal-pad"
                  returnKeyType="next"
                  onSubmitEditing={handleNext}
                  selectTextOnFocus
                  testID="bodyweight-input"
                />
                <Text style={styles.unitLabel}>{weightUnit}</Text>
              </View>
              {bodyweightError !== null && (
                <Text
                  style={{
                    fontSize: 12,
                    fontFamily: 'Inter_400Regular',
                    color: C.error,
                    textAlign: 'center',
                    marginTop: 8,
                    lineHeight: 17,
                  }}
                  testID="bodyweight-error"
                >
                  {bodyweightError}
                </Text>
              )}
            </ScrollView>
          </View>

          {/* Screen 7: Goals */}
          <View style={[styles.screen, { width: SCREEN_WIDTH }]}>
            <View style={styles.screenContent}>
              <View style={styles.iconCircle}>
                <GrowIcon name="flag" size={56} color={C.primaryText} />
              </View>
              <Text style={styles.question}>What are you training for?</Text>
              <Text style={styles.hint}>Select all that apply</Text>
              <View style={styles.chipGrid}>
                {GOAL_OPTIONS.map((opt) => {
                  const selected = goals.includes(opt.value);
                  return (
                    <Pressable
                      key={opt.value}
                      onPress={() => toggleGoal(opt.value)}
                      style={[styles.chip, selected && styles.chipSelected]}
                      testID={`goal-${opt.value}`}
                    >
                      <GrowIcon
                        name={opt.icon}
                        size={16}
                        color={selected ? C.primaryText : C.textSecondary}
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

          {/* Screen 8: Equipment.
              Compact by design, and now scrollable as a backstop. On a 4.7-inch
              phone the fifth tile (Full Gym) was sliced through and the closing
              line about changing it later was entirely off screen — on the step
              that decides which exercises the whole app will ever offer, in a
              new customer's first five minutes. The compact layout means it
              still does not scroll on a normal phone. */}
          <View style={[styles.screen, { width: SCREEN_WIDTH }]}>
            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={[styles.screenContent, styles.equipScreenContent]}
              showsVerticalScrollIndicator={false}
            >
              <View style={[styles.iconCircle, styles.iconCircleCompact]}>
                <GrowIcon name="dumbbell" size={24} color={C.primaryText} />
              </View>
              <Text style={[styles.question, styles.questionCompact]}>
                What do you have access to?
              </Text>
              <Text style={[styles.hint, styles.hintCompact]}>
                Select everything available to you
              </Text>
              <View style={[styles.optionList, styles.optionListCompact]}>
                {EQUIPMENT_OPTIONS.map((opt) => {
                  const selected = equipment.includes(opt.value);
                  const isLocked = !(available as string[]).includes(opt.value);
                  return (
                    <Pressable
                      key={opt.value}
                      onPress={() => toggleEquipment(opt.value)}
                      style={({ pressed }) => [
                        styles.optionCard,
                        styles.optionCardCompact,
                        selected && styles.optionCardSelected,
                        isLocked && { opacity: 0.5 },
                        pressed && !isLocked && styles.optionCardPressed,
                      ]}
                      testID={`equipment-${opt.value}`}
                    >
                      <View
                        style={[
                          styles.optionIcon,
                          styles.optionIconCompact,
                          { overflow: 'hidden', backgroundColor: C.surfaceTertiary },
                          selected && styles.optionIconSelected,
                        ]}
                      >
                        <Image
                          source={EQUIPMENT_IMAGES[opt.value]}
                          style={{ width: 44, height: 44 }}
                          resizeMode="contain"
                        />
                        {isLocked && (
                          <View
                            style={[
                              StyleSheet.absoluteFillObject,
                              {
                                backgroundColor: 'rgba(0,0,0,0.35)',
                                alignItems: 'center',
                                justifyContent: 'center',
                              },
                            ]}
                          >
                            <Ionicons name="lock-closed" size={16} color="rgba(255,255,255,0.85)" />
                          </View>
                        )}
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text
                          style={[
                            styles.optionLabel,
                            styles.optionLabelCompact,
                            selected && styles.optionLabelSelected,
                          ]}
                        >
                          {opt.label}
                        </Text>
                        <Text style={[styles.optionDesc, styles.optionDescCompact]}>
                          {isLocked ? 'Unlock with more experience' : opt.description}
                        </Text>
                      </View>
                      {!isLocked && (
                        <View style={[styles.checkBox, selected && styles.checkBoxSelected]}>
                          {selected && (
                            <Ionicons name="checkmark" size={14} color={C.textInverse} />
                          )}
                        </View>
                      )}
                    </Pressable>
                  );
                })}
              </View>
              <Text
                style={{
                  fontSize: 11,
                  fontFamily: 'Inter_400Regular',
                  color: C.textSecondary,
                  textAlign: 'center',
                  marginTop: 6,
                }}
              >
                You can change this anytime from your profile.
              </Text>
            </ScrollView>
          </View>

          {/* Screen 9: Key Lifts (optional) */}
          <View style={[styles.screen, { width: SCREEN_WIDTH }]}>
            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={[styles.screenScrollContent, { paddingBottom: 24 }]}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.iconCircle}>
                <GrowIcon name="podium" size={56} color={C.primaryText} />
              </View>
              <Text style={styles.question}>Your best lifts</Text>
              <Text style={styles.hint}>
                {"Optional - leave blank if you're new or returning after a break"}
              </Text>
              <View style={styles.liftRows}>
                <LiftInput
                  label="Back Squat"
                  value={ormSquat}
                  onChangeText={setOrmSquat}
                  testID="orm-squat"
                  sessionType="squat"
                  sex={sex}
                  error={liftIssues[0]}
                />
                <LiftInput
                  label="Bench Press"
                  value={ormBench}
                  onChangeText={setOrmBench}
                  testID="orm-bench"
                  sessionType="bench"
                  sex={sex}
                  error={liftIssues[1]}
                />
                <LiftInput
                  label="Deadlift"
                  value={ormDeadlift}
                  onChangeText={setOrmDeadlift}
                  testID="orm-deadlift"
                  sessionType="deadlift"
                  sex={sex}
                  error={liftIssues[2]}
                />
              </View>
              <Pressable onPress={handleSkipLifts} style={styles.skipLink}>
                <Text style={styles.skipText}>{"I don't know my best lifts"}</Text>
              </Pressable>
            </ScrollView>
          </View>

          {/* Screen 10: Strength test weeks.
              Its own screen, not a block appended to the best-lifts step. Put
              there, it fell below the fold behind three inputs and a skip link
              — the question was invisible unless you scrolled, which for a
              decision that shapes the whole programme is worse than not asking.
              Asked immediately after the lifts are named, so the "these three
              lifts" it refers to are still on screen behind you. */}
          <View style={[styles.screen, { width: SCREEN_WIDTH }]}>
            <View style={styles.screenContent}>
              <View style={styles.iconCircle}>
                <GrowIcon name="podium" size={56} color={C.primaryText} />
              </View>
              <Text style={styles.question}>Test your strength?</Text>
              <Text style={styles.hint}>
                Every 12 sessions we&apos;d max out Squat, Bench and Deadlift to re-set your
                working weights
              </Text>
              <View style={[styles.optionList, { marginTop: 4 }]}>
                {(
                  [
                    {
                      value: 12 as const,
                      label: 'Yes, test me',
                      desc: 'Keeps your weights accurate as you get stronger',
                      icon: 'trophy' as const,
                    },
                    {
                      value: 'never' as const,
                      label: 'No thanks',
                      desc: "These lifts aren't part of my training",
                      icon: 'leaf' as const,
                    },
                  ] as const
                ).map((opt) => {
                  const selected = testFrequency === opt.value;
                  return (
                    <Pressable
                      key={String(opt.value)}
                      onPress={() => {
                        haptic();
                        setTestFrequency(opt.value);
                      }}
                      style={[styles.optionCard, selected && styles.optionCardSelected]}
                      testID={`onboarding-test-${opt.value}`}
                    >
                      <View style={[styles.optionIcon, selected && styles.optionIconSelected]}>
                        <GrowIcon
                          name={opt.icon}
                          size={22}
                          color={selected ? C.textInverse : C.primaryText}
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.optionLabel, selected && styles.optionLabelSelected]}>
                          {opt.label}
                        </Text>
                        <Text style={styles.optionDesc}>{opt.desc}</Text>
                      </View>
                      <View style={[styles.radio, selected && styles.radioSelected]}>
                        {selected && <View style={styles.radioDot} />}
                      </View>
                    </Pressable>
                  );
                })}
              </View>
              <Text style={styles.testOptHint}>You can change this anytime in settings</Text>
            </View>
          </View>

          {/* Screen 11: Profile Built! */}
          <View style={[styles.screen, { width: SCREEN_WIDTH }]}>
            <View style={[styles.screenContent, styles.celebContent]}>
              <Animated.View style={[styles.celebIconWrap, checkAnimStyle]}>
                <GrowIcon name="check" size={120} color={C.primaryDark} />
              </Animated.View>
              <Animated.Text style={[styles.celebTitle, celebTitleStyle]}>
                Profile Ready!
              </Animated.Text>
              <Animated.Text style={[styles.celebName, celebTitleStyle]}>
                {name.trim()
                  ? `The first 14 days are on us, ${name.trim().split(' ')[0]}`
                  : 'The first 14 days are on us'}
              </Animated.Text>
              <Animated.View style={[styles.celebSummary, celebSummaryStyle]}>
                <CelebSummaryPill icon="dumbbell" label={experienceLabel(experience)} />
                <CelebSummaryPill icon="flag" label={goalLabel(goals[0] ?? null)} />
                <CelebSummaryPill icon="dumbbell" label={equipmentLabel(equipment)} />
              </Animated.View>
              <Animated.View style={[{ width: '100%', marginTop: 28 }, celebSummaryStyle]}>
                <Pressable
                  onPress={handleComplete}
                  style={({ pressed }) => [
                    styles.continueBtn,
                    { backgroundColor: C.primaryDark },
                    pressed && styles.continueBtnPressed,
                  ]}
                  testID="profile-built-cta"
                >
                  <Text style={[styles.continueBtnText, { color: C.primaryDarkText }]}>
                    Start Training
                  </Text>
                  <Ionicons name="arrow-forward" size={20} color={C.primaryDarkText} />
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
              testID={currentIndex === WELCOME_INDEX ? 'get-started-btn' : 'continue-btn'}
            >
              <Text style={[styles.continueBtnText, !canGo && styles.continueBtnTextDisabled]}>
                {currentIndex === WELCOME_INDEX
                  ? 'Get Started'
                  : // "Save & Continue" belongs on the screen where the profile
                    // is actually written — the last question, whichever that is.
                    currentIndex === TEST_WEEK_INDEX
                    ? 'Save & Continue'
                    : currentIndex === THEME_INDEX
                      ? 'Looks good'
                      : 'Continue'}
              </Text>
              <Ionicons
                name={currentIndex === WELCOME_INDEX ? 'chevron-forward' : 'arrow-forward'}
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
  label,
  value,
  onChangeText,
  testID,
  sessionType,
  sex,
  error,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  testID?: string;
  sessionType?: 'squat' | 'bench' | 'deadlift';
  /**
   * The in-progress onboarding selection, not the saved profile — the profile
   * is only written at the end of onboarding, so reading it here would show the
   * default artwork to someone who has already picked "female" two steps back.
   */
  sex?: Sex | null;
  /** Why this entry cannot be used, shown under the row. Null when it is fine. */
  error?: string | null;
}) {
  const C = useColors();
  const liftStyles = useMemo(() => makeLiftStyles(C), [C]);
  return (
    <View style={liftStyles.row}>
      <View style={liftStyles.rowMain}>
        <View style={liftStyles.iconWrap}>
          {sessionType ? (
            <Image
              source={getSessionImage(sessionType, sex ?? undefined)}
              style={{ width: 40, height: 40, borderRadius: 8 }}
              resizeMode="contain"
            />
          ) : (
            <GrowIcon name="dumbbell" size={20} color={C.primaryText} />
          )}
        </View>
        <Text style={liftStyles.label}>{label}</Text>
        <View style={liftStyles.inputSide}>
          <TextInput
            style={[liftStyles.input, error ? liftStyles.inputError : null]}
            value={value}
            onChangeText={onChangeText}
            keyboardType="decimal-pad"
            placeholder="-"
            placeholderTextColor={C.textTertiary}
            selectTextOnFocus
            testID={testID}
          />
          <Text style={liftStyles.unit}>kg</Text>
        </View>
      </View>
      {error ? (
        <Text style={liftStyles.error} testID={testID ? `${testID}-error` : undefined}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}

function CelebSummaryPill({
  icon,
  label,
}: {
  icon: GrowIconName;
  label: string;
}) {
  const C = useColors();
  const celebStyles = useMemo(() => makeCelebStyles(C), [C]);
  if (!label) return null;
  return (
    <View style={celebStyles.pill}>
      <GrowIcon name={icon} size={14} color={C.primaryText} />
      <Text style={celebStyles.pillText}>{label}</Text>
    </View>
  );
}

function makeStyles(C: ReturnType<typeof useColors>) {
  return StyleSheet.create({
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
    equipScreenContent: { paddingTop: 4 },
    iconCircleCompact: {
      width: 44,
      height: 44,
      borderRadius: 22,
      marginBottom: 8,
    },
    questionCompact: { fontSize: 22, lineHeight: 28, marginBottom: 4 },
    hintCompact: { fontSize: 13, marginBottom: 10 },
    optionListCompact: { gap: 6 },
    optionCardCompact: { paddingVertical: 10, paddingHorizontal: 14, gap: 12 },
    optionIconCompact: { width: 52, height: 52, borderRadius: 14 },
    optionLabelCompact: { fontSize: 15, lineHeight: 19 },
    optionDescCompact: { fontSize: 11, lineHeight: 14, marginTop: 0 },
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
      width: 52,
      height: 52,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    optionIconSelected: {},
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
    optionDescSelected: { color: C.primaryText },
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
    skipLink: { marginTop: 20, alignSelf: 'center', paddingVertical: 10, paddingHorizontal: 16 },
    skipText: {
      fontSize: 14,
      fontFamily: 'Inter_500Medium',
      color: C.textSecondary,
    },
    testOptDivider: {
      height: 1,
      backgroundColor: C.borderLight,
      alignSelf: 'stretch',
      marginTop: 18,
      marginBottom: 18,
    },
    testOptTitle: {
      fontSize: 15,
      fontFamily: 'Inter_700Bold',
      color: C.text,
      textAlign: 'center',
    },
    testOptHint: {
      fontSize: 12.5,
      lineHeight: 18,
      fontFamily: 'Inter_400Regular',
      color: C.textSecondary,
      textAlign: 'center',
      marginTop: 5,
      paddingHorizontal: 6,
    },
    testOptRow: {
      flexDirection: 'row',
      gap: 10,
      marginTop: 14,
      alignSelf: 'stretch',
    },
    testOptChip: {
      flex: 1,
      paddingVertical: 12,
      borderRadius: 12,
      alignItems: 'center',
      backgroundColor: C.surfaceSecondary,
      borderWidth: 1,
      borderColor: C.border,
    },
    testOptChipSelected: {
      backgroundColor: C.primaryMuted,
      borderColor: C.primary,
    },
    testOptChipText: {
      fontSize: 14,
      fontFamily: 'Inter_500Medium',
      color: C.textSecondary,
    },
    testOptChipTextSelected: {
      fontFamily: 'Inter_700Bold',
      color: C.primaryDark,
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
    celebContent: { justifyContent: 'center', paddingTop: 0 },
    celebIconWrap: { marginBottom: 20 },
    celebTitle: {
      fontSize: 38,
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
      // Smaller than before: the headline now carries the top of the screen, so
      // the logo does not need to compete with it for attention.
      width: 118,
      height: 118,
      borderRadius: 59,
      marginBottom: 22,
    },
    welcomeHeadline: {
      fontSize: 26,
      lineHeight: 32,
      fontFamily: 'Inter_700Bold',
      color: C.text,
      textAlign: 'center',
      letterSpacing: -0.4,
      marginBottom: 8,
    },
    welcomeMetaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      marginBottom: 30,
    },
    welcomeMetaText: {
      fontSize: 13,
      fontFamily: 'Inter_500Medium',
      color: C.textSecondary,
    },
    welcomeFeatureList: {
      alignSelf: 'stretch',
      paddingHorizontal: 26,
      gap: 20,
    },
    welcomePillar: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 14,
    },
    welcomePillarIcon: {
      width: 36,
      height: 36,
      borderRadius: 11,
      backgroundColor: C.primaryMuted,
      alignItems: 'center',
      justifyContent: 'center',
    },
    welcomePillarText: {
      flex: 1,
      gap: 3,
    },
    welcomePillarTitle: {
      fontSize: 15,
      fontFamily: 'Inter_700Bold',
      color: C.text,
    },
    welcomePillarBody: {
      fontSize: 13,
      lineHeight: 19,
      fontFamily: 'Inter_400Regular',
      color: C.textSecondary,
    },
  });
}

function makeLiftStyles(C: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    row: {
      paddingVertical: 14,
      borderBottomWidth: 1,
      borderBottomColor: C.borderLight,
    },
    rowMain: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    inputError: { borderColor: C.error },
    error: {
      fontSize: 12,
      lineHeight: 17,
      fontFamily: 'Inter_400Regular',
      color: C.error,
      marginTop: 6,
    },
    iconWrap: {
      width: 44,
      height: 44,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
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
  });
}

function makeCelebStyles(C: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    pill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      backgroundColor: C.primaryMuted,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 50,
      borderWidth: 1,
      borderColor: 'rgba(74,222,128,0.3)',
    },
    pillText: {
      fontSize: 13,
      fontFamily: 'Inter_600SemiBold',
      color: C.primaryDark,
    },
  });
}
