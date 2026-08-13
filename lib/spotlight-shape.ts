/**
 * What shape the tutorial spotlight should be.
 *
 * WHAT WENT WRONG
 * ───────────────
 * The radius was `min(width, height) / 2` unconditionally — a true pill, always.
 * That is right for an icon and wrong for everything bigger. Spotlighting the
 * 2x2 grid of session cards on the Train tab drew a 330px CIRCLE over a square
 * block of content: the corners of all four cards sat outside the highlight
 * while empty page sat inside it, and the shape drawing attention to the thing
 * disagreed with the shape of the thing. It happened at nearly every step of
 * every tab's tour, because almost everything a tour points at is a region of
 * content rather than an icon.
 *
 * THE RULE
 * ────────
 * Short side small  -> full round. The target IS a circle or a pill: a tab icon,
 *                      a streak chip, a thin progress bar.
 * Short side large  -> the app's own card corner. The target is a region.
 *
 * WHY THIS IS ITS OWN FILE
 * ────────────────────────
 * components/CoachMark.tsx imports react-native, so anything defined there can
 * be read by a test but never called by one. This is one pure function; keeping
 * it here is what lets tests/spotlight-shape.check.mjs check the shapes the
 * tours actually produce instead of checking that a line of source exists.
 */

/**
 * A target at or below this on its SHORT side is treated as icon-sized.
 *
 * 72 sits above every icon-like target the tours point at (a 44pt tab icon
 * inflated by the 6pt each caller adds is 56; an equipment pill is ~64) and
 * below every content region (the shortest is a single stat tile at ~92).
 */
export const SMALL_TARGET = 72;

/**
 * The corner for a region of content.
 *
 * Slightly larger than the 16-20 the cards themselves use, because every caller
 * inflates the measured rect by 6px on each side before handing it over — this
 * keeps the spotlight's corner roughly concentric with the corner underneath it
 * instead of cutting across it.
 */
export const REGION_RADIUS = 22;

/**
 * The spotlight's corner radius, taken from what it is pointing at.
 *
 * The two cases meet cleanly: at the threshold a full round is r=36 and a region
 * is r=22, close enough that nothing jumps as a tour steps from a chip to a card.
 */
export function autoRadius(width: number, height: number): number {
  const short = Math.min(width, height);
  return short <= SMALL_TARGET ? short / 2 : REGION_RADIUS;
}

/** How a given rect will read on screen. Used by the contract test. */
export function spotlightShape(width: number, height: number): 'round' | 'region' {
  return Math.min(width, height) <= SMALL_TARGET ? 'round' : 'region';
}
