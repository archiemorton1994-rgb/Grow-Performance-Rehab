import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Animated, LayoutChangeEvent, StyleSheet, View } from 'react-native';
import { useColors } from '@/constants/colors';

/**
 * A SCROLL BAR THAT IS VISIBLE BEFORE YOU SCROLL.
 *
 * THE PROBLEM
 * ───────────
 * Every one of the app's 23 main vertical scrollers sets
 * showsVerticalScrollIndicator={false}, with no exceptions. That was a
 * deliberate tidiness choice and it costs real information: on the Train tab,
 * Full Body and Conditioning are the last two cards and nothing on the screen
 * says they exist. The user has to guess that dragging is worth trying.
 *
 * The native indicator would not fix it even if it were turned back on. It only
 * appears WHILE you scroll, so it answers "how far through am I" and never "is
 * there more". Those are different questions and only the second one matters
 * here. On iOS it also cannot be tinted; indicatorStyle takes black, white or
 * default, so a green one is not available at all.
 *
 * SO THIS IS DRAWN, AND IT IS DRAWN AT REST.
 * It renders nothing at all when the content fits - a bar on a screen with
 * nothing below the fold is noise, and it would appear on the same screen for
 * one user and not another depending on their phone.
 *
 * WHY THE POSITION IS ANIMATED RATHER THAN STATE
 * ──────────────────────────────────────────────
 * onScroll fires at up to 60fps. Putting the offset in React state re-renders
 * the whole screen on every frame of every scroll, which on Home means
 * re-running four derived memos and re-rendering a 2x2 grid of images. The
 * offset goes into an Animated.Value instead, so the thumb moves without the
 * screen re-rendering at all. Only the two heights are state, and they change
 * when the layout does, not when the finger does.
 *
 * It is NOT natively driven, and it cannot be. See the note on useNativeDriver
 * below: the native version of Animated.event returns an object rather than a
 * function, and every screen here hands it to a plain ScrollView.
 */

/** Never smaller than this, or a long list gives you a dot to aim at. */
const MIN_THUMB = 32;
const TRACK_WIDTH = 3;

export interface ScrollIndicatorState {
  viewportHeight: number;
  contentHeight: number;
  scrollY: Animated.Value;
}

export interface UseScrollIndicator {
  /** Spread onto the ScrollView. */
  handlers: {
    onScroll: (e: unknown) => void;
    onLayout: (e: LayoutChangeEvent) => void;
    onContentSizeChange: (w: number, h: number) => void;
    scrollEventThrottle: number;
  };
  state: ScrollIndicatorState;
}

/**
 * Wire a ScrollView up to an indicator.
 *
 *     const scroll = useScrollIndicator();
 *     <ScrollView {...scroll.handlers} ...>
 *     <ScrollIndicator {...scroll.state} top={120} bottom={100} />
 *
 * The indicator is a SIBLING of the ScrollView, not a child: a child would
 * scroll away with the content.
 */
export function useScrollIndicator(): UseScrollIndicator {
  const scrollY = useRef(new Animated.Value(0)).current;
  const [viewportHeight, setViewportHeight] = useState(0);
  const [contentHeight, setContentHeight] = useState(0);

  /**
   * useNativeDriver: FALSE, and it has to be.
   *
   * Animated.event returns an OBJECT when the native driver is on and a
   * FUNCTION when it is off - see AnimatedImplementation.js, which returns
   * `animatedEvent` in the native case and `animatedEvent.__getHandler()`
   * otherwise. Only Animated.createAnimatedComponent knows how to unwrap the
   * object. Every consumer of this hook spreads these handlers onto a plain
   * ScrollView, and profile calls `handlers.onScroll(e)` by hand, so the
   * native version crashed all five screens with "onScroll is not a function
   * (it is Object)" - dozens of red error screens while walking the tour.
   *
   * The offset is now written from JavaScript. The Animated.Value is unchanged,
   * so the thumb still moves without re-rendering the screen; what is lost is
   * that the write is no longer off-thread. That is a real cost and it is a
   * great deal smaller than a crash.
   */
  const onScroll = useMemo(
    () =>
      Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
        useNativeDriver: false,
      }),
    [scrollY]
  );

  const onLayout = useCallback((e: LayoutChangeEvent) => {
    const h = e.nativeEvent.layout.height;
    // Guarded so a re-layout at the same size does not re-render the screen.
    setViewportHeight((prev) => (Math.abs(prev - h) > 1 ? h : prev));
  }, []);

  const onContentSizeChange = useCallback((_w: number, h: number) => {
    setContentHeight((prev) => (Math.abs(prev - h) > 1 ? h : prev));
  }, []);

  return {
    handlers: { onScroll, onLayout, onContentSizeChange, scrollEventThrottle: 16 },
    state: { viewportHeight, contentHeight, scrollY },
  };
}

export interface ScrollIndicatorProps extends ScrollIndicatorState {
  /** Distance from the top of the parent to the top of the track. */
  top?: number;
  /** Distance from the bottom of the parent to the bottom of the track. */
  bottom?: number;
  /** Inset from the right edge. */
  right?: number;
}

function ScrollIndicatorImpl({
  viewportHeight,
  contentHeight,
  scrollY,
  top = 0,
  bottom = 0,
  right = 4,
}: ScrollIndicatorProps) {
  const C = useColors();

  const overflow = contentHeight - viewportHeight;
  // 8px of slack: a screen that is four pixels too tall is not a screen with
  // something below the fold, and a bar that flickers on and off as a card
  // grows by a line is worse than no bar.
  if (viewportHeight <= 0 || contentHeight <= 0 || overflow <= 8) return null;

  const trackHeight = Math.max(0, viewportHeight - top - bottom);
  if (trackHeight < MIN_THUMB * 1.5) return null;

  const thumbHeight = Math.max(
    MIN_THUMB,
    Math.round((viewportHeight / contentHeight) * trackHeight)
  );
  const travel = trackHeight - thumbHeight;

  const translateY = scrollY.interpolate({
    inputRange: [0, overflow],
    outputRange: [0, travel],
    extrapolate: 'clamp',
  });

  return (
    <View
      pointerEvents="none"
      style={[styles.track, { top, bottom, right, backgroundColor: C.borderLight }]}
      testID="scroll-indicator"
    >
      <Animated.View
        style={[
          styles.thumb,
          { height: thumbHeight, backgroundColor: C.primaryText, transform: [{ translateY }] },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    position: 'absolute',
    width: TRACK_WIDTH,
    borderRadius: TRACK_WIDTH / 2,
    overflow: 'hidden',
  },
  thumb: {
    width: TRACK_WIDTH,
    borderRadius: TRACK_WIDTH / 2,
  },
});

export const ScrollIndicator = React.memo(ScrollIndicatorImpl);
