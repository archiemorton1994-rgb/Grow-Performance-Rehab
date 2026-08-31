/**
 * Contract test: four ways to lose somebody's training, all of which were
 * reachable, and none of which any test noticed.
 *
 * Every one of these was reproduced against the REAL store before it was
 * fixed - not read, run. The sections below run it again.
 *
 * 1. MERGING REPLACED THE SESSION LIST. mergeServerData did
 *    `completedSessions: data.completedSessions ?? s.completedSessions` inside
 *    `if (serverCount > localCount)`. A session logged with no signal and not
 *    yet uploaded was destroyed the moment the server happened to be one ahead,
 *    and uploads fail silently with no retry queue, so that is not rare. The
 *    comment directly above it claimed offline sessions "are never thrown
 *    away", which is a non sequitur: a longer list is not a superset.
 *
 * 2. THE FOREGROUND SYNC TRUNCATED THE SERVER. Every return to foreground PUT
 *    the whole document with no version marker and no download first, and the
 *    server writes it unconditionally. A second device that was behind deleted
 *    the newer sessions off the server, and the merge's strictly-ahead rule
 *    then blocked recovery: 10 against 10 does nothing.
 *
 * 3. AN UPDATE WIPED PEOPLE. dataOwnerId shipped on 2026-08-11 without bumping
 *    the store version, so migrate() never ran and it rehydrated as null. The
 *    sign-in guard read `null !== yourId` as an intruder and cleared storage.
 *    Everybody reaches that screen eventually: the token lasts 30 days with no
 *    refresh.
 *
 * 4. AND IT LET A PROFILE THROUGH. The same guard looked only at
 *    completedSessions, while the upload beneath it ships userProfile,
 *    oneRepMaxes, bodyweightLog, savedTemplates and earnedBadges. Somebody who
 *    onboarded and never trained carried their profile and one-rep maxes into
 *    the next account that signed in on that phone.
 *
 * Run:  npx tsx tests/sync-safety.check.mjs
 * Exit: 0 = all pass, 1 = one or more failures
 */

globalThis.__DEV__ = false;

import { readFileSync } from 'fs';
import './_persist-shim.mjs';

const M = await import('../lib/sync-merge.ts');
const { useAppStore } = await import('../lib/store.ts');

let failures = 0;
let total = 0;
function check(label, condition, detail) {
  total++;
  if (condition) console.log(`  ✓ ${label}`);
  else {
    console.error(`  ✗ FAIL: ${label}${detail ? ` — ${detail}` : ''}`);
    failures++;
  }
}

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const stripComments = (s) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const daysAgo = (n) => new Date(Date.now() - n * 86400000).toISOString();
const sess = (id, n) => ({
  id,
  sessionType: 'squat',
  date: daysAgo(n),
  equipmentTier: 'fullgym',
  hadAches: false,
  energy: 'good',
  timeAvailable: '60',
  exerciseCount: 5,
  durationSeconds: 2700,
  exerciseLogs: [],
  isTestWeek: false,
});

/** A device holding nothing, as the shape shouldWipeForNewOwner reads. */
const EMPTY_FOR_CLAIM = {
  completedSessions: [],
  oneRepMaxes: [],
  bodyweightLog: [],
  savedTemplates: [],
  earnedBadges: [],
  userProfile: { name: '' },
};

// ─── 1. The union ────────────────────────────────────────────────────────────
console.log('\n[1] A session logged offline survives a merge');

const local = [sess('LOCAL-OFFLINE', 1), sess('s10', 3), sess('s9', 5)];
const server = [sess('s12', 0), sess('s11', 2), sess('s10', 3), sess('s9', 5)];
const merged = M.mergeSessionsById(local, server);
const ids = merged.map((s) => s.id);

check(
  'the offline session is still there after a server that is ahead merges in',
  ids.includes('LOCAL-OFFLINE'),
  `got ${ids.join(', ')}`
);
check(
  'and so is everything the server had',
  ['s12', 's11', 's10', 's9'].every((id) => ids.includes(id)),
  ids.join(', ')
);
check(
  'nothing is duplicated',
  new Set(ids).size === ids.length,
  `${ids.length} entries, ${new Set(ids).size} distinct`
);
check(
  'newest first, which is the order the whole app reads them in',
  ids[0] === 's12' && ids[ids.length - 1] === 's9',
  ids.join(', ')
);
check(
  'the device wins a collision, because only it can have edited the notes',
  M.mergeSessionsById(
    [{ ...sess('x', 1), notes: 'mine' }],
    [{ ...sess('x', 1), notes: 'stale' }]
  )[0].notes === 'mine',
  ''
);
check(
  'an empty server changes nothing',
  M.mergeSessionsById(local, []).length === 3 &&
    M.mergeSessionsById(local, undefined).length === 3,
  ''
);
check(
  'and an empty device takes everything, which is the restore-on-a-new-phone case',
  M.mergeSessionsById([], server).length === 4,
  ''
);

// Now against the real store, because the fix is only real where it is wired.
console.log('\n[1b] And through mergeServerData itself');
useAppStore.setState({
  completedSessions: local,
  completedCount: local.length,
  resetPendingUpload: false,
  dataOwnerId: 'u1',
});
useAppStore.getState().mergeServerData({ completedSessions: server });
const after = useAppStore.getState().completedSessions.map((s) => s.id);
check(
  'the offline session survives the real merge',
  after.includes('LOCAL-OFFLINE'),
  `got ${after.join(', ')}`
);
check(
  'and the count matches the union, not the server',
  useAppStore.getState().completedCount === 5,
  `completedCount is ${useAppStore.getState().completedCount}, sessions ${after.length}`
);
check(
  'so the next upload carries it',
  useAppStore
    .getState()
    .getDataForSync()
    .completedSessions.some((s) => s.id === 'LOCAL-OFFLINE'),
  'the payload is what reaches the server; a session absent from it is gone for good'
);

// ─── 2. The foreground sync ──────────────────────────────────────────────────
console.log('\n[2] The device that is behind no longer truncates the server');

const auth = stripComments(read('lib/auth-context.tsx'));
const foreground = auth.slice(
  auth.indexOf("AppState.addEventListener('change'"),
  auth.indexOf("AppState.addEventListener('change'") + 900
);
check(
  'the foreground handler downloads before it uploads',
  /const serverData = await downloadUserData\(\);[\s\S]{0,160}mergeServerData\(serverData\)[\s\S]{0,200}uploadUserData/.test(
    foreground
  ),
  'it PUT the whole document with no version marker and never downloaded first'
);
check(
  'and it still uploads afterwards',
  /uploadUserData\(useAppStore\.getState\(\)\.getDataForSync\(\)\)/.test(foreground),
  'downloading alone would leave the server behind for ever'
);

// ─── 3. The update wipe ──────────────────────────────────────────────────────
console.log('\n[3] Updating the app does not delete your training');

const store = stripComments(read('lib/store.ts'));
/**
 * The version, READ rather than matched against a literal.
 *
 * This asserted /version: 29,/ exactly, which made it fail the first time
 * anybody legitimately bumped the version for a new migration. That is the
 * failure mode where somebody deletes the check to get a green gate, and the
 * real protection goes with it.
 *
 * What it is actually guarding is unchanged: dataOwnerId's migration shipped at
 * version 28 and nobody bumped, so migrate() was never called on an upgrading
 * device and the wipe guard never ran. Any number above 28 satisfies that, and
 * a version that goes backwards or stops moving still fails.
 */
const storeVersion = Number((store.match(/^\s*version: (\d+),/m) ?? [])[1]);
check(
  'the store version could be read at all',
  Number.isFinite(storeVersion),
  'the persist config has moved and the rule below proves nothing'
);
check(
  'and it is past the release where migrate() was being skipped',
  storeVersion >= 29,
  `version is ${storeVersion}; dataOwnerId shipped at 28 and stayed there, so migrate() was never called on an upgrading device`
);
check(
  'and the migration marks a pre-tagging device claimable',
  /persistedState\.dataOwnerClaimPending =\s*\n?\s*!persistedState\.dataOwnerId &&/.test(store),
  ''
);
check(
  'an upgrading device with history is NOT wiped',
  M.shouldWipeForNewOwner(
    { dataOwnerId: null, dataOwnerClaimPending: true, signingInAs: 'u1' },
    { ...EMPTY_FOR_CLAIM, completedSessions: [1, 2, 3] }
  ) === false,
  'this is every existing user, and the token expires monthly so they all reach the sign-in screen'
);
check(
  'but it is only claimable once',
  M.shouldWipeForNewOwner(
    { dataOwnerId: 'u1', dataOwnerClaimPending: false, signingInAs: 'u2' },
    { ...EMPTY_FOR_CLAIM, completedSessions: [1, 2, 3] }
  ) === true,
  'after the first sign-in the device is tagged and this is a plain identity check again'
);
check(
  'tagging clears the claim window',
  /setDataOwnerId: \(id\) => set\(\{ dataOwnerId: id, dataOwnerClaimPending: false \}\)/.test(store),
  'otherwise the device stays claimable for ever and the guard never applies'
);

// ─── 4. Whose data is on this phone ──────────────────────────────────────────
console.log('\n[4] The owner check looks at everything the upload ships');

const EMPTY = {
  completedSessions: [],
  oneRepMaxes: [],
  bodyweightLog: [],
  savedTemplates: [],
  earnedBadges: [],
  userProfile: { name: '' },
};
check('a blank device holds nothing', M.deviceHoldsPersonalData(EMPTY) === false, '');
for (const [field, value] of [
  ['completedSessions', [1]],
  ['oneRepMaxes', [1]],
  ['bodyweightLog', [1]],
  ['savedTemplates', [1]],
  ['earnedBadges', ['x']],
]) {
  check(
    `${field} alone counts as somebody's data`,
    M.deviceHoldsPersonalData({ ...EMPTY, [field]: value }) === true,
    'the upload after sign-in ships this field, so the guard has to see it'
  );
}
check(
  'and so does a named profile',
  M.deviceHoldsPersonalData({ ...EMPTY, userProfile: { name: 'Alice' } }) === true,
  'it is what makes the app skip onboarding for the next person'
);
check(
  'a profile with no name does not, so a half-finished onboarding is not treated as a person',
  M.deviceHoldsPersonalData({ ...EMPTY, userProfile: { name: '   ' } }) === false,
  ''
);
const ALICE_PROFILE_ONLY = {
  ...EMPTY,
  userProfile: { name: 'Alice' },
  oneRepMaxes: [{ lift: 'squat', weight: 140, date: daysAgo(2) }],
};
check(
  "a previous owner's profile-only device IS wiped before a new account signs in",
  M.shouldWipeForNewOwner(
    { dataOwnerId: 'alice', dataOwnerClaimPending: false, signingInAs: 'bob' },
    ALICE_PROFILE_ONLY
  ) === true,
  "this is the case that put a stranger's one-rep maxes behind somebody else's prescribed weights"
);
check(
  'signing back in as yourself never wipes anything',
  M.shouldWipeForNewOwner(
    { dataOwnerId: 'alice', dataOwnerClaimPending: false, signingInAs: 'alice' },
    { ...EMPTY, completedSessions: [1], userProfile: { name: 'Alice' } }
  ) === false,
  ''
);
check(
  'and a genuinely blank device is never wiped, whoever signs in',
  M.shouldWipeForNewOwner(
    { dataOwnerId: 'alice', dataOwnerClaimPending: false, signingInAs: 'bob' },
    EMPTY
  ) === false,
  'there is nothing to protect and a wipe would just cost a reload'
);

/**
 * THE CASE THAT CAUGHT A BUG IN THIS VERY FIX.
 *
 * The first version of shouldWipeForNewOwner took one "holds personal data"
 * flag and applied it to both branches. tests/signout-clears-device.check.mjs
 * went red immediately, and it was right: an untagged device with a name and
 * some one-rep maxes on it is USUALLY somebody who finished onboarding ninety
 * seconds ago and is signing in for the first time. Wiping them deletes the
 * answers they just gave.
 *
 * Untagged is genuinely ambiguous and training history is the only thing that
 * separates the two people who land there, because reaching the tabs to log a
 * session requires an account at all.
 */
check(
  'a device that has just been onboarded is NOT wiped on its first sign-in',
  M.shouldWipeForNewOwner(
    { dataOwnerId: null, dataOwnerClaimPending: false, signingInAs: 'alice' },
    ALICE_PROFILE_ONLY
  ) === false,
  'their name, bodyweight and one-rep maxes are ninety seconds old and this is the normal first-run flow'
);
check(
  'but an untagged device with training on it still is',
  M.shouldWipeForNewOwner(
    { dataOwnerId: null, dataOwnerClaimPending: false, signingInAs: 'alice' },
    { ...EMPTY, completedSessions: [1, 2, 3] }
  ) === true,
  'you cannot log a session without an account, so somebody else has used this phone'
);

check(
  'and the guard in auth-context delegates to this rule rather than inlining one',
  /shouldWipeForNewOwner\(/.test(auth) && /signingInAs: data\.user\.id/.test(auth),
  'the old test was an inline local.completedSessions.length > 0, and it was wrong in both directions at once'
);

console.log('');
if (failures > 0) {
  console.error(`sync-safety: ${failures}/${total} check(s) FAILED\n`);
  process.exitCode = 1;
} else {
  console.log(`sync-safety: all ${total} checks passed\n`);
  process.exitCode = 0;
}
