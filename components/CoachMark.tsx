import React from 'react';
import { View, Text, Pressable, StyleSheet, Dimensions } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/constants/colors';

const SCREEN_WIDTH = Dimensions.get('window').width;
const ARROW_H = 10;
const ARROW_W = 9;

interface CoachMarkProps {
  visible: boolean;
  title: string;
  body: string;
  step: number;
  total: number;
  nextLabel?: string;
  skipLabel?: string;
  onNext: () => void;
  onSkip: () => void;
  bottomOffset?: number;
  tabArrowFraction?: number;
  iconName?: string;
  iconLabel?: string;
}

export default function CoachMark({
  visible,
  title,
  body,
  step,
  total,
  nextLabel,
  skipLabel = 'Skip all',
  onNext,
  onSkip,
  bottomOffset = 0,
  tabArrowFraction,
  iconName,
  iconLabel,
}: CoachMarkProps) {
  const C = useColors();
  if (!visible) return null;

  const ctaLabel = nextLabel ?? (step >= total ? "Let's go!" : 'Next →');
  const hasArrow = tabArrowFraction !== undefined;
  const tabCenterX = hasArrow ? tabArrowFraction * SCREEN_WIDTH : SCREEN_WIDTH / 2;
  const arrowLeft = Math.max(16, Math.min(SCREEN_WIDTH - 16 - ARROW_W * 2, tabCenterX - ARROW_W));

  return (
    <View style={[StyleSheet.absoluteFill, styles.overlay]}>
      {/* Down-pointing arrow between card and tab bar */}
      {hasArrow && (
        <>
          <View
            style={[
              styles.arrowOuter,
              {
                bottom: bottomOffset - ARROW_H,
                left: arrowLeft,
                borderTopColor: C.border,
                pointerEvents: 'none',
              },
            ]}
          />
          <View
            style={[
              styles.arrowInner,
              {
                bottom: bottomOffset - ARROW_H + 1,
                left: arrowLeft + 1,
                borderTopColor: C.surface,
                pointerEvents: 'none',
              },
            ]}
          />
        </>
      )}

      {/* Card */}
      <View style={[styles.positioner, { bottom: bottomOffset, pointerEvents: 'box-none' }]}>
        <Animated.View
          key={`coach-${step}`}
          entering={FadeInDown.duration(260)}
          style={[styles.card, { backgroundColor: C.surface, borderColor: C.border }]}
        >
          {/* Header row: icon badge + step dots */}
          <View style={styles.headerRow}>
            {iconName ? (
              <View style={[styles.iconBadge, { backgroundColor: C.primarySurface }]}>
                <Ionicons name={iconName as any} size={16} color={C.primary} />
              </View>
            ) : null}
            <View style={styles.dotsRow}>
              {Array.from({ length: total }).map((_, i) => (
                <View
                  key={i}
                  style={[
                    styles.dot,
                    {
                      backgroundColor: i + 1 === step ? C.primary : C.surfaceTertiary,
                      width: i + 1 === step ? 20 : 6,
                    },
                  ]}
                />
              ))}
            </View>
            {iconLabel ? (
              <Text style={[styles.iconLabel, { color: C.textTertiary }]}>{iconLabel}</Text>
            ) : null}
          </View>

          <Text style={[styles.title, { color: C.text }]}>{title}</Text>
          <Text style={[styles.body, { color: C.textSecondary }]}>{body}</Text>

          <View style={styles.actions}>
            <Pressable onPress={onSkip} hitSlop={12}>
              <Text style={[styles.skipText, { color: C.textTertiary }]}>{skipLabel}</Text>
            </Pressable>
            <Pressable
              onPress={onNext}
              style={({ pressed }) => [
                styles.nextBtn,
                { backgroundColor: C.primary },
                pressed && { opacity: 0.85 },
              ]}
            >
              <Text style={[styles.nextText, { color: C.textInverse }]}>{ctaLabel}</Text>
            </Pressable>
          </View>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    zIndex: 200,
  },
  positioner: {
    position: 'absolute',
    left: 0,
    right: 0,
    paddingHorizontal: 16,
  },
  card: {
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 16,
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.07,
    shadowRadius: 12,
    elevation: 8,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconBadge: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  dot: {
    height: 6,
    borderRadius: 3,
  },
  iconLabel: {
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginLeft: 2,
  },
  title: {
    fontSize: 17,
    fontFamily: 'Inter_700Bold',
    lineHeight: 22,
  },
  body: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    lineHeight: 21,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  skipText: {
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
  },
  nextBtn: {
    paddingHorizontal: 22,
    paddingVertical: 11,
    borderRadius: 13,
  },
  nextText: {
    fontSize: 14,
    fontFamily: 'Inter_700Bold',
  },
  arrowOuter: {
    position: 'absolute',
    width: 0,
    height: 0,
    borderLeftWidth: ARROW_W,
    borderRightWidth: ARROW_W,
    borderTopWidth: ARROW_H,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
  arrowInner: {
    position: 'absolute',
    width: 0,
    height: 0,
    borderLeftWidth: ARROW_W - 1,
    borderRightWidth: ARROW_W - 1,
    borderTopWidth: ARROW_H - 1,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
});
