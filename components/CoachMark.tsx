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
import { elevatedShadow } from '@/constants/shadows';
import { autoRadius } from '@/lib/spotlight-shape';

const CARD_MARGIN = 16;
// Gap kept between the card and the spotlighted target, whichever side it lands on.
const SPOTLIGHT_GAP = 20;
// Minimum clearance from the top of the screen when the card flips above the target.
const SAFE_TOP = 56;
// Generous upper-bound estimate of the card's rendered height (icon row + title +
// up to ~3 lines of body + actions + padding). Used only to decide which side of
// the target has room, not to actually size anything, so overestimating is safe.
const ESTIMATED_CARD_HEIGHT = 280;

// Fixed brand palette for the coach-mark card itself - deliberately NOT theme-
// driven (no useColors()). A white/surface card reads as a generic system
// tooltip and clashes hard with the light theme; a solid green/lime treatment
// reads as "Grow" in both themes and stays legible over the dimmed backdrop.
const COACH = {
  bg: '#2f6b46',
  border: '#1e4a30',
  text: '#ffffff',
  textSecondary: '#dcefe2',
  textTertiary: '#a8cdb6',
  iconBadgeBg: 'rgba(255,255,255,0.16)',
  dotInactive: 'rgba(255,255,255,0.28)',
  accent: '#4ade80',
  accentText: '#0f2818',
};

export type SpotlightRect = {
  top: number;
  left: number;
  width: number;
  height: number;
  /** Override the shape. Omit and the spotlight takes it from the rect — see autoRadius. */
  borderRadius?: number;
};

// The spotlight's corner radius is derived in lib/spotlight-shape.ts, not here:
// this file imports react-native, so anything defined in it can be read by a
// test but never called by one. Re-exported so callers that already import from
// CoachMark do not need to know that.
export { autoRadius };

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
  /**
   * Go back one card, or to the last card of the previous tab.
   *
   * OPTIONAL, and absent means "there is nowhere to go back to" - the control
   * is not rendered at all rather than rendered disabled. That is the state of
   * the very first card of the tour, and of the practice session's tutorial,
   * which Profile launches with a one-way navigation.
   */
  onPrev?: () => void;
  /**
   * A card is swipeable, left to go on and right to go back.
   *
   * There used to be an onSwipeLeft prop here with a complete PanResponder
   * behind it, and no caller ever passed it - so the gesture was captured and
   * thrown away for as long as the tour has existed. The responder claimed
   * horizontal drags in both directions and acted on neither.
   *
   * The card already holds onNext and onPrev, so the gesture uses those
   * directly rather than threading a duplicate callback through five callers to
   * reach the function sitting beside it. Right-swipe does nothing on the first
   * card, for the same reason the Back control is not drawn there.
   */
  /** Pixels from screen bottom to card bottom edge when the card sits below the
   *  spotlighted target (the common case). When the target sits too low on
   *  screen for that to fit without covering it, the card automatically flips
   *  to sit above the target instead — see the cardAbove logic below. */
  bottomOffset?: number;
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
  onPrev,
  bottomOffset = 0,
  iconName,
  iconLabel,
  spotlightRect,
}: CoachMarkProps) {
  const { height: SCREEN_HEIGHT } = useWindowDimensions();

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

  // Live refs, so the PanResponder (created once via useRef) always calls the
  // current handlers rather than the closure it was born with.
  const onNextRef = useRef(onNext);
  onNextRef.current = onNext;
  const onPrevRef = useRef(onPrev);
  onPrevRef.current = onPrev;

  const panRef = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, { dx, dy }) =>
        Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 10,
      onPanResponderRelease: (_, { dx }) => {
        if (dx < -40) onNextRef.current?.();
        else if (dx > 40) onPrevRef.current?.();
      },
    })
  );

  if (!visible) return null;

  const ctaLabel = nextLabel ?? (step >= total ? "Let's go!" : 'Next →');

  const sr = spotlightRect;
  const sr_r = sr ? (sr.borderRadius ?? autoRadius(sr.width, sr.height)) : 12;

  // Decide which side of the target the card renders on. Default is below
  // (anchored bottomOffset from the screen bottom, as before) — but when the
  // target sits low enough on screen that the card would land on top of it,
  // flip above instead, as long as there's actually more room up there. This
  // replaces the old fixed-position card with one that moves out of the way
  // of whatever it's currently describing.
  const spaceBelow = sr
    ? SCREEN_HEIGHT - (sr.top + sr.height) - bottomOffset - SPOTLIGHT_GAP
    : Infinity;
  const spaceAbove = sr ? sr.top - SAFE_TOP - SPOTLIGHT_GAP : 0;
  const cardAbove = !!sr && spaceBelow < ESTIMATED_CARD_HEIGHT && spaceAbove > spaceBelow;
  // Clamped to bottomOffset. When a target measures below the fold — a section
  // further down a scroll view that never got scrolled into range — sr.top
  // exceeds SCREEN_HEIGHT and the "above" maths yields a value at or below
  // zero, sliding the card off the bottom of the screen and under the tab bar
  // with its buttons unreachable. Sitting at the normal resting position is
  // always preferable to sitting off-screen: bottomOffset is the caller's
  // measured clearance for the tab bar, so this can never be too low.
  const positionerBottom = cardAbove
    ? Math.max(bottomOffset, SCREEN_HEIGHT - sr!.top + SPOTLIGHT_GAP)
    : bottomOffset;

  return (
    // Outer overlay: absoluteFill, pointerEvents 'box-none' in style so the
    // card (a later, higher-stacked sibling below) still receives its own
    // taps; the blocker directly below is what actually stops everything
    // else from being reachable.
    <View style={[StyleSheet.absoluteFill, styles.overlay]}>
      {/* Full-screen tap blocker - swallows touches anywhere on screen,
          including inside the spotlight cut-out, so the tour is a hard gate:
          nothing underneath (not even the highlighted tab icon itself) is
          reachable until Next/Skip is used. onPress with no handler is
          enough to make it capture rather than pass through. */}
      <Pressable style={StyleSheet.absoluteFill} onPress={() => {}} testID="coachmark-blocker" />

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

      {/* Card positioner — pointerEvents 'box-none' so the gap above the card
          passes touches through to the screen content beneath. Anchored from
          the bottom in both placements: below the target it's bottomOffset
          from the screen bottom as before; above the target its bottom edge
          sits just above the spotlight and the card grows upward from there. */}
      <View
        style={[styles.positioner, { bottom: positionerBottom, pointerEvents: 'box-none' }]}
      >
        {/* Card — captures all touches for Next / Skip buttons and swipe gesture */}
        <Animated.View
          key={`coach-${step}`}
          entering={FadeInDown.duration(260)}
          style={[styles.card, { backgroundColor: COACH.bg, borderColor: COACH.border }]}
          {...panRef.current.panHandlers}
        >
          {/* Header row: icon badge + step dots + label */}
          <View style={styles.headerRow}>
            {iconName ? (
              <View style={[styles.iconBadge, { backgroundColor: COACH.iconBadgeBg }]}>
                <Ionicons name={iconName as any} size={16} color={COACH.text} />
              </View>
            ) : null}
            <View style={styles.dotsRow}>
              {Array.from({ length: total }).map((_, i) => (
                <View
                  key={i}
                  style={[
                    styles.dot,
                    {
                      backgroundColor: i + 1 === step ? COACH.accent : COACH.dotInactive,
                      width: i + 1 === step ? 20 : 6,
                    },
                  ]}
                />
              ))}
            </View>
            {iconLabel ? (
              <Text style={[styles.iconLabel, { color: COACH.textTertiary }]}>{iconLabel}</Text>
            ) : null}
          </View>

          <Text style={[styles.title, { color: COACH.text }]}>{title}</Text>
          <Text style={[styles.body, { color: COACH.textSecondary }]}>{body}</Text>

          {/* Named so the tour can be WALKED, not just read. Every tour claim in
              this app is a claim about a screen, and the only way to check one
              is to advance the cards over the real thing and look. */}
          <View style={styles.actions}>
            <Pressable onPress={onSkip} hitSlop={12} testID="coachmark-skip">
              <Text style={[styles.skipText, { color: COACH.textTertiary }]}>{skipLabel}</Text>
            </Pressable>
            {/* The two controls that move through the tour, together. Back on
                the far left of a three-way space-between would sit in the
                middle of the row and read as the main action. */}
            <View style={styles.navCluster}>
              {onPrev ? (
                <Pressable
                  onPress={onPrev}
                  hitSlop={10}
                  testID="coachmark-prev"
                  accessibilityRole="button"
                  accessibilityLabel="Previous step"
                  style={({ pressed }) => [
                    styles.backBtn,
                    { borderColor: COACH.dotInactive },
                    pressed && { opacity: 0.7 },
                  ]}
                >
                  <Ionicons name="chevron-back" size={15} color={COACH.textSecondary} />
                  <Text style={[styles.backText, { color: COACH.textSecondary }]}>Back</Text>
                </Pressable>
              ) : null}
              <Pressable
                onPress={onNext}
                testID="coachmark-next"
                style={({ pressed }) => [
                  styles.nextBtn,
                  { backgroundColor: COACH.accent },
                  pressed && { opacity: 0.85 },
                ]}
              >
                <Text style={[styles.nextText, { color: COACH.accentText }]}>{ctaLabel}</Text>
              </Pressable>
            </View>
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
    borderWidth: 1.5,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 16,
    gap: 10,
    // A stronger "floating" shadow than a normal content card — this needs to
    // read as a distinct layer above the app, not another card on the page,
    // especially in light mode where it can otherwise blend into a bright
    // spotlit area right next to it.
    ...elevatedShadow('#000'),
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
    fontSize: 15,
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
  navCluster: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  // Outlined rather than filled, and narrower than Next, so the row still has
  // exactly one obvious next thing to press.
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingLeft: 10,
    paddingRight: 13,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  backText: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
  },
  nextBtn: {
    paddingHorizontal: 22,
    paddingVertical: 11,
    borderRadius: 12,
  },
  nextText: {
    fontSize: 15,
    fontFamily: 'Inter_700Bold',
  },
});
