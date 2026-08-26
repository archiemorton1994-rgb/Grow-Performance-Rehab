/**
 * What the app has noticed about your TRAINING, as opposed to your attendance.
 *
 * WHY THIS EXISTS
 * ───────────────
 * The assistant had seven messages and every one of them was about consistency
 * or admin: you have been away, your streak is at risk, you are still
 * calibrating, you have not had a break, your mix is lopsided, your bodyweight
 * is stale, nothing to flag. Run over sixteen weeks of a user who trains three
 * times a week and never misses, the panel says "N weeks without a break" from
 * week four and never says anything else again.
 *
 * Meanwhile the app knows that their squat is up 15 kg, that their bench has
 * held at the same weight for three sessions, that they have flagged the same
 * knee in six of the last ten, and that they have rated everything easy for a
 * fortnight. None of it reached the panel, because nothing turned the stored
 * history into observations.
 *
 * That is all this file is: pure functions over data the app already keeps,
 * each returning either one observation or null. lib/coach.ts decides which of
 * them are worth saying today and how to word them.
 *
 * THE VOICE, WHICH IS NOT NEGOTIABLE
 * ──────────────────────────────────
 * Every observation is a statement about something that happened, carrying the
 * number it was derived from. Not "great job!", not "you should deload". The
 * training-balance work established this and the reason holds here: a user who
 * can check the claim can trust the next one, and an app that congratulates you
 * for nothing teaches you to stop reading it.
 *
 * NOTHING HERE DIAGNOSES.
 * The pain functions report frequency and duration and stop. "Six of your last
 * ten sessions, going back five weeks" is a fact about what was tapped. Whether
 * it means anything is for a clinician, and the message says so.
 */
import type { CompletedSession, ExerciseProgress, PainRegion } from './store';

const DAY_MS = 24 * 60 * 60 * 1000;

/** History needed before any of this is worth saying. Below it the numbers are
 *  noise and an observation drawn from noise is a horoscope. */
export const MIN_SESSIONS_FOR_INSIGHT = 4;
/** Appearances of one exercise before its trend means anything. */
export const MIN_APPEARANCES = 3;
/**
 * A gain has to be worth the sentence.
 *
 * On linear progression a lift moves every session, so without a floor the
 * panel reported "Back Squat is up 2.5 kg" in week five and every week after
 * it - true, trivial, and indistinguishable from noise. One plate on each side,
 * or a tenth of what they started with, is the point at which somebody would
 * tell a training partner.
 */
export const MIN_GAIN_KG = 5;
export const MIN_GAIN_SHARE = 0.1;

const daysBetween = (a: number, b: number) => Math.floor(Math.abs(a - b) / DAY_MS);

// ─────────────────────────────────────────────────────────────────────────────
// Strength
// ─────────────────────────────────────────────────────────────────────────────

export interface LiftGain {
  name: string;
  fromKg: number;
  toKg: number;
  gainKg: number;
  sessions: number;
}

/**
 * The lift that has moved most since the user started it.
 *
 * Anchored to the FOURTH appearance rather than the first. The first three
 * sessions of any exercise are the calibration window - the weight then is an
 * estimate from a profile questionnaire, not something anybody lifted - so
 * measuring from it reports the app correcting its own guess as if the user had
 * got stronger. That is the one number here that would be a lie.
 */
export function biggestLiftGain(progress: ExerciseProgress[]): LiftGain | null {
  let best: LiftGain | null = null;
  for (const p of progress) {
    if (p.appearances.length < MIN_APPEARANCES + 1) continue;
    const baseline = p.appearances[MIN_APPEARANCES];
    const latest = p.appearances[p.appearances.length - 1];
    if (!baseline || !latest) continue;
    const fromKg = baseline.bestSetWeight;
    const toKg = Math.max(...p.appearances.slice(MIN_APPEARANCES).map((a) => a.bestSetWeight));
    if (fromKg <= 0 || toKg <= fromKg) continue;
    const gainKg = toKg - fromKg;
    if (gainKg < MIN_GAIN_KG && gainKg / fromKg < MIN_GAIN_SHARE) continue;
    if (!best || gainKg > best.gainKg) {
      best = {
        name: p.exerciseName,
        fromKg,
        toKg,
        gainKg,
        sessions: p.appearances.length - MIN_APPEARANCES,
      };
    }
  }
  return best;
}

export interface PersonalBest {
  name: string;
  kg: number;
  previousKg: number;
  daysAgo: number;
}

/**
 * A weight beaten in the last fortnight that had never been beaten before.
 *
 * Derived rather than stored, because it already was: the summary screen works
 * a personal best out immediately after a session, counts it in the headline
 * and then throws it away. Every appearance is in the history, so the same fact
 * can be recovered whenever it is wanted.
 */
export function recentPersonalBest(
  progress: ExerciseProgress[],
  now: number,
  withinDays = 14
): PersonalBest | null {
  let best: PersonalBest | null = null;
  for (const p of progress) {
    if (p.appearances.length < MIN_APPEARANCES) continue;
    for (let i = 1; i < p.appearances.length; i++) {
      const a = p.appearances[i];
      const kg = a.bestSetWeight;
      if (kg <= 0) continue;
      const previousKg = Math.max(...p.appearances.slice(0, i).map((x) => x.bestSetWeight));
      if (previousKg <= 0 || kg <= previousKg) continue;
      const daysAgo = daysBetween(now, new Date(a.date).getTime());
      if (daysAgo > withinDays) continue;
      if (!best || daysAgo < best.daysAgo || (daysAgo === best.daysAgo && kg - previousKg > best.kg - best.previousKg)) {
        best = { name: p.exerciseName, kg, previousKg, daysAgo };
      }
    }
  }
  return best;
}

export interface Stall {
  name: string;
  kg: number;
  sessions: number;
  deloadNext: boolean;
}

/** After this many stalled sessions the engine takes 10% off by itself. Mirrors
 *  DELOAD_AFTER_STALLS in lib/workout-engine.ts; the panel exists to say what
 *  the engine is about to do, so the two numbers have to agree. */
export const DELOAD_AFTER_STALLS = 3;

/**
 * A lift that has not moved, and what the app is going to do about it.
 *
 * The point is not to report a stall - the user can see the weight. It is to
 * say that the app has noticed and has a plan, because an automatic 10% drop
 * that arrives unannounced is indistinguishable from a bug.
 */
export function stalledLift(
  progress: ExerciseProgress[],
  stuckStreak: Record<string, number>
): Stall | null {
  let worst: Stall | null = null;
  for (const p of progress) {
    const stuck = stuckStreak[p.exerciseId] ?? 0;
    if (stuck < 2) continue;
    const latest = p.appearances[p.appearances.length - 1];
    if (!latest || latest.bestSetWeight <= 0) continue;
    if (!worst || stuck > worst.sessions) {
      worst = {
        name: p.exerciseName,
        kg: latest.bestSetWeight,
        sessions: stuck,
        deloadNext: stuck + 1 >= DELOAD_AFTER_STALLS,
      };
    }
  }
  return worst;
}

// ─────────────────────────────────────────────────────────────────────────────
// Effort
// ─────────────────────────────────────────────────────────────────────────────

/**
 * How many of the recent sessions were rated easy throughout, and how many were
 * rated hard. Reported so the panel can explain why the weights are moving the
 * way they are, which is the single most common thing a user of an
 * auto-regulating app does not understand about it.
 */
export function effortRun(
  sessions: CompletedSession[],
  windowSize = 6
): { easy: number; hard: number; of: number } | null {
  const window = sessions.slice(0, windowSize);
  if (window.length < MIN_SESSIONS_FOR_INSIGHT) return null;
  let easy = 0;
  let hard = 0;
  for (const s of window) {
    const logs = s.exerciseLogs ?? [];
    const rated = logs.filter((l) => l.feedbackRating);
    if (rated.length === 0) continue;
    if (rated.every((l) => l.feedbackRating === 'easy' || l.feedbackRating === 'very_easy')) easy++;
    else if (rated.some((l) => l.feedbackRating === 'hard')) hard++;
  }
  return { easy, hard, of: window.length };
}

// ─────────────────────────────────────────────────────────────────────────────
// Pain
// ─────────────────────────────────────────────────────────────────────────────

const regionsOf = (s: CompletedSession): PainRegion[] => {
  if (s.painRegions && s.painRegions.length > 0) return s.painRegions;
  return s.painRegion ? [s.painRegion] : [];
};

export interface PainEpisode {
  region: PainRegion;
  /** Sessions this region was flagged in, within the window. */
  flagged: number;
  /** Sessions trained in the window. The pair is the point: a raw count rises
   *  simply because somebody trained more. */
  of: number;
  /** Whole weeks between the first and most recent time it was flagged. */
  weeksRunning: number;
  worsening: boolean;
}

/** Sessions looked at when asking whether a complaint is still running. */
export const PAIN_WINDOW = 10;
/**
 * Flagged in at least this SHARE of them before it is worth saying.
 *
 * A share, not a count. The Stats screen compares raw counts across two 28-day
 * windows, so somebody back from a fortnight away who trains eight times
 * instead of four is told their knee is worsening even when the proportion it
 * hurt in has halved. Two sessions out of ten is a niggle whichever way you
 * count it; two out of three is not.
 */
export const PAIN_PERSIST_SHARE = 0.4;
/** And running at least this long. A complaint inside one week is a niggle. */
export const PAIN_PERSIST_WEEKS = 3;

/**
 * How long the CURRENT run of a complaint has been going.
 *
 * Two different questions get confused here and they need different windows.
 * How often it is happening is a question about recent sessions. How long it
 * has been going is a question about the whole history, and measuring it inside
 * the recent window measures the width of the window instead - for somebody
 * training three times a week, ten sessions is about three weeks, so "has this
 * been running three weeks" came back false no matter how long it had really
 * been running. That was the first version of this and it never fired once.
 *
 * An episode ends at a gap. Somebody whose knee hurt last spring, settled, and
 * is sore again this month has a two-week complaint, not a nine-month one, so
 * walking back stops at the first gap longer than EPISODE_GAP_DAYS.
 */
export const EPISODE_GAP_DAYS = 28;

function episodeStart(sessions: CompletedSession[], region: PainRegion): number | null {
  const flagged = sessions
    .filter((s) => regionsOf(s).includes(region))
    .map((s) => new Date(s.date).getTime())
    .sort((a, b) => b - a);
  if (flagged.length === 0) return null;
  let start = flagged[0];
  for (let i = 1; i < flagged.length; i++) {
    if (daysBetween(start, flagged[i]) > EPISODE_GAP_DAYS) break;
    start = flagged[i];
  }
  return start;
}

/**
 * A complaint that has not settled.
 *
 * Reported as a SHARE of sessions trained, not as a count. The Stats screen
 * compares raw counts across two 28-day windows, so somebody back from a
 * fortnight away who trains eight times instead of four is told their knee is
 * worsening even when the proportion has halved. A share is the same number
 * whether you trained four times or twelve.
 */
export function painPersistence(sessions: CompletedSession[], now: number): PainEpisode | null {
  const window = sessions.slice(0, PAIN_WINDOW);
  if (window.length < MIN_SESSIONS_FOR_INSIGHT) return null;

  const counts = new Map<PainRegion, { n: number; newest: number }>();
  for (const s of window) {
    const t = new Date(s.date).getTime();
    for (const r of regionsOf(s)) {
      const cur = counts.get(r) ?? { n: 0, newest: t };
      cur.n++;
      cur.newest = Math.max(cur.newest, t);
      counts.set(r, cur);
    }
  }

  let worst: PainEpisode | null = null;
  for (const [region, c] of counts) {
    const share = c.n / window.length;
    if (share < PAIN_PERSIST_SHARE) continue;
    // Still current? A complaint last flagged a month ago is not persisting.
    if (daysBetween(now, c.newest) > 14) continue;

    const started = episodeStart(sessions, region);
    if (started === null) continue;
    const weeksRunning = Math.floor(daysBetween(c.newest, started) / 7);
    if (weeksRunning < PAIN_PERSIST_WEEKS) continue;

    const firstHalf = window.slice(Math.ceil(window.length / 2));
    const secondHalf = window.slice(0, Math.floor(window.length / 2));
    const rate = (list: CompletedSession[]) =>
      list.length === 0 ? 0 : list.filter((s) => regionsOf(s).includes(region)).length / list.length;
    const episode: PainEpisode = {
      region,
      flagged: c.n,
      of: window.length,
      weeksRunning,
      worsening: rate(secondHalf) > rate(firstHalf),
    };
    if (!worst || episode.flagged > worst.flagged) worst = episode;
  }
  return worst;
}

/**
 * A complaint that HAS settled, which is the message nobody writes.
 *
 * An app that only speaks up when something is wrong trains people to dread it.
 * This needs a real history of the complaint behind it, so it cannot fire for
 * somebody who tapped a region once by accident.
 */
export function painResolved(
  sessions: CompletedSession[],
  now: number
): { region: PainRegion; weeksClear: number } | null {
  if (sessions.length < MIN_SESSIONS_FOR_INSIGHT + 2) return null;
  const recent = sessions.slice(0, 4);
  const before = sessions.slice(4, 4 + PAIN_WINDOW);
  if (before.length < 4) return null;

  const stillFlagged = new Set(recent.flatMap(regionsOf));
  const counts = new Map<PainRegion, number>();
  for (const s of before) for (const r of regionsOf(s)) counts.set(r, (counts.get(r) ?? 0) + 1);

  let bestRegion: PainRegion | null = null;
  let bestCount = 0;
  for (const [region, n] of counts) {
    if (stillFlagged.has(region)) continue;
    if (n < 3) continue;
    if (n > bestCount) {
      bestCount = n;
      bestRegion = region;
    }
  }
  if (!bestRegion) return null;

  const lastFlagged = before.find((s) => regionsOf(s).includes(bestRegion!));
  if (!lastFlagged) return null;
  const weeksClear = Math.floor(daysBetween(now, new Date(lastFlagged.date).getTime()) / 7);
  if (weeksClear < 2) return null;
  return { region: bestRegion, weeksClear };
}

// ─────────────────────────────────────────────────────────────────────────────
// Volume
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Total weight moved this month against last month.
 *
 * Volume is the honest measure of a month's work in a programme where the load
 * on any one lift moves slowly and deliberately. Someone whose squat has not
 * changed can still have done a fifth more work.
 */
export function volumeChange(
  sessions: CompletedSession[],
  now: number
): { pct: number; thisMonthKg: number; lastMonthKg: number } | null {
  const totalOf = (from: number, to: number) => {
    let kg = 0;
    let count = 0;
    for (const s of sessions) {
      const t = new Date(s.date).getTime();
      if (t < from || t >= to) continue;
      count++;
      for (const log of s.exerciseLogs ?? []) {
        for (const set of log.sets ?? []) {
          if (set.completed && !set.skipped) kg += (set.weight ?? 0) * (set.reps ?? 0);
        }
      }
    }
    return { kg, count };
  };
  const month = 28 * DAY_MS;
  const current = totalOf(now - month, now + DAY_MS);
  const previous = totalOf(now - 2 * month, now - month);
  // Both months need enough sessions to compare, or this reports a holiday.
  if (current.count < 3 || previous.count < 3) return null;
  if (previous.kg <= 0 || current.kg <= 0) return null;
  const pct = Math.round(((current.kg - previous.kg) / previous.kg) * 100);
  if (Math.abs(pct) < 10) return null;
  return { pct, thisMonthKg: current.kg, lastMonthKg: previous.kg };
}

// ─────────────────────────────────────────────────────────────────────────────
// Personal bests
// ─────────────────────────────────────────────────────────────────────────────

export interface BestEvent {
  name: string;
  kg: number;
  reps?: number;
  /** Epley from the pair, where reps were recorded. Comparable across a lift
   *  whose weight held while the reps climbed. */
  estimatedOrmKg?: number;
  previousKg: number;
  date: string;
}

/**
 * Every weight a lift has been beaten at, newest first.
 *
 * DERIVED, NOT STORED, because it already was and then was not. The summary
 * screen works a personal best out immediately after a session, counts it in
 * the headline, and throws it away; nothing writes it down and no other screen
 * recomputes it. Every appearance is in the history, so a best is simply an
 * appearance that beat everything before it, and the whole list can be
 * recovered whenever it is wanted.
 *
 * The FIRST appearance of a lift is never a best. Beating nothing is not an
 * achievement, and counting it would hand somebody a wall of trophies for
 * turning up.
 */
export function allPersonalBests(progress: ExerciseProgress[], limit = 20): BestEvent[] {
  const out: BestEvent[] = [];
  for (const p of progress) {
    let ceiling = 0;
    for (let i = 0; i < p.appearances.length; i++) {
      const a = p.appearances[i];
      const kg = a.bestSetWeight;
      if (kg <= 0) continue;
      if (i === 0) {
        ceiling = kg;
        continue;
      }
      if (kg > ceiling) {
        out.push({
          name: p.exerciseName,
          kg,
          reps: a.bestSetReps,
          estimatedOrmKg: a.estimatedOrmKg,
          previousKg: ceiling,
          date: a.date,
        });
        ceiling = kg;
      }
    }
  }
  return out
    .sort((x, y) => new Date(y.date).getTime() - new Date(x.date).getTime())
    .slice(0, limit);
}

/**
 * What to plot for a lift: an estimated one-rep max where the reps are known,
 * and the raw weight where they are not.
 *
 * Every appearance recorded before reps were stored has no rep count, so a
 * chart drawn purely from the estimate would start partway along. Falling back
 * keeps the line continuous and simply gets more truthful from the point reps
 * started being kept.
 */
export function plottedStrength(a: {
  bestSetWeight: number;
  estimatedOrmKg?: number;
}): number {
  return a.estimatedOrmKg && a.estimatedOrmKg > 0 ? a.estimatedOrmKg : a.bestSetWeight;
}
