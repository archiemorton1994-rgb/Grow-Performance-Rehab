/**
 * THE PROGRAM SCREEN, FOR SOMEBODY WHO IS NOT ON THE BARBELL ROTATION.
 *
 * "Your Program" is built around a twelve-session block of squat, bench and
 * deadlift, and it has always had a second path for everyone else. That path
 * was four strings:
 *
 *     0 sessions   -> "Welcome to your program..."
 *     1 session    -> "First session in the books..."
 *     under 6      -> "Early days, and mobility is taking shape."
 *     otherwise    -> "This is your program: mobility. Built from what you
 *                      actually train."
 *
 * TWO OF THOSE FOUR HAVE NEVER RENDERED FOR ANYBODY. isOnStrengthProgramme
 * returns TRUE below its evidence threshold, so nobody with zero or one
 * sessions is ever on this path at all. That leaves two live branches, and the
 * second of them is what a conditioning-and-mobility user reads at session six
 * and still reads at session three hundred.
 *
 * Meanwhile the app holds exactly the same things about them that it holds
 * about a barbell trainee - what they train, how much of it they did this week,
 * their goal, their streak - and the barbell path uses all of it. This is that
 * path's counterpart rather than its apology.
 *
 * Pure, and free of react-native imports, so tests run it.
 */

export interface NonStrengthContext {
  /** Total completed sessions. */
  sessionCount: number;
  /** Their most-trained session types, already formatted, e.g. "Conditioning · Mobility". */
  mix: string;
  /** Sessions completed in the current training week. */
  weekCount: number;
  /** Sessions per week their streak needs. */
  weeklyGoal: number;
  /** Consecutive weeks hitting that goal. */
  streakWeeks: number;
}

/**
 * The line under the Program header.
 *
 * Ordered by what is most worth saying RIGHT NOW rather than by session count:
 * a week that is one session from counting is more useful than a total, and a
 * long streak is worth naming before either.
 *
 * Says nothing about cycles, blocks or strength tests. None of them are
 * happening to this person, and the previous version's whole point was that a
 * screen about a twelve-session barbell block has nothing true to tell them.
 * That still holds; it just has more than one true thing to say instead.
 */
export function nonStrengthContextMessage(c: NonStrengthContext): string {
  const mix = c.mix.toLowerCase();

  // Nearly there this week. The most actionable thing the screen knows.
  const toGo = c.weeklyGoal - c.weekCount;
  if (c.weekCount > 0 && toGo === 1) {
    return `One more session this week and it counts. ${c.mix} is what you have been doing.`;
  }
  if (c.weekCount > 0 && toGo > 1 && toGo <= 2) {
    return `${toGo} more sessions this week to keep the streak. Mostly ${mix}.`;
  }

  // Done for the week.
  if (c.weekCount >= c.weeklyGoal && c.weeklyGoal > 0) {
    return c.streakWeeks > 1
      ? `Week done, and that is ${c.streakWeeks} in a row. Built from ${mix}.`
      : `Week done. Built from ${mix}.`;
  }

  // A streak worth naming, even mid-week.
  if (c.streakWeeks >= 3) {
    return `${c.streakWeeks} weeks running. Your program is ${mix}, and it is working.`;
  }

  if (c.sessionCount < 6) return `Early days, and ${mix} is taking shape.`;
  if (c.sessionCount < 25) {
    return `${c.sessionCount} sessions in. Your program is ${mix}, built from what you actually train.`;
  }
  return `${c.sessionCount} sessions of ${mix}. This is the programme, and you built it.`;
}
