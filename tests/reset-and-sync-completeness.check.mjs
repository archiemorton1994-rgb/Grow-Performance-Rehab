/**
 * Contract test: a reset resets, and a sign-out does not destroy data.
 *
 * TWO FAULTS, ONE CAUSE — a field was added to the store and nobody added it to
 * the two places that have to know about every field.
 *
 * "RESET PROGRESS" CLEARED THE SCREENS, NOT THE NUMBERS
 * ────────────────────────────────────────────────────
 * It cleared the three fields the history screens read:
 *
 *     set({ completedCount: 0, completedSessions: [], oneRepMaxes: [] })
 *
 * History and stats went empty, so it looked like it had worked. Then the next
 * session opened at exactly the weights the deleted history had built up, with
 * the easier/harder adjustments still applied. Worse, testWeekDeferred survived:
 * if a strength test had been postponed before the reset, the first session
 * after wiping everything was a max-effort one-rep-max attempt, on an account
 * the app now believed had never trained. For a physiotherapist's app that is a
 * safety problem, not a tidiness one.
 *
 * SIGNING OUT DELETED THE BODYWEIGHT LOG FOR GOOD
 * ───────────────────────────────────────────────
 * Sessions, one-rep maxes and templates are all in the sync payload and come
 * back on sign-in. Weigh-ins were not in it. Sign-out deliberately wipes the
 * device — two people sharing a handset must not share an account — so anything
 * missing from that payload is not merely un-synced, it is destroyed. A year of
 * weigh-ins, the chart and the history list built from them, gone to a routine
 * sign-out or a new phone, with no warning.
 */
import { readFileSync } from 'fs';

let passed = 0;
let failed = 0;
function check(label, condition, detail) {
  if (condition) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.log(`  ✗ ${label}`);
    if (detail) console.log(`      ${detail}`);
    failed++;
  }
}

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const store = read('lib/store.ts');
const sync = read('lib/sync.ts');
const profile = read('app/(tabs)/profile.tsx');

// The IMPLEMENTATION, not the interface declaration twenty lines into the file —
// a slice anchored on the declaration swallows the whole store, including the
// initial-state block, and then every "is it cleared" assertion passes for the
// wrong reason.
const resetImplAt = store.search(/resetProgress: \(\) =>\s*\r?\n\s*set\(\{/);
const resetBody = store.slice(
  resetImplAt,
  store.indexOf('setExerciseFeedback: (exerciseId, thumbs)', resetImplAt)
);

console.log('\n[1] The reset clears every number that decides a future weight');

for (const field of [
  'lastLoggedWeights',
  'lastSessionPerformance',
  'exerciseNormalStreak',
  'exerciseStuckStreak',
  'exerciseFeedback',
]) {
  check(
    `${field} is cleared`,
    new RegExp(`${field}: \\{\\}`).test(resetBody),
    'left behind, the next session opens at the weights the deleted history built'
  );
}

check(
  'a postponed strength test does not survive the reset',
  /testWeekDeferred: false/.test(resetBody),
  'otherwise the first session after wiping everything is a max-effort 1RM attempt'
);

check(
  'the badge wall is cleared',
  /earnedBadges: \[\]/.test(resetBody),
  'badges for training that no longer exists'
);

check(
  'the pop-up queue is cleared with it',
  /newlyUnlockedBadges: \[\]/.test(resetBody),
  'a queued celebration for a badge that no longer exists'
);

check(
  'the history the screens read is still cleared',
  /completedCount: 0/.test(resetBody) && /completedSessions: \[\]/.test(resetBody),
  'the original behaviour must survive'
);

check(
  'the bodyweight log is deliberately NOT cleared',
  !/bodyweightLog: \[\]/.test(resetBody),
  'this resets training progression; a weigh-in is a body measurement, not a lift'
);

// A half-finished session survived the first version of this fix. Home kept
// offering "Squat Session - 12/24 sets" with a Resume button, for a session
// belonging to the history that had just been deleted - and finishing it wrote
// the pre-reset working weights straight back, undoing the reset one exercise
// at a time.
check(
  'the in-progress session is cleared too',
  /activeSession: null/.test(resetBody),
  'otherwise Home offers to resume a session from the history that was just deleted'
);

console.log('\n[1b] A reset survives a failed upload');

check(
  'the reset marks itself as not yet uploaded',
  /resetPendingUpload: true/.test(resetBody),
  'the server is ahead on sessions by definition right after a reset, so the restore would undo it'
);

check(
  'the merge refuses to restore while that is pending',
  /if \(s\.resetPendingUpload\) return;/.test(store),
  'this is what makes "this cannot be undone" true when the upload failed'
);

check(
  'the upload reports whether it actually landed',
  /export async function uploadUserData\(payload: SyncPayload\): Promise<boolean>/.test(sync),
  'it used to swallow every failure and return void, so no caller could tell'
);

check(
  'the flag is cleared only by a successful upload',
  /if \(ok\) useAppStore\.getState\(\)\.clearResetPendingUpload\(\)/.test(profile),
  'clearing it unconditionally would put the hole straight back'
);

console.log('\n[2] The confirmation says what actually happens');

check(
  'it names the learned weights',
  /weights the app has learned/.test(profile),
  'the old copy promised history and stats only, which is why the reset looked broken'
);

check(
  'it names the badges',
  /badges/.test(profile.slice(profile.indexOf("'Reset Progress'"), profile.indexOf("'Reset Progress'") + 500)),
  'clearing something the copy does not mention is a surprise'
);

check(
  'it says the bodyweight log is kept',
  /bodyweight log is kept/i.test(profile),
  'the one thing it does NOT clear has to be stated, or its survival looks like a bug'
);

check(
  'the cleared state is pushed to the server immediately',
  /resetProgress\(\);[\s\S]{0,900}?uploadUserData\(useAppStore\.getState\(\)\.getDataForSync\(\)\)/.test(
    profile
  ),
  'startup restores the server copy whenever it is ahead on sessions - which right after a reset it always is, so without this the reset is undone by the next launch'
);

console.log('\n[3] Nothing a user owns is missing from the sync payload');

for (const field of ['bodyweightLog', 'bodyweightUpdatedAt', 'weeklyStreakGoal', 'earnedBadges']) {
  check(
    `${field} is declared in SyncPayload`,
    new RegExp(`${field}\\??:`).test(sync),
    'sign-out wipes the device, so anything absent here is destroyed rather than un-synced'
  );
  check(
    `${field} is uploaded`,
    new RegExp(`${field}: s\\.${field}`).test(store),
    'declared but never sent is the same as not declared'
  );
}

console.log('\n[4] Restoring it back is safe in both directions');

// Was "the server has more entries than the device". Now stronger: the two logs
// are MERGED by date, so neither side can lose an entry the other does not have
// — a straight swap discarded any weigh-in made on this device and not yet
// uploaded, which is the same class of loss the sync was added to prevent.
check(
  'the weigh-in log is merged, not gated on the session count',
  /const byDate = new Map<string, BodyweightLogEntry>\(\);/.test(store) &&
    /for \(const entry of s\.bodyweightLog\) byDate\.set\(entry\.date, entry\);/.test(store),
  'a user with weigh-ins and no completed sessions must still get them back, and must not lose local ones'
);

check(
  'the device wins a same-day tie',
  /for \(const entry of serverLog\) byDate\.set[\s\S]{0,120}?for \(const entry of s\.bodyweightLog\) byDate\.set/.test(
    store
  ),
  'local is applied second, so it overwrites - it is the entry the user is looking at'
);

check(
  'the most recent weigh-in wins for the profile figure',
  /const keepLocalBodyweight =\s*\r?\n?\s*localWeighedAt > serverWeighedAt/.test(store),
  'onboarding runs BEFORE sign-in, so a returning user types their weight and then has it overwritten'
);

check(
  'an absent field leaves the device alone',
  /weeklyStreakGoal: data\.weeklyStreakGoal \?\? s\.weeklyStreakGoal/.test(store) &&
    /earnedBadges: data\.earnedBadges \?\? s\.earnedBadges/.test(store),
  'a payload from an older build must not blank these'
);

check(
  'the session gate is unchanged for training data',
  /if \(serverCount > localCount\)/.test(store),
  'sessions logged offline and not yet uploaded must still never be overwritten'
);

console.log(`\nreset-and-sync-completeness: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
