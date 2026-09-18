import type { ActiveSession } from './store';
import type { Exercise } from './workout-engine';

/**
 * Finishing the session you started, even across an app update.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHAT WENT WRONG
 * ─────────────────────────────────────────────────────────────────────────────
 * A paused session used to be stored as a list of exercise IDs and the sets
 * logged against each one. Resuming re-ran the generator, compared the IDs it
 * produced today with the IDs that were stored, and only put the sets back if
 * the two lists matched position for position.
 *
 * That holds for as long as the generator never changes. It changes constantly:
 * the rebuild moves the whole app onto Archie's exercise library, which renames
 * exercises, empties pools and re-rates levels. Somebody ten sets into a squat
 * session on Friday evening, whose phone updates the app overnight, opens it on
 * Saturday to a session built from a different list, a failed ID match, and
 * every set they logged silently discarded, while the Home card they tapped
 * still read "10/24 sets".
 *
 * And it is not only the IDs. Even where the same exercises come back, the
 * generator recomputes the weights, the rep targets and the swaps from a
 * history that has moved on. Half a workout finished on Friday's numbers and
 * half on Saturday's is not one session.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHAT HAPPENS NOW
 * ─────────────────────────────────────────────────────────────────────────────
 * Every save writes the cards themselves, whole, into
 * `ActiveSession.exerciseSnapshot`. A resume prefers that list over anything the
 * generator would produce today, so the session is finished exactly as it was
 * started. The generator is only consulted when there is no snapshot to prefer,
 * which is what a session paused by an older build looks like: those resume
 * precisely as they did before.
 *
 * This lives in its own file rather than inside the session screen so that a
 * check can run the real decision rather than read the screen's source. The
 * repo's commonest test defect is a check that pins a spelling and stays green
 * while the behaviour underneath it breaks.
 */

/**
 * What the session screen was launched with: the seven facts that decide
 * WHICH session this is.
 *
 * A stored snapshot belongs to the session it was saved from and to no other,
 * so all seven have to agree before it can be preferred. They are the same
 * seven the restore has always compared, and they are compared in one place so
 * that a field added to one half cannot go missing from the other.
 */
export interface SessionLaunch {
  sessionType: ActiveSession['sessionType'];
  equipmentTier: ActiveSession['equipmentTier'];
  hasAches: boolean;
  painRegion?: ActiveSession['painRegion'];
  energy: ActiveSession['energy'];
  timeAvailable: ActiveSession['timeAvailable'];
  isTestWeek: boolean;
}

/** Does this stored session describe the session now on screen? */
export function storedMatchesLaunch(
  stored: Pick<
    ActiveSession,
    | 'sessionType'
    | 'equipmentTier'
    | 'hasAches'
    | 'painRegion'
    | 'energy'
    | 'timeAvailable'
    | 'isTestWeek'
  >,
  launch: SessionLaunch
): boolean {
  return (
    stored.sessionType === launch.sessionType &&
    stored.equipmentTier === launch.equipmentTier &&
    stored.hasAches === launch.hasAches &&
    (stored.painRegion ?? '') === (launch.painRegion ?? '') &&
    stored.energy === launch.energy &&
    stored.timeAvailable === launch.timeAvailable &&
    stored.isTestWeek === launch.isTestWeek
  );
}

/**
 * Is this snapshot something the screen can actually render and log against?
 *
 * It has been through AsyncStorage and every migration since it was written, so
 * the shape is checked rather than assumed. `sets` in particular builds the
 * blank set rows, and a card that arrived without a sane one would leave the
 * user looking at an exercise they cannot log. Anything that fails this falls
 * back to the generator, which is the behaviour a snapshot-less session already
 * gets.
 */
export function isUsableSnapshot(snapshot: unknown): snapshot is Exercise[] {
  if (!Array.isArray(snapshot) || snapshot.length === 0) return false;
  return snapshot.every(
    (ex) =>
      !!ex &&
      typeof ex === 'object' &&
      typeof (ex as Exercise).id === 'string' &&
      (ex as Exercise).id.length > 0 &&
      typeof (ex as Exercise).name === 'string' &&
      (ex as Exercise).name.length > 0 &&
      Number.isFinite((ex as Exercise).sets) &&
      (ex as Exercise).sets > 0
  );
}

/**
 * The saved cards this session should run on, or null to run on today's.
 *
 * Null covers everything that is not a resume: a fresh start, a session paused
 * by a build that stored no cards, a snapshot belonging to some other session,
 * and anything that came back out of storage mis-shapen. In every one of those
 * the generator's list is used, which is the behaviour that was there before.
 *
 * Hold on to a non-null answer for the life of the screen. Swapping lists
 * halfway through a session resets everything logged against them.
 */
export function snapshotToResume(
  stored: ActiveSession | null | undefined,
  launch: SessionLaunch
): Exercise[] | null {
  if (!stored) return null;
  if (!isUsableSnapshot(stored.exerciseSnapshot)) return null;
  if (!storedMatchesLaunch(stored, launch)) return null;
  return stored.exerciseSnapshot;
}
