import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

const REMINDER_ID = 'grow-workout-reminder';

export function isNotificationsSupported(): boolean {
  return Platform.OS !== 'web';
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (!isNotificationsSupported()) return false;
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === 'granted') return true;
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

const REMINDER_BODIES = [
  "Your session is ready. Let's go.",
  'Consistency builds strength. Time to train.',
  "You'll feel great after. Let's get started.",
  'Ready to move? Your workout is waiting.',
  'Another session, another step forward.',
];

/**
 * WHO THE DAILY REMINDER IS FOR, AND WHY IT IS NOT ONE MESSAGE.
 *
 * "Your session is ready. Let's go." went to everybody who had turned reminders
 * on, every day, including people who cannot open a session. Somebody without a
 * subscription taps it, gets the paywall, and learns to ignore the app's
 * notifications. That is the worst outcome of the three: the reminder still
 * fires, and it has taught them to swipe it away.
 *
 * So the alarm is the same alarm, at the same time they chose, with a message
 * that fits where they actually are.
 *
 * NOTE ON WHAT THESE MAY NOT SAY. Not one word about a free trial or its
 * length. Apple grants an introductory offer once per Apple ID rather than once
 * per Grow account, and this app has not asked the store anything at the moment
 * a notification is scheduled. The paywall asks, and the paywall is the only
 * screen allowed to name an offer. A notification promising fourteen free days
 * to somebody Apple will charge immediately is the same mistake the celebration
 * screen used to make, delivered daily.
 */
export type ReminderAudience = 'training' | 'never-subscribed' | 'lapsed';

const AUDIENCE_COPY: Record<
  Exclude<ReminderAudience, 'training'>,
  { title: string; bodies: string[] }
> = {
  'never-subscribed': {
    title: 'Your plan is ready',
    bodies: [
      'Built around the answers you gave. Open Grow to get started.',
      'Your first session is waiting whenever you are.',
      'Everything is set up. All that is left is to start.',
    ],
  },
  lapsed: {
    title: 'Your training is still here',
    bodies: [
      'Your history, your weights and your programme are exactly as you left them.',
      'Nothing has been lost. Pick up whenever you are ready.',
      'Everything you built is still here waiting for you.',
    ],
  },
};

/**
 * Which of the three a person is, decided once so every caller agrees.
 *
 * "Never subscribed" and "lapsed" are told apart by hasEverSubscribed, a flag
 * the app sets the first time it sees an active entitlement. It is not read
 * back from the store, because the store cannot answer "did this person ever
 * pay us" in a way we can rely on offline, and because getting it wrong here
 * only picks the warmer of two honest messages.
 */
export function reminderAudienceFor(
  hasActiveSubscription: boolean,
  hasEverSubscribed: boolean
): ReminderAudience {
  if (hasActiveSubscription) return 'training';
  return hasEverSubscribed ? 'lapsed' : 'never-subscribed';
}

export async function scheduleWorkoutReminder(
  timeStr: string,
  audience: ReminderAudience = 'training'
): Promise<void> {
  if (!isNotificationsSupported()) return;

  await cancelWorkoutReminder();

  const [hourStr, minuteStr] = timeStr.split(':');
  const hour = parseInt(hourStr, 10);
  const minute = parseInt(minuteStr ?? '0', 10);

  const voice = audience === 'training' ? null : AUDIENCE_COPY[audience];
  const bodies = voice ? voice.bodies : REMINDER_BODIES;
  const body = bodies[Math.floor(Math.random() * bodies.length)];

  await Notifications.scheduleNotificationAsync({
    identifier: REMINDER_ID,
    content: {
      // No dash. The app name is already the label on the notification on both
      // platforms, so repeating it only made room for the tic.
      title: voice ? voice.title : 'Time to train',
      body,
      data: {
        screen: audience === 'training' ? 'train' : 'subscription',
        url: 'growperformance:///(tabs)',
      },
      sound: true,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour,
      minute,
    },
  });
}

export async function cancelWorkoutReminder(): Promise<void> {
  if (!isNotificationsSupported()) return;
  try {
    await Notifications.cancelScheduledNotificationAsync(REMINDER_ID);
  } catch {}
}

export function formatReminderTime(timeStr: string): string {
  const [hourStr, minuteStr] = timeStr.split(':');
  const hour = parseInt(hourStr, 10);
  const minute = parseInt(minuteStr ?? '0', 10);
  const period = hour >= 12 ? 'PM' : 'AM';
  const h = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  const m = minute === 0 ? '' : `:${String(minute).padStart(2, '0')}`;
  return `${h}${m} ${period}`;
}

export const REMINDER_TIME_OPTIONS: string[] = [
  '06:00',
  '07:00',
  '08:00',
  '09:00',
  '10:00',
  '12:00',
  '17:00',
  '18:00',
  '19:00',
  '20:00',
];

export const STREAK_TIME_OPTIONS: string[] = ['17:00', '18:00', '19:00', '20:00', '21:00'];

/**
 * THE APP COULD ONLY EVER TALK TO PEOPLE WHO WERE ALREADY COMING BACK.
 *
 * The missed-workout nudge is the only reminder on by default, and it was a
 * SINGLE one-shot alarm twenty hours out, re-armed only when the app was opened
 * or a session finished. There is no push server and no background task, so if
 * somebody stopped opening the app they got exactly one notification, ever, and
 * then silence. The reminder that mattered - the one on day nine, when they had
 * drifted rather than decided - could not exist.
 *
 * A LADDER OF ONE-SHOTS solves it without a server. Every rung is scheduled at
 * the same moment, and every app open cancels and re-arms the whole set, so an
 * active user never sees anything past the first. Only somebody who has
 * genuinely stopped opening the app walks down it.
 *
 * The wording escalates, and the later rungs answer the actual reason people do
 * not come back after a fortnight: not knowing what a return costs them. The
 * app already handles it - see getLayoff in lib/workout-engine.ts - so the
 * message can say so.
 */
// The first rung keeps the identifier the previous single-alarm version used,
// so an alarm it scheduled is still cancelled rather than left to fire twice.
const NUDGE_RUNGS: { id: string; hours: number; title: string; body: string }[] = [
  {
    id: 'grow-missed-workout',
    hours: 20,
    title: "Ready for today's workout?",
    body: 'Your next session is built and waiting.',
  },
  {
    id: 'grow-missed-workout-3d',
    hours: 24 * 3,
    // NOT "your session is still here". A saved in-progress session is
    // discarded on the first launch after 24 hours (app/_layout.tsx), so by the
    // time this rung fires at 72 the session it promised has been gone for two
    // days. What IS still true is that the next one is already built.
    title: 'Three days is nothing',
    body: 'Your next session is built and waiting whenever you are ready.',
  },
  {
    id: 'grow-missed-workout-7d',
    hours: 24 * 7,
    title: 'A week off is not a setback',
    body: 'Come back and the first session comes back lighter on purpose, then climbs again. Nothing to make up.',
  },
  {
    id: 'grow-missed-workout-14d',
    hours: 24 * 14,
    title: 'Still here when you are',
    // The first sentence is true whatever has happened to the subscription:
    // nothing is deleted when an entitlement lapses. "One session is all it
    // takes" was not, because somebody whose subscription has run out meets the
    // paywall before they meet a session. Promise the data, not the training.
    body: 'Nothing has been lost. Your history, your weights and your programme are exactly as you left them.',
  },
];

export async function scheduleMissedWorkoutNudge(): Promise<void> {
  if (!isNotificationsSupported()) return;
  const { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') return;
  await cancelMissedWorkoutNudge();
  for (const rung of NUDGE_RUNGS) {
    try {
      await Notifications.scheduleNotificationAsync({
        identifier: rung.id,
        content: {
          title: rung.title,
          body: rung.body,
          sound: true,
          data: { screen: 'train' },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
          seconds: rung.hours * 3600,
          repeats: false,
        },
      });
    } catch {}
  }
}

/** Clears every rung, not just the first. Cancelling one and leaving three
 *  behind would notify somebody who came back yesterday. */
export async function cancelMissedWorkoutNudge(): Promise<void> {
  if (!isNotificationsSupported()) return;
  for (const rung of NUDGE_RUNGS) {
    try {
      await Notifications.cancelScheduledNotificationAsync(rung.id);
    } catch {}
  }
}

const STREAK_PROTECTION_ID = 'grow-streak-protection';

/**
 * Returns the number of seconds until the next Wed/Thu/Fri/Sat/Sun occurrence
 * of the given time string. Mon (1) and Tue (2) are skipped — too early in the
 * Mon–Sun week to be at risk. Returns null if no eligible slot is found within
 * the next 7 days (shouldn't happen in practice).
 *
 * Sun=0, Mon=1, Tue=2, Wed=3, Thu=4, Fri=5, Sat=6
 */
function secondsUntilNextRiskAlert(timeStr: string): number | null {
  const [h, m] = timeStr.split(':').map((s) => parseInt(s, 10));
  const now = new Date();
  const riskDays = new Set([0, 3, 4, 5, 6]); // Sun, Wed, Thu, Fri, Sat
  for (let daysAhead = 0; daysAhead <= 7; daysAhead++) {
    const candidate = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() + daysAhead,
      h,
      m,
      0,
      0
    );
    if (candidate <= now) continue; // time has already passed today
    if (!riskDays.has(candidate.getDay())) continue; // safe (Mon/Tue)
    return Math.ceil((candidate.getTime() - now.getTime()) / 1000);
  }
  return null;
}

export async function scheduleStreakProtectionAlert(
  timeStr: string = '20:00',
  weeklyGoal: number = 2,
  weekCount: number = 0
): Promise<void> {
  if (!isNotificationsSupported()) return;
  const { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') return;

  // Goal already met this week — no risk, cancel any existing alert.
  if (weekCount >= weeklyGoal) {
    await cancelStreakProtectionAlert();
    return;
  }

  // Compute the next eligible day/time (Wed–Sun only). If there is no upcoming
  // risk slot this week (e.g. it's already Sunday evening past alert time),
  // cancel and let the next app-open / session-complete re-evaluate.
  const secondsUntil = secondsUntilNextRiskAlert(timeStr);
  if (secondsUntil === null) {
    await cancelStreakProtectionAlert();
    return;
  }

  await cancelStreakProtectionAlert();
  const remaining = weeklyGoal - weekCount;
  const body =
    remaining === 1
      ? "Just 1 more session this week to keep your streak alive. Don't stop now!"
      : `You need ${remaining} more sessions this week to protect your streak. Get one in now!`;

  // Schedule a ONE-SHOT notification for the next eligible risk day/time.
  // Non-repeating means it cannot leak into Mon/Tue of the following week.
  // The app-foreground AppState listener and the completedSessions effect both
  // reschedule (or cancel) whenever state changes.
  try {
    await Notifications.scheduleNotificationAsync({
      identifier: STREAK_PROTECTION_ID,
      content: {
        title: 'Your weekly streak is at risk',
        body,
        sound: true,
        data: { screen: 'train' },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: secondsUntil,
        repeats: false,
      },
    });
  } catch {}
}

export async function cancelStreakProtectionAlert(): Promise<void> {
  if (!isNotificationsSupported()) return;
  try {
    await Notifications.cancelScheduledNotificationAsync(STREAK_PROTECTION_ID);
  } catch {}
}

const BODYWEIGHT_NOTIF_ID = 'grow-bodyweight-reminder';
const BODYWEIGHT_INTERVAL_DAYS = 14;

export async function scheduleBodyweightReminder(
  bodyweightUpdatedAt: string | null,
  hasCompletedSessions: boolean
): Promise<void> {
  if (!isNotificationsSupported()) return;
  const { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') return;
  if (!hasCompletedSessions) return;

  await cancelBodyweightReminder();

  const now = Date.now();
  const intervalMs = BODYWEIGHT_INTERVAL_DAYS * 24 * 60 * 60 * 1000;

  let secondsUntilFire: number;
  if (!bodyweightUpdatedAt) {
    secondsUntilFire = 3600;
  } else {
    const msRemaining = intervalMs - (now - new Date(bodyweightUpdatedAt).getTime());
    secondsUntilFire = msRemaining <= 0 ? 3600 : Math.ceil(msRemaining / 1000);
  }

  try {
    await Notifications.scheduleNotificationAsync({
      identifier: BODYWEIGHT_NOTIF_ID,
      content: {
        title: 'Is your weight still accurate?',
        body: "It's been a while since you logged your bodyweight. Update it to keep your training on track.",
        sound: true,
        data: { screen: 'home' },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: secondsUntilFire,
        repeats: false,
      },
    });
  } catch {}
}

export async function cancelBodyweightReminder(): Promise<void> {
  if (!isNotificationsSupported()) return;
  try {
    await Notifications.cancelScheduledNotificationAsync(BODYWEIGHT_NOTIF_ID);
  } catch {}
}

export const REST_TIMER_NOTIF_ID = 'grow-rest-timer';

export async function cancelRestTimerNotification(): Promise<void> {
  if (!isNotificationsSupported()) return;
  try {
    await Notifications.cancelScheduledNotificationAsync(REST_TIMER_NOTIF_ID);
  } catch {}
}
