import * as Notifications from 'expo-notifications';

export async function requestNotificationPermission(): Promise<boolean> {
  const result = await Notifications.requestPermissionsAsync();
  return result.granted;
}

export async function getNotificationPermissionStatus(): Promise<boolean> {
  const result = await Notifications.getPermissionsAsync();
  return result.granted;
}

/**
 * Daily review nudge ("Time to review!") at the user's chosen hour.
 * Deliberately not streak-framed — there is no streak-at-risk notification
 * in this product (FR20 amended, R2).
 */
export async function scheduleReviewReminder(hour: number, minute = 0): Promise<void> {
  try {
    await cancelAllNotifications();
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Time to review!',
        body: 'Your daily Japanese review is ready.',
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour,
        minute,
      },
    });
  } catch (cause) {
    if (__DEV__) {
      console.warn('[notifications] scheduleReviewReminder failed', cause);
    }
  }
}

export async function cancelAllNotifications(): Promise<void> {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch (cause) {
    if (__DEV__) {
      console.warn('[notifications] cancelAllNotifications failed', cause);
    }
  }
}
