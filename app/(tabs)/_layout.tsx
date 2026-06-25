import { Tabs, router } from "expo-router";
import { BlurView } from "expo-blur";
import {
  Platform,
  StyleSheet,
  useColorScheme,
  View,
  Text,
  Pressable,
  Modal,
  Animated,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import React, {
  useRef,
  useEffect,
  useState,
  useCallback,
  ReactNode,
} from "react";
import { useColors } from "@/constants/colors";
import { useAppStore } from "@/lib/store";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// ─── Tour content ─────────────────────────────────────────────────────────────

interface TourTabDef {
  key: string;
  label: string;
  icon: string;
  headline: string;
  body: string;
  tips: string[];
  showMockup?: boolean;
  showBadgeMockup?: boolean;
}

const TOUR_TABS: TourTabDef[] = [
  {
    key: "index",
    label: "Home",
    icon: "home",
    headline: "Your daily starting point",
    body: "Shows your next suggested session based on where you are in your strength rotation. Tap the session card to begin, or use the quick-start options below for any session type.",
    tips: [
      "Suggested session updates automatically each day",
      "Equipment chip overrides your gear for today without changing your profile",
      "Resume banner appears if you have an unfinished session",
      "Achievements row shows your latest badges — tap it to see your full collection",
    ],
  },
  {
    key: "achievements",
    label: "Achievements",
    icon: "trophy",
    headline: "Earn badges as you train",
    body: "Every session, streak, and milestone you hit unlocks a badge. Tap the Achievements row on Home to see your full collection — earned badges glow with colour, locked ones show exactly what you need to do to unlock them.",
    tips: [
      "Over 400 badges across milestones, streaks, strength, volume, and more",
      "Tap any badge to see its description and how to earn it",
      "New badge unlocks appear as a pop-up toast above the tab bar",
    ],
    showBadgeMockup: true,
  },
  {
    key: "profile",
    label: "Profile",
    icon: "person",
    headline: "Your stats and settings",
    body: "All your personal data in one place. Tap your avatar to set a photo. Update your bodyweight regularly — it drives suggested loads for every single session.",
    tips: [
      "1RM records are tracked automatically from your sessions",
      "Milestone badges unlock at 1, 5, 10, 25, 50+ sessions",
      "Change equipment, experience level and goals anytime",
    ],
  },
  {
    key: "train",
    label: "Train",
    icon: "barbell",
    headline: "Your strength program",
    body: "Follows a structured Lower Body → Upper Body → Full Body rotation so every muscle group gets hit. Every session adapts exercises, sets and loads to your equipment and energy level.",
    tips: [
      "Custom sessions let you design your own workout",
      "Pain settings automatically swap exercises to protect problem areas",
      "Test weeks every 12–18 sessions measure your strength gains",
    ],
  },
  {
    key: "flex",
    label: "Flex",
    icon: "leaf",
    headline: "Recovery and conditioning",
    body: "Your active recovery toolkit. Mobility flows, prehab circuits, flexibility sessions and conditioning workouts — all designed to keep you moving on rest days.",
    tips: [
      "Targeted prehab focuses on a specific joint or region",
      "Conditioning ranges from light aerobic to full HIIT",
      "Flexibility sessions use long holds for deep mobility work",
    ],
  },
  {
    key: "workouts",
    label: "Stats",
    icon: "bar-chart",
    headline: "Your progress over time",
    body: "Every session, set and weight is logged here. Your charts and KPIs fill in as you train — the more you do, the more insight you get.",
    tips: [
      "Session breakdown shows volume by session type",
      "Strength KPIs track your best squat, bench and deadlift",
      "Weekly volume chart shows if you are consistently doing more work",
    ],
    showMockup: true,
  },
];

// ─── Glow animation ───────────────────────────────────────────────────────────

function GlowIcon({
  children,
  active,
  primaryColor,
}: {
  children: ReactNode;
  active: boolean;
  primaryColor: string;
}) {
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (active) {
      const anim = Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, {
            toValue: 1,
            duration: 950,
            useNativeDriver: true,
          }),
          Animated.timing(pulse, {
            toValue: 0,
            duration: 950,
            useNativeDriver: true,
          }),
        ])
      );
      anim.start();
      return () => {
        anim.stop();
        pulse.setValue(0);
      };
    } else {
      pulse.setValue(0);
    }
  }, [active]);

  return (
    <View style={{ alignItems: "center", justifyContent: "center" }}>
      {active && (
        <Animated.View
          style={{
            position: "absolute",
            width: 42,
            height: 42,
            borderRadius: 21,
            backgroundColor: primaryColor,
            opacity: pulse.interpolate({
              inputRange: [0, 1],
              outputRange: [0.08, 0.3],
            }),
            transform: [
              {
                scale: pulse.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.65, 1.5],
                }),
              },
            ],
          }}
        />
      )}
      {children}
    </View>
  );
}

// ─── Train tab icon (elevated circle + optional glow) ────────────────────────

function TrainTabIcon({
  focused,
  glowing,
}: {
  focused: boolean;
  glowing: boolean;
}) {
  const C = useColors();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const btnColor = isDark ? C.primaryLight : C.primary;
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (glowing) {
      const anim = Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, {
            toValue: 1,
            duration: 950,
            useNativeDriver: true,
          }),
          Animated.timing(pulse, {
            toValue: 0,
            duration: 950,
            useNativeDriver: true,
          }),
        ])
      );
      anim.start();
      return () => {
        anim.stop();
        pulse.setValue(0);
      };
    } else {
      pulse.setValue(0);
    }
  }, [glowing]);

  return (
    <View style={{ alignItems: "center", justifyContent: "center" }}>
      {glowing && (
        <Animated.View
          style={{
            position: "absolute",
            width: 62,
            height: 62,
            borderRadius: 31,
            backgroundColor: btnColor,
            transform: [
              { translateY: -6 },
              {
                scale: pulse.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.72, 1.5],
                }),
              },
            ],
            opacity: pulse.interpolate({
              inputRange: [0, 1],
              outputRange: [0.08, 0.25],
            }),
          }}
        />
      )}
      <View
        style={{
          width: 48,
          height: 48,
          borderRadius: 24,
          alignItems: "center",
          justifyContent: "center",
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
    </View>
  );
}

// ─── Stats mini-mockup ────────────────────────────────────────────────────────

function StatsMockup() {
  const C = useColors();
  const bars = [28, 45, 38, 60, 50, 72, 85];
  return (
    <View
      style={{
        backgroundColor: C.surfaceSecondary,
        borderRadius: 14,
        padding: 14,
        gap: 10,
        borderWidth: 1,
        borderColor: C.borderLight,
      }}
    >
      <Text
        style={{
          fontSize: 11,
          fontFamily: "Inter_600SemiBold",
          color: C.textTertiary,
          textTransform: "uppercase",
          letterSpacing: 0.6,
        }}
      >
        What 12 sessions looks like
      </Text>

      {/* Mini bar chart */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "flex-end",
          height: 44,
          gap: 5,
        }}
      >
        {bars.map((h, i) => (
          <View
            key={i}
            style={{
              flex: 1,
              height: (h / 100) * 44,
              backgroundColor:
                i === bars.length - 1 ? C.primary : C.primaryMuted,
              borderRadius: 4,
            }}
          />
        ))}
      </View>

      {/* Session type badges */}
      <View style={{ flexDirection: "row", gap: 6 }}>
        {(
          [
            { label: "Lower ×4" },
            { label: "Upper ×4" },
            { label: "Full ×4" },
          ] as const
        ).map((b, i) => (
          <View
            key={i}
            style={{
              backgroundColor: C.primarySurface,
              borderRadius: 8,
              paddingHorizontal: 8,
              paddingVertical: 3,
              borderWidth: 1,
              borderColor: C.primaryMuted,
            }}
          >
            <Text
              style={{
                fontSize: 10,
                fontFamily: "Inter_600SemiBold",
                color: C.primary,
              }}
            >
              {b.label}
            </Text>
          </View>
        ))}
      </View>

      {/* Strength KPIs */}
      <View
        style={{
          flexDirection: "row",
          borderTopWidth: 1,
          borderTopColor: C.borderLight,
          paddingTop: 8,
        }}
      >
        {(
          [
            { label: "Squat", value: "120kg" },
            { label: "Bench", value: "85kg" },
            { label: "Deadlift", value: "140kg" },
          ] as const
        ).map((kpi, i) => (
          <View key={i} style={{ flex: 1, alignItems: "center" }}>
            <Text
              style={{
                fontSize: 15,
                fontFamily: "Inter_700Bold",
                color: C.primary,
              }}
            >
              {kpi.value}
            </Text>
            <Text
              style={{
                fontSize: 10,
                fontFamily: "Inter_400Regular",
                color: C.textTertiary,
              }}
            >
              {kpi.label}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

// ─── Badge mini-mockup ────────────────────────────────────────────────────────

function BadgeMockup() {
  const C = useColors();
  const PREVIEW_BADGES = [
    { emoji: "🏆", label: "First Step", earned: true },
    { emoji: "🔥", label: "3-Day Streak", earned: true },
    { emoji: "💪", label: "5 Sessions", earned: true },
    { emoji: "⚡", label: "10 Sessions", earned: false },
    { emoji: "🎯", label: "25 Sessions", earned: false },
    { emoji: "🌟", label: "50 Sessions", earned: false },
    { emoji: "🦾", label: "100kg Lift", earned: false },
    { emoji: "🏅", label: "Test Week", earned: false },
  ];
  return (
    <View
      style={{
        backgroundColor: C.surfaceSecondary,
        borderRadius: 14,
        padding: 14,
        gap: 10,
        borderWidth: 1,
        borderColor: C.borderLight,
      }}
    >
      <Text
        style={{
          fontSize: 11,
          fontFamily: "Inter_600SemiBold",
          color: C.textTertiary,
          textTransform: "uppercase",
          letterSpacing: 0.6,
        }}
      >
        Your badge collection
      </Text>

      {/* 4-column badge grid preview */}
      <View
        style={{
          flexDirection: "row",
          flexWrap: "wrap",
          gap: 6,
        }}
      >
        {PREVIEW_BADGES.map((b, i) => (
          <View
            key={i}
            style={{
              width: "22%",
              aspectRatio: 1,
              borderRadius: 12,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: b.earned ? C.primarySurface : C.surfaceTertiary,
              borderWidth: 1,
              borderColor: b.earned ? C.primaryMuted : C.borderLight,
              opacity: b.earned ? 1 : 0.55,
              gap: 2,
            }}
          >
            <Text style={{ fontSize: 18 }}>{b.emoji}</Text>
            <Text
              style={{
                fontSize: 8,
                fontFamily: "Inter_600SemiBold",
                color: b.earned ? C.primary : C.textTertiary,
                textAlign: "center",
              }}
              numberOfLines={1}
            >
              {b.label}
            </Text>
          </View>
        ))}
      </View>

      {/* Legend */}
      <View
        style={{
          flexDirection: "row",
          gap: 14,
          borderTopWidth: 1,
          borderTopColor: C.borderLight,
          paddingTop: 8,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
          <View
            style={{
              width: 10,
              height: 10,
              borderRadius: 3,
              backgroundColor: C.primarySurface,
              borderWidth: 1,
              borderColor: C.primaryMuted,
            }}
          />
          <Text
            style={{
              fontSize: 10,
              fontFamily: "Inter_400Regular",
              color: C.textSecondary,
            }}
          >
            Earned
          </Text>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
          <View
            style={{
              width: 10,
              height: 10,
              borderRadius: 3,
              backgroundColor: C.surfaceTertiary,
              borderWidth: 1,
              borderColor: C.borderLight,
              opacity: 0.55,
            }}
          />
          <Text
            style={{
              fontSize: 10,
              fontFamily: "Inter_400Regular",
              color: C.textSecondary,
            }}
          >
            Locked — tap to see how to unlock
          </Text>
        </View>
      </View>
    </View>
  );
}

// ─── Tour sheet (bottom-slide Modal) ─────────────────────────────────────────

function TourSheet({
  visible,
  tabKey,
  isLast,
  onDismiss,
}: {
  visible: boolean;
  tabKey: string | null;
  isLast: boolean;
  onDismiss: () => void;
}) {
  const C = useColors();
  const insets = useSafeAreaInsets();
  const tab = tabKey ? TOUR_TABS.find((t) => t.key === tabKey) : null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onDismiss}
    >
      <Pressable style={styles.backdrop} onPress={onDismiss} />
      <View
        style={[
          styles.sheet,
          { paddingBottom: insets.bottom + 20, backgroundColor: C.surface },
        ]}
      >
        <View style={[styles.sheetHandle, { backgroundColor: C.border }]} />

        {tab && (
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ gap: 14, paddingBottom: 4 }}
          >
            {/* Header */}
            <View style={styles.sheetHeaderRow}>
              <View
                style={[
                  styles.sheetIconBadge,
                  { backgroundColor: C.primarySurface },
                ]}
              >
                <Ionicons
                  name={tab.icon as any}
                  size={20}
                  color={C.primary}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  style={[styles.sheetTabLabel, { color: C.textTertiary }]}
                >
                  {tab.label}
                </Text>
                <Text style={[styles.sheetHeadline, { color: C.text }]}>
                  {tab.headline}
                </Text>
              </View>
            </View>

            {/* Body */}
            <Text style={[styles.sheetBody, { color: C.textSecondary }]}>
              {tab.body}
            </Text>

            {/* Tips */}
            <View style={{ gap: 8 }}>
              {tab.tips.map((tip, i) => (
                <View key={i} style={styles.tipRow}>
                  <Ionicons
                    name="checkmark-circle"
                    size={15}
                    color={C.primary}
                  />
                  <Text style={[styles.tipText, { color: C.textSecondary }]}>
                    {tip}
                  </Text>
                </View>
              ))}
            </View>

            {/* Stats mockup */}
            {tab.showMockup && <StatsMockup />}

            {/* Badge mockup */}
            {tab.showBadgeMockup && <BadgeMockup />}
          </ScrollView>
        )}

        {/* CTA button */}
        <Pressable
          onPress={onDismiss}
          style={({ pressed }) => [
            styles.gotItBtn,
            { backgroundColor: C.primary },
            pressed && { opacity: 0.86 },
          ]}
          testID="tour-sheet-got-it"
        >
          <Text style={[styles.gotItText, { color: C.textInverse }]}>
            {isLast ? "Let's go!" : "Got it"}
          </Text>
        </Pressable>
      </View>
    </Modal>
  );
}

// ─── Tour prompt bar (floats above tab bar) ───────────────────────────────────

function TourPromptBar({
  tabsSeen,
  totalTabs,
  onSkip,
}: {
  tabsSeen: number;
  totalTabs: number;
  onSkip: () => void;
}) {
  const C = useColors();
  const progress = tabsSeen / totalTabs;

  return (
    <View
      style={[
        styles.promptBar,
        { backgroundColor: C.surface, borderColor: C.borderLight },
      ]}
    >
      <View style={{ flex: 1, gap: 3 }}>
        <Text style={[styles.promptTitle, { color: C.text }]}>
          Explore the app ✦
        </Text>
        <Text style={[styles.promptSub, { color: C.textSecondary }]}>
          Tap each tab to discover what's inside
        </Text>
        {/* Progress track */}
        <View
          style={[styles.progressTrack, { backgroundColor: C.surfaceTertiary }]}
        >
          <View
            style={[
              styles.progressFill,
              { backgroundColor: C.primary, width: `${Math.round(progress * 100)}%` },
            ]}
          />
        </View>
      </View>
      <Pressable
        onPress={onSkip}
        style={({ pressed }) => [
          styles.skipBtn,
          { backgroundColor: C.surfaceTertiary },
          pressed && { opacity: 0.7 },
        ]}
        testID="tour-skip"
      >
        <Text style={[styles.skipText, { color: C.textSecondary }]}>Skip</Text>
      </Pressable>
    </View>
  );
}

// ─── Main TabLayout ───────────────────────────────────────────────────────────

export default function TabLayout() {
  const C = useColors();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const isIOS = Platform.OS === "ios";
  const isWeb = Platform.OS === "web";
  const insets = useSafeAreaInsets();

  const { tourComplete, setTourComplete } = useAppStore();
  const [tabsSeen, setTabsSeen] = useState<Set<string>>(new Set());
  const [activeSheet, setActiveSheet] = useState<string | null>(null);

  // When tourComplete flips from true → false (i.e. the user tapped "Replay
  // guided tour" in Settings), reset all local tour progress so the full 6-step
  // flow starts fresh: glow icons reappear on all tabs, progress bar resets to
  // 0/6, and tab presses re-open each sheet.
  const prevTourComplete = useRef(tourComplete);
  useEffect(() => {
    if (prevTourComplete.current === true && tourComplete === false) {
      setTabsSeen(new Set());
      setActiveSheet(null);
    }
    prevTourComplete.current = tourComplete;
  }, [tourComplete]);

  // Height of the tab bar from the bottom of the screen
  const tabBarBottom = isWeb ? 84 : insets.bottom + 50;
  const tourActive = !tourComplete;
  // "Last" = tapping Got It on this sheet will complete the tour
  const isLastSheet = tabsSeen.size >= TOUR_TABS.length - 1;

  const handleTabPress = useCallback(
    (key: string) => {
      if (!tourActive || tabsSeen.has(key)) return;
      setActiveSheet(key);
    },
    [tourActive, tabsSeen]
  );

  const handleSheetDismiss = useCallback(() => {
    if (!activeSheet) return;
    const key = activeSheet;
    setActiveSheet(null);
    setTabsSeen((prev) => {
      const next = new Set(prev);
      next.add(key);
      if (next.size >= TOUR_TABS.length) {
        setTourComplete(true);
      }
      return next;
    });
    // After the Home tab sheet is dismissed, navigate into the Achievements
    // screen with tour mode active so the user sees their real badge grid.
    // Mark achievements as seen immediately so it counts toward tour completion.
    if (key === "index") {
      setTabsSeen((prev) => {
        const next = new Set(prev);
        next.add("achievements");
        if (next.size >= TOUR_TABS.length) {
          setTourComplete(true);
        }
        return next;
      });
      setTimeout(() => router.push("/achievements?tour=1"), 350);
    }
  }, [activeSheet, setTourComplete]);

  const handleSkip = useCallback(() => {
    setTourComplete(true);
    setActiveSheet(null);
  }, [setTourComplete]);

  return (
    <View style={{ flex: 1 }}>
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: C.tabActive,
          tabBarInactiveTintColor: C.tabInactive,
          headerShown: false,
          tabBarStyle: {
            position: "absolute",
            backgroundColor: isIOS ? "transparent" : C.surface,
            borderTopWidth: isWeb ? 1 : 0,
            borderTopColor: C.border,
            elevation: 0,
            ...(isWeb ? { height: 84 } : {}),
          },
          tabBarBackground: () =>
            isIOS ? (
              <BlurView
                intensity={100}
                tint={isDark ? "dark" : "light"}
                style={StyleSheet.absoluteFill}
              />
            ) : isWeb ? (
              <View
                style={[StyleSheet.absoluteFill, { backgroundColor: C.surface }]}
              />
            ) : null,
        }}
      >
        <Tabs.Screen
          name="index"
          listeners={{ tabPress: () => handleTabPress("index") }}
          options={{
            title: "Home",
            tabBarIcon: ({ color, size, focused }) => (
              <GlowIcon
                active={tourActive && !tabsSeen.has("index")}
                primaryColor={C.primary}
              >
                <Ionicons
                  name={focused ? "home" : "home-outline"}
                  size={size || 24}
                  color={color}
                />
              </GlowIcon>
            ),
          }}
        />
        <Tabs.Screen
          name="profile"
          listeners={{ tabPress: () => handleTabPress("profile") }}
          options={{
            title: "Profile",
            tabBarIcon: ({ color, size, focused }) => (
              <GlowIcon
                active={tourActive && !tabsSeen.has("profile")}
                primaryColor={C.primary}
              >
                <Ionicons
                  name={focused ? "person" : "person-outline"}
                  size={size || 24}
                  color={color}
                />
              </GlowIcon>
            ),
          }}
        />
        <Tabs.Screen
          name="train"
          listeners={{ tabPress: () => handleTabPress("train") }}
          options={{
            title: "Train",
            tabBarItemStyle: { overflow: "visible" },
            tabBarIcon: ({ focused }) => (
              <TrainTabIcon
                focused={focused}
                glowing={tourActive && !tabsSeen.has("train")}
              />
            ),
            tabBarLabelStyle: {
              fontSize: 10,
              fontWeight: "600",
              marginTop: 2,
            },
          }}
        />
        <Tabs.Screen
          name="flex"
          listeners={{ tabPress: () => handleTabPress("flex") }}
          options={{
            title: "Flex",
            tabBarIcon: ({ color, size, focused }) => (
              <GlowIcon
                active={tourActive && !tabsSeen.has("flex")}
                primaryColor={C.primary}
              >
                <Ionicons
                  name={focused ? "leaf" : "leaf-outline"}
                  size={size || 24}
                  color={color}
                />
              </GlowIcon>
            ),
          }}
        />
        <Tabs.Screen
          name="workouts"
          listeners={{ tabPress: () => handleTabPress("workouts") }}
          options={{
            title: "Stats",
            tabBarIcon: ({ color, size, focused }) => (
              <GlowIcon
                active={tourActive && !tabsSeen.has("workouts")}
                primaryColor={C.primary}
              >
                <Ionicons
                  name={focused ? "bar-chart" : "bar-chart-outline"}
                  size={size || 24}
                  color={color}
                />
              </GlowIcon>
            ),
          }}
        />
      </Tabs>

      {/* ── Tour overlay ── */}
      {tourActive && (
        <>
          {/* Prompt bar floats above the tab bar */}
          <View
            style={[
              styles.promptWrapper,
              { bottom: tabBarBottom + 10 },
            ]}
          >
            <TourPromptBar
              tabsSeen={tabsSeen.size}
              totalTabs={TOUR_TABS.length}
              onSkip={handleSkip}
            />
          </View>

          {/* Per-tab explanation sheet */}
          <TourSheet
            visible={activeSheet !== null}
            tabKey={activeSheet}
            isLast={isLastSheet}
            onDismiss={handleSheetDismiss}
          />
        </>
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)" },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 22,
    paddingTop: 10,
    maxHeight: "88%",
    gap: 16,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 4,
  },
  sheetHeaderRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  sheetIconBadge: {
    width: 42,
    height: 42,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  sheetTabLabel: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  sheetHeadline: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    marginTop: 2,
    lineHeight: 23,
  },
  sheetBody: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    lineHeight: 21,
  },
  tipRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  tipText: {
    flex: 1,
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    lineHeight: 18,
  },
  gotItBtn: {
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },
  gotItText: {
    fontSize: 15,
    fontFamily: "Inter_700Bold",
  },
  promptWrapper: {
    position: "absolute",
    left: 16,
    right: 16,
    zIndex: 99,
  },
  promptBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  promptTitle: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
  },
  promptSub: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
  },
  progressTrack: {
    height: 3,
    borderRadius: 2,
    marginTop: 5,
    overflow: "hidden",
  },
  progressFill: {
    height: 3,
    borderRadius: 2,
  },
  skipBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
  },
  skipText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
});
