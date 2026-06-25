import React, { useEffect } from 'react';
import { View, Text, Pressable, StyleSheet, Platform } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/constants/colors';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface BadgeUnlockToastProps {
  name: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  color: string;
  onDismiss: () => void;
}

const SHOW_DURATION_MS = 2500;
const SLIDE_DURATION = 280;

export default function BadgeUnlockToast({ name, icon, color, onDismiss }: BadgeUnlockToastProps) {
  const C = useColors();
  const insets = useSafeAreaInsets();
  const translateY = useSharedValue(140);
  const opacity = useSharedValue(0);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }));

  useEffect(() => {
    translateY.value = withTiming(0, { duration: SLIDE_DURATION });
    opacity.value = withTiming(1, { duration: SLIDE_DURATION });

    const dismissTimer = setTimeout(() => {
      translateY.value = withTiming(140, { duration: SLIDE_DURATION });
      opacity.value = withTiming(0, { duration: SLIDE_DURATION });
      setTimeout(onDismiss, SLIDE_DURATION);
    }, SHOW_DURATION_MS);

    return () => clearTimeout(dismissTimer);
  }, []);

  const handleTap = () => {
    translateY.value = withTiming(140, { duration: 200 });
    opacity.value = withTiming(0, { duration: 200 });
    setTimeout(onDismiss, 200);
  };

  const bottomOffset = Platform.OS === 'web'
    ? 90
    : insets.bottom + 80;

  return (
    <Animated.View style={[styles.container, { bottom: bottomOffset }, animStyle]}>
      <Pressable onPress={handleTap} style={[styles.toast, { backgroundColor: C.surface, borderColor: C.borderLight }]}>
        <View style={[styles.iconWrap, { backgroundColor: color + '22' }]}>
          <Ionicons name={icon} size={22} color={color} />
        </View>
        <View style={styles.textWrap}>
          <Text style={[styles.headline, { color: C.text }]}>Badge Unlocked!</Text>
          <Text style={[styles.badgeName, { color: C.textSecondary }]} numberOfLines={1}>{name}</Text>
        </View>
        <Ionicons name="close" size={16} color={C.textTertiary} />
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 8,
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
});
