import { useEffect, useMemo, useState } from 'react';
import { NPL_FIXTURES_2026, type NplMatch } from '../lib/data/nplData';
import { slugify, publicUrl } from '../lib/sportivo';

type Tab = 'today' | 'upcoming' | 'all';

/**
 * Returns date formatted as YYYY-MM-DD in Asia/Kathmandu (UTC+5:45)
 */
function getKathmanduYmd(date: Date = new Date()): string {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kathmandu',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(date);
  } catch {
    const offset = 5.75 * 60 * 60 * 1000;
    const nep = new Date(date.getTime() + offset);
    return nep.toISOString().slice(0, 10);
  }
}

/**
 * Formats time in Asia/Kathmandu (e.g. "5:00 PM NST")
 */
function formatKathmanduTime(timestamp: number): string {
  try {
    return (
      new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Kathmandu',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      }).format(new Date(timestamp)) + ' NST'
    );
  } catch {
    return '5:00 PM NST';
  }
}

/**
 * Formats date in Asia/Kathmandu (e.g. "Tue, 27 Oct 2026")
 */
function formatKathmanduDate(timestamp: number): string {
  try {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Kathmandu',
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(new Date(timestamp));
  } catch {
    return new Date(timestamp).toDateString();
  }
}

export default function NplSchedule() {
  const [activeTab, setActiveTab] = useState<Tab>('today');
  const [fixtures, setFixtures] = useState<NplMatch[]>(NPL_FIXTURES_2026);
  const [query, setQuery] = useState('');
  const [lastSyncTime, setLastSyncTime] = useState('Just now');

  // Real-time synchronization for live scores, results & broadcast availability
  useEffect(() => {
    let timer: any = null;

    async function syncFixtures() {
      try {
        const res = await fetch('/api/npl/fixtures/');
        if (res.ok) {
          const data = await res.json();
          if (data && Array.isArray(data.fixtures)) {
            setFixtures(data.fixtures);
            const now = new Date();
            setLastSyncTime(
              now.toLocaleTimeString('en-US', {
                timeZone: 'Asia/Kathmandu',
                hour: 'numeric',
                minute: '2-digit',
              }) + ' NST'
            );
          }
        }
      } catch {}
    }

    // Initial sync
    syncFixtures();

    // Poll every 30s when tab is active
    timer = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        syncFixtures();
      }
    }, 30000);

    return () => {
      if (timer) clearInterval(timer);
    };
  }, []);

  const todayYmd = useMemo(() => getKathmanduYmd(), []);

  // Classify matches into Today, Upcoming, and All
  const { todayMatches, upcomingMatches, allMatches, nextUpcoming } = useMemo(() => {
    const today: NplMatch[] = [];
    const upcoming: NplMatch[] = [];

    // Sort chronologically by timestamp
    const sorted = [...fixtures].sort((a, b) => a.timestamp - b.timestamp);

    for (const match of sorted) {
      const matchYmd = getKathmanduYmd(new Date(match.timestamp));
      if (matchYmd === todayYmd) {
        today.push(match);
      } else if (matchYmd > todayYmd) {
        upcoming.push(match);
      }
    }

    const next = upcoming.find((m) => m.status === 'UPCOMING') || upcoming[0] || null;

    return {
      todayMatches: today,
      upcomingMatches: upcoming,
      allMatches: sorted,
      nextUpcoming: next,
    };
  }, [fixtures, todayYmd]);

  // Select list based on active tab and query
  const displayedMatches = useMemo(() => {
    let list: NplMatch[] = [];
    if (activeTab === 'today') list = todayMatches;
    else if (activeTab === 'upcoming') list = upcomingMatches;
    else list = allMatches;

    if (!query.trim()) return list;
    const q = query.toLowerCase();
    return list.filter(
      (m) =>
        m.homeTeam.toLowerCase().includes(q) ||
        m.awayTeam.toLowerCase().includes(q) ||
        m.round.toLowerCase().includes(q) ||
        m.venue.toLowerCase().includes(q)
    );
  }, [activeTab, allMatches, query, todayMatches, upcomingMatches]);

  const renderMatchCard = (m: NplMatch) => {
    const matchSlug = slugify(`${m.homeTeam} vs ${m.awayTeam}`);
    const detailUrl = `/cricket/match/${encodeURIComponent(matchSlug)}/`;
    const isLive = m.status === 'LIVE';
    const isCompleted = m.status === 'COMPLETED';
    const hasAuthorizedBroadcast = Boolean(m.broadcast && m.broadcast.authorizedEmbedUrl);

    return (
      <div
        key={m.id}
        className={`relative flex flex-col justify-between overflow-hidden rounded-2xl border bg-[#0b100f] shadow-lg transition-all duration-300 hover:border-[#c9f36b]/40 ${
          isLive
            ? 'border-red-500/60 shadow-red-950/40 ring-1 ring-red-500/40'
            : isCompleted
            ? 'border-white/10 opacity-95'
            : 'border-white/10 hover:-translate-y-0.5'
        }`}
      >
        {/* Card Header: Round & Status Badge */}
        <div className="flex items-center justify-between border-b border-white/5 bg-white/[0.02] px-4 py-2.5 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-400">Match {m.matchNumber}</span>
            <span className="text-white/20">•</span>
            <span className="text-slate-400 font-medium">{m.round}</span>
          </div>

          <div>
            {isLive ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-red-600 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-white shadow-sm">
                <span className="h-1.5 w-1.5 animate-ping rounded-full bg-white" />
                LIVE
              </span>
            ) : isCompleted ? (
              <span className="rounded-md bg-white/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-300">
                COMPLETED
              </span>
            ) : (
              <span className="rounded-md border border-amber-400/30 bg-amber-400/10 px-2 py-0.5 text-[10px] font-bold text-amber-300">
                UPCOMING
              </span>
            )}
          </div>
        </div>

        {/* Card Body: Teams, Logos, and Scores */}
        <div className="p-4 sm:p-5">
          <div className="space-y-4">
            {/* Home Team Row */}
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                {m.homeTeamLogo ? (
                  <img
                    src={m.homeTeamLogo}
                    alt={m.homeTeam}
                    width="36"
                    height="36"
                    className="h-9 w-9 shrink-0 object-contain drop-shadow"
                    onError={(e) => {
                      (e.currentTarget as HTMLElement).style.display = 'none';
                    }}
                  />
                ) : (
                  <div
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-black text-white"
                    style={{ backgroundColor: m.homeTeamColor || '#c9f36b' }}
                  >
                    {m.homeTeamShort}
                  </div>
                )}
                <span className="truncate text-sm sm:text-base font-bold text-white">
                  {m.homeTeam}
                </span>
              </div>
              {m.homeScore && (
                <span className="text-sm sm:text-base font-black tabular-nums text-white shrink-0">
                  {m.homeScore}
                </span>
              )}
            </div>

            {/* Away Team Row */}
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                {m.awayTeamLogo ? (
                  <img
                    src={m.awayTeamLogo}
                    alt={m.awayTeam}
                    width="36"
                    height="36"
                    className="h-9 w-9 shrink-0 object-contain drop-shadow"
                    onError={(e) => {
                      (e.currentTarget as HTMLElement).style.display = 'none';
                    }}
                  />
                ) : (
                  <div
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-black text-white"
                    style={{ backgroundColor: m.awayTeamColor || '#38bdf8' }}
                  >
                    {m.awayTeamShort}
                  </div>
                )}
                <span className="truncate text-sm sm:text-base font-bold text-white">
                  {m.awayTeam}
                </span>
              </div>
              {m.awayScore && (
                <span className="text-sm sm:text-base font-black tabular-nums text-white shrink-0">
                  {m.awayScore}
                </span>
              )}
            </div>
          </div>

          {/* Match Result or Live Commentary Summary */}
          {m.summary && (
            <div className="mt-3.5 rounded-lg bg-white/5 px-3 py-1.5 text-xs font-medium text-[#c9f36b]">
              {m.summary}
            </div>
          )}

          {/* Kickoff & Venue Info */}
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-white/5 pt-3 text-[11px] text-slate-400">
            <div className="flex items-center gap-1.5 font-medium">
              <span>📅 {formatKathmanduDate(m.timestamp)}</span>
              <span>•</span>
              <span className="text-white font-semibold">{formatKathmanduTime(m.timestamp)}</span>
            </div>
            <span className="truncate max-w-[190px] text-slate-400" title={m.venue}>
              📍 {m.venue.replace('Tribhuvan University International Cricket Ground', 'TU Cricket Ground')}
            </span>
          </div>
        </div>

        {/* Card Footer: Action Buttons */}
        <div className="flex items-center justify-between gap-2 border-t border-white/5 bg-[#080d0c] px-4 py-3">
          <a
            href={detailUrl}
            className="text-xs font-bold text-slate-300 hover:text-white transition flex items-center gap-1"
          >
            <span>Match Details</span>
            <span aria-hidden="true">&rarr;</span>
          </a>

          {/* Watch Live Button strictly displayed ONLY when match is actively LIVE */}
          {isLive && hasAuthorizedBroadcast ? (
            <a
              href={detailUrl}
              className="inline-flex items-center gap-1.5 rounded-xl bg-red-600 px-3.5 py-1.5 text-xs font-black text-white shadow-md hover:bg-red-500 transition-all hover:scale-105"
            >
              <span className="h-2 w-2 rounded-full bg-white animate-pulse" />
              <span>Watch Live</span>
            </a>
          ) : (
            <span className="text-[11px] text-slate-400 italic">
              {isCompleted ? 'Match Concluded' : 'Broadcast TBA'}
            </span>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="w-full">
      {/* NPL Tournament Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-white/[0.08] pb-5">
        <div className="flex items-center gap-3.5">
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-red-600 to-red-800 font-black text-lg text-white shadow-md shadow-red-950/50">
            NPL
          </span>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white">
                Nepal Premier League (NPL) 2026
              </h2>
              {todayMatches.some((m) => m.status === 'LIVE') && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-red-500/15 border border-red-500/30 px-2.5 py-0.5 text-[11px] font-black text-red-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />
                  <span>LIVE MATCH ON AIR</span>
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400">
              Official Season Fixtures, Live Scores &amp; Broadcasting Desk — Synced to Nepal Standard Time (NST / UTC+5:45)
            </p>
          </div>
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-64">
          <span className="absolute left-3 top-2 text-slate-500 text-xs" aria-hidden="true">🔍</span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search teams or round..."
            className="w-full rounded-full border border-white/10 bg-[#101716] pl-8 pr-7 py-1.5 text-xs text-white placeholder-slate-500 focus:border-[#c9f36b] focus:outline-none transition"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="absolute right-2.5 top-1.5 text-xs text-slate-400 hover:text-white"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 bg-white/5 p-1 rounded-2xl border border-white/10">
          <button
            type="button"
            onClick={() => setActiveTab('today')}
            className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-1.5 text-xs font-bold transition-all ${
              activeTab === 'today'
                ? 'bg-[#c9f36b] text-[#080c0b] shadow-sm'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            <span>Today's Matches</span>
            <span
              className={`rounded-full px-1.5 py-0.2 text-[10px] ${
                activeTab === 'today' ? 'bg-black/20 text-[#080c0b]' : 'bg-white/10 text-slate-300'
              }`}
            >
              {todayMatches.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('upcoming')}
            className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-1.5 text-xs font-bold transition-all ${
              activeTab === 'upcoming'
                ? 'bg-[#c9f36b] text-[#080c0b] shadow-sm'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            <span>Upcoming Fixtures</span>
            <span
              className={`rounded-full px-1.5 py-0.2 text-[10px] ${
                activeTab === 'upcoming' ? 'bg-black/20 text-[#080c0b]' : 'bg-white/10 text-slate-300'
              }`}
            >
              {upcomingMatches.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('all')}
            className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-1.5 text-xs font-bold transition-all ${
              activeTab === 'all'
                ? 'bg-[#c9f36b] text-[#080c0b] shadow-sm'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            <span>All Season Matches</span>
            <span
              className={`rounded-full px-1.5 py-0.2 text-[10px] ${
                activeTab === 'all' ? 'bg-black/20 text-[#080c0b]' : 'bg-white/10 text-slate-300'
              }`}
            >
              {allMatches.length}
            </span>
          </button>
        </div>

        <div className="flex items-center gap-2 text-[11px] text-slate-400">
          <span className="h-2 w-2 rounded-full bg-emerald-500" />
          <span>TU International Cricket Ground, Kirtipur</span>
        </div>
      </div>

      {/* Main Content Area */}
      {displayedMatches.length === 0 ? (
        activeTab === 'today' ? (
          /* Empty state for Today's matches with next upcoming match clearly highlighted */
          <div className="rounded-2xl border border-white/10 bg-[#070d0c] p-8 text-center space-y-4">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-white/5 text-2xl">
              🏏
            </div>
            <div>
              <h3 className="text-base font-bold text-white">No NPL Matches Scheduled For Today</h3>
              <p className="mt-1 text-xs text-slate-400">
                There are no Nepal Premier League matches scheduled for today ({formatKathmanduDate(Date.now())}).
              </p>
            </div>

            {nextUpcoming && (
              <div className="mx-auto max-w-md rounded-xl border border-white/10 bg-[#0d1413] p-4 text-left">
                <span className="text-[10px] font-bold uppercase tracking-widest text-[#c9f36b]">
                  Next Scheduled Match
                </span>
                <p className="mt-1 font-bold text-white text-sm">
                  {nextUpcoming.homeTeam} vs {nextUpcoming.awayTeam}
                </p>
                <p className="text-xs text-slate-400 mt-0.5">
                  📅 {formatKathmanduDate(nextUpcoming.timestamp)} at {formatKathmanduTime(nextUpcoming.timestamp)}
                </p>
              </div>
            )}

            <button
              type="button"
              onClick={() => setActiveTab('upcoming')}
              className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs font-bold text-[#c9f36b] hover:bg-white/10 transition"
            >
              <span>View Upcoming NPL Schedule &rarr;</span>
            </button>
          </div>
        ) : (
          <div className="rounded-2xl border border-white/10 bg-[#070d0c] py-12 px-6 text-center">
            <p className="font-bold text-slate-300">No matches found matching "{query}"</p>
            <button
              type="button"
              onClick={() => setQuery('')}
              className="mt-3 text-xs font-bold text-[#c9f36b] underline"
            >
              Clear search filter
            </button>
          </div>
        )
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {displayedMatches.map((m) => renderMatchCard(m))}
        </div>
      )}
    </div>
  );
}

