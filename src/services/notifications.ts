import * as Notifications from "expo-notifications";
import { MealReminderTimes } from "../types";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

const MEAL_INFO: Record<keyof MealReminderTimes, { title: string; body: string }> = {
  breakfast: { title: "Good morning! 🌅", body: "Have you tracked your breakfast yet?" },
  lunch: { title: "Lunch time! ☀️", body: "Don't forget to log your lunch." },
  dinner: { title: "Dinner time! 🌙", body: "Snap a photo of your dinner to stay on track." },
  evening: { title: "Daily review 📊", body: "Check how you did today. You're building healthy habits!" },
};

const DEFAULT_TIMES: MealReminderTimes = {
  breakfast: { hour: 8, minute: 0, enabled: true },
  lunch: { hour: 12, minute: 30, enabled: true },
  dinner: { hour: 18, minute: 30, enabled: true },
  evening: { hour: 20, minute: 0, enabled: false },
};

export async function requestPermissions(): Promise<boolean> {
  const { status } = await Notifications.requestPermissionsAsync();
  return status === "granted";
}

export async function scheduleNotifications(times: MealReminderTimes = DEFAULT_TIMES): Promise<void> {
  await cancelAllNotifications();
  const granted = await requestPermissions();
  if (!granted) return;

  for (const key of Object.keys(times) as Array<keyof MealReminderTimes>) {
    const slot = times[key];
    if (!slot.enabled) continue;
    const info = MEAL_INFO[key];
    await Notifications.scheduleNotificationAsync({
      content: { title: info.title, body: info.body },
      trigger: { hour: slot.hour, minute: slot.minute, repeats: true } as any,
    });
  }
}

export async function cancelAllNotifications(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
}

export async function sendStreakNotification(streakDays: number): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: `🔥 ${streakDays}-day streak!`,
      body:
        streakDays >= 7
          ? "Incredible! A whole week of healthy tracking. Keep it going!"
          : streakDays >= 3
          ? `${streakDays} days in a row! You're building a great habit.`
          : `Nice! ${streakDays} days logged. Every day counts!`,
    },
    trigger: null,
  });
}

export async function sendTestNotification(): Promise<void> {
  const granted = await requestPermissions();
  if (!granted) return;
  await Notifications.scheduleNotificationAsync({
    content: { title: "Test Notification 🔔", body: "Push notifications are working!" },
    trigger: null,
  });
}
