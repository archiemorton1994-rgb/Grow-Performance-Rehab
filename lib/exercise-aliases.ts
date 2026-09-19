/**
 * Names the app used to use, and what they are called now.
 *
 * WHY THIS FILE HAS TO EXIST
 * ──────────────────────────
 * Completed sessions store `exerciseName` as a string. Personal bests, the
 * exercise-progress charts, last-logged weights and the recalled note all key
 * off it. So renaming an exercise in the database does not just change a label
 * — it silently splits every user's history in two. Their bench press stops
 * having a personal best, their progress chart starts again from zero, and the
 * old data is still there, under a name nothing looks for any more.
 *
 * That is the whole cost of the rename, and it is entirely avoidable: read
 * every historical name through here and the old entries keep counting.
 *
 * WHAT WAS RENAMED, AND WHY
 * ─────────────────────────
 * The same movement had been entered twice — once in the KPI-lift collection
 * and once in the weekly-session collection — under slightly different names.
 * Both entries were real (a KPI bench is 5×5-6, a weekly bench is 4×8-10; the
 * programming genuinely differs), but there is only one Bench Press, and the
 * exercise picker was showing it twice.
 *
 * The survivor in each pair is whichever name the engine already uses as the
 * KPI main lift, because that is the name progression and personal bests were
 * already keyed on. Choosing the other way round would have moved the problem
 * rather than fixed it.
 *
 * Genuine equipment variants were left alone. "Bench Press" and "DB Bench
 * Press" are two exercises; "Bench Press" and "Barbell Bench Press" were one
 * exercise with two names.
 *
 * AND THEN THE LIBRARY ARRIVED
 * ────────────────────────────
 * Archie's exercise library spells a lot of these differently: the catalogue's
 * "Back Squat" is his "Barbell Back Squat", its "Dead Bug" is his "Deadbug",
 * its "DB Overhead Carry" is his "Waiter Carry". Eighty-nine library records
 * keep the catalogue id they matched, so the weights carry over on their own
 * (see lib/exercise-id-merge.ts) - but seventy-four of them are shown under a
 * new name, and a name is what the personal best, the progress chart and the
 * recalled note are keyed on. Every one of those renames is written down below
 * so none of that restarts at zero.
 *
 * Two consequences worth knowing before reading the table:
 *
 *   - Five of the original entries now point at a name that was itself renamed.
 *     They were re-pointed at the library's name rather than stacked, because
 *     an alias that points at another alias resolves to the wrong name in one
 *     pass. "Barbell Back Squat" was dropped outright: it used to be the retired
 *     side of that pair, and the library has made it the survivor again.
 *   - The rename lands before the library does. Until the new sessions are
 *     wired up, Exercise Progress will show a squat history under "Barbell Back
 *     Squat" while the session screen still says "Back Squat". That is the
 *     right way round - the chart is whole, and the label is where the app is
 *     going - but it is visible, so it is written here rather than discovered.
 *
 * NEVER ACROSS IMPLEMENTS. A dumbbell Romanian deadlift does not inherit a
 * barbell one's history. The only crossing in the table is dumbbell to
 * kettlebell on the twelve exercises decision 5 names, and
 * tests/exercise-aliases.check.mjs holds it to exactly those.
 */
export const EXERCISE_ALIASES: Record<string, string> = {
  'Bench Press': 'Barbell Bench Press',
  'DB Bench Press': 'Dumbbell Bench Press',
  'Conventional Deadlift': 'Barbell Deadlift',
  'DB Goblet Squat': 'Kettlebell Goblet Squats',
  'Inverted Row (Table/Bar)': 'Inverted Row',
  'Power Clean (Light Bar)': 'Power Clean (Light)',

  // ── One movement that had been entered under two names ────────────────────
  // These are not renames of a chosen survivor; they are two spellings, or two
  // regional names, for a single exercise. Nothing was renamed on the left-hand
  // side — the old name is simply read as the current one so a personal best
  // and a progress chart do not start again from zero.
  'Dead Hangs': 'Dead Hang',
  'Stiff Leg Deadlift': 'Stiff-Leg Deadlift',
  'Standing Long Jump': 'Broad Jumps',
  'Australian Pull-Up': 'Inverted Row',
  'Straight Bar Pushdowns': 'Cable Tricep Pushdown',
  // One slot used to name both movements at once, while Pull-Up and Chin-Up also
  // existed separately — three catalogue entries for two exercises.
  'Pull-Up / Chin-Up': 'Pull Ups',
  'Calf Stretch (wall)': 'Calf Stretch (Wall)',
  'Supine Hamstring Stretch (strap)': 'Supine Hamstring Stretch (Strap)',

  // "90/90" names a seated hip position. All three of these were a supine
  // figure-4, which the flexibility list already called by its right name.
  '90/90 Hip Stretch': 'Figure-4 Glute Stretch',
  'Supine Hip 90/90 Stretch': 'Figure-4 Glute Stretch',

  // The one genuinely ambiguous case. A barbell Good Morning and a bodyweight
  // one are different exercises that shared a name, and the exercise picker
  // de-dupes by name — so a bodyweight user was being shown the 30-60 kg
  // version. Both are now qualified. Old history maps to the barbell one
  // because that is the only one the picker ever exposed.
  'Good Morning': 'Barbell Good Mornings',

  // ── The library's spellings ───────────────────────────────────────────────
  // One line per record that kept a catalogue id and is shown under a different
  // name. Grouped by the pattern the library files them under, so a record and
  // its rename can be found together. Nothing here changes which exercise
  // anybody is given; it changes only which name their history is counted
  // under, and the answer is always the one name the library uses.

  // Push
  'Alternating Dumbbell Overhead Press': 'Alternating Dumbbell Shoulder Press',
  'DB Floor Press': 'Dumbbell Floor Press',
  'Deficit Push-Up': 'Deficit Press Ups',
  'Incline DB Press': 'Incline Dumbbell Bench Press',
  'Incline Push-Up': 'Bench Press Ups',
  'Med Ball Floor Chest Pass': 'Medball Floor Chest Pass',
  'Push-Up': 'Push Up',
  'Seated DB Shoulder Press': 'Seated Dumbbell Press',
  'Single-Arm Dumbbell Overhead Press': 'Single Arm Dumbbell Press',
  'Standing Overhead Press': 'Standing Dumbbell Press',
  // The weekly pools' own name for that same dumbbell press.
  'DB Shoulder Press': 'Standing Dumbbell Press',
  'Supine Med Ball Throw': 'Supine Medball Throws',
  'Tricep Dips (Bench)': 'Bench Dips',

  // Pull
  'Band Face Pull': 'Banded Face Pulls',
  'Band Pull-Apart': 'Band Pull Aparts',
  'Cable Face Pull': 'Cable Face Pulls',
  'Chest Supported Row': 'Chest Supported Dumbbell Row',
  'Chin-Up': 'Chin Ups',
  'DB Bent-Over Row': 'Bent Over Dumbbell Rows',
  'DB Single-Arm Row': 'Single Arm Dumbbell Rows',
  'Gorilla Row': 'Gorilla Rows',
  'Landmine Single-Arm Row': 'Landmine Single Arm Rows',
  'Lat Pulldown': 'Lat Pulldowns',
  'Med Ball Overhead Slam': 'Medball Slams',
  'Pull-Up': 'Pull Ups',
  'Seated Cable Row': 'Seated Close Grip Rows',
  'Seated Single-Arm Cable Row': 'Seated Single Arm Rows',
  'Seated Wide-Grip Cable Row': 'Seated Wide Grip Rows',
  'Trap Bar Row': 'Trapbar Rows',

  // Hinge
  'Banded Good Morning': 'Banded Good Mornings',
  'Barbell Good Morning': 'Barbell Good Mornings',
  'Broad Jump': 'Broad Jumps',
  'Cable Pull-Through': 'Cable Pull Through',
  // The library carries two single-leg RDLs on purpose, a dumbbell one at
  // Intermediate and a barbell one at Advanced, so both are qualified and the
  // old dumbbell history goes to the dumbbell one.
  'DB Single-Leg RDL': 'Single Leg Romanian Deadlift (Dumbbell)',
  'DB Split-Stance Romanian Deadlift': 'Split Stance Romanian Deadlift',
  'Hip Hinge Drill (Wall)': 'Wall Hip Hinge',
  'KB Romanian Deadlift': 'Kettlebell Romanian Deadlift',
  'KB Swing (Explosive)': 'Kettlebell Swings',
  'Landmine Split-Stance Romanian Deadlift': 'Landmine Split Stance Romanian Deadlift',
  'Trap Bar Romanian Deadlift': 'Trapbar Romanian Deadlift',

  // Squat
  'Back Squat': 'Barbell Back Squat',
  'Bodyweight Squat': 'Bodyweight Squats',
  'Box Jump (Step-Down)': 'Box Jumps',
  'Box Squat': 'Barbell Box Squats',
  'DB Front Squat': 'Dumbbell Front Squats',
  'DB Squat Jump': 'Dumbbell Jump Squats',
  'Depth Jump': 'Depth Jumps',
  'Front Squat': 'Barbell Front Squat',
  // Decision 5: a dumbbell does the kettlebell's job on the goblet squat, so
  // the catalogue's dumbbell-cued Goblet Squat is the library's kettlebell one.
  'Goblet Squat': 'Kettlebell Goblet Squats',
  'Landmine Goblet Squat': 'Landmine Goblet Squats',
  'Seated Box Jump': 'Seated Box Jumps',
  'Trap Bar Jump': 'Trapbar Jump Squats',

  // Lunge
  'Alternating Reverse Lunge': 'Alternating Reverse Lunges',
  'Barbell Bulgarian Split Squat': 'Barbell Bulgarian Split Squats',
  'Box Step-Up': 'Box Step Ups',
  'DB Bulgarian Split Squat': 'Dumbbell Bulgarian Split Squat',
  'DB Reverse Lunge': 'Dumbbell Alternating Reverse Lunges',
  'DB Split Squat Jump': 'Dumbbell Split Squat Jumps',
  'Dumbbell Walking Lunge': 'Dumbbell Walking Lunges',
  'KB Side Lunge': 'Kettlebell Side Lunge',
  'Landmine Split Squat': 'Landmine Split Squats',
  'Lateral Lunge': 'Side Lunge',
  'Skater Jump': 'Skater Jumps',
  'Split Squat Jump': 'Split Squat Jumps',

  // Core
  'Ab Wheel Rollout': 'Ab Wheel Rollout (Kneeling)',
  'Cable Woodchop': 'Cable Woodchops',
  'DB Farmer Carry': 'Dumbbell Farmers Carry',
  'DB Overhead Carry': 'Waiter Carry',
  'Dead Bug': 'Deadbug',
  'Farmers Carry': 'Trapbar Farmers Carry',
  'Pallof Press': 'Cable Pallof Press',
  'Plank Shoulder Tap': 'Plank Taps',
  'Side Plank': 'Forearm Side Plank',
  'Suitcase Carry': 'Dumbbell Suitcase Carry',
};

/**
 * The current name for an exercise, whatever it was called when it was logged.
 *
 * Safe to call on anything: names with no alias come back unchanged, so this
 * can be applied indiscriminately wherever history is read.
 */
export function canonicalExerciseName(name: string): string {
  return EXERCISE_ALIASES[name] ?? name;
}

/** True when two recorded names refer to the same movement. */
export function isSameExercise(a: string, b: string): boolean {
  return canonicalExerciseName(a) === canonicalExerciseName(b);
}
