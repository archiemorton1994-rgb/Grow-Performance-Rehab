import React, { useEffect } from 'react';
import { View, Text, Pressable, StyleSheet, Platform } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useColors } from '@/constants/colors';
import { shadowStyle } from '@/constants/shadows';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface BadgeUnlockToastProps {
  name: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  color: string;
  onDismiss: () => void;
}

const SHOW_DURATION_MS = 2500;
const SLIDE_DURATION = 280;
const ABOVE_SCREEN = -120;

export default function BadgeUnlockToast({ name, icon, color, onDismiss }: BadgeUnlockToastProps) {
  const C = useColors();
  const insets = useSafeAreaInsets();
  const translateY = useSharedValue(ABOVE_SCREEN);
  const opacity = useSharedValue(0);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }));

  useEffect(() => {
    translateY.value = withTiming(0, { duration: SLIDE_DURATION });
    opacity.value = withTiming(1, { duration: SLIDE_DURATION });

    const dismissTimer = setTimeout(() => {
      translateY.value = withTiming(ABOVE_SCREEN, { duration: SLIDE_DURATION });
      opacity.value = withTiming(0, { duration: SLIDE_DURATION });
      setTimeout(onDismiss, SLIDE_DURATION);
    }, SHOW_DURATION_MS);

    return () => clearTimeout(dismissTimer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const slideOut = (duration: number = 200) => {
    translateY.value = withTiming(ABOVE_SCREEN, { duration });
    opacity.value = withTiming(0, { duration });
  };

  const handleNavigate = () => {
    slideOut();
    setTimeout(() => {
      onDismiss();
      router.push('/achievements');
    }, 200);
  };

  const handleClose = () => {
    slideOut();
    setTimeout(onDismiss, 200);
  };

  const topOffset = Platform.OS === 'web' ? 67 + 12 : insets.top + 12;

  return (
    <Animated.View style={[styles.container, { top: topOffset }, animStyle]}>
      <Pressable
        onPress={handleNavigate}
        style={({ pressed }) => [
          styles.toast,
          { backgroundColor: C.surface, borderColor: C.borderLight },
          pressed && { opacity: 0.9 },
        ]}
      >
        <View style={[styles.iconWrap, { backgroundColor: color + '22' }]}>
          <Ionicons name={icon} size={22} color={color} />
        </View>
        <View style={styles.textWrap}>
          <Text style={[styles.headline, { color: C.text }]}>Achievement Unlocked!</Text>
          <Text style={[styles.badgeName, { color: C.textSecondary }]} numberOfLines={1}>
            {name}
          </Text>
        </View>
        <Pressable onPress={handleClose} hitSlop={8} style={styles.closeBtn}>
          <Ionicons name="close" size={16} color={C.textTertiary} />
        </Pressable>
      </Pressable>
    </Animated.View>
  );
}

export interface BadgeSummaryToastProps {
  count: number;
  onDismiss: () => void;
}

/**
 * Shown when 2+ badges are unlocked in the same evaluation round.
 * Replaces the individual-badge queue with a single "N Badges Unlocked" moment.
 */
export function BadgeSummaryToast({ count, onDismiss }: BadgeSummaryToastProps) {
  const C = useColors();
  const insets = useSafeAreaInsets();
  const translateY = useSharedValue(ABOVE_SCREEN);
  const opacity = useSharedValue(0);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }));

  useEffect(() => {
    translateY.value = withTiming(0, { duration: SLIDE_DURATION });
    opacity.value = withTiming(1, { duration: SLIDE_DURATION });

    const dismissTimer = setTimeout(() => {
      translateY.value = withTiming(ABOVE_SCREEN, { duration: SLIDE_DURATION });
      opacity.value = withTiming(0, { duration: SLIDE_DURATION });
      setTimeout(onDismiss, SLIDE_DURATION);
    }, SHOW_DURATION_MS);

    return () => clearTimeout(dismissTimer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const slideOut = (duration: number = 200) => {
    translateY.value = withTiming(ABOVE_SCREEN, { duration });
    opacity.value = withTiming(0, { duration });
  };

  const handleNavigate = () => {
    slideOut();
    setTimeout(() => {
      onDismiss();
      router.push('/achievements');
    }, 200);
  };

  const handleClose = () => {
    slideOut();
    setTimeout(onDismiss, 200);
  };

  const topOffset = Platform.OS === 'web' ? 67 + 12 : insets.top + 12;

  return (
    <Animated.View style={[styles.container, { top: topOffset }, animStyle]}>
      <Pressable
        onPress={handleNavigate}
        style={({ pressed }) => [
          styles.toast,
          { backgroundColor: C.surface, borderColor: C.borderLight },
          pressed && { opacity: 0.9 },
        ]}
      >
        <View style={[styles.iconWrap, { backgroundColor: C.primary + '22' }]}>
          <Ionicons name="trophy" size={22} color={C.primary} />
        </View>
        <View style={styles.textWrap}>
          <Text style={[styles.headline, { color: C.text }]}>{count} Achievements Unlocked!</Text>
          <Text style={[styles.badgeName, { color: C.textSecondary }]}>
            Tap to view your achievements
          </Text>
        </View>
        <Pressable onPress={handleClose} hitSlop={8} style={styles.closeBtn}>
          <Ionicons name="close" size={16} color={C.textTertiary} />
        </Pressable>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 9999,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    ...shadowStyle('#000', 0.12, 12, 4, 8),
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  textWrap: {
    flex: 1,
  },
  headline: {
    fontSize: 14,
    fontFamily: 'Inter_700Bold',
  },
  badgeName: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    marginTop: 1,
  },
  closeBtn: {
    padding: 4,
  },
});
