import type { SessionType } from './store';

/**
 * "You have trained upper body four times and lower body once."
 *
 * WHAT THIS IS FOR
 * ────────────────
 * Every nudge the app had reacted to WHETHER you trained — a daily reminder, a
 * missed-workout push, a streak-at-risk alert, a stale-bodyweight prompt. None
 * reacted to WHAT you trained. Somebody doing six conditioning sessions in a
 * row, or six weeks of upper body with no legs, got exactly the same
 * encouragement as somebody with a balanced week.
 *
 * WHAT IT IS NOT
 * ──────────────
 * It is not a rule about how anyone should train. That distinction matters here
 * more than anywhere else in the app: the whole point of the inclusivity work
 * was that people get to train what they want. So this only ever fires on a gap
 * that is almost certainly unintentional, it says what it sees rather than what
 * you should do, it can be dismissed, and once dismissed it stays gone for
 * long enough to be an answer rather than a snooze.
 *
 * The three guards, in order of how much they matter:
 *
 *   1. ENOUGH EVIDENCE. Under MIN_SESSIONS in the window, no opinion. Two upper
 *      body sessions in a fortnight is not a pattern.
 *   2. A REAL GAP. The neglected area must be at zero and the busy one at
 *      MIN_DOMINANT or more. "Four versus one" is a preference; "five versus
 *      none" is the thing worth mentioning.
 *   3. THEY MUST ALREADY DO IT. An area is only ever flagged if the user has
 *      trained it before, at some point in their history. Telling a
 *      conditioning-and-mobility user they are neglecting lower body is the
 *      exact behaviour the app was criticised for.
 */

/** How far back a nudge looks. Long enough to see a habit, short enough to
 *  notice when it changes. */
export const BALANCE_WINDOW = 10;

/** Below this, the app has no opinion about anyone's balance. */
export const MIN_SESSIONS = 6;

/** How lopsided it has to be before it is worth saying anything. */
export const MIN_DOMINANT = 4;

/** Once dismissed, a nudge is gone for this long. */
export const DISMISS_DAYS = 14;

export type TrainingArea = 'upper' | 'lower' | 'recovery';

/**
 * Which area a session type trains.
 *
 * 'full_body' counts for BOTH upper and lower — otherwise somebody who trains
 * exclusively full body would be told they neglect everything. 'custom' and
 * 'conditioning' map to nothing: the app cannot know what is inside a custom
 * session, and guessing is worse than staying quiet.
 */
export const AREA_BY_SESSION: Partial<Record<SessionType, TrainingArea[]>> = {
  squat: ['lower'],
  deadlift: ['lower'],
  lower_body: ['lower'],
  bench: ['upper'],
  upper_body: ['upper'],
  full_body: ['upper', 'lower'],
  prehab: ['recovery'],
  flexibility: ['recovery'],
};

export const AREA_LABELS: Record<TrainingArea, string> = {
  upper: 'upper body',
  lower: 'lower body',
  recovery: 'recovery work',
};

/** The session the nudge offers, per area. */
export const AREA_SUGGESTION: Record<TrainingArea, SessionType> = {
  upper: 'upper_body',
  lower: 'lower_body',
  recovery: 'prehab',
};

export interface BalanceInput {
  /** Newest first, matching the store. */
  sessionTypes: SessionType[];
  /** Every session type the user has EVER completed. */
  everTrained: SessionType[];
  /** When the nudge was last dismissed, ms since epoch, or null. */
  dismissedAt: number | null;
  /** Now, in ms. Passed in so this stays a pure function. */
  now: number;
}

export interface BalanceNudge {
  area: TrainingArea;
  /** What the app has observed. Deliberately a statement, not an instruction. */
  message: string;
  /** The session offered if they want it. */
  suggestion: SessionType;
}

function countByArea(types: SessionType[]): Record<TrainingArea, number> {
  const counts: Record<TrainingArea, number> = { upper: 0, lower: 0, recovery: 0 };
  for (const t of types) {
    for (const area of AREA_BY_SESSION[t] ?? []) counts[area]++;
  }
  return counts;
}

export function getTrainingBalanceNudge(input: BalanceInput): BalanceNudge | null {
  const { sessionTypes, everTrained, dismissedAt, now } = input;

  if (dismissedAt !== null && now - dismissedAt < DISMISS_DAYS * 24 * 60 * 60 * 1000) return null;

  const window = sessionTypes.slice(0, BALANCE_WINDOW);
  if (window.length < MIN_SESSIONS) return null;

  const counts = countByArea(window);
  const everCounts = countByArea(everTrained);

  // Strength areas first — a missing half of the body is a bigger deal than a
  // missing stretch, and only one nudge shows at a time.
  const pairs: [TrainingArea, TrainingArea][] = [
    ['lower', 'upper'],
    ['upper', 'lower'],
  ];
  for (const [missing, busy] of pairs) {
    if (counts[missing] > 0) continue;
    if (counts[busy] < MIN_DOMINANT) continue;
    // Guard 3: never introduce an area they have not chosen for themselves.
    if (everCounts[missing] === 0) continue;
    return {
      area: missing,
      message: `You've trained ${AREA_LABELS[busy]} ${counts[busy]} times recently and ${AREA_LABELS[missing]} not at all.`,
      suggestion: AREA_SUGGESTION[missing],
    };
  }

  // Recovery is judged against total volume rather than against another area,
  // because it is not the opposite of anything.
  if (counts.recovery === 0 && everCounts.recovery > 0 && window.length >= MIN_SESSIONS) {
    return {
      area: 'recovery',
      message: `${window.length} sessions in a row without any recovery work.`,
      suggestion: AREA_SUGGESTION.recovery,
    };
  }

  return null;
}
