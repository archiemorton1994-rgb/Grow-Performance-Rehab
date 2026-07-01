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
  "Your session is ready. Let's go 💪",
  "Consistency builds strength. Time to train.",
  "You'll feel great after. Let's get started.",
  "Ready to move? Your workout is waiting.",
  "Another session, another step forward.",
];

export async function scheduleWorkoutReminder(timeStr: string): Promise<void> {
  if (!isNotificationsSupported()) return;

  await cancelWorkoutReminder();

  const [hourStr, minuteStr] = timeStr.split(':');
  const hour = parseInt(hourStr, 10);
  const minute = parseInt(minuteStr ?? '0', 10);

  const body = REMINDER_BODIES[Math.floor(Math.random() * REMINDER_BODIES.length)];

  await Notifications.scheduleNotificationAsync({
    identifier: REMINDER_ID,
    content: {
      title: 'Grow - Time to Train',
      body,
      data: { screen: 'train', url: 'growperformance:///(tabs)' },
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
  } catch {
  }
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
  '06:00', '07:00', '08:00', '09:00', '10:00',
  '12:00', '17:00', '18:00', '19:00', '20:00',
];

export const STREAK_TIME_OPTIONS: string[] = [
  '17:00', '18:00', '19:00', '20:00', '21:00',
];

const NUDGE_ID = 'grow-missed-workout';
const NUDGE_INTERVAL_SECONDS = 72000; // 20 hours

const NUDGE_BODIES = [
  "Ready for today's session? Your next workout is waiting.",
  "You haven't trained today. Even 30 minutes makes a difference.",
  "Consistency is everything. Time to get one in.",
  "Your body is ready. Come get a session in.",
  "Don't break the streak - your workout is right here.",
];

export async function scheduleMissedWorkoutNudge(): Promise<void> {
  if (!isNotificationsSupported()) return;
  const { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') return;
  await cancelMissedWorkoutNudge();
  try {
    const body = NUDGE_BODIES[Math.floor(Math.random() * NUDGE_BODIES.length)];
    await Notifications.scheduleNotificationAsync({
      identifier: NUDGE_ID,
      content: {
        title: "Ready for today's workout?",
        body,
        sound: true,
        data: { screen: 'train' },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: NUDGE_INTERVAL_SECONDS,
        repeats: false,
      },
    });
  } catch {}
}

export async function cancelMissedWorkoutNudge(): Promise<void> {
  if (!isNotificationsSupported()) return;
  try {
    await Notifications.cancelScheduledNotificationAsync(NUDGE_ID);
  } catch {}
}

const STREAK_PROTECTION_ID = 'grow-streak-protection';

export async function scheduleStreakProtectionAlert(
  timeStr: string = '20:00',
  weeklyGoal: number = 2,
  weekCount: number = 0,
): Promise<void> {
  if (!isNotificationsSupported()) return;
  const { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') return;

  // Goal already met this week — no risk, cancel any existing alert.
  if (weekCount >= weeklyGoal) {
    await cancelStreakProtectionAlert();
    return;
  }

  // Only alert from Wednesday onwards (day 3) — Mon/Tue still have plenty of
  // the week ahead, so nagging is pointless and creates unnecessary anxiety.
  // Sun=0, Mon=1, Tue=2, Wed=3, Thu=4, Fri=5, Sat=6
  const dayOfWeek = new Date().getDay();
  const isEarlyWeek = dayOfWeek === 1 || dayOfWeek === 2; // Mon or Tue
  if (isEarlyWeek) {
    await cancelStreakProtectionAlert();
    return;
  }

  await cancelStreakProtectionAlert();
  const [hourStr, minuteStr] = timeStr.split(':');
  const hour = parseInt(hourStr, 10);
  const minute = parseInt(minuteStr ?? '0', 10);
  const remaining = weeklyGoal - weekCount;
  const body = remaining === 1
    ? "Just 1 more session this week to keep your streak alive. Don't stop now!"
    : `You need ${remaining} more sessions this week to protect your streak. Get one in now!`;
  try {
    await Notifications.scheduleNotificationAsync({
      identifier: STREAK_PROTECTION_ID,
      content: {
        title: '🔥 Your weekly streak is at risk!',
        body,
        sound: true,
        data: { screen: 'train' },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour,
        minute,
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
const BODYWEIGHT_INTERVAL_DAYS = 21;

export async function scheduleBodyweightReminder(
  bodyweightUpdatedAt: string | null,
  hasCompletedSessions: boolean,
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
