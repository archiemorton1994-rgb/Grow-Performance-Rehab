/**
 * THE LEVEL, AROUND THE PROFILE PICTURE.
 *
 * The one place in the app that shows XP as an ongoing state rather than as
 * something that just happened - the session summary shows the earning, this
 * shows the standing. Two places, total. That is the whole of it, which is what
 * "not overbearing" has to mean in practice.
 *
 * A RING RATHER THAN A BAR, because it costs no vertical space and wraps a
 * thing that is already there. The profile hero has a photo; now the photo has
 * a rim that fills up. Nothing moved, nothing was added below it.
 *
 * THE NUMBER SITS BOTTOM LEFT because the camera button is bottom right, and
 * two chips on the same corner is how a hero turns into a dashboard.
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { xpStanding } from '@/lib/xp';
import type { AppColors } from '@/constants/colors';

interface Props {
  C: AppColors;
  xpTotal: number;
  /** The avatar's own width. The ring is drawn outside it. */
  size?: number;
  children: React.ReactNode;
}

const STROKE = 4;
/** How far the ring sits outside the avatar, so the two never touch. */
const GAP = 4;

export default function LevelRing({ C, xpTotal, size = 100, children }: Props) {
  const standing = xpStanding(xpTotal);
  const box = size + (GAP + STROKE) * 2;
  const r = (box - STROKE) / 2;
  const circumference = 2 * Math.PI * r;
  /**
   * A hair of the ring is always drawn, once anything at all has been earned.
   *
   * A ring at exactly 0% and a ring that is not there look identical, so
   * somebody who has just started reads it as broken rather than as new. Only a
   * genuinely empty account gets an empty rim.
   */
  const shown = standing.total > 0 ? Math.max(0.02, standing.fraction) : 0;
  const styles = makeStyles(C, box, size);

  return (
    <View style={styles.wrap} testID="level-ring">
      <Svg width={box} height={box} style={styles.svg} pointerEvents="none">
        <Circle
          cx={box / 2}
          cy={box / 2}
          r={r}
          stroke={C.surfaceSecondary}
          strokeWidth={STROKE}
          fill="none"
        />
        {shown > 0 && (
          <Circle
            cx={box / 2}
            cy={box / 2}
            r={r}
            // primaryText, not primary. The arc IS the visible mark rather
            // than a fill sitting behind something, and `primary` stays dark in
            // both themes so that white text can sit on it - which on a dark
            // background makes the ring the thing you cannot see.
            stroke={C.primaryText}
            strokeWidth={STROKE}
            strokeLinecap="round"
            fill="none"
            strokeDasharray={`${circumference * shown} ${circumference}`}
            // Start at twelve o'clock rather than three, which is where a
            // person expects a dial to begin.
            transform={`rotate(-90 ${box / 2} ${box / 2})`}
          />
        )}
      </Svg>
      <View style={styles.inner}>{children}</View>
      <View style={styles.chip} testID="level-ring-chip">
        <Text style={styles.chipText} numberOfLines={1}>
          {standing.level}
        </Text>
      </View>
    </View>
  );
}

const makeStyles = (C: AppColors, box: number, size: number) =>
  StyleSheet.create({
    wrap: {
      width: box,
      height: box,
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
    },
    svg: { position: 'absolute', top: 0, left: 0 },
    inner: { width: size, height: size },
    chip: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      minWidth: 26,
      height: 26,
      paddingHorizontal: 6,
      borderRadius: 13,
      backgroundColor: C.primary,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
      borderColor: C.background,
    },
    chipText: {
      fontSize: 13,
      fontFamily: 'Inter_700Bold',
      color: C.primaryDarkText,
      fontVariant: ['tabular-nums'],
    },
  });
