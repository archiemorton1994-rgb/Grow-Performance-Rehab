/**
 * THE PROGRAMME REPORT: what a finished block actually amounted to.
 *
 * WHY THIS EXISTS
 * ───────────────
 * Until now a block had no ending. You did the twelfth session of twelve and the
 * app showed a badge reading "Block complete" in two places, then carried on
 * exactly as before: same suggestion, same weights, same everything. Weeks of
 * work, and the acknowledgement was a chip.
 *
 * Archie's brief was unambiguous about the size of the moment - "this is a big
 * deal, the user should feel the sense of accomplishment" - and the honest
 * reason it deserves that treatment is not motivational. It is that the app has
 * been keeping every number the whole time and has never once handed them back
 * as a whole. Somebody who trained for eight weeks has a story in their history
 * and no way to read it.
 *
 * FROZEN, NOT DERIVED
 * ───────────────────
 * The rest of the programme layer follows one rule: position is derived, never
 * stored, so nothing can disagree with the session history. This module
 * deliberately breaks it, and the reason is the difference between a projection
 * and a record.
 *
 * A report is a certificate. It is issued once, at a moment, about a thing that
 * has finished. If it were recomputed on every open it would change under
 * somebody who deleted a session, edited their custom cycle, or switched
 * programmes - and a document that quietly rewrites its own history is worth
 * less than no document at all. So it is built once by buildProgrammeReport and
 * stored on the archive entry, and everything in it is a number rather than a
 * sentence, so the screen can still format weights in whatever unit the reader
 * has set today.
 *
 * NO REACT AND NO REACT NATIVE, so tests/programme-report.check.mjs can run this
 * rather than read it.
 */
import type {
  CompletedSession,
  ExerciseLog,
  ExperienceLevel,
  PainRegion,
  SessionType,
} from './store';
import type { EnrolledProgramme } from './programme';
import { cycleOf, deloadWeeksFor, nameOf, tagSessions, weeksFor } from './programme';
import { estimateOrmFromAmrap } from './workout-engine';
import { levelBandForExperience } from './programme';
import { LEVEL_NAMES, type LevelBand } from './exercise-levels';

/**
 * The shape version, stamped on every report as it is built.
 *
 * An archived report is read months later by code that has moved on. Stamping
 * the shape means a screen can tell a report it fully understands from one
 * written by an older build, instead of reading a missing field as a zero and
 * telling somebody they lifted nothing.
 */
export const REPORT_VERSION = 1;

/** One lift, at the start of the block and at the end of it. */
export interface LiftMove {
  exerciseId: string;
  exerciseName: string;
  /** Heaviest working set, first appearance in the block and last. */
  fromKg: number;
  toKg: number;
  fromReps: number;
  toReps: number;
  /**
   * Epley estimates at each end, and the difference.
   *
   * WHY NOT JUST THE WEIGHT. The app climbs reps before it adds weight - eight,
   * then nine, then ten at the same load, and only then a plate. A report that
   * charted weight alone would show a flat line for somebody who went from eight
   * reps to twelve, on the exact mechanic the app is built around, and tell them
   * the block did nothing. Same reasoning, same formula, as ExerciseAppearance.
   */
  fromOrmKg: number;
  toOrmKg: number;
  deltaKg: number;
  /** How many sessions of the block it appeared in. */
  appearances: number;
}

/** A weight nobody in this account had lifted before the block. */
export interface ReportBest {
  exerciseName: string;
  kg: number;
  reps: number;
}

/**
 * The one thing to put in the biggest type on the page.
 *
 * A shape rather than a sentence, because every option in it has a weight or a
 * count in it and the reader's unit is a render-time fact. The screen turns this
 * into words; this module decides which words they are about.
 */
export type ReportHighlight =
  | { kind: 'lift'; move: LiftMove }
  | { kind: 'volume'; kg: number }
  | { kind: 'sessions'; count: number };

/**
 * Whether the next block can be built a level up.
 *
 * NEVER APPLIED AUTOMATICALLY. This is a proposal, and the report screen is
 * where somebody accepts it. An app that silently makes your next eight weeks
 * harder because it decided you looked comfortable is an app that has stopped
 * being predictable, and the whole promise of the programme layer is that
 * nothing changes underneath you without being said out loud first.
 */
export interface LevelStep {
  earned: boolean;
  /**
   * Rungs already earned, and the number after taking this one.
   *
   * A BONUS RATHER THAN A NEW EXPERIENCE LEVEL. The first version of this raised
   * `experienceLevel`, which was wrong twice. Wrong in size, because the three
   * answers are coarse and intermediate to advanced moves the ceiling two rungs
   * at once on the strength of one finished block. And wrong in field, because
   * that answer is something somebody told us about their life outside the app
   * and is the one the hub's own level control edits - overwriting it would mean
   * the app and the user were both writing to one box for two different reasons.
   */
  fromBonus: number;
  toBonus: number;
  /**
   * The BAND at each end, not just the ceiling.
   *
   * A band is the pair the generator actually uses: the rung sessions are built
   * on, and the rung they will not go past. Reporting only the ceiling produced
   * an offer that read "Range and asymmetry to Elite" after one finished block,
   * which names the highest thing unlocked rather than the thing that changed.
   * What changed is where sessions are built, which is `prefer`.
   */
  fromBand: LevelBand;
  toBand: LevelBand;
  /** One line naming what decided it, in the app's voice. */
  because: string;
}

export interface ProgrammeReport {
  v: number;

  // ── What was done ────────────────────────────────────────────────────────
  onPlan: number;
  offPlan: number;
  /** The block's length, so a report reads correctly beside a longer one. */
  blockLength: number;
  cycle: SessionType[];
  /** Which session types were done, and how many of each, on plan and off. */
  byType: { type: SessionType; count: number }[];

  // ── How long it took ─────────────────────────────────────────────────────
  /** Calendar days from the first session of the block to the last. */
  spanDays: number;
  /** Sessions a week actually achieved over that span, to one decimal. */
  perWeek: number;
  /** Sessions a week the block was written for. */
  plannedPerWeek: number;
  /** Minutes under the bar, summed from what the timer actually recorded. */
  minutesTrained: number;

  // ── How much ─────────────────────────────────────────────────────────────
  totalSets: number;
  totalReps: number;
  /** Weight moved, in kg, summed over every completed set that had a load. */
  volumeKg: number;
  distinctExercises: number;
  /** How many deliberately easier SESSIONS of the block were actually done. */
  deloadSessionsDone: number;
  testSessions: number;

  // ── What changed ─────────────────────────────────────────────────────────
  /** Biggest estimated gains first, at most three. */
  movers: LiftMove[];
  /**
   * Lifts that finished the block lower than they started it, at most two.
   *
   * Included on purpose. A report that only ever reports gains is a report
   * nobody can trust the good news in, and a lift that went backwards during a
   * block is the single most useful thing the document can tell a
   * physiotherapist.
   */
  slipped: LiftMove[];
  personalBests: ReportBest[];
  highlight: ReportHighlight | null;

  // ── How it felt ──────────────────────────────────────────────────────────
  acheSessions: number;
  acheRegions: PainRegion[];
  /**
   * Whether what was sore eased off, comparing the first half of the block to
   * the second. Null when nothing was ever flagged, or when the block is too
   * short for the halves to mean anything.
   */
  acheTrend: 'settled' | 'same' | 'worse' | null;
  /** Sessions where every set was finished or deliberately skipped. */
  cleanSessions: number;
  effort: { easy: number; hard: number; rated: number };

  // ── What comes next ──────────────────────────────────────────────────────
  step: LevelStep;
}

// ─── Reading a session ──────────────────────────────────────────────────────

/** Every set that was actually performed. A skipped set is not evidence. */
function performedSets(log: ExerciseLog) {
  return log.sets.filter((s) => s.completed && !s.skipped);
}

/** The heaviest performed set, and the reps on it. Null when nothing was done. */
function bestSet(log: ExerciseLog): { kg: number; reps: number } | null {
  let best: { kg: number; reps: number } | null = null;
  for (const s of performedSets(log)) {
    if (s.weight <= 0) continue;
    if (!best || s.weight > best.kg || (s.weight === best.kg && s.reps > best.reps)) {
      best = { kg: s.weight, reps: s.reps };
    }
  }
  return best;
}

/**
 * One number for a weight-and-reps pair, so climbing reps counts as progress.
 *
 * Epley, via the engine's own function rather than a second copy of the formula
 * here: the report and the exercise chart have to agree about what a set was
 * worth, or the same block produces two different answers on two screens.
 */
function ormOf(kg: number, reps: number): number {
  if (kg <= 0) return 0;
  if (reps <= 1) return kg;
  return estimateOrmFromAmrap(kg, reps);
}

function wholeDays(fromIso: string, toIso: string): number {
  const a = new Date(fromIso);
  const b = new Date(toIso);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return 0;
  const from = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const to = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.max(0, Math.round((to - from) / 86400000));
}

const round1 = (v: number) => Math.round(v * 10) / 10;

// ─── The promotion rule ─────────────────────────────────────────────────────

/** Above this share of hard-rated work, the block was not cleared comfortably. */
const STEP_MAX_HARD_SHARE = 0.2;
/** Below this share of sessions finished cleanly, there is nothing to step up from. */
const STEP_MIN_CLEAN_SHARE = 0.8;
/** Fewer rated exercises than this and there is not enough signal to act on. */
const STEP_MIN_RATED = 6;

/**
 * The most rungs anybody can earn this way, however many blocks they finish.
 *
 * Two. Past that the app would be prescribing at the top of the ladder to
 * somebody it has only ever watched inside its own sessions, and the top of
 * these ladders is loaded single-leg and asymmetric work that a physiotherapist
 * puts people on by looking at them. Somebody who genuinely belongs there can
 * still say so: the level control in the hub is theirs.
 */
export const MAX_EARNED_BONUS = 2;

/**
 * DID THEY EARN THE NEXT LEVEL, and what does saying yes actually change?
 *
 * The gap this closes is the biggest one in the whole feature. Blocks repeat
 * identically: the ladders in lib/exercise-levels.ts exist, the effort scale
 * collects the signal every session, and nothing has ever promoted anybody
 * between blocks. A level system that is measured and never acted on is a
 * filter, not progression.
 *
 * TWO CONDITIONS, BOTH MEASURED, NEITHER SELF-REPORTED.
 *
 *   THE WORK WAS FINISHED. Four sessions in five with no set left unfinished.
 *   Somebody scraping through a block is not somebody to hand harder movements.
 *
 *   AND IT WAS NOT AT THE LIMIT. At most one exercise in five rated hard. This
 *   is the earn-the-barbell rule from PROGRESSION-LADDERS.md read at block scale
 *   rather than movement scale.
 *
 * AND A FLOOR ON THE EVIDENCE. Under six rated exercises across a whole block,
 * nothing is offered, whatever the shares work out at. Two ratings out of two
 * is a hundred percent of nothing, and promoting on that is worse than never
 * promoting at all - it puts a beginner in front of a movement a physiotherapist
 * would not have given them.
 */
export function levelStepFor(
  experience: ExperienceLevel,
  /** Rungs already earned. See UserProfile.earnedLevelBonus. */
  earnedBonus: number,
  input: {
    cleanSessions: number;
    onPlan: number;
    effort: { easy: number; hard: number; rated: number };
  }
): LevelStep {
  const fromBonus = Math.max(0, Math.trunc(earnedBonus));
  const fromBand = levelBandForExperience(experience, fromBonus);
  const toBonus = fromBonus + 1;
  const toBand = levelBandForExperience(experience, toBonus);
  const at = (earned: boolean, because: string): LevelStep => ({
    earned,
    fromBonus,
    toBonus: earned ? toBonus : fromBonus,
    fromBand,
    toBand: earned ? toBand : fromBand,
    because,
  });

  /**
   * Nowhere left to go, judged by whether the band would actually MOVE.
   *
   * Checking the bonus against its cap is not enough: somebody who answered
   * "3 yrs plus" is already at the top of every ladder, so a rung would be
   * offered, accepted, and change nothing at all - which is the worst kind of
   * promise the app can make.
   */
  if (fromBonus >= MAX_EARNED_BONUS || toBand.max <= fromBand.max) {
    return at(
      false,
      'You are at the top of what the app will prescribe on its own. It keeps adding weight from here; the movements themselves are yours to change from your programme whenever you want.'
    );
  }
  if (input.effort.rated < STEP_MIN_RATED) {
    return at(
      false,
      'Not enough of this block was rated for the app to judge how hard it was. Tap the effort buttons more often next time and it will have something to go on.'
    );
  }
  const cleanShare = input.onPlan > 0 ? input.cleanSessions / input.onPlan : 0;
  const hardShare = input.effort.hard / input.effort.rated;
  if (cleanShare < STEP_MIN_CLEAN_SHARE) {
    return at(
      false,
      'Some sessions had sets left unfinished, so the next block is built at the same level. That is the right call: finish this one comfortably and the step up is there.'
    );
  }
  if (hardShare > STEP_MAX_HARD_SHARE) {
    return at(
      false,
      'This block was hard work, and you finished it. The next one is built at the same level so the weights can keep climbing on movements you already own.'
    );
  }
  return at(
    true,
    `You finished this block with room to spare, so you have earned a rung. Your next one is built on ${LEVEL_NAMES[toBand.prefer].toLowerCase()} movements rather than ${LEVEL_NAMES[fromBand.prefer].toLowerCase()}, with ${LEVEL_NAMES[toBand.max].toLowerCase()} work available on top.`
  );
}

// ─── Building it ────────────────────────────────────────────────────────────

export interface ReportInput {
  programme: EnrolledProgramme;
  /**
   * Every session logged since enrolment, OLDEST FIRST.
   *
   * The store keeps completedSessions newest-first, so the caller reverses it -
   * the same reversal getProgrammePosition and getSessionPlanTags both do, and
   * the same one that is the only way any of the three can be wrong.
   */
  sessionsSinceEnrolment: CompletedSession[];
  /**
   * Everything logged BEFORE enrolment, in any order.
   *
   * Only used to decide what counts as a personal best. Without it every
   * heaviest set of the block would be called a first, including for somebody
   * with two years of history.
   */
  historyBefore: CompletedSession[];
  experience: ExperienceLevel;
  /** Rungs already earned from earlier blocks. Zero for a first one. */
  earnedBonus?: number;
  finishedAt: string;
}

export function buildProgrammeReport(input: ReportInput): ProgrammeReport {
  const { programme, sessionsSinceEnrolment, historyBefore, experience } = input;
  const earnedBonus = Math.max(0, Math.trunc(input.earnedBonus ?? 0));
  const tags = tagSessions(
    programme,
    sessionsSinceEnrolment.map((s) => s.sessionType)
  );

  const onPlanSessions: CompletedSession[] = [];
  const deloadDone = new Set<number>();
  let offPlan = 0;
  sessionsSinceEnrolment.forEach((s, i) => {
    const tag = tags[i];
    if (tag?.onPlan) {
      onPlanSessions.push(s);
      if (tag.deload && tag.blockIndex !== null) {
        // COUNTED IN SESSIONS, matching the schedule that placed them. Rounding
        // these up to whole weeks overstated a trimmed window as a full week off.
        deloadDone.add(tag.blockIndex);
      }
    } else {
      offPlan++;
    }
  });
  /** Which of the block's sessions the programme actually asked for. */
  const onPlanIds = new Set(onPlanSessions.map((s) => s.id));

  /**
   * EVERYTHING IS COUNTED, ON PLAN OR NOT.
   *
   * The block's POSITION only moves on a session the programme asked for; that
   * is the promise, and it is unchanged. But a report that threw away six
   * conditioning sessions somebody chose to do would be telling them their own
   * training did not happen, which is the opposite of the promise.
   */
  const all = sessionsSinceEnrolment;

  let totalSets = 0;
  let totalReps = 0;
  let volumeKg = 0;
  let cleanSessions = 0;
  /** The same count, over the sessions the PROGRAMME asked for. See below. */
  let cleanOnPlan = 0;
  let minutesTrained = 0;
  let testSessions = 0;
  let acheSessions = 0;
  const acheRegions = new Set<PainRegion>();
  const exerciseIds = new Set<string>();
  const effort = { easy: 0, hard: 0, rated: 0 };
  const byType = new Map<SessionType, number>();

  for (const s of all) {
    byType.set(s.sessionType, (byType.get(s.sessionType) ?? 0) + 1);
    if (s.isTestWeek) testSessions++;
    if (s.durationSeconds && s.durationSeconds > 0) {
      minutesTrained += s.durationSeconds / 60;
    }
    if (s.hadAches) {
      acheSessions++;
      for (const r of s.painRegions ?? (s.painRegion ? [s.painRegion] : [])) acheRegions.add(r);
    }
    let unfinished = false;
    for (const log of s.exerciseLogs) {
      if (log.exerciseId) exerciseIds.add(log.exerciseId);
      if (log.feedbackRating) {
        effort.rated++;
        if (log.feedbackRating === 'hard') effort.hard++;
        else effort.easy++;
      }
      for (const set of log.sets) {
        if (!set.completed && !set.skipped) unfinished = true;
        if (!set.completed || set.skipped) continue;
        totalSets++;
        totalReps += Math.max(0, set.reps);
        if (set.weight > 0) volumeKg += set.weight * Math.max(0, set.reps);
      }
    }
    if (!unfinished) {
      cleanSessions++;
      /**
       * AND SEPARATELY, THE PROGRAMME'S OWN CLEAN SESSIONS.
       *
       * The promotion rule is "four sessions in five finished with nothing left
       * behind", but its numerator counted every session logged during the
       * block - extras the user chose themselves included - while its
       * denominator counted only the sessions the programme asked for. Any extra
       * session inflated the score, so a block where half the programme's own
       * sessions were abandoned still offered the user a harder level.
       *
       * The report's own "how it went" sentence deliberately counts everything,
       * because everything you did while the block was running is yours. Only
       * the promotion needs the two halves to describe the same set.
       */
      if (onPlanIds.has(s.id)) cleanOnPlan++;
    }
  }

  // ── What moved ───────────────────────────────────────────────────────────
  //
  // First appearance against last, per exercise. A single appearance can only
  // ever produce a delta of zero, so the guard below is belt and braces rather
  // than the thing that keeps flat lines out - that is done by splitting the
  // list on the sign of the delta, which drops everything that did not move.
  const firstSeen = new Map<string, { name: string; kg: number; reps: number }>();
  const lastSeen = new Map<string, { name: string; kg: number; reps: number }>();
  const seenCount = new Map<string, number>();
  for (const s of all) {
    for (const log of s.exerciseLogs) {
      const best = bestSet(log);
      if (!log.exerciseId || !best) continue;
      const entry = { name: log.exerciseName, kg: best.kg, reps: best.reps };
      if (!firstSeen.has(log.exerciseId)) firstSeen.set(log.exerciseId, entry);
      lastSeen.set(log.exerciseId, entry);
      seenCount.set(log.exerciseId, (seenCount.get(log.exerciseId) ?? 0) + 1);
    }
  }

  const moves: LiftMove[] = [];
  for (const [id, first] of firstSeen) {
    const last = lastSeen.get(id);
    const appearances = seenCount.get(id) ?? 0;
    if (!last || appearances < 2) continue;
    const fromOrmKg = ormOf(first.kg, first.reps);
    const toOrmKg = ormOf(last.kg, last.reps);
    moves.push({
      exerciseId: id,
      exerciseName: last.name,
      fromKg: first.kg,
      toKg: last.kg,
      fromReps: first.reps,
      toReps: last.reps,
      fromOrmKg: Math.round(fromOrmKg * 10) / 10,
      toOrmKg: Math.round(toOrmKg * 10) / 10,
      deltaKg: Math.round((toOrmKg - fromOrmKg) * 10) / 10,
      appearances,
    });
  }
  moves.sort((a, b) => b.deltaKg - a.deltaKg);
  const movers = moves.filter((m) => m.deltaKg > 0).slice(0, 3);
  const slipped = moves
    .filter((m) => m.deltaKg < 0)
    .sort((a, b) => a.deltaKg - b.deltaKg)
    .slice(0, 2);

  // ── Personal bests ───────────────────────────────────────────────────────
  const bestBefore = new Map<string, number>();
  for (const s of historyBefore) {
    for (const log of s.exerciseLogs) {
      const best = bestSet(log);
      if (!log.exerciseId || !best) continue;
      bestBefore.set(log.exerciseId, Math.max(bestBefore.get(log.exerciseId) ?? 0, best.kg));
    }
  }
  /**
   * THE BEST OF THE BLOCK, not the first set that beat the old mark.
   *
   * The first version recorded a lift the moment it passed its previous best and
   * then stopped looking, so a deadlift that went 140 to 170 was written up as
   * 155. On a page headed "weights you had never lifted before this block began",
   * printing the fourth heaviest is worse than printing nothing.
   *
   * Still one entry per exercise. Beating your own set from session two is
   * progression rather than a first, and listing every one of them would fill
   * the page with the same lift five times over.
   */
  const bestInBlock = new Map<string, ReportBest>();
  for (const s of all) {
    for (const log of s.exerciseLogs) {
      const best = bestSet(log);
      if (!log.exerciseId || !best) continue;
      const held = bestInBlock.get(log.exerciseId);
      if (!held || best.kg > held.kg || (best.kg === held.kg && best.reps > held.reps)) {
        bestInBlock.set(log.exerciseId, {
          exerciseName: log.exerciseName,
          kg: best.kg,
          reps: best.reps,
        });
      }
    }
  }
  const personalBests: ReportBest[] = [];
  for (const [id, best] of bestInBlock) {
    // A prior of zero means the app has never seen this exercise before, and
    // everything anybody ever does would be a personal best on that reading.
    const prior = bestBefore.get(id) ?? 0;
    if (prior > 0 && best.kg > prior) personalBests.push(best);
  }
  personalBests.sort((a, b) => b.kg - a.kg);

  // ── How it felt over time ────────────────────────────────────────────────
  //
  // First half against second, which needs at least four sessions for the two
  // halves to be worth comparing at all. Below that it is one session against
  // one, and the answer swings on a single bad night.
  let acheTrend: ProgrammeReport['acheTrend'] = null;
  if (acheSessions > 0 && all.length >= 4) {
    const mid = Math.floor(all.length / 2);
    const early = all.slice(0, mid).filter((s) => s.hadAches).length / Math.max(1, mid);
    const late =
      all.slice(mid).filter((s) => s.hadAches).length / Math.max(1, all.length - mid);
    acheTrend = late < early - 0.15 ? 'settled' : late > early + 0.15 ? 'worse' : 'same';
  }

  // ── The one thing in the biggest type ────────────────────────────────────
  //
  // A lift that moved beats a total, because it is about them rather than about
  // arithmetic. A total beats a session count, because it is bigger than they
  // expect. And a session count is never nothing: somebody who did twelve
  // sessions of mobility work moved no weight at all and still finished a block.
  const highlight: ReportHighlight | null =
    movers.length > 0 && movers[0].deltaKg >= 1
      ? { kind: 'lift', move: movers[0] }
      : volumeKg > 0
        ? { kind: 'volume', kg: Math.round(volumeKg) }
        : all.length > 0
          ? { kind: 'sessions', count: all.length }
          : null;

  const spanDays =
    all.length >= 2 ? wholeDays(all[0].date, all[all.length - 1].date) : all.length === 1 ? 1 : 0;

  return {
    v: REPORT_VERSION,
    onPlan: onPlanSessions.length,
    offPlan,
    blockLength: programme.sessions,
    cycle: cycleOf(programme),
    byType: [...byType.entries()]
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count),
    spanDays,
    // Guarded against a span of zero, which is what a block finished in one day
    // produces and what would otherwise divide by nothing.
    perWeek: spanDays > 0 ? round1((all.length / spanDays) * 7) : all.length,
    plannedPerWeek: programme.days,
    minutesTrained: Math.round(minutesTrained),
    totalSets,
    totalReps,
    volumeKg: Math.round(volumeKg),
    distinctExercises: exerciseIds.size,
    deloadSessionsDone: deloadDone.size,
    testSessions,
    movers,
    slipped,
    personalBests: personalBests.slice(0, 5),
    highlight,
    acheSessions,
    acheRegions: [...acheRegions],
    acheTrend,
    cleanSessions,
    effort,
    step: levelStepFor(experience, earnedBonus, {
      // Both halves over the same set of sessions.
      cleanSessions: cleanOnPlan,
      onPlan: onPlanSessions.length,
      effort,
    }),
  };
}

// ─── The archive ────────────────────────────────────────────────────────────

/**
 * A block that has been finished, kept for good.
 *
 * Everything about the enrolment is COPIED rather than referenced, including the
 * cycle and the name. A custom programme's cycle lives on the enrolment and can
 * be edited; a named one can be renamed in a future release. Neither may reach
 * back and change what a finished block says it was.
 */
export interface CompletedProgramme {
  id: string;
  templateId: EnrolledProgramme['templateId'];
  /** What it was called at the time. */
  name: string;
  days: EnrolledProgramme['days'];
  sessions: EnrolledProgramme['sessions'];
  cycle: SessionType[];
  startedAt: string;
  finishedAt: string;
  /** How many weeks it worked out at, at the frequency it was written for. */
  weeks: number;
  /** Which weeks of it were the planned easier ones. */
  deloadWeeks: number[];
  /** The ids of the sessions counted in it, so history can point back here. */
  sessionIds: string[];
  report: ProgrammeReport;
}

/**
 * Freeze a finished block into an archive entry.
 *
 * The id is derived from the enrolment rather than generated, so calling this
 * twice for the same block produces the same id and the caller can refuse the
 * duplicate. Somebody who keeps training past the last session of a block must
 * not collect a fresh certificate every time they log another one.
 */
export function archiveIdFor(p: EnrolledProgramme): string {
  return `${p.templateId}:${p.startedAt}:${p.startedAtSessionCount}`;
}

export function completeProgramme(input: ReportInput): CompletedProgramme {
  const { programme, sessionsSinceEnrolment, finishedAt } = input;
  const tags = tagSessions(
    programme,
    sessionsSinceEnrolment.map((s) => s.sessionType)
  );
  return {
    id: archiveIdFor(programme),
    templateId: programme.templateId,
    name: nameOf(programme),
    days: programme.days,
    sessions: programme.sessions,
    cycle: cycleOf(programme),
    startedAt: programme.startedAt,
    finishedAt,
    weeks: weeksFor(programme.sessions, programme.days),
    deloadWeeks: deloadWeeksFor(programme),
    sessionIds: sessionsSinceEnrolment.filter((_, i) => tags[i]?.onPlan).map((s) => s.id),
    report: buildProgrammeReport(input),
  };
}

/**
 * Was this session part of a block that has already been archived?
 *
 * The history screen tags sessions against the CURRENT enrolment, which leaves
 * everything from a finished block unmarked - the same rows the report was just
 * built from. Reading the archive as well means a session keeps the block it
 * belonged to for as long as the block is kept.
 */
export function archivedTagFor(
  archive: CompletedProgramme[],
  sessionId: string
): { name: string; blockIndex: number; total: number; deload: boolean } | null {
  for (const done of archive) {
    const at = done.sessionIds.indexOf(sessionId);
    if (at < 0) continue;
    const week = Math.floor(at / done.days) + 1;
    return {
      name: done.name,
      blockIndex: at + 1,
      total: done.sessions,
      deload: done.deloadWeeks.includes(week),
    };
  }
  return null;
}

