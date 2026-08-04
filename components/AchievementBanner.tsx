import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/constants/colors';
import { shadowStyle } from '@/constants/shadows';
import { BadgeMedallion } from '@/components/BadgeMedallion';
import { BADGE_TIER_COLORS, BADGE_TIER_LABELS, Badge } from '@/lib/badges';

/**
 * "Achievement Unlocked" — a banner that drops in from the top of the screen it
 * is rendered on.
 *
 * WHY THIS IS NOT A MODAL
 * ───────────────────────
 * The badge celebration used to be a root-level <Modal>, and the session
 * summary is a Stack screen declared with presentation: 'fullScreenModal' — a
 * real native modal presentation. Two of those at once breaks touch routing on
 * both: the screen paints perfectly and nothing responds to taps. That froze the
 * app after any session that earned a badge, and it is why the celebration had
 * to be pushed off the summary screen entirely.
 *
 * A banner rendered INSIDE the screen's own tree has no such problem, which is
 * what lets the moment happen where it belongs — right after you finish.
 *
 * It also cannot trap anyone: it occupies a strip at the top, everything behind
 * it stays live, and it leaves on a timer whether or not it is touched.
 */

const SLIDE_MS = 380;
const EXIT_MS = 240;
/** How long each badge is shown before the next one, or before it leaves. */
const DWELL_MS = 3200;

export interface AchievementBannerProps {
  badges: Badge[];
  /** Tapping the banner. Should navigate somewhere the user can get back from. */
  onPress: (badge: Badge) => void;
  onDone?: () => void;
}

export function AchievementBanner({ badges, onPress, onDone }: AchievementBannerProps) {
  const C = useColors();
  const insets = useSafeAreaInsets();
  const [index, setIndex] = useState(0);
  const translateY = useSharedValue(-220);
  const opacity = useSharedValue(0);
  const finishedRef = useRef(false);

  const badge = badges[index];

  const leave = useCallback(() => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    translateY.value = withTiming(-220, { duration: EXIT_MS });
    opacity.value = withTiming(0, { duration: EXIT_MS });
    setTimeout(() => onDone?.(), EXIT_MS);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onDone]);

  // Drop in, then step through the badges one at a time and leave.
  useEffect(() => {
    if (badges.length === 0) return;
    translateY.value = withTiming(0, { duration: SLIDE_MS });
    opacity.value = withTiming(1, { duration: SLIDE_MS });
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [badges.length]);

  useEffect(() => {
    if (badges.length === 0) return;
    const t = setTimeout(() => {
      if (index + 1 < badges.length) {
        setIndex((i) => i + 1);
        if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } else {
        leave();
      }
    }, DWELL_MS);
    return () => clearTimeout(t);
  }, [index, badges.length, leave]);

  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }));

  if (!badge) return null;

  const accent = BADGE_TIER_COLORS[badge.tier];

  return (
    <Animated.View
      style={[styles.wrap, { top: insets.top + 8 }, style]}
      pointerEvents="box-none"
      testID="achievement-banner"
    >
      <Pressable
        onPress={() => {
          if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          onPress(badge);
        }}
        style={({ pressed }) => [
          styles.card,
          {
            backgroundColor: C.surface,
            borderColor: accent + '66',
            ...shadowStyle(C.shadow, 0.3, 18, 6, 10),
          },
          pressed && { opacity: 0.9 },
        ]}
        accessibilityRole="button"
        accessibilityLabel={`Achievement unlocked: ${badge.name}. Tap to view.`}
      >
        <BadgeMedallion
          category={badge.category}
          tier={badge.tier}
          badgeId={badge.id}
          size={44}
        />
        <View style={styles.text}>
          <Text style={[styles.kicker, { color: accent }]} numberOfLines={1}>
            Achievement unlocked
            {badges.length > 1 ? `  ·  ${index + 1}/${badges.length}` : ''}
          </Text>
          <Text style={[styles.name, { color: C.text }]} numberOfLines={1}>
            {badge.name}
          </Text>
          <Text style={[styles.meta, { color: C.textSecondary }]} numberOfLines={1}>
            {BADGE_TIER_LABELS[badge.tier]} · Tap to view
          </Text>
        </View>
        <Pressable
          onPress={leave}
          hitSlop={12}
          style={styles.close}
          testID="achievement-banner-dismiss"
          accessibilityLabel="Dismiss"
        >
          <Ionicons name="close" size={18} color={C.textTertiary} />
        </Pressable>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 90,
    paddingHorizontal: 14,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 18,
    borderWidth: 1.5,
    paddingVertical: 10,
    paddingLeft: 12,
    paddingRight: 8,
  },
  text: { flex: 1, gap: 1 },
  kicker: {
    fontSize: 10.5,
    fontFamily: 'Inter_700Bold',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  name: { fontSize: 15.5, fontFamily: 'Inter_700Bold' },
  meta: { fontSize: 11.5, fontFamily: 'Inter_400Regular' },
  close: { padding: 6 },
});
