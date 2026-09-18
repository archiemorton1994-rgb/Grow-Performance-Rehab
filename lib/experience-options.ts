/**
 * THE FOUR LEVELS, IN ARCHIE'S WORDS, IN ONE PLACE.
 *
 * WHY THIS FILE EXISTS
 * ────────────────────
 * Three screens let somebody say how experienced they are, and until now all
 * three carried their own wording and their own list:
 *
 *   sign-up                 "Just getting started" / "1-3 years training"
 *   Profile, edit sheet     "Beginner" / "1-3 years consistent training"
 *   Programme hub, level    "New to it" / "1 to 3 yrs"
 *
 * Three lists is three chances to disagree, and they already did in the way
 * that costs the most: the engine gained a fourth level, Athlete, and none of
 * the three pickers could show it. A level a control cannot draw is a level
 * somebody is demoted out of by tapping the segment next to it, because the
 * segment they are actually on is not on screen to tap.
 *
 * So the list is built FROM `EXPERIENCE_LEVELS`, which is the store's own
 * union. A fifth level added there appears in every picker at once, and a
 * missing description is a typecheck error rather than a blank card.
 *
 * THE WORDS ARE THE SPECIFICATION
 * ───────────────────────────────
 * The four descriptions are Archie's, copied from docs/EXERCISE-LIBRARY.md,
 * and they are what the person is actually choosing between. They are not
 * marketing copy to be improved: "Regular exerciser (1-2 years)" is the line a
 * physiotherapist wrote to sort people onto the right movement ladder, and
 * tests/onboarding-pager.check.mjs holds all four to the letter.
 *
 * No React and no react-native import, so a check can read the real list.
 */
import { EXPERIENCE_LEVELS, type ExperienceLevel } from './store';

/** The word for each level, wherever one is shown to somebody. */
export const EXPERIENCE_LABELS: Record<ExperienceLevel, string> = {
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
  athlete: 'Athlete',
};

/**
 * What each level MEANS, which is the half that does the choosing.
 *
 * "Advanced" on its own is a word people rate themselves on. "Experienced
 * lifter (3+ years)" is a fact about them, and the answer changes which
 * movements the app will ever put in front of them, so the fact is the one
 * worth asking about.
 */
export const EXPERIENCE_DESCRIPTIONS: Record<ExperienceLevel, string> = {
  beginner: 'Brand new to working out',
  intermediate: 'Regular exerciser (1-2 years)',
  advanced: 'Experienced lifter (3+ years)',
  athlete: 'Training for sport or peak performance',
};

export interface ExperienceOption {
  value: ExperienceLevel;
  label: string;
  description: string;
}

/**
 * The cards, in the store's own order: easiest first, hardest last.
 *
 * Mapped rather than hand-written, so the order here cannot drift from the
 * order every experience-keyed table in the engine is written in.
 */
export const EXPERIENCE_OPTIONS: ExperienceOption[] = EXPERIENCE_LEVELS.map((value) => ({
  value,
  label: EXPERIENCE_LABELS[value],
  description: EXPERIENCE_DESCRIPTIONS[value],
}));
