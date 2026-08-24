import type { SessionType } from './store';
import { getTrainingBalanceNudge, type BalanceInput } from './training-balance';
import { COMEBACK_SESSIONS, describeTimeAway, getLayoff } from './workout-engine';

/**
 * Everything the app currently has to say to you, in one place.
 *
 * THE PROBLEM THIS SOLVES
 * ───────────────────────
 * The home screen had grown FIVE separate advisory surfaces, each a card in the
 * scroll: a deload banner, a streak-at-risk warning, a calibration progress bar,
 * a bodyweight reminder and a training-balance nudge — plus a floating milestone
 * toast. Any two of them showing at once pushed the actual content off the
 * screen. Reported: "the two advisory messages make the page scrollable and
 * messy. We don't want that. We want everything in view."
 *
 * The advice was never the problem; the fact that it competed with the session
 * card for the same space was. It all lives behind one button now, and the home
 * screen keeps only the things you came to it for.
 *
 * DESIGN RULES
 * ────────────
 *  - Ordered by urgency, not by category. Whatever matters most is first.
 *  - Never empty. With nothing to flag it says so, and for a brand-new user it
 *    says the one thing that IS useful — go and train. An assistant that opens
 *    to a blank panel teaches you not to open it.
 *  - Capped. Three at once is a briefing; six is a to-do list nobody reads.
 *  - Every message is a statement about what has happened, not an instruction.
 *    The training-balance work established that and it holds here too.
 */

export type CoachTone = 'info' | 'caution' | 'good';

export interface CoachAction {
  label: string;
  /** What the screen should do. Kept abstract so this module never imports a router. */
  kind: 'start-session' | 'log-weight' | 'open-stats';
  sessionType?: SessionType;
}

export interface CoachMessage {
  id: string;
  /** Ionicons glyph name. */
  icon: string;
  title: string;
  body: string;
  tone: CoachTone;
  action?: CoachAction;
  /**
   * Whether this one can be waved away.
   *
   * Only the balance observation is. The others resolve themselves — a streak
   * warning ends when the week does, calibration ends at three sessions, a
   * stale bodyweight ends when you log one. An observation about what you have
   * chosen to train has no natural end, so without a dismiss it would sit there
   * with the button's dot lit forever, which is how a notification dot stops
   * meaning anything.
   */
  dismissible?: boolean;
}

export interface CoachInput {
  sessionCount: number;
  /** Sessions completed this week, and the user's weekly goal. */
  weekCount: number;
  weeklyGoal: number;
  /** Current week streak. */
  streak: number;
  /** Consecutive weeks with at least one session, looking back. */
  consecutiveActiveWeeks: number;
  /** Whole days since the last session, or null if there has never been one. */
  daysSinceLast: number | null;
  /** Day of the week, 0 = Sunday, as Date.getDay() reports it. */
  weekday: number;
  /** True when the bodyweight reminder is due. */
  bodyweightStale: boolean;
  /** Everything the balance rule needs; see lib/training-balance.ts. */
  balance: BalanceInput;
}

/** How many sessions of history before the programme is fully personalised. */
export const CALIBRATION_SESSIONS = 3;
/** Consecutive active weeks before a deload is worth mentioning. */
export const DELOAD_WEEKS = 4;
/** Most messages shown at once. */
export const MAX_MESSAGES = 3;

/**
 * What the app has to say about a break in training, or null when there has not
 * been one worth mentioning.
 *
 * Exported because two surfaces need to say this and they must not say it
 * differently: the assistant panel on the home screen, and the readiness screen
 * you pass through on the way into a session. The second one is the important
 * one — an adjustment you find out about afterwards is indistinguishable from a
 * bug, and the whole point of doing this was that the app should visibly know.
 *
 * Deliberately a statement of fact and a number, not reassurance. "Welcome
 * back, take it easy!" tells you nothing; "about 78% of where you left off"
 * tells you exactly what was decided on your behalf and lets you disagree.
 */
export function getLayoffMessage(
  daysSinceLast: number | null,
  opts?: { testHeld?: boolean }
): CoachMessage | null {
  const layoff = getLayoff(daysSinceLast);
  if (!layoff) return null;
  const away = describeTimeAway(layoff.daysAway);
  const testNote = opts?.testHeld
    ? ` Your strength test is on hold until you have ${COMEBACK_SESSIONS} sessions back in.`
    : '';
  return {
    id: 'layoff',
    icon: 'hourglass-outline',
    title: layoff.reset ? `${away} away, starting fresh` : `${away} since your last session`,
    body: layoff.reset
      ? `Weights that old stop being a useful guide, so today is worked out from your profile again, the way it was on day one. A few sessions and it will be reading your own numbers.${testNote}`
      : layoff.slight
        ? `Today's weights come down a touch from where you left off. They climb back as soon as you are training again.${testNote}`
        : `Today's weights are about ${Math.round(layoff.factor * 100)}% of where you left off. They climb back as soon as you are training again.${testNote}`,
    tone: 'info',
    action: { label: 'Ease back in', kind: 'start-session' },
  };
}

export function getCoachMessages(input: CoachInput): CoachMessage[] {
  const messages: CoachMessage[] = [];

  // ── Nothing has happened yet ───────────────────────────────────────────────
  // Deliberately the only message for a new user. Everything else below needs
  // history to be true, and a panel full of "not enough data" is worse than one
  // clear sentence.
  if (input.sessionCount === 0) {
    return [
      {
        id: 'first-session',
        icon: 'flash-outline',
        title: 'Start where you are',
        body: "Your first session is already built and waiting. It will not be perfect yet. The app learns what you can handle from what you actually lift.",
        tone: 'info',
        action: { label: 'Start training', kind: 'start-session' },
      },
    ];
  }

  // ── Back after a break ─────────────────────────────────────────────────────
  // First, because it changes what every other message means. The weights have
  // moved, and being told about a broken streak before being told why the bar
  // is lighter is the wrong way round.
  const layoff = getLayoffMessage(input.daysSinceLast);
  if (layoff) messages.push(layoff);

  // ── Urgent: a streak about to break ────────────────────────────────────────
  // Only from Wednesday. Before that, "you have not trained this week" is not
  // news, it is Monday.
  if (
    input.sessionCount >= CALIBRATION_SESSIONS &&
    input.streak > 0 &&
    input.weekCount < input.weeklyGoal &&
    input.weekday >= 3
  ) {
    const left = input.weeklyGoal - input.weekCount;
    messages.push({
      id: 'streak-risk',
      icon: 'alarm-outline',
      title: 'Your streak needs one more week',
      body:
        input.weekCount === 0
          ? `Nothing logged this week yet. ${input.weeklyGoal} session${input.weeklyGoal === 1 ? '' : 's'} keeps a ${input.streak}-week streak alive.`
          : `${input.weekCount} of ${input.weeklyGoal} done this week. ${left} more keeps a ${input.streak}-week streak alive.`,
      tone: 'caution',
      action: { label: 'Train now', kind: 'start-session' },
    });
  }

  // ── Still calibrating ──────────────────────────────────────────────────────
  if (input.sessionCount < CALIBRATION_SESSIONS) {
    messages.push({
      id: 'calibrating',
      icon: 'analytics-outline',
      title: `Getting to know you · ${input.sessionCount} of ${CALIBRATION_SESSIONS}`,
      body: 'Weights are still estimates from your profile. After three sessions they come from what you have actually lifted.',
      tone: 'info',
    });
  } else if (input.sessionCount === CALIBRATION_SESSIONS && (input.daysSinceLast ?? 99) <= 1) {
    messages.push({
      id: 'calibrated',
      icon: 'checkmark-circle-outline',
      title: "You're all set",
      body: 'Three sessions in. Loads are now worked out from your own numbers rather than from averages.',
      tone: 'good',
    });
  }

  // ── A long unbroken run ────────────────────────────────────────────────────
  if (input.consecutiveActiveWeeks >= DELOAD_WEEKS && input.sessionCount >= 4) {
    messages.push({
      id: 'deload',
      icon: 'moon-outline',
      title: `${input.consecutiveActiveWeeks} weeks without a break`,
      body: 'A lighter week is worth considering: drop to 50-60% of your usual loads and keep everything else the same. It clears fatigue and the next block starts sharper.',
      tone: 'info',
    });
  }

  // ── What you have and have not been training ───────────────────────────────
  const balance = getTrainingBalanceNudge(input.balance);
  if (balance) {
    messages.push({
      id: 'balance',
      icon: 'git-compare-outline',
      title: 'Your training mix',
      body: balance.message,
      tone: 'info',
      action: { label: 'Train it', kind: 'start-session', sessionType: balance.suggestion },
      dismissible: true,
    });
  }

  // ── Stale bodyweight ───────────────────────────────────────────────────────
  if (input.bodyweightStale) {
    messages.push({
      id: 'bodyweight',
      icon: 'body-outline',
      title: 'Your logged weight is getting old',
      body: 'Accessory loads are scaled from your bodyweight, so a stale number quietly makes every suggestion slightly wrong.',
      tone: 'info',
      action: { label: 'Update it', kind: 'log-weight' },
    });
  }

  // ── Nothing to flag ────────────────────────────────────────────────────────
  if (messages.length === 0) {
    messages.push({
      id: 'all-clear',
      icon: 'checkmark-circle-outline',
      title: 'Nothing to flag',
      body:
        input.streak > 0
          ? `${input.streak} week${input.streak === 1 ? '' : 's'} of consistent training and a balanced mix. Keep going.`
          : 'Your training is balanced and your numbers are current. Nothing needs your attention.',
      tone: 'good',
      action: { label: 'See your stats', kind: 'open-stats' },
    });
  }

  return messages.slice(0, MAX_MESSAGES);
}

/** True when there is something worth a badge on the button. */
export function hasActionableAdvice(messages: CoachMessage[]): boolean {
  return messages.some((m) => m.id !== 'all-clear' && m.id !== 'calibrated');
}
