import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

const CLOCK_OUT_REMINDER_ID = 'clock-out-reminder';
const REMINDER_HOURS = 8;

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function requestNotificationPermission(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === 'granted') return true;
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

export async function scheduleClockOutReminder(clockInAt: string): Promise<void> {
  try {
    const granted = await requestNotificationPermission();
    if (!granted) return;

    await cancelClockOutReminder();

    const clockInMs = new Date(clockInAt).getTime();
    const reminderMs = clockInMs + REMINDER_HOURS * 60 * 60 * 1000;
    const now = Date.now();

    if (reminderMs <= now) return;

    await Notifications.scheduleNotificationAsync({
      identifier: CLOCK_OUT_REMINDER_ID,
      content: {
        title: "Don't forget to clock out",
        body: `You've been clocked in for ${REMINDER_HOURS} hours. Tap to review your timesheet.`,
        data: { screen: 'timesheets' },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: new Date(reminderMs),
      },
    });
  } catch {
    // Notifications are best-effort
  }
}

export async function cancelClockOutReminder(): Promise<void> {
  try {
    await Notifications.cancelScheduledNotificationAsync(CLOCK_OUT_REMINDER_ID);
  } catch {
    // ignore
  }
}
