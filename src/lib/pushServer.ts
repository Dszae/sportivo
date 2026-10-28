import webpush from 'web-push';
import fs from 'node:fs';
import path from 'node:path';

export const VAPID_PUBLIC_KEY =
  process.env.PUBLIC_VAPID_KEY ||
  'BHJv_k24jWTdblPc5Ln9swdhLFOHk1k8GVjgRxVJwke6Q6jYg6EABMbMufv90XlsAwmeaKwHXshmFnjtXXLrM8s';

export const VAPID_PRIVATE_KEY =
  process.env.VAPID_PRIVATE_KEY ||
  'CZLvUKLonXs0PsC6JW4_Zt_PEP8E-_zYbUQDMIUmXho';

export const VAPID_SUBJECT =
  process.env.VAPID_SUBJECT || 'mailto:dipeshsapkota7@gmail.com';

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

export interface StoredSubscription {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
  preferences: {
    favoriteTeams: string[];
    starredMatches: string[];
    timeZone: string;
    notifications: {
      enabled: boolean;
      remind30Min: boolean;
      remind5Min: boolean;
      notifyKickoff: boolean;
      notifyGoalsWickets: boolean;
      notifyCards: boolean;
      notifyHalfTime: boolean;
      notifyFullTime: boolean;
    };
  };
  updatedAt: number;
}

// In-memory cache + file-based persistence for serverless/local resilience
const SUBS_FILE = path.resolve(process.cwd(), '.push-subscriptions.json');
let subscriptionsMemory: Map<string, StoredSubscription> = new Map();

function loadSubscriptions(): void {
  try {
    if (fs.existsSync(SUBS_FILE)) {
      const data = JSON.parse(fs.readFileSync(SUBS_FILE, 'utf-8'));
      if (Array.isArray(data)) {
        subscriptionsMemory = new Map(data.map((s) => [s.endpoint, s]));
      }
    }
  } catch {}
}

function persistSubscriptions(): void {
  try {
    const list = Array.from(subscriptionsMemory.values());
    fs.writeFileSync(SUBS_FILE, JSON.stringify(list, null, 2), 'utf-8');
  } catch {}
}

loadSubscriptions();

export function saveSubscription(sub: StoredSubscription): void {
  subscriptionsMemory.set(sub.endpoint, {
    ...sub,
    updatedAt: Date.now(),
  });
  persistSubscriptions();
}

export function removeSubscription(endpoint: string): void {
  if (subscriptionsMemory.delete(endpoint)) {
    persistSubscriptions();
  }
}

export function getAllSubscriptions(): StoredSubscription[] {
  return Array.from(subscriptionsMemory.values());
}

export interface PushPayload {
  title: string;
  message: string;
  matchTitle: string;
  matchUrl: string;
  category: string;
  key: string;
  type?: string;
  icon?: string;
}

/**
 * Sends a native Web Push message directly to a client endpoint (Google FCM / Mozilla / Apple)
 */
export async function sendWebPush(
  subscription: { endpoint: string; keys: { p256dh: string; auth: string } },
  payload: PushPayload
): Promise<boolean> {
  try {
    await webpush.sendNotification(
      subscription,
      JSON.stringify(payload),
      {
        TTL: 60 * 60, // 1 hour TTL
        urgency: 'high',
      }
    );
    return true;
  } catch (error: any) {
    // 404 or 410 indicates subscription has expired or user revoked browser permission
    if (error?.statusCode === 404 || error?.statusCode === 410) {
      removeSubscription(subscription.endpoint);
    }
    return false;
  }
}

/**
 * Broadcasts an alert to all subscribers whose watchlist or starred matches match this event
 */
export async function broadcastMatchPush(alert: {
  key: string;
  type: string;
  title: string;
  message: string;
  matchTitle: string;
  matchUrl: string;
  category: string;
  teams?: string[];
  slug?: string;
}): Promise<number> {
  const subscribers = getAllSubscriptions();
  if (subscribers.length === 0) return 0;

  const matchTitleLower = alert.matchTitle.toLowerCase();
  const alertTeams = alert.teams ? alert.teams.map((t) => t.toLowerCase()) : [];
  let sentCount = 0;

  const promises = subscribers.map(async (sub) => {
    const prefs = sub.preferences;
    if (!prefs || !prefs.notifications || prefs.notifications.enabled === false) {
      return;
    }

    // Check notification type filter
    const notifs = prefs.notifications;
    if (alert.type === '5min_warning' && !notifs.remind5Min) return;
    if (alert.type === '30min_warning' && !notifs.remind30Min) return;
    if (alert.type === 'kickoff' && !notifs.notifyKickoff) return;
    if ((alert.type === 'goal' || alert.type === 'equalizer' || alert.type === 'wicket') && !notifs.notifyGoalsWickets) return;
    if (alert.type === 'red_card' && !notifs.notifyCards) return;
    if ((alert.type === 'half_time' || alert.type === 'innings_break') && !notifs.notifyHalfTime) return;
    if ((alert.type === 'full_time' || alert.type === 'match_result') && !notifs.notifyFullTime) return;

    // Check if user follows this match via Starred Matches or Favorite Teams
    let isInterested = false;

    // 1. Check starred matches
    if (alert.slug && prefs.starredMatches && prefs.starredMatches.includes(alert.slug)) {
      isInterested = true;
    }

    // 2. Check favorite teams
    if (!isInterested && prefs.favoriteTeams && prefs.favoriteTeams.length > 0) {
      for (const favTeam of prefs.favoriteTeams) {
        const favLower = favTeam.toLowerCase();
        if (matchTitleLower.includes(favLower) || alertTeams.some((t) => t.includes(favLower))) {
          isInterested = true;
          break;
        }
      }
    }

    if (isInterested) {
      const ok = await sendWebPush(sub, {
        title: alert.title,
        message: alert.message,
        matchTitle: alert.matchTitle,
        matchUrl: alert.matchUrl,
        category: alert.category,
        key: alert.key,
        type: alert.type,
      });
      if (ok) sentCount++;
    }
  });

  await Promise.allSettled(promises);
  return sentCount;
}
