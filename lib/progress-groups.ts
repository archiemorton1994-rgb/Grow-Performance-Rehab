/**
 * HOW HISTORY IS GROUPED FOR THE EYE, WITHOUT TOUCHING WHAT WAS STORED.
 *
 * Somebody who trained here before the rebuild has completed sessions filed
 * under 'squat', 'bench' and 'deadlift' sitting alongside newer ones filed
 * under 'lower_body', 'upper_body' and 'full_body'. Those old ids are kept on
 * purpose: a completed session is a record of a day that happened, and
 * rewriting it to make a screen tidier would be the app editing somebody's
 * history behind their back. Archie's answer was exactly that - "merge the rows
 * on screen and leave the stored record alone".
 *
 * The consequence, before this file existed, was Stats showing TWO rows both
 * headed Lower Body, one counting four sessions and one counting three, with no
 * seven anywhere. Every label table already resolved a stored 'squat' to the
 * words "Lower Body" (see lib/session-meta.ts), so the two rows were not merely
 * confusing, they were indistinguishable.
 *
 * So: the grouping is done HERE, over `trainTypeOf`, and nothing writes. Every
 * function takes a plain array and returns a new one. The stored array goes in
 * and comes back out untouched, which is something a check can assert by
 * comparing it byte for byte either side of a render.
 *
 * WHY `trainTypeOf` AND NOT A SECOND TABLE. lib/session-type.ts already says
 * what an old id means today, the generator builds from it, the labels resolve
 * through it and the artwork is chosen by it. A display-only copy of the same
 * three pairings would be a second answer to a question that already has one,
 * and the two would drift the first time a fourth id retired.
 *
 * Pure, free of React and free of any runtime import (the store is imported for
 * its TYPES only), so the checks RUN it rather than reading a screen for a
 * spelling.
 */
import { trainTypeOf, type TrainSessionType } from './session-type';
import type { SessionType } from './store';

/**
 * Every train type at nought, which is what makes the counting total.
 *
 * Written out rather than built from a list, so an eighth train type fails the
 * typecheck here instead of counting silently as nothing on the Stats screen.
 */
function zeroCounts(): Record<TrainSessionType, number> {
  return {
    lower_body: 0,
    upper_body: 0,
    full_body: 0,
    conditioning: 0,
    prehab: 0,
    flexibility: 0,
    custom: 0,
  };
}

/**
 * The order the Session Breakdown donut and its legend walk the types in.
 *
 * The old list had the three lift ids at the front, which is where the
 * duplicate rows came from: 'squat' was drawn, then 'lower_body' was drawn
 * again six entries later.
 */
export const SESSION_BREAKDOWN_ORDER: TrainSessionType[] = [
  'lower_body',
  'upper_body',
  'full_body',
  'conditioning',
  'prehab',
  'flexibility',
  'custom',
];

/**
 * The order the Progress tab stacks its per-session-type groups in.
 *
 * Upper before lower here, matching what that tab has always shown. It is a
 * separate constant from the donut's on purpose: merging the rows was the
 * decision, re-ordering two screens that nobody complained about was not.
 */
export const EXERCISE_GROUP_ORDER: TrainSessionType[] = [
  'upper_body',
  'lower_body',
  'full_body',
  'conditioning',
  'prehab',
  'flexibility',
  'custom',
];

/** How many of these sessions each train type accounts for, legacy ids folded in. */
export function countsByTrainType(
  sessions: { sessionType: SessionType }[]
): Record<TrainSessionType, number> {
  const counts = zeroCounts();
  for (const session of sessions) {
    if (!session) continue;
    const type = trainTypeOf(session.sessionType);
    // Anything written by a build this one has never met resolves to nothing
    // and is skipped, exactly as countSessionsOfType already does, rather than
    // adding one to a key nobody will ever read.
    if (counts[type] === undefined) continue;
    counts[type]++;
  }
  return counts;
}

export interface SessionTypeRow {
  type: TrainSessionType;
  count: number;
}

/**
 * The rows the Session Breakdown shows: one per train type that has any
 * history at all, counting the old ids and the new ones together.
 *
 * Four squat days and three lower body days are one row reading seven.
 */
export function sessionTypeRows(sessions: { sessionType: SessionType }[]): SessionTypeRow[] {
  const counts = countsByTrainType(sessions);
  return SESSION_BREAKDOWN_ORDER.filter((type) => counts[type] > 0).map((type) => ({
    type,
    count: counts[type],
  }));
}

/**
 * The filter as the SCREEN groups it.
 *
 * `historyTypeFilter` is persisted, so somebody who last left Stats filtered to
 * their squat days has 'squat' sitting in storage. Taken through here it
 * selects the merged Lower Body row rather than quietly matching nothing and
 * clearing itself.
 */
export function displayTypeFilter(filter: SessionType | null): TrainSessionType | null {
  return filter === null ? null : trainTypeOf(filter);
}

/** Whether a stored session belongs under the train type currently filtered to. */
export function matchesTypeFilter(
  sessionType: SessionType,
  filter: TrainSessionType | null
): boolean {
  return filter === null || trainTypeOf(sessionType) === filter;
}

/**
 * Anything carrying a session type, stacked into groups in the given order.
 *
 * Used for the Progress tab's exercise rows, where each exercise remembers the
 * type of the session it was last logged in: a Back Squat whose most recent
 * appearance was an old squat day belongs in the same Lower Body group as one
 * logged last week.
 *
 * Groups with nothing in them are left out, and a type absent from `order` is
 * dropped - which is why both orders in this file list every train type.
 */
export function groupByTrainType<T extends { sessionType: SessionType }>(
  items: T[],
  order: TrainSessionType[]
): { type: TrainSessionType; items: T[] }[] {
  const map = new Map<TrainSessionType, T[]>();
  for (const item of items) {
    const type = trainTypeOf(item.sessionType);
    const arr = map.get(type) ?? [];
    arr.push(item);
    map.set(type, arr);
  }
  return order
    .filter((type) => map.has(type))
    .map((type) => ({ type, items: map.get(type)! }));
}

/**
 * What this person actually trains, most-used first.
 *
 * Ties are broken by SESSION_BREAKDOWN_ORDER rather than by whichever happened
 * to appear first in the history, so the line under the header on Your
 * Programme does not reshuffle itself every time a session is logged.
 */
export function trainingMixTypes(
  sessions: { sessionType: SessionType }[],
  limit = 3
): TrainSessionType[] {
  const counts = countsByTrainType(sessions);
  return SESSION_BREAKDOWN_ORDER.filter((type) => counts[type] > 0)
    .sort((a, b) => counts[b] - counts[a])
    .slice(0, limit);
}

/**
 * The most recent session of a train type, or undefined if there is none.
 *
 * Takes the list NEWEST FIRST, which is how the store keeps completedSessions,
 * and returns the first match - so "last trained" on Your Programme answers for
 * the merged group. Before this, somebody with six years of squat days and no
 * session filed under 'lower_body' was told Lower Body was "Not done yet".
 */
export function lastSessionOfTrainType<T extends { sessionType: SessionType }>(
  newestFirst: T[],
  type: TrainSessionType
): T | undefined {
  return newestFirst.find((session) => trainTypeOf(session.sessionType) === type);
}

/**
 * Per-type totals that were counted somewhere else, folded the same way.
 *
 * The programme report is FROZEN the day it is written and keeps whatever ids
 * were stored at the time - a block trained under the old rotation really does
 * carry 'squat' counts, and lib/programme-report.ts must go on writing them.
 * This merges them for the reader only, so the chips under a finished block say
 * "Lower Body · 7" instead of "Lower Body · 4" beside "Lower Body · 3".
 *
 * Order is inherited from the rows handed in: the first time a train type
 * appears is where its merged chip sits.
 */
export function mergeTypeCounts(
  rows: { type: SessionType; count: number }[]
): { type: TrainSessionType; count: number }[] {
  const merged: { type: TrainSessionType; count: number }[] = [];
  const at = new Map<TrainSessionType, number>();
  for (const row of rows) {
    const type = trainTypeOf(row.type);
    const index = at.get(type);
    if (index === undefined) {
      at.set(type, merged.length);
      merged.push({ type, count: row.count });
    } else {
      merged[index].count += row.count;
    }
  }
  return merged;
}
