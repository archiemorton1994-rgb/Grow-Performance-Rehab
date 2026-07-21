import { Tabs, router } from 'expo-router';
import { Platform, StyleSheet, View, Image, useWindowDimensions } from 'react-native';
import React, { useRef, useEffect, useState, useCallback } from 'react';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useColors } from '@/constants/colors';
import { useAppStore } from '@/lib/store';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import CoachMark from '@/components/CoachMark';

// ─── Tab tour coach mark steps ─────────────────────────────────────────────
// Tour order: Home → Train → Restore → Stats → Profile
// tabArrowFraction is the horizontal position (0–1) of the corresponding tab
// icon in the visual tab bar (Home=0.1, Profile=0.3, Train=0.5, Restore=0.7, Stats=0.9).

const COACH_STEPS = [
  {
    route: '/',
    tabArrowFraction: 0.1,
    iconName: 'home',
    iconLabel: 'Home',
    title: 'Your daily starting point',
    body: 'Shows your recommended session for today. Tap the card to begin — the app plans your whole week automatically.',
  },
  {
    route: '/profile',
    tabArrowFraction: 0.3,
    iconName: 'person',
    iconLabel: 'Profile',
    title: 'Your records and settings',
    body: 'Strength records, milestone achievement badges, equipment settings and your full training history.',
  },
  {
    route: '/train',
    tabArrowFraction: 0.5,
    iconName: 'barbell',
    iconLabel: 'Train',
    title: '7 ways to train',
    body: 'Strength sessions (Lower / Upper / Full Body), Conditioning, Flexibility, and Custom — every session adapts to your equipment and energy.',
  },
  {
    route: '/recover',
    tabArrowFraction: 0.7,
    iconName: 'medkit',
    iconLabel: 'Restore',
    title: 'Recover smarter',
    body: 'Recovery circuits, mobility flows and targeted prehab. Use these on rest days to stay loose and injury-free.',
  },
  {
    route: '/workouts',
    tabArrowFraction: 0.9,
    iconName: 'bar-chart',
    iconLabel: 'Stats',
    title: 'Watch yourself improve',
    body: 'Every set and weight is logged here. Strength KPIs, volume trends, and milestones fill in as you train.',
  },
] as const;

// ─── 3D PNG Tab Icons ────────────────────────────────────────────────────────

const TAB_ICONS = {
  home: require('@/assets/images/tabs/home.png'),
  profile: require('@/assets/images/tabs/profile.png'),
  train: require('@/assets/images/tabs/train.png'),
  restore: require('@/assets/images/tabs/restore.png'),
  stats: require('@/assets/images/tabs/stats.png'),
} as const;

function TabIcon({ source, focused, size = 28 }: { source: any; focused: boolean; size?: number }) {
  return (
    <Image
      source={source}
      style={{ width: size, height: size, opacity: focused ? 1 : 0.45 }}
      resizeMode="contain"
    />
  );
}

// ─── Main TabLayout ────────────────────────────────────────────────────────

export default function TabLayout() {
  const C = useColors();
  const isWeb = Platform.OS === 'web';
  const insets = useSafeAreaInsets();
  const { width: W, height: H } = useWindowDimensions();

  const {
    tourComplete,
    setTourComplete,
    setTourJustCompleted,
    tourJustCompleted,
    setSessionTutorialShown,
  } = useAppStore();

  // Initialize from persisted state: new users start at step 0, veterans skip.
  const [tourStep, setTourStep] = useState<number | null>(() => (!tourComplete ? 0 : null));

  // Pulse the Home tab icon after the demo session completes and tourJustCompleted fires.
  const tabPulse = useSharedValue(1);
  useEffect(() => {
    if (tourJustCompleted) {
      tabPulse.value = withRepeat(
        withSequence(withTiming(1.28, { duration: 370 }), withTiming(1, { duration: 370 })),
        -1,
        false
      );
    } else {
      tabPulse.value = withTiming(1, { duration: 180 });
    }
  }, [tourJustCompleted]); // eslint-disable-line react-hooks/exhaustive-deps
  const tabPulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: tabPulse.value }],
  }));

  // Replay: when tourComplete flips from true → false (e.g. "Replay tour" in Settings),
  // restart from step 0.
  const prevTourComplete = useRef(tourComplete);
  useEffect(() => {
    if (prevTourComplete.current === true && tourComplete === false) {
      setTourStep(0);
    }
    prevTourComplete.current = tourComplete;
  }, [tourComplete]);

  // Programmatically switch to the tab for the current tour step.
  useEffect(() => {
    if (tourStep === null || tourStep >= COACH_STEPS.length) return;
    const step = COACH_STEPS[tourStep];
    const delay = tourStep === 0 ? 0 : 200;
    const timer = setTimeout(() => router.navigate(step.route as any), delay);
    return () => clearTimeout(timer);
  }, [tourStep]);

  const handleNext = useCallback(() => {
    setTourStep((prev) => {
      if (prev === null) return null;
      const next = prev + 1;
      if (next >= COACH_STEPS.length) {
        // Transition to the demo session where the in-session tutorial plays.
        // tourComplete + tourJustCompleted are set when the demo session finishes.
        setTimeout(() => router.navigate('/session?demo=true' as any), 150);
        return null;
      }
      return next;
    });
  }, []);

  const handleSkip = useCallback(() => {
    setTourComplete(true);
    setSessionTutorialShown(true);
    setTourStep(null);
  }, [setTourComplete, setSessionTutorialShown]);

  // Position the card above the tab bar, with 16 px to spare for the arrow.
  const tabBarHeight = isWeb ? 84 : insets.bottom + 50;
  const coachMarkBottom = tabBarHeight + 16;

  return (
    <View style={{ flex: 1 }}>
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: C.tabActive,
          tabBarInactiveTintColor: C.tabInactive,
          headerShown: false,
          tabBarStyle: {
            position: 'absolute',
            backgroundColor: C.background,
            borderTopWidth: 1,
            borderTopColor: C.border,
            elevation: 0,
            ...(isWeb ? { height: 84 } : {}),
          },
          tabBarBackground: () =>
            isWeb ? (
              <View style={[StyleSheet.absoluteFill, { backgroundColor: C.background }]} />
            ) : null,
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'Home',
            tabBarIcon: ({ focused }) => (
              <Animated.View style={tabPulseStyle}>
                <TabIcon source={TAB_ICONS.home} focused={focused} />
              </Animated.View>
            ),
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: 'Profile',
            tabBarIcon: ({ focused }) => <TabIcon source={TAB_ICONS.profile} focused={focused} />,
          }}
        />
        <Tabs.Screen
          name="train"
          options={{
            title: 'Train',
            tabBarItemStyle: { overflow: 'visible' },
            tabBarIcon: ({ focused }) => (
              <View
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 24,
                  alignItems: 'center',
                  justifyContent: 'center',
                  transform: [{ translateY: -8 }],
                  backgroundColor: C.primaryLight,
                  opacity: focused ? 1 : 0.75,
                }}
              >
                <Image
                  source={TAB_ICONS.train}
                  style={{ width: 28, height: 28 }}
                  resizeMode="contain"
                />
              </View>
            ),
            tabBarLabelStyle: {
              fontSize: 10,
              fontWeight: '600',
              marginTop: 2,
            },
          }}
        />
        <Tabs.Screen
          name="recover"
          options={{
            title: 'Restore',
            tabBarIcon: ({ focused }) => <TabIcon source={TAB_ICONS.restore} focused={focused} />,
          }}
        />
        <Tabs.Screen
          name="workouts"
          options={{
            title: 'Stats',
            tabBarIcon: ({ focused }) => <TabIcon source={TAB_ICONS.stats} focused={focused} />,
          }}
        />
      </Tabs>

      {tourStep !== null &&
        (() => {
          const step = COACH_STEPS[tourStep];
          const tabW = W / 5;
          // tabArrowFraction: 0.1=Home, 0.3=Profile, 0.5=Train, 0.7=Restore, 0.9=Stats
          // Maps to tab indices 0–4 via (fraction - 0.1) / 0.2
          const tabIdx = Math.round((step.tabArrowFraction - 0.1) / 0.2);
          const spotlightRect = {
            top: H - tabBarHeight,
            left: tabIdx * tabW,
            width: tabW,
            height: tabBarHeight,
            borderRadius: 0,
          };
          return (
            <CoachMark
              visible
              title={step.title}
              body={step.body}
              step={tourStep + 1}
              total={COACH_STEPS.length}
              onNext={handleNext}
              onSkip={handleSkip}
              onSwipeLeft={handleNext}
              bottomOffset={coachMarkBottom}
              tabArrowFraction={step.tabArrowFraction}
              iconName={step.iconName}
              iconLabel={step.iconLabel}
              spotlightRect={spotlightRect}
            />
          );
        })()}
    </View>
  );
}
