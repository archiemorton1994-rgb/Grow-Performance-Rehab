/**
 * XP AND LEVELS: one number for everything you have done.
 *
 * WHAT THIS IS, AND WHAT IT DELIBERATELY IS NOT
 * ─────────────────────────────────────────────
 * This app already counts three different things that could be called a level,
 * and adding a fourth badly would make all four meaningless. So, precisely:
 *
 *   EXERCISE LEVEL (1-5, named bands)  which movements you are prescribed.
 *                                      Decided by the movement screen and your
 *                                      training history. Clinical. See
 *                                      lib/exercise-levels.ts.
 *   EXPERIENCE LEVEL (3 answers)       what you told us about your training
 *                                      history. Yours, not ours.
 *   BADGE TIER (bronze to grow)        how rare one achievement is.
 *   XP LEVEL (this file)               how much you have done, all of it.
 *
 * The first three are about WHAT YOU ARE GIVEN. This one is about what you have
 * put in, and it changes nothing about your training. That separation is the
 * whole reason it is safe to gamify: a number that decided your prescription
 * would push people to chase it, and pushing a rehab client to chase a number
 * is the opposite of the job.
 *
 * NOT OVERBEARING, which was the brief. XP appears in exactly two places: the
 * session summary, once, as part of the record of what you just did; and the
 * ring around your profile picture. There is no popping counter, no XP on the
 * home screen, and nothing anywhere that interrupts a session to celebrate.
 *
 * EVERY SOURCE IS SOMETHING THAT WAS ALREADY WORTH DOING. Nothing here rewards
 * opening the app, tapping around, or logging in daily. A rehab user doing
 * twenty minutes of prehab earns for it exactly as a powerlifter earns for a
 * heavy triple, because both of them did the thing the app asked them to do.
 *
 * NO REACT AND NO STORE IMPORTS, so tests can run this rather than read it.
 */
import type { BadgeTier } from './badges';

/**
 * ── THE CURVE ──────────────────────────────────────────────────────────────
 *
 * Each level costs 100 XP more than the one before it. Level 2 costs 200,
 * level 3 costs 300, and so on.
 *
 * Chosen because it is explainable in one sentence, which matters more than
 * elegance for something a user is looking at. It is fast at the start - a
 * first session is most of the way to level 2 - and it stretches out honestly
 * rather than by a formula nobody can hold in their head. At three sessions a
 * week somebody reaches level 10 in about ten weeks and level 20 in about nine
 * months, which is the shape a training app wants: quick early proof that it is
 * working, then something left to climb.
 */
export const XP_FIRST_LEVEL_COST = 200;
export const XP_LEVEL_STEP = 100;

/** Nothing above this; the ring stops climbing rather than showing a lie. */
export const MAX_XP_LEVEL = 60;

/** Total XP needed to have REACHED this level. Level 1 is zero. */
export function xpForLevel(level: number): number {
  const n = Math.max(1, Math.min(MAX_XP_LEVEL, Math.trunc(level)));
  const steps = n - 1;
  // Sum of the first `steps` terms of 200, 300, 400 ...
  return steps * XP_FIRST_LEVEL_COST + XP_LEVEL_STEP * ((steps * (steps - 1)) / 2);
}

export interface XpStanding {
  /** Total XP ever earned. */
  total: number;
  level: number;
  /** XP earned since reaching the current level. */
  into: number;
  /** XP the current level costs in total. Zero at the ceiling. */
  span: number;
  /** 0 to 1, for the ring. Exactly 1 at the ceiling. */
  fraction: number;
  /** How many more are needed. Zero at the ceiling. */
  toNext: number;
  atCeiling: boolean;
}

/** Where a total sits on the curve. The one function every screen calls. */
export function xpStanding(total: number): XpStanding {
  const xp = Math.max(0, Math.floor(Number.isFinite(total) ? total : 0));
  let level = 1;
  while (level < MAX_XP_LEVEL && xp >= xpForLevel(level + 1)) level++;
  const base = xpForLevel(level);
  if (level >= MAX_XP_LEVEL) {
    return { total: xp, level, into: 0, span: 0, fraction: 1, toNext: 0, atCeiling: true };
  }
  const next = xpForLevel(level + 1);
  const span = next - base;
  const into = xp - base;
  return {
    total: xp,
    level,
    into,
    span,
    fraction: span > 0 ? Math.min(1, into / span) : 0,
    toNext: Math.max(0, next - xp),
    atCeiling: false,
  };
}

/**
 * ── WHAT EARNS IT ──────────────────────────────────────────────────────────
 *
 * Every number here is per event, and every event is something the app already
 * regarded as worth doing. Deliberately round and deliberately few: a table
 * somebody can read once and then stop thinking about.
 */
export const XP = {
  /** Finishing any session at all. The floor, whatever kind it was. */
  session: 100,
  /** Per set actually completed, so a longer session is worth more. Capped. */
  perSet: 3,
  /** The cap, so a marathon session cannot dwarf a month of ordinary ones. */
  maxSetBonus: 90,
  /** The session your programme asked for, on the day it asked for it. */
  onPlan: 30,
  /**
   * A planned easier session, done as prescribed.
   *
   * Deliberately the same as an on-plan session rather than less. Backing off
   * when the plan says to is the hardest thing to get somebody to do, and an XP
   * table that quietly paid less for it would be arguing against the programme.
   */
  deload: 30,
  /** A weight nobody in this account had lifted before. */
  personalBest: 120,
  /** A strength test session, which is a hard thing to walk into. */
  testSession: 150,
  /** Finishing a whole block, on top of the session that finished it. */
  blockComplete: 750,
  /** Taking the movement screen. Once, ever. */
  screenTaken: 100,
  /** Accepting a level step a finished block offered. */
  levelStep: 250,
} as const;

/**
 * Achievements pay by how rare they are, which is what the tier already means.
 * See BADGE_TIER_COLORS in lib/badges.ts - this is the same scale, in XP.
 */
/**
 * TUNED DOWN ONCE, AFTER MEASURING. The first version paid 25/50/100/200 and a
 * brand new account finished its very first session on level 3 - because a
 * first session unlocks eight badges at once, and 450 XP of achievement bonus
 * swamped the 139 the session itself was worth. Levels 1 and 2 existed and
 * nobody ever saw them.
 *
 * The session has to be the thing that moves the number. Badges are the bonus
 * on top, which is what a bonus means.
 */
export const XP_BY_BADGE_TIER: Record<BadgeTier, number> = {
  bronze: 10,
  silver: 20,
  gold: 40,
  grow: 80,
};

/** One thing that earned XP, for the session summary's breakdown. */
export interface XpLine {
  label: string;
  amount: number;
}

export interface SessionXp {
  lines: XpLine[];
  total: number;
}

/**
 * What one finished session was worth, itemised.
 *
 * Itemised rather than totalled because a bare "+240 XP" is a number somebody
 * has to take on trust, and the whole point of showing it on the summary is
 * that it is a record of what they did. Every line names a real thing.
 */
export function sessionXp(input: {
  /** Completed, non-skipped sets. */
  sets: number;
  /** Was this the session the programme asked for. */
  onPlan?: boolean;
  /** Was it a planned easier one. */
  deload?: boolean;
  /** Was it a strength test. */
  testSession?: boolean;
  /** How many weights beat anything in the account's history. */
  personalBests?: number;
  /** Did this session finish a block. */
  blockComplete?: boolean;
}): SessionXp {
  const lines: XpLine[] = [{ label: 'Session complete', amount: XP.session }];

  const sets = Math.max(0, Math.trunc(input.sets));
  const setBonus = Math.min(XP.maxSetBonus, sets * XP.perSet);
  if (setBonus > 0) {
    lines.push({ label: `${sets} ${sets === 1 ? 'set' : 'sets'} logged`, amount: setBonus });
  }

  // On plan and deload are the same event seen two ways - a deload session IS
  // an on-plan session - so it pays once, under the name that is truer.
  if (input.deload) lines.push({ label: 'Easier session, as planned', amount: XP.deload });
  else if (input.onPlan) lines.push({ label: 'On your programme', amount: XP.onPlan });

  if (input.testSession) lines.push({ label: 'Strength test', amount: XP.testSession });

  const pbs = Math.max(0, Math.trunc(input.personalBests ?? 0));
  if (pbs > 0) {
    lines.push({
      label: pbs === 1 ? 'Personal best' : `${pbs} personal bests`,
      amount: pbs * XP.personalBest,
    });
  }

  if (input.blockComplete) lines.push({ label: 'Block finished', amount: XP.blockComplete });

  return { lines, total: lines.reduce((n, l) => n + l.amount, 0) };
}

/**
 * ── WHAT THE NUMBER IS CALLED ──────────────────────────────────────────────
 *
 * Bands rather than a title per level, so the name means something for a while
 * instead of changing every fortnight. Deliberately NOT the names the exercise
 * ladders use - "Foundations" and "Elite" belong to what you are prescribed,
 * and reusing them here would tell somebody their sessions had changed when
 * nothing had.
 */
export const XP_BANDS: { from: number; name: string }[] = [
  { from: 1, name: 'Getting started' },
  { from: 5, name: 'Building the habit' },
  { from: 10, name: 'Regular' },
  { from: 18, name: 'Committed' },
  { from: 28, name: 'Seasoned' },
  { from: 40, name: 'Relentless' },
];

export function xpBandName(level: number): string {
  let name = XP_BANDS[0].name;
  for (const b of XP_BANDS) if (level >= b.from) name = b.name;
  return name;
}
