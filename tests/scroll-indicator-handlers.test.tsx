/**
 * The scroll indicator's handlers must be CALLABLE.
 *
 * WHAT WENT WRONG
 * ───────────────
 * `useScrollIndicator` built its onScroll with
 * `Animated.event(..., { useNativeDriver: true })`. React Native returns two
 * different things from that call, and which one depends on the flag
 * (Libraries/Animated/AnimatedImplementation.js):
 *
 *     const animatedEvent = new AnimatedEvent(argMapping, config);
 *     if (animatedEvent.__isNative) {
 *       return animatedEvent;                  // an OBJECT
 *     } else {
 *       return animatedEvent.__getHandler();   // a FUNCTION
 *     }
 *
 * Only `Animated.createAnimatedComponent` knows how to unwrap the object, by
 * calling `__getHandler()`. All five consumers hand these handlers to a PLAIN
 * ScrollView, and app/(tabs)/profile.tsx calls `handlers.onScroll(e)` itself.
 *
 * So every one of Home, Train, Restore, Profile and Program threw
 * "onScroll is not a function (it is Object)" on the first scroll event. It was
 * reported from a device as dozens of red error screens while walking the tour.
 *
 * WHY THIS IS A RUNTIME TEST AND NOT A GREP
 * ─────────────────────────────────────────
 * A check that the file says `useNativeDriver: false` would pass the day
 * somebody swapped in a different animation library with the same problem. This
 * calls the handler with a real scroll event, which is the thing that has to
 * work, and it fails for any cause.
 */

import React from 'react';
import renderer from 'react-test-renderer';
// act comes from React itself; react-test-renderer stopped re-exporting it.
import { act } from 'react';
import { ScrollView, View } from 'react-native';
import { useScrollIndicator } from '../components/ScrollIndicator';

describe('useScrollIndicator handlers', () => {
  /** Renders the hook and hands its value back. */
  function capture(): ReturnType<typeof useScrollIndicator> {
    let captured: ReturnType<typeof useScrollIndicator> | null = null;
    function Probe() {
      captured = useScrollIndicator();
      return <View />;
    }
    act(() => {
      renderer.create(<Probe />);
    });
    if (!captured) throw new Error('the hook never ran');
    return captured;
  }

  it('gives a callable onScroll, not an AnimatedEvent object', () => {
    const { handlers } = capture();
    expect(typeof handlers.onScroll).toBe('function');
  });

  it('survives being called with a real scroll event', () => {
    const { handlers } = capture();
    // Exactly the shape a plain ScrollView passes through.
    const event = { nativeEvent: { contentOffset: { x: 0, y: 240 } } };
    expect(() => handlers.onScroll(event)).not.toThrow();
  });

  it('and the other two handlers are callable as well', () => {
    const { handlers } = capture();
    expect(typeof handlers.onLayout).toBe('function');
    expect(typeof handlers.onContentSizeChange).toBe('function');
    expect(() =>
      handlers.onLayout({ nativeEvent: { layout: { height: 600, width: 390, x: 0, y: 0 } } } as never)
    ).not.toThrow();
    expect(() => handlers.onContentSizeChange(390, 1800)).not.toThrow();
  });

  it('mounts on a plain ScrollView without throwing', () => {
    function Screen() {
      const scroll = useScrollIndicator();
      return (
        <ScrollView {...scroll.handlers}>
          <View />
        </ScrollView>
      );
    }
    expect(() => {
      act(() => {
        renderer.create(<Screen />);
      });
    }).not.toThrow();
  });
});
