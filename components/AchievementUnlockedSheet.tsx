import React, { useEffect } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Modal,
  Platform,
  Image,
  ScrollView,
  useWindowDimensions,
} from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/constants/colors';
import { shadowStyle } from '@/constants/shadows';
import { Badge, MILESTONE_SESSION_THRESHOLDS } from '@/lib/badges';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const ACHIEVEMENT_LOGO = require('@/assets/images/home/achievements.png');

const EXIT_MS = 210;
/** How far the sheet slides down on the way out. Exit only — see the note on
 *  translateY: the sheet is never positioned by an entering animation. */
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
  const { height: windowHeight } = useWindowDimensions();

  // The sheet is laid out AT REST, not animated into place.
  //
  // It used to start translated SLIDE_START px down with a transparent
  // backdrop and rely on a mount animation to bring it in. When that animation
  // did not run — reproduced here, the sheet sat permanently at
  // `transform: translateY(460px)` — it stayed pushed down the screen while
  // still covering the whole display. Its "View all badges" and "Not now"
  // buttons rendered below the bottom edge, and because the sheet covered
  // everything there was no backdrop left to tap either. An undismissable
  // full-screen modal, indistinguishable from the app freezing, clearable only
  // by force-quitting.
  //
  // A failsafe that snapped the values back after a timeout did not fix it, so
  // correct placement no longer depends on an animation running at all. The
  // Modal's own presentation provides the transition.
  const translateY = useSharedValue(0);
  const backdropOpacity = useSharedValue(1);

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  useEffect(() => {
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light), 180);
      setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium), 360);
      setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy), 520);
    }
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

      {/* Outer Pressable: tap outside the sheet to dismiss. */}
      <Pressable style={styles.container} onPress={dismiss}>
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
                // Never taller than the screen. A first real session can clear
                // nine "first of category" thresholds at once, and an unbounded
                // sheet then grew past the viewport: it covered the display
                // completely, so there was no backdrop left to tap, and both
                // its buttons rendered below the bottom edge where they could
                // not be reached. The result was an undismissable full-screen
                // modal — indistinguishable from the app having frozen, and
                // only clearable by force-quitting.
                maxHeight: windowHeight * 0.88,
              },
            ]}
          >
            {/* Handle bar */}
            <View style={[styles.handle, { backgroundColor: C.border }]} />

            {/* Everything above the buttons scrolls, so however many badges
                land at once the actions below stay on screen and reachable. */}
            <ScrollView
              style={styles.scrollArea}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
              bounces={false}
            >
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
            </ScrollView>

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
  // flexShrink lets the scroll area give up height when the sheet hits its cap,
  // so the buttons below it are never pushed off the bottom of the screen.
  scrollArea: { alignSelf: 'stretch', flexShrink: 1 },
  scrollContent: { alignItems: 'center', gap: 10 },
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
