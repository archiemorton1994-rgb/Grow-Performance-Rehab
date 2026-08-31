/**
 * THE PROFILE BUILDER.
 *
 * WHAT THIS REPLACED
 * ──────────────────
 * A swipe pager: twelve screens of hand-written JSX, each with its own useState,
 * advanced by `currentIndex + 1`. It asked ten questions in a fixed order and it
 * could not do anything else. It could not branch, so every single person was
 * asked to type a squat one rep max, including somebody whose knee was the
 * reason they downloaded the app. It could not be drawn, because nothing in the
 * codebase was an object representing "the questions". And the seven separate
 * setters on its last screen could half-succeed: a crash between two of them
 * left somebody with a profile and no equipment, which generates a bodyweight
 * session for a person standing in a gym.
 *
 * The questions are now data (lib/profile-tree.ts), the journey is a tree the
 * user travels down (components/ProfileTree.tsx), and the whole thing is written
 * in one action that cannot land halfway (applyProfileTree in lib/store.ts).
 *
 * THIS FILE IS NOW THREE THINGS AND NOTHING ELSE
 * ──────────────────────────────────────────────
 *   1. the welcome screen
 *   2. the tree, plus the two answers that have to take effect the instant they
 *      are given rather than at the end
 *   3. the draft, so a reload does not throw the answers away
 *
 * WHY THEME AND UNIT ARE APPLIED IMMEDIATELY
 * ──────────────────────────────────────────
 * They are the first two questions, and both change how every screen after them
 * looks. Picking Light and watching the app stay dark until the end of the
 * builder reads as a control that does not work. The unit matters more than it
 * looks: the bodyweight question is validated against a plausible range, and
 * "176" is a sensible number of pounds and an impossible number of kilos.
 */
import React, { useCallback, useMemo, useState } from 'react';
import { BackHandler, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useColors, useGoColors } from '@/constants/colors';
import { GrowIcon } from '@/components/GrowIcon';
import type { GrowIconName } from '@/lib/icon-art';
import { ProfileTree } from '@/components/ProfileTree';
import { PAIN_CATEGORIES, useAppStore, type WeightUnit } from '@/lib/store';
import type { Answers, TreeOption } from '@/lib/profile-tree';

/**
 * Three pillars rather than seven bullets under three headings. The list carried
 * the same information but as ten stacked text elements at nearly one weight,
 * which reads as a wall on a phone.
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

/** Every area the app can adapt around, from the one list that owns them. */
const REGION_OPTIONS: TreeOption[] = Object.values(PAIN_CATEGORIES).flatMap((group) =>
  group.regions.map((r) => ({ value: r.id as string, label: r.label }))
);

export default function OnboardingScreen() {
  const C = useColors();
  const go = useGoColors();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(C), [C]);

  const {
    onboardingDraft,
    saveOnboardingDraft,
    applyProfileTree,
    setOnboardingComplete,
    setThemePreference,
    setWeightUnit,
    weightUnit,
  } = useAppStore();

  // Read once, at mount. The draft is where this flow starts, not a live source:
  // after this every answer flows one way, from the tree out to the store.
  const [draft] = useState(() => useAppStore.getState().onboardingDraft);
  const [started, setStarted] = useState(() => !!draft?.treeAnswers);

  const haptic = useCallback((heavy = false) => {
    if (Platform.OS === 'web') return;
    void Haptics.impactAsync(
      heavy ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light
    );
  }, []);

  /**
   * Applied on every change, not at the end.
   *
   * Only two answers do anything here. Everything else waits for
   * applyProfileTree, because an answer written to the store early is an answer
   * that can be contradicted by a later one and never corrected.
   */
  const onAnswersChange = useCallback(
    (answers: Answers) => {
      const look = answers.look;
      if (look === 'dark' || look === 'light' || look === 'system') {
        setThemePreference(look);
      }
      if (answers.units === 'kg' || answers.units === 'lbs') {
        setWeightUnit(answers.units as WeightUnit);
      }
      saveOnboardingDraft({ ...(onboardingDraft ?? {}), treeAnswers: answers });
    },
    [setThemePreference, setWeightUnit, saveOnboardingDraft, onboardingDraft]
  );

  const onComplete = useCallback(
    (answers: Answers) => {
      haptic(true);
      applyProfileTree(answers, new Date().toISOString());
      // Never navigate from here. Every gate screen updates its own piece of
      // state and lets the root gate in app/_layout.tsx decide what comes next;
      // routing directly would skip the auth and subscription gates entirely.
      setOnboardingComplete(true);
    },
    [applyProfileTree, setOnboardingComplete, haptic]
  );

  // Android back, on the welcome screen only. Inside the tree, going back is
  // tapping a question you have already answered, which the tree owns.
  React.useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (started) {
        setStarted(false);
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [started]);

  if (!started) {
    return (
      <View style={[styles.root, { paddingTop: insets.top + 28 }]}>
        <View style={styles.welcome}>
          <Animated.View entering={FadeIn.duration(420)} style={styles.mark}>
            <GrowIcon name="leaf" size={54} color={C.primaryText} />
          </Animated.View>

          <Animated.Text entering={FadeInDown.delay(90).duration(380)} style={styles.title}>
            Let us build your programme
          </Animated.Text>
          <Animated.Text entering={FadeInDown.delay(150).duration(380)} style={styles.sub}>
            A short set of questions. Every answer changes what you are given, and you can
            change any of them later.
          </Animated.Text>

          <View style={styles.pillars}>
            {WELCOME_PILLARS.map((p, i) => (
              <Animated.View
                key={p.title}
                entering={FadeInDown.delay(220 + i * 70).duration(380)}
                style={styles.pillar}
              >
                <View style={styles.pillarIcon}>
                  <GrowIcon name={p.icon} size={19} color={C.primaryText} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.pillarTitle}>{p.title}</Text>
                  <Text style={styles.pillarBody}>{p.body}</Text>
                </View>
              </Animated.View>
            ))}
          </View>
        </View>

        <View style={[styles.footer, { paddingBottom: insets.bottom + 20 }]}>
          <Pressable
            onPress={() => {
              haptic(true);
              setStarted(true);
            }}
            testID="onboarding-start"
            style={({ pressed }) => [
              styles.cta,
              { backgroundColor: go.fill },
              pressed && { opacity: 0.88 },
            ]}
          >
            <Text style={[styles.ctaText, { color: go.on }]}>Start</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 12 }]}>
      <ProfileTree
        initialAnswers={draft?.treeAnswers ?? undefined}
        onAnswersChange={onAnswersChange}
        onComplete={onComplete}
        regionOptions={REGION_OPTIONS}
        weightUnit={weightUnit}
      />
    </View>
  );
}

function makeStyles(C: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: C.background },

    welcome: { flex: 1, justifyContent: 'center', paddingHorizontal: 28 },
    mark: {
      width: 92,
      height: 92,
      borderRadius: 46,
      backgroundColor: C.primaryMuted,
      alignItems: 'center',
      justifyContent: 'center',
      alignSelf: 'center',
      marginBottom: 26,
    },
    title: {
      fontSize: 28,
      lineHeight: 34,
      fontFamily: 'Inter_700Bold',
      color: C.text,
      textAlign: 'center',
    },
    sub: {
      fontSize: 15,
      lineHeight: 22,
      fontFamily: 'Inter_400Regular',
      color: C.textSecondary,
      textAlign: 'center',
      marginTop: 10,
    },

    pillars: { gap: 16, marginTop: 34 },
    pillar: { flexDirection: 'row', alignItems: 'flex-start', gap: 13 },
    pillarIcon: {
      width: 38,
      height: 38,
      borderRadius: 12,
      backgroundColor: C.primaryMuted,
      alignItems: 'center',
      justifyContent: 'center',
    },
    pillarTitle: { fontSize: 15.5, fontFamily: 'Inter_700Bold', color: C.text },
    pillarBody: {
      fontSize: 13,
      lineHeight: 18,
      fontFamily: 'Inter_400Regular',
      color: C.textSecondary,
      marginTop: 2,
    },

    footer: { paddingHorizontal: 24, paddingTop: 12 },
    cta: {
      height: 54,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
    },
    ctaText: { fontSize: 17, fontFamily: 'Inter_700Bold' },
  });
}
