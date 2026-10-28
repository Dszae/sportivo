import { loadUserPreferences, type UserPreferences } from './preferences';
import type { NplMatch } from './data/nplData';
import type { Match } from './sportivo';

export interface NotificationAlert {
  id: string;
  type: '5min_warning' | 'kickoff' | 'key_moment' | 'match_result';
  title: string;
  message: string;
  matchTitle: string;
  matchUrl: string;
  category: string;
  badgeText?: string;
  timestamp: number;
  read: boolean;
}

const DISPATCHED_STORAGE_KEY = 'sportivo_dispatched_alerts_v1';
const HISTORY_STORAGE_KEY = 'sportivo_notification_history_v1';
const SCORE_CACHE_KEY = 'sportivo_last_known_scores_v1';

// Web Audio API notification chime (no external audio assets required)
export function playNotificationChime(): void {
  if (typeof window === 'undefined') return;
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.type = 'sine';
    const now = ctx.currentTime;
    // Pleasant high-pitched two-tone chime (D5 -> A5)
    osc.frequency.setValueAtTime(587.33, now);
    osc.frequency.setValueAtTime(880.0, now + 0.12);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.exponentialRampToValueAtTime(0.12, now + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

    osc.start(now);
    osc.stop(now + 0.42);
  } catch {
    // Audio context may be restricted by autoplay policy before first gesture
  }
}

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'denied';
  }
  try {
    const permission = await Notification.requestPermission();
    window.dispatchEvent(new CustomEvent('sportivo:notification-permission-changed', { detail: permission }));
    return permission;
  } catch {
    return 'denied';
  }
}

export function getNotificationPermission(): NotificationPermission {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'denied';
  }
  return Notification.permission;
}

function getDispatchedAlerts(): Record<string, number> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(DISPATCHED_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function recordAlertDispatched(key: string): void {
  if (typeof window === 'undefined') return;
  try {
    const records = getDispatchedAlerts();
    records[key] = Date.now();
    // Prune alerts older than 7 days
    const cutoff = Date.now() - 7 * 86400000;
    for (const k of Object.keys(records)) {
      if (records[k] < cutoff) delete records[k];
    }
    localStorage.setItem(DISPATCHED_STORAGE_KEY, JSON.stringify(records));
  } catch {}
}

export function getNotificationHistory(): NotificationAlert[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(HISTORY_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveNotificationHistory(list: NotificationAlert[]): void {
  if (typeof window === 'undefined') return;
  try {
    // Cap at most recent 40 notifications
    const trimmed = list.slice(0, 40);
    localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(trimmed));
    window.dispatchEvent(new CustomEvent('sportivo:notifications-updated', { detail: trimmed }));
  } catch {}
}

export function markAllNotificationsAsRead(): void {
  const history = getNotificationHistory();
  const updated = history.map((item) => ({ ...item, read: true }));
  saveNotificationHistory(updated);
}

export function clearNotificationHistory(): void {
  saveNotificationHistory([]);
}

/**
 * Dispatches an alert through both Browser Web Notification and In-App Toast
 */
export function dispatchNotification(params: {
  key: string;
  type: NotificationAlert['type'];
  title: string;
  message: string;
  matchTitle: string;
  matchUrl: string;
  category: string;
  badgeText?: string;
}): void {
  const { key, type, title, message, matchTitle, matchUrl, category, badgeText } = params;
  const dispatched = getDispatchedAlerts();
  if (dispatched[key]) return; // Already sent

  recordAlertDispatched(key);

  const prefs = loadUserPreferences();
  if (prefs.notifications.soundEnabled) {
    playNotificationChime();
  }

  // 1. Browser Native Push Notification (if allowed)
  if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
    try {
      const n = new Notification(title, {
        body: message,
        icon: '/icon-192x192.png',
        badge: '/favicon-48x48.png',
        tag: key,
      });
      n.onclick = () => {
        window.focus();
        window.location.href = matchUrl;
      };
    } catch {}
  }

  // 2. Add to in-app history
  const alertItem: NotificationAlert = {
    id: `${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
    type,
    title,
    message,
    matchTitle,
    matchUrl,
    category,
    badgeText,
    timestamp: Date.now(),
    read: false,
  };

  const currentHistory = getNotificationHistory();
  saveNotificationHistory([alertItem, ...currentHistory]);

  // 3. Dispatch in-app live toast event
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('sportivo:live-toast', { detail: alertItem }));
  }
}

/**
 * Determines whether a match matches any of the user's favorite teams or starred matches
 */
export function isMatchPreferred(
  matchTitle: string,
  matchSlug: string,
  team1?: string,
  team2?: string,
  prefs?: UserPreferences
): boolean {
  const p = prefs || loadUserPreferences();
  // Check starred matches
  if (p.starredMatches.includes(matchSlug)) return true;

  // Check favorite teams
  if (!p.favoriteTeams || p.favoriteTeams.length === 0) return false;

  const titleLower = matchTitle.toLowerCase();
  const t1Lower = (team1 || '').toLowerCase();
  const t2Lower = (team2 || '').toLowerCase();

  return p.favoriteTeams.some((fav) => {
    const f = fav.toLowerCase().trim();
    if (!f) return false;
    return titleLower.includes(f) || t1Lower.includes(f) || t2Lower.includes(f);
  });
}

/**
 * Checks active and upcoming matches against user preferences and triggers notifications
 */
export function evaluateMatchesForNotifications(
  sportsMatches: Record<string, Match[]>,
  nplMatches: NplMatch[] = []
): void {
  if (typeof window === 'undefined') return;
  const prefs = loadUserPreferences();
  if (!prefs.notifications.enabled) return;

  const now = Date.now();

  // Evaluate NPL Matches
  for (const match of nplMatches) {
    const isPref = isMatchPreferred(
      `${match.team1.name} vs ${match.team2.name}`,
      `npl-match-${match.matchNumber}`,
      match.team1.name,
      match.team2.name,
      prefs
    );

    if (!isPref) continue;

    const matchTitle = `${match.team1.name} vs ${match.team2.name}`;
    const matchUrl = `/npl/`;

    // 1. Kickoff 5-Minute Warning
    if (prefs.notifications.notifyKickoff5Min && match.status === 'UPCOMING') {
      const kickoffMs = Date.parse(`${match.date}T${match.timeUtc.replace(' UTC', ':00Z')}`);
      if (!isNaN(kickoffMs)) {
        const diffMinutes = (kickoffMs - now) / 60000;
        // Trigger if between 0 and 5 minutes before start
        if (diffMinutes > 0 && diffMinutes <= 5.5) {
          dispatchNotification({
            key: `5min:npl:${match.id}`,
            type: '5min_warning',
            title: `⚡ NPL Match Starting in 5 Mins!`,
            message: `${matchTitle} starts at ${match.time}. Venue: TU Cricket Ground. Watch live stream on Sportivo!`,
            matchTitle,
            matchUrl,
            category: 'cricket',
            badgeText: '5 MIN WARNING',
          });
        }
      }
    }

    // 2. Match Started / LIVE Alert
    if (prefs.notifications.notifyMatchStart && match.status === 'LIVE') {
      dispatchNotification({
        key: `start:npl:${match.id}`,
        type: 'kickoff',
        title: `🔴 NPL MATCH IS LIVE!`,
        message: `${matchTitle} is now underway! Tap to watch live HD broadcast & real-time ball scores.`,
        matchTitle,
        matchUrl,
        category: 'cricket',
        badgeText: 'LIVE NOW',
      });
    }

    // 3. Key Moments (Wickets & Final Match Result)
    if (prefs.notifications.notifyKeyMoments) {
      // Check for match conclusion
      if (match.status === 'COMPLETED' && match.winner) {
        dispatchNotification({
          key: `result:npl:${match.id}`,
          type: 'match_result',
          title: `🏆 NPL Match Concluded`,
          message: `${matchTitle}: ${match.winner}! Full scorecard available.`,
          matchTitle,
          matchUrl,
          category: 'cricket',
          badgeText: 'FINAL RESULT',
        });
      }

      // Check for wickets
      const checkWickets = (teamName: string, scoreStr?: string) => {
        if (!scoreStr) return;
        const matchWickets = scoreStr.match(/\/(\d+)/);
        if (!matchWickets) return;
        const wickets = parseInt(matchWickets[1], 10);
        if (wickets > 0 && wickets <= 10) {
          dispatchNotification({
            key: `wicket:npl:${match.id}:${teamName}:${wickets}`,
            type: 'key_moment',
            title: `🏏 WICKET! (${teamName})`,
            message: `${teamName} is now ${scoreStr} in ${matchTitle}!`,
            matchTitle,
            matchUrl,
            category: 'cricket',
            badgeText: 'WICKET',
          });
        }
      };

      if (match.status === 'LIVE') {
        checkWickets(match.team1.name, match.team1Score);
        checkWickets(match.team2.name, match.team2Score);
      }
    }
  }

  // Evaluate other Sports (Football, Cricket, Basketball)
  for (const [category, matches] of Object.entries(sportsMatches)) {
    for (const match of matches) {
      const matchTitle = match.title;
      const matchUrl = `/${category}/match/${match.slug}/`;

      const isPref = isMatchPreferred(matchTitle, match.slug, undefined, undefined, prefs);
      if (!isPref) continue;

      const isLive = match.status === 'LIVE' || match.isLive;

      // 1. Kickoff 5-Minute Warning
      if (prefs.notifications.notifyKickoff5Min && !isLive && match.timestamp) {
        const diffMinutes = (match.timestamp - now) / 60000;
        if (diffMinutes > 0 && diffMinutes <= 5.5) {
          dispatchNotification({
            key: `5min:sport:${match.slug}`,
            type: '5min_warning',
            title: `⚡ Kickoff in 5 Minutes!`,
            message: `${matchTitle} (${category.toUpperCase()}) starts in 5 minutes! Multi-server streams ready.`,
            matchTitle,
            matchUrl,
            category,
            badgeText: '5 MIN WARNING',
          });
        }
      }

      // 2. Match Started / LIVE Alert
      if (prefs.notifications.notifyMatchStart && isLive) {
        dispatchNotification({
          key: `start:sport:${match.slug}`,
          type: 'kickoff',
          title: `🔴 MATCH LIVE NOW!`,
          message: `${matchTitle} has kicked off! Tap to watch uninterrupted on Sportivo.`,
          matchTitle,
          matchUrl,
          category,
          badgeText: 'LIVE NOW',
        });
      }
    }
  }
}
