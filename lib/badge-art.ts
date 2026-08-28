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
 * Per-badge artwork, keyed by badge id, overriding the family drawing.
 *
 * Reusing one drawing across a family is right almost everywhere: thirteen
 * Prehab badges are one achievement at thirteen depths. Exercise Milestones are
 * the exception, and the only one — each badge is a DIFFERENT exercise, not a
 * deeper rung of the same one, so a single rosette on all of them threw away the
 * only thing that distinguished them.
 *
 * These are drawn in profile or head-on, whichever makes the movement legible at
 * grid size, in the same geometric style as the family glyphs.
 */
export const BADGE_ID_GLYPHS: Record<string, ArtShape[]> = {
  // Chin over the bar, elbows driving out.
  ex_pull_up_first: [
    { k: 'path', d: 'M6 8 L42 8', stroke: 'glyph', sw: 3.6 },
    { k: 'path', d: 'M18 9 L13.5 16 L20 20.5', stroke: 'glyph', sw: 3.4 },
    { k: 'path', d: 'M30 9 L34.5 16 L28 20.5', stroke: 'glyph', sw: 3.4 },
    { k: 'circle', cx: 24, cy: 15, r: 4.4, fill: 'glyph' },
    { k: 'rect', x: 20.5, y: 20, w: 7, h: 12, rx: 3, fill: 'glyph' },
    { k: 'path', d: 'M22 32 L20 43', stroke: 'glyph', sw: 4 },
    { k: 'path', d: 'M26 32 L28 43', stroke: 'glyph', sw: 4 },
  ],

  // A dead hang is a grip test, so it is drawn as the grip rather than as
  // another whole body on a bar — which is also what keeps it from reading as
  // the pull-up above.
  ex_dead_hang_first: [
    { k: 'path', d: 'M6 7 L42 7', stroke: 'glyph', sw: 3.6 },
    { k: 'circle', cx: 18, cy: 8, r: 3, fill: 'glyph' },
    { k: 'circle', cx: 30, cy: 8, r: 3, fill: 'glyph' },
    { k: 'path', d: 'M18 10 L19 21', stroke: 'glyph', sw: 3.4 },
    { k: 'path', d: 'M30 10 L29 21', stroke: 'glyph', sw: 3.4 },
    { k: 'circle', cx: 24, cy: 17, r: 4.2, fill: 'glyph' },
    { k: 'rect', x: 20.5, y: 22, w: 7, h: 13, rx: 3, fill: 'glyph' },
    { k: 'path', d: 'M22.5 35 L22 44', stroke: 'glyph', sw: 3.8 },
    { k: 'path', d: 'M25.5 35 L26 44', stroke: 'glyph', sw: 3.8 },
  ],

  // Shoulders on the bench, bar across the hips, everything bridged.
  ex_hip_thrust_first: [
    { k: 'rect', x: 2.5, y: 27, w: 13, h: 5, rx: 2, fill: 'glyph', o: 0.5 },
    { k: 'circle', cx: 8, cy: 21, r: 4, fill: 'glyph' },
    { k: 'path', d: 'M12 26 C18 14 30 13 34 29', stroke: 'glyph', sw: 5.5 },
    { k: 'rect', x: 16, y: 9.5, w: 18, h: 6, rx: 3, fill: 'glyph' },
    { k: 'path', d: 'M34 29 L36 41', stroke: 'glyph', sw: 4.5 },
  ],

  // Ankles pinned, body lowering under control.
  ex_nordic_first: [
    { k: 'path', d: 'M6 42 L42 42', stroke: 'glyph', sw: 2.6, o: 0.4 },
    { k: 'rect', x: 5, y: 32, w: 8, h: 7, rx: 2.5, fill: 'glyph', o: 0.6 },
    { k: 'path', d: 'M10 37.5 L22 37.5', stroke: 'glyph', sw: 5 },
    { k: 'path', d: 'M22 37.5 L33 22', stroke: 'glyph', sw: 6 },
    { k: 'circle', cx: 36.5, cy: 18.5, r: 4.5, fill: 'glyph' },
    { k: 'path', d: 'M29 27.5 L35 32', stroke: 'glyph', sw: 3.4 },
  ],

  // Loaded in both hands, walking.
  ex_farmers_carry_first: [
    { k: 'circle', cx: 24, cy: 8, r: 4.6, fill: 'glyph' },
    { k: 'rect', x: 20.5, y: 14, w: 7, h: 13, rx: 3, fill: 'glyph' },
    { k: 'path', d: 'M19.5 17 L12 27', stroke: 'glyph', sw: 3.4 },
    { k: 'path', d: 'M28.5 17 L36 27', stroke: 'glyph', sw: 3.4 },
    { k: 'rect', x: 6, y: 28, w: 10, h: 12, rx: 3, fill: 'glyph' },
    { k: 'rect', x: 32, y: 28, w: 10, h: 12, rx: 3, fill: 'glyph' },
    { k: 'path', d: 'M22.5 27 L21 41', stroke: 'glyph', sw: 3.8 },
    { k: 'path', d: 'M25.5 27 L27 41', stroke: 'glyph', sw: 3.8 },
  ],

  // Quadruped, opposite arm and leg reaching.
  ex_bird_dog_first: [
    { k: 'path', d: 'M16 24 L30 24', stroke: 'glyph', sw: 6 },
    { k: 'circle', cx: 34, cy: 21.5, r: 4, fill: 'glyph' },
    { k: 'path', d: 'M20 26 L18.5 38', stroke: 'glyph', sw: 3.6 },
    { k: 'path', d: 'M28 26 L29.5 38', stroke: 'glyph', sw: 3.6 },
    { k: 'path', d: 'M18 22 L6 15.5', stroke: 'glyph', sw: 4 },
    { k: 'path', d: 'M30 22 L42 15.5', stroke: 'glyph', sw: 4 },
  ],

  // Hips on the pad, torso arcing up off it.
  // The machine is what tells this apart from the Nordic above — same movement,
  // different apparatus — so the frame is drawn as deliberately as the body.
  ex_ghd_first: [
    { k: 'rect', x: 6, y: 37.5, w: 34, h: 5, rx: 2, fill: 'glyph', o: 0.5 },
    { k: 'rect', x: 30, y: 20, w: 6, h: 18, rx: 2, fill: 'glyph', o: 0.6 },
    { k: 'rect', x: 14, y: 24, w: 14, h: 6, rx: 3, fill: 'glyph' },
    { k: 'path', d: 'M16 26 C9 24 7 18 8 13.5', stroke: 'glyph', sw: 5 },
    { k: 'circle', cx: 8, cy: 9.5, r: 4, fill: 'glyph' },
    { k: 'path', d: 'M28 27 L32 25', stroke: 'glyph', sw: 4.5 },
  ],

  // Chest supported on the bench, rowing the bar underneath it.
  ex_seal_row_first: [
    { k: 'rect', x: 7, y: 21, w: 32, h: 5, rx: 2.5, fill: 'glyph', o: 0.5 },
    { k: 'path', d: 'M13 17 L32 17', stroke: 'glyph', sw: 5.5 },
    { k: 'circle', cx: 36, cy: 15.5, r: 3.8, fill: 'glyph' },
    { k: 'path', d: 'M22 21 L22 31', stroke: 'glyph', sw: 3.4 },
    { k: 'path', d: 'M11 33 L37 33', stroke: 'glyph', sw: 3.6 },
    { k: 'circle', cx: 10, cy: 33, r: 3.2, fill: 'glyph' },
    { k: 'circle', cx: 38, cy: 33, r: 3.2, fill: 'glyph' },
  ],

  // The front rack is the distinction from the back squat in the Lower Body
  // family: bar across the front of the shoulders, forearms vertical, elbows
  // high. That pair of uprights flanking the head is the whole silhouette.
  ex_front_squat_first: [
    { k: 'path', d: 'M7 16 L41 16', stroke: 'glyph', sw: 4 },
    { k: 'circle', cx: 11, cy: 16, r: 3.4, fill: 'glyph' },
    { k: 'circle', cx: 37, cy: 16, r: 3.4, fill: 'glyph' },
    { k: 'path', d: 'M18 16 L18 7.5', stroke: 'glyph', sw: 3.2 },
    { k: 'path', d: 'M30 16 L30 7.5', stroke: 'glyph', sw: 3.2 },
    { k: 'circle', cx: 24, cy: 10.5, r: 4, fill: 'glyph' },
    { k: 'rect', x: 20, y: 19, w: 8, h: 11, rx: 3.5, fill: 'glyph' },
    { k: 'path', d: 'M21 30 L14.5 36 L18 44', stroke: 'glyph', sw: 4.4 },
    { k: 'path', d: 'M27 30 L33.5 36 L30 44', stroke: 'glyph', sw: 4.4 },
  ],

  // One end pinned to the floor, the other loaded.
  ex_landmine_first: [
    { k: 'path', d: 'M5 42 L43 42', stroke: 'glyph', sw: 2.6, o: 0.4 },
    { k: 'rect', x: 5, y: 35, w: 10, h: 5, rx: 2, fill: 'glyph' },
    { k: 'path', d: 'M10 37 L34 17', stroke: 'glyph', sw: 4 },
    { k: 'circle', cx: 36, cy: 14, r: 6.5, stroke: 'glyph', sw: 3.5 },
  ],

  // The wheel, and the arc it rolls out through.
  ex_ab_wheel_first: [
    { k: 'path', d: 'M11 13 C18 8 30 8 37 13', stroke: 'glyph', sw: 2.6, o: 0.45 },
    { k: 'circle', cx: 24, cy: 28, r: 11, stroke: 'glyph', sw: 4 },
    { k: 'circle', cx: 24, cy: 28, r: 3, fill: 'glyph' },
    { k: 'rect', x: 4, y: 25, w: 11, h: 6, rx: 3, fill: 'glyph' },
    { k: 'rect', x: 33, y: 25, w: 11, h: 6, rx: 3, fill: 'glyph' },
  ],
};

/**
 * The drawing for a badge: its own if it has one, otherwise its family's.
 *
 * ex_ghd_10_sessions deliberately has no entry — it is the same movement as
 * ex_ghd_first, ten sessions deeper, which is exactly the case the family
 * drawing exists for.
 */
export function glyphFor(category: BadgeCategory, badgeId?: string): ArtShape[] {
  if (badgeId) {
    const own = BADGE_ID_GLYPHS[badgeId];
    if (own) return own;
  }
  return BADGE_GLYPHS[category] ?? [];
}

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

/**
 * Locked badges: an unstruck blank, not a pale medal.
 *
 * The first attempt made locked a light cool grey, which put it right next to
 * Silver on the same axis — at grid size the two were hard to tell apart, which
 * defeats the point of the tier reading at a glance. Locked is now clearly
 * darker and, crucially, MATTE: components/BadgeMedallion.tsx skips the rim
 * highlight and the face sheen when locked, so it has none of the shine that
 * makes the earned tiers look like metal. Plus a padlock, so it is unambiguous
 * rather than merely different.
 */
/**
 * The padlock struck onto a locked medal. These live here with the metals
 * rather than in constants/colors.ts because a medal is a physical object with
 * its own palette — it does not restyle with the app theme, any more than the
 * bronze rim does.
 */
export const PADLOCK_COLORS = {
  well: '#2E3439',
  wellRim: '#9AA1A7',
  shackle: '#E4E8EB',
} as const;

export const LOCKED_METAL: Metal = {
  light: '#7C838A',
  base: '#5C6369',
  dark: '#3A4046',
  glyph: '#454B51',
  face: ['#9AA1A7', '#848B91'],
};
