/**
 * WHOSE DATA IS THIS, AND WHICH COPY OF IT IS RIGHT.
 *
 * Four separate ways to lose somebody's training were found in the sync path,
 * and every one of them was reproduced by running the real store rather than by
 * reading it. All four come down to two questions this module answers.
 *
 * 1. MERGING REPLACED RATHER THAN MERGED. mergeServerData did
 *    `completedSessions: data.completedSessions ?? s.completedSessions` inside
 *    `if (serverCount > localCount)`, so a session logged offline and not yet
 *    uploaded was destroyed the moment the server happened to be one ahead. The
 *    comment above it claimed the opposite - that offline sessions "are never
 *    thrown away" - which is a non sequitur: a longer list is not a superset.
 *    Sessions carry unique ids, so the union is trivially available and always
 *    correct.
 *
 * 2. THE OWNER CHECK LOOKED AT ONE FIELD. The wipe that stops one person's
 *    history reaching another person's account was gated on completedSessions
 *    alone, while the upload right after it ships userProfile, oneRepMaxes,
 *    bodyweightLog, savedTemplates, equipmentTiers and earnedBadges. Somebody
 *    who onboarded and never trained - which includes everyone who never
 *    subscribed - carried a full profile and up to three one-rep maxes straight
 *    into the next account that signed in on that phone, and because
 *    onboardingComplete is persisted the new user was never asked to redo it.
 *    Their prescribed working weights came from a stranger's numbers.
 *
 * Everything here is pure and free of react-native imports, so the tests RUN it.
 */
import type { CompletedSession } from '@/lib/store';

/**
 * Every session from either side, once each.
 *
 * Ids are minted in completeSession as `Date.now() + random`, so they are
 * unique per session and stable across a round trip through the server. The
 * device's copy wins a collision: it is the one that has been edited most
 * recently (session notes are editable after the fact, and only locally).
 *
 * Sorted newest first, because that is the order the whole app reads them in -
 * completedSessions[0] is "your last session" in a dozen places.
 */
export function mergeSessionsById(
  local: CompletedSession[],
  server: CompletedSession[] | undefined
): CompletedSession[] {
  if (!server || server.length === 0) return local;
  const byId = new Map<string, CompletedSession>();
  // Server first so that a local copy of the same id overwrites it.
  for (const s of server) if (s && s.id) byId.set(s.id, s);
  for (const s of local) if (s && s.id) byId.set(s.id, s);
  return [...byId.values()].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );
}

/** The parts of the store that belong to a person rather than to the app. */
export interface OwnedDataSnapshot {
  completedSessions: unknown[];
  oneRepMaxes: unknown[];
  bodyweightLog: unknown[];
  savedTemplates: unknown[];
  earnedBadges: unknown[];
  userProfile: { name?: string | null } | null | undefined;
}

/**
 * Does this device hold anything that belongs to a particular person?
 *
 * Deliberately wider than "has trained". The upload after sign-in ships the
 * profile, the one-rep maxes and the weigh-in log whether or not a single
 * session exists, and those are exactly the fields that go on to set somebody
 * else's working weights.
 *
 * A named profile counts. It is the thing onboarding writes first, it is what
 * makes the app skip onboarding for the next person, and a name is the one
 * field that is unambiguously somebody's.
 */
export function deviceHoldsPersonalData(s: OwnedDataSnapshot): boolean {
  return (
    (s.completedSessions?.length ?? 0) > 0 ||
    (s.oneRepMaxes?.length ?? 0) > 0 ||
    (s.bodyweightLog?.length ?? 0) > 0 ||
    (s.savedTemplates?.length ?? 0) > 0 ||
    (s.earnedBadges?.length ?? 0) > 0 ||
    !!s.userProfile?.name?.trim()
  );
}

export interface OwnerCheck {
  dataOwnerId: string | null;
  /** Set by the v29 migration for a device that had history but no tag. */
  dataOwnerClaimPending: boolean;
  signingInAs: string;
}

/**
 * Should signing in as this account wipe what is already on the device?
 *
 * THE CASE THIS EXISTS TO STOP: person A's device, A's token has quietly
 * expired (they are stateless and last 30 days, with no refresh), B signs in.
 * Without a wipe, B's brand-new account is filled with A's history and A's
 * one-rep maxes, and that cannot be undone.
 *
 * THE CASE IT MUST NOT BREAK, and did: `dataOwnerId` shipped on 2026-08-11
 * without bumping the store version, so on every device upgrading from an older
 * build it rehydrates as null. `null !== yourId` is true, so the guard read
 * every existing user as an intruder and deleted their training the next time
 * they signed in - which they all do eventually, because the token expires
 * monthly. Confirmed by rehydrating the real store from a pre-upgrade blob.
 *
 * The v29 migration marks those devices claimable exactly once: a device with
 * completed sessions on it has necessarily been signed in, because the paywall
 * sits between onboarding and the tabs, so the person signing in on it is that
 * same person. After the first sign-in it is tagged like everything else and
 * this returns to being a plain identity check.
 */
export function shouldWipeForNewOwner(c: OwnerCheck, s: OwnedDataSnapshot): boolean {
  if (c.dataOwnerId !== null) {
    /**
     * CERTAIN. This device is tagged to a named account, so anything on it
     * belongs to that account and a different one is signing in. Here the wide
     * test applies: the upload twenty lines later ships the profile, the
     * one-rep maxes and the weigh-in log whether or not a session exists.
     */
    return c.dataOwnerId !== c.signingInAs && deviceHoldsPersonalData(s);
  }

  /**
   * UNTAGGED, AND GENUINELY AMBIGUOUS. Two people land here and nothing in the
   * local state tells them apart:
   *
   *   - somebody who has just finished onboarding on their own phone and is
   *     signing in for the first time. They have a name, a bodyweight and up to
   *     three one-rep maxes, and wiping them would delete the answers they gave
   *     ninety seconds ago.
   *   - somebody handed a phone whose previous owner never signed in.
   *
   * Training history is the only signal that separates them, because reaching
   * the tabs to log a session requires an account. So the narrow test is the
   * right one here, and it is the one this guard always used.
   *
   * The claim flag is the third case: a device that has history AND no tag
   * because the tag shipped without a migration. That is an upgrade, not an
   * intruder.
   */
  return (s.completedSessions?.length ?? 0) > 0 && !c.dataOwnerClaimPending;
}
