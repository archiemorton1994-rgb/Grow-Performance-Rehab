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
 */
export const EXERCISE_ALIASES: Record<string, string> = {
  'Barbell Back Squat': 'Back Squat',
  'Bench Press': 'Barbell Bench Press',
  'DB Bench Press': 'Dumbbell Bench Press',
  'Conventional Deadlift': 'Barbell Deadlift',
  'DB Goblet Squat': 'Goblet Squat',
  'Inverted Row (Table/Bar)': 'Inverted Row',
  'Power Clean (Light Bar)': 'Power Clean (Light)',

  // ── One movement that had been entered under two names ────────────────────
  // These are not renames of a chosen survivor; they are two spellings, or two
  // regional names, for a single exercise. Nothing was renamed on the left-hand
  // side — the old name is simply read as the current one so a personal best
  // and a progress chart do not start again from zero.
  'Dead Hangs': 'Dead Hang',
  'Stiff Leg Deadlift': 'Stiff-Leg Deadlift',
  'Standing Long Jump': 'Broad Jump',
  'Australian Pull-Up': 'Inverted Row',
  'Straight Bar Pushdowns': 'Cable Tricep Pushdown',
  // One slot used to name both movements at once, while Pull-Up and Chin-Up also
  // existed separately — three catalogue entries for two exercises.
  'Pull-Up / Chin-Up': 'Pull-Up',
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
  'Good Morning': 'Barbell Good Morning',
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
