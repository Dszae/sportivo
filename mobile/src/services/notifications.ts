import * as Notifications from 'expo-notifications';
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const DISPATCHED_IMMEDIATE_KEY = 'sportivo_dispatched_immediate_keys';

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
      enableVibrate: true,
      showBadge: true,
    });

    await Notifications.setNotificationChannelAsync('match-moments', {
      name: 'Live Goals & Wickets',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 150, 100, 150],
      lightColor: '#c9f36b',
      sound: 'default',
      enableVibrate: true,
      showBadge: true,
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
 * Trigger immediate native haptic buzz
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
    const triggerMs = kickoffTimestamp - minutesBefore * 60 * 1000;
    const diffSec = Math.floor((triggerMs - Date.now()) / 1000);

    if (diffSec <= 0) {
      return null;
    }

    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: minutesBefore === 5 ? '🔔 Kickoff in 5 Minutes!' : '🏏 Matchday Reminder',
        body: `${matchTitle} starts soon! Watch live on Sportivo.`,
        data: { matchTitle, minutesBefore },
        channelId: 'match-alerts',
        sound: 'default',
      },
      trigger: {
        seconds: diffSec,
        channelId: 'match-alerts',
      } as any,
    });
    return id;
  } catch (error) {
    console.warn('[Notifications] Failed to schedule alert', error);
    return null;
  }
}

/**
 * Trigger immediate native notification for a live match event (wickets, 4s, 6s, milestones)
 */
export async function notifyLiveMoment(options: {
  key: string;
  title: string;
  body: string;
  type: 'wicket' | 'boundary' | 'kickoff' | 'milestone';
}): Promise<void> {
  try {
    const hasPermission = await requestNativeNotificationPermission();
    if (!hasPermission) return;

    // Check if this moment was already notified
    const raw = await AsyncStorage.getItem(DISPATCHED_IMMEDIATE_KEY);
    const sentKeys = new Set(raw ? JSON.parse(raw) : []);
    if (sentKeys.has(options.key)) return;

    sentKeys.add(options.key);
    await AsyncStorage.setItem(DISPATCHED_IMMEDIATE_KEY, JSON.stringify(Array.from(sentKeys)));

    if (options.type === 'wicket') {
      await triggerWicketHaptic();
    } else {
      await triggerGoalHaptic();
    }

    await Notifications.scheduleNotificationAsync({
      content: {
        title: options.title,
        body: options.body,
        data: { alertKey: options.key, type: options.type },
        channelId: 'match-moments',
        sound: 'default',
      },
      trigger: null, // immediate alert
    });
  } catch (e) {
    console.warn('[Notifications] notifyLiveMoment error:', e);
  }
}

/**
 * Automatically schedule reminders for all upcoming NPL matches and user's bookmarked matches
 */
export async function autoScheduleAllMatchAlerts(
  matches: Array<{ title: string; timestamp: number }>
): Promise<void> {
  try {
    const hasPermission = await requestNativeNotificationPermission();
    if (!hasPermission) return;

    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    const scheduledKeys = new Set(
      scheduled.map((s) => s.content.data?.alertKey).filter(Boolean)
    );

    const rawDispatched = await AsyncStorage.getItem(DISPATCHED_IMMEDIATE_KEY);
    const dispatchedKeys = new Set(rawDispatched ? JSON.parse(rawDispatched) : []);

    for (const match of matches) {
      if (!match.timestamp || !match.title) continue;
      const lower = match.title.toLowerCase();
      if (
        lower.includes('determined') ||
        lower.includes('qualifier') ||
        lower.includes('eliminator') ||
        lower.includes('place vs') ||
        lower.includes('tbd')
      ) {
        continue;
      }

      const now = Date.now();
      const diffMs = match.timestamp - now;

      // Skip completed / expired matches (older than 4 hours)
      if (diffMs < -4 * 60 * 60 * 1000) continue;

      // 1. If match is within the next 25 minutes AND has not yet started:
      // Fire an immediate heads-up alert ONLY ONCE (persisted in AsyncStorage)
      const immediateKey = `${match.title}-immediate`;
      if (diffMs > 0 && diffMs <= 25 * 60 * 1000 && !dispatchedKeys.has(immediateKey)) {
        dispatchedKeys.add(immediateKey);
        await AsyncStorage.setItem(DISPATCHED_IMMEDIATE_KEY, JSON.stringify(Array.from(dispatchedKeys)));

        await Notifications.scheduleNotificationAsync({
          content: {
            title: `🏏 Match Starting Soon! (${Math.round(diffMs / 60000)}m)`,
            body: `${match.title} begins soon! Tap to open live stream desk.`,
            data: { alertKey: immediateKey, matchTitle: match.title },
            channelId: 'match-alerts',
            sound: 'default',
          },
          trigger: null, // immediate
        });
      }

      // 2. Schedule 30-minute reminder
      const key30 = `${match.title}-30m`;
      const diffSec30 = Math.floor((match.timestamp - 30 * 60 * 1000 - now) / 1000);
      if (diffSec30 > 5 && !scheduledKeys.has(key30)) {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: `🏏 30m Reminder: ${match.title}`,
            body: `${match.title} kicks off in 30 minutes! Live coverage in Nepal Standard Time.`,
            data: { alertKey: key30, matchTitle: match.title },
            channelId: 'match-alerts',
            sound: 'default',
          },
          trigger: {
            seconds: diffSec30,
            channelId: 'match-alerts',
          } as any,
        });
      }

      // 3. Schedule 5-minute reminder
      const key5 = `${match.title}-5m`;
      const diffSec5 = Math.floor((match.timestamp - 5 * 60 * 1000 - now) / 1000);
      if (diffSec5 > 5 && !scheduledKeys.has(key5)) {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: `🔔 Kickoff in 5 Minutes!`,
            body: `${match.title} is starting now! Tap to watch verified live stream.`,
            data: { alertKey: key5, matchTitle: match.title },
            channelId: 'match-alerts',
            sound: 'default',
          },
          trigger: {
            seconds: diffSec5,
            channelId: 'match-alerts',
          } as any,
        });
      }
    }
  } catch (e) {
    console.warn('[Notifications] autoScheduleAllMatchAlerts error:', e);
  }
}
