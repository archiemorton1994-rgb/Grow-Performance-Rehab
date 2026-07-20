import React, { useEffect } from 'react';
import { View, Text, Pressable, StyleSheet, Modal } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { ACHIEVEMENT_GOLD, useColors } from '@/constants/colors';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const ENTER_MS = 300;
const EXIT_MS = 210;
const SLIDE_START = 460;

interface AchievementUnlockedSheetProps {
  badgeCount: number;
  badgeName?: string;
  badgeIcon?: string;
  badgeColor?: string;
  onDismiss: () => void;
}

export default function AchievementUnlockedSheet({
  badgeCount,
  badgeName,
  badgeIcon,
  badgeColor,
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

  useEffect(() => {
    backdropOpacity.value = withTiming(1, { duration: ENTER_MS });
    translateY.value = withSpring(0, { damping: 22, stiffness: 200 });
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
  const accent = isSingle ? (badgeColor ?? C.primary) : ACHIEVEMENT_GOLD;
  const iconName = isSingle ? (badgeIcon ?? 'trophy') : 'trophy';
  const title = isSingle ? 'Achievement Unlocked!' : `${badgeCount} Achievements Unlocked!`;
  const subtitle = isSingle && badgeName ? badgeName : 'Tap to view your new badges';

  return (
    <Modal visible transparent animationType="none" onRequestClose={dismiss}>
      {/* Animated backdrop — visual only, no touch handling */}
      <Animated.View
        style={[StyleSheet.absoluteFill, styles.backdrop, backdropStyle]}
        pointerEvents="none"
      />

      {/* Outer Pressable: tap outside sheet to dismiss */}
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
              <Ionicons name={iconName as any} size={40} color={accent} />
            </View>

            {/* Heading */}
            <Text style={[styles.title, { color: C.text }]}>{title}</Text>
            <Text style={[styles.subtitle, { color: C.textSecondary }]} numberOfLines={2}>
              {subtitle}
            </Text>

            {/* Primary CTA */}
            <Pressable
              onPress={handleViewBadges}
              style={({ pressed }) => [
                styles.primaryBtn,
                { backgroundColor: C.primary, shadowColor: C.primary },
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 16,
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
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.28,
    shadowRadius: 8,
    elevation: 5,
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
});
