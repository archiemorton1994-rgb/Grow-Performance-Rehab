import { Tabs, router, useSegments } from 'expo-router';
import { Platform, StyleSheet, View, Image, Modal, Text, Pressable } from 'react-native';
import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { ScrollToTopProvider, useScrollToTopTrigger } from '@/lib/scroll-to-top-context';
import Animated, {
  FadeIn,
  FadeOut,
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

// ─── Tab tour routing ───────────────────────────────────────────────────────
// The guided tour no longer shows one generic card per tab from here — each
// tab now has its own in-page tutorial (walking through that screen's real
// sections), driven by the shared tourActiveTab store field. This file's only
// remaining tour job is: own the intro card, and navigate to whichever tab
// is currently touring so that tab's own tutorial can mount and take over.
// Order matches the tab bar's actual left-to-right layout.
const TOUR_TAB_ROUTES = ['/', '/profile', '/train', '/recover', '/workouts'] as const;
const TOUR_TAB_SEGMENT = ['index', 'profile', 'train', 'recover', 'workouts'] as const;

// ─── PNG Tab Icons ───────────────────────────────────────────────────────────

const TAB_ICONS = {
  home: require('@/assets/images/tabs/home.png'),
  profile: require('@/assets/images/tabs/profile.png'),
  train: require('@/assets/images/tabs/train.png'),
  restore: require('@/assets/images/tabs/restore.png'),
  stats: require('@/assets/images/tabs/stats.png'),
} as const;

/**
 * The artwork is near-white ink on transparency, drawn back when this bar was
 * hardcoded to the dark palette. Now that the bar follows the theme, untinted
 * icons would be white-on-near-white in light mode — invisible. Tinting also
 * makes each icon the same colour as the label under it, which the opacity
 * trick it replaces could not do.
 */
function TabIcon({ source, focused, size = 28 }: { source: any; focused: boolean; size?: number }) {
  const C = useColors();
  return (
    <Image
      source={source}
      style={{ width: size, height: size, tintColor: focused ? C.tabActive : C.tabInactive }}
      resizeMode="contain"
    />
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
  const triggerScrollToTop = useScrollToTopTrigger();

  const {
    tourComplete,
    tourJustCompleted,
    tourActiveTab,
    tourSkipNonce,
    setTourActiveTab,
    skipTour,
    newlyUnlockedBadges,
  } = useAppStore();
  const segments = useSegments();

  // New users see an intro card first ("Let's take a tour!"); the tab-by-tab
  // tour (tourActiveTab) only starts once that's dismissed. Veterans skip both.
  const [showTourIntro, setShowTourIntro] = useState<boolean>(() => !tourComplete);

  // Brief "you can replay this later" toast, shown whenever the tour is
  // skipped — from the intro card, or from any tab's own in-page tutorial —
  // so skipping doesn't feel final. Driven by tourSkipNonce (store) rather
  // than a locally-owned skip handler, since the skip can now originate from
  // a completely different screen than this one.
  const [showSkipHint, setShowSkipHint] = useState(false);
  const skipHintTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flashSkipHint = useCallback(() => {
    setShowSkipHint(true);
    if (skipHintTimer.current) clearTimeout(skipHintTimer.current);
    skipHintTimer.current = setTimeout(() => setShowSkipHint(false), 3200);
  }, []);
  useEffect(
    () => () => {
      if (skipHintTimer.current) clearTimeout(skipHintTimer.current);
    },
    []
  );
  const prevSkipNonce = useRef(tourSkipNonce);
  useEffect(() => {
    if (tourSkipNonce !== prevSkipNonce.current) {
      flashSkipHint();
      prevSkipNonce.current = tourSkipNonce;
    }
  }, [tourSkipNonce, flashSkipHint]);

  const startTour = useCallback(() => {
    setShowTourIntro(false);
    // Wait for the intro Modal's dismiss animation to actually finish before
    // handing off to Home's own tutorial. Starting it in the same tick left
    // the card visually present but completely unresponsive to taps - the
    // outgoing native Modal was still owning touch input underneath for a
    // beat after `visible` flipped false.
    setTimeout(() => setTourActiveTab(0), 300);
  }, [setTourActiveTab]);

  const skipFromIntro = useCallback(() => {
    setShowTourIntro(false);
    skipTour();
  }, [skipTour]);

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

  // Replay: when tourComplete flips from true → false (e.g. "Replay tour" in
  // Settings, triggered from Profile), restart from tab 0 (Home).
  const prevTourComplete = useRef(tourComplete);
  useEffect(() => {
    if (prevTourComplete.current === true && tourComplete === false) {
      setTourActiveTab(0);
    }
    prevTourComplete.current = tourComplete;
  }, [tourComplete, setTourActiveTab]);

  // Navigate to whichever tab the tour is currently on. Guarded against the
  // current route already matching the target so this never fires a
  // redundant navigate right after onboarding's own gate navigation already
  // landed the user on Home — only a genuine tab switch (advancing between
  // tabs, or replaying the tour from Profile) actually triggers one.
  useEffect(() => {
    if (tourActiveTab === null) return;
    const currentSegment = segments[segments.length - 1];
    if (currentSegment === TOUR_TAB_SEGMENT[tourActiveTab]) return;
    const timer = setTimeout(() => router.navigate(TOUR_TAB_ROUTES[tourActiveTab] as any), 200);
    return () => clearTimeout(timer);
  }, [tourActiveTab, segments]);

  // Position the skip-hint toast above the tab bar, with room to breathe.
  const tabBarHeight = isWeb ? 84 : insets.bottom + 50;

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
              <Animated.View style={tabPulseStyle}>
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
            tabBarIcon: ({ focused }) => <TabIcon source={TAB_ICONS.profile} focused={focused} />,
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
            tabBarIcon: ({ focused }) => <TabIcon source={TAB_ICONS.restore} focused={focused} />,
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
            tabBarIcon: ({ focused }) => <TabIcon source={TAB_ICONS.stats} focused={focused} />,
          }}
        />
      </Tabs>

      {/* Achievement toasts render as their own root-level <Modal> (app/_layout.tsx).
          Two native Modals presented at once break touch routing on both and
          look like the whole app has frozen - hold this one back until any
          badge earned during onboarding (e.g. logging a 1RM) has been shown
          and cleared, so only one is ever visible at a time. */}
      <Modal
        visible={showTourIntro && newlyUnlockedBadges.length === 0}
        transparent
        animationType="fade"
        onRequestClose={startTour}
      >
        <View style={styles.introOverlay}>
          <View style={[styles.introCard, { backgroundColor: C.surface, borderColor: C.primary }]}>
            <View style={[styles.introIconRing, { backgroundColor: C.primarySurface }]}>
              <Ionicons name="compass-outline" size={30} color={C.primaryText} />
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

      {showSkipHint && (
        <Animated.View
          entering={FadeIn.duration(200)}
          exiting={FadeOut.duration(200)}
          style={[styles.skipHint, { bottom: tabBarHeight + 16, backgroundColor: C.text }]}
          pointerEvents="none"
          testID="tour-skip-hint"
        >
          <Text style={[styles.skipHintText, { color: C.background }]}>
            Tour skipped. Find it again anytime in Profile → Settings.
          </Text>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  skipHint: {
    position: 'absolute',
    left: 24,
    right: 24,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: 'center',
    zIndex: 250,
    ...elevatedShadow('#000'),
  },
  skipHintText: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
    textAlign: 'center',
  },
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
