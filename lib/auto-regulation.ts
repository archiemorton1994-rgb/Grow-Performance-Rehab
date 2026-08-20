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
 * user's 1RM — warm-ups climbing to a top set around 80-85%. Only the top of
 * that ramp is the working weight. Every rung below it is a stated fraction of
 * that one number, which is why the screen labels them Warm-up and Approach
 * set and tells the user they should feel easy. So:
 *
 *   Easy        → move up to the next rung, carrying any extra the user put on
 *                 the bar up with it
 *   Challenging → on the working set, hold the weight just lifted; on a rung
 *                 below it, carry on up the ramp and add nothing on top
 *   Too Hard    → drop back to the last set that went well, and stop climbing
 *
 * Accessories have no 1RM to derive anything from, so the first set is whatever
 * the user puts in and the rest move off that:
 *
 *   Easy        → +10%
 *   Challenging → hold
 *   Too Hard    → -10%
 *
 * THE GUARDRAIL, AND THE ONE PLACE IT DOES NOT BELONG
 * ───────────────────────────────────────────────────
 * The app must never answer "Challenging" or "Too Hard" on the WORKING SET with
 * more weight. That is the user saying they are at their limit on the load the
 * exercise is actually prescribed at, and answering honestly must never be
 * punished. `ceilingKg` is the second half of it: once "Too Hard" has been said
 * on an exercise, every later set is ceilinged at the backed-off weight, so a
 * single "Easy" on a lighter set cannot send it climbing again.
 *
 * Applying the same rule to a warm-up was catastrophic, and it is why this file
 * reads the way it does. A lifter with a 102.5 kg squat is offered 40 kg for
 * set 1 of 6. Reading "that felt challenging" as "hold 40 kg" handed them 40 kg
 * for every remaining set, the one labelled WORKING SET included — and the
 * heaviest weight of a session is what gets filed as the exercise's anchor, so
 * the next session's ramp was built from 40 kg and the same answer flattened
 * that too. Four sessions took the lift to an empty bar with nothing on screen
 * explaining why. A warm-up is a fraction of the working weight by
 * construction, so what the user says about one is not a claim about the
 * working weight and must not be able to delete it. The answer that backs a
 * warm-up off is "Too Hard", and it still does.
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
  | 'ramp_hold' // "Challenging" on a warm-up — next rung, nothing added on top
  | 'increase' // accessory +10% after "Easy"
  | 'hold' // "Challenging" on the working set — same weight again
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
 * The set that carries the working weight — the top of the ramp.
 *
 * This is the same set the bar labels "Working set" and the per-set guide calls
 * "your one quality set". Everything below it is a share of that number, so an
 * answer given there is an answer about a share.
 */
function workingSetIndex(plan: LoadPlan): number {
  return Math.max(0, plan.plannedKg.length - 1);
}

/**
 * The next rung of a ramp, kept on the scale the user is actually lifting at.
 *
 * Someone lifting above or below the prescription should have the rest of their
 * ramp shifted with them rather than snapped back to the plan. `allowAbovePlan`
 * is the only thing separating Easy from Challenging here: Easy may carry a
 * heavier-than-planned warm-up upward, Challenging follows the plan and refuses
 * to add anything to it.
 */
function rampRungKg(
  plan: LoadPlan,
  setIndex: number,
  base: number,
  allowAbovePlan: boolean
): number {
  const planned = plan.plannedKg[setIndex] ?? 0;
  const prevPlanned = plan.plannedKg[setIndex - 1] ?? 0;
  const ratio = prevPlanned > 0 ? base / prevPlanned : 1;
  const scaled = planned > 0 ? adjustKg(planned * ratio, 1) : 0;
  if (allowAbovePlan) return scaled > base ? scaled : adjustKg(base, EASY_STEP);
  if (planned <= 0) return base;
  return Math.min(planned, scaled > 0 ? scaled : planned);
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
      // "No more increases this exercise" is a promise about the sets still to
      // come. On the last set there are none, and the line read as a warning
      // about something that could not happen.
      const more =
        setIndex < plan.plannedKg.length - 1 ? ' — no more increases this exercise' : '';
      return {
        kg,
        reason: plan.isRamped ? 'back_off' : 'decrease',
        note: plan.isRamped ? `Eased back to your last good set${more}` : `Down 10%${more}`,
      };
    }

    case 'challenging': {
      // On an accessory every set carries the same target, so holding the
      // weight is holding the prescription. On a ramp it is only the working
      // set that carries the prescription; below it, holding the number would
      // throw the rest of the ramp away — see the header.
      if (!plan.isRamped || setIndex - 1 >= workingSetIndex(plan)) {
        return withCap(base, 'hold', 'Same weight again — you said that one was challenging');
      }
      return withCap(
        rampRungKg(plan, setIndex, base, false),
        'ramp_hold',
        'Still warming up — on to your next planned weight'
      );
    }

    case 'easy': {
      if (!plan.isRamped) {
        return withCap(adjustKg(base, EASY_STEP), 'increase', 'Up 10% — that one felt easy');
      }
      return withCap(
        rampRungKg(plan, setIndex, base, true),
        'ramp_up',
        'Up to your next working weight'
      );
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
 *
 * "Easy" is read only off the working sets. A ramped lift is built as fractions
 * of one working weight — every set but the last is a share of it, which is why
 * the screen labels them "Warm-up" and the guide tells the user they will feel
 * easy. An honest answer to those is therefore "Easy" every single time, and
 * counting them handed out the largest next-session jump every session while
 * leaving the ordinary step reachable only by calling a warm-up challenging.
 * Anything with no ramp carries the same target on every set, so all of its
 * answers count.
 *
 * Which leaves a ramp with exactly one set that can say anything, so "twice"
 * can never happen on one — and requiring it made the top rung unreachable on
 * every KPI lift in the app while the summary screen went on promising "you
 * rated a set Easy — the biggest jump, 5 to 7.5 kg". Enumerated: no run of
 * answers on a six-set ramp could return 'very_easy'. So on a ramp the top set
 * going easy is not a nudge, it is the whole signal, and it earns the whole
 * jump. The +5 rung is still reachable there through a run of clean sessions.
 *
 * "Too Hard" is never thrown away, but on a ramp it is read against what was
 * actually lifted afterwards. One question settles it: DID THEY GET PAST IT?
 *
 *   working set came in at or above the weight they refused  —  they got past it
 *   working set came in under it, or was never answered      —  it stands
 *
 * That closes the one place this file contradicted itself. "Easy" on a warm-up
 * was correctly ignored — it is a fraction of the working weight, so an honest
 * answer to it is Easy every time. "Too Hard" on the same warm-up failed the
 * whole lift, held the load AND counted toward the three stalled sessions that
 * earn a 10% deload. A lifter with a stiff first set who answered honestly and
 * then went on to lift their full working weight was punished for saying so;
 * the generous answer to the same set was not.
 *
 * The weights are what make this safe, and the first attempt without them was
 * wrong. "The working set was answered" is not the same as "the working set
 * carried the prescription": saying Too Hard mid-ramp backs the exercise off and
 * caps every set after it, so the working set gets answered at a REDUCED weight
 * — and reading that as "nothing to change" would have left the prescription
 * exactly where someone had just demonstrated they could not lift it. Measured on
 * a lifter with a 60 kg limit prescribed 102.5 kg: the anchor never moved.
 *
 * Two things it still cannot do. It cannot EARN anything — the best a lift with a
 * Too Hard anywhere in it can score is "nothing changes", so this is never a
 * route to more weight. And with no logged weights to check — a session resumed
 * after the answers were discarded — it cannot prove anyone got past anything, so
 * it falls back to holding the load, which is the safe direction.
 */
export function feedbackRatingFor(
  answers: (SetFeedback | null)[],
  ramp?: {
    isRamped: boolean;
    sets: number;
    /**
     * What each set actually carried, kg, in order. Optional: without it an
     * earlier "Too Hard" simply stands, which is what it did before any of this.
     */
    loggedKg?: number[];
  }
): 'very_easy' | 'easy' | 'hard' | null {
  if (ramp?.isRamped) {
    const working = Math.max(0, (ramp.sets > 0 ? ramp.sets : answers.length) - 1);
    const top = answers[working];
    if (top === 'too_hard') return 'hard';
    // The heaviest weight they refused, not the first. On a climbing ramp the
    // first Too Hard is the lightest of them, and clearing that one proves
    // nothing about the one above it.
    const heaviestRefused = answers.reduce(
      (worst, a, i) =>
        a === 'too_hard' && i !== working ? Math.max(worst, ramp.loggedKg?.[i] ?? 0) : worst,
      0
    );
    if (answers.some((a, i) => a === 'too_hard' && i !== working)) {
      const workingKg = ramp.loggedKg?.[working] ?? 0;
      const gotPastIt = heaviestRefused > 0 && workingKg >= heaviestRefused;
      return top && gotPastIt ? null : 'hard';
    }
    return top === 'easy' ? 'very_easy' : null;
  }
  if (answers.includes('too_hard')) return 'hard';
  const easyCount = answers.filter((a) => a === 'easy').length;
  if (easyCount >= 2) return 'very_easy';
  if (easyCount === 1) return 'easy';
  return null;
}

/**
 * The weight to file as an exercise's anchor once a session is over.
 *
 * The next session's prescription is built from this number, so a session that
 * happened to be light prescribes a lighter session — which then becomes the
 * lightest number on file, and so on down. That loop is what turned one honest
 * answer on a warm-up into an empty bar a fortnight later, and it stays open
 * for as long as "the heaviest thing you lifted" is treated as evidence about
 * what you CAN lift. It is not: most of the time it is just the number the app
 * itself offered.
 *
 * So the anchor moves down when the user actually said a set was too much, and
 * otherwise only ever moves up. That terminates on its own — as the weight
 * comes down it stops being too much, so the user stops saying so and the
 * anchor settles at what they can lift — where the old rule had no floor at all.
 */
export function nextAnchorKg(
  heaviestThisSession: number,
  anchorOnFile: number,
  rating: 'very_easy' | 'easy' | 'hard' | null | undefined
): number {
  if (heaviestThisSession <= 0) return anchorOnFile;
  if (anchorOnFile <= 0 || rating === 'hard') return heaviestThisSession;
  return Math.max(heaviestThisSession, anchorOnFile);
}

/** Button labels, fixed in one place so the UI and the tests cannot drift. */
export const SET_FEEDBACK_LABELS: Record<SetFeedback, string> = {
  easy: 'Easy',
  challenging: 'Challenging',
  too_hard: 'Too Hard',
};
