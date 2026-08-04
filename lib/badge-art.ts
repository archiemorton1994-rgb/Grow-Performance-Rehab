/**
 * Badge artwork — the drawings themselves, as data.
 *
 * The achievements screen used Ionicons for every badge. That is a general
 * purpose UI icon set: it is fine on a button, but at medallion size next to
 * `assets/images/home/achievements.png` — a rendered silver trophy with a green
 * star and laurels — it read as placeholder art, which is exactly what it was.
 *
 * These glyphs are drawn for this app: one per badge family, in a single
 * geometric style, sitting on a struck-metal medallion that borrows the home
 * trophy's own vocabulary (silver face, brand-green accent, soft top light).
 *
 * They live here as plain data rather than as JSX so there is exactly one
 * source of truth for the geometry. `components/BadgeMedallion.tsx` renders it
 * with react-native-svg; `tests/badge-glyph-coverage.check.mjs` checks the set
 * is complete and that no two families share a drawing; and the same data can
 * be dumped to an HTML sheet to be looked at, which is the only way to make a
 * claim about how artwork looks.
 *
 * Coordinate space is a 48x48 box. Keep content inside roughly 4..44 on both
 * axes: the renderer insets it into the medallion face, and anything nearer the
 * corners than that will foul the rim.
 */
import type { BadgeCategory, BadgeTier } from '@/lib/badges';

/**
 * Which of the medallion's two colours a shape is painted in.
 *
 *   glyph — the tier's ink (a deepened bronze / steel / gold / green)
 *   face  — the silver of the medallion face, used to cut a shape back out of
 *           a filled one (the pulse line through the heart, the tick on the
 *           shield), which is how a struck medal actually reads
 */
export type Ink = 'glyph' | 'face';

interface ShapeBase {
  fill?: Ink;
  stroke?: Ink;
  /** Stroke width in glyph units. */
  sw?: number;
  /** Opacity 0..1. Used for depth, and to de-emphasise part of a drawing. */
  o?: number;
  /** Degrees, rotated about the centre of the glyph box (24,24). */
  rot?: number;
}

export type ArtShape =
  | (ShapeBase & { k: 'circle'; cx: number; cy: number; r: number })
  | (ShapeBase & { k: 'rect'; x: number; y: number; w: number; h: number; rx?: number })
  | (ShapeBase & { k: 'path'; d: string });

export const BADGE_GLYPHS: Record<BadgeCategory, ArtShape[]> = {
  // Sessions stacking up: a staircase climbing to a planted flag.
  //
  // Drawn as one connected silhouette, not three columns. Three columns is what
  // strength_progress is, and at 44px the two were the same picture.
  milestone: [
    {
      k: 'path',
      d: 'M6 42 L6 31 L17 31 L17 22 L28 22 L28 13 L39 13 L39 42 Z',
      fill: 'glyph',
      stroke: 'glyph',
      sw: 2.4,
    },
    { k: 'path', d: 'M33 13 L33 4.5', stroke: 'glyph', sw: 3 },
    { k: 'path', d: 'M33 4.5 L43 8 L33 11.5 Z', fill: 'glyph' },
  ],

  // An unbroken run. Same flame as the home streak icon.
  streak: [
    {
      k: 'path',
      d: 'M24 4 C30 12 37 16 37 26 A13 13 0 0 1 11 26 C11 20 15 17 17 13 C18 17 20 19 22 20 C23 14 23 9 24 4 Z',
      fill: 'glyph',
    },
    {
      k: 'path',
      d: 'M24 25 C26.5 27.5 29 30 29 33 A5 5 0 0 1 19 33 C19 30 21.5 27.5 24 25 Z',
      fill: 'face',
      o: 0.55,
    },
  ],

  // A lift going up over time: rising columns under a climbing arrow.
  strength_progress: [
    { k: 'rect', x: 9, y: 32, w: 8, h: 11, rx: 2, fill: 'glyph', o: 0.42 },
    { k: 'rect', x: 20, y: 28, w: 8, h: 15, rx: 2, fill: 'glyph', o: 0.68 },
    { k: 'rect', x: 31, y: 24, w: 8, h: 19, rx: 2, fill: 'glyph' },
    { k: 'path', d: 'M9 21 L18 13 L25 18 L39 6', stroke: 'glyph', sw: 3.4 },
    { k: 'path', d: 'M30 6 L40 6 L40 15', stroke: 'glyph', sw: 3.4 },
  ],

  // The three body-region families are three lifts, not one figure with a limb
  // greyed out. Dimming half a figure looked identical across all three at grid
  // size; a squat, a press and a star are three different pictures.
  session_lower: [
    { k: 'circle', cx: 24, cy: 10, r: 5, fill: 'glyph' },
    { k: 'path', d: 'M7 18 L41 18', stroke: 'glyph', sw: 4 },
    { k: 'circle', cx: 11, cy: 18, r: 3.6, fill: 'glyph' },
    { k: 'circle', cx: 37, cy: 18, r: 3.6, fill: 'glyph' },
    { k: 'rect', x: 18, y: 16, w: 12, h: 12, rx: 4, fill: 'glyph' },
    { k: 'path', d: 'M21 28 L14 35.5 L18 44.5', stroke: 'glyph', sw: 4.6 },
    { k: 'path', d: 'M27 28 L34 35.5 L30 44.5', stroke: 'glyph', sw: 4.6 },
  ],
  session_upper: [
    { k: 'path', d: 'M7 9.5 L41 9.5', stroke: 'glyph', sw: 4 },
    { k: 'circle', cx: 11.5, cy: 9.5, r: 3.6, fill: 'glyph' },
    { k: 'circle', cx: 36.5, cy: 9.5, r: 3.6, fill: 'glyph' },
    { k: 'circle', cx: 24, cy: 19.5, r: 5, fill: 'glyph' },
    { k: 'path', d: 'M19.5 27 L14.5 12', stroke: 'glyph', sw: 4.2 },
    { k: 'path', d: 'M28.5 27 L33.5 12', stroke: 'glyph', sw: 4.2 },
    { k: 'rect', x: 18, y: 25, w: 12, h: 12, rx: 4.5, fill: 'glyph' },
    { k: 'path', d: 'M21.5 37 L19.5 44.5', stroke: 'glyph', sw: 4.6 },
    { k: 'path', d: 'M26.5 37 L28.5 44.5', stroke: 'glyph', sw: 4.6 },
  ],
  session_full: [
    { k: 'circle', cx: 24, cy: 9, r: 5.2, fill: 'glyph' },
    { k: 'path', d: 'M19 19 L8.5 12.5', stroke: 'glyph', sw: 4.6 },
    { k: 'path', d: 'M29 19 L39.5 12.5', stroke: 'glyph', sw: 4.6 },
    { k: 'rect', x: 18.5, y: 16, w: 11, h: 13, rx: 4.5, fill: 'glyph' },
    { k: 'path', d: 'M21 29 L13 43', stroke: 'glyph', sw: 4.8 },
    { k: 'path', d: 'M27 29 L35 43', stroke: 'glyph', sw: 4.8 },
  ],

  // Heart rate, not fire — conditioning is cardiovascular work.
  session_conditioning: [
    {
      k: 'path',
      d: 'M24 42 C8 31 5 22 5 17.5 A10.5 10.5 0 0 1 24 11.5 A10.5 10.5 0 0 1 43 17.5 C43 22 40 31 24 42 Z',
      fill: 'glyph',
    },
    { k: 'path', d: 'M9 21 L16 21 L19 14 L23 27 L26 20 L39 20', stroke: 'face', sw: 3 },
  ],

  // Protective work: a shield, struck with a tick.
  session_prehab: [
    {
      k: 'path',
      d: 'M24 4 L41 10.5 L41 24 C41 33.5 33.5 40 24 44 C14.5 40 7 33.5 7 24 L7 10.5 Z',
      fill: 'glyph',
    },
    { k: 'path', d: 'M16 23.5 L21.5 29.5 L32.5 17', stroke: 'face', sw: 3.6 },
  ],

  // Elasticity — a spring drawn out between two anchors. A swept-angle
  // protractor was the first attempt and read as a play button; length under
  // tension is the plainer picture of what stretching is.
  session_flex: [
    { k: 'rect', x: 4, y: 17.5, w: 5.5, h: 13, rx: 2.5, fill: 'glyph' },
    { k: 'rect', x: 38.5, y: 17.5, w: 5.5, h: 13, rx: 2.5, fill: 'glyph' },
    { k: 'path', d: 'M9.5 24 L14 17 L19 31 L24 17 L29 31 L34 17 L38.5 24', stroke: 'glyph', sw: 3.4 },
  ],

  // Something you built yourself: three settings set to three different places.
  session_custom: [
    { k: 'path', d: 'M8 13 L40 13', stroke: 'glyph', sw: 3.4, o: 0.3 },
    { k: 'path', d: 'M8 24 L40 24', stroke: 'glyph', sw: 3.4, o: 0.3 },
    { k: 'path', d: 'M8 35 L40 35', stroke: 'glyph', sw: 3.4, o: 0.3 },
    { k: 'circle', cx: 31, cy: 13, r: 5.4, fill: 'glyph' },
    { k: 'circle', cx: 17, cy: 24, r: 5.4, fill: 'glyph' },
    { k: 'circle', cx: 34, cy: 35, r: 5.4, fill: 'glyph' },
  ],

  // Weeks kept. The same calendar-and-tick as the home program icon.
  consistency: [
    { k: 'rect', x: 6.5, y: 11, w: 35, h: 31, rx: 5, fill: 'glyph', o: 0.22 },
    { k: 'rect', x: 6.5, y: 11, w: 35, h: 31, rx: 5, stroke: 'glyph', sw: 3.2 },
    { k: 'path', d: 'M6.5 20 L41.5 20', stroke: 'glyph', sw: 3.2 },
    { k: 'path', d: 'M16 6 L16 14', stroke: 'glyph', sw: 3.4 },
    { k: 'path', d: 'M32 6 L32 14', stroke: 'glyph', sw: 3.4 },
    { k: 'path', d: 'M16 31 L21.5 36.5 L32.5 25.5', stroke: 'glyph', sw: 3.6 },
  ],

  // A target you set for yourself.
  goals: [
    { k: 'circle', cx: 24, cy: 24, r: 17, stroke: 'glyph', sw: 3.4 },
    { k: 'circle', cx: 24, cy: 24, r: 10, stroke: 'glyph', sw: 3.2, o: 0.5 },
    { k: 'circle', cx: 24, cy: 24, r: 4.2, fill: 'glyph' },
  ],

  // Kit. A loaded dumbbell — a ringed plate was a third circle-with-a-dot next
  // to Goals and Time of Day, and lost against both.
  equipment: [
    { k: 'path', d: 'M13 24 L35 24', stroke: 'glyph', sw: 5 },
    { k: 'rect', x: 6, y: 13.5, w: 7.5, h: 21, rx: 3, fill: 'glyph' },
    { k: 'rect', x: 34.5, y: 13.5, w: 7.5, h: 21, rx: 3, fill: 'glyph' },
    { k: 'rect', x: 1.5, y: 18, w: 5, h: 12, rx: 2.5, fill: 'glyph', o: 0.62 },
    { k: 'rect', x: 41.5, y: 18, w: 5, h: 12, rx: 2.5, fill: 'glyph', o: 0.62 },
  ],

  // Measuring yourself against the block you just finished.
  test_week: [
    { k: 'path', d: 'M9.3 34.5 A 17 17 0 1 1 38.7 34.5', stroke: 'glyph', sw: 4 },
    { k: 'path', d: 'M24 26 L34.6 15.4', stroke: 'glyph', sw: 4 },
    { k: 'circle', cx: 24, cy: 26, r: 4, fill: 'glyph' },
  ],

  time_of_day: [
    { k: 'circle', cx: 24, cy: 24, r: 17, stroke: 'glyph', sw: 3.6 },
    { k: 'path', d: 'M24 24 L24 13', stroke: 'glyph', sw: 3.4 },
    { k: 'path', d: 'M24 24 L32 28', stroke: 'glyph', sw: 3.4 },
    { k: 'circle', cx: 24, cy: 24, r: 2.6, fill: 'glyph' },
  ],

  // Breadth — three different kinds of training. Three overlapping circles were
  // a blob; three different shapes are the point being made.
  variety: [
    { k: 'circle', cx: 24, cy: 14, r: 8, fill: 'glyph' },
    { k: 'rect', x: 8, y: 27, w: 15, h: 15, rx: 3, fill: 'glyph', o: 0.6 },
    {
      k: 'path',
      d: 'M35.5 26.5 L43.5 42 L27.5 42 Z',
      fill: 'glyph',
      stroke: 'glyph',
      sw: 3,
      o: 0.82,
    },
  ],

  recovery: [
    { k: 'path', d: 'M40 8 C40 29 27 41 11 39 C9 23 20 10 40 8 Z', fill: 'glyph' },
    { k: 'path', d: 'M35.5 12.5 C26 19 18 28 14 37', stroke: 'face', sw: 2.6 },
  ],

  // How long a session ran.
  duration: [
    { k: 'rect', x: 11, y: 5, w: 26, h: 4.5, rx: 2.2, fill: 'glyph' },
    { k: 'rect', x: 11, y: 38.5, w: 26, h: 4.5, rx: 2.2, fill: 'glyph' },
    {
      k: 'path',
      d: 'M15 9.5 L33 9.5 C33 19 25.5 22 25.5 24 C25.5 26 33 29 33 38.5 L15 38.5 C15 29 22.5 26 22.5 24 C22.5 22 15 19 15 9.5 Z',
      fill: 'glyph',
      o: 0.28,
    },
    {
      k: 'path',
      d: 'M15 9.5 L33 9.5 C33 19 25.5 22 25.5 24 C25.5 26 33 29 33 38.5 L15 38.5 C15 29 22.5 26 22.5 24 C22.5 22 15 19 15 9.5 Z',
      stroke: 'glyph',
      sw: 3,
    },
    {
      k: 'path',
      d: 'M18.5 36.5 C19.5 31 22 27.5 24 27.5 C26 27.5 28.5 31 29.5 36.5 Z',
      fill: 'glyph',
    },
  ],

  // Coming back after a break. The gap is wide enough to read as an arrow
  // returning rather than as a ring with a chip out of it.
  comeback: [
    { k: 'path', d: 'M33 14.3 A 14 14 0 1 1 15 14.3', stroke: 'glyph', sw: 4.4 },
    { k: 'path', d: 'M20.4 9.8 L16.7 19.4 L10.3 11.8 Z', fill: 'glyph' },
  ],

  // Training around an injury rather than stopping.
  pain_warrior: [
    { k: 'rect', x: 7, y: 17.5, w: 34, h: 13, rx: 6.5, fill: 'glyph', rot: -32 },
    { k: 'rect', x: 17.5, y: 17.5, w: 13, h: 13, rx: 2.5, fill: 'face', o: 0.92, rot: -32 },
    { k: 'circle', cx: 21, cy: 21, r: 1.5, fill: 'glyph', rot: -32 },
    { k: 'circle', cx: 27, cy: 21, r: 1.5, fill: 'glyph', rot: -32 },
    { k: 'circle', cx: 21, cy: 27, r: 1.5, fill: 'glyph', rot: -32 },
    { k: 'circle', cx: 27, cy: 27, r: 1.5, fill: 'glyph', rot: -32 },
  ],

  // Showing up on empty.
  endurance: [
    { k: 'rect', x: 5, y: 14.5, w: 31, h: 19, rx: 5, stroke: 'glyph', sw: 3.4 },
    { k: 'rect', x: 38, y: 20.5, w: 5, h: 7, rx: 2, fill: 'glyph' },
    { k: 'path', d: 'M23 16.5 L15 25.5 L21 25.5 L19 32 L28 22.5 L22 22.5 Z', fill: 'glyph' },
  ],

  // A named lift, logged for the first time.
  exercise_milestone: [
    {
      k: 'path',
      d: 'M17.5 26 L12 43.5 L20.5 39.5 L24 45 L27.5 39.5 L36 43.5 L30.5 26 Z',
      fill: 'glyph',
      o: 0.45,
    },
    { k: 'circle', cx: 24, cy: 18, r: 12, fill: 'face' },
    { k: 'circle', cx: 24, cy: 18, r: 12, stroke: 'glyph', sw: 3.6 },
    { k: 'circle', cx: 24, cy: 18, r: 4.5, fill: 'glyph' },
  ],
};

/**
 * The metal each tier is struck in.
 *
 * `glyph` is deliberately darker than `base`: the glyph sits on the silver face,
 * not on the rim, so it needs to hold against white rather than against the
 * ring. Silver is the case that proves it — a #9BA6AE glyph on a near-white
 * face is barely there.
 */
export interface Metal {
  light: string;
  base: string;
  dark: string;
  glyph: string;
  face: [string, string];
}

export const TIER_METALS: Record<BadgeTier, Metal> = {
  bronze: {
    light: '#E2A574',
    base: '#B0764A',
    dark: '#79482A',
    glyph: '#8A5730',
    face: ['#FFFFFF', '#F0E2D6'],
  },
  silver: {
    light: '#E4E9ED',
    base: '#9BA6AE',
    dark: '#69747C',
    glyph: '#57636B',
    face: ['#FFFFFF', '#E6EAEE'],
  },
  gold: {
    light: '#F3DC8A',
    base: '#C9A227',
    dark: '#8A6A10',
    glyph: '#8C6B11',
    face: ['#FFFFFF', '#F5EBCF'],
  },
  grow: {
    light: '#5FB183',
    base: '#2F6B46',
    dark: '#173A25',
    glyph: '#25583A',
    face: ['#FFFFFF', '#DFEDE5'],
  },
};

/** Locked badges are struck in the same die, in a dead metal. */
export const LOCKED_METAL: Metal = {
  light: '#E9ECEE',
  base: '#CBD1D5',
  dark: '#A2AAB0',
  glyph: '#A7AFB5',
  face: ['#F8F9FA', '#E6E9EB'],
};
