import * as Notifications from 'expo-notifications';
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

// Configure foreground notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldVibrate: true,
  }),
});

/**
 * Configure native Android notification channels
 */
export async function setupNotificationChannels(): Promise<void> {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('match-alerts', {
      name: 'Match Alerts & Kickoffs',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#c9f36b',
      sound: 'default',
    });

    await Notifications.setNotificationChannelAsync('match-moments', {
      name: 'Live Goals & Wickets',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 150, 100, 150],
      lightColor: '#c9f36b',
      sound: 'default',
    });
  }
}

/**
 * Request native notification permissions
 */
export async function requestNativeNotificationPermission(): Promise<boolean> {
  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus === 'granted') {
      await setupNotificationChannels();
      return true;
    }
    return false;
  } catch (error) {
    console.warn('[Notifications] Failed to request permissions', error);
    return false;
  }
}

/**
 * Trigger immediate native haptic buzz (used for goals, wickets, and user interactions)
 */
export async function triggerGoalHaptic(): Promise<void> {
  try {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  } catch {}
}

export async function triggerWicketHaptic(): Promise<void> {
  try {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  } catch {}
}

export async function triggerButtonHaptic(): Promise<void> {
  try {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  } catch {}
}

/**
 * Schedule a local device kickoff warning
 */
export async function scheduleMatchKickoffNotification(
  matchTitle: string,
  kickoffTimestamp: number,
  minutesBefore: number = 5
): Promise<string | null> {
  try {
    const triggerDate = new Date(kickoffTimestamp - minutesBefore * 60 * 1000);
    if (triggerDate.getTime() <= Date.now()) {
      return null;
    }

    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: minutesBefore === 5 ? '🔔 Kickoff in 5 Minutes!' : '⚽ Matchday Reminder',
        body: `${matchTitle} starts soon! Watch live on Sportivo.`,
        data: { matchTitle },
        channelId: 'match-alerts',
      },
      trigger: triggerDate,
    });
    return id;
  } catch (error) {
    console.warn('[Notifications] Failed to schedule alert', error);
    return null;
  }
}
