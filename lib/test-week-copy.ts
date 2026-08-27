/**
 * WHAT THE APP IS ALLOWED TO SAY ABOUT STRENGTH TESTS.
 *
 * testWeekFrequency has three values: 12, 18, or the string 'never'. 'never'
 * means the user declined, and getTestWeekProgress short-circuits to an inert
 * object for them, so nothing is ever generated and isTestWeekDue is
 * permanently false. That part works.
 *
 * The copy did not follow. Four screens still told a user who had switched
 * strength tests off that one was coming:
 *
 *   - the Program screen's context line counted down "N sessions until your
 *     next strength test", because it gates on isOnStrengthProgramme rather
 *     than on the frequency, and the frequency is aliased to 12 for the
 *     arithmetic when it is 'never'
 *   - the same screen's stat tile showed a live "until test" number
 *   - Stats told them to "record one in a test week"
 *   - the assistant told them to test a lift
 *
 * Someone who opted out and still trains the barbell lifts was being counted
 * down to an event that will never arrive, and if they went looking for it they
 * would find nothing, because the app has correctly disabled it. That is the
 * app contradicting itself, and it is worse than saying nothing.
 *
 * Everything here is pure, so tests run it rather than pattern-matching four
 * screens for phrases.
 */
import type { TestWeekFrequency } from '@/lib/store';

/** The one correct gate. Not isOnStrengthProgramme, which is about what they
 *  train; this is about what they agreed to. */
export function testsAreOn(freq: TestWeekFrequency): boolean {
  return freq !== 'never';
}

/**
 * The Program screen's stat tile: a countdown, or something true instead.
 *
 * Returns null when there is nothing honest to count down to, and the caller
 * shows its own fallback.
 */
export function sessionsUntilTest(
  freq: TestWeekFrequency,
  strengthSessionCount: number
): number | null {
  if (!testsAreOn(freq)) return null;
  const n = freq as number;
  if (strengthSessionCount === 0) return n;
  const done = strengthSessionCount % n;
  // 0 means DUE NOW, and this is the case the old arithmetic got wrong. It read
  // `n - (count % n)`, which at a multiple of n gives n rather than 0 - so the
  // screen said "12 until test" to somebody whose test was due that session.
  return done === 0 ? 0 : n - done;
}

/**
 * The line under the Program header.
 *
 * Every branch that mentions a test is now behind testsAreOn. The rest of the
 * messages are about the rotation itself and are true either way.
 */
export function programContextMessage(
  freq: TestWeekFrequency,
  completedCount: number,
  testWeekDue: boolean
): string {
  if (completedCount === 0) return "Welcome to your program. Let's build something lasting.";
  if (testWeekDue && testsAreOn(freq)) {
    return "Test week is here - show yourself how far you've come.";
  }
  const remaining = sessionsUntilTest(freq, completedCount);
  if (remaining !== null && remaining >= 1 && remaining <= 2) {
    return `${remaining} ${remaining === 1 ? 'session' : 'sessions'} until your next strength test - finish strong.`;
  }
  if (completedCount === 1) return 'First session in the books. The habit has begun.';
  const cycleSession = completedCount % 9;
  if (cycleSession === 0) return 'New cycle started. Each one builds on the last.';
  if (cycleSession >= 7) return 'Final stretch of this cycle - finish it strong.';
  return 'Every session compounds. Keep showing up.';
}

/**
 * Stats, Strength tab, when no 1RM has ever been recorded.
 *
 * The manual calculator on that screen works whether or not test weeks are on,
 * so an opted-out user is not stuck. They just should not be pointed at the
 * one route they closed.
 */
export function noOneRepMaxHint(freq: TestWeekFrequency): string {
  return testsAreOn(freq)
    ? 'One-rep max tracking covers squat, bench and deadlift. Record one in a test week or work it out below, and the progression charts appear here.'
    : 'One-rep max tracking covers squat, bench and deadlift. Work one out below and the progression charts appear here.';
}

/** The assistant's nudge when nobody has ever recorded a max. */
export function noMaxAssistantCopy(freq: TestWeekFrequency): {
  title: string;
  body: string;
  actionLabel: string;
} {
  return testsAreOn(freq)
    ? {
        title: 'You have never tested a max',
        body: 'Your main lifts are working from what you log week to week, which is a good guide. A tested max on one of them gives every percentage in the programme something real to hang off.',
        actionLabel: 'Test a lift',
      }
    : {
        title: 'No max on record yet',
        body: 'Your main lifts are working from what you log week to week, which is a good guide. Putting in a one-rep max gives every percentage something real to hang off, and you can work one out from a set you have already done.',
        actionLabel: 'Work one out',
      };
}

/**
 * WHAT HAPPENS THE MOMENT SOMEBODY TURNS TESTS BACK ON.
 *
 * This was the sharp edge in the opt-in path. A due test is
 * `testWeekDeferred || strengthCount % freq === 0`, and testWeekDeferred is
 * separate persisted state that survives being switched off. So a user who
 * postponed a test months ago, turned tests off, and later turned them back on
 * would be handed an all-out max attempt on their very next strength session,
 * with no warning at all. The same happens to anyone whose session count
 * happens to sit on a multiple of the frequency.
 *
 * Nothing in the app told them either way. There was no confirmation of any
 * kind: the segmented button simply highlighted.
 *
 * Returns null when tests are off, so the caller shows nothing.
 */
export function nextTestNotice(
  freq: TestWeekFrequency,
  strengthSessionCount: number,
  deferred: boolean
): string | null {
  if (!testsAreOn(freq)) return null;
  const remaining = sessionsUntilTest(freq, strengthSessionCount);
  if (deferred || remaining === 0 || remaining === null) {
    return 'Your next strength session will be a test: squat, bench and deadlift, one per session. You can postpone it when it comes up.';
  }
  if (remaining === 1) return 'Your next strength session is the last one before a test week.';
  return `Your next test week is ${remaining} strength sessions away.`;
}
