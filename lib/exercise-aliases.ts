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
