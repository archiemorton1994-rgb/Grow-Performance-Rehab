import { Tabs, router } from 'expo-router';
import { Platform, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import React, { useRef, useEffect, useState, useCallback } from 'react';
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
    body: 'Shows your next suggested session based on your training rotation. Tap the session card to begin.',
  },
  {
    route: '/train',
    tabArrowFraction: 0.5,
    iconName: 'barbell',
    iconLabel: 'Train',
    title: 'Your strength program',
    body: 'Structured Lower/Upper/Full Body rotation — every session adapts to your equipment and energy level.',
  },
  {
    route: '/recover',
    tabArrowFraction: 0.7,
    iconName: 'medkit',
    iconLabel: 'Restore',
    title: 'Restore between sessions',
    body: 'Recovery circuits, mobility flows, and targeted prehab — designed to keep you moving on rest days.',
  },
  {
    route: '/workouts',
    tabArrowFraction: 0.9,
    iconName: 'bar-chart',
    iconLabel: 'Stats',
    title: 'Track your progress',
    body: 'Every session, set and weight is logged here. Charts and KPIs fill in as you train.',
  },
  {
    route: '/profile',
    tabArrowFraction: 0.3,
    iconName: 'person',
    iconLabel: 'Profile',
    title: 'Your stats and settings',
    body: 'Strength records, milestone badges, and all your app settings in one place.',
  },
] as const;

// ─── Train tab icon (elevated circle) ─────────────────────────────────────

function TrainTabIcon({ focused }: { focused: boolean }) {
  const C = useColors();
  const btnColor = C.primaryLight;
  return (
    <View
      style={{
        width: 48,
        height: 48,
        borderRadius: 24,
        alignItems: 'center',
        justifyContent: 'center',
        transform: [{ translateY: -6 }],
        backgroundColor: btnColor,
        opacity: focused ? 1 : 0.7,
        ...(focused
          ? {
              shadowColor: btnColor,
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.45,
              shadowRadius: 8,
              elevation: 8,
            }
          : {}),
      }}
    >
      <Ionicons name="barbell" size={22} color={C.textInverse} />
    </View>
  );
}

// ─── Main TabLayout ────────────────────────────────────────────────────────

export default function TabLayout() {
  const C = useColors();
  const isWeb = Platform.OS === 'web';
  const insets = useSafeAreaInsets();

  const { tourComplete, setTourComplete } = useAppStore();

  // Initialize from persisted state: new users start at step 0, veterans skip.
  const [tourStep, setTourStep] = useState<number | null>(() => (!tourComplete ? 0 : null));

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
        setTourComplete(true);
        return null;
      }
      return next;
    });
  }, [setTourComplete]);

  const handleSkip = useCallback(() => {
    setTourComplete(true);
    setTourStep(null);
  }, [setTourComplete]);

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
            tabBarIcon: ({ color, size, focused }) => (
              <Ionicons name={focused ? 'home' : 'home-outline'} size={size || 24} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: 'Profile',
            tabBarIcon: ({ color, size, focused }) => (
              <Ionicons
                name={focused ? 'person' : 'person-outline'}
                size={size || 24}
                color={color}
              />
            ),
          }}
        />
        <Tabs.Screen
          name="train"
          options={{
            title: 'Train',
            tabBarItemStyle: { overflow: 'visible' },
            tabBarIcon: ({ focused }) => <TrainTabIcon focused={focused} />,
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
            tabBarIcon: ({ color, size, focused }) => (
              <Ionicons
                name={focused ? 'medkit' : 'medkit-outline'}
                size={size || 24}
                color={color}
              />
            ),
          }}
        />
        <Tabs.Screen
          name="workouts"
          options={{
            title: 'Stats',
            tabBarIcon: ({ color, size, focused }) => (
              <Ionicons
                name={focused ? 'bar-chart' : 'bar-chart-outline'}
                size={size || 24}
                color={color}
              />
            ),
          }}
        />
      </Tabs>

      {tourStep !== null && (
        <CoachMark
          visible
          title={COACH_STEPS[tourStep].title}
          body={COACH_STEPS[tourStep].body}
          step={tourStep + 1}
          total={COACH_STEPS.length}
          onNext={handleNext}
          onSkip={handleSkip}
          bottomOffset={coachMarkBottom}
          tabArrowFraction={COACH_STEPS[tourStep].tabArrowFraction}
          iconName={COACH_STEPS[tourStep].iconName}
          iconLabel={COACH_STEPS[tourStep].iconLabel}
        />
      )}
    </View>
  );
}
