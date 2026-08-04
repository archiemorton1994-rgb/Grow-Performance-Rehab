import React from 'react';
import Svg, { Circle, Defs, Ellipse, G, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import { ArtShape, BADGE_GLYPHS, LOCKED_METAL, Metal, TIER_METALS } from '@/lib/badge-art';
import type { BadgeCategory, BadgeTier } from '@/lib/badges';

/**
 * A struck-metal medallion carrying one badge's glyph.
 *
 * Drawn to sit alongside `assets/images/home/achievements.png` — the trophy the
 * whole achievements area hangs off — and to borrow its vocabulary rather than
 * compete with it: a silver face, a single coloured emblem, light from the top
 * left. The rim carries the rarity tier, so a shelf of these is readable as a
 * collection before any text is read.
 *
 * Everything is vector. There are 277 badges; shipping raster art for each
 * would be a large binary and would still be wrong on the next screen density.
 */

const GLYPH_BOX = 48;
/** Glyph box inset into the 100-unit medallion, leaving the rim clear. */
const GLYPH_SCALE = 50 / GLYPH_BOX;
const GLYPH_OFFSET = (100 - GLYPH_BOX * GLYPH_SCALE) / 2;

const RIM_R = 47;
const FACE_R = 38;

/** Below this the rim decoration is sub-pixel, so it is left off rather than
 *  rendered as noise. */
const DETAIL_MIN_SIZE = 56;

function polar(radius: number, deg: number): [number, number] {
  const rad = (deg * Math.PI) / 180;
  return [50 + radius * Math.cos(rad), 50 + radius * Math.sin(rad)];
}

/** A beaded rim, as on a struck coin. Gold and Grow only — the top half of the
 *  ladder should look more made than the bottom. */
function Beading({ metal }: { metal: Metal }) {
  const beads = [];
  for (let i = 0; i < 32; i++) {
    const [cx, cy] = polar(43.6, (i * 360) / 32);
    beads.push(
      <Circle key={i} cx={cx} cy={cy} r={1.5} fill={metal.light} opacity={0.55} />
    );
  }
  return <>{beads}</>;
}

/** Laurel, taken straight off the home-screen trophy: the rarest badges in the
 *  app should be recognisably the same object family as the icon you tapped to
 *  get here. Two branches sweeping up the sides, open at the top. */
function Laurel({ metal }: { metal: Metal }) {
  const leaves = [];
  for (let i = 0; i < 7; i++) {
    // 100° (bottom) sweeping up to 190° (upper left), mirrored on the right.
    const a = 100 + i * 15;
    for (const deg of [a, 180 - a]) {
      const [cx, cy] = polar(43, deg);
      leaves.push(
        <Ellipse
          key={`${i}-${deg}`}
          cx={cx}
          cy={cy}
          rx={4.4}
          ry={2.3}
          fill={metal.light}
          opacity={0.85}
          rotation={deg + 62}
          originX={cx}
          originY={cy}
        />
      );
    }
  }
  return <>{leaves}</>;
}

function Glyph({ shapes, metal }: { shapes: ArtShape[]; metal: Metal }) {
  return (
    <G transform={`translate(${GLYPH_OFFSET}, ${GLYPH_OFFSET}) scale(${GLYPH_SCALE})`}>
      {shapes.map((s, i) => {
        const ink = (which?: 'glyph' | 'face') =>
          which === 'face' ? metal.face[0] : which === 'glyph' ? metal.glyph : 'none';
        const common = {
          fill: ink(s.fill),
          stroke: ink(s.stroke),
          strokeWidth: s.sw,
          strokeLinecap: 'round' as const,
          strokeLinejoin: 'round' as const,
          opacity: s.o,
          ...(s.rot != null ? { rotation: s.rot, originX: 24, originY: 24 } : null),
        };
        if (s.k === 'circle') return <Circle key={i} cx={s.cx} cy={s.cy} r={s.r} {...common} />;
        if (s.k === 'rect')
          return <Rect key={i} x={s.x} y={s.y} width={s.w} height={s.h} rx={s.rx} {...common} />;
        return <Path key={i} d={s.d} {...common} />;
      })}
    </G>
  );
}

export interface BadgeMedallionProps {
  category: BadgeCategory;
  tier: BadgeTier;
  /** Locked badges are struck in the same die in a dead grey metal. There is no
   *  padlock: a grey medal beside a coloured one already says it, and a lock
   *  chip on every locked tile is what made the old grid look like a form. */
  locked?: boolean;
  size: number;
}

function BadgeMedallionImpl({ category, tier, locked = false, size }: BadgeMedallionProps) {
  // Fall back rather than dereference undefined. tests/badge-glyph-coverage
  // proves every current badge resolves today, but TIER_METALS and BADGE_GLYPHS
  // are plain object lookups: adding a BadgeCategory without artwork would
  // return undefined and throw on the next line. A blank medal is a far better
  // failure than taking the screen down.
  const metal = (locked ? LOCKED_METAL : TIER_METALS[tier]) ?? LOCKED_METAL;
  const shapes = BADGE_GLYPHS[category] ?? [];
  const detail = size >= DETAIL_MIN_SIZE;

  // Gradient ids are shared by every medallion of the same appearance. On web
  // these land in one document, so they must not collide *with different
  // content* — keying them on exactly what varies means any duplicate is
  // byte-identical and harmless.
  const uid = `bm-${locked ? 'locked' : tier}`;

  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Defs>
        <LinearGradient id={`${uid}-rim`} x1="0%" y1="0%" x2="72%" y2="100%">
          <Stop offset="0" stopColor={metal.light} />
          <Stop offset="0.45" stopColor={metal.base} />
          <Stop offset="1" stopColor={metal.dark} />
        </LinearGradient>
        <LinearGradient id={`${uid}-face`} x1="15%" y1="0%" x2="85%" y2="100%">
          <Stop offset="0" stopColor={metal.face[0]} />
          <Stop offset="1" stopColor={metal.face[1]} />
        </LinearGradient>
        <LinearGradient id={`${uid}-gloss`} x1="0%" y1="0%" x2="0%" y2="100%">
          <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.85} />
          <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0} />
        </LinearGradient>
      </Defs>

      {/* Rim */}
      <Circle cx="50" cy="50" r={RIM_R} fill={`url(#${uid}-rim)`} />
      {/* Light catching the upper-left of the rim */}
      <Path
        d={`M50 ${50 - RIM_R} A ${RIM_R} ${RIM_R} 0 0 0 ${50 - RIM_R} 50`}
        stroke="#FFFFFF"
        strokeOpacity={0.42}
        strokeWidth={2.6}
        strokeLinecap="round"
        fill="none"
      />

      {detail && (tier === 'gold' || tier === 'grow') && !locked && <Beading metal={metal} />}
      {detail && tier === 'grow' && !locked && <Laurel metal={metal} />}

      {/* Face */}
      <Circle cx="50" cy="50" r={FACE_R} fill={`url(#${uid}-face)`} />
      <Circle
        cx="50"
        cy="50"
        r={FACE_R}
        fill="none"
        stroke={metal.dark}
        strokeOpacity={0.4}
        strokeWidth={1.6}
      />
      {/* Sheen across the top of the face */}
      <Ellipse cx="50" cy="30" rx="26" ry="14" fill={`url(#${uid}-gloss)`} />

      <Glyph shapes={shapes} metal={metal} />
    </Svg>
  );
}

export const BadgeMedallion = React.memo(BadgeMedallionImpl);
