import { loadUserPreferences, type UserPreferences } from './preferences';
import type { NplMatch } from './data/nplData';
import type { Match } from './sportivo';

export type NotificationType =
  | '30min_warning'
  | '5min_warning'
  | 'kickoff'
  | 'goal'
  | 'equalizer'
  | 'red_card'
  | 'half_time'
  | 'second_half'
  | 'late_update'
  | 'full_time'
  | 'wicket'
  | 'innings_break'
  | 'match_result'
  | 'rescheduled';

export type FilterCategory = 'all' | 'matches' | 'moments' | 'results';

export interface NotificationAlert {
  id: string;
  type: NotificationType;
  filterCategory: 'matches' | 'moments' | 'results';
  title: string;
  message: string;
  matchTitle: string;
  matchUrl: string;
  category: string;
  competition?: string;
  venue?: string;
  kickoffFormatted?: string;
  score?: string;
  badgeText?: string;
  timestamp: number;
  read: boolean;
}

interface MatchStateCache {
  kickoffTimestamp?: number;
  status?: string;
  score?: string;
  homeScore?: number;
  awayScore?: number;
  wicketsHome?: number;
  wicketsAway?: number;
  halfTimeAlerted?: boolean;
  secondHalfAlerted?: boolean;
}

const DISPATCHED_STORAGE_KEY = 'sportivo_dispatched_alerts_v2';
const HISTORY_STORAGE_KEY = 'sportivo_notification_history_v2';
const MATCH_STATE_STORAGE_KEY = 'sportivo_match_states_v2';

/**
 * Format timestamp in user's preferred timezone (e.g. "Today · 8:45 PM" or "8:45 PM Nepal Time")
 */
export function formatLocalKickoff(timestamp: number, timeZone: string = 'Asia/Kathmandu'): string {
  try {
    const timeStr = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).format(new Date(timestamp));

    const tzLabel = timeZone === 'Asia/Kathmandu' ? 'Nepal Time' : timeZone.split('/')[1] || '';
    return `${timeStr} ${tzLabel}`.trim();
  } catch {
    return '8:45 PM Nepal Time';
  }
}

// Web Audio API notification chime (crisp high-pitched D5 -> A5 tone)
export function playNotificationChime(): void {
  if (typeof window === 'undefined') return;
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.type = 'sine';
    const now = ctx.currentTime;
    osc.frequency.setValueAtTime(587.33, now);
    osc.frequency.setValueAtTime(880.0, now + 0.12);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.exponentialRampToValueAtTime(0.12, now + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

    osc.start(now);
    osc.stop(now + 0.42);
  } catch {}
}

export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Subscribes user's device to background Web Push (VAPID) so alerts arrive even when website is closed
 */
export async function subscribeToPushService(sendTest: boolean = false): Promise<boolean> {
  if (
    typeof window === 'undefined' ||
    !('serviceWorker' in navigator) ||
    !('PushManager' in window)
  ) {
    return false;
  }

  try {
    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();

    if (!sub) {
      const res = await fetch('/api/push/subscribe');
      const { publicKey } = await res.json();
      const applicationServerKey = urlBase64ToUint8Array(publicKey);
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey,
      });
    }

    // Register Chromium Periodic Background Sync if available
    if ('periodicSync' in reg) {
      try {
        const periodicSync = (reg as any).periodicSync;
        await periodicSync.register('sportivo-match-check', {
          minInterval: 60 * 1000,
        });
      } catch {}
    }

    // Register subscription on backend with user's current watchlist
    const prefs = loadUserPreferences();
    await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subscription: sub,
        preferences: prefs,
        test: sendTest,
      }),
    });

    return true;
  } catch (err) {
    console.warn('[Sportivo Push] Background subscription failed:', err);
    return false;
  }
}

/**
 * Synchronizes user watchlist updates to the push server so background alerts match latest favorites
 */
export async function syncPushPreferences(): Promise<void> {
  if (
    typeof window === 'undefined' ||
    !('serviceWorker' in navigator) ||
    !('PushManager' in window)
  ) {
    return;
  }
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      const prefs = loadUserPreferences();
      await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subscription: sub,
          preferences: prefs,
        }),
      });
    }
  } catch {}
}

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'denied';
  }
  try {
    const permission = await Notification.requestPermission();
    window.dispatchEvent(
      new CustomEvent('sportivo:notification-permission-changed', { detail: permission })
    );

    if (permission === 'granted') {
      // Automatically register Web Push subscription for closed-browser delivery
      await subscribeToPushService(false);
    }

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
    const cutoff = Date.now() - 7 * 86400000;
    for (const k of Object.keys(records)) {
      if (records[k] < cutoff) delete records[k];
    }
    localStorage.setItem(DISPATCHED_STORAGE_KEY, JSON.stringify(records));
  } catch {}
}

function clearDispatchedAlert(keyPrefix: string): void {
  if (typeof window === 'undefined') return;
  try {
    const records = getDispatchedAlerts();
    for (const k of Object.keys(records)) {
      if (k.startsWith(keyPrefix)) delete records[k];
    }
    localStorage.setItem(DISPATCHED_STORAGE_KEY, JSON.stringify(records));
  } catch {}
}

function getMatchStatesCache(): Record<string, MatchStateCache> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(MATCH_STATE_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveMatchState(matchId: string, state: Partial<MatchStateCache>): void {
  if (typeof window === 'undefined') return;
  try {
    const current = getMatchStatesCache();
    current[matchId] = { ...(current[matchId] || {}), ...state };
    localStorage.setItem(MATCH_STATE_STORAGE_KEY, JSON.stringify(current));
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
    const trimmed = list.slice(0, 50);
    localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(trimmed));
    window.dispatchEvent(new CustomEvent('sportivo:notifications-updated', { detail: trimmed }));
  } catch {}
}

export function markNotificationAsRead(id: string): void {
  const history = getNotificationHistory();
  const updated = history.map((item) => (item.id === id ? { ...item, read: true } : item));
  saveNotificationHistory(updated);
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
 * Dispatches a match alert across Native Browser Push and In-App Notification Center
 */
export function dispatchNotification(params: {
  key: string;
  type: NotificationType;
  filterCategory: 'matches' | 'moments' | 'results';
  title: string;
  message: string;
  matchTitle: string;
  matchUrl: string;
  category: string;
  competition?: string;
  venue?: string;
  kickoffFormatted?: string;
  score?: string;
  badgeText?: string;
}): void {
  const {
    key,
    type,
    filterCategory,
    title,
    message,
    matchTitle,
    matchUrl,
    category,
    competition,
    venue,
    kickoffFormatted,
    score,
    badgeText,
  } = params;

  const dispatched = getDispatchedAlerts();
  if (dispatched[key]) return; // Deduplicate
  recordAlertDispatched(key);

  const prefs = loadUserPreferences();
  if (prefs.notifications.soundEnabled) {
    playNotificationChime();
  }

  // 1. Native Push Notification (Dispatched via Service Worker with vibration & action buttons)
  if (
    typeof window !== 'undefined' &&
    'Notification' in window &&
    Notification.permission === 'granted'
  ) {
    const notifOptions: NotificationOptions = {
      body: `${matchTitle}\n${message}`,
      icon: '/icon-192x192.png',
      badge: '/favicon-48x48.png',
      tag: key,
      data: { url: matchUrl },
      renotify: true,
      requireInteraction: true,
    };

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready
        .then((reg) => {
          reg.showNotification(title, notifOptions).catch(() => {
            try {
              new Notification(title, notifOptions);
            } catch {}
          });
        })
        .catch(() => {
          try {
            new Notification(title, notifOptions);
          } catch {}
        });
    } else {
      try {
        new Notification(title, notifOptions);
      } catch {}
    }
  }

  // 2. In-App Notification Center Record
  const alertItem: NotificationAlert = {
    id: `${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
    type,
    filterCategory,
    title,
    message,
    matchTitle,
    matchUrl,
    category,
    competition,
    venue,
    kickoffFormatted,
    score,
    badgeText,
    timestamp: Date.now(),
    read: false,
  };

  const currentHistory = getNotificationHistory();
  saveNotificationHistory([alertItem, ...currentHistory]);
}

/**
 * Checks whether a match corresponds to user's favorite teams or starred matches
 */
export function isMatchPreferred(
  matchTitle: string,
  matchSlug: string,
  team1?: string,
  team2?: string,
  prefs?: UserPreferences
): boolean {
  const p = prefs || loadUserPreferences();
  if (p.starredMatches.includes(matchSlug)) return true;

  // NPL matches are premier regional events — notify by default if notifications are enabled
  if (matchSlug.startsWith('npl-') || matchTitle.toLowerCase().includes('npl') || matchTitle.toLowerCase().includes('pokhara') || matchTitle.toLowerCase().includes('sudurpaschim')) {
    return true;
  }

  // If user hasn't configured specific favorite teams, default to notifying all active matches
  if (!p.favoriteTeams || p.favoriteTeams.length === 0) {
    return true;
  }

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
 * Comprehensive Match Evaluator for Pre-match, Kickoffs, Moments, and Results
 */
export function evaluateMatchesForNotifications(
  sportsMatches: Record<string, Match[]>,
  nplMatches: NplMatch[] = []
): void {
  if (typeof window === 'undefined') return;
  const prefs = loadUserPreferences();
  if (!prefs.notifications.enabled) return;

  const now = Date.now();
  const statesCache = getMatchStatesCache();
  const userTz = prefs.timeZone || 'Asia/Kathmandu';

  // --- 1. Evaluate NPL Cricket Matches ---
  for (const match of nplMatches) {
    const matchId = `npl-${match.matchNumber}`;
    const home = match.homeTeam || (match as any).team1?.name || (match as any).team1 || 'Home Team';
    const away = match.awayTeam || (match as any).team2?.name || (match as any).team2 || 'Away Team';
    const matchTitle = `${home} vs ${away}`;
    const matchUrl = `/npl/`;
    const venue = match.venue || 'Tribhuvan University Cricket Ground, Kirtipur';
    const competition = match.competition || 'Nepal Premier League (NPL) 2026';

    const isPref = isMatchPreferred(
      matchTitle,
      `npl-match-${match.matchNumber}`,
      home,
      away,
      prefs
    );
    if (!isPref) continue;

    // Rescheduling & Timezone Calculation
    const kickoffMs = Date.parse(`${match.date}T${match.timeUtc.replace(' UTC', ':00Z')}`);
    const lastKickoff = statesCache[matchId]?.kickoffTimestamp;

    if (!isNaN(kickoffMs)) {
      if (lastKickoff && Math.abs(kickoffMs - lastKickoff) > 10 * 60000) {
        // Rescheduled! Reset pre-match alert keys and notify
        clearDispatchedAlert(`30min:${matchId}`);
        clearDispatchedAlert(`5min:${matchId}`);
        dispatchNotification({
          key: `reschedule:${matchId}:${kickoffMs}`,
          type: 'rescheduled',
          filterCategory: 'matches',
          title: '📅 Match Rescheduled',
          message: `${matchTitle} has been rescheduled to ${formatLocalKickoff(kickoffMs, userTz)}.`,
          matchTitle,
          matchUrl,
          category: 'cricket',
          competition,
          kickoffFormatted: formatLocalKickoff(kickoffMs, userTz),
          badgeText: 'RESCHEDULED',
        });
      }
      saveMatchState(matchId, { kickoffTimestamp: kickoffMs });

      const diffMinutes = (kickoffMs - now) / 60000;

      // 1. Starting Soon Heads-Up Alert (if user opens site within 25 minutes of kickoff)
      if (diffMinutes > 0 && diffMinutes <= 25) {
        dispatchNotification({
          key: `starting-soon:${matchId}`,
          type: '5min_warning',
          filterCategory: 'matches',
          title: `🏏 Match Starting Soon (${Math.max(1, Math.round(diffMinutes))}m)!`,
          message: `${matchTitle} starts at ${formatLocalKickoff(kickoffMs, userTz)}! Live stream desk is ready.`,
          matchTitle,
          matchUrl,
          category: 'cricket',
          competition,
          venue,
          kickoffFormatted: formatLocalKickoff(kickoffMs, userTz),
          badgeText: `${Math.max(1, Math.round(diffMinutes))}M TO START`,
        });
      }

      // 2. 30 Minutes Before Kickoff
      if (prefs.notifications.remind30Min && diffMinutes > 20 && diffMinutes <= 35) {
        dispatchNotification({
          key: `30min:${matchId}`,
          type: '30min_warning',
          filterCategory: 'matches',
          title: '🏏 NPL Matchday Reminder (30m)',
          message: `${matchTitle} kicks off in 30 minutes!`,
          matchTitle,
          matchUrl,
          category: 'cricket',
          competition,
          venue,
          kickoffFormatted: formatLocalKickoff(kickoffMs, userTz),
          badgeText: '30 MIN REMINDER',
        });
      }

      // 3. 5 Minutes Before Kickoff
      if (prefs.notifications.remind5Min && diffMinutes > 0 && diffMinutes <= 8) {
        dispatchNotification({
          key: `5min:${matchId}`,
          type: '5min_warning',
          filterCategory: 'matches',
          title: '🔔 Kickoff in 5 Minutes!',
          message: `${match.team1.name} 🆚 ${match.team2.name} is starting now!`,
          matchTitle: `${match.team1.name} 🆚 ${match.team2.name}`,
          matchUrl,
          category: 'cricket',
          competition,
          venue,
          kickoffFormatted: formatLocalKickoff(kickoffMs, userTz),
          badgeText: '5 MIN WARNING',
        });
      }
    }

    // Match Kickoff (Live Alert)
    if (prefs.notifications.notifyKickoff && match.status === 'LIVE') {
      dispatchNotification({
        key: `start:${matchId}`,
        type: 'kickoff',
        filterCategory: 'matches',
        title: '🟢 Match Live!',
        message: `${matchTitle} is now underway! Follow ball-by-ball score & stream.`,
        matchTitle,
        matchUrl,
        category: 'cricket',
        competition,
        badgeText: 'LIVE NOW',
      });
    }

    // Cricket Key Moments: Wickets, Boundaries & Score Milestones
    if (match.status === 'LIVE' && prefs.notifications.notifyGoalsWickets) {
      const homeScore = match.homeScore || (match as any).team1Score;
      const awayScore = match.awayScore || (match as any).team2Score;

      const checkWickets = (teamName: string, scoreStr?: string, isHome: boolean = true) => {
        if (!scoreStr) return;
        const matchWickets = scoreStr.match(/\/(\d+)/);
        if (!matchWickets) return;
        const currentWickets = parseInt(matchWickets[1], 10);
        const lastWickets = isHome
          ? statesCache[matchId]?.wicketsHome ?? 0
          : statesCache[matchId]?.wicketsAway ?? 0;

        if (currentWickets > lastWickets && currentWickets <= 10) {
          saveMatchState(matchId, isHome ? { wicketsHome: currentWickets } : { wicketsAway: currentWickets });
          dispatchNotification({
            key: `wicket:${matchId}:${teamName}:${currentWickets}`,
            type: 'wicket',
            filterCategory: 'moments',
            title: `🏏 WICKET! (${teamName})`,
            message: `${teamName} loses a wicket! Now ${scoreStr} in ${matchTitle}!`,
            matchTitle,
            matchUrl,
            category: 'cricket',
            competition,
            score: scoreStr,
            badgeText: 'WICKET',
          });
        }
      };

      const checkScores = (teamName: string, scoreStr?: string, isHome: boolean = true) => {
        if (!scoreStr) return;
        const runsMatch = scoreStr.match(/^(\d+)/);
        if (!runsMatch) return;
        const currentRuns = parseInt(runsMatch[1], 10);
        const lastRuns = isHome
          ? (statesCache[matchId] as any)?.runsHome ?? 0
          : (statesCache[matchId] as any)?.runsAway ?? 0;

        if (currentRuns > lastRuns && lastRuns > 0) {
          const runDiff = currentRuns - lastRuns;
          if (runDiff === 4 || runDiff === 6) {
            dispatchNotification({
              key: `boundary:${matchId}:${teamName}:${currentRuns}`,
              type: 'goal',
              filterCategory: 'moments',
              title: runDiff === 6 ? `💥 MAXIMUM SIX! (${teamName})` : `🏏 FOUR BOUNDARY! (${teamName})`,
              message: `${teamName} hits a ${runDiff === 6 ? 'huge SIX' : 'cracking FOUR'}! Now ${scoreStr}`,
              matchTitle,
              matchUrl,
              category: 'cricket',
              competition,
              score: scoreStr,
              badgeText: runDiff === 6 ? 'SIX' : 'FOUR',
            });
          }
        }
        if (currentRuns > 0) {
          saveMatchState(matchId, isHome ? ({ runsHome: currentRuns } as any) : ({ runsAway: currentRuns } as any));
        }
      };

      checkWickets(home, homeScore, true);
      checkWickets(away, awayScore, false);
      checkScores(home, homeScore, true);
      checkScores(away, awayScore, false);
    }

    // Full-Time / Final Match Result
    if (prefs.notifications.notifyFullTime && match.status === 'COMPLETED' && match.winner) {
      dispatchNotification({
        key: `result:${matchId}`,
        type: 'full_time',
        filterCategory: 'results',
        title: '🏆 Match Concluded',
        message: `Final Result: ${match.winner}! Full scorecard available.`,
        matchTitle,
        matchUrl,
        category: 'cricket',
        competition,
        badgeText: 'FINAL RESULT',
      });
    }
  }

  // --- 2. Evaluate Football & Other Sports Matches ---
  for (const [category, matches] of Object.entries(sportsMatches)) {
    for (const match of matches) {
      const matchId = `${category}-${match.slug}`;
      const matchTitle = match.title;
      const matchUrl = `/${category}/match/${encodeURIComponent(match.slug)}/`;
      const isLive = match.status === 'LIVE' || match.isLive;
      const competition = (match as any).league || (category === 'football' ? 'Football Fixtures' : `${category.toUpperCase()} Fixtures`);
      const venue = (match as any).venue || 'Stadium';

      const isPref = isMatchPreferred(matchTitle, match.slug, undefined, undefined, prefs);
      if (!isPref) continue;

      // Kickoff Calculations
      const kickoffMs = match.timestamp;
      const lastKickoff = statesCache[matchId]?.kickoffTimestamp;

      if (kickoffMs) {
        if (lastKickoff && Math.abs(kickoffMs - lastKickoff) > 10 * 60000) {
          clearDispatchedAlert(`30min:${matchId}`);
          clearDispatchedAlert(`5min:${matchId}`);
          dispatchNotification({
            key: `reschedule:${matchId}:${kickoffMs}`,
            type: 'rescheduled',
            filterCategory: 'matches',
            title: '📅 Kickoff Rescheduled',
            message: `${matchTitle} kickoff updated to ${formatLocalKickoff(kickoffMs, userTz)}.`,
            matchTitle,
            matchUrl,
            category,
            competition,
            kickoffFormatted: formatLocalKickoff(kickoffMs, userTz),
            badgeText: 'RESCHEDULED',
          });
        }
        saveMatchState(matchId, { kickoffTimestamp: kickoffMs });

        const diffMinutes = (kickoffMs - now) / 60000;

        // 30 Minutes Before Kickoff
        if (prefs.notifications.remind30Min && !isLive && diffMinutes > 25 && diffMinutes <= 30.5) {
          dispatchNotification({
            key: `30min:${matchId}`,
            type: '30min_warning',
            filterCategory: 'matches',
            title: '⚽ Matchday Reminder',
            message: `${matchTitle} kicks off in 30 minutes!`,
            matchTitle,
            matchUrl,
            category,
            competition,
            venue,
            kickoffFormatted: formatLocalKickoff(kickoffMs, userTz),
            badgeText: '30 MIN REMINDER',
          });
        }

        // 5 Minutes Before Kickoff (Main Requirement)
        if (prefs.notifications.remind5Min && !isLive && diffMinutes > 0 && diffMinutes <= 5.5) {
          dispatchNotification({
            key: `5min:${matchId}`,
            type: '5min_warning',
            filterCategory: 'matches',
            title: '🔔 Kickoff in 5 Minutes!',
            message: `Get ready! The match is about to begin.`,
            matchTitle,
            matchUrl,
            category,
            competition,
            venue,
            kickoffFormatted: formatLocalKickoff(kickoffMs, userTz),
            badgeText: '5 MIN WARNING',
          });
        }
      }

      // Match Kickoff (Live Alert)
      if (prefs.notifications.notifyKickoff && isLive) {
        dispatchNotification({
          key: `start:${matchId}`,
          type: 'kickoff',
          filterCategory: 'matches',
          title: '🟢 Match Live!',
          message: `${matchTitle} is underway! Watch live stream on Sportivo.`,
          matchTitle,
          matchUrl,
          category,
          competition,
          badgeText: 'LIVE NOW',
        });
      }

      // Live Football Score Updates & Goals
      if (isLive && (match as any).score) {
        const scoreStr = String((match as any).score);
        const scoreParts = scoreStr.split(/[-:]/).map((s) => parseInt(s.trim(), 10));
        if (scoreParts.length === 2 && !isNaN(scoreParts[0]) && !isNaN(scoreParts[1])) {
          const currentHome = scoreParts[0];
          const currentAway = scoreParts[1];
          const cachedHome = statesCache[matchId]?.homeScore ?? 0;
          const cachedAway = statesCache[matchId]?.awayScore ?? 0;

          if (currentHome !== cachedHome || currentAway !== cachedAway) {
            saveMatchState(matchId, { homeScore: currentHome, awayScore: currentAway });

            if (prefs.notifications.notifyGoalsWickets) {
              const isEqualizer = currentHome === currentAway && (currentHome > 0 || currentAway > 0);
              const isLead = currentHome !== currentAway;

              if (isEqualizer) {
                dispatchNotification({
                  key: `equalizer:${matchId}:${scoreStr}`,
                  type: 'equalizer',
                  filterCategory: 'moments',
                  title: '🔥 Equalizer!',
                  message: `Equalizer scored! It's now ${scoreStr} in ${matchTitle}!`,
                  matchTitle,
                  matchUrl,
                  category,
                  competition,
                  score: scoreStr,
                  badgeText: 'EQUALIZER',
                });
              } else if (isLead) {
                dispatchNotification({
                  key: `goal:${matchId}:${scoreStr}`,
                  type: 'goal',
                  filterCategory: 'moments',
                  title: '⚽ GOAL!',
                  message: `GOAL! Score is now ${scoreStr} in ${matchTitle}!`,
                  matchTitle,
                  matchUrl,
                  category,
                  competition,
                  score: scoreStr,
                  badgeText: 'GOAL',
                });
              }
            }
          }
        }
      }

      // Full-Time / Match Concluded
      if (prefs.notifications.notifyFullTime && (match.status === 'Final' || match.status === 'COMPLETED')) {
        dispatchNotification({
          key: `result:${matchId}`,
          type: 'full_time',
          filterCategory: 'results',
          title: '🏁 Full-time',
          message: `Full-time: ${matchTitle} has concluded! Final score: ${(match as any).score || 'Concluded'}.`,
          matchTitle,
          matchUrl,
          category,
          competition,
          badgeText: 'FULL TIME',
        });
      }
    }
  }
}
