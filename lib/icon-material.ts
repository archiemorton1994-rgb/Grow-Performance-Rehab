/**
 * MATERIAL FOR THE ICON SET — the thing that separates "drawn for this app"
 * from "an icon pack, tinted green".
 *
 * WHY THIS EXISTS
 * ───────────────
 * The badge medallions were rebuilt into struck metal: a gradient with a light
 * direction, a rim that catches that light, a glossed face. They look made. Put
 * one next to an onboarding icon and the icon looks like a placeholder, because
 * that is exactly what a flat single-colour silhouette reads as — the same
 * green at the same weight everywhere, no light, no depth, no surface.
 *
 * The fix is not new drawings. The shapes in lib/icon-art.ts are fine. What
 * they lacked was material, and material is the medallion's vocabulary applied
 * one level down:
 *
 *   - the glyph carries a gradient, not a fill, so light comes from somewhere
 *   - one light source for the WHOLE icon, so the parts agree with each other
 *   - the depth tone becomes a deeper ink rather than the same ink half-erased
 *   - where an icon sits in a tile, the tile gets a face gradient, a rim and a
 *     gloss, exactly as the medallion's face does
 *
 * WHY THE GRADIENT GEOMETRY IS NOT NEGOTIABLE
 * ───────────────────────────────────────────
 * GLYPH_GRADIENT_BOX is in userSpaceOnUse coordinates over the 48 box, and the
 * first build of this did not do that. With SVG's default objectBoundingBox
 * units a gradient is UNDEFINED on any shape whose bounding box has zero width
 * or height, and the shape does not degrade — it disappears. Every straight
 * line in the set is such a shape. The dumbbell lost its bar, the clock lost
 * both hands, the flag lost its pole, the sun lost every ray, the rehab shield
 * lost its cross and the female symbol lost its stem and crossbar.
 *
 * None of that looked broken. It looked like a slightly simpler icon. It was
 * caught by rasterising the set and looking at it, and tests/grow-icon.check.mjs
 * now holds the line.
 *
 * Everything here is pure and free of react-native imports, so the tests RUN it
 * rather than pattern-matching the component that calls it.
 */

/** The glyph art box. Shapes in lib/icon-art.ts are drawn inside 0..48. */
export const ICON_BOX = 48;

/**
 * Light from the upper left, across the whole 48 box, in user space.
 *
 * Read the module docblock before changing this to percentages.
 */
export const GLYPH_GRADIENT_BOX = { x1: 4, y1: 2, x2: 40, y2: 46 } as const;

/**
 * Depth shapes are authored at low opacity in lib/icon-art.ts. Anything at or
 * below this is treated as the receding tone and painted in the deeper ink.
 *
 * 0.62 rather than a round 0.5 because the art uses 0.6 for the middle bar of
 * the `chart` glyph, which is a receding element and has to read as one.
 */
export const DEEP_TONE_MAX_OPACITY = 0.62;

/** Below this an icon is UI chrome, not illustration: no tile decoration, and
 *  the gradient is sub-pixel anyway. Mirrors BadgeMedallion's DETAIL_MIN_SIZE. */
export const MATERIAL_MIN_SIZE = 20;

// ── colour maths ────────────────────────────────────────────────────────────

function channels(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const full =
    h.length === 3
      ? h
          .split('')
          .map((c) => c + c)
          .join('')
      : h;
  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16),
  ];
}

const clamp255 = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
const pair = (v: number) => clamp255(v).toString(16).padStart(2, '0');

/**
 * Mix a hex colour toward white (amount > 0) or black (amount < 0).
 *
 * Returns the input unchanged if it is not a hex colour this understands, so a
 * theme token that is ever an rgba() string tints nothing rather than rendering
 * `#NaNNaNNaN` and taking the icon with it.
 */
export function shade(hex: string, amount: number): string {
  if (!/^#?(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(hex.trim())) return hex;
  const [r, g, b] = channels(hex.trim());
  if (!Number.isFinite(r) || !Number.isFinite(g) || !Number.isFinite(b)) return hex;
  const target = amount > 0 ? 255 : 0;
  const p = Math.min(1, Math.abs(amount));
  return `#${pair(r + (target - r) * p)}${pair(g + (target - g) * p)}${pair(b + (target - b) * p)}`;
}

/** sRGB relative luminance, 0 (black) to 1 (white). */
export function relativeLuminance(hex: string): number {
  const [r, g, b] = channels(shade(hex, 0));
  const lin = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/**
 * Ink for a shape that has to sit ON TOP of a solid glyph, not beside it.
 *
 * lib/icon-art.ts's docblock says the icon set has no `face` ink, because these
 * icons sit on arbitrary backgrounds and a cut-out has to know what is behind
 * it. That was true while every shape was flat. It stops being true for a shape
 * drawn over another shape whose colour we set ourselves — the tick on the
 * `check` seal is over the seal's own face, and that face is exactly `color`.
 *
 * So this picks the tint that will actually be legible on it: a near-white
 * version of the accent over a dark green, a near-black one over a bright
 * green. Tints of the accent rather than plain white and black, because a pure
 * white tick on a brand-green medal looks like a sticker.
 *
 * The 0.32 threshold is where #2f6b46 (the light theme's accent, luminance
 * ~0.13) and #4ade80 (the dark theme's, ~0.58) fall on opposite sides with room
 * to spare.
 */
export function faceInkFor(color: string): string {
  return relativeLuminance(color) > 0.32 ? shade(color, -0.74) : shade(color, 0.88);
}

// ── the two glyph ramps ─────────────────────────────────────────────────────

export interface GradientStop {
  offset: number;
  color: string;
}

/** The main mass: a light face, the accent itself, and a shaded far edge. */
export function glyphStops(color: string): GradientStop[] {
  return [
    { offset: 0, color: shade(color, 0.3) },
    { offset: 0.5, color },
    { offset: 1, color: shade(color, -0.22) },
  ];
}

/** The receding tone, lit from the same direction so the two agree. */
export function deepStops(color: string): GradientStop[] {
  return [
    { offset: 0, color },
    { offset: 1, color: shade(color, -0.38) },
  ];
}

/** True when this shape was authored as the receding tone. */
export function isDeepTone(opacity: number | undefined): boolean {
  return opacity != null && opacity <= DEEP_TONE_MAX_OPACITY;
}

/**
 * What a depth shape's opacity becomes once it is painted in the deeper ink.
 *
 * It goes UP, but not to solid. The old art leaned on opacity alone to push a
 * shape back, which at 0.3 reads as half-erased rather than behind. A darker
 * ink does that job properly, so the alpha can rise and the shape can have
 * mass — but the authored value still sets the order, because these shapes mean
 * different things: the wash behind the `check` circle is not the same kind of
 * object as the short bar in `chart`, and flattening both to one number turned
 * the celebration tick into a dark disc.
 */
export function deepToneOpacity(authored: number | undefined): number {
  return Math.min(0.78, (authored ?? 1) * 1.6);
}

// ── the tile ────────────────────────────────────────────────────────────────

/** The tile is drawn in a 100 box, as the medallions are. */
export const TILE_BOX = 100;

/** Glyph inset into the tile, leaving the rim and the gloss clear. */
export const TILE_GLYPH_INSET = 22;

export interface TileInk {
  /** Lit edge of the tile face. */
  faceLight: string;
  /** Shaded edge of the tile face. */
  faceDark: string;
  /** The hairline that separates the tile from what is behind it. */
  rim: string;
}

/**
 * A tile face, from one background token.
 *
 * The spread is deliberately narrow. This sits behind a glyph and has to stay
 * a surface: widen it and the tile starts competing with the thing it holds.
 *
 * THE AMOUNTS ARE SCALED BY HOW LIGHT THE FACE ALREADY IS, and that is not
 * fussiness. A fixed ±15% mix is not a fixed amount of visible light, because
 * luminance is not linear: on the dark theme's #1a3d28 it spanned 0.065 of
 * luminance and on the light theme's #e8f2ec the same numbers spanned 0.271 —
 * four times as much. The two themes were getting two different materials, the
 * light one glossy and the dark one nearly flat, from one line of code.
 *
 * Scaling by (1 - k·L) pulls them to within about a factor of two, which is
 * close enough that both read as the same object under the same lamp.
 */
export function tileInk(face: string): TileInk {
  const damp = 1 - 0.72 * relativeLuminance(face);
  return {
    faceLight: shade(face, 0.16 * damp),
    faceDark: shade(face, -0.14 * damp),
    rim: shade(face, 0.3 * damp),
  };
}

/**
 * Gradient ids are document-global on web, where every icon on a screen lands
 * in one DOM. Keying each id on exactly the colour that defines it means two
 * icons either use different ids or are asking for byte-identical gradients —
 * the same rule, and the same reason, as BadgeMedallion's `uid`.
 */
export function gradientId(prefix: string, color: string): string {
  return `${prefix}-${color.replace(/[^a-zA-Z0-9]/g, '')}`;
}
