/**
 * WHAT GROW SUGGESTS WHEN NO PROGRAMME IS CHOOSING, AS PLAIN DATA.
 *
 * A programme is optional. Most people will never be on one, and for all of them
 * the app still has to answer "what am I doing today" on two screens: the Home
 * hero and Your Programme. Those two screens disagreed. Home asked
 * getCurrentSessionType; Your Programme drew Lower / Upper / Full straight off
 * the session count, ignored `cycleStartOffset`, and ignored Archie's second
 * decision entirely, so a beginner four sessions in was shown Upper Body marked
 * "current" on one screen and offered Full Body on the other.
 *
 * Everything here is pure and free of React, so tests RUN it and compare what it
 * produces against what the real store suggests, rather than reading a screen
 * for a spelling. That is the whole point of the module: the agreement between
 * the two screens is now something a check can measure.
 */
import { SESSION_ORDER, type SessionType } from './store';
import type { TrainSessionType } from './session-type';

/**
 * THE FIRST SESSION, CHOSEN RATHER THAN ASSIGNED.
 *
 * Somebody who has never lifted here has no rotation position to carry, so the
 * app has to start them somewhere, and picking for them is how a person ends up
 * being offered legs on the one day they cannot face legs. These are the three
 * the rotation moves through, in the order the rotation uses them.
 */
export const FIRST_SESSION_CHOICES: TrainSessionType[] = ['lower_body', 'upper_body', 'full_body'];

/**
 * The stored offset that makes `type` come up next for somebody with no lifting
 * history.
 *
 * `cycleStartOffset` is a bare index into SESSION_ORDER and the suggestion is
 * SESSION_ORDER[(liftingCount + offset) % 3], so with no lifting sessions behind
 * them the offset IS the index of the session they picked. Written as a lookup
 * into SESSION_ORDER rather than as a number per session, so re-ordering the
 * rotation cannot leave this pointing at the wrong one.
 *
 * -1 for anything that is not in the rotation, which the caller must not store.
 */
export function offsetForFirstSession(type: SessionType): number {
  return SESSION_ORDER.indexOf(type);
}

/** How many rows the rotation timeline draws before it repeats. */
export const ROTATION_TIMELINE_LENGTH = 9;

export interface TimelineItem {
  sessionType: SessionType;
  status: 'completed' | 'current' | 'upcoming';
}

export interface TimelineInput {
  /**
   * Whether this person rotates at all: rotatesSessions() in
   * lib/session-type.ts. False for a beginner who has not earned a rung, who is
   * offered Full Body every session and has no rotation to be drawn a picture
   * of.
   */
  rotates: boolean;
  /**
   * Whether their recent training has been lifting: isOnStrengthProgramme() in
   * the store. False for somebody living on conditioning and mobility, whose
   * programme is what they actually do rather than a rotation they are not on.
   */
  onRotation: boolean;
  /** Lifting sessions completed, counted through trainTypeOf. */
  liftingCount: number;
  /** Their stored rotation offset. */
  cycleStartOffset: number;
  /** The last few completed session types, NEWEST FIRST, as history keeps them. */
  recentTypes: SessionType[];
  /** What the store is suggesting next, which every branch has to end on. */
  suggestedNext: SessionType;
}

/**
 * The rows Your Programme draws for somebody no programme is choosing for.
 *
 * ONE PROMISE HOLDS FOR EVERY BRANCH: the row marked `current` is the session
 * the store suggests. The rotation branch gets there by arithmetic and the
 * history branch by taking the suggestion directly, and a check asserts it for
 * every experience level, session count and offset rather than trusting either.
 */
export function sessionTimeline(i: TimelineInput): TimelineItem[] {
  /**
   * NOT ON THE ROTATION? THEN DO NOT DRAW ONE.
   *
   * This screen used to build nine rows out of SESSION_ORDER whatever somebody
   * trained, so a person who has never lifted opened "Your Programme" and was
   * shown a nine-row cycle with "Not done yet" beside every one of them. Their
   * programme is what they actually do, so it is drawn from history: the last
   * few sessions, then whatever is suggested next.
   */
  if (!i.rotates || !i.onRotation) {
    const items: TimelineItem[] = i.recentTypes
      .slice()
      .reverse()
      .map((sessionType) => ({ sessionType, status: 'completed' as const }));
    items.push({ sessionType: i.suggestedNext, status: 'current' });
    return items;
  }

  /**
   * The rotation, drawn from the same two numbers the suggestion is made from.
   *
   * `+ cycleStartOffset` is the half that was missing. The row index alone gave
   * SESSION_ORDER[position % 3], which is only the suggested session when the
   * offset happens to be nought, so the first-session chooser would have made
   * this screen contradict Home for two people in three.
   */
  const length = ROTATION_TIMELINE_LENGTH;
  const position = i.liftingCount % length;
  const items: TimelineItem[] = [];
  for (let row = 0; row < length; row++) {
    items.push({
      sessionType: SESSION_ORDER[(row + i.cycleStartOffset) % SESSION_ORDER.length],
      status: row < position ? 'completed' : row === position ? 'current' : 'upcoming',
    });
  }
  return items;
}
