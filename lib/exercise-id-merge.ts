/**
 * The same movement, filed under several ids, becoming one.
 *
 * WHY THIS FILE HAS TO EXIST
 * ──────────────────────────
 * lib/exercise-aliases.ts is the NAME half of this problem: personal bests and
 * the progress chart key off `exerciseName`, so renaming an exercise splits
 * somebody's history in two. This is the ID half, and it is the half that
 * decides what weight the next session puts on the bar.
 *
 * Seven store maps are keyed by exercise id, not by name:
 *
 *   lastLoggedWeights       the anchor every suggested load is worked out from
 *   exerciseRepTarget       where double progression has got to in the rep range
 *   exerciseRepNote         the plain-English reason the reps last moved
 *   lastSessionPerformance  how the last attempt went
 *   exerciseNormalStreak    clean sessions in a row, which earns the bigger jump
 *   exerciseStuckStreak     failures in a row, which triggers the deload
 *   exerciseFeedback        the thumbs, and the multiplier it applies
 *
 * The old catalogue holds the same movement several times over, once per pool
 * it appears in. A Back Squat done on leg day was logged against `wlb-fg-squat`
 * and the same Back Squat done on squat day against `sq-main-fg`. The library
 * has ONE Barbell Back Squat, and it keeps `sq-main-fg`. Left alone, everybody
 * who trained Lower Body rather than the old squat rotation would open their
 * first library session and be offered the beginner's estimate, because the
 * thirty sessions they actually did are filed under an id nothing asks for any
 * more.
 *
 * So each duplicate id is mapped to the surviving record's id, and the progress
 * is COPIED FORWARD, never moved:
 *
 *   - Only where the survivor has nothing. A person who trained both is not
 *     overwritten by whichever copy happened to come second.
 *   - The old keys are left exactly as they are. Nothing in the app is made
 *     worse by an entry it no longer reads, and the old engine is still live.
 *   - First declared wins. Where two duplicates could both fill an empty
 *     survivor the earlier line in the table is taken, so the result does not
 *     depend on the order Object.keys happens to return.
 *
 * WHAT IS IN THE TABLE, AND WHAT IS DELIBERATELY NOT
 * ──────────────────────────────────────────────────
 * IN: two catalogue templates that are the same movement with the same
 * implement, where one of them is the id a library record took. Proved rather
 * than asserted: tests/exercise-id-merge.check.mjs requires both templates to
 * resolve, through EXERCISE_ALIASES, to the same library record name. A pair
 * that does not is not a duplicate, it is two exercises.
 *
 * That rule keeps a WRONG pair out. It cannot, on its own, pull a right one IN,
 * because it reads EXERCISE_ALIASES and this work writes EXERCISE_ALIASES: a
 * duplicate spelled differently enough that nobody ever aliased it is invisible
 * to it. "Barbell Bent-Over Row" and "Barbell Row" are the same barbell row and
 * no amount of normalising gets from one string to the other. So the named
 * duplicate sets in rebuild/reference/pivot-scope.md section 1.4 are pinned BY
 * ID in the check, each one marked either merged or excluded-with-a-reason, and
 * a named duplicate can no longer be dropped by being forgotten.
 *
 * NOT: a dumbbell exercise merged into a barbell one, or the other way round.
 * A Dumbbell Romanian Deadlift is 20 kg in each hand and a barbell one is 70 kg
 * on the bar; handing one the other's anchor is not a convenience, it is an
 * injury. The check above is what enforces it.
 *
 * NOT: a prescription variant. The catalogue carries "Band Pull-Apart (Fast
 * Tempo)", "Band Pull-Apart (Warm-Up)", "KB Swing (Steady)", "Dead Bug (Steady
 * Tempo)" and "Farmers Carry (Heavy)" beside their plain versions. Those are
 * the same movement given a different job, and a warm-up's rep target is not a
 * working set's. They keep their own progress.
 *
 * NOT: Restore. Nothing under `ph-`, `fl-` or `acute-`, and nothing filed as
 * prehab or a cooldown, is in here. Restore still serves those drills under
 * their own names and their own doses, and a rehab set is not training.
 *
 * THE COMFORT SUFFIX
 * ──────────────────
 * When somebody trains with an ache the engine hands them a modified version
 * under `<id>-comfort` (see workout-engine.ts), and that id is what gets logged.
 * So every merge is applied twice: to the bare id, and to the comfort variant.
 * Without it, a person whose knee was sore for a month would carry nothing over.
 */

/**
 * Duplicate id on the left, the id the library record kept on the right.
 *
 * Grouped by survivor, with the catalogue name they all shared. Read it as
 * "anything logged against this id is the same exercise as that one".
 */
export const ID_MERGE: Readonly<Record<string, string>> = {
  // Push Up, filed as "Push-Up" in the conditioning and weekly pools
  'cond-bw-e-1b': 'bn-main-bw',
  'wub-bw-pushup': 'bn-main-bw',
  'wfb-bw-pushup': 'bn-main-bw',
  // Dumbbell Bench Press
  'wub-db-bench': 'bn-main-db',
  'wfb-db-bench': 'bn-main-db',
  // Standing Dumbbell Press. The one pair whose two names differ: the KPI pool
  // calls it "Standing Overhead Press" and the weekly pools "DB Shoulder
  // Press". Both are the same dumbbell press, which is why the scope document
  // lists all three ids under one library row.
  'wub-db-shoulder-press': 'bn-acc-db-13',
  'wfb-db-ohp': 'bn-acc-db-13',
  // Band Pull Aparts. The fourth is the accessory pool's own spelling, "Banded
  // Pull-Apart": same light band, same movement, one letter of difference.
  'bn-mech-db-1': 'bn-mech-bw-1',
  'bn-mech-fg-1': 'bn-mech-bw-1',
  'dl-acc-bw-6': 'bn-mech-bw-1',
  // Cable Face Pulls. The bench pool calls it plain "Face Pull" and tags it
  // resistance bands, but it prescribes a "Light cable", it is in the fullgym
  // pool only, and its cue names no band or anchor while the band face pull
  // (bn-acc-bw-8) says "anchor band at face height". pivot-scope 1.4 lists that
  // tag under "tagged with the wrong equipment" and the pair under one library
  // record. Both sides are a cable face pull, so this is not an implement swap.
  'bn-mech-fg-2': 'dl-acc-fg-9',
  // Lat Pulldowns
  'dl-acc-fg-7': 'bn-acc-fg-4',
  'wub-fg-pulldown': 'bn-acc-fg-4',
  'wfb-fg-pulldown': 'bn-acc-fg-4',
  // Bent Over Dumbbell Rows. The fourth is "Standing Dumbbell Row", the same
  // hinged two-handed dumbbell row at the same load, written out in full.
  'cond-db-e-4a': 'dl-acc-db-2',
  'wub-db-row': 'dl-acc-db-2',
  'wfb-db-row': 'dl-acc-db-2',
  'ch-standing-dumbbell-row': 'dl-acc-db-2',
  // Barbell Row. "Barbell Bent-Over Row" is the bench pool's name for it: same
  // bar, same pull to the sternum, filed as an accessory instead of a main
  // lift. The generator serves it on bench days, so a bench-day user's row
  // history is exactly as orphaned as a leg-day user's squat history.
  'wfb-fg-row': 'wub-fg-row',
  'bn-acc-fg-1': 'wub-fg-row',
  // Pull Ups
  'dl-acc-bw-5': 'bn-acc-bw-5',
  // Wall Hip Hinge
  'dl-mech-db-4': 'dl-mech-bw-4',
  // Glute Bridge. Two of these are tagged with equipment they do not use, which
  // is why they read as dumbbell and barbell entries; all four are the same
  // bodyweight bridge and all four are prescribed at bodyweight.
  'dl-mech-bw-1': 'sq-acc-bw-2',
  'dl-mech-db-1': 'sq-acc-bw-2',
  'dl-mech-fg-1': 'sq-acc-bw-2',
  'wlb-bw-glute-bridge': 'sq-acc-bw-2',
  // Banded Good Mornings
  'dl-mech-fg-2': 'dl-acc-bw-4',
  // Cable Pull Through
  'dl-mech-fg-3': 'dl-acc-fg-4',
  'sq-acc-fg-9': 'dl-acc-fg-4',
  // Single Leg Romanian Deadlift (Dumbbell). The barbell one at Advanced is a
  // separate record with a separate id and is deliberately not in here.
  'sq-acc-db-9': 'dl-acc-db-5',
  'wlb-db-single-rdl': 'dl-acc-db-5',
  // Barbell Deadlift
  'wfb-fg-deadlift': 'dl-main-fg',
  // Kettlebell Swings
  'dl-neuro-fg': 'dl-neuro-db',
  // Broad Jumps, which the old catalogue carries seven times over
  'sq-neuro-bw-2': 'dl-neuro-bw',
  'sq-neuro-db-3': 'dl-neuro-bw',
  'sq-neuro-fg-3': 'dl-neuro-bw',
  'dl-neuro-db-3': 'dl-neuro-bw',
  'dl-neuro-fg-4': 'dl-neuro-bw',
  'dl-pwr-neuro-bw': 'dl-neuro-bw',
  // Bodyweight Squats
  'cond-bw-e-1a': 'sq-main-bw',
  'wlb-bw-squat': 'sq-main-bw',
  'wfb-bw-squat': 'sq-main-bw',
  // Wall Sit
  'cond-bw-e-3b': 'sq-acc-bw-4',
  // Kettlebell Goblet Squats. Decision 5 makes a dumbbell the same implement on
  // this exercise, so the dumbbell goblet squats are the same movement.
  'sq-acc-db-5': 'sq-main-db',
  'cond-db-e-1b': 'sq-main-db',
  'wlb-db-goblet': 'sq-main-db',
  'wfb-db-goblet': 'sq-main-db',
  // Barbell Back Squat
  'wlb-fg-squat': 'sq-main-fg',
  'wfb-fg-squat': 'sq-main-fg',
  // Squat Jump
  'sq-neuro-db-2': 'sq-neuro-bw',
  'gcond-bw-n-2': 'sq-neuro-bw',
  // Box Jumps
  'sq-neuro-fg': 'sq-neuro-db',
  // Side Lunge
  'wlb-bw-lateral-lunge': 'sq-acc-bw-10',
  // Dumbbell Bulgarian Split Squat
  'wlb-db-split': 'sq-acc-db-1',
  // Deadbug
  'dl-mech-bw-3': 'sq-acc-bw-17',
  // Bird Dog
  'dl-mech-bw-2': 'dl-acc-bw-12',
  // Dumbbell Suitcase Carry
  'cond-db-e-6a': 'sq-acc-db-14',
  // Ab Wheel Rollout (Kneeling)
  'dl-acc-bw-17': 'sq-acc-fg-13',
};

/** The suffix the engine puts on an exercise served to somebody with an ache. */
const COMFORT_SUFFIX = '-comfort';

/**
 * Every id pair a merge has to apply, the bare ones and the comfort variants.
 *
 * Built once rather than per map, and returned as entries so the order is the
 * order ID_MERGE is written in. That order is what makes "first declared wins"
 * mean something.
 */
const MERGE_PAIRS: readonly (readonly [string, string])[] = Object.entries(ID_MERGE).flatMap(
  ([from, to]) => [
    [from, to] as const,
    [`${from}${COMFORT_SUFFIX}`, `${to}${COMFORT_SUFFIX}`] as const,
  ]
);

/**
 * Copy a per-exercise map forward onto the ids the library kept.
 *
 * Returns a NEW object when anything was carried and the same one when nothing
 * was, so a caller can tell whether it needs to write. Safe on anything: a
 * missing map, a null, or a map with none of these ids in it all come back
 * untouched.
 */
export function carryProgressForward<T>(
  map: Record<string, T> | undefined | null
): Record<string, T> | undefined | null {
  if (!map || typeof map !== 'object') return map;
  let next: Record<string, T> | null = null;
  for (const [from, to] of MERGE_PAIRS) {
    const carried = next ?? map;
    // Only where the survivor is empty. `in` rather than a truthiness test: a
    // stuck streak of 0 and a rep note of "" are answers, not absences, and
    // replacing them with a duplicate's copy would be an overwrite.
    if (!(from in map) || to in carried) continue;
    if (next === null) next = { ...map };
    next[to] = map[from];
  }
  return next ?? map;
}

/** The store fields this applies to. Every map in the store keyed by exercise id. */
export const MERGED_PROGRESS_FIELDS = [
  'lastLoggedWeights',
  'lastSessionPerformance',
  'exerciseNormalStreak',
  'exerciseStuckStreak',
  'exerciseRepTarget',
  'exerciseRepNote',
  'exerciseFeedback',
] as const;

export type MergedProgressField = (typeof MERGED_PROGRESS_FIELDS)[number];

/**
 * Run the carry-forward over every per-exercise map on an object in place.
 *
 * Used by the persist migration, which is handed a mutable blob, and by
 * mergeServerData, which is handed a payload it owns. Anything the object does
 * not carry is skipped rather than created: an absent field in a sync payload
 * means "leave the device alone", and inventing an empty map here would turn
 * that into "wipe it".
 */
export function carryProgressForwardInPlace(target: Record<string, unknown>): void {
  if (!target || typeof target !== 'object') return;
  for (const field of MERGED_PROGRESS_FIELDS) {
    const map = target[field];
    if (!map || typeof map !== 'object' || Array.isArray(map)) continue;
    target[field] = carryProgressForward(map as Record<string, unknown>);
  }
}
