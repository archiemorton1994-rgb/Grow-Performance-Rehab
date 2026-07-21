import { type PainRegion } from './store';

/**
 * Toggles a pain-region filter value.
 *
 * - If `next` equals `prev`, clears the filter (returns null).
 * - Otherwise sets the filter to `next` (or null if `next` is undefined).
 *
 * Shared by the pain-pill onPainRegionPress handler and the BodyDiagram
 * onSelect handler in the Stats tab, keeping both tap paths consistent.
 */
export function togglePainFilter(
  prev: PainRegion | null,
  next: PainRegion | null | undefined
): PainRegion | null {
  return next === prev ? null : (next ?? null);
}
