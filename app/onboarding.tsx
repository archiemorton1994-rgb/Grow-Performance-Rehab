/**
 * THE SIGN-UP.
 *
 * TEN PAGES, IN A ROW, AND NOT ONE OF THEM IS CONDITIONAL
 * ──────────────────────────────────────────────────────
 * What this replaced was a tree: a spine of questions that branched, so the
 * length of the form depended on the answers. It was built to be thorough and
 * it was, but it asked a person who had just downloaded a training app to make
 * a decision about programme focus, training days, session length and block
 * length before they had seen a single session, and the branch made it long for
 * exactly the people with something wrong with them.
 *
 * So it is a flat pager again, and shorter than either version: welcome, name,
 * age, sex, bodyweight, experience, goals, kit, anything to work around, done.
 * Every page is put to everybody, nothing is skipped, and none of it decides a
 * programme. Programmes are optional now and are chosen later, from Train, by
 * somebody who has already trained.
 *
 * WHERE THE RULES LIVE
 * ────────────────────
 * Not in this file. The page order, what counts as an answer, what is wrong
 * with a typed one and how a half-finished sign-up is put down and picked up
 * again are all in lib/sign-up.ts, which has no React in it and can therefore be
 * RUN by tests/onboarding-pager.check.mjs. The pager this restores was guarded
 * by a check that read this file as text and matched regular expressions
 * against it, which is how it came to assert that the bodyweight question was
 * gated while the gate let a blank straight through.
 *
 * This file draws pages and holds two pieces of state: which page, and the
 * answers so far.
 *
 * THE ONE ANSWER THAT TAKES EFFECT IMMEDIATELY
 * ────────────────────────────────────────────
 * The kilograms or pounds switch, because it sits on the bodyweight page and
 * that page's validation depends on it: "176" is a sensible number of pounds
 * and an impossible number of kilos, and somebody typing pounds into a box
 * being checked in kilos is told their own bodyweight is implausible.
 *
 * There is no theme question any more. A new install opens dark, and the
 * setting is in Profile for anybody who wants the other one.
 *
 * NOTHING IS WRITTEN UNTIL THE LAST BUTTON
 * ────────────────────────────────────────
 * `completeOnboarding` is called once, from the finish, and it writes every
 * answer in one set() and marks sign-up done in the same breath. It enrols
 * nobody in a programme and awards nothing. Until then the answers live in a
 * draft, so closing the app on page six loses nothing.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BackHandler,
  Image,
  Keyboard,
  KeyboardAvoidingView,
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
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useColors, useGoColors } from '@/constants/colors';
import { GrowIcon, GrowIconTile } from '@/components/GrowIcon';
import type { GrowIconName } from '@/lib/icon-art';
import { useReducedMotion } from '@/lib/use-reduced-motion';
import { EXPERIENCE_OPTIONS, EXPERIENCE_LABELS } from '@/lib/experience-options';
import {
  EMPTY_SIGN_UP,
  LAST_SIGN_UP_PAGE,
  SIGN_UP_PAGES,
  answersToDraft,
  canContinue,
  draftToAnswers,
  pageIndex,
  pageIssue,
  pickExperience,
  resumePage,
  toSignUpAnswers,
  toggleRegion,
  toggleTier,
  type SignUpDraftAnswers,
  type SignUpPage,
} from '@/lib/sign-up';
import {
  PAIN_CATEGORIES,
  useAppStore,
  type EquipmentTier,
  type ExperienceLevel,
  type FitnessGoal,
  type PainRegion,
  type Sex,
  type WeightUnit,
} from '@/lib/store';

/**
 * Three pillars rather than a list of features. The welcome page says what the
 * app is for, in the spirit of the thing itself: somebody who knows what they
 * are doing, in your pocket. It does not mention building a programme, because
 * that is not what is about to happen.
 */
const WELCOME_PILLARS: { icon: GrowIconName; title: string; body: string }[] = [
  {
    icon: 'sliders',
    title: 'Built around you',
    body: 'A few questions, and every session after that is written from your answers.',
  },
  {
    icon: 'rehab',
    title: 'Train and recover',
    body: 'Say what is sore and the session works around it rather than through it.',
  },
  {
    icon: 'trend',
    title: 'See it add up',
    body: 'Your lifts, your history and what has actually changed.',
  },
];

const SEX_OPTIONS: { value: Sex; label: string; icon: GrowIconName }[] = [
  { value: 'male', label: 'Male', icon: 'male' },
  { value: 'female', label: 'Female', icon: 'female' },
  { value: 'other', label: 'Prefer not to say', icon: 'person' },
];

/** The six the app has always had, in the order it has always had them. */
const GOAL_OPTIONS: { value: FitnessGoal; label: string; icon: GrowIconName }[] = [
  { value: 'strength', label: 'Build Strength', icon: 'dumbbell' },
  { value: 'muscle', label: 'Build Muscle', icon: 'muscle' },
  { value: 'power', label: 'Power & Speed', icon: 'bolt' },
  { value: 'fat_loss', label: 'Lose Fat', icon: 'flame' },
  { value: 'fitness', label: 'General Fitness', icon: 'heart' },
  { value: 'rehab', label: 'Rehabilitation', icon: 'rehab' },
];

/** Drawn beside each level. The words themselves come from one shared list. */
const EXPERIENCE_ICONS: Record<ExperienceLevel, GrowIconName> = {
  beginner: 'leaf',
  intermediate: 'dumbbell',
  advanced: 'trophy',
  athlete: 'medal',
};

const EQUIPMENT_OPTIONS: { value: EquipmentTier; label: string; description: string }[] = [
  { value: 'bodyweight', label: 'No equipment', description: 'Just you and the floor' },
  { value: 'bands', label: 'Resistance bands', description: 'Bands or tubes' },
  { value: 'dumbbells', label: 'Dumbbells', description: 'Fixed or adjustable' },
  { value: 'kettlebells', label: 'Kettlebells', description: 'One or a set' },
  { value: 'fullgym', label: 'Full gym', description: 'Racks, cables and machines' },
];

// Partial on purpose: EQUIPMENT_OPTIONS above is the list of tiles, and there
// is no bench tile yet, so there is no bench photograph either.
const EQUIPMENT_IMAGES: Partial<Record<EquipmentTier, any>> = {
  bodyweight: require('@/assets/images/equipment/bodyweight.png'),
  bands: require('@/assets/images/equipment/bands.png'),
  dumbbells: require('@/assets/images/equipment/dumbbells.png'),
  kettlebells: require('@/assets/images/equipment/kettlebells.png'),
  fullgym: require('@/assets/images/equipment/fullgym.png'),
};

/** Every area the app can adapt around, from the one list that owns them. */
const ALL_REGIONS: { id: PainRegion; label: string }[] = Object.values(PAIN_CATEGORIES).flatMap(
  (group) => group.regions
);

const UNIT_OPTIONS: { value: WeightUnit; label: string }[] = [
  { value: 'kg', label: 'Kilograms' },
  { value: 'lbs', label: 'Pounds' },
];

/**
 * The saved answers live in AsyncStorage, which is read asynchronously, so this
 * screen can mount before there is anything to restore from. Waiting for that
 * read means the flow is built once, already holding the draft, rather than
 * starting on the welcome page and jumping a moment later.
 */
export default function OnboardingScreen() {
  const C = useColors();
  const hasHydrated = useAppStore((s) => s.hasHydrated);
  if (!hasHydrated) return <View style={{ flex: 1, backgroundColor: C.background }} />;
  return <SignUpFlow />;
}

function SignUpFlow() {
  const C = useColors();
  const go = useGoColors();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(C), [C]);
  const { width: SCREEN_WIDTH } = useWindowDimensions();
  const reduceMotion = useReducedMotion();
  const scrollRef = useRef<ScrollView>(null);
  const nameInputRef = useRef<TextInput>(null);
  const ageInputRef = useRef<TextInput>(null);
  const bwInputRef = useRef<TextInput>(null);

  const saveOnboardingDraft = useAppStore((s) => s.saveOnboardingDraft);
  const completeOnboarding = useAppStore((s) => s.completeOnboarding);
  const setWeightUnit = useAppStore((s) => s.setWeightUnit);
  const weightUnit = useAppStore((s) => s.weightUnit);

  // Read once, at mount. The draft is where this flow starts, not a live source:
  // after this every answer flows one way, from here out to the store.
  const [draft] = useState(() => useAppStore.getState().onboardingDraft);
  const [answers, setAnswers] = useState<SignUpDraftAnswers>(() =>
    draft ? draftToAnswers(draft) : { ...EMPTY_SIGN_UP }
  );
  const [page, setPage] = useState<SignUpPage>(() => resumePage(draft));

  const index = pageIndex(page);
  const issue = pageIssue(page, answers, weightUnit);
  const canGo = canContinue(page, answers, weightUnit);

  const haptic = useCallback((heavy = false) => {
    if (Platform.OS === 'web') return;
    void Haptics.impactAsync(
      heavy ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light
    );
  }, []);

  /**
   * Every answer is written down as it is given, along with the page it was
   * given on. Writing only at the end is what made closing the app on page nine
   * throw away eight answers.
   */
  useEffect(() => {
    saveOnboardingDraft(answersToDraft(answers, page, useAppStore.getState().onboardingDraft));
  }, [answers, page, saveOnboardingDraft]);

  // A restored draft mounts on a later page, but the pager itself always starts
  // at offset zero, so put it where the page says. One tick late, because the
  // pages have to be laid out before an offset means anything.
  useEffect(() => {
    if (index === 0) return;
    const t = setTimeout(() => {
      scrollRef.current?.scrollTo({ x: SCREEN_WIDTH * index, animated: false });
    }, 0);
    return () => clearTimeout(t);
    // Mount only: every later move goes through goTo, which scrolls itself.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const goTo = useCallback(
    (next: SignUpPage) => {
      scrollRef.current?.scrollTo({
        x: SCREEN_WIDTH * pageIndex(next),
        // Web jumps instantly whatever the setting: an animated scroll there can
        // be interrupted by a reflow, and the pager's scroll snap then puts the
        // page back, leaving the flow stuck. Reduced motion jumps too, because
        // the travelling IS the animation on a screen like this one.
        animated: Platform.OS !== 'web' && !reduceMotion,
      });
      setPage(next);
    },
    [SCREEN_WIDTH, reduceMotion]
  );

  // Web safety net: re-assert the offset after each page change, so a browser
  // re-snap or a late reflow cannot leave the scroll position disagreeing with
  // the page this screen thinks it is on.
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const t = setTimeout(() => {
      scrollRef.current?.scrollTo({ x: SCREEN_WIDTH * index, animated: false });
    }, 350);
    return () => clearTimeout(t);
  }, [index, SCREEN_WIDTH]);

  // The three pages with a keyboard open them with it already up.
  useEffect(() => {
    const ref =
      page === 'name' ? nameInputRef : page === 'age' ? ageInputRef : page === 'bodyweight' ? bwInputRef : null;
    if (!ref) return;
    const t = setTimeout(() => ref.current?.focus(), reduceMotion ? 0 : 350);
    return () => clearTimeout(t);
  }, [page, reduceMotion]);

  const handleNext = useCallback(() => {
    if (!canGo) return;
    if (index >= SIGN_UP_PAGES.length - 1) return;
    haptic(true);
    Keyboard.dismiss();
    goTo(SIGN_UP_PAGES[index + 1]);
  }, [canGo, index, haptic, goTo]);

  const handleBack = useCallback(() => {
    if (index <= 0) return;
    haptic();
    Keyboard.dismiss();
    goTo(SIGN_UP_PAGES[index - 1]);
  }, [index, haptic, goTo]);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (index > 0) {
        handleBack();
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [index, handleBack]);

  /**
   * The finish. One call, which writes every answer and marks sign-up done in
   * the same set(), so it cannot land halfway.
   *
   * It never navigates. Every gate screen updates its own piece of state and
   * lets the root gate in app/_layout.tsx decide what comes next; routing
   * directly from here would skip the auth and subscription gates entirely.
   */
  const handleFinish = useCallback(() => {
    haptic(true);
    completeOnboarding(toSignUpAnswers(answers, weightUnit), new Date().toISOString());
  }, [answers, weightUnit, completeOnboarding, haptic]);

  const enter = reduceMotion ? undefined : FadeInDown.duration(320);
  const firstName = answers.name.trim().split(' ')[0];

  const pageStyle = [styles.page, { width: SCREEN_WIDTH }];

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={0}
    >
      <View style={styles.root}>
        {/* Header: back, and how far down the flow you are. */}
        <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
          {index > 0 ? (
            <Pressable
              onPress={handleBack}
              style={styles.backBtn}
              testID="onboarding-back"
              accessibilityLabel="Back"
              accessibilityRole="button"
            >
              <Ionicons name="chevron-back" size={22} color={C.text} />
            </Pressable>
          ) : (
            <View style={styles.backPlaceholder} />
          )}
          {index > 0 && (
            <View style={styles.progressTrack}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${(index / (SIGN_UP_PAGES.length - 1)) * 100}%` },
                ]}
              />
            </View>
          )}
          <View style={styles.backPlaceholder} />
        </View>

        <ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          scrollEnabled={false}
          showsHorizontalScrollIndicator={false}
          style={{ flex: 1 }}
        >
          {/* 1. Welcome */}
          <View style={pageStyle}>
            <Animated.View entering={enter} style={[styles.pageBody, styles.welcomeBody]}>
              <Image
                source={require('@/assets/images/logo.jpeg')}
                style={styles.welcomeLogo}
                resizeMode="cover"
              />
              <Text style={styles.welcomeTitle}>A physio and a coach, in your pocket</Text>
              <View style={styles.welcomeMeta}>
                <GrowIcon name="clock" size={13} color={C.textSecondary} />
                <Text style={styles.welcomeMetaText}>A few questions, about two minutes</Text>
              </View>
              <View style={styles.pillars}>
                {WELCOME_PILLARS.map((p) => (
                  <View key={p.title} style={styles.pillar}>
                    <GrowIconTile name={p.icon} size={38} color={C.primaryText} face={C.primaryMuted} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.pillarTitle}>{p.title}</Text>
                      <Text style={styles.pillarBody}>{p.body}</Text>
                    </View>
                  </View>
                ))}
              </View>
            </Animated.View>
          </View>

          {/* 2. Name */}
          <View style={pageStyle}>
            <View style={styles.pageBody}>
              <PageIcon name="profile" C={C} />
              <Text style={styles.question}>What should we call you?</Text>
              <Text style={styles.hint}>A first name is plenty.</Text>
              <View style={styles.inputWrap}>
                <TextInput
                  ref={nameInputRef}
                  style={styles.textInput}
                  value={answers.name}
                  onChangeText={(name) => setAnswers((a) => ({ ...a, name }))}
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

          {/* 3. Age */}
          <View style={pageStyle}>
            <View style={styles.pageBody}>
              <PageIcon name="chart" C={C} />
              <Text style={styles.question}>How old are you?</Text>
              <Text style={styles.hint}>
                It shapes your opening weights and how much warming up a session starts with.
              </Text>
              <View style={[styles.inputWrap, styles.numericWrap]}>
                <TextInput
                  ref={ageInputRef}
                  style={[styles.textInput, styles.numericInput]}
                  value={answers.age}
                  onChangeText={(age) => setAnswers((a) => ({ ...a, age }))}
                  placeholder="Years"
                  placeholderTextColor={C.textTertiary}
                  keyboardType="number-pad"
                  returnKeyType="next"
                  onSubmitEditing={handleNext}
                  selectTextOnFocus
                  testID="age-input"
                />
              </View>
              {page === 'age' && issue !== null && (
                <Text style={styles.issueText} testID="age-error">
                  {issue}
                </Text>
              )}
            </View>
          </View>

          {/* 4. Biological sex */}
          <View style={pageStyle}>
            <View style={styles.pageBody}>
              <PageIcon name="person" C={C} />
              <Text style={styles.question}>Your biological sex</Text>
              <Text style={styles.hint}>
                It helps set your starting weights, and nothing else. Prefer not to say is a fine
                answer.
              </Text>
              <View style={styles.optionList}>
                {SEX_OPTIONS.map((opt) => {
                  const selected = answers.sex === opt.value;
                  return (
                    <Pressable
                      key={opt.value}
                      onPress={() => {
                        haptic();
                        setAnswers((a) => ({ ...a, sex: opt.value }));
                      }}
                      style={({ pressed }) => [
                        styles.optionCard,
                        selected && styles.optionCardSelected,
                        pressed && styles.optionCardPressed,
                      ]}
                      testID={`sex-${opt.value}`}
                    >
                      <GrowIconTile
                        name={opt.icon}
                        size={48}
                        color={selected ? C.textInverse : C.primaryText}
                        face={selected ? C.primaryText : C.primaryMuted}
                      />
                      <Text
                        style={[styles.optionLabel, { flex: 1 }, selected && styles.optionLabelSelected]}
                      >
                        {opt.label}
                      </Text>
                      <Radio selected={selected} C={C} />
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </View>

          {/* 5. Bodyweight, with the unit it is read in on the same page.
              REQUIRED, and there is no way past it. It scales the opening load
              of every accessory and every estimate the app makes before it has
              watched anybody lift, so a blank one is not a missing field, it is
              an assumption about somebody's body made on their behalf. */}
          <View style={pageStyle}>
            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={styles.pageScroll}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <PageIcon name="scale" C={C} />
              <Text style={styles.question}>What do you weigh?</Text>
              <Text style={styles.hint}>
                Your bodyweight and your experience are what we work your weights out from. Getting
                them right is what makes the first sessions the right size for you rather than too
                heavy, which is where people get hurt. You can change it any time in Profile.
              </Text>
              <View style={styles.unitRow}>
                {UNIT_OPTIONS.map((opt) => {
                  const selected = weightUnit === opt.value;
                  return (
                    <Pressable
                      key={opt.value}
                      onPress={() => {
                        haptic();
                        setWeightUnit(opt.value);
                      }}
                      style={[styles.unitBtn, selected && styles.unitBtnSelected]}
                      testID={`unit-${opt.value}`}
                    >
                      <Text style={[styles.unitBtnText, selected && styles.unitBtnTextSelected]}>
                        {opt.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              <View style={[styles.inputWrap, styles.numericWrap]}>
                <TextInput
                  ref={bwInputRef}
                  style={[styles.textInput, styles.numericInput]}
                  value={answers.bodyweight}
                  onChangeText={(bodyweight) => setAnswers((a) => ({ ...a, bodyweight }))}
                  // NOT A NUMBER. A weight sitting in the box before anybody has
                  // typed is the same problem as guessing on their behalf, which
                  // is the whole reason this question is asked. The unit is
                  // already on the tag beside the field.
                  placeholder="Your weight"
                  placeholderTextColor={C.textTertiary}
                  keyboardType="decimal-pad"
                  returnKeyType="next"
                  onSubmitEditing={handleNext}
                  selectTextOnFocus
                  testID="bodyweight-input"
                />
                <Text style={styles.unitLabel}>{weightUnit}</Text>
              </View>
              {page === 'bodyweight' && issue !== null && (
                <Text style={styles.issueText} testID="bodyweight-error">
                  {issue}
                </Text>
              )}
            </ScrollView>
          </View>

          {/* 6. Experience. Four levels, in Archie's words, from the one list
              the Profile edit sheet and the programme hub also read. */}
          <View style={pageStyle}>
            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={styles.pageScroll}
              showsVerticalScrollIndicator={false}
            >
              <PageIcon name="dumbbell" C={C} />
              <Text style={styles.question}>How much training have you done?</Text>
              <Text style={styles.hint}>
                This sets which movements you are offered and how heavy they start. Move it later if
                it turns out to be the wrong one.
              </Text>
              <View style={styles.optionList}>
                {EXPERIENCE_OPTIONS.map((opt) => {
                  const selected = answers.experience === opt.value;
                  return (
                    <Pressable
                      key={opt.value}
                      onPress={() => {
                        haptic();
                        setAnswers((a) => pickExperience(a, opt.value));
                      }}
                      style={({ pressed }) => [
                        styles.optionCard,
                        selected && styles.optionCardSelected,
                        pressed && styles.optionCardPressed,
                      ]}
                      testID={`experience-${opt.value}`}
                    >
                      <GrowIconTile
                        name={EXPERIENCE_ICONS[opt.value]}
                        size={48}
                        color={selected ? C.textInverse : C.primaryText}
                        face={selected ? C.primaryText : C.primaryMuted}
                      />
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.optionLabel, selected && styles.optionLabelSelected]}>
                          {opt.label}
                        </Text>
                        <Text style={[styles.optionDesc, selected && styles.optionDescSelected]}>
                          {opt.description}
                        </Text>
                      </View>
                      <Radio selected={selected} C={C} />
                    </Pressable>
                  );
                })}
              </View>
            </ScrollView>
          </View>

          {/* 7. Goals. Multi-select, and nothing is chosen for anybody: the old
              flow fell back to general fitness, so the app prescribed for a goal
              nobody had named. */}
          <View style={pageStyle}>
            <View style={styles.pageBody}>
              <PageIcon name="flag" C={C} />
              <Text style={styles.question}>What are you training for?</Text>
              <Text style={styles.hint}>Pick as many as you like. At least one.</Text>
              <View style={styles.chipGrid}>
                {GOAL_OPTIONS.map((opt) => {
                  const selected = answers.goals.includes(opt.value);
                  return (
                    <Pressable
                      key={opt.value}
                      onPress={() => {
                        haptic();
                        setAnswers((a) => ({
                          ...a,
                          goals: a.goals.includes(opt.value)
                            ? a.goals.filter((g) => g !== opt.value)
                            : [...a.goals, opt.value],
                        }));
                      }}
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

          {/* 8. Equipment */}
          <View style={pageStyle}>
            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={styles.pageScroll}
              showsVerticalScrollIndicator={false}
            >
              <PageIcon name="dumbbell" C={C} compact />
              <Text style={[styles.question, styles.questionCompact]}>
                What have you got to train with?
              </Text>
              <Text style={[styles.hint, styles.hintCompact]}>
                Pick everything you can get to. You are asked again before every session, so a day
                without the gym just builds a different one.
              </Text>
              {/*
                EVERY TILE IS OFFERED TO EVERYBODY.

                A beginner used to find three of the five padlocked, captioned
                "Comes with a bit more experience". The session is built from
                the library now and the library has its own level, so somebody
                on their first week at a full gym gets Beginner exercises with
                the kit in front of them - cable rows, kettlebell deadlifts,
                plate presses, box squats - rather than being told the gym they
                pay for is something to grow into. See lib/sign-up.ts.
              */}
              <View style={[styles.optionList, styles.optionListCompact]}>
                {EQUIPMENT_OPTIONS.map((opt) => {
                  const selected = answers.equipment.includes(opt.value);
                  return (
                    <Pressable
                      key={opt.value}
                      onPress={() => {
                        haptic();
                        setAnswers((a) => ({
                          ...a,
                          equipment: toggleTier(a.equipment, opt.value),
                        }));
                      }}
                      style={({ pressed }) => [
                        styles.optionCard,
                        styles.optionCardCompact,
                        selected && styles.optionCardSelected,
                        pressed && styles.optionCardPressed,
                      ]}
                      testID={`equipment-${opt.value}`}
                    >
                      <View style={styles.equipIcon}>
                        <Image
                          source={EQUIPMENT_IMAGES[opt.value]}
                          style={styles.equipImage}
                          resizeMode="contain"
                        />
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
                          {opt.description}
                        </Text>
                      </View>
                      <View style={[styles.checkBox, selected && styles.checkBoxSelected]}>
                        {selected && <Ionicons name="checkmark" size={14} color={C.textInverse} />}
                      </View>
                    </Pressable>
                  );
                })}
              </View>
              <Text style={styles.footnote}>You can change this any time in Profile.</Text>
            </ScrollView>
          </View>

          {/* 9. Anything to work around. ASKED OF EVERYBODY, both halves of it.
              A shoulder somebody has been told to stay off does not hurt while
              they are staying off it, so it answers no to "is anything sore".
              That is why the clinical question is not hung off the sore one. */}
          <View style={pageStyle}>
            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={styles.pageScroll}
              showsVerticalScrollIndicator={false}
            >
              <PageIcon name="rehab" C={C} compact />
              <Text style={[styles.question, styles.questionCompact]}>
                Anything we should work around?
              </Text>
              <Text style={[styles.hint, styles.hintCompact]}>
                Both are asked of everybody. If there is nothing, say so and carry on.
              </Text>

              <RegionQuestion
                testID="sore"
                title="Is anything sore or niggling?"
                blurb="Every session is built around this, and you can change it later in Profile."
                selected={answers.sore}
                onToggle={(region) =>
                  setAnswers((a) => ({ ...a, sore: toggleRegion(a.sore, region) }))
                }
                onNothing={() => setAnswers((a) => ({ ...a, sore: [] }))}
                onTap={haptic}
                styles={styles}
                C={C}
              />
              <RegionQuestion
                testID="avoid"
                title="Has a clinician told you to avoid loading anything?"
                blurb="Kept apart from what is sore, because it is a different statement."
                selected={answers.avoid}
                onToggle={(region) =>
                  setAnswers((a) => ({ ...a, avoid: toggleRegion(a.avoid, region) }))
                }
                onNothing={() => setAnswers((a) => ({ ...a, avoid: [] }))}
                onTap={haptic}
                styles={styles}
                C={C}
              />
            </ScrollView>
          </View>

          {/* 10. Done. The button below is what writes the profile. */}
          <View style={pageStyle}>
            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={[styles.pageScroll, styles.readyBody]}
              showsVerticalScrollIndicator={false}
            >
              <GrowIcon name="check" size={120} color={C.primaryText} />
              <Text style={styles.readyTitle}>Profile ready</Text>
              <Text style={styles.readyName}>
                {firstName ? `You are all set, ${firstName}` : 'You are all set'}
              </Text>
              <View style={styles.readyPills}>
                {answers.experience && (
                  <Pill icon="dumbbell" label={EXPERIENCE_LABELS[answers.experience]} C={C} />
                )}
                {answers.goals[0] && (
                  <Pill
                    icon="flag"
                    label={GOAL_OPTIONS.find((g) => g.value === answers.goals[0])?.label ?? ''}
                    C={C}
                  />
                )}
                <Pill icon="sliders" label={kitLabel(answers.equipment)} C={C} />
              </View>
              <Text style={styles.readyNote}>
                Nothing here is fixed. Every answer can be changed in Profile, and the app keeps
                adjusting from what you actually log.
              </Text>
              <Pressable
                onPress={handleFinish}
                style={({ pressed }) => [
                  styles.cta,
                  styles.ctaReady,
                  { backgroundColor: go.fill },
                  pressed && styles.ctaPressed,
                ]}
                testID="profile-ready-cta"
              >
                <Text style={[styles.ctaText, { color: go.on }]}>Start training</Text>
                <Ionicons name="arrow-forward" size={20} color={go.on} />
              </Pressable>
            </ScrollView>
          </View>
        </ScrollView>

        {/* The footer button, on every page except the last, where the button is
            the finish and lives on the page itself. */}
        {page !== LAST_SIGN_UP_PAGE && (
          <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
            <Pressable
              onPress={handleNext}
              disabled={!canGo}
              accessibilityState={{ disabled: !canGo }}
              style={({ pressed }) => [
                styles.cta,
                { backgroundColor: canGo ? go.fill : C.surfaceTertiary },
                pressed && canGo && styles.ctaPressed,
              ]}
              testID={index === 0 ? 'get-started-btn' : 'continue-btn'}
            >
              <Text style={[styles.ctaText, { color: canGo ? go.on : C.textTertiary }]}>
                {index === 0 ? 'Get started' : 'Continue'}
              </Text>
              <Ionicons
                name={index === 0 ? 'chevron-forward' : 'arrow-forward'}
                size={20}
                color={canGo ? go.on : C.textTertiary}
              />
            </Pressable>
          </View>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

/** The heaviest thing they said they had, for the summary pill. */
function kitLabel(tiers: EquipmentTier[]): string {
  if (tiers.includes('fullgym')) return 'Full gym';
  if (tiers.includes('kettlebells')) return 'Kettlebells';
  if (tiers.includes('dumbbells')) return 'Dumbbells';
  if (tiers.includes('bands')) return 'Bands';
  return 'No equipment';
}

function PageIcon({
  name,
  C,
  compact,
}: {
  name: GrowIconName;
  C: ReturnType<typeof useColors>;
  compact?: boolean;
}) {
  return (
    <View style={{ marginBottom: compact ? 10 : 22 }}>
      <GrowIconTile
        name={name}
        size={compact ? 46 : 88}
        color={C.primaryText}
        face={C.primaryMuted}
        shape="circle"
      />
    </View>
  );
}

function Radio({ selected, C }: { selected: boolean; C: ReturnType<typeof useColors> }) {
  return (
    <View
      style={{
        width: 20,
        height: 20,
        borderRadius: 10,
        borderWidth: 2,
        borderColor: selected ? C.primaryText : C.border,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {selected && (
        <View
          style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: C.primaryText }}
        />
      )}
    </View>
  );
}

function Pill({
  icon,
  label,
  C,
}: {
  icon: GrowIconName;
  label: string;
  C: ReturnType<typeof useColors>;
}) {
  if (!label) return null;
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 12,
        paddingVertical: 7,
        borderRadius: 999,
        backgroundColor: C.primaryMuted,
      }}
    >
      <GrowIcon name={icon} size={14} color={C.primaryText} />
      <Text style={{ fontSize: 13, fontFamily: 'Inter_600SemiBold', color: C.primaryText }}>
        {label}
      </Text>
    </View>
  );
}

/**
 * One of the two questions on the work-around page.
 *
 * "Nothing" is a tick like any other rather than an absence of ticks, and it is
 * exclusive: picking an area clears it, and picking it clears the areas. An
 * empty list with nothing ticked means the question has not been answered yet,
 * which is what keeps the Continue button off until it has been.
 */
function RegionQuestion({
  testID,
  title,
  blurb,
  selected,
  onToggle,
  onNothing,
  onTap,
  styles,
  C,
}: {
  testID: string;
  title: string;
  blurb: string;
  selected: PainRegion[] | undefined;
  onToggle: (region: PainRegion) => void;
  onNothing: () => void;
  onTap: () => void;
  styles: ReturnType<typeof makeStyles>;
  C: ReturnType<typeof useColors>;
}) {
  const nothing = selected !== undefined && selected.length === 0;
  return (
    <View style={styles.regionBlock} testID={`around-${testID}`}>
      <Text style={styles.regionTitle}>{title}</Text>
      <Text style={styles.regionBlurb}>{blurb}</Text>
      <View style={styles.chipGrid}>
        <Pressable
          onPress={() => {
            onTap();
            onNothing();
          }}
          style={[styles.chip, nothing && styles.chipSelected]}
          testID={`${testID}-none`}
        >
          <Text style={[styles.chipText, nothing && styles.chipTextSelected]}>Nothing</Text>
        </Pressable>
        {ALL_REGIONS.map((region) => {
          const on = (selected ?? []).includes(region.id);
          return (
            <Pressable
              key={region.id}
              onPress={() => {
                onTap();
                onToggle(region.id);
              }}
              style={[styles.chip, on && styles.chipSelected]}
              testID={`${testID}-${region.id}`}
            >
              <Text style={[styles.chipText, on && styles.chipTextSelected]}>{region.label}</Text>
            </Pressable>
          );
        })}
      </View>
      {!nothing && (selected?.length ?? 0) === 0 && (
        <Text style={{ fontSize: 12, fontFamily: 'Inter_400Regular', color: C.textTertiary }}>
          Pick the areas, or Nothing.
        </Text>
      )}
    </View>
  );
}

function makeStyles(C: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: C.background },

    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: 20,
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
    progressFill: { height: '100%', backgroundColor: C.primary, borderRadius: 2 },

    page: { flexShrink: 0 },
    pageBody: { flex: 1, alignItems: 'center', paddingHorizontal: 24, paddingTop: 24 },
    pageScroll: { alignItems: 'center', paddingHorizontal: 24, paddingTop: 24, paddingBottom: 24 },

    welcomeLogo: { width: 108, height: 108, borderRadius: 26, marginBottom: 22 },
    welcomeTitle: {
      fontSize: 27,
      lineHeight: 34,
      fontFamily: 'Inter_700Bold',
      color: C.text,
      textAlign: 'center',
    },
    welcomeMeta: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 },
    welcomeMetaText: { fontSize: 13, fontFamily: 'Inter_500Medium', color: C.textSecondary },
    pillars: { gap: 16, marginTop: 30, width: '100%' },
    pillar: { flexDirection: 'row', alignItems: 'flex-start', gap: 13 },
    pillarTitle: { fontSize: 15.5, fontFamily: 'Inter_700Bold', color: C.text },
    pillarBody: {
      fontSize: 13,
      lineHeight: 18,
      fontFamily: 'Inter_400Regular',
      color: C.textSecondary,
      marginTop: 2,
    },

    question: {
      fontSize: 26,
      lineHeight: 33,
      fontFamily: 'Inter_700Bold',
      color: C.text,
      textAlign: 'center',
      marginBottom: 8,
    },
    questionCompact: { fontSize: 22, lineHeight: 28, marginBottom: 4 },
    hint: {
      fontSize: 14,
      lineHeight: 20,
      fontFamily: 'Inter_500Medium',
      color: C.textSecondary,
      textAlign: 'center',
      marginBottom: 24,
    },
    hintCompact: { fontSize: 13, lineHeight: 18, marginBottom: 14 },

    inputWrap: {
      width: '100%',
      backgroundColor: C.surface,
      borderRadius: 14,
      borderWidth: 1.5,
      borderColor: C.borderLight,
      paddingHorizontal: 16,
      height: 58,
      justifyContent: 'center',
    },
    numericWrap: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    textInput: { fontSize: 18, fontFamily: 'Inter_600SemiBold', color: C.text, flex: 1 },
    numericInput: { textAlign: 'center' },
    unitLabel: { fontSize: 15, fontFamily: 'Inter_600SemiBold', color: C.textSecondary },
    issueText: {
      fontSize: 12.5,
      lineHeight: 18,
      fontFamily: 'Inter_400Regular',
      color: C.error,
      textAlign: 'center',
      marginTop: 10,
    },

    unitRow: { flexDirection: 'row', gap: 8, width: '100%', marginBottom: 14 },
    unitBtn: {
      flex: 1,
      height: 44,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: C.surface,
      borderWidth: 1.5,
      borderColor: C.borderLight,
    },
    unitBtnSelected: { borderColor: C.primary, backgroundColor: C.primarySurface },
    unitBtnText: { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: C.textSecondary },
    unitBtnTextSelected: { color: C.primaryText },

    optionList: { width: '100%', gap: 10 },
    optionListCompact: { gap: 6 },
    optionCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: C.surface,
      borderRadius: 14,
      paddingHorizontal: 14,
      paddingVertical: 13,
      borderWidth: 1.5,
      borderColor: C.borderLight,
      gap: 12,
    },
    optionCardCompact: { paddingVertical: 9, paddingHorizontal: 12, gap: 10 },
    optionCardSelected: { borderColor: C.primary, backgroundColor: C.primarySurface },
    optionCardPressed: { opacity: 0.88 },
    optionLabel: { fontSize: 16, fontFamily: 'Inter_600SemiBold', color: C.text },
    optionLabelCompact: { fontSize: 15, lineHeight: 19 },
    optionLabelSelected: { color: C.primaryText },
    optionDesc: {
      fontSize: 12.5,
      lineHeight: 17,
      fontFamily: 'Inter_400Regular',
      color: C.textSecondary,
      marginTop: 1,
    },
    optionDescCompact: { fontSize: 11.5, lineHeight: 15, marginTop: 0 },
    optionDescSelected: { color: C.primaryText },

    equipIcon: {
      width: 62,
      height: 62,
      borderRadius: 16,
      overflow: 'hidden',
      backgroundColor: C.surfaceTertiary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    equipImage: { width: 62, height: 62 },
    checkBox: {
      width: 22,
      height: 22,
      borderRadius: 7,
      borderWidth: 2,
      borderColor: C.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    checkBoxSelected: { backgroundColor: C.primaryText, borderColor: C.primaryText },
    footnote: {
      fontSize: 11.5,
      fontFamily: 'Inter_400Regular',
      color: C.textSecondary,
      textAlign: 'center',
      marginTop: 8,
    },

    chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, width: '100%' },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 7,
      paddingHorizontal: 13,
      paddingVertical: 10,
      borderRadius: 12,
      backgroundColor: C.surface,
      borderWidth: 1.5,
      borderColor: C.borderLight,
    },
    chipSelected: { borderColor: C.primary, backgroundColor: C.primarySurface },
    chipText: { fontSize: 13.5, fontFamily: 'Inter_600SemiBold', color: C.textSecondary },
    chipTextSelected: { color: C.primaryText },

    regionBlock: { width: '100%', gap: 8, marginBottom: 22 },
    regionTitle: { fontSize: 15.5, fontFamily: 'Inter_700Bold', color: C.text },
    regionBlurb: {
      fontSize: 12.5,
      lineHeight: 17,
      fontFamily: 'Inter_400Regular',
      color: C.textSecondary,
    },

    welcomeBody: { justifyContent: 'center' },
    readyBody: { flexGrow: 1, justifyContent: 'center' },
    readyTitle: {
      fontSize: 30,
      fontFamily: 'Inter_700Bold',
      color: C.text,
      textAlign: 'center',
      marginTop: 12,
    },
    readyName: {
      fontSize: 15,
      fontFamily: 'Inter_500Medium',
      color: C.textSecondary,
      textAlign: 'center',
      marginTop: 6,
    },
    readyPills: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      justifyContent: 'center',
      marginTop: 20,
    },
    readyNote: {
      fontSize: 13,
      lineHeight: 19,
      fontFamily: 'Inter_400Regular',
      color: C.textSecondary,
      textAlign: 'center',
      marginTop: 22,
    },

    footer: { paddingHorizontal: 24, paddingTop: 10 },
    cta: {
      height: 54,
      borderRadius: 16,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      width: '100%',
    },
    ctaReady: { marginTop: 26 },
    ctaPressed: { opacity: 0.88 },
    ctaText: { fontSize: 17, fontFamily: 'Inter_700Bold' },
  });
}
