/**
 * STRENGTH SCORE: the three lifts against bodyweight, as one number out of 100.
 *
 * WHAT IT IS FOR, AND WHY IT IS NOT A LEVEL
 * ─────────────────────────────────────────
 * A powerlifter and a beginner both want to know "how strong am I, really", and
 * the honest answer is relative: a 60 kg person benching 90 is proportionally
 * far stronger than a 100 kg person benching the same. Raw kilos cannot say
 * that; a bodyweight ratio can.
 *
 * IT IS DELIBERATELY NOT CALLED A LEVEL, and it is deliberately not on the
 * profile picture. The app already has an XP level, exercise ladders and badge
 * tiers, and the brief was explicit about not burying people in scores. So this
 * is one line inside the strength card on the profile, next to the multipliers
 * it summarises, and it appears nowhere else. Somebody who never looks at it is
 * missing nothing.
 *
 * AND IT CHANGES NOTHING. It reads oneRepMaxes and bodyweight and returns a
 * number. It does not decide what anybody is prescribed, which is the exercise
 * ladders' job and stays clinical - see lib/exercise-levels.ts.
 *
 * THE THRESHOLDS ARE SEX-ADJUSTED, because they have to be. Upper-body pressing
 * relative to bodyweight differs enough between males and females that one
 * table would tell every woman she was weaker than she is, on the bench most of
 * all. Somebody who did not say gets the midpoint rather than either column: an
 * average of the two is a fairer guess than picking one.
 *
 * NO REACT AND NO STORE IMPORTS, so it can be tested by running it.
 */
import type { Sex } from './store';

/** The lifts this score is built from. The three the app tracks. */
export type ScoredLift = 'squat' | 'bench' | 'deadlift';
export const SCORED_LIFTS: ScoredLift[] = ['squat', 'bench', 'deadlift'];

/**
 * The bodyweight multiple that counts as the top of the scale for each lift.
 *
 * These are the Level 5 / "elite" column of a standard strength-standards
 * table. They are the DENOMINATOR of the score rather than a target anybody is
 * expected to hit: 100 means elite, and most people will sit between 30 and 60
 * for a long time, which is the honest shape of the thing being measured.
 */
export const ELITE_MULTIPLE: Record<ScoredLift, { male: number; female: number }> = {
  squat: { male: 2.25, female: 1.85 },
  bench: { male: 1.75, female: 1.25 },
  deadlift: { male: 2.5, female: 2.1 },
};

/** The top-of-scale multiple for one lift, for this person. */
export function eliteMultipleFor(lift: ScoredLift, sex: Sex | undefined): number {
  const row = ELITE_MULTIPLE[lift];
  if (sex === 'male') return row.male;
  if (sex === 'female') return row.female;
  // "Prefer not to say", or an older profile with nothing stored. The midpoint
  // is the fairest reading of an answer nobody gave.
  return (row.male + row.female) / 2;
}

export interface LiftScore {
  lift: ScoredLift;
  /** Their best, in kg. */
  bestKg: number;
  /** bestKg divided by bodyweight. */
  multiple: number;
  /** 0 to 100 against the elite multiple for that lift. */
  score: number;
}

export interface StrengthScore {
  /** 0 to 100, averaged over the lifts they actually have a best for. */
  score: number;
  /** Which lifts went into it, strongest first. */
  lifts: LiftScore[];
  /** How many of the three are missing, so a screen can say so. */
  missing: number;
}

/**
 * The score, or null when there is nothing honest to say.
 *
 * Null rather than zero for a person with no lifts logged: a zero is a claim
 * about somebody's strength, and "we have not measured you yet" is not that.
 * The same goes for a missing bodyweight, though the builder now requires one.
 */
export function strengthScore(input: {
  bodyweightKg: number;
  sex: Sex | undefined;
  /** Best one-rep max per lift, in kg. Missing lifts are simply absent. */
  bestKgByLift: Partial<Record<ScoredLift, number>>;
}): StrengthScore | null {
  const bw = input.bodyweightKg;
  if (!Number.isFinite(bw) || bw <= 0) return null;

  const lifts: LiftScore[] = [];
  for (const lift of SCORED_LIFTS) {
    const bestKg = input.bestKgByLift[lift];
    if (!Number.isFinite(bestKg) || (bestKg ?? 0) <= 0) continue;
    const multiple = (bestKg as number) / bw;
    const elite = eliteMultipleFor(lift, input.sex);
    // Capped at 100. Past elite the number stops being a useful scale, and a
    // score of 140 invites the question of what the scale was.
    const score = Math.max(0, Math.min(100, Math.round((multiple / elite) * 100)));
    lifts.push({ lift, bestKg: bestKg as number, multiple, score });
  }
  if (lifts.length === 0) return null;

  /**
   * AVERAGED OVER THE LIFTS THEY HAVE, not over all three.
   *
   * Dividing by three would score somebody who has only ever tested their squat
   * as a third of what they are, which reads as the app judging them for not
   * having benched rather than as a measurement. How many are missing is
   * reported separately so a screen can say "from 1 lift" instead of implying
   * it knows everything.
   */
  const score = Math.round(lifts.reduce((n, l) => n + l.score, 0) / lifts.length);
  return {
    score,
    lifts: lifts.slice().sort((a, b) => b.score - a.score),
    missing: SCORED_LIFTS.length - lifts.length,
  };
}

/**
 * A word for the number, so it is not a bare score out of 100.
 *
 * Deliberately NOT the names the exercise ladders use. "Foundations" and
 * "Elite" describe what somebody is prescribed; reusing them here would suggest
 * the score had changed their sessions, which it never does.
 */
export function strengthScoreLabel(score: number): string {
  if (score >= 90) return 'Elite';
  if (score >= 72) return 'Very strong';
  if (score >= 55) return 'Strong';
  if (score >= 38) return 'Developing';
  if (score >= 20) return 'Building';
  return 'Getting going';
}
