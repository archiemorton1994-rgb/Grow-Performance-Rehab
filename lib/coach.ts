import type { CompletedSession, ExerciseProgress, PainRegion, SessionType, WeightUnit } from './store';
import { getTrainingBalanceNudge, type BalanceInput } from './training-balance';
import {
  COMEBACK_SESSIONS,
  describeTimeAway,
  getLayoff,
  getSessionLabel,
} from './workout-engine';
import { ACUTE_PROTOCOL_NOTES } from './acute-rehab';
import { formatWeight } from './utils';
import {
  biggestLiftGain,
  effortRun,
  painPersistence,
  painResolved,
  recentPersonalBest,
  stalledLift,
  volumeChange,
  DELOAD_AFTER_STALLS,
} from './coach-insights';

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
 * AND THEN IT HAD NOTHING TO SAY
 * ──────────────────────────────
 * Gathering the messages exposed how few there were. Seven, and every one about
 * consistency or admin. Run over sixteen weeks of somebody who trains three
 * times a week and never misses, the panel reached "8 weeks without a break" in
 * week four and repeated it, with a lit notification dot, forever. The best
 * possible user got a permanent nag and nothing else.
 *
 * It now also talks about the training: a lift that has moved, a weight beaten,
 * a lift that has stalled and what the engine is about to do about it, a
 * complaint that keeps coming back, a complaint that has settled, a month with
 * more work in it than the last. See lib/coach-insights.ts, which turns the
 * stored history into those observations. It teaches, occasionally, because an
 * app that silently adapts is an app nobody trusts. And it says well done, with
 * a number attached, because an assistant that only ever reports problems is one
 * you learn not to open.
 *
 * DESIGN RULES
 * ────────────
 *  - Ordered by urgency, not by category. Whatever matters most is first.
 *  - NEVER THREE PROBLEMS. At most two cautions, and the third slot goes to
 *    something that is not a problem whenever there is one to give. Opening a
 *    panel onto three things you have done wrong is how people stop opening it.
 *  - Never empty. With nothing to flag it says so, and for a brand-new user it
 *    says the one thing that IS useful — go and train.
 *  - Capped. Three at once is a briefing; six is a to-do list nobody reads.
 *  - Every message is a statement about what has happened, carrying the number
 *    it came from. Not "great job", not "you should deload". A user who can
 *    check the claim can trust the next one.
 *  - Anything without a natural end is dismissible and stays gone for a set
 *    period. A message that cannot be cleared lights the button's dot forever,
 *    which is how a notification dot stops meaning anything.
 *  - Nothing here diagnoses. The pain messages report what was tapped and how
 *    often, and say who to ask.
 */

export type CoachTone = 'info' | 'caution' | 'good';

export interface CoachAction {
  label: string;
  /** What the screen should do. Kept abstract so this module never imports a router. */
  kind: 'start-session' | 'log-weight' | 'open-stats' | 'open-progress' | 'open-recover';
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
   * Anything that resolves itself is not dismissible — a streak warning ends
   * when the week does, calibration ends at three sessions, a stale bodyweight
   * ends when you log one. Anything that does NOT resolve itself must be: an
   * observation about a chronic knee, or about what you have chosen to train,
   * or a note explaining how the app works, would otherwise sit there with the
   * dot lit for the rest of the user's life.
   */
  dismissible?: boolean;
}

const DAY_MS = 24 * 60 * 60 * 1000;

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
  /**
   * Day of the week with SUNDAY AS 7, not as 0.
   *
   * The training week runs Monday to Sunday — both the weekly count and the
   * streak use that boundary — so a raw Date.getDay() put Sunday at 0 and hid
   * the streak warning on the single last day it could still be acted on. Use
   * weekdayForTrainingWeek() rather than passing getDay() straight in.
   */
  weekday: number;
  /** True when the bodyweight reminder is due. */
  bodyweightStale: boolean;
  /** Everything the balance rule needs; see lib/training-balance.ts. */
  balance: BalanceInput;

  // ── What the training itself has been doing ───────────────────────────────
  /** Newest first, as the store keeps them. */
  sessions: CompletedSession[];
  /** Per-exercise history, oldest appearance first. */
  progress: ExerciseProgress[];
  /** Consecutive stalled sessions per exercise id. */
  stuckStreak: Record<string, number>;
  /** False when the user has never logged a tested max. */
  hasOneRepMax: boolean;
  /** The unit every weight in these messages is written in. */
  weightUnit: WeightUnit;
  /** When each message id was last waved away. */
  dismissedAt: Record<string, number>;
  now: number;
}

/**
 * The messages that count as a problem.
 *
 * Named rather than derived from tone, because tone is about how a message
 * READS and this rule is about what it IS. The layoff note is written calmly on
 * purpose - it explains why the bar is lighter - but arriving back from three
 * weeks off, being told your knee will not settle and that your streak is gone
 * is still three problems in one panel, whatever colour they are printed in.
 */
export const PROBLEM_IDS: readonly string[] = ['layoff', 'pain-persist', 'streak-risk', 'stall'];

/** How many sessions of history before the programme is fully personalised. */
export const CALIBRATION_SESSIONS = 3;
/** Consecutive active weeks before a deload is worth mentioning. */
export const DELOAD_WEEKS = 4;
/** Most messages shown at once. */
export const MAX_MESSAGES = 3;
/** And the most of those that may be problems. See the design rules. */
export const MAX_CAUTIONS = 2;

/**
 * Day of the week for a Monday-to-Sunday training week, Sunday being 7.
 *
 * Exported and used by both callers on purpose. The raw JavaScript numbering
 * puts Sunday at 0, and the home screen and this file each compared against it
 * independently — so the streak warning ("you need one more session this week")
 * was hidden on Sunday, the last day it could possibly help.
 */
export function weekdayForTrainingWeek(date: Date): number {
  const d = date.getDay();
  return d === 0 ? 7 : d;
}

const regionLabel = (r: PainRegion): string =>
  ACUTE_PROTOCOL_NOTES[r]?.plainName ?? String(r).replace(/_/g, ' ');

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

/**
 * How the app works, said one piece at a time.
 *
 * An app that silently changes your weights is an app people assume is broken
 * the first time it does something they did not expect. These are the four
 * things a user has to understand for the rest of it to make sense, and they
 * rotate rather than all arriving at once — the panel offers one only when
 * nothing more urgent is competing for the slot, so they surface over the first
 * few weeks and then get out of the way.
 *
 * Each is dismissible and stays gone for two months, because "how it works" is
 * not news twice.
 */
const EXPLAINERS: { id: string; icon: string; title: string; body: string }[] = [
  {
    id: 'how-load',
    icon: 'trending-up-outline',
    title: 'Where your weights come from',
    body: 'Every weight on a card is worked out from what you actually lifted last time, not from a fixed plan. Finish your sets comfortably and it goes up. Fall short three sessions running and it comes down 10% so the lift can move again.',
  },
  {
    id: 'how-reps',
    icon: 'repeat-outline',
    title: 'Reps move before weight does',
    body: 'When you see a range like 8 to 12, the app walks you up it one rep at a time and only adds weight once you have cleared the top. It is a smaller step than a plate and it is the reason progress keeps going when adding weight would stall.',
  },
  {
    id: 'how-pain',
    icon: 'medkit-outline',
    title: 'Telling it where it hurts changes the session',
    body: 'Flag an area on the way in and the app takes out what loads it and puts something safe in the same slot. It is not a lighter session, it is a different one, and the swap is labelled on the card so you can see what changed.',
  },
  {
    id: 'how-swap',
    icon: 'swap-horizontal-outline',
    title: 'Every exercise has two alternatives',
    body: 'Tap the swap icon on any card for the same exercise with different equipment, and a different exercise for the same muscles. Useful when a machine is taken or something is bothering you, and you can always go back.',
  },
  {
    id: 'how-time',
    icon: 'time-outline',
    title: 'Short on time is a real answer',
    body: 'Tell the readiness check you have 30 minutes and the app cuts accessories and finishers rather than trimming a bit off everything. The main lift stays whole, because that is the part that drives the progress.',
  },
];

interface Bucket {
  cautions: CoachMessage[];
  info: CoachMessage[];
  good: CoachMessage[];
  teaching: CoachMessage[];
}

/**
 * Everything the app has to say, sorted by kind and not yet cut down.
 *
 * Split out from getCoachMessages so the same work feeds two surfaces that want
 * different amounts of it. The home-screen panel takes three; the full
 * assistant screen shows the lot. They must never disagree about what is true,
 * which they cannot if only one of them decides it.
 */
function buildCoachBuckets(input: CoachInput): Bucket {
  const b: Bucket = { cautions: [], info: [], good: [], teaching: [] };
  const now = input.now ?? Date.now();
  /**
   * Missing history degrades to no observation, rather than throwing.
   *
   * The type requires these, so a screen that forgets to wire one up fails to
   * compile. This is for everything the compiler does not see: the contract
   * tests are plain JavaScript, and a panel that crashes the home screen
   * because a field arrived undefined is a far worse failure than one that
   * quietly has less to say.
   */
  const sessions = input.sessions ?? [];
  const progress = input.progress ?? [];
  const stuckStreak = input.stuckStreak ?? {};
  const w = (kg: number) => formatWeight(kg, input.weightUnit ?? 'kg');

  /** Has this been waved away recently enough to stay away? */
  const hidden = (id: string, days: number) => {
    const at = input.dismissedAt?.[id];
    return typeof at === 'number' && now - at < days * DAY_MS;
  };

  // ── Nothing has happened yet ───────────────────────────────────────────────
  // Deliberately the only message for a new user. Everything else below needs
  // history to be true, and a panel full of "not enough data" is worse than one
  // clear sentence.
  if (input.sessionCount === 0) {
    b.info.push({
      id: 'first-session',
      icon: 'flash-outline',
      title: 'Start where you are',
      body: "Your first session is already built and waiting. It will not be perfect yet. The app learns what you can handle from what you actually lift.",
      tone: 'info',
      action: { label: 'Start training', kind: 'start-session' },
    });
    return b;
  }

  // ── Back after a break ─────────────────────────────────────────────────────
  // First, because it changes what every other message means. The weights have
  // moved, and being told about a broken streak before being told why the bar
  // is lighter is the wrong way round.
  const layoff = getLayoffMessage(input.daysSinceLast);
  if (layoff) b.cautions.push(layoff);

  // ── A complaint that has not settled ───────────────────────────────────────
  // High, because it is the only thing here a person might need to act on
  // outside the app. It reports frequency and duration and stops; whether it
  // means anything is a clinical question and the message says so.
  const pain = painPersistence(sessions, now);
  if (pain && !hidden('pain-persist', 21)) {
    const area = regionLabel(pain.region);
    b.cautions.push({
      id: 'pain-persist',
      icon: 'pulse-outline',
      title: `${area} keeps coming back`,
      body: `You have flagged it in ${pain.flagged} of your last ${pain.of} sessions, going back ${pain.weeksRunning} weeks${pain.worsening ? ', and more often lately' : ''}. The app has been adapting around it each time. Something that has not settled in ${pain.weeksRunning} weeks is worth having looked at by someone who can put hands on it.`,
      tone: 'caution',
      action: { label: 'See the pattern', kind: 'open-stats' },
      dismissible: true,
    });
  }

  // ── Urgent: a streak about to break ────────────────────────────────────────
  // Only from Wednesday. Before that, "you have not trained this week" is not
  // news, it is Monday. Sunday is 7 here, not 0 — see weekdayForTrainingWeek.
  if (
    input.sessionCount >= CALIBRATION_SESSIONS &&
    input.streak > 0 &&
    input.weekCount < input.weeklyGoal &&
    input.weekday >= 3
  ) {
    const left = input.weeklyGoal - input.weekCount;
    b.cautions.push({
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

  // ── A lift that has stopped moving ─────────────────────────────────────────
  // The user can see the weight has not changed. What they cannot see is that
  // the app noticed and has a plan, and an automatic 10% drop that arrives
  // unannounced is indistinguishable from a bug.
  const stall = stalledLift(progress, stuckStreak);
  if (stall) {
    b.cautions.push({
      id: 'stall',
      icon: 'remove-circle-outline',
      title: `${stall.name} has held at ${w(stall.kg)}`,
      body: stall.deloadNext
        ? `That is ${stall.sessions} sessions at the same weight. Next time the app takes about 10% off it on purpose, so you can build back up through it rather than keep meeting it head on.`
        : `That is ${stall.sessions} sessions at the same weight. One more and the app will take about 10% off so the lift can get moving again.`,
      tone: stall.deloadNext ? 'info' : 'caution',
    });
  }

  // ── Still calibrating ──────────────────────────────────────────────────────
  if (input.sessionCount < CALIBRATION_SESSIONS) {
    b.info.push({
      id: 'calibrating',
      icon: 'analytics-outline',
      title: `Getting to know you · ${input.sessionCount} of ${CALIBRATION_SESSIONS}`,
      body: 'Weights are still estimates from your profile. After three sessions they come from what you have actually lifted.',
      tone: 'info',
    });
  } else if (input.sessionCount === CALIBRATION_SESSIONS && (input.daysSinceLast ?? 99) <= 1) {
    b.good.push({
      id: 'calibrated',
      icon: 'checkmark-circle-outline',
      title: "You're all set",
      body: 'Three sessions in. Loads are now worked out from your own numbers rather than from averages.',
      tone: 'good',
    });
  }

  // ── A long unbroken run ────────────────────────────────────────────────────
  // Dismissible, and for a long time. The counter behind it stops at eight and
  // never resets, so before this was waveable a consistent user saw the same
  // sentence and a lit dot every time they opened the app, permanently.
  const deloadNote =
    input.consecutiveActiveWeeks >= DELOAD_WEEKS &&
    input.sessionCount >= 4 &&
    !hidden('deload', 42)
      ? ({
      id: 'deload',
      icon: 'moon-outline',
      title: `${input.consecutiveActiveWeeks} weeks without a break`,
      body: `A lighter week is worth considering: keep everything the same and drop to 50-60% of your usual loads. The app already backs individual lifts off when they stall, but it cannot give you a whole easy week unless you take one.`,
      tone: 'info',
      dismissible: true,
    } as CoachMessage)
      : null;

  // ── What you have and have not been training ───────────────────────────────
  const balance = getTrainingBalanceNudge(input.balance);
  if (balance) {
    b.info.push({
      id: 'balance',
      icon: 'git-compare-outline',
      title: 'Your training mix',
      body: balance.message,
      tone: 'info',
      action: { label: 'Train it', kind: 'start-session', sessionType: balance.suggestion },
      dismissible: true,
    });
  }

  // ── Everything has been feeling easy ───────────────────────────────────────
  const effort = effortRun(sessions);
  if (effort && effort.easy >= 3 && !hidden('effort-easy', 21)) {
    b.info.push({
      id: 'effort-easy',
      icon: 'speedometer-outline',
      title: 'You have been rating most sets easy',
      body: `${effort.easy} of your last ${effort.of} sessions came back easy throughout. The app is already stepping the weights up faster because of it. If they still feel light, keep saying so on the set feedback and it will keep moving.`,
      tone: 'info',
      dismissible: true,
    });
  }

  // ── Stale bodyweight ───────────────────────────────────────────────────────
  if (input.bodyweightStale) {
    b.info.push({
      id: 'bodyweight',
      icon: 'body-outline',
      title: 'Your logged weight is getting old',
      body: 'Accessory loads are scaled from your bodyweight, so a stale number quietly makes every suggestion slightly wrong.',
      tone: 'info',
      action: { label: 'Update it', kind: 'log-weight' },
    });
  }

  // ── Never tested a max ─────────────────────────────────────────────────────
  if (
    !input.hasOneRepMax &&
    input.sessionCount >= 8 &&
    !hidden('prompt-1rm', 30)
  ) {
    b.info.push({
      id: 'prompt-1rm',
      icon: 'barbell-outline',
      title: 'You have never tested a max',
      body: 'Your main lifts are working from what you log week to week, which is a good guide. A tested max on one of them gives every percentage in the programme something real to hang off.',
      tone: 'info',
      action: { label: 'Test a lift', kind: 'open-stats' },
      dismissible: true,
    });
  }

  // Pushed last of the info messages on purpose. It is a suggestion the user
  // is free to ignore forever, the counter behind it stops at eight and never
  // resets, and before it was both waveable and last in the queue a consistent
  // user saw it every single time they opened the app.
  if (deloadNote) b.info.push(deloadNote);

  // ── A weight beaten ────────────────────────────────────────────────────────
  const pb = recentPersonalBest(progress, now);
  if (pb) {
    b.good.push({
      id: 'personal-best',
      icon: 'trophy-outline',
      title: `${pb.name}: ${w(pb.kg)}`,
      body: `${pb.daysAgo === 0 ? 'Today' : pb.daysAgo === 1 ? 'Yesterday' : `${pb.daysAgo} days ago`} you beat your previous best of ${w(pb.previousKg)} on that lift. That is the heaviest you have logged it.`,
      tone: 'good',
      action: { label: 'See your lifts', kind: 'open-progress' },
    });
  }

  // ── How far a lift has come ────────────────────────────────────────────────
  // Measured from the FOURTH session of that exercise, not the first — the
  // first three are estimates from a questionnaire, and measuring from them
  // would report the app correcting its own guess as if it were progress.
  const gain = biggestLiftGain(progress);
  if (gain && gain.gainKg > 0) {
    b.good.push({
      id: 'lift-gain',
      icon: 'trending-up-outline',
      title: `${gain.name} is up ${w(gain.gainKg)}`,
      body: `From ${w(gain.fromKg)} to ${w(gain.toKg)} over ${gain.sessions} sessions. That is the biggest move of any lift you are logging.`,
      tone: 'good',
      action: { label: 'See your lifts', kind: 'open-progress' },
    });
  }

  // ── A heavier month ────────────────────────────────────────────────────────
  const volume = volumeChange(sessions, now);
  if (volume && volume.pct > 0) {
    b.good.push({
      id: 'volume-up',
      icon: 'bar-chart-outline',
      title: `${volume.pct}% more work than last month`,
      body: 'Total weight moved across every set. Individual lifts climb slowly on purpose, so this is usually the first place a good month shows up.',
      tone: 'good',
      action: { label: 'See your stats', kind: 'open-stats' },
    });
  }

  // ── A complaint that settled ───────────────────────────────────────────────
  // An app that only speaks up when something is wrong is one people learn to
  // dread. This is the other half of pain-persist and it costs nothing to say.
  const settled = painResolved(sessions, now);
  if (settled) {
    b.good.push({
      id: 'pain-resolved',
      icon: 'checkmark-done-outline',
      title: `No ${regionLabel(settled.region).toLowerCase()} trouble for ${settled.weeksClear} weeks`,
      body: 'You were flagging it regularly before that. The sessions have been building back up around it in the meantime.',
      tone: 'good',
    });
  }

  // ── How the app works, one piece at a time ─────────────────────────────────
  // Rotated by session count so the same one does not come round forever, and
  // only ever offered a slot nothing else wanted.
  const offered = EXPLAINERS.filter((e) => !hidden(e.id, 60));
  if (offered.length > 0 && input.sessionCount >= 1) {
    const pick = offered[Math.abs(input.sessionCount) % offered.length];
    b.teaching.push({
      id: pick.id,
      icon: pick.icon,
      title: pick.title,
      body: pick.body,
      tone: 'info',
      dismissible: true,
    });
  }

  /**
   * Rotate the good news rather than always leading with the same kind.
   *
   * Somebody on linear progression sets a personal best most weeks, so taking
   * the first candidate every time meant the panel said "you beat your best on
   * the deadlift" sixteen weeks running. All of them were true and by week four
   * nobody was reading them. Seeded on session count so it is stable within a
   * day and different by the next session.
   *
   * Rotation belongs here rather than in the panel, so the full screen lists
   * them in the same order the panel would have picked from.
   */
  const rotated = (list: CoachMessage[]) => {
    if (list.length < 2) return list;
    const offset = Math.abs(input.sessionCount) % list.length;
    return [...list.slice(offset), ...list.slice(0, offset)];
  };
  b.good = rotated(b.good);

  return b;
}

/**
 * The three the home-screen panel shows.
 *
 * At most two problems, then something that is not one if there is anything,
 * then whatever else fits. See the design rules at the top: a panel that opens
 * onto three things you have done wrong is one people stop opening.
 */
export function getCoachMessages(input: CoachInput): CoachMessage[] {
  const b = buildCoachBuckets(input);
  const chosen: CoachMessage[] = [];
  const take = (list: CoachMessage[], limit: number) => {
    let n = limit;
    for (const m of list) {
      if (chosen.length >= MAX_MESSAGES || n <= 0) return;
      if (chosen.some((c) => c.id === m.id)) continue;
      chosen.push(m);
      n--;
    }
  };

  take(b.cautions, MAX_CAUTIONS);
  take(b.good, 1);
  take(b.info, MAX_MESSAGES);
  take(b.good, MAX_MESSAGES);
  take(b.teaching, 1);
  take(b.cautions, MAX_MESSAGES);

  // ── Nothing to flag ────────────────────────────────────────────────────────
  if (chosen.length === 0) {
    chosen.push({
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

  return chosen;
}

/**
 * Messages that do NOT deserve a dot on the button.
 *
 * Praise and explainers are worth reading and not worth interrupting for. A dot
 * that lights up to tell you your squat went up is a dot you stop believing,
 * and the whole reason the dot exists is so that the one time it means "your
 * knee has been sore for five weeks" you go and look.
 */
const QUIET_IDS = new Set([
  'all-clear',
  'calibrated',
  // Advice somebody is free to ignore forever must not hold the dot open
  // forever. This one is the reason the rule exists.
  'deload',
  'personal-best',
  'lift-gain',
  'volume-up',
  'pain-resolved',
  ...EXPLAINERS.map((e) => e.id),
]);

/** True when there is something worth a badge on the button. */
export function hasActionableAdvice(messages: CoachMessage[]): boolean {
  return messages.some((m) => !QUIET_IDS.has(m.id));
}

/**
 * The numbers the assistant panel shows above its messages.
 *
 * WHY A SNAPSHOT AND NOT MORE MESSAGES.
 * A message is something that happened and needs saying. These are the three
 * facts a user checks every time regardless - am I on track this week, is the
 * streak alive, is the work going up - and turning each into a sentence would
 * fill the panel with things nobody needed told. As a strip they cost one line
 * and answer the question before it is asked.
 *
 * Everything here is already computed elsewhere in the panel; this only gathers
 * it, so the strip can never disagree with the messages underneath it.
 */
export interface CoachSnapshot {
  weekCount: number;
  weeklyGoal: number;
  streak: number;
  /** Change in total weight moved, this month against last. Null until there
   *  are two comparable months. */
  volumeDeltaPct: number | null;
  /** What the app would train next, and why in one clause. */
  nextSession: { type: SessionType; label: string; reason: string } | null;
}

export function getCoachSnapshot(input: CoachInput): CoachSnapshot {
  const now = input.now ?? Date.now();
  const sessions = input.sessions ?? [];
  const volume = volumeChange(sessions, now);

  /**
   * The recommendation, in priority order.
   *
   * The balance rule first, because it is the only one built on a considered
   * idea of what a week should contain. Failing that, whatever has gone longest
   * without being trained - which is a weaker claim, so it is worded as one.
   */
  let nextSession: CoachSnapshot['nextSession'] = null;
  const balance = getTrainingBalanceNudge(input.balance);
  if (balance) {
    nextSession = {
      type: balance.suggestion,
      label: getSessionLabel(balance.suggestion),
      reason: 'evens out your recent mix',
    };
  } else if (sessions.length >= 2) {
    const lastSeen = new Map<SessionType, number>();
    for (const s of sessions) {
      const t = new Date(s.date).getTime();
      const prev = lastSeen.get(s.sessionType);
      if (prev === undefined || t > prev) lastSeen.set(s.sessionType, t);
    }
    let oldest: SessionType | null = null;
    let oldestAt = Infinity;
    for (const [type, at] of lastSeen) {
      if (at < oldestAt) {
        oldestAt = at;
        oldest = type;
      }
    }
    if (oldest && lastSeen.size >= 2) {
      const days = Math.floor((now - oldestAt) / DAY_MS);
      nextSession = {
        type: oldest,
        label: getSessionLabel(oldest),
        reason: days >= 1 ? `${days} days since you last did one` : 'longest since you trained it',
      };
    }
  }

  return {
    weekCount: input.weekCount,
    weeklyGoal: input.weeklyGoal,
    streak: input.streak,
    volumeDeltaPct: volume ? volume.pct : null,
    nextSession,
  };
}

/**
 * What makes a message "new" to the button's badge.
 *
 * The id alone is not enough: 'personal-best' is the same id whether it is
 * reporting a deadlift from six weeks ago or one set an hour ago. The title
 * carries the number, so pairing the two means the badge lights again the
 * moment the underlying fact changes and stays quiet while it has not.
 */
export function messageSignature(m: CoachMessage): string {
  return `${m.id}|${m.title}`;
}

/**
 * Everything the assistant has to say, grouped, for the full screen.
 *
 * WHY THIS EXISTS ALONGSIDE THE THREE
 * ───────────────────────────────────
 * Three at once is a briefing and six is a to-do list nobody reads, so the
 * panel stays at three. But the app now has a dozen things it can observe, and
 * a user who only ever sees the top three has no way of knowing the other nine
 * were ever considered. That is the difference between an app that nags and one
 * that has actually looked: the panel is the summary, this is the file behind
 * it.
 *
 * Grouped by what the user would do about each one rather than by tone, because
 * "what needs me" and "what is going well" are two different visits.
 */
export interface CoachBriefing {
  /** Things worth acting on. */
  needsYou: CoachMessage[];
  /** Observations about the training that are neither good nor bad. */
  yourTraining: CoachMessage[];
  /** Things that are going well. */
  goingWell: CoachMessage[];
  /**
   * How the app works, ALL of it, regardless of what has been waved away.
   *
   * On the panel these rotate and a dismissed one stays gone, because there it
   * is competing for a slot. Here it is a reference section somebody has
   * navigated to on purpose, and a reference that hides the page you dismissed
   * three weeks ago is a bad reference.
   */
  howItWorks: CoachMessage[];
  /** Everything except the reference section. What the panel is a summary of. */
  total: number;
}

export function getCoachBriefing(input: CoachInput): CoachBriefing {
  const b = buildCoachBuckets(input);
  const needsYou = b.cautions;
  // The teaching pick is already in howItWorks below, so it is not repeated.
  const yourTraining = b.info;
  const goingWell = b.good;
  const howItWorks: CoachMessage[] = EXPLAINERS.map((e) => ({
    id: e.id,
    icon: e.icon,
    title: e.title,
    body: e.body,
    tone: 'info' as const,
  }));
  return {
    needsYou,
    yourTraining,
    goingWell,
    howItWorks,
    total: needsYou.length + yourTraining.length + goingWell.length,
  };
}
