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
      title: 'Grow — Time to Train',
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

const NUDGE_ID = 'grow-missed-workout';
const NUDGE_INTERVAL_SECONDS = 72000; // 20 hours

const NUDGE_BODIES = [
  "Ready for today's session? Your next workout is waiting.",
  "You haven't trained today. Even 30 minutes makes a difference.",
  "Consistency is everything. Time to get one in.",
  "Your body is ready. Come get a session in.",
  "Don't break the streak — your workout is right here.",
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

export const REST_TIMER_NOTIF_ID = 'grow-rest-timer';

export async function cancelRestTimerNotification(): Promise<void> {
  if (!isNotificationsSupported()) return;
  try {
    await Notifications.cancelScheduledNotificationAsync(REST_TIMER_NOTIF_ID);
  } catch {}
}
