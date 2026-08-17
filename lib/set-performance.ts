import type { ExercisePerformance, SetLog } from './store';

/**
 * How one exercise in a finished session should be judged for load purposes.
 *
 * This lived inline in `completeSession` and could only be exercised by running
 * the whole store, which is why the partial-skip case below went unnoticed. It
 * is a pure function of the sets and the rating, so it is a pure function here.
 *
 * `null` means "do not judge this exercise at all" - the user never performed
 * it, so it must not advance a streak, a load, or a stall counter.
 */
export function performanceForLog(
  sets: readonly SetLog[],
  feedbackRating?: 'very_easy' | 'easy' | 'normal' | 'hard' | string
): ExercisePerformance | null {
  // Nothing logged at all: the exercise was skipped outright.
  if (sets.length > 0 && sets.every((s) => s.skipped)) return null;

  // Some sets logged, then Skip tapped. That is an abandoned exercise, not a
  // completed one, and the in-session safety banner tells the user to reach for
  // Skip the moment something hurts - so the last thing the app should do off
  // the back of it is add weight next time.
  //
  // 'failed' holds the load. It does not take any off; a deload needs three
  // stalled sessions, not one bad set.
  const partlySkipped = sets.some((s) => s.skipped);
  if (partlySkipped) return 'failed';

  // A set left incomplete (started, not finished) is a genuine failure.
  const hadFailure = sets.some((s) => !s.completed && !s.skipped);
  if (hadFailure) return 'failed';

  // Only an exercise carried out in full gets to be moved by its rating.
  if (feedbackRating === 'very_easy') return 'very_easy';
  if (feedbackRating === 'easy') return 'easy';
  if (feedbackRating === 'hard') return 'failed';
  return 'normal';
}
