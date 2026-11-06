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
          } else if (data && Array.isArray(data.recentBalls) && getNotificationHistory().length === 0) {
            // Hydrate recent key moments so Notification Center is immediately populated with live match events
            const keyBalls = data.recentBalls.filter((b: any) => b.isBoundary || b.isWicket);
            for (const b of keyBalls.slice(-10)) {
              const isWkt = b.isWicket;
              const isSix = (b.code || '').toLowerCase() === '6';
              const type = isWkt ? 'wicket' : 'goal';
              const badgeText = isWkt ? 'WICKET' : isSix ? 'SIX' : 'FOUR';
              const title = isWkt ? 'Wicket' : isSix ? 'Six' : 'Four';
              const message = `${isWkt ? 'Wicket down' : 'Boundary'}. ${b.teamScore || data.score} (${b.over}.${b.delivery} ov)`;

              dispatchNotification({
                key: `moment:${b.over}.${b.delivery}:${b.code}`,
                type,
                filterCategory: 'moments',
                title,
                message,
                matchTitle: 'Pokhara Avengers vs Sudurpaschim Royals',
                matchUrl: '/npl/',
                category: 'cricket',
                competition: 'Nepal Premier League',
                score: b.teamScore || data.score,
                badgeText,
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
      title: 'Kickoff in 5 minutes',
      message: 'Real Madrid vs Barcelona is about to begin.',
      matchTitle: 'Real Madrid vs Barcelona',
      matchUrl: '/football/',
      category: 'football',
      competition: 'La Liga · El Clásico',
      venue: 'Santiago Bernabéu',
      kickoffFormatted: 'Today · 8:45 PM NST',
      badgeText: '5 min warning',
    });

    // Also trigger native closed-tab Web Push delivery via push service
    subscribeToPushService(true).catch(() => {});
  };

  // Filter history by selected category tab
  const filteredHistory = history.filter((item) => {
    if (activeFilter === 'all') return true;
    return item.filterCategory === activeFilter;
  });

  const formatTypeLabel = (item: NotificationAlert) => {
    const raw = item.badgeText || item.type.replace('_', ' ');
    return raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
  };

  const formatTime = (timestamp: number | string) =>
    new Date(timestamp).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

  const renderTypeIcon = (type: NotificationAlert['type']) => {
    if (type === '5min_warning' || type === '30min_reminder') {
      return (
        <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 2" />
        </svg>
      );
    }
    if (type === 'full_time') {
      return (
        <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 21V4" />
          <path d="M5 4h13l-2.5 4L18 12H5" />
        </svg>
      );
    }
    return (
      <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="9" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    );
  };

  const preferenceRows: Array<{
    key: keyof UserPreferences['notifications'];
    label: string;
    hint: string;
  }> = [
    { key: 'remind5Min', label: '5 minutes before kickoff', hint: 'Venue and kickoff time' },
    { key: 'remind30Min', label: '30 minutes before kickoff', hint: 'Matchday heads-up' },
    { key: 'notifyGoalsWickets', label: 'Goals and wickets', hint: 'Score changes and fall of wickets' },
    { key: 'notifyFullTime', label: 'Full time', hint: 'Final scores and winners' },
    { key: 'soundEnabled', label: 'Sound', hint: 'Short chime when an alert arrives' },
  ];

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      {/* Bell trigger */}
      <button
        type="button"
        onClick={handleToggleDropdown}
        aria-label="Match notifications"
        title="Match alerts and live moments"
        className={`icon-btn gap-1.5 ${unreadCount > 0 ? 'w-auto px-2.5' : ''} ${
          isOpen ? 'bg-ink-700 text-fg' : ''
        }`}
      >
        <svg
          className="icon"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
          <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
        </svg>

        {unreadCount > 0 && (
          <span className="clock inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-ink-600 px-1 text-xs leading-none text-fg">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-[9990] bg-ink-950/70 sm:hidden"
            onClick={() => setIsOpen(false)}
            aria-hidden="true"
          />
          <div className="panel shadow-float animate-fade-in fixed inset-x-4 top-20 bottom-auto z-[9995] mx-auto flex max-h-[80vh] max-w-[360px] flex-col gap-3 overflow-hidden p-4 text-fg sm:inset-auto sm:right-6 sm:top-16 sm:mx-0 sm:w-[360px]">
            {/* Header */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-medium text-fg">Match alerts</h3>
                {unreadCount > 0 && (
                  <span className="meta">
                    <span className="clock">{unreadCount}</span> new
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1">
                {history.length > 0 && (
                  <button
                    type="button"
                    onClick={markAllNotificationsAsRead}
                    className="btn btn-ghost btn-sm"
                    title="Mark all as read"
                  >
                    Mark read
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setShowPreferences(!showPreferences)}
                  title="Notification settings"
                  aria-label="Notification settings"
                  className={`icon-btn h-8 w-8 ${showPreferences ? 'bg-ink-700 text-fg' : ''}`}
                >
                  <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="icon-btn h-8 w-8"
                  aria-label="Close notification drawer"
                >
                  <svg className="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Preferences */}
            {showPreferences ? (
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="eyebrow">Alert preferences</span>
                  <button type="button" onClick={handleSendTestAlert} className="btn btn-ghost btn-sm">
                    Send test alert
                  </button>
                </div>

                {/* Browser push */}
                <div className="-mx-4 border-y border-line">
                  <div className="row min-h-[44px] justify-between gap-3 py-1 hover:bg-transparent">
                    <div className="min-w-0">
                      <span className="block text-sm text-fg">Background push</span>
                      <span className="meta block truncate">
                        {permission === 'granted'
                          ? 'Active even when Sportivo is closed'
                          : 'Alerts even when Sportivo is closed'}
                      </span>
                    </div>
                    {permission !== 'granted' ? (
                      <button type="button" onClick={handleRequestPush} className="btn btn-primary btn-sm">
                        Enable notifications
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => subscribeToPushService(true)}
                        className="btn btn-ghost btn-sm"
                        title="Sends an instant push message through the push service"
                      >
                        Test push
                      </button>
                    )}
                  </div>
                </div>

                {/* Toggles */}
                <div className="-mx-4">
                  {preferenceRows.map((rowDef) => (
                    <label key={rowDef.key} className="row min-h-[44px] cursor-pointer justify-between gap-3 py-1">
                      <div className="min-w-0">
                        <span className="block text-sm text-fg">{rowDef.label}</span>
                        <span className="meta block">{rowDef.hint}</span>
                      </div>
                      <input
                        type="checkbox"
                        checked={prefs.notifications[rowDef.key]}
                        onChange={(e) =>
                          updatePreferences((prev) => ({
                            ...prev,
                            notifications: { ...prev.notifications, [rowDef.key]: e.target.checked },
                          }))
                        }
                        className="h-4 w-4 shrink-0 cursor-pointer rounded border-line-strong bg-ink-900 accent-lime focus:ring-0"
                      />
                    </label>
                  ))}
                </div>

                <div className="flex items-center justify-between gap-2 border-t border-line pt-3">
                  <span className="meta">Monitors teams in your watchlist</span>
                  <button type="button" onClick={() => setShowPreferences(false)} className="btn btn-primary btn-sm">
                    Done
                  </button>
                </div>
              </div>
            ) : (
              <>
                {/* Filters */}
                <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
                  <button
                    type="button"
                    onClick={() => setActiveFilter('all')}
                    className={`chip ${activeFilter === 'all' ? 'chip-active' : ''}`}
                  >
                    All <span className="chip-count">{history.length}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveFilter('matches')}
                    className={`chip ${activeFilter === 'matches' ? 'chip-active' : ''}`}
                  >
                    Matches
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveFilter('moments')}
                    className={`chip ${activeFilter === 'moments' ? 'chip-active' : ''}`}
                  >
                    Goals and wickets
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveFilter('results')}
                    className={`chip ${activeFilter === 'results' ? 'chip-active' : ''}`}
                  >
                    Results
                  </button>
                </div>

                {/* Notification list */}
                <div className="-mx-4 max-h-[420px] overflow-y-auto border-t border-line custom-scrollbar">
                  {filteredHistory.length === 0 ? (
                    <div className="flex flex-col items-center px-4 py-8 text-center">
                      <svg className="icon text-fg-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
                        <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
                      </svg>
                      <p className="mt-3 text-sm text-fg">No alerts here</p>
                      <p className="meta mt-1 max-w-xs leading-relaxed">
                        Follow teams in your{' '}
                        <a href="/dashboard/" className="text-fg-2 hover:text-fg hover:underline">
                          watchlist
                        </a>{' '}
                        or star matches in{' '}
                        <a href="/npl/" className="text-fg-2 hover:text-fg hover:underline">
                          NPL 2026
                        </a>
                        . Alerts arrive 5 minutes before kickoff and during live moments.
                      </p>
                    </div>
                  ) : (
                    filteredHistory.map((item) => (
                      <div
                        key={item.id}
                        className={`row group min-h-[44px] items-start py-2 ${!item.read ? 'bg-ink-700/40' : ''}`}
                      >
                        <span className="mt-0.5 flex w-4 shrink-0 justify-center text-fg-3">
                          {renderTypeIcon(item.type)}
                        </span>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <a
                              href={item.matchUrl}
                              onClick={() => {
                                markNotificationAsRead(item.id);
                                setIsOpen(false);
                              }}
                              className="min-w-0 focus:outline-none"
                            >
                              <h4 className={`truncate text-sm leading-snug ${!item.read ? 'font-medium text-fg' : 'text-fg-2'} group-hover:text-fg transition-colors duration-fast ease-out`}>
                                {item.title}
                              </h4>
                            </a>
                            <span className="flex shrink-0 items-center gap-1.5">
                              <span className="clock meta">{formatTime(item.timestamp)}</span>
                              {!item.read && <span className="h-1.5 w-1.5 rounded-full bg-lime" aria-hidden="true" />}
                            </span>
                          </div>

                          <p className="meta mt-0.5 line-clamp-1 text-fg-2">{item.message}</p>

                          <div className="mt-1 flex items-center justify-between gap-2">
                            <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
                              <span className="rounded-md bg-ink-700 px-1.5 py-0.5 text-xs text-fg-2">{formatTypeLabel(item)}</span>
                              {item.competition && <span className="meta truncate">{item.competition}</span>}
                              {item.kickoffFormatted && <span className="clock meta">{item.kickoffFormatted}</span>}
                              {item.venue && <span className="meta truncate">{item.venue}</span>}
                            </div>

                            <div className="flex shrink-0 items-center gap-3">
                              <a
                                href={item.matchUrl}
                                onClick={() => {
                                  markNotificationAsRead(item.id);
                                  setIsOpen(false);
                                }}
                                className="inline-flex items-center gap-1 text-xs text-fg-2 hover:text-fg transition-colors duration-fast ease-out"
                              >
                                <span>View match</span>
                                <span aria-hidden="true">&rarr;</span>
                              </a>

                              {!item.read && (
                                <button
                                  type="button"
                                  onClick={() => markNotificationAsRead(item.id)}
                                  className="text-xs text-fg-3 hover:text-fg transition-colors duration-fast ease-out"
                                >
                                  Mark read
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Footer */}
                {history.length > 0 && (
                  <div className="flex items-center justify-between gap-2 border-t border-line pt-3">
                    <span className="meta">
                      {unreadCount === 0 ? (
                        'All caught up'
                      ) : (
                        <>
                          <span className="clock">{unreadCount}</span> unread
                        </>
                      )}
                    </span>
                    <button type="button" onClick={clearNotificationHistory} className="btn btn-ghost btn-sm">
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
