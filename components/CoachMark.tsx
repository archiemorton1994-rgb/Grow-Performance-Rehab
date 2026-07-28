import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  PanResponder,
} from 'react-native';
import Animated, {
  FadeInDown,
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withSequence,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/constants/colors';
import { shadowStyle } from '@/constants/shadows';

const ARROW_H = 10;
const ARROW_W = 9;
const CARD_MARGIN = 16;

export type SpotlightRect = {
  top: number;
  left: number;
  width: number;
  height: number;
  borderRadius?: number;
};

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
  /** Absolute screen-space X for a down-pointing arrow at a measured target
   *  below the card (e.g. a pinned bottom bar). Takes precedence over
   *  tabArrowFraction when provided — prefer this for any target whose
   *  position isn't a fixed fraction of screen width. */
  downArrowScreenX?: number;
  /** Absolute screen-space X (same coordinate space as spotlightRect / measureInWindow)
   *  to point the up-arrow at — e.g. the measured center of a specific button.
   *  Takes precedence over upArrowFraction when provided. */
  upArrowScreenX?: number;
  /** Horizontal position (0–1) for up-pointing element anchor arrow. Fallback for
   *  callers that don't have a specific measured target — prefer upArrowScreenX. */
  upArrowFraction?: number;
  iconName?: string;
  iconLabel?: string;
  /** When provided, renders a spotlight (dim overlay) around the described rect. */
  spotlightRect?: SpotlightRect;
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
  downArrowScreenX,
  upArrowScreenX,
  upArrowFraction,
  iconName,
  iconLabel,
  spotlightRect,
}: CoachMarkProps) {
  const C = useColors();
  const { width: SCREEN_WIDTH } = useWindowDimensions();
  const CARD_W = SCREEN_WIDTH - CARD_MARGIN * 2;

  // ── Spotlight dim + pulse animation ──────────────────────────────────────
  // Hooks must be called unconditionally (before any early return).
  const dimOpacity = useSharedValue(0);
  const pulseOpacity = useSharedValue(0);

  useEffect(() => {
    if (visible && spotlightRect) {
      dimOpacity.value = withTiming(0.82, { duration: 220 });
      // Pulse: fade in/out repeatedly to draw attention to the tab icon area
      pulseOpacity.value = withRepeat(
        withSequence(withTiming(0.35, { duration: 500 }), withTiming(0.05, { duration: 500 })),
        -1,
        false
      );
    } else {
      dimOpacity.value = withTiming(0, { duration: 150 });
      pulseOpacity.value = withTiming(0, { duration: 150 });
    }
  }, [visible, spotlightRect?.left, spotlightRect?.top, spotlightRect?.width, spotlightRect?.height]); // eslint-disable-line react-hooks/exhaustive-deps

  const dimStyle = useAnimatedStyle(() => ({ opacity: dimOpacity.value }));
  const pulseStyle = useAnimatedStyle(() => ({ opacity: pulseOpacity.value }));

  // Keep a live ref so the PanResponder (created once via useRef) always calls
  // the latest onSwipeLeft prop rather than the stale initial closure value.
  const onSwipeLeftRef = useRef(onSwipeLeft);
  onSwipeLeftRef.current = onSwipeLeft;

  const panRef = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, { dx, dy }) =>
        Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 10,
      onPanResponderRelease: (_, { dx }) => {
        if (dx < -40) onSwipeLeftRef.current?.();
      },
    })
  );

  if (!visible) return null;

  const ctaLabel = nextLabel ?? (step >= total ? "Let's go!" : 'Next →');

  // Down arrow (tab tour / any target below the card) — positioned in the
  // overlay between card and target. Prefer a real measured screen position
  // (downArrowScreenX) over a guessed fraction-of-screen-width, same reasoning
  // as the up arrow above.
  const hasDownArrow = downArrowScreenX !== undefined || tabArrowFraction !== undefined;
  const rawDownArrowLeft =
    downArrowScreenX !== undefined
      ? downArrowScreenX - ARROW_W
      : tabArrowFraction !== undefined
        ? tabArrowFraction * SCREEN_WIDTH - ARROW_W
        : 0;
  const downArrowLeft = hasDownArrow
    ? Math.max(CARD_MARGIN, Math.min(SCREEN_WIDTH - CARD_MARGIN - ARROW_W * 2, rawDownArrowLeft))
    : 0;

  // Up arrow (readiness/session) — appears at the top edge of the card positioner.
  // Prefer a real measured screen position (upArrowScreenX) over a guessed
  // fraction-of-card-width — the target's actual layout doesn't scale
  // proportionally with screen width the way a fraction assumes it does.
  const hasUpArrow = upArrowScreenX !== undefined || upArrowFraction !== undefined;
  const rawUpArrowLeft =
    upArrowScreenX !== undefined
      ? upArrowScreenX - CARD_MARGIN - ARROW_W
      : upArrowFraction !== undefined
        ? upArrowFraction * CARD_W - ARROW_W
        : 0;
  const upArrowLeft = hasUpArrow
    ? Math.max(0, Math.min(CARD_W - ARROW_W * 2, rawUpArrowLeft))
    : 0;

  const sr = spotlightRect;
  const sr_r = sr ? (sr.borderRadius ?? 12) : 12;

  return (
    // Outer overlay: absoluteFill, pointerEvents 'box-none' in style so touches
    // pass through the transparent area; only the card itself captures input.
    <View style={[StyleSheet.absoluteFill, styles.overlay]}>
      {/* ── Spotlight: 4 dark strips framing the cut-out window ────────── */}
      {sr && (
        <>
          {/* Top strip — covers screen above the element */}
          <Animated.View
            style={[styles.dimStrip, { top: 0, left: 0, right: 0, height: sr.top }, dimStyle]}
            pointerEvents="none"
          />
          {/* Bottom strip — covers screen below the element */}
          <Animated.View
            style={[
              styles.dimStrip,
              { top: sr.top + sr.height, left: 0, right: 0, bottom: 0 },
              dimStyle,
            ]}
            pointerEvents="none"
          />
          {/* Left strip — covers left of the element (same row height) */}
          <Animated.View
            style={[
              styles.dimStrip,
              { top: sr.top, left: 0, width: sr.left, height: sr.height },
              dimStyle,
            ]}
            pointerEvents="none"
          />
          {/* Right strip — covers right of the element (same row height) */}
          <Animated.View
            style={[
              styles.dimStrip,
              {
                top: sr.top,
                left: sr.left + sr.width,
                right: 0,
                height: sr.height,
              },
              dimStyle,
            ]}
            pointerEvents="none"
          />

          {/* Pulse highlight — soft flashing fill on the tab icon area, no box */}
          <Animated.View
            pointerEvents="none"
            style={[
              {
                position: 'absolute',
                top: sr.top,
                left: sr.left,
                width: sr.width,
                height: sr.height,
                borderRadius: sr_r,
                backgroundColor: '#ffffff',
              },
              pulseStyle,
            ]}
          />
        </>
      )}

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
              },
            ]}
          />
        </>
      )}

      {/* Card positioner — pointerEvents 'box-none' so the gap above the card
          passes touches through to the screen content beneath. */}
      <View style={[styles.positioner, { bottom: bottomOffset, pointerEvents: 'box-none' }]}>
        {/* Up-pointing arrow at the top of the positioner — visually anchors the
            card to the specific UI element being explained (readiness / session).
            pointerEvents: 'none' is in the style (not the deprecated prop) so it
            works correctly on iOS with RN 0.71+. */}
        {hasUpArrow && (
          <View style={styles.upArrowRow}>
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

        {/* Card — captures all touches for Next / Skip buttons and swipe gesture */}
        <Animated.View
          key={`coach-${step}`}
          entering={FadeInDown.duration(260)}
          style={[styles.card, { backgroundColor: C.surface, borderColor: C.border }]}
          {...panRef.current.panHandlers}
        >
          {/* Header row: icon badge + step dots + label */}
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
  // Dark strip — one of four that form the spotlight dim overlay.
  // backgroundColor is solid black; opacity is animated on each strip.
  dimStrip: {
    position: 'absolute',
    backgroundColor: '#000',
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
    ...shadowStyle('#000', 0.07, 12, -2, 8),
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
  // pointerEvents: 'none' keeps this decorative element invisible to touch.
  arrowDown: {
    position: 'absolute',
    width: 0,
    height: 0,
    borderLeftWidth: ARROW_W,
    borderRightWidth: ARROW_W,
    borderTopWidth: ARROW_H,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    pointerEvents: 'none',
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
    pointerEvents: 'none',
  },
  // Up-pointing arrow (readiness / session) — sits at top of card positioner.
  // pointerEvents: 'none' is in style (not the deprecated prop API) for iOS compat.
  upArrowRow: {
    flexDirection: 'row',
    height: ARROW_H,
    overflow: 'visible',
    pointerEvents: 'none',
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
