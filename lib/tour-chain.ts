/**
 * THE ORDER THE GUIDED TOUR ACTUALLY WALKS, IN ONE PLACE.
 *
 * It is not the tab-bar order. The tab bar is Home, Profile, Train, Restore,
 * Stats (indices 0..4); the tour goes Home, Train, Restore, Stats, Profile,
 * because you learn to train before you learn where the settings live.
 *
 * Until now that order existed only as five hardcoded setTourActiveTab(N) calls
 * in five different files, with nothing anywhere stating the sequence. That was
 * survivable while the tour only ever went forwards. A Back control has to know
 * what came BEFORE the current tab, and deriving that from `tab - 1` gives the
 * wrong answer for every tab in the chain.
 *
 * Pure, so tests run it rather than reading five files and hoping.
 */

/** Tab-bar indices, in the order the tour visits them. */
export const TOUR_CHAIN = [0, 2, 3, 4, 1] as const;

export type TourTab = (typeof TOUR_CHAIN)[number];

/**
 * The tab the tour was on before this one, or null if this is the first.
 *
 * Returns null for anything not in the chain too, so a caller that is handed a
 * stale index hides its Back control rather than jumping somewhere arbitrary.
 */
export function previousTourTab(tab: number | null): number | null {
  if (tab === null) return null;
  const i = TOUR_CHAIN.indexOf(tab as TourTab);
  if (i <= 0) return null;
  return TOUR_CHAIN[i - 1];
}

/**
 * Where a Back press should land, given which tab is showing and which of its
 * cards is up.
 *
 * Two answers, and the difference is the whole reason this exists:
 *   - not on the first card: the previous card of the same tab
 *   - on the first card: the LAST card of the previous tab
 *
 * `null` means there is nowhere to go, and the control should not be rendered
 * at all. That is the very first card of the whole tour.
 */
export type TourBackTarget =
  | { kind: 'step'; step: number }
  | { kind: 'tab'; tab: number }
  | null;

export function tourBackTarget(tab: number | null, step: number | null): TourBackTarget {
  if (step === null) return null;
  if (step > 0) return { kind: 'step', step: step - 1 };
  const prev = previousTourTab(tab);
  return prev === null ? null : { kind: 'tab', tab: prev };
}

/**
 * Which card to open when a tab is entered.
 *
 * Every tab's entry effect hardcoded `setTutStep(0)` 300ms after the tour
 * arrived, which is right going forwards and wrong going back: arriving at
 * Restore from Stats by pressing Back would drop the user on Restore's FIRST
 * card and make them walk the whole tab again to get where they were.
 *
 * The flag that distinguishes the two is deliberately not persisted - a killed
 * app restarts the tour from its intro, not mid-step.
 */
export function entryStepFor(enterAtLastStep: boolean, stepCount: number): number {
  return enterAtLastStep ? Math.max(0, stepCount - 1) : 0;
}
