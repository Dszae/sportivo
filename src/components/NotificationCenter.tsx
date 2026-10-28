import React, { useEffect, useRef, useState } from 'react';
import {
  type NotificationAlert,
  clearNotificationHistory,
  dispatchNotification,
  evaluateMatchesForNotifications,
  getNotificationHistory,
  markAllNotificationsAsRead,
} from '../lib/notificationService';
import type { NplMatch } from '../lib/data/nplData';

export default function NotificationCenter() {
  const [isOpen, setIsOpen] = useState(false);
  const [history, setHistory] = useState<NotificationAlert[]>([]);
  const [activeToast, setActiveToast] = useState<NotificationAlert | null>(null);
  const [toastTimer, setToastTimer] = useState<NodeJS.Timeout | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Initialize and listen to storage & events
  useEffect(() => {
    setHistory(getNotificationHistory());

    // Silently request browser push permission on user's first click anywhere if supported
    const handleFirstUserInteraction = () => {
      if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission().catch(() => {});
      }
      window.removeEventListener('click', handleFirstUserInteraction);
    };
    window.addEventListener('click', handleFirstUserInteraction, { once: true });

    const handleHistoryUpdate = (e: Event) => {
      const ce = e as CustomEvent<NotificationAlert[]>;
      if (ce.detail) setHistory(ce.detail);
    };

    const handleLiveToast = (e: Event) => {
      const ce = e as CustomEvent<NotificationAlert>;
      if (ce.detail) {
        showToast(ce.detail);
      }
    };

    window.addEventListener('sportivo:notifications-updated', handleHistoryUpdate);
    window.addEventListener('sportivo:live-toast', handleLiveToast);

    // Close on outside click
    const handleOutsideClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);

    return () => {
      window.removeEventListener('click', handleFirstUserInteraction);
      window.removeEventListener('sportivo:notifications-updated', handleHistoryUpdate);
      window.removeEventListener('sportivo:live-toast', handleLiveToast);
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, []);

  // Background Match Poller (every 25 seconds)
  useEffect(() => {
    let isMounted = true;

    const pollMatches = async () => {
      try {
        const nplRes = await fetch('/api/npl/fixtures', { signal: AbortSignal.timeout(6000) });
        let nplData: NplMatch[] = [];
        if (nplRes.ok) {
          const json = await nplRes.json();
          nplData = json.fixtures || [];
        }

        if (isMounted) {
          evaluateMatchesForNotifications({}, nplData);
        }
      } catch {
        // network silent failover
      }
    };

    const initialTimer = setTimeout(pollMatches, 2000);
    const interval = setInterval(pollMatches, 25000);

    return () => {
      isMounted = false;
      clearTimeout(initialTimer);
      clearInterval(interval);
    };
  }, []);

  const showToast = (alert: NotificationAlert) => {
    if (toastTimer) clearTimeout(toastTimer);
    setActiveToast(alert);
    const timer = setTimeout(() => {
      setActiveToast(null);
    }, 6000);
    setToastTimer(timer);
  };

  const unreadCount = history.filter((h) => !h.read).length;

  const handleToggleDropdown = () => {
    // Silently ensure push permission
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {});
    }
    if (!isOpen && unreadCount > 0) {
      markAllNotificationsAsRead();
    }
    setIsOpen(!isOpen);
  };

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      {/* Bell Trigger Button */}
      <button
        type="button"
        onClick={handleToggleDropdown}
        aria-label="Match Notifications"
        title="Watchlist Match Notifications & Live Alerts"
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

      {/* Dropdown Modal — Completely automated without manual toggles */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl border border-white/15 bg-[#101716]/98 p-4 shadow-2xl backdrop-blur-xl z-50">
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-[#c9f36b] animate-ping" />
                <h3 className="text-sm font-black text-white">Watchlist Match Alerts</h3>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Automatic 5m warnings &amp; score updates for followed teams
              </p>
            </div>
            {history.length > 0 && (
              <button
                type="button"
                onClick={clearNotificationHistory}
                className="text-[11px] text-slate-400 hover:text-red-400 transition"
              >
                Clear all
              </button>
            )}
          </div>

          {/* Notifications List */}
          <div className="mt-3 max-h-80 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
            {history.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400">
                <span className="inline-block text-2xl mb-2">⭐</span>
                <p className="font-semibold text-slate-300">No match alerts yet.</p>
                <p className="mt-1.5 text-[11px] leading-relaxed text-slate-500">
                  Follow your favorite teams in{' '}
                  <a href="/dashboard/" className="text-[#c9f36b] hover:underline font-bold">
                    My Watchlist
                  </a>{' '}
                  or star matches in{' '}
                  <a href="/npl/" className="text-red-400 hover:underline font-bold">
                    NPL 2026
                  </a>
                  . Sportivo will automatically alert you 5 minutes before kickoff and during key score moments!
                </p>
              </div>
            ) : (
              history.map((alert) => (
                <a
                  key={alert.id}
                  href={alert.matchUrl}
                  onClick={() => setIsOpen(false)}
                  className="block rounded-xl border border-white/10 bg-white/5 p-3 hover:border-[#c9f36b]/40 hover:bg-white/10 transition-all text-left group"
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="inline-flex items-center gap-1 rounded-md bg-[#c9f36b]/15 px-1.5 py-0.5 text-[10px] font-black uppercase text-[#c9f36b]">
                      {alert.badgeText || alert.type}
                    </span>
                    <span className="text-[10px] text-slate-400">
                      {new Date(alert.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <h4 className="text-xs font-bold text-white group-hover:text-[#c9f36b] transition-colors">
                    {alert.title}
                  </h4>
                  <p className="mt-1 text-[11px] leading-relaxed text-slate-300">
                    {alert.message}
                  </p>
                </a>
              ))
            )}
          </div>
        </div>
      )}

      {/* Floating In-App Live Toast Banner */}
      {activeToast && (
        <div className="fixed bottom-6 right-6 z-50 max-w-sm sm:max-w-md animate-in fade-in slide-in-from-bottom-5 duration-300">
          <div className="rounded-2xl border border-[#c9f36b]/50 bg-[#101716]/95 p-4 shadow-2xl backdrop-blur-xl ring-1 ring-[#c9f36b]/30">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500"></span>
                </span>
                <span className="text-[11px] font-black uppercase tracking-wider text-[#c9f36b]">
                  {activeToast.badgeText || 'LIVE MATCH ALERT'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setActiveToast(null)}
                className="text-slate-400 hover:text-white text-xs p-1"
                aria-label="Close alert"
              >
                &times;
              </button>
            </div>

            <h4 className="mt-1.5 text-sm font-bold text-white">
              {activeToast.title}
            </h4>
            <p className="mt-1 text-xs leading-relaxed text-slate-300">
              {activeToast.message}
            </p>

            <div className="mt-3 flex items-center justify-between border-t border-white/10 pt-2.5">
              <span className="text-[10px] text-slate-400">Nepal Standard Time (NST)</span>
              <a
                href={activeToast.matchUrl}
                onClick={() => setActiveToast(null)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#c9f36b] px-3 py-1 text-xs font-bold text-[#080a0b] hover:bg-[#b0d859] transition shadow-md"
              >
                <span>Watch Stream</span>
                <span aria-hidden="true">&rarr;</span>
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
