/**
 * Where you are in the session, as one row of marks and a finish line.
 *
 * WHAT IT REPLACED. A filled progress bar with "KPI Lift · 9/25" underneath.
 * That told you a fraction and nothing else: not how many exercises are left,
 * not that the next three are short ones, not that you are two away from the
 * end. A bar is a percentage; this is a course.
 *
 * WHY THE MARKS ARE NOT INDIVIDUALLY TAPPABLE. Twenty-five marks across a
 * 390pt phone is eleven points each. A tap target has to be forty-four, so
 * individually tappable marks would be a row of misses. The whole strip is one
 * target instead, and it opens the session list, which has room to show what
 * was logged and is the same list seen before the session starts.
 *
 * The flag is the point of the whole thing. It sits at the end of the row from
 * the first second of the session, so the end is always visible and always the
 * same distance away, and it fills in when the last set is logged.
 */
import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn, useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { useColors } from '@/constants/colors';
import { useSessionColors } from '@/lib/session-theme-context';

export interface SessionProgressStripProps {
  /** One entry per exercise: true once every set on it is logged or skipped. */
  done: boolean[];
  /** Which exercise is on screen. */
  activeIndex: number;
  /** Opens the session list. Omitted in the demo, where nothing should move. */
  onPress?: () => void;
  /** Short line under the strip, e.g. "Main lift · exercise 9 of 25". */
  caption?: string;
  /**
   * The session's colour, already resolved for the current theme.
   *
   * Resolved by the screen rather than here: this sits on the app's own
   * background, and which of a session's two shades reads on it is a question
   * about the theme, not about the strip.
   */
  accent: string;
}

export function SessionProgressStrip({
  done,
  activeIndex,
  onPress,
  caption,
  accent,
}: SessionProgressStripProps) {
  const C = useSessionColors();
  const styles = useMemo(() => makeStyles(C), [C]);

  const total = done.length;
  const finished = total > 0 && done.every(Boolean);

  /**
   * The flag lifts and settles once, when the last exercise lands.
   *
   * Driven off `finished` rather than off a tap, because the moment worth
   * marking is the one the user earned. withSequence rather than a loop: a
   * flag that keeps waving is a distraction for the rest of the summary.
   */
  const flagLift = useSharedValue(0);
  React.useEffect(() => {
    if (finished) {
      flagLift.value = withSequence(
        withSpring(-4, { damping: 6, stiffness: 220 }),
        withSpring(0, { damping: 9, stiffness: 180 })
      );
    } else {
      flagLift.value = withTiming(0, { duration: 120 });
    }
  }, [finished, flagLift]);

  const flagStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: flagLift.value }],
  }));

  /**
   * The row springs as a mark fills.
   *
   * Driven off the COUNT of finished exercises, so it fires once per exercise
   * and not once per render. Progress and the moment of finishing something are
   * the same event; animating them separately would make the strip look like it
   * was reacting to the toast rather than to the work.
   */
  const doneCount = done.filter(Boolean).length;
  const rowPulse = useSharedValue(1);
  const prevDoneRef = React.useRef(doneCount);
  React.useEffect(() => {
    if (doneCount > prevDoneRef.current) {
      rowPulse.value = withSequence(
        withTiming(1.04, { duration: 120 }),
        withSpring(1, { damping: 10, stiffness: 240 })
      );
    }
    prevDoneRef.current = doneCount;
  }, [doneCount, rowPulse]);
  const rowStyle = useAnimatedStyle(() => ({ transform: [{ scale: rowPulse.value }] }));

  const strip = (
    <View style={styles.wrap}>
      <Animated.View style={[styles.row, rowStyle]}>
        {done.map((isDone, i) => {
          const isActive = i === activeIndex;
          return (
            <View
              key={i}
              style={[
                styles.mark,
                isDone && [styles.markDone, { backgroundColor: accent }],
                isActive && [styles.markActive, { backgroundColor: accent }],
              ]}
            />
          );
        })}
        <Animated.View
          style={[styles.flag, finished && { backgroundColor: accent }, flagStyle]}
        >
          <Ionicons
            name={finished ? 'flag' : 'flag-outline'}
            size={13}
            color={finished ? C.background : C.textTertiary}
          />
        </Animated.View>
      </Animated.View>
      {!!caption && (
        <Animated.Text entering={FadeIn.duration(200)} style={styles.caption} numberOfLines={1}>
          {caption}
        </Animated.Text>
      )}
    </View>
  );

  if (!onPress) return strip;

  return (
    <Pressable
      onPress={onPress}
      testID="session-progress-strip"
      accessibilityRole="button"
      accessibilityLabel={`Exercise ${activeIndex + 1} of ${total}. Open the session list.`}
      style={({ pressed }) => [pressed && { opacity: 0.7 }]}
    >
      {strip}
    </Pressable>
  );
}

function makeStyles(C: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    wrap: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 8, gap: 7 },
    row: { flexDirection: 'row', alignItems: 'center', gap: 3 },
    mark: {
      flex: 1,
      height: 6,
      borderRadius: 3,
      backgroundColor: C.borderLight,
      minWidth: 3,
    },
    markDone: { backgroundColor: C.primaryLight },
    // The one you are on is taller as well as darker. Colour alone disappears
    // in a row of twenty-five, and it has to be findable at a glance mid-set.
    markActive: { height: 10, borderRadius: 5, backgroundColor: C.primaryDark },
    markActiveDone: { backgroundColor: C.primaryDark },
    flag: {
      width: 22,
      height: 22,
      borderRadius: 11,
      marginLeft: 5,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: C.surfaceTertiary,
    },
    flagLit: { backgroundColor: C.primary },
    caption: {
      fontSize: 12,
      fontFamily: 'Inter_500Medium',
      color: C.textSecondary,
      textAlign: 'center',
    },
  });
}
