import React, { useEffect, useRef, useState } from 'react';
import {
  type NotificationAlert,
  type FilterCategory,
  clearNotificationHistory,
  dispatchNotification,
  evaluateMatchesForNotifications,
  getNotificationHistory,
  getNotificationPermission,
  markAllNotificationsAsRead,
  markNotificationAsRead,
  requestNotificationPermission,
  subscribeToPushService,
  syncPushPreferences,
} from '../lib/notificationService';
import {
  type UserPreferences,
  getDefaultPreferences,
  loadUserPreferences,
  saveUserPreferences,
} from '../lib/preferences';
import type { NplMatch } from '../lib/data/nplData';
import type { Match } from '../lib/sportivo';

export default function NotificationCenter() {
  const [isOpen, setIsOpen] = useState(false);
  const [showPreferences, setShowPreferences] = useState(false);
  const [history, setHistory] = useState<NotificationAlert[]>([]);
  const [activeFilter, setActiveFilter] = useState<FilterCategory>('all');
  const [prefs, setPrefs] = useState<UserPreferences>(getDefaultPreferences());
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Initialize and synchronize listeners
  useEffect(() => {
    setPrefs(loadUserPreferences());
    setHistory(getNotificationHistory());
    setPermission(getNotificationPermission());

    const handleHistoryUpdate = (e: Event) => {
      const ce = e as CustomEvent<NotificationAlert[]>;
      if (ce.detail) setHistory(ce.detail);
    };

    const handlePrefsChange = (e: Event) => {
      const ce = e as CustomEvent<UserPreferences>;
      if (ce.detail) setPrefs(ce.detail);
      syncPushPreferences().catch(() => {});
    };

    const handlePermChange = (e: Event) => {
      const ce = e as CustomEvent<NotificationPermission>;
      if (ce.detail) setPermission(ce.detail);
    };

    window.addEventListener('sportivo:notifications-updated', handleHistoryUpdate);
    window.addEventListener('sportivo:preferences-changed', handlePrefsChange);
    window.addEventListener('sportivo:notification-permission-changed', handlePermChange);

    const handleOutsideClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setShowPreferences(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);

    return () => {
      window.removeEventListener('sportivo:notifications-updated', handleHistoryUpdate);
      window.removeEventListener('sportivo:preferences-changed', handlePrefsChange);
      window.removeEventListener('sportivo:notification-permission-changed', handlePermChange);
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, []);

  // Real-time Match Poller & CREX Ground Scorer Engine (3.5s ball-by-ball updates)
  useEffect(() => {
    let isMounted = true;
    let pollTimer: any = null;
    let scorerTimer: any = null;

    const pollGroundScorerMoments = async () => {
      try {
        const res = await fetch(`/api/npl/live-moments/?_t=${Date.now()}`, {
          cache: 'no-store',
          signal: AbortSignal.timeout(3500),
        });
        if (res.ok) {
          const data = await res.json();
          if (data && Array.isArray(data.moments) && data.moments.length > 0) {
            for (const moment of data.moments) {
              dispatchNotification({
                key: `moment:${moment.ballId}`,
                type: moment.type === 'WICKET' ? 'wicket' : 'goal',
                filterCategory: 'moments',
                title: moment.title,
                message: moment.message,
                matchTitle: 'Pokhara Avengers vs Sudurpaschim Royals',
                matchUrl: '/npl/',
                category: 'cricket',
                competition: 'Nepal Premier League',
                score: moment.teamScore || data.score,
                badgeText: moment.type,
              });
            }
          }
        }
      } catch {}
      if (isMounted) {
        scorerTimer = setTimeout(pollGroundScorerMoments, 3500);
      }
    };

    const pollLiveNpl = async () => {
      try {
        const res = await fetch(`/api/npl/fixtures/?_t=${Date.now()}`, {
          cache: 'no-store',
          signal: AbortSignal.timeout(4000),
        });
        if (res.ok) {
          const json = await res.json();
          const nplData: NplMatch[] = json.fixtures || [];
          if (isMounted) {
            evaluateMatchesForNotifications({}, nplData);
          }
          return nplData.some((m) => m.status === 'LIVE');
        }
      } catch {}
      return false;
    };

    const pollAllSports = async () => {
      try {
        const [footballRes, cricketRes, basketballRes] = await Promise.allSettled([
          fetch('/api/matches/football/', { signal: AbortSignal.timeout(6000) }),
          fetch('/api/matches/cricket/', { signal: AbortSignal.timeout(6000) }),
          fetch('/api/matches/basketball/', { signal: AbortSignal.timeout(6000) }),
        ]);

        const sportsMap: Record<string, Match[]> = {};
        if (footballRes.status === 'fulfilled' && footballRes.value.ok) {
          sportsMap.football = (await footballRes.value.json()) || [];
        }
        if (cricketRes.status === 'fulfilled' && cricketRes.value.ok) {
          sportsMap.cricket = (await cricketRes.value.json()) || [];
        }
        if (basketballRes.status === 'fulfilled' && basketballRes.value.ok) {
          sportsMap.basketball = (await basketballRes.value.json()) || [];
        }

        if (isMounted) {
          evaluateMatchesForNotifications(sportsMap, []);
        }
      } catch {}
    };

    const runLoop = async () => {
      const hasLiveMatch = await pollLiveNpl();
      const nextDelay = hasLiveMatch ? 4000 : 15000;
      if (isMounted) {
        pollTimer = setTimeout(runLoop, nextDelay);
      }
    };

    // Immediate initial poll
    runLoop();
    pollGroundScorerMoments();
    pollAllSports();
    const allSportsInterval = setInterval(pollAllSports, 30000);

    return () => {
      isMounted = false;
      if (pollTimer) clearTimeout(pollTimer);
      if (scorerTimer) clearTimeout(scorerTimer);
      clearInterval(allSportsInterval);
    };
  }, []);

  const unreadCount = history.filter((h) => !h.read).length;

  const handleToggleDropdown = () => {
    if (!isOpen && unreadCount > 0) {
      markAllNotificationsAsRead();
    }
    setIsOpen(!isOpen);
    setShowPreferences(false);
  };

  const handleRequestPush = async () => {
    const res = await requestNotificationPermission();
    setPermission(res);
  };

  const updatePreferences = (updater: (prev: UserPreferences) => UserPreferences) => {
    setPrefs((current) => {
      const next = updater(current);
      saveUserPreferences(next);
      return next;
    });
  };

  const handleSendTestAlert = () => {
    dispatchNotification({
      key: `test:${Date.now()}`,
      type: '5min_warning',
      filterCategory: 'matches',
      title: '🔔 Kickoff in 5 Minutes!',
      message: 'Real Madrid 🆚 Barcelona. Get ready! The match is about to begin.',
      matchTitle: 'Real Madrid vs Barcelona',
      matchUrl: '/football/',
      category: 'football',
      competition: 'La Liga · El Clásico',
      venue: 'Santiago Bernabéu',
      kickoffFormatted: 'Today · 8:45 PM Nepal Time',
      badgeText: '5 MIN WARNING',
    });

    // Also trigger native closed-tab Web Push delivery via push service
    subscribeToPushService(true).catch(() => {});
  };

  // Filter history by selected category tab
  const filteredHistory = history.filter((item) => {
    if (activeFilter === 'all') return true;
    return item.filterCategory === activeFilter;
  });

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      {/* Bell Trigger Button */}
      <button
        type="button"
        onClick={handleToggleDropdown}
        aria-label="Match Notifications"
        title="Sportivo Match Alerts & Live Moments"
        className={`relative inline-flex items-center justify-center rounded-full p-2 text-xs font-bold transition-all border shadow-sm ${
          isOpen || unreadCount > 0
            ? 'border-[#c9f36b] bg-[#c9f36b]/20 text-[#c9f36b] shadow-[0_0_12px_rgba(201,243,107,0.3)]'
            : 'border-white/15 bg-[#141f1d] text-slate-200 hover:border-[#c9f36b]/60 hover:text-[#c9f36b] hover:bg-[#1a2926]'
        }`}
      >
        <svg
          className="h-4 w-4"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
          <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
        </svg>

        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-black text-white shadow-md ring-2 ring-[#101716] animate-pulse">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Modal: Notification Center */}
      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-[9990] bg-black/75 backdrop-blur-sm sm:hidden"
            onClick={() => setIsOpen(false)}
            aria-hidden="true"
          />
          <div className="fixed inset-x-4 top-20 bottom-auto max-h-[80vh] sm:fixed sm:inset-auto sm:right-6 sm:top-16 sm:w-[400px] max-w-[420px] mx-auto sm:mx-0 rounded-2xl border border-white/20 bg-[#0c1413] shadow-[0_24px_60px_rgba(0,0,0,0.95)] z-[9995] overflow-hidden text-slate-100 flex flex-col ring-1 ring-[#c9f36b]/25">
          {/* Header (100% Solid) */}
          <div className="flex items-center justify-between border-b border-white/15 px-4 py-3 bg-[#131d1b]">
            <div className="flex items-center gap-2.5">
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#c9f36b] opacity-80"></span>
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[#c9f36b]"></span>
              </span>
              <h3 className="text-sm font-black text-white tracking-wide">Match Alerts</h3>
              {unreadCount > 0 && (
                <span className="rounded-full bg-red-500/25 border border-red-500/40 px-2 py-0.5 text-[10px] font-black text-red-300">
                  {unreadCount} new
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 text-xs">
              <button
                type="button"
                onClick={() => setShowPreferences(!showPreferences)}
                title="Notification Settings"
                className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-bold transition border ${
                  showPreferences
                    ? 'border-[#c9f36b] bg-[#c9f36b] text-[#070b0a] shadow-sm'
                    : 'border-white/15 bg-[#1b2725] text-slate-200 hover:border-[#c9f36b]/50 hover:text-white'
                }`}
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/>
                  <circle cx="12" cy="12" r="3"/>
                </svg>
                <span>Preferences</span>
              </button>
              {history.length > 0 && (
                <button
                  type="button"
                  onClick={markAllNotificationsAsRead}
                  className="rounded-lg border border-white/10 bg-[#172321] px-2 py-1 text-[11px] font-medium text-slate-300 hover:text-[#c9f36b] hover:border-[#c9f36b]/40 transition"
                  title="Mark all as read"
                >
                  Mark read
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:text-white hover:bg-white/10 transition border border-transparent hover:border-white/10"
                aria-label="Close notification drawer"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Preferences Drawer / Modal */}
          {showPreferences ? (
            <div className="p-4 space-y-3.5 bg-[#0e1615] border-b border-white/10 text-xs">
              <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
                <span className="font-black text-[#e5b94f] uppercase tracking-wider text-[11px]">
                  Alert Preferences
                </span>
                <button
                  type="button"
                  onClick={handleSendTestAlert}
                  className="rounded-lg bg-[#c9f36b] px-2.5 py-1 text-[11px] font-black text-[#080a0b] hover:bg-[#b5e05c] transition shadow-sm"
                >
                  🔔 Send Test Alert
                </button>
              </div>

              {/* Browser Push Banner */}
              <div className="rounded-xl border border-white/15 bg-[#14201e] p-3 flex items-center justify-between gap-3 shadow-sm">
                <div>
                  <span className="block font-bold text-white text-xs">Background Push (Closed Tab Alerts)</span>
                  <span className="text-[11px] text-slate-300 leading-tight">
                    {permission === 'granted'
                      ? '✓ Active! You will receive match alerts even when Sportivo is closed.'
                      : 'Get live kickoff & score alerts on your device even when website is closed.'}
                  </span>
                </div>
                {permission !== 'granted' ? (
                  <button
                    type="button"
                    onClick={handleRequestPush}
                    className="rounded-lg bg-[#c9f36b] px-3 py-1.5 text-xs font-black text-[#080a0b] hover:bg-[#b0d859] transition shadow-md shrink-0"
                  >
                    Enable Push
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => subscribeToPushService(true)}
                    className="rounded-lg border border-[#c9f36b]/40 bg-[#c9f36b]/10 px-2.5 py-1 text-[11px] font-bold text-[#c9f36b] hover:bg-[#c9f36b] hover:text-black transition shrink-0"
                    title="Sends an instant push message through the push service"
                  >
                    Test Push
                  </button>
                )}
              </div>

              {/* Toggles Grid */}
              <div className="space-y-2">
                <label className="flex items-center justify-between rounded-xl border border-white/10 bg-[#14201e] p-3 cursor-pointer hover:border-[#c9f36b]/40 hover:bg-[#182624] transition">
                  <div className="pr-2">
                    <span className="block font-bold text-white text-xs">5-Minute Kickoff Alert</span>
                    <span className="text-[11px] text-slate-300">Warns 5 min before start with venue &amp; time</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={prefs.notifications.remind5Min}
                    onChange={(e) =>
                      updatePreferences((prev) => ({
                        ...prev,
                        notifications: { ...prev.notifications, remind5Min: e.target.checked },
                      }))
                    }
                    className="h-4 w-4 rounded border-white/30 bg-[#0b1110] text-[#c9f36b] focus:ring-0 cursor-pointer accent-[#c9f36b]"
                  />
                </label>

                <label className="flex items-center justify-between rounded-xl border border-white/10 bg-[#14201e] p-3 cursor-pointer hover:border-[#c9f36b]/40 hover:bg-[#182624] transition">
                  <div className="pr-2">
                    <span className="block font-bold text-white text-xs">30-Minute Kickoff Reminder</span>
                    <span className="text-[11px] text-slate-300">Matchday heads-up 30m before kickoff</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={prefs.notifications.remind30Min}
                    onChange={(e) =>
                      updatePreferences((prev) => ({
                        ...prev,
                        notifications: { ...prev.notifications, remind30Min: e.target.checked },
                      }))
                    }
                    className="h-4 w-4 rounded border-white/30 bg-[#0b1110] text-[#c9f36b] focus:ring-0 cursor-pointer accent-[#c9f36b]"
                  />
                </label>

                <label className="flex items-center justify-between rounded-xl border border-white/10 bg-[#14201e] p-3 cursor-pointer hover:border-[#c9f36b]/40 hover:bg-[#182624] transition">
                  <div className="pr-2">
                    <span className="block font-bold text-white text-xs">Live Goals &amp; Wickets</span>
                    <span className="text-[11px] text-slate-300">Score changes, equalizers &amp; fall of wickets</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={prefs.notifications.notifyGoalsWickets}
                    onChange={(e) =>
                      updatePreferences((prev) => ({
                        ...prev,
                        notifications: { ...prev.notifications, notifyGoalsWickets: e.target.checked },
                      }))
                    }
                    className="h-4 w-4 rounded border-white/30 bg-[#0b1110] text-[#c9f36b] focus:ring-0 cursor-pointer accent-[#c9f36b]"
                  />
                </label>

                <label className="flex items-center justify-between rounded-xl border border-white/10 bg-[#14201e] p-3 cursor-pointer hover:border-[#c9f36b]/40 hover:bg-[#182624] transition">
                  <div className="pr-2">
                    <span className="block font-bold text-white text-xs">Full-Time &amp; Match Results</span>
                    <span className="text-[11px] text-slate-300">Final scores, winning margins &amp; winners</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={prefs.notifications.notifyFullTime}
                    onChange={(e) =>
                      updatePreferences((prev) => ({
                        ...prev,
                        notifications: { ...prev.notifications, notifyFullTime: e.target.checked },
                      }))
                    }
                    className="h-4 w-4 rounded border-white/30 bg-[#0b1110] text-[#c9f36b] focus:ring-0 cursor-pointer accent-[#c9f36b]"
                  />
                </label>

                <label className="flex items-center justify-between rounded-xl border border-white/10 bg-[#14201e] p-3 cursor-pointer hover:border-[#c9f36b]/40 hover:bg-[#182624] transition">
                  <div className="pr-2">
                    <span className="block font-bold text-white text-xs">Audio Chime</span>
                    <span className="text-[11px] text-slate-300">Play subtle sound ping when alert arrives</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={prefs.notifications.soundEnabled}
                    onChange={(e) =>
                      updatePreferences((prev) => ({
                        ...prev,
                        notifications: { ...prev.notifications, soundEnabled: e.target.checked },
                      }))
                    }
                    className="h-4 w-4 rounded border-white/30 bg-[#0b1110] text-[#c9f36b] focus:ring-0 cursor-pointer accent-[#c9f36b]"
                  />
                </label>
              </div>

              <div className="flex items-center justify-between border-t border-white/10 pt-3 text-xs">
                <span className="text-slate-300 text-[11px]">Auto-monitors teams in your Watchlist.</span>
                <button
                  type="button"
                  onClick={() => setShowPreferences(false)}
                  className="rounded-lg bg-[#c9f36b] px-3 py-1 font-black text-[#080a0b] hover:bg-[#b0d859] transition shadow-sm"
                >
                  Done
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Category Filter Pills (Solid Background) */}
              <div className="flex items-center gap-1.5 border-b border-white/15 bg-[#0e1715] px-4 py-2.5 text-xs overflow-x-auto">
                <button
                  type="button"
                  onClick={() => setActiveFilter('all')}
                  className={`rounded-full px-3 py-1 text-xs font-bold transition shrink-0 ${
                    activeFilter === 'all'
                      ? 'bg-[#c9f36b] text-[#080a0b] shadow-sm font-black'
                      : 'border border-white/10 bg-[#162321] text-slate-300 hover:text-white hover:border-white/20'
                  }`}
                >
                  All ({history.length})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveFilter('matches')}
                  className={`rounded-full px-3 py-1 text-xs font-bold transition shrink-0 ${
                    activeFilter === 'matches'
                      ? 'bg-[#c9f36b] text-[#080a0b] shadow-sm font-black'
                      : 'border border-white/10 bg-[#162321] text-slate-300 hover:text-white hover:border-white/20'
                  }`}
                >
                  Matches
                </button>
                <button
                  type="button"
                  onClick={() => setActiveFilter('moments')}
                  className={`rounded-full px-3 py-1 text-xs font-bold transition shrink-0 ${
                    activeFilter === 'moments'
                      ? 'bg-[#c9f36b] text-[#080a0b] shadow-sm font-black'
                      : 'border border-white/10 bg-[#162321] text-slate-300 hover:text-white hover:border-white/20'
                  }`}
                >
                  Goals &amp; Wickets
                </button>
                <button
                  type="button"
                  onClick={() => setActiveFilter('results')}
                  className={`rounded-full px-3 py-1 text-xs font-bold transition shrink-0 ${
                    activeFilter === 'results'
                      ? 'bg-[#c9f36b] text-[#080a0b] shadow-sm font-black'
                      : 'border border-white/10 bg-[#162321] text-slate-300 hover:text-white hover:border-white/20'
                  }`}
                >
                  Results
                </button>
              </div>

              {/* Notification List (Solid Cards) */}
              <div className="max-h-[420px] overflow-y-auto p-3 space-y-2.5 bg-[#0b1110] custom-scrollbar">
                {filteredHistory.length === 0 ? (
                  <div className="rounded-xl border border-white/10 bg-[#121c1a] p-6 text-center text-xs text-slate-300 my-1">
                    <svg className="w-8 h-8 mx-auto text-slate-500 mb-2 stroke-[1.5]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
                      <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
                    </svg>
                    <p className="font-black text-white text-sm">No match alerts in this tab</p>
                    <p className="mt-1.5 text-xs text-slate-300 max-w-xs mx-auto leading-relaxed">
                      Follow your favorite teams in{' '}
                      <a href="/dashboard/" className="text-[#c9f36b] hover:underline font-bold">
                        My Watchlist
                      </a>{' '}
                      or star matches in{' '}
                      <a href="/npl/" className="text-red-400 hover:underline font-bold">
                        NPL 2026
                      </a>
                      . Sportivo will alert you 5 minutes before kickoff and during live moments!
                    </p>
                  </div>
                ) : (
                  filteredHistory.map((item) => (
                    <div
                      key={item.id}
                      className={`relative rounded-xl border p-3.5 transition group shadow-sm ${
                        !item.read
                          ? 'border-l-4 border-l-[#c9f36b] border-white/15 bg-[#162522]'
                          : 'border-white/10 bg-[#131d1b] hover:border-[#c9f36b]/40 hover:bg-[#182623]'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2.5">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span
                            className={`rounded-md px-2 py-0.5 text-[10px] font-black uppercase tracking-wider shadow-sm ${
                              item.type === '5min_warning'
                                ? 'bg-amber-400 text-black'
                                : item.type === '30min_reminder'
                                ? 'bg-sky-400 text-black'
                                : item.type === 'goal' || item.type === 'equalizer'
                                ? 'bg-[#c9f36b] text-black'
                                : item.type === 'wicket'
                                ? 'bg-red-500 text-white'
                                : item.type === 'full_time'
                                ? 'bg-emerald-400 text-black'
                                : 'bg-white/20 text-white'
                            }`}
                          >
                            {item.badgeText || item.type.replace('_', ' ')}
                          </span>

                          {item.competition && (
                            <span className="rounded bg-[#1e2c2a] border border-white/10 px-1.5 py-0.5 text-[10px] text-slate-300 font-semibold">
                              {item.competition}
                            </span>
                          )}
                        </div>

                        <span className="text-[10px] text-slate-400 font-mono shrink-0">
                          {new Date(item.timestamp).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>

                      <a
                        href={item.matchUrl}
                        onClick={() => {
                          markNotificationAsRead(item.id);
                          setIsOpen(false);
                        }}
                        className="block mt-2 focus:outline-none"
                      >
                        <h4 className="text-[13px] font-bold text-white group-hover:text-[#c9f36b] transition-colors leading-snug">
                          {item.title}
                        </h4>
                        <p className="mt-1 text-xs text-slate-200 leading-relaxed font-normal">
                          {item.message}
                        </p>

                        {(item.venue || item.kickoffFormatted) && (
                          <div className="mt-2.5 rounded-lg border border-white/10 bg-[#0d1514] px-2.5 py-1.5 flex flex-wrap items-center gap-3 text-[11px] text-slate-300">
                            {item.kickoffFormatted && (
                              <span className="text-[#e5b94f] font-bold">⏰ {item.kickoffFormatted}</span>
                            )}
                            {item.venue && <span className="text-slate-300">📍 {item.venue}</span>}
                          </div>
                        )}
                      </a>

                      <div className="mt-3 flex items-center justify-between border-t border-white/10 pt-2 text-xs">
                        <a
                          href={item.matchUrl}
                          onClick={() => {
                            markNotificationAsRead(item.id);
                            setIsOpen(false);
                          }}
                          className="font-black text-[#c9f36b] hover:text-[#dcf88a] inline-flex items-center gap-1.5 text-xs"
                        >
                          <span>View Match &amp; Live Stream</span>
                          <span aria-hidden="true">&rarr;</span>
                        </a>

                        {!item.read && (
                          <button
                            type="button"
                            onClick={() => markNotificationAsRead(item.id)}
                            className="rounded bg-white/5 border border-white/10 px-2 py-0.5 text-[10px] text-slate-300 hover:text-white hover:bg-white/10 transition"
                          >
                            Mark read
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Footer (100% Solid) */}
              {history.length > 0 && (
                <div className="flex items-center justify-between border-t border-white/15 px-4 py-3 bg-[#131d1b] text-xs">
                  <span className="text-slate-300 text-xs font-medium">
                    {unreadCount === 0 ? '✓ All caught up' : `${unreadCount} unread alert${unreadCount > 1 ? 's' : ''}`}
                  </span>
                  <button
                    type="button"
                    onClick={clearNotificationHistory}
                    className="rounded-lg border border-red-500/30 bg-red-500/10 px-2.5 py-1 text-xs font-bold text-red-300 hover:bg-red-500/20 hover:text-white transition"
                  >
                    Clear history
                  </button>
                </div>
              )}
            </>
          )}
        </div>
        </>
      )}
    </div>
  );
}
