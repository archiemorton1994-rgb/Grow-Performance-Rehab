import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Modal, Platform, Image } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/constants/colors';
import { shadowStyle } from '@/constants/shadows';
import { Badge, MILESTONE_SESSION_THRESHOLDS } from '@/lib/badges';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const ACHIEVEMENT_LOGO = require('@/assets/images/home/achievements.png');

const ENTER_MS = 300;
const EXIT_MS = 210;
const SLIDE_START = 460;

interface AchievementUnlockedSheetProps {
  badgeCount: number;
  badgeName?: string;
  badgeIcon?: string;
  badgeColor?: string;
  sessionCount?: number;
  /** Resolved Badge objects — provided for the 2–4 simultaneous case so we
   *  can render individual icons + names instead of a generic subtitle. */
  badges?: Badge[];
  onDismiss: () => void;
}

export default function AchievementUnlockedSheet({
  badgeCount,
  badgeName,
  badgeIcon,
  badgeColor,
  sessionCount,
  badges,
  onDismiss,
}: AchievementUnlockedSheetProps) {
  const C = useColors();
  const insets = useSafeAreaInsets();

  const translateY = useSharedValue(SLIDE_START);
  const backdropOpacity = useSharedValue(0);

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  // Whether the sheet has definitely reached its on-screen position. The
  // full-screen Pressable below must not swallow touches before this is true:
  // it is the only thing between the user and the app, and it exists from the
  // first frame while the sheet itself starts translated off-screen with a
  // fully transparent backdrop.
  const [presented, setPresented] = useState(false);

  useEffect(() => {
    backdropOpacity.value = withTiming(1, { duration: ENTER_MS });
    translateY.value = withSpring(0, { damping: 22, stiffness: 200 });

    // Failsafe. This Modal mounts at root level, often while a navigation
    // transition is still in flight (finishing a session unlocks badges, then
    // immediately replaces the route). If the entering animation gets dropped
    // in that window the sheet stays parked at SLIDE_START behind a
    // zero-opacity backdrop — invisible, but its Pressable keeps eating every
    // tap, so the whole app reads as frozen until it is force-quit.
    // Snap to the presented state unconditionally rather than trusting the
    // animation to have run.
    const settle = setTimeout(() => {
      backdropOpacity.value = 1;
      translateY.value = 0;
      setPresented(true);
    }, ENTER_MS + 120);

    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light), 180);
      setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium), 360);
      setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy), 520);
    }
    return () => clearTimeout(settle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const dismiss = () => {
    backdropOpacity.value = withTiming(0, { duration: EXIT_MS });
    translateY.value = withTiming(SLIDE_START, { duration: EXIT_MS });
    setTimeout(onDismiss, EXIT_MS);
  };

  const handleViewBadges = () => {
    dismiss();
    setTimeout(() => router.push('/achievements'), EXIT_MS + 20);
  };

  const isSingle = badgeCount === 1;
  // 2–9 simultaneous badges: show individual icons + names (wraps to a grid)
  // instead of collapsing to a bare number — a first real session commonly
  // clears several "first of category" thresholds at once, and that's the
  // moment this needs to feel like something, not just say "9".
  const isSmallBatch = !isSingle && badgeCount <= 9 && !!badges?.length;
  const accent = isSingle ? (badgeColor ?? C.primary) : C.achievementGold;
  const title = isSingle ? 'Achievement Unlocked!' : `${badgeCount} Achievements Unlocked!`;
  const subtitle = isSingle && badgeName ? badgeName : 'Tap to view your new badges';

  const nextMilestone =
    sessionCount != null
      ? (MILESTONE_SESSION_THRESHOLDS.find((m) => m > sessionCount) ?? null)
      : null;
  const sessionsToGo =
    nextMilestone != null && sessionCount != null ? nextMilestone - sessionCount : null;

  return (
    <Modal visible transparent animationType="none" onRequestClose={dismiss}>
      {/* Animated backdrop — visual only, no touch handling */}
      <Animated.View
        style={[StyleSheet.absoluteFill, styles.backdrop, backdropStyle]}
        pointerEvents="none"
      />

      {/* Outer Pressable: tap outside sheet to dismiss. pointerEvents is gated
          on `presented` so this can never block the app while the sheet is
          still invisible — see the failsafe in the mount effect above. */}
      <Pressable
        style={styles.container}
        onPress={dismiss}
        pointerEvents={presented ? 'auto' : 'box-none'}
      >
        {/* Animated sheet wrapper */}
        <Animated.View style={sheetStyle}>
          {/* Inner Pressable: stop-propagation so tapping inside does not dismiss */}
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={[
              styles.sheet,
              {
                backgroundColor: C.surface,
                borderColor: C.borderLight,
                paddingBottom: insets.bottom + 28,
              },
            ]}
          >
            {/* Handle bar */}
            <View style={[styles.handle, { backgroundColor: C.border }]} />

            {/* Large icon */}
            <View
              style={[
                styles.iconRing,
                { backgroundColor: accent + '18', borderColor: accent + '44' },
              ]}
            >
              <Image source={ACHIEVEMENT_LOGO} style={styles.iconImage} resizeMode="contain" />
            </View>

            {/* Heading */}
            <Text style={[styles.title, { color: C.text }]}>{title}</Text>

            {/* For 2–4 simultaneous badges: show each badge icon + name */}
            {isSmallBatch ? (
              <View style={styles.badgeRow}>
                {badges!.map((b) => (
                  <View key={b.id} style={styles.badgeRowItem}>
                    <View
                      style={[
                        styles.badgeRowRing,
                        { backgroundColor: b.color + '18', borderColor: b.color + '44' },
                      ]}
                    >
                      <Ionicons name={b.icon as any} size={22} color={b.color} />
                    </View>
                    <Text
                      style={[styles.badgeRowName, { color: C.textSecondary }]}
                      numberOfLines={2}
                    >
                      {b.name}
                    </Text>
                  </View>
                ))}
              </View>
            ) : (
              <Text style={[styles.subtitle, { color: C.textSecondary }]} numberOfLines={2}>
                {subtitle}
              </Text>
            )}
            {sessionsToGo != null && sessionsToGo > 0 && (
              <Text style={[styles.milestoneHint, { color: C.textTertiary }]}>
                {sessionsToGo === 1
                  ? 'One more session to your next badge 🎯'
                  : `${sessionsToGo} sessions to your next badge`}
              </Text>
            )}

            {/* Primary CTA */}
            <Pressable
              onPress={handleViewBadges}
              style={({ pressed }) => [
                styles.primaryBtn,
                { backgroundColor: C.primary, ...shadowStyle(C.primary, 0.28, 8, 3, 5) },
                pressed && { opacity: 0.85, transform: [{ scale: 0.98 as number }] },
              ]}
              testID="achievement-sheet-view-badges"
            >
              <Ionicons name="trophy-outline" size={18} color={C.textInverse} />
              <Text style={[styles.primaryBtnText, { color: C.textInverse }]}>View all badges</Text>
            </Pressable>

            {/* Dismiss link */}
            <Pressable
              onPress={dismiss}
              hitSlop={12}
              style={styles.dismissRow}
              testID="achievement-sheet-dismiss"
            >
              <Text style={[styles.dismissText, { color: C.textTertiary }]}>Not now</Text>
            </Pressable>
          </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    backgroundColor: 'rgba(0,0,0,0.52)',
  },
  container: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderBottomWidth: 0,
    paddingTop: 12,
    paddingHorizontal: 24,
    alignItems: 'center',
    gap: 10,
    ...shadowStyle('#000', 0.1, 20, -4, 16),
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    marginBottom: 14,
  },
  iconRing: {
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  iconImage: {
    width: 56,
    height: 56,
  },
  title: {
    fontSize: 22,
    fontFamily: 'Inter_700Bold',
    textAlign: 'center',
    lineHeight: 28,
  },
  subtitle: {
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 10,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    alignSelf: 'stretch',
    borderRadius: 16,
    paddingVertical: 16,
    ...shadowStyle('#000', 0.28, 8, 3, 5),
  },
  primaryBtnText: {
    fontSize: 16,
    fontFamily: 'Inter_700Bold',
  },
  dismissRow: {
    paddingVertical: 10,
  },
  dismissText: {
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
  },
  milestoneHint: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
    marginTop: -2,
    marginBottom: 6,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 14,
    marginBottom: 10,
    alignSelf: 'stretch',
  },
  badgeRowItem: {
    alignItems: 'center',
    gap: 6,
    width: 78,
  },
  badgeRowRing: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeRowName: {
    fontSize: 11,
    fontFamily: 'Inter_500Medium',
    textAlign: 'center',
    lineHeight: 15,
  },
});
