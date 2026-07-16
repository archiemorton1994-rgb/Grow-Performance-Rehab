import { Tabs, router } from 'expo-router';
import { Platform, StyleSheet, View, Text, Pressable, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import React, { useRef, useEffect, useState, useCallback } from 'react';
import Animated, {
  FadeIn,
  FadeInDown,
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

// ─── Train tab icon (green circle with barbell) ───────────────────────────

function TrainTabIcon({ focused }: { focused: boolean }) {
  const C = useColors();
  return (
    <View
      style={{
        width: 48,
        height: 48,
        borderRadius: 24,
        alignItems: 'center',
        justifyContent: 'center',
        transform: [{ translateY: -8 }],
        backgroundColor: C.primaryLight,
        opacity: focused ? 1 : 0.7,
      }}
    >
      <Ionicons name="barbell" size={24} color="#fff" />
    </View>
  );
}

// ─── Main TabLayout ────────────────────────────────────────────────────────

export default function TabLayout() {
  const C = useColors();
  const isWeb = Platform.OS === 'web';
  const insets = useSafeAreaInsets();
  const { width: W, height: H } = useWindowDimensions();

  const { tourComplete, setTourComplete, setTourJustCompleted } = useAppStore();

  // Initialize from persisted state: new users start at step 0, veterans skip.
  const [tourStep, setTourStep] = useState<number | null>(() => (!tourComplete ? 0 : null));
  const [showCompletion, setShowCompletion] = useState(false);

  // Pulse the Home tab icon while the completion overlay is visible.
  const tabPulse = useSharedValue(1);
  useEffect(() => {
    if (showCompletion) {
      tabPulse.value = withRepeat(
        withSequence(withTiming(1.28, { duration: 370 }), withTiming(1, { duration: 370 })),
        -1,
        false
      );
    } else {
      tabPulse.value = withTiming(1, { duration: 180 });
    }
  }, [showCompletion]); // eslint-disable-line react-hooks/exhaustive-deps
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
        // Show the completion overlay instead of immediately finishing.
        setShowCompletion(true);
        return null;
      }
      return next;
    });
  }, []);

  const handleSkip = useCallback(() => {
    setTourComplete(true);
    setTourStep(null);
  }, [setTourComplete]);

  /** User tapped the "Go to Home" CTA — complete tour + pulse home card. */
  const handleCompletionStart = useCallback(() => {
    setTourComplete(true);
    setTourJustCompleted(true);
    setShowCompletion(false);
    router.navigate('/');
  }, [setTourComplete, setTourJustCompleted]);

  /** User tapped the backdrop — complete tour silently. */
  const handleCompletionDismiss = useCallback(() => {
    setTourComplete(true);
    setShowCompletion(false);
    router.navigate('/');
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
              <Animated.View style={tabPulseStyle}>
                <Ionicons
                  name={focused ? 'home' : 'home-outline'}
                  size={size || 24}
                  color={color}
                />
              </Animated.View>
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

      {/* ── Tutorial complete overlay ──────────────────────────────────────── */}
      {showCompletion && (
        <Animated.View
          entering={FadeIn.duration(200)}
          style={[StyleSheet.absoluteFill, styles.completionBackdrop]}
          pointerEvents="box-none"
        >
          <Pressable style={StyleSheet.absoluteFill} onPress={handleCompletionDismiss} />
          <Animated.View
            entering={FadeInDown.duration(340)}
            style={[
              styles.completionCard,
              {
                backgroundColor: C.surface,
                borderColor: C.border,
                shadowColor: '#000',
              },
            ]}
          >
            <View style={[styles.completionIconWrap, { backgroundColor: C.primarySurface }]}>
              <Ionicons name="checkmark-circle" size={52} color={C.primary} />
            </View>
            <Text style={[styles.completionTitle, { color: C.text }]}>You&apos;re all set!</Text>
            <Text style={[styles.completionBody, { color: C.textSecondary }]}>
              Your programme is ready. Sessions rotate automatically — just show up and the app
              handles the planning.
            </Text>
            <Pressable
              onPress={handleCompletionStart}
              style={({ pressed }) => [
                styles.completionBtn,
                { backgroundColor: C.primary },
                pressed && { opacity: 0.85 },
              ]}
            >
              <Text style={[styles.completionBtnText, { color: C.textInverse }]}>
                Start my first session →
              </Text>
            </Pressable>
            <Text style={[styles.completionHint, { color: C.textTertiary }]}>
              or tap anywhere to dismiss
            </Text>
          </Animated.View>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  completionBackdrop: {
    zIndex: 300,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  completionCard: {
    width: '100%',
    borderRadius: 24,
    borderWidth: 1,
    paddingHorizontal: 24,
    paddingVertical: 28,
    alignItems: 'center',
    gap: 12,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 12,
  },
  completionIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  completionTitle: {
    fontSize: 24,
    fontFamily: 'Inter_700Bold',
    textAlign: 'center',
  },
  completionBody: {
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
    lineHeight: 22,
    textAlign: 'center',
  },
  completionBtn: {
    marginTop: 8,
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 16,
    alignSelf: 'stretch',
    alignItems: 'center',
  },
  completionBtnText: {
    fontSize: 16,
    fontFamily: 'Inter_700Bold',
  },
  completionHint: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    marginTop: 4,
  },
});
