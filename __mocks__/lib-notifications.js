module.exports = {
  __esModule: true,
  scheduleMissedWorkoutNudge: jest.fn(() => Promise.resolve()),
  cancelRestTimerNotification: jest.fn(() => Promise.resolve()),
  cancelStreakProtectionAlert: jest.fn(() => Promise.resolve()),
  REST_TIMER_NOTIF_ID: 'rest-timer',
  isNotificationsSupported: jest.fn(() => false),
  requestNotificationPermission: jest.fn(() => Promise.resolve(false)),
};
