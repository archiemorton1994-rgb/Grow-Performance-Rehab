/**
 * Within-session load auto-regulation.
 *
 * WHAT THIS IS FOR
 * ────────────────
 * After each set the user answers one question — Easy, Challenging, or Too Hard
 * — and the weight offered for the NEXT set moves accordingly. Before this, the
 * answer only ever affected the *next session*: every set in the current
 * exercise was prefilled from the same prescription regardless of how the last
 * one actually went, so someone who found set 1 far too heavy was handed the
 * identical number again for set 2.
 *
 * THE RULES, WHICH ARE DELIBERATELY BORING
 * ────────────────────────────────────────
 * KPI lifts (squat/bench/deadlift) arrive with a planned ramp derived from the
 * user's 1RM — warm-ups climbing to a top set around 80-85%. So:
 *
 *   Easy        → move up to the next rung of that ramp
 *   Challenging → hold the weight that was just lifted
 *   Too Hard    → drop back to the last set that went well, and stop climbing
 *
 * Accessories have no 1RM to derive anything from, so the first set is whatever
 * the user puts in and the rest move off that:
 *
 *   Easy        → +10%
 *   Challenging → hold
 *   Too Hard    → -10%
 *
 * THE GUARDRAIL
 * ─────────────
 * The app must never increase the load after "Challenging" or "Too Hard". Both
 * of those are the user saying they are at or past their limit, and answering
 * that honestly must never be punished with more weight. Two things enforce it:
 * each branch above, and `capKg` — once "Too Hard" has been said on an
 * exercise, every later set in that exercise is ceilinged at the backed-off
 * weight, so a single "Easy" on a lighter set cannot send it climbing again.
 *
 * Everything here returns a SUGGESTION. It lands in the weight field as a
 * prefill and the user can type over it. Nothing is forced.
 */

/**
 * The three answers. Deliberately not the same type as `FeedbackRating` in the
 * store: that one describes how a whole exercise went and drives NEXT SESSION's
 * prescription, this one describes a single set and drives the next set. They
 * are related (see feedbackRatingFor below) but they are not the same question.
 */
export type SetFeedback = 'easy' | 'challenging' | 'too_hard';

export interface SetOutcome {
  /** What was actually lifted on this set, kg. 0 for bodyweight/band work. */
  loggedKg: number;
  /** The answer given, or null when the set was logged without answering. */
  feedback: SetFeedback | null;
}

export interface LoadPlan {
  /**
   * True when the prescription is a ramp built from a known 1RM — the KPI
   * lifts. False for accessories, where every set carries the same target and
   * there is no "next rung" to climb to.
   */
  isRamped: boolean;
  /** The prescribed weight for each set, in order. Zeroes mean "no guide". */
  plannedKg: number[];
  /** Completed sets in order. May be shorter than plannedKg. */
  outcomes: SetOutcome[];
}

export type SuggestionReason =
  | 'planned' // following the prescription; nothing to adjust from yet
  | 'ramp_up' // climbing the ramp after "Easy"
  | 'increase' // accessory +10% after "Easy"
  | 'hold' // "Challenging" — same weight again
  | 'back_off' // "Too Hard" — down to the last set that went well
  | 'decrease' // accessory -10% after "Too Hard"
  | 'capped'; // held down by an earlier "Too Hard" on this exercise

export interface SetSuggestion {
  kg: number;
  reason: SuggestionReason;
  /** One short line for the UI, or null when the plan is simply being followed. */
  note: string | null;
}

/**
 * Weight increments that match how plates and dumbbells actually come.
 *
 * The rest of the app rounds everything to 2.5 kg, which is right for a loaded
 * barbell and wrong for a 5 kg lateral raise: 10% of 5 kg is 0.5 kg, which
 * rounds to zero change, so "Easy" would do nothing at all on exactly the
 * exercises where light dumbbells are used. Below 10 kg the smallest useful
 * step is 0.5 kg; the middle band covers fixed dumbbells and most cable stacks.
 */
export function loadStepKg(kg: number): number {
  if (kg < 10) return 0.5;
  if (kg < 25) return 1;
  return 2.5;
}

/** Rounds to a sensible increment and guarantees the move actually happens. */
export function adjustKg(kg: number, factor: number): number {
  if (kg <= 0) return 0;
  const step = loadStepKg(kg);
  let out = Math.round((kg * factor) / step) * step;
  // A percentage change that rounds back onto the starting weight is a change
  // the user asked for and did not get. Force one increment instead.
  if (factor > 1 && out <= kg) out = kg + step;
  if (factor < 1 && out >= kg) out = kg - step;
  return Math.max(step, parseFloat(out.toFixed(2)));
}

const EASY_STEP = 1.1;
const TOO_HARD_STEP = 0.9;

/**
 * The ceiling imposed by any "Too Hard" already given on this exercise.
 *
 * This is the second half of the guardrail. Without it, a user who says Too
 * Hard on set 2 (dropping to set 1's weight) and then finds that lighter set
 * Easy would be sent straight back up to the weight they had just failed.
 * Returns null when no ceiling applies.
 */
function ceilingKg(plan: LoadPlan, upToSetIndex: number): number | null {
  let cap: number | null = null;
  for (let i = 0; i < upToSetIndex && i < plan.outcomes.length; i++) {
    if (plan.outcomes[i]?.feedback !== 'too_hard') continue;
    // The weight we backed off TO is the ceiling from here on.
    const backedOffTo = backOffTarget(plan, i);
    cap = cap === null ? backedOffTo : Math.min(cap, backedOffTo);
  }
  return cap;
}

/** Where "Too Hard" on `setIndex` lands: the last set before it that went well. */
function backOffTarget(plan: LoadPlan, setIndex: number): number {
  const failedAt = weightOf(plan, setIndex);
  for (let i = setIndex - 1; i >= 0; i--) {
    const prior = plan.outcomes[i];
    if (!prior || prior.feedback === 'too_hard') continue;
    const kg = prior.loggedKg > 0 ? prior.loggedKg : (plan.plannedKg[i] ?? 0);
    if (kg > 0 && kg < failedAt) return kg;
  }
  // Nothing earlier to fall back to (they failed the first set): take 10% off.
  return adjustKg(failedAt, TOO_HARD_STEP);
}

/** What was actually on the bar for a set — logged if known, else prescribed. */
function weightOf(plan: LoadPlan, setIndex: number): number {
  const logged = plan.outcomes[setIndex]?.loggedKg ?? 0;
  return logged > 0 ? logged : (plan.plannedKg[setIndex] ?? 0);
}

/**
 * The weight to offer for `setIndex`, given everything logged before it.
 *
 * Pure and total: safe to call for any index, including ones with no history.
 */
export function suggestSetWeight(plan: LoadPlan, setIndex: number): SetSuggestion {
  const planned = plan.plannedKg[setIndex] ?? 0;

  // Nothing has happened yet, so there is nothing to regulate against.
  const prev = setIndex > 0 ? plan.outcomes[setIndex - 1] : undefined;
  if (setIndex === 0 || !prev) {
    return { kg: planned, reason: 'planned', note: null };
  }

  const base = weightOf(plan, setIndex - 1);
  if (base <= 0) return { kg: planned, reason: 'planned', note: null };

  const cap = ceilingKg(plan, setIndex);
  const withCap = (kg: number, reason: SuggestionReason, note: string | null): SetSuggestion => {
    if (cap !== null && kg > cap) {
      return {
        kg: cap,
        reason: 'capped',
        note: 'Held at your backed-off weight for the rest of this exercise',
      };
    }
    return { kg, reason, note };
  };

  switch (prev.feedback) {
    case 'too_hard': {
      const kg = plan.isRamped
        ? backOffTarget(plan, setIndex - 1)
        : adjustKg(base, TOO_HARD_STEP);
      return {
        kg,
        reason: plan.isRamped ? 'back_off' : 'decrease',
        note: plan.isRamped
          ? 'Eased back to your last good set — no more increases this exercise'
          : 'Down 10% — no more increases this exercise',
      };
    }

    case 'challenging':
      // The whole point of the guardrail. Saying a set was hard must never be
      // answered with more weight, ramp or no ramp.
      return withCap(base, 'hold', 'Same weight again — you said that one was challenging');

    case 'easy': {
      if (!plan.isRamped) {
        return withCap(adjustKg(base, EASY_STEP), 'increase', 'Up 10% — that one felt easy');
      }
      // Climb to the next rung of the planned ramp, but keep the user's own
      // scale: someone lifting above or below the prescription should have the
      // rest of their ramp shifted with them, not snapped back to the plan.
      const prevPlanned = plan.plannedKg[setIndex - 1] ?? 0;
      const ratio = prevPlanned > 0 ? base / prevPlanned : 1;
      const scaled = planned > 0 ? adjustKg(planned * ratio, 1) : 0;
      const kg = scaled > base ? scaled : adjustKg(base, EASY_STEP);
      return withCap(kg, 'ramp_up', 'Up to your next working weight');
    }

    default: {
      // Logged without answering. Follow the plan for a ramp; for an accessory
      // hold what they lifted, because with no signal there is no case for
      // adding weight — and holding is never the unsafe choice.
      if (!plan.isRamped) return withCap(base, 'hold', null);
      const prevPlanned = plan.plannedKg[setIndex - 1] ?? 0;
      const ratio = prevPlanned > 0 ? base / prevPlanned : 1;
      const scaled = planned > 0 ? adjustKg(planned * ratio, 1) : base;
      return withCap(Math.max(scaled, base), 'planned', null);
    }
  }
}

/**
 * How a set answer feeds the NEXT SESSION's prescription.
 *
 * The store's FeedbackRating has three levels and this question has three
 * buttons, but they do not line up one-to-one:
 *
 *   - "Challenging" means the prescription was right, which is not feedback
 *     that anything should change. It maps to nothing.
 *   - "Easy" once is a nudge. "Easy" on two or more sets of the same exercise
 *     is the user telling us twice, and earns the bigger next-session jump that
 *     'very_easy' triggers. This is how the four-button scale's top rung
 *     survives the move to three buttons — inferred from repetition rather than
 *     asked for directly.
 *   - "Too Hard" maps to 'hard', which holds or reduces next session.
 */
export function feedbackRatingFor(answers: SetFeedback[]): 'very_easy' | 'easy' | 'hard' | null {
  if (answers.includes('too_hard')) return 'hard';
  const easyCount = answers.filter((a) => a === 'easy').length;
  if (easyCount >= 2) return 'very_easy';
  if (easyCount === 1) return 'easy';
  return null;
}

/** Button labels, fixed in one place so the UI and the tests cannot drift. */
export const SET_FEEDBACK_LABELS: Record<SetFeedback, string> = {
  easy: 'Easy',
  challenging: 'Challenging',
  too_hard: 'Too Hard',
};
