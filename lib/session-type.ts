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

/** The three ids kept only so history, sync and frozen reports still resolve. */
export const LEGACY_SESSION_TYPES: SessionType[] = ['squat', 'bench', 'deadlift'];

/** True for a stored id that no longer names the session anybody is given. */
export function isLegacySessionType(sessionType: SessionType): boolean {
  return LEGACY_SESSION_TYPES.includes(sessionType);
}
