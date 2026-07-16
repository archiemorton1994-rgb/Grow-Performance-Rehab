import React, { useRef } from 'react';
import { View, Text, Pressable, StyleSheet, Dimensions, PanResponder } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/constants/colors';

const SCREEN_WIDTH = Dimensions.get('window').width;
const ARROW_H = 10;
const ARROW_W = 9;
const CARD_MARGIN = 16;
const CARD_W = SCREEN_WIDTH - CARD_MARGIN * 2;

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
  /** Called when user swipes left on the card (tab tour advancement). */
  onSwipeLeft?: () => void;
  /** Pixels from screen bottom to card bottom edge. */
  bottomOffset?: number;
  /** Horizontal position (0–1) for down-pointing tab-bar arrow. */
  tabArrowFraction?: number;
  /** Horizontal position (0–1) for up-pointing element anchor arrow. */
  upArrowFraction?: number;
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
  onSwipeLeft,
  bottomOffset = 0,
  tabArrowFraction,
  upArrowFraction,
  iconName,
  iconLabel,
}: CoachMarkProps) {
  const C = useColors();

  // Swipe-left to advance (tab tour and any caller that passes onSwipeLeft).
  const panRef = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, { dx, dy }) =>
        Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 10,
      onPanResponderRelease: (_, { dx }) => {
        if (dx < -40) onSwipeLeft?.();
      },
    })
  );

  if (!visible) return null;

  const ctaLabel = nextLabel ?? (step >= total ? "Let's go!" : 'Next →');

  // Down arrow (tab tour) — positioned in the overlay between card and tab bar.
  const hasDownArrow = tabArrowFraction !== undefined;
  const downArrowLeft = hasDownArrow
    ? Math.max(
        CARD_MARGIN,
        Math.min(
          SCREEN_WIDTH - CARD_MARGIN - ARROW_W * 2,
          tabArrowFraction * SCREEN_WIDTH - ARROW_W
        )
      )
    : 0;

  // Up arrow (readiness/session) — appears at the top edge of the card positioner.
  const hasUpArrow = upArrowFraction !== undefined;
  const upArrowLeft = hasUpArrow
    ? Math.max(0, Math.min(CARD_W - ARROW_W * 2, upArrowFraction * CARD_W - ARROW_W))
    : 0;

  return (
    // Outer overlay: absoluteFill, pointerEvents box-none so touches pass
    // through the transparent area; only the card itself captures input.
    <View style={[StyleSheet.absoluteFill, styles.overlay]}>
      {/* Down-pointing arrow — between card bottom and tab bar */}
      {hasDownArrow && (
        <>
          <View
            style={[
              styles.arrowDown,
              {
                bottom: bottomOffset - ARROW_H,
                left: downArrowLeft,
                borderTopColor: C.border,
                pointerEvents: 'none',
              },
            ]}
          />
          <View
            style={[
              styles.arrowDownInner,
              {
                bottom: bottomOffset - ARROW_H + 1,
                left: downArrowLeft + 1,
                borderTopColor: C.surface,
                pointerEvents: 'none',
              },
            ]}
          />
        </>
      )}

      {/* Card positioner — pointerEvents box-none so the transparent gap above
          the card is still interactive for the session / readiness screens. */}
      <View style={[styles.positioner, { bottom: bottomOffset, pointerEvents: 'box-none' }]}>
        {/* Up-pointing arrow at the top of the positioner, anchors card to
            a specific UI element above (readiness / session steps). */}
        {hasUpArrow && (
          <View style={styles.upArrowRow} pointerEvents="none">
            <View style={{ width: upArrowLeft }} />
            <View style={[styles.arrowUp, { borderBottomColor: C.border }]} />
            <View
              style={[
                styles.arrowUpInner,
                { position: 'absolute', left: upArrowLeft + 1, borderBottomColor: C.surface },
              ]}
            />
          </View>
        )}

        {/* Card — captures all touches */}
        <Animated.View
          key={`coach-${step}`}
          entering={FadeInDown.duration(260)}
          style={[styles.card, { backgroundColor: C.surface, borderColor: C.border }]}
          {...panRef.current.panHandlers}
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
    pointerEvents: 'box-none',
  },
  positioner: {
    position: 'absolute',
    left: 0,
    right: 0,
    paddingHorizontal: CARD_MARGIN,
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
  // Down-pointing arrow (tab tour) — sits between card and tab bar.
  arrowDown: {
    position: 'absolute',
    width: 0,
    height: 0,
    borderLeftWidth: ARROW_W,
    borderRightWidth: ARROW_W,
    borderTopWidth: ARROW_H,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
  arrowDownInner: {
    position: 'absolute',
    width: 0,
    height: 0,
    borderLeftWidth: ARROW_W - 1,
    borderRightWidth: ARROW_W - 1,
    borderTopWidth: ARROW_H - 1,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
  // Up-pointing arrow (readiness / session) — sits at top of card positioner.
  upArrowRow: {
    flexDirection: 'row',
    height: ARROW_H,
    overflow: 'visible',
  },
  arrowUp: {
    width: 0,
    height: 0,
    borderLeftWidth: ARROW_W,
    borderRightWidth: ARROW_W,
    borderBottomWidth: ARROW_H,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
  arrowUpInner: {
    width: 0,
    height: 0,
    top: 1,
    borderLeftWidth: ARROW_W - 1,
    borderRightWidth: ARROW_W - 1,
    borderBottomWidth: ARROW_H - 1,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
});
