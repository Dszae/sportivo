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

  // Background Match Poller (checks every 25 seconds)
  useEffect(() => {
    let isMounted = true;

    const pollMatches = async () => {
      try {
        const [nplRes, footballRes, cricketRes, basketballRes] = await Promise.allSettled([
          fetch('/api/npl/fixtures', { signal: AbortSignal.timeout(6000) }),
          fetch('/api/matches/football', { signal: AbortSignal.timeout(6000) }),
          fetch('/api/matches/cricket', { signal: AbortSignal.timeout(6000) }),
          fetch('/api/matches/basketball', { signal: AbortSignal.timeout(6000) }),
        ]);

        let nplData: NplMatch[] = [];
        if (nplRes.status === 'fulfilled' && nplRes.value.ok) {
          const json = await nplRes.value.json();
          nplData = json.fixtures || [];
        }

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
          evaluateMatchesForNotifications(sportsMap, nplData);
        }
      } catch {}
    };

    const initialTimer = setTimeout(pollMatches, 1500);
    const interval = setInterval(pollMatches, 25000);

    return () => {
      isMounted = false;
      clearTimeout(initialTimer);
      clearInterval(interval);
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
        className={`relative inline-flex items-center justify-center rounded-full p-2 text-xs font-bold transition-all border ${
          isOpen || unreadCount > 0
            ? 'border-[#c9f36b]/60 bg-[#c9f36b]/15 text-[#c9f36b]'
            : 'border-white/10 bg-white/5 text-slate-300 hover:border-[#c9f36b]/40 hover:text-[#c9f36b]'
        }`}
      >
        <svg
          className="h-4 w-4"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
          <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
        </svg>

        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-black text-white shadow-md animate-pulse">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Modal: Notification Center */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-84 sm:w-[420px] rounded-2xl border border-white/15 bg-[#101716]/98 shadow-2xl backdrop-blur-2xl z-50 overflow-hidden text-slate-100 ring-1 ring-white/10 animate-in fade-in zoom-in-95 duration-150">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-3 bg-white/[0.02]">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#c9f36b] opacity-75"></span>
                <span className="relative inline-flex h-2 w-2 rounded-full bg-[#c9f36b]"></span>
              </span>
              <h3 className="text-sm font-black text-white">Match Alerts</h3>
              {unreadCount > 0 && (
                <span className="rounded-full bg-red-500/20 border border-red-500/30 px-2 py-0.2 text-[10px] font-bold text-red-400">
                  {unreadCount} new
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 text-xs">
              <button
                type="button"
                onClick={() => setShowPreferences(!showPreferences)}
                title="Notification Settings"
                className={`rounded-lg px-2 py-1 text-[11px] font-semibold transition border ${
                  showPreferences
                    ? 'border-[#c9f36b] bg-[#c9f36b]/15 text-[#c9f36b]'
                    : 'border-white/10 bg-white/5 text-slate-300 hover:text-white'
                }`}
              >
                ⚙ Preferences
              </button>
              {history.length > 0 && (
                <button
                  type="button"
                  onClick={markAllNotificationsAsRead}
                  className="text-[11px] text-slate-400 hover:text-[#c9f36b] transition"
                  title="Mark all as read"
                >
                  Mark read
                </button>
              )}
            </div>
          </div>

          {/* Preferences Drawer / Modal */}
          {showPreferences ? (
            <div className="p-4 space-y-4 bg-[#0a0f0e] border-b border-white/10 text-xs">
              <div className="flex items-center justify-between border-b border-white/10 pb-2">
                <span className="font-bold text-white uppercase tracking-wider text-[11px] text-[#e5b94f]">
                  Notification Preferences
                </span>
                <button
                  type="button"
                  onClick={handleSendTestAlert}
                  className="rounded bg-[#c9f36b]/15 border border-[#c9f36b]/40 px-2 py-0.5 text-[10px] font-bold text-[#c9f36b] hover:bg-[#c9f36b] hover:text-[#080a0b] transition"
                >
                  Send Test Alert
                </button>
              </div>

              {/* Browser Push Banner */}
              <div className="rounded-xl border border-white/10 bg-white/5 p-3 flex items-center justify-between gap-3">
                <div>
                  <span className="block font-bold text-white text-[11px]">Browser Push Delivery</span>
                  <span className="text-[10px] text-slate-400">
                    {permission === 'granted'
                      ? '✓ Native device notifications are active.'
                      : 'Receive alerts even when Sportivo is in another tab.'}
                  </span>
                </div>
                {permission !== 'granted' && (
                  <button
                    type="button"
                    onClick={handleRequestPush}
                    className="rounded-lg bg-[#c9f36b] px-3 py-1 text-xs font-bold text-[#080a0b] hover:bg-[#b0d859] transition shadow-sm shrink-0"
                  >
                    Enable Push
                  </button>
                )}
              </div>

              {/* Toggles Grid */}
              <div className="space-y-2">
                <label className="flex items-center justify-between rounded-lg border border-white/5 bg-white/[0.02] p-2 cursor-pointer hover:bg-white/5 transition">
                  <div>
                    <span className="block font-semibold text-white">5-Minute Kickoff Alert</span>
                    <span className="text-[10px] text-slate-400">Notify 5m before start with venue &amp; time</span>
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
                    className="rounded border-white/20 bg-white/10 text-[#c9f36b] focus:ring-0"
                  />
                </label>

                <label className="flex items-center justify-between rounded-lg border border-white/5 bg-white/[0.02] p-2 cursor-pointer hover:bg-white/5 transition">
                  <div>
                    <span className="block font-semibold text-white">30-Minute Kickoff Reminder</span>
                    <span className="text-[10px] text-slate-400">Matchday heads-up 30m before kickoff</span>
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
                    className="rounded border-white/20 bg-white/10 text-[#c9f36b] focus:ring-0"
                  />
                </label>

                <label className="flex items-center justify-between rounded-lg border border-white/5 bg-white/[0.02] p-2 cursor-pointer hover:bg-white/5 transition">
                  <div>
                    <span className="block font-semibold text-white">Live Goals &amp; Wickets</span>
                    <span className="text-[10px] text-slate-400">Score changes, equalizers &amp; wickets</span>
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
                    className="rounded border-white/20 bg-white/10 text-[#c9f36b] focus:ring-0"
                  />
                </label>

                <label className="flex items-center justify-between rounded-lg border border-white/5 bg-white/[0.02] p-2 cursor-pointer hover:bg-white/5 transition">
                  <div>
                    <span className="block font-semibold text-white">Full-Time &amp; Match Results</span>
                    <span className="text-[10px] text-slate-400">Final scores and winning margins</span>
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
                    className="rounded border-white/20 bg-white/10 text-[#c9f36b] focus:ring-0"
                  />
                </label>

                <label className="flex items-center justify-between rounded-lg border border-white/5 bg-white/[0.02] p-2 cursor-pointer hover:bg-white/5 transition">
                  <div>
                    <span className="block font-semibold text-white">Audio Chime</span>
                    <span className="text-[10px] text-slate-400">Subtle sound ping when alert fires</span>
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
                    className="rounded border-white/20 bg-white/10 text-[#c9f36b] focus:ring-0"
                  />
                </label>
              </div>

              <div className="flex items-center justify-between border-t border-white/10 pt-2 text-[11px]">
                <span className="text-slate-400">Alerts fire for teams in your Watchlist.</span>
                <button
                  type="button"
                  onClick={() => setShowPreferences(false)}
                  className="font-bold text-[#c9f36b] hover:underline"
                >
                  Done
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Category Filter Pills */}
              <div className="flex items-center gap-1 border-b border-white/10 bg-white/[0.01] px-4 py-2 text-xs overflow-x-auto">
                <button
                  type="button"
                  onClick={() => setActiveFilter('all')}
                  className={`rounded-full px-3 py-1 font-bold transition ${
                    activeFilter === 'all'
                      ? 'bg-[#c9f36b] text-[#080a0b]'
                      : 'text-slate-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  All ({history.length})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveFilter('matches')}
                  className={`rounded-full px-3 py-1 font-bold transition ${
                    activeFilter === 'matches'
                      ? 'bg-[#c9f36b] text-[#080a0b]'
                      : 'text-slate-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  Matches
                </button>
                <button
                  type="button"
                  onClick={() => setActiveFilter('moments')}
                  className={`rounded-full px-3 py-1 font-bold transition ${
                    activeFilter === 'moments'
                      ? 'bg-[#c9f36b] text-[#080a0b]'
                      : 'text-slate-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  Goals &amp; Wickets
                </button>
                <button
                  type="button"
                  onClick={() => setActiveFilter('results')}
                  className={`rounded-full px-3 py-1 font-bold transition ${
                    activeFilter === 'results'
                      ? 'bg-[#c9f36b] text-[#080a0b]'
                      : 'text-slate-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  Results
                </button>
              </div>

              {/* Notification List */}
              <div className="max-h-96 overflow-y-auto divide-y divide-white/5 custom-scrollbar">
                {filteredHistory.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-400">
                    <span className="inline-block text-3xl mb-2">🔔</span>
                    <p className="font-bold text-white text-sm">No match alerts in this tab</p>
                    <p className="mt-1.5 text-[11px] text-slate-400 max-w-xs mx-auto leading-relaxed">
                      Follow your favorite teams in{' '}
                      <a href="/dashboard/" className="text-[#c9f36b] hover:underline font-bold">
                        My Watchlist
                      </a>{' '}
                      or star matches in{' '}
                      <a href="/npl/" className="text-red-400 hover:underline font-bold">
                        NPL 2026
                      </a>
                      . Sportivo will notify you 5 minutes before kickoff and during live moments!
                    </p>
                  </div>
                ) : (
                  filteredHistory.map((item) => (
                    <div
                      key={item.id}
                      className={`relative p-3.5 hover:bg-white/[0.04] transition group ${
                        !item.read ? 'bg-[#c9f36b]/[0.03]' : ''
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span
                            className={`rounded-md px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wider ${
                              item.type === '5min_warning'
                                ? 'bg-amber-400/20 text-amber-300 border border-amber-400/30'
                                : item.type === 'goal' || item.type === 'equalizer'
                                ? 'bg-[#c9f36b]/20 text-[#c9f36b] border border-[#c9f36b]/30'
                                : item.type === 'wicket'
                                ? 'bg-red-500/20 text-red-300 border border-red-500/30'
                                : item.type === 'full_time'
                                ? 'bg-sky-400/20 text-sky-300 border border-sky-400/30'
                                : 'bg-white/10 text-slate-300'
                            }`}
                          >
                            {item.badgeText || item.type.replace('_', ' ')}
                          </span>

                          {item.competition && (
                            <span className="text-[10px] text-slate-400 font-medium">
                              {item.competition}
                            </span>
                          )}
                        </div>

                        <span className="text-[10px] text-slate-500 shrink-0">
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
                        className="block mt-1.5 focus:outline-none"
                      >
                        <h4 className="text-xs font-bold text-white group-hover:text-[#c9f36b] transition-colors">
                          {item.title}
                        </h4>
                        <p className="mt-1 text-xs text-slate-300 leading-relaxed font-normal">
                          {item.message}
                        </p>

                        {(item.venue || item.kickoffFormatted) && (
                          <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] text-slate-400 border-t border-white/5 pt-1.5">
                            {item.kickoffFormatted && (
                              <span className="text-white font-medium">⏰ {item.kickoffFormatted}</span>
                            )}
                            {item.venue && <span>📍 {item.venue}</span>}
                          </div>
                        )}
                      </a>

                      <div className="mt-2.5 flex items-center justify-between text-[11px] pt-1">
                        <a
                          href={item.matchUrl}
                          onClick={() => {
                            markNotificationAsRead(item.id);
                            setIsOpen(false);
                          }}
                          className="font-bold text-[#c9f36b] hover:underline inline-flex items-center gap-1"
                        >
                          <span>View Match &amp; Stream</span>
                          <span aria-hidden="true">&rarr;</span>
                        </a>

                        {!item.read && (
                          <button
                            type="button"
                            onClick={() => markNotificationAsRead(item.id)}
                            className="text-[10px] text-slate-400 hover:text-white"
                          >
                            Mark read
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Footer */}
              {history.length > 0 && (
                <div className="flex items-center justify-between border-t border-white/10 px-4 py-2.5 bg-white/[0.02] text-xs">
                  <span className="text-slate-400 text-[11px]">
                    {unreadCount === 0 ? 'All caught up' : `${unreadCount} unread`}
                  </span>
                  <button
                    type="button"
                    onClick={clearNotificationHistory}
                    className="text-[11px] text-slate-400 hover:text-red-400 transition"
                  >
                    Clear history
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
