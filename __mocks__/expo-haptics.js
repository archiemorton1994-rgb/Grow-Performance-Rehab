// notificationAsync and selectionAsync fire on the set-complete and feedback
// paths. They were absent until a test pressed those buttons for the first time
// and the component threw instead of advancing.
module.exports = {
  impactAsync: () => Promise.resolve(),
  notificationAsync: () => Promise.resolve(),
  selectionAsync: () => Promise.resolve(),
  ImpactFeedbackStyle: { Light: 'Light', Medium: 'Medium', Heavy: 'Heavy' },
  NotificationFeedbackType: { Success: 'Success', Warning: 'Warning', Error: 'Error' },
};
