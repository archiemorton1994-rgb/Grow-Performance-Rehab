// Type only, so this module has NO runtime dependency at all. That matters:
// lib/workout-engine.ts imports it, the store imports the engine, and a runtime
// edge back to the store would close that loop into a cycle. It is also what
// lets a plain node check import this file on its own.
import type { SessionType } from './store';

/**
 * WHICH SESSION THE APP ACTUALLY BUILDS FOR A STORED SESSION TYPE.
 *
 * Three of the ten ids are named after a barbell lift: 'squat', 'bench' and
 * 'deadlift'. They were the whole app once - a three day rotation built around
 * the competition lifts - and they are still sitting in three places we cannot
 * simply rename:
 *
 *   1. Completed sessions. Years of somebody's history is tagged with them.
 *   2. Synced data. The server holds the same ids and sends them back.
 *   3. Frozen programme reports and the Barbell Strength cycle, which an
 *      enrolled user is part way through and is entitled to finish.
 *
 * So the ids stay readable for ever, and this is the one place that says what
 * they MEAN today: a squat day is a lower body day, a bench day is an upper
 * body day, and a deadlift day is a full body day. Everything else is already
 * what it says it is and maps to itself.
 *
 * The same three pairings are in lib/badge-engine.ts, where a squat session and
 * a lower body session have always counted towards the same badge. This is that
 * map, applied to the session somebody is about to be given rather than to the
 * badge they earned afterwards.
 *
 * Deliberately total rather than a partial lookup with a fallback: a silent
 * `?? sessionType` on a typo is how a session type goes missing without anybody
 * noticing. Every id is written out, so adding an eleventh fails typecheck here
 * before it can fail quietly anywhere else.
 */
/**
 * A session type the app still BUILDS. Every id except the three lift-named
 * ones, which is what makes `Record<TrainSessionType, ...>` a table nothing
 * legacy can be filed under by accident.
 */
export type TrainSessionType = Exclude<SessionType, 'squat' | 'bench' | 'deadlift'>;

const TRAIN_TYPE: Record<SessionType, TrainSessionType> = {
  squat: 'lower_body',
  bench: 'upper_body',
  deadlift: 'full_body',
  upper_body: 'upper_body',
  lower_body: 'lower_body',
  full_body: 'full_body',
  conditioning: 'conditioning',
  prehab: 'prehab',
  flexibility: 'flexibility',
  custom: 'custom',
};

/** The session type to BUILD for a stored one. See TRAIN_TYPE above. */
export function trainTypeOf(sessionType: SessionType): TrainSessionType {
  return TRAIN_TYPE[sessionType];
}

/**
 * THE SESSIONS THAT PUT A WEIGHT THROUGH THE BODY.
 *
 * Counting these is how the app knows how far into a training block somebody
 * is: it turns the exercise rotation over, and it is the only thing allowed to
 * nudge a first-time weight estimate upwards. Conditioning, prehab and
 * flexibility are deliberately out - none of them load the lifts being
 * progressed, so none of them may claim credit for progressing them - and a
 * custom session is out too, because it can be anything at all.
 *
 * Written against the TRAIN type, never the stored id, so a squat day logged
 * three years ago counts exactly as the lower body day it now means. That is
 * the whole reason this list is here rather than in the store beside
 * STRENGTH_SESSION_TYPES: the old list named the three lift ids literally, and
 * once the app stopped building them, everybody training Lower, Upper and Full
 * Body counted zero sessions for ever. Their rotation froze on one seed and
 * their block progress never moved.
 */
export const LIFTING_SESSION_TYPES: TrainSessionType[] = ['upper_body', 'lower_body', 'full_body'];

/** True when a stored session type is one the app progresses loads from. */
export function isLiftingSession(sessionType: SessionType): boolean {
  return LIFTING_SESSION_TYPES.includes(TRAIN_TYPE[sessionType]);
}

/**
 * How many of these completed sessions were lifting sessions.
 *
 * Takes the bare field rather than a CompletedSession, so the store's migration
 * can count a plain object read back off disk with the same function the live
 * app uses. Anything whose type is not a session type we know is not counted:
 * the lookup returns undefined and the test below is false, which is the right
 * answer for a record written by a build this one has never met.
 */
export function countLiftingSessions(sessions: { sessionType: SessionType }[]): number {
  let n = 0;
  for (const session of sessions) {
    if (session && isLiftingSession(session.sessionType)) n++;
  }
  return n;
}

/** The three ids kept only so history, sync and frozen reports still resolve. */
export const LEGACY_SESSION_TYPES: SessionType[] = ['squat', 'bench', 'deadlift'];

/** True for a stored id that no longer names the session anybody is given. */
export function isLegacySessionType(sessionType: SessionType): boolean {
  return LEGACY_SESSION_TYPES.includes(sessionType);
}
