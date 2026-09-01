/**
 * THE MARK ON "LET US BUILD YOUR PROGRAMME": a plan being drawn.
 *
 * WHAT IT REPLACED, AND WHY THAT WAS WRONG
 * ────────────────────────────────────────
 * A leaf. The brand mark, dropped in as a placeholder on the one screen whose
 * whole job is to say what is about to happen. Archie's words: "why is it even
 * a leaf". A logo says who we are; this screen has to say what we are doing,
 * and those are different sentences.
 *
 * WHAT IT IS INSTEAD
 * ──────────────────
 * The tree the next screen actually draws. A spine with three stops and a fork
 * on it, and the page it all arrives at - which is the profile builder, the
 * branch it takes when something is sore, and the programme it hands over at
 * the end. It draws itself in that order, so the animation is the process
 * rather than decoration laid over it.
 *
 * PLAIN VIEWS, NOT SVG, AND THAT WAS LEARNED BY PHOTOGRAPHING IT. The first
 * version animated react-native-svg's Line and Circle through useAnimatedProps.
 * On the exported web build it came out as one faint stroke: the props never
 * drove. useAnimatedStyle on a View is what the rest of this app animates with,
 * it works everywhere, and a line, a dot and a card are three rectangles -
 * there was nothing SVG was buying.
 *
 * MOTION IS OPTIONAL AND THE COMPOSITION IS NOT. With reduced motion on, every
 * part is drawn at rest: no fade, no stagger, nothing missing.
 */
import React, { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useColors } from '@/constants/colors';
import { useReducedMotion } from '@/lib/use-reduced-motion';

export interface ProgrammeBuildMarkProps {
  size?: number;
}

/** A part's own 0-to-1, from `at` over `span` of the shared clock. */
const slice = (now: number, at: number, span: number) => {
  'worklet';
  const v = (now - at) / span;
  return v < 0 ? 0 : v > 1 ? 1 : v;
};

export function ProgrammeBuildMark({ size = 124 }: ProgrammeBuildMarkProps) {
  const C = useColors();
  const reduceMotion = useReducedMotion();

  // One clock. Every part reads its own slice of it, so the sequence cannot
  // drift apart the way five independent timers would.
  const t = useSharedValue(reduceMotion ? 1 : 0);
  useEffect(() => {
    if (reduceMotion) {
      t.value = 1;
      return;
    }
    t.value = 0;
    t.value = withTiming(1, { duration: 1400, easing: Easing.out(Easing.cubic) });
  }, [reduceMotion, t]);

  // Authored against a 100-unit box and scaled, so one number changes the size.
  const u = size / 100;
  const spineX = 30 * u;
  const stops = [18, 36, 54].map((y) => y * u);
  const forkY = stops[2] - 13 * u;
  const bar = Math.max(2, 2.4 * u);

  const spine = useAnimatedStyle(() => ({ transform: [{ scaleY: slice(t.value, 0, 0.45) }] }));
  const branch = useAnimatedStyle(() => ({ transform: [{ scaleX: slice(t.value, 0.4, 0.22) }] }));
  const dot0 = useAnimatedStyle(() => {
    const v = slice(t.value, 0.1, 0.16);
    return { opacity: v, transform: [{ scale: 0.4 + v * 0.6 }] };
  });
  const dot1 = useAnimatedStyle(() => {
    const v = slice(t.value, 0.26, 0.16);
    return { opacity: v, transform: [{ scale: 0.4 + v * 0.6 }] };
  });
  const dot2 = useAnimatedStyle(() => {
    const v = slice(t.value, 0.42, 0.16);
    return { opacity: v, transform: [{ scale: 0.4 + v * 0.6 }] };
  });
  const forkDot = useAnimatedStyle(() => {
    const v = slice(t.value, 0.56, 0.16);
    return { opacity: v, transform: [{ scale: 0.4 + v * 0.6 }] };
  });
  const page = useAnimatedStyle(() => {
    const v = slice(t.value, 0.62, 0.38);
    return { opacity: v, transform: [{ scale: 0.85 + v * 0.15 }] };
  });

  const dotAt = (x: number, y: number) => ({
    position: 'absolute' as const,
    left: x - 4 * u,
    top: y - 4 * u,
    width: 8 * u,
    height: 8 * u,
    borderRadius: 4 * u,
    backgroundColor: C.primaryText,
  });

  const rule = (w: string) => ({
    height: Math.max(2, 2.2 * u),
    width: w as any,
    borderRadius: 99,
    backgroundColor: C.primaryText,
  });

  return (
    <View style={{ width: size, height: size }} testID="programme-build-mark">
      {/* The spine, growing downward. transformOrigin is unreliable across
          platforms, so the scale is anchored by a top-aligned wrapper instead. */}
      <View
        style={{
          position: 'absolute',
          left: spineX - bar / 2,
          top: 10 * u,
          width: bar,
          height: 48 * u,
          justifyContent: 'flex-start',
        }}
      >
        <Animated.View
          style={[
            { width: '100%', height: '100%', borderRadius: 99, backgroundColor: C.textTertiary },
            spine,
          ]}
        />
      </View>

      {/* The elbow the fork leaves on, drawn at rest: it is a corner, and
          animating a corner draws the eye to the join rather than the branch. */}
      <View
        style={{
          position: 'absolute',
          left: spineX - bar / 2,
          top: forkY,
          width: bar,
          height: 13 * u,
          borderRadius: 99,
          backgroundColor: C.textTertiary,
        }}
      />
      {/* And the fork itself. The whole reason the builder is a tree: most
          journeys run straight down, and one answer opens this. */}
      <View
        style={{
          position: 'absolute',
          left: spineX,
          top: forkY - bar / 2,
          width: 26 * u,
          height: bar,
          alignItems: 'flex-start',
        }}
      >
        <Animated.View
          style={[
            { width: '100%', height: '100%', borderRadius: 99, backgroundColor: C.textTertiary },
            branch,
          ]}
        />
      </View>

      <Animated.View style={[dotAt(spineX, stops[0]), dot0]} />
      <Animated.View style={[dotAt(spineX, stops[1]), dot1]} />
      <Animated.View style={[dotAt(spineX, stops[2]), dot2]} />
      <Animated.View style={[dotAt(spineX + 26 * u, forkY), forkDot]} />

      {/* The page it arrives at, in the app's own card treatment. */}
      <Animated.View
        style={[
          {
            position: 'absolute',
            left: 26 * u,
            top: 64 * u,
            width: 52 * u,
            height: 30 * u,
            borderRadius: 6 * u,
            backgroundColor: C.primarySurface,
            borderWidth: Math.max(1, 1.6 * u),
            borderColor: C.primaryText,
            paddingHorizontal: 7 * u,
            paddingTop: 6 * u,
            gap: 4 * u,
          },
          page,
        ]}
      >
        <View style={rule('70%')} />
        <View style={[rule('92%'), { opacity: 0.45 }]} />
        <View style={[rule('55%'), { opacity: 0.45 }]} />
      </Animated.View>
    </View>
  );
}
