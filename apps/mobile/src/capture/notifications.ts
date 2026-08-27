import { Platform } from "react-native";

/**
 * Local reminders — the only pings this app ever sends, and only because
 * the user asked it to hold something with a clock. No server involved.
 * Guarded load: the module ships with dev build 3; before that (and on
 * web), reminders are held in the vault but can't ring.
 */
interface NotificationsShape {
  requestPermissionsAsync(): Promise<{ granted: boolean }>;
  scheduleNotificationAsync(request: {
    content: { title: string; body: string };
    trigger: { type: "date"; date: Date };
  }): Promise<string>;
  setNotificationHandler(handler: {
    handleNotification: () => Promise<{
      shouldShowBanner: boolean;
      shouldShowList: boolean;
      shouldPlaySound: boolean;
      shouldSetBadge: boolean;
    }>;
  }): void;
}

function loadModule(): NotificationsShape | null {
  if (Platform.OS === "web") return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require("expo-notifications") as NotificationsShape;
  } catch {
    return null;
  }
}

const notifications = loadModule();

if (notifications) {
  notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false, // quiet by default — the comfort contract
      shouldSetBadge: false,
    }),
  });
}

export const remindersAvailable = notifications !== null;

/** Schedules the gentle ping. Returns false if unavailable or denied. */
export async function scheduleReminder(
  atMs: number,
  title: string,
  body: string,
): Promise<boolean> {
  if (!notifications || atMs <= Date.now()) return false;
  try {
    const { granted } = await notifications.requestPermissionsAsync();
    if (!granted) return false;
    await notifications.scheduleNotificationAsync({
      content: { title, body },
      trigger: { type: "date", date: new Date(atMs) },
    });
    return true;
  } catch {
    return false;
  }
}
