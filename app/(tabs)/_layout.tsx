import { Tabs, router } from 'expo-router';
import {
  Platform,
  StyleSheet,
  View,
  Image,
  Modal,
  Text,
  Pressable,
  useWindowDimensions,
} from 'react-native';
import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { ScrollToTopProvider, useScrollToTopTrigger } from '@/lib/scroll-to-top-context';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useColors } from '@/constants/colors';
import { elevatedShadow } from '@/constants/shadows';
import { useAppStore } from '@/lib/store';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import CoachMark, { SpotlightRect } from '@/components/CoachMark';

// ─── Tab tour coach mark steps ─────────────────────────────────────────────
// Tour order: Home → Profile → Train → Restore → Stats (matches the array below
// and the actual left-to-right tab bar order).
// tabArrowFraction is the horizontal position (0–1) of the corresponding tab
// icon in the visual tab bar (Home=0.1, Profile=0.3, Train=0.5, Restore=0.7, Stats=0.9).

const COACH_STEPS = [
  {
    route: '/',
    tabArrowFraction: 0.1,
    iconName: 'home',
    iconLabel: 'Home',
    title: 'Your daily starting point',
    body: 'Shows your recommended session for today. Tap the card to begin, the app plans your whole week automatically.',
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
    title: '8 ways to train',
    body: 'KPI sessions (Squat / Bench / Deadlift) build your 1RM strength. Additional sessions like Lower Body, Upper Body, Full Body, Conditioning, and Custom cover every other training goal, and all adapt to your equipment.',
  },
  {
    route: '/recover',
    tabArrowFraction: 0.7,
    iconName: 'medkit',
    iconLabel: 'Restore',
    title: 'For your rest days',
    body: 'Flexibility sessions and Prehab circuits keep joints healthy, mobility sharp, and injuries at bay.',
  },
  {
    route: '/workouts',
    tabArrowFraction: 0.9,
    iconName: 'bar-chart',
    iconLabel: 'Stats',
    title: 'Everything you lift, in one place',
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
  const C = useColors();
  const chipSize = size + 14;
  return (
    <View
      style={{
        width: chipSize,
        height: chipSize,
        borderRadius: chipSize / 2,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: C.tabIconBg,
        borderWidth: 1,
        borderColor: C.tabIconBorder,
      }}
    >
      <Image
        source={source}
        style={{ width: size, height: size, opacity: focused ? 1 : 0.45 }}
        resizeMode="contain"
      />
    </View>
  );
}

// ─── Main TabLayout ────────────────────────────────────────────────────────

export default function TabLayout() {
  return (
    <ScrollToTopProvider>
      <TabsInner />
    </ScrollToTopProvider>
  );
}

function TabsInner() {
  const C = useColors();
  const isWeb = Platform.OS === 'web';
  const insets = useSafeAreaInsets();
  const { width: W, height: H } = useWindowDimensions();
  const triggerScrollToTop = useScrollToTopTrigger();

  const {
    tourComplete,
    setTourComplete,
    setTourJustCompleted,
    tourJustCompleted,
    setSessionTutorialShown,
  } = useAppStore();

  // New users see an intro card first ("Let's take a tour!"); the tour proper
  // (tourStep) only starts once that's dismissed. Veterans skip both.
  const [showTourIntro, setShowTourIntro] = useState<boolean>(() => !tourComplete);
  const [tourStep, setTourStep] = useState<number | null>(null);

  const startTour = useCallback(() => {
    setShowTourIntro(false);
    setTourStep(0);
  }, []);

  const skipFromIntro = useCallback(() => {
    setShowTourIntro(false);
    setTourComplete(true);
    setSessionTutorialShown(true);
  }, [setTourComplete, setSessionTutorialShown]);

  // ── Tab tour spotlight: measured, not guessed ────────────────────────────
  // The old approach computed the highlight purely from screen-width fractions
  // (tabIdx * tabW), which assumes every tab occupies an identical, evenly-
  // spaced rectangle. Train doesn't — it's a raised 56×56 button that sticks up
  // above the rest of the tab bar — so that math always undershot it, cutting
  // its top off. Measuring the actual rendered icon fixes that for Train and
  // makes every other tab's highlight pixel-accurate too.
  const tabIconRefs = useRef<Record<string, View | null>>({});
  const [tabSpotlight, setTabSpotlight] = useState<SpotlightRect | null>(null);
  const [tabArrowX, setTabArrowX] = useState<number | null>(null);

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
  // Step 0 is always Home, and the tour only ever starts right after the root
  // gate's own router.replace('/(tabs)') has landed the user on Home — firing
  // a second, uncoordinated navigate('/') into a screen that's still settling
  // from that replace risks a navigation race (observed as the app becoming
  // totally unresponsive right after onboarding, recoverable only by
  // restarting). Skip it: there's nothing to navigate to yet.
  useEffect(() => {
    if (tourStep === null || tourStep === 0 || tourStep >= COACH_STEPS.length) return;
    const step = COACH_STEPS[tourStep];
    const timer = setTimeout(() => router.navigate(step.route as any), 200);
    return () => clearTimeout(timer);
  }, [tourStep]);

  // Measure the current step's actual tab icon once the tab switch above (if
  // any) has settled, rather than trusting geometry to match what's rendered.
  useEffect(() => {
    setTabSpotlight(null);
    setTabArrowX(null);
    if (tourStep === null || tourStep >= COACH_STEPS.length) return;
    const step = COACH_STEPS[tourStep];
    const delay = tourStep === 0 ? 120 : 320;
    const timer = setTimeout(() => {
      tabIconRefs.current[step.route]?.measureInWindow((x, y, w, h) => {
        if (w > 0 && h > 0) {
          setTabSpotlight({ top: y - 12, left: x - 12, width: w + 24, height: h + 24 });
          setTabArrowX(x + w / 2);
        }
      });
    }, delay);
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
          listeners={({ navigation }) => ({
            tabPress: () => {
              if (navigation.isFocused()) triggerScrollToTop('index');
            },
          })}
          options={{
            title: 'Home',
            tabBarIcon: ({ focused }) => (
              <Animated.View
                ref={(el) => {
                  tabIconRefs.current['/'] = el as unknown as View | null;
                }}
                collapsable={false}
                style={tabPulseStyle}
              >
                <TabIcon source={TAB_ICONS.home} focused={focused} />
              </Animated.View>
            ),
          }}
        />
        <Tabs.Screen
          name="profile"
          listeners={({ navigation }) => ({
            tabPress: () => {
              if (navigation.isFocused()) triggerScrollToTop('profile');
            },
          })}
          options={{
            title: 'Profile',
            tabBarIcon: ({ focused }) => (
              <View
                ref={(el) => {
                  tabIconRefs.current['/profile'] = el;
                }}
                collapsable={false}
              >
                <TabIcon source={TAB_ICONS.profile} focused={focused} />
              </View>
            ),
          }}
        />
        <Tabs.Screen
          name="train"
          listeners={({ navigation }) => ({
            tabPress: () => {
              if (navigation.isFocused()) triggerScrollToTop('train');
            },
          })}
          options={{
            title: 'Train',
            tabBarItemStyle: { overflow: 'visible' },
            tabBarIcon: ({ focused }) => (
              <View
                ref={(el) => {
                  tabIconRefs.current['/train'] = el;
                }}
                collapsable={false}
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 28,
                  alignItems: 'center',
                  justifyContent: 'center',
                  transform: [{ translateY: -10 }],
                  backgroundColor: C.primaryLight,
                  opacity: focused ? 1 : 0.75,
                }}
              >
                <Image
                  source={TAB_ICONS.train}
                  style={{ width: 46, height: 46 }}
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
          listeners={({ navigation }) => ({
            tabPress: () => {
              if (navigation.isFocused()) triggerScrollToTop('recover');
            },
          })}
          options={{
            title: 'Restore',
            tabBarIcon: ({ focused }) => (
              <View
                ref={(el) => {
                  tabIconRefs.current['/recover'] = el;
                }}
                collapsable={false}
              >
                <TabIcon source={TAB_ICONS.restore} focused={focused} />
              </View>
            ),
          }}
        />
        <Tabs.Screen
          name="workouts"
          listeners={({ navigation }) => ({
            tabPress: () => {
              if (navigation.isFocused()) triggerScrollToTop('workouts');
            },
          })}
          options={{
            title: 'Stats',
            tabBarIcon: ({ focused }) => (
              <View
                ref={(el) => {
                  tabIconRefs.current['/workouts'] = el;
                }}
                collapsable={false}
              >
                <TabIcon source={TAB_ICONS.stats} focused={focused} />
              </View>
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
          // Fallback only, used for the brief window before the real
          // measurement above lands — the actual icon (tabSpotlight) wins
          // once available, since Train's raised button doesn't fit this
          // uniform-slot geometry.
          const tabIdx = Math.round((step.tabArrowFraction - 0.1) / 0.2);
          const fallbackRect: SpotlightRect = {
            top: H - tabBarHeight,
            left: tabIdx * tabW,
            width: tabW,
            height: tabBarHeight,
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
              downArrowScreenX={tabArrowX ?? undefined}
              iconName={step.iconName}
              iconLabel={step.iconLabel}
              spotlightRect={tabSpotlight ?? fallbackRect}
            />
          );
        })()}

      <Modal visible={showTourIntro} transparent animationType="fade" onRequestClose={startTour}>
        <View style={styles.introOverlay}>
          <View style={[styles.introCard, { backgroundColor: C.surface, borderColor: C.primary }]}>
            <View style={[styles.introIconRing, { backgroundColor: C.primarySurface }]}>
              <Ionicons name="compass-outline" size={30} color={C.primary} />
            </View>
            <Text style={[styles.introTitle, { color: C.text }]}>Let&apos;s take a tour!</Text>
            <Text style={[styles.introBody, { color: C.textSecondary }]}>
              A 60-second walkthrough of the five tabs, then a quick practice session so logging a
              real one feels familiar.
            </Text>
            <Pressable
              onPress={startTour}
              style={({ pressed }) => [
                styles.introBtn,
                { backgroundColor: C.primary },
                pressed && { opacity: 0.88 },
              ]}
              testID="tour-intro-start"
            >
              <Text style={[styles.introBtnText, { color: C.textInverse }]}>Let&apos;s go →</Text>
            </Pressable>
            <Pressable onPress={skipFromIntro} hitSlop={10} testID="tour-intro-skip">
              <Text style={[styles.introSkipText, { color: C.textTertiary }]}>Skip for now</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  introOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  introCard: {
    width: '100%',
    maxWidth: 340,
    borderRadius: 24,
    borderWidth: 1.5,
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 22,
    alignItems: 'center',
    gap: 4,
    ...elevatedShadow('#000'),
  },
  introIconRing: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  introTitle: {
    fontSize: 20,
    fontFamily: 'Inter_700Bold',
    textAlign: 'center',
    marginBottom: 6,
  },
  introBody: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 18,
  },
  introBtn: {
    alignSelf: 'stretch',
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    marginBottom: 14,
  },
  introBtnText: {
    fontSize: 15,
    fontFamily: 'Inter_700Bold',
  },
  introSkipText: {
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
  },
});
