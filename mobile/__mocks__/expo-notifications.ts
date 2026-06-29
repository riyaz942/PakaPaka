export const SchedulableTriggerInputTypes = {
  DAILY: 'daily',
  DATE: 'date',
  TIME_INTERVAL: 'timeInterval',
};

export const requestPermissionsAsync = jest.fn().mockResolvedValue({
  granted: true,
  status: 'granted',
});

export const getPermissionsAsync = jest.fn().mockResolvedValue({
  granted: false,
  status: 'undetermined',
});

export const scheduleNotificationAsync = jest.fn().mockResolvedValue('mock-notification-id');

export const cancelAllScheduledNotificationsAsync = jest.fn().mockResolvedValue(undefined);
