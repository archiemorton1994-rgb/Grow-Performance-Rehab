/**
 * GROW icon set — the app's own illustrative icons, drawn rather than borrowed.
 *
 * The badges got custom artwork (lib/badge-art.ts) and immediately made the rest
 * of the app look borrowed by comparison. The onboarding flow is the worst of
 * it: it is the first thing anyone sees, and every illustration on it was a
 * stock Ionicons outline glyph at 56px — a UI icon blown up to five times the
 * size it was drawn for, which is exactly why it reads as thin and generic.
 *
 * These are drawn for this app, in one style:
 *
 *   - 48x48 box, content inside roughly 4..44
 *   - weight comes from FILLED silhouettes, not from hairline strokes, because
 *     a 2px outline scaled to 56px is a 2px outline with more air around it
 *   - a second tone at ~0.3 opacity carries depth, the same duotone the badge
 *     medallions use
 *   - one accent colour in, so a caller just passes `color`
 *
 * Unlike badge art there is no `face` ink here: these sit on arbitrary
 * backgrounds, so a cut-out would need to know what is behind it. Depth is done
 * with opacity instead.
 *
 * Rendered by components/GrowIcon.tsx. Covered by tests/grow-icon.check.mjs.
 */
import type { ArtShape } from '@/lib/badge-art';

export type GrowIconName =
  // ── Onboarding: experience ──
  | 'leaf'
  | 'dumbbell'
  | 'trophy'
  // ── Onboarding: sex ──
  | 'male'
  | 'female'
  | 'person'
  // ── Onboarding: goals ──
  | 'muscle'
  | 'bolt'
  | 'flame'
  | 'heart'
  | 'rehab'
  // ── Onboarding: step heroes ──
  | 'profile'
  | 'chart'
  | 'scale'
  | 'flag'
  | 'podium'
  | 'palette'
  | 'check'
  // ── Onboarding: pillars & chrome ──
  | 'sliders'
  | 'trend'
  | 'clock'
  | 'moon'
  | 'sun'
  // ── Home tiles & the Train grid ──
  | 'cycle'
  | 'compose'
  // ── First-run chrome: the tour, the offer, the assistant ──
  | 'compass'
  | 'gift'
  | 'sparkle'
  | 'medal'
  // ── Set feedback: how hard was that set ──
  | 'effort1'
  | 'effort2'
  | 'effort3'
  | 'effort4';

/**
 * A struck seal: an N-lobed rosette, as on a certificate.
 *
 * Built rather than hand-drawn because the maths is the point — every lobe has
 * to be identical or the thing reads as a wobble instead of a seal, and 32
 * hand-typed coordinates is 32 chances to be 0.3 out.
 */
function seal(lobes: number, outer: number, inner: number, cy = 24): string {
  const pts: string[] = [];
  for (let i = 0; i < lobes * 2; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = (i * Math.PI) / lobes - Math.PI / 2;
    pts.push(`${(24 + r * Math.cos(a)).toFixed(2)} ${(cy + r * Math.sin(a)).toFixed(2)}`);
  }
  return `M${pts.join(' L')} Z`;
}

/** Four ascending bars, `filled` of them solid. See the effort* entries. */
function effortMeter(filled: number): ArtShape[] {
  const heights = [11, 18, 25, 32];
  return heights.map((h, i) => ({
    k: 'rect' as const,
    x: 6 + i * 10,
    y: 40 - h,
    w: 7,
    h,
    rx: 2.5,
    fill: 'glyph' as const,
    o: i < filled ? 1 : 0.22,
  }));
}

export const GROW_ICONS: Record<GrowIconName, ArtShape[]> = {
  // ── Experience ─────────────────────────────────────────────────────────────
  leaf: [
    { k: 'path', d: 'M41 7 C41 29 27 42 10 40 C8 22 20 9 41 7 Z', fill: 'glyph' },
    { k: 'path', d: 'M36 12 C25 20 16 30 12 41', stroke: 'glyph', sw: 3, o: 0.32 },
  ],

  dumbbell: [
    { k: 'path', d: 'M14 24 L34 24', stroke: 'glyph', sw: 5 },
    { k: 'rect', x: 6, y: 12, w: 8, h: 24, rx: 3.5, fill: 'glyph' },
    { k: 'rect', x: 34, y: 12, w: 8, h: 24, rx: 3.5, fill: 'glyph' },
    { k: 'rect', x: 1.5, y: 17, w: 5, h: 14, rx: 2.5, fill: 'glyph', o: 0.35 },
    { k: 'rect', x: 41.5, y: 17, w: 5, h: 14, rx: 2.5, fill: 'glyph', o: 0.35 },
  ],

  // The same cup-and-laurels object as assets/images/home/achievements.png, so
  // "experienced lifter" and the achievements area read as one family.
  trophy: [
    { k: 'path', d: 'M13 6 L35 6 L34 21 A 10 10 0 0 1 14 21 Z', fill: 'glyph' },
    { k: 'path', d: 'M13 9 C7 9 5 12 5 16 C5 20.5 8.5 24 13.5 24', stroke: 'glyph', sw: 3.4, o: 0.5 },
    { k: 'path', d: 'M35 9 C41 9 43 12 43 16 C43 20.5 39.5 24 34.5 24', stroke: 'glyph', sw: 3.4, o: 0.5 },
    { k: 'path', d: 'M24 30 L24 36', stroke: 'glyph', sw: 4.5 },
    { k: 'rect', x: 13, y: 36, w: 22, h: 6, rx: 3, fill: 'glyph' },
  ],

  // ── Sex ────────────────────────────────────────────────────────────────────
  male: [
    { k: 'circle', cx: 20, cy: 29, r: 11, stroke: 'glyph', sw: 4 },
    { k: 'path', d: 'M29 20 L41 8', stroke: 'glyph', sw: 4 },
    { k: 'path', d: 'M30 8 L42 8 L42 20', stroke: 'glyph', sw: 4 },
  ],
  female: [
    { k: 'circle', cx: 24, cy: 18, r: 11, stroke: 'glyph', sw: 4 },
    { k: 'path', d: 'M24 29 L24 43', stroke: 'glyph', sw: 4 },
    { k: 'path', d: 'M16 36 L32 36', stroke: 'glyph', sw: 4 },
  ],
  person: [
    { k: 'circle', cx: 24, cy: 15, r: 8, fill: 'glyph' },
    { k: 'path', d: 'M8 42 C8 32 15 27 24 27 C33 27 40 32 40 42 Z', fill: 'glyph' },
  ],

  // ── Goals ──────────────────────────────────────────────────────────────────
  // A flexed arm, built from solids: fist, forearm, bicep, upper arm. Drawn as
  // a stroked path first and it read as a hook — the shape only becomes an arm
  // once the bicep has real mass.
  muscle: [
    { k: 'circle', cx: 33, cy: 12, r: 6.5, fill: 'glyph' },
    { k: 'rect', x: 26.5, y: 12, w: 13, h: 18, rx: 6, fill: 'glyph' },
    { k: 'rect', x: 6, y: 26, w: 26, h: 12, rx: 6, fill: 'glyph' },
    { k: 'circle', cx: 19, cy: 24, r: 9.5, fill: 'glyph' },
  ],
  bolt: [
    { k: 'path', d: 'M27 4 L11 27 L21 27 L18 44 L36 20 L25 20 Z', fill: 'glyph' },
  ],
  flame: [
    {
      k: 'path',
      d: 'M24 3 C31 12 39 17 39 28 A15 15 0 0 1 9 28 C9 21 14 17 16 12 C17 17 20 19 22 21 C23 14 23 8 24 3 Z',
      fill: 'glyph',
    },
    {
      k: 'path',
      d: 'M24 24 C27 27 30.5 31 30.5 35 A6.5 6.5 0 0 1 17.5 35 C17.5 31 21 27 24 24 Z',
      fill: 'glyph',
      o: 0.3,
    },
  ],
  heart: [
    {
      k: 'path',
      d: 'M24 42 C8 31 5 22 5 17.5 A10.5 10.5 0 0 1 24 11.5 A10.5 10.5 0 0 1 43 17.5 C43 22 40 31 24 42 Z',
      fill: 'glyph',
      o: 0.3,
    },
    { k: 'path', d: 'M6 21 L16 21 L19 13 L24 30 L28 20 L42 20', stroke: 'glyph', sw: 3.4 },
  ],
  // Rehab is protective work, not medicine — a shield, matching the Prehab badge.
  rehab: [
    { k: 'path', d: 'M24 4 L41 10.5 L41 24 C41 33.5 33.5 40 24 44 C14.5 40 7 33.5 7 24 L7 10.5 Z', fill: 'glyph', o: 0.3 },
    { k: 'path', d: 'M24 4 L41 10.5 L41 24 C41 33.5 33.5 40 24 44 C14.5 40 7 33.5 7 24 L7 10.5 Z', stroke: 'glyph', sw: 3.2 },
    { k: 'path', d: 'M24 15 L24 30', stroke: 'glyph', sw: 4 },
    { k: 'path', d: 'M16.5 22.5 L31.5 22.5', stroke: 'glyph', sw: 4 },
  ],

  // ── Step heroes ────────────────────────────────────────────────────────────
  profile: [
    { k: 'circle', cx: 24, cy: 24, r: 20, stroke: 'glyph', sw: 3.4, o: 0.35 },
    { k: 'circle', cx: 24, cy: 19, r: 7, fill: 'glyph' },
    { k: 'path', d: 'M11.5 38 C13.5 31.5 18.5 28.5 24 28.5 C29.5 28.5 34.5 31.5 36.5 38', stroke: 'glyph', sw: 4.6 },
  ],
  chart: [
    { k: 'rect', x: 6, y: 26, w: 8, h: 16, rx: 2.5, fill: 'glyph', o: 0.35 },
    { k: 'rect', x: 20, y: 18, w: 8, h: 24, rx: 2.5, fill: 'glyph', o: 0.6 },
    { k: 'rect', x: 34, y: 8, w: 8, h: 34, rx: 2.5, fill: 'glyph' },
  ],
  // A bathroom scale, seen from above.
  scale: [
    { k: 'rect', x: 5, y: 9, w: 38, h: 30, rx: 6, stroke: 'glyph', sw: 3.4 },
    { k: 'path', d: 'M15 30 A 11 11 0 0 1 33 30', stroke: 'glyph', sw: 3.2, o: 0.35 },
    { k: 'path', d: 'M24 30 L30 20', stroke: 'glyph', sw: 3.6 },
    { k: 'circle', cx: 24, cy: 30, r: 2.6, fill: 'glyph' },
  ],
  flag: [
    { k: 'path', d: 'M12 5 L12 44', stroke: 'glyph', sw: 4 },
    { k: 'path', d: 'M12 8 L38 8 L32 17 L38 26 L12 26 Z', fill: 'glyph' },
  ],
  podium: [
    { k: 'rect', x: 18, y: 12, w: 12, h: 30, rx: 2, fill: 'glyph' },
    { k: 'rect', x: 4, y: 22, w: 12, h: 20, rx: 2, fill: 'glyph', o: 0.35 },
    { k: 'rect', x: 32, y: 28, w: 12, h: 14, rx: 2, fill: 'glyph', o: 0.35 },
    { k: 'path', d: 'M24 3 L26.6 8.3 L32.5 9.2 L28.2 13.3 L29.2 19.2 L24 16.4 L18.8 19.2 L19.8 13.3 L15.5 9.2 L21.4 8.3 Z', fill: 'glyph' },
  ],
  palette: [
    {
      k: 'path',
      d: 'M24 5 C13 5 4 13 4 24 C4 35 13 43 24 43 C27 43 29 41 29 38 C29 35 27 34 27 31 C27 29 29 27 32 27 L36 27 C41 27 44 24 44 19 C44 11 35 5 24 5 Z',
      fill: 'glyph',
      o: 0.3,
    },
    { k: 'circle', cx: 14, cy: 20, r: 3.4, fill: 'glyph' },
    { k: 'circle', cx: 22, cy: 13, r: 3.4, fill: 'glyph' },
    { k: 'circle', cx: 32, cy: 15, r: 3.4, fill: 'glyph' },
    { k: 'circle', cx: 12, cy: 30, r: 3.4, fill: 'glyph' },
  ],
  /**
   * THE CELEBRATION, AND THE MOST-LOOKED-AT DRAWING IN THE APP.
   *
   * It renders at 120px on "Profile Ready!" — the payoff for twelve screens of
   * questions — and it was a ring with a tick through it. A ring with a tick is
   * the checkmark-circle every icon pack ships and every app uses for "form
   * submitted". At that size, on that screen, it read as a system confirmation
   * rather than as a moment.
   *
   * It is a struck seal now: a rosette, a raised face and a tick. Deliberately
   * the same family as the badge medallions, because this IS the first award
   * the app gives anyone, and the achievements they meet at the end of the tour
   * should look like they came from the same place.
   */
  check: [
    { k: 'path', d: seal(16, 22, 18.4), fill: 'glyph', o: 0.34 },
    { k: 'circle', cx: 24, cy: 24, r: 16.5, fill: 'glyph' },
    // 'face' ink, which nothing else in this set uses. It is legitimate here
    // and only here: this stroke sits on the disc directly above it, so what is
    // behind it is known. See faceInkFor in lib/icon-material.ts.
    { k: 'path', d: 'M15.5 24.5 L21.5 30.5 L32.5 18.5', stroke: 'face', sw: 4.4 },
  ],

  // ── Home tiles & the Train grid ────────────────────────────────────────────

  // A cycle: a ring broken at the top with an arrowhead closing it, and three
  // marks inside for the sessions the block repeats. The tile this replaces
  // reads "CYCLE 7", so the ring is the card's own word rather than a calendar.
  cycle: [
    { k: 'path', d: 'M31 10.6 A15.5 15.5 0 1 1 20.6 8.9', stroke: 'glyph', sw: 4.4 },
    { k: 'path', d: 'M27.5 4 L36.5 11 L26.5 16.5 Z', fill: 'glyph' },
    { k: 'rect', x: 15.5, y: 27.5, w: 4.6, h: 9, rx: 2.3, fill: 'glyph', o: 0.32 },
    { k: 'rect', x: 21.7, y: 24, w: 4.6, h: 12.5, rx: 2.3, fill: 'glyph', o: 0.32 },
    { k: 'rect', x: 27.9, y: 29.5, w: 4.6, h: 7, rx: 2.3, fill: 'glyph', o: 0.32 },
  ],

  // Building your own: three rows stacked, the last one still open, and a plus
  // sitting on the corner. The card says "pick your own exercises", which is a
  // list you assemble rather than a clipboard somebody hands you.
  compose: [
    { k: 'rect', x: 6, y: 10, w: 30, h: 6.4, rx: 3.2, fill: 'glyph' },
    { k: 'rect', x: 6, y: 20.8, w: 30, h: 6.4, rx: 3.2, fill: 'glyph', o: 0.62 },
    { k: 'rect', x: 6, y: 31.6, w: 19, h: 6.4, rx: 3.2, fill: 'glyph', o: 0.34 },
    { k: 'circle', cx: 36, cy: 34.8, r: 9.4, fill: 'glyph' },
    { k: 'path', d: 'M36 29.6 L36 40', stroke: 'face', sw: 3.1 },
    { k: 'path', d: 'M30.8 34.8 L41.2 34.8', stroke: 'face', sw: 3.1 },
  ],

  // ── Pillars & chrome ───────────────────────────────────────────────────────
  sliders: [
    { k: 'path', d: 'M7 13 L41 13', stroke: 'glyph', sw: 3.6, o: 0.32 },
    { k: 'path', d: 'M7 24 L41 24', stroke: 'glyph', sw: 3.6, o: 0.32 },
    { k: 'path', d: 'M7 35 L41 35', stroke: 'glyph', sw: 3.6, o: 0.32 },
    { k: 'circle', cx: 32, cy: 13, r: 5.6, fill: 'glyph' },
    { k: 'circle', cx: 16, cy: 24, r: 5.6, fill: 'glyph' },
    { k: 'circle', cx: 35, cy: 35, r: 5.6, fill: 'glyph' },
  ],
  trend: [
    { k: 'rect', x: 7, y: 32, w: 7, h: 10, rx: 2, fill: 'glyph', o: 0.32 },
    { k: 'rect', x: 20.5, y: 28, w: 7, h: 14, rx: 2, fill: 'glyph', o: 0.32 },
    { k: 'rect', x: 34, y: 24, w: 7, h: 18, rx: 2, fill: 'glyph', o: 0.32 },
    { k: 'path', d: 'M8 22 L18 12 L26 18 L41 5', stroke: 'glyph', sw: 4 },
    { k: 'path', d: 'M31 5 L42 5 L42 16', stroke: 'glyph', sw: 4 },
  ],
  clock: [
    { k: 'circle', cx: 24, cy: 24, r: 19, stroke: 'glyph', sw: 3.6 },
    { k: 'path', d: 'M24 24 L24 12', stroke: 'glyph', sw: 3.6 },
    { k: 'path', d: 'M24 24 L33 29', stroke: 'glyph', sw: 3.6 },
    { k: 'circle', cx: 24, cy: 24, r: 2.6, fill: 'glyph' },
  ],

  // ── Theme picker ───────────────────────────────────────────────────────────
  moon: [
    {
      k: 'path',
      d: 'M40 30 A 18 18 0 1 1 20 8 A 14 14 0 0 0 40 30 Z',
      fill: 'glyph',
    },
    { k: 'circle', cx: 36, cy: 11, r: 2.4, fill: 'glyph', o: 0.4 },
    { k: 'circle', cx: 41, cy: 18, r: 1.6, fill: 'glyph', o: 0.4 },
  ],
  // ── Set feedback ───────────────────────────────────────────────────────────
  // A four-step effort meter. The four answers to "how did that feel" are a
  // scale, so they get one picture at four levels rather than four unrelated
  // emoji — which is what made that prompt look like a different app.
  // Unfilled steps stay visible at low opacity so the position on the scale is
  // legible, not just the height.
  effort1: effortMeter(1),
  effort2: effortMeter(2),
  effort3: effortMeter(3),
  effort4: effortMeter(4),

  // ── First-run chrome ───────────────────────────────────────────────────────
  // Three drawings that replace the last stock Ionicons standing in as
  // illustration on the screens a new user meets before they have trained once:
  // the tour's invitation, the offer between the showcase and the paywall, and
  // the assistant's all-clear.

  /**
   * A compass rose: the tour's "let's go and have a look round".
   *
   * The needle is a rhombus split along its own axis, one half lit and one half
   * shaded, which is how a real compass needle is painted. Drawn first as a
   * small pointer inside a filled ring and it vanished into it — a needle has
   * to be the biggest thing in the circle or the icon is just a circle.
   */
  compass: [
    { k: 'circle', cx: 24, cy: 24, r: 20, fill: 'glyph', o: 0.24 },
    { k: 'circle', cx: 24, cy: 24, r: 20, stroke: 'glyph', sw: 3.2 },
    { k: 'path', d: 'M34.5 13.5 L27.2 27.2 L20.8 20.8 Z', fill: 'glyph' },
    { k: 'path', d: 'M13.5 34.5 L20.8 20.8 L27.2 27.2 Z', fill: 'glyph', o: 0.55 },
  ],

  /** A wrapped box with a ribbon, for the trial offer. */
  gift: [
    { k: 'rect', x: 6, y: 19, w: 36, h: 23, rx: 3.5, fill: 'glyph', o: 0.32 },
    { k: 'rect', x: 4, y: 14, w: 40, h: 9, rx: 3, fill: 'glyph' },
    { k: 'rect', x: 20.5, y: 14, w: 7, h: 28, rx: 1.5, fill: 'glyph' },
    { k: 'path', d: 'M24 14 C24 8 20 4 16 6 C12.5 7.8 14.5 13 24 14 Z', fill: 'glyph' },
    { k: 'path', d: 'M24 14 C24 8 28 4 32 6 C35.5 7.8 33.5 13 24 14 Z', fill: 'glyph' },
  ],

  /** A four-point star with two smaller companions: something new to read. */
  sparkle: [
    {
      k: 'path',
      d: 'M20 6 C21.4 15.6 24.4 18.6 34 20 C24.4 21.4 21.4 24.4 20 34 C18.6 24.4 15.6 21.4 6 20 C15.6 18.6 18.6 15.6 20 6 Z',
      fill: 'glyph',
    },
    {
      k: 'path',
      d: 'M35 27 C35.8 31.2 36.8 32.2 41 33 C36.8 33.8 35.8 34.8 35 39 C34.2 34.8 33.2 33.8 29 33 C33.2 32.2 34.2 31.2 35 27 Z',
      fill: 'glyph',
      o: 0.42,
    },
    {
      k: 'path',
      d: 'M12 33 C12.5 35.6 13.4 36.5 16 37 C13.4 37.5 12.5 38.4 12 41 C11.5 38.4 10.6 37.5 8 37 C10.6 36.5 11.5 35.6 12 33 Z',
      fill: 'glyph',
      o: 0.42,
    },
  ],

  /** A ribboned medal, for anywhere achievements are named. */
  medal: [
    { k: 'path', d: 'M14 4 L21 4 L26.5 17 L19.5 17 Z', fill: 'glyph', o: 0.42 },
    { k: 'path', d: 'M34 4 L27 4 L21.5 17 L28.5 17 Z', fill: 'glyph', o: 0.42 },
    { k: 'path', d: seal(14, 16, 13.4, 30), fill: 'glyph', o: 0.34 },
    { k: 'circle', cx: 24, cy: 30, r: 11.6, fill: 'glyph' },
    {
      k: 'path',
      d: 'M24 23 L26 27.6 L31 28.2 L27.3 31.6 L28.3 36.5 L24 34 L19.7 36.5 L20.7 31.6 L17 28.2 L22 27.6 Z',
      fill: 'face',
    },
  ],

  sun: [
    { k: 'circle', cx: 24, cy: 24, r: 10, fill: 'glyph' },
    { k: 'path', d: 'M24 3 L24 9', stroke: 'glyph', sw: 3.4, o: 0.7 },
    { k: 'path', d: 'M24 39 L24 45', stroke: 'glyph', sw: 3.4, o: 0.7 },
    { k: 'path', d: 'M3 24 L9 24', stroke: 'glyph', sw: 3.4, o: 0.7 },
    { k: 'path', d: 'M39 24 L45 24', stroke: 'glyph', sw: 3.4, o: 0.7 },
    { k: 'path', d: 'M9.2 9.2 L13.4 13.4', stroke: 'glyph', sw: 3.4, o: 0.7 },
    { k: 'path', d: 'M34.6 34.6 L38.8 38.8', stroke: 'glyph', sw: 3.4, o: 0.7 },
    { k: 'path', d: 'M9.2 38.8 L13.4 34.6', stroke: 'glyph', sw: 3.4, o: 0.7 },
    { k: 'path', d: 'M34.6 13.4 L38.8 9.2', stroke: 'glyph', sw: 3.4, o: 0.7 },
  ],
};
