import { useEffect, useMemo, useState } from 'react';
import type { Category, FootballLeague, Match } from '../lib/sportivo';
import {
  FOOTBALL_LEAGUES,
  detectFootballLeague,
  isMatchOnDate,
  publicUrl,
  slugify,
  statusOf,
  timeOf,
  titleOf,
} from '../lib/sportivo';
import { loadUserPreferences, saveUserPreferences, type UserPreferences } from '../lib/preferences';

type Props = { category: Category; matches: Match[] };
type DateFilter = 'all' | 'today' | 'tomorrow' | 'week';

function teamParts(title: string) {
  const parts = title.split(/\s+vs\.?\s+|\s+-\s+/i);
  return { first: parts[0]?.trim() || title, second: parts[1]?.trim() || '' };
}

export default function MatchExplorer({ category, matches }: Props) {
  const [query, setQuery] = useState('');
  const [selectedLeague, setSelectedLeague] = useState<FootballLeague>('All');
  const [dateFilter, setDateFilter] = useState<DateFilter>('all');
  const [showWatchlistOnly, setShowWatchlistOnly] = useState(false);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());
  const [timeZone, setTimeZone] = useState<'Asia/Kathmandu' | string>('Asia/Kathmandu');

  const categoryLabel = category[0].toUpperCase() + category.slice(1);

  // Initialize client preferences from shared preferences and sync across tabs
  useEffect(() => {
    const prefs = loadUserPreferences();
    setFavorites(prefs.starredMatches);
    if (prefs.timeZone) setTimeZone(prefs.timeZone);

    try {
      const savedSearches = localStorage.getItem('sportivo_searches');
      if (savedSearches) setRecentSearches(JSON.parse(savedSearches));
    } catch {}

    const handlePrefChange = (e: Event) => {
      const customEvent = e as CustomEvent<UserPreferences>;
      const current = customEvent.detail || loadUserPreferences();
      setFavorites(current.starredMatches || []);
      if (current.timeZone) setTimeZone(current.timeZone);
    };

    window.addEventListener('sportivo:preferences-changed', handlePrefChange);
    window.addEventListener('storage', handlePrefChange);
    return () => {
      window.removeEventListener('sportivo:preferences-changed', handlePrefChange);
      window.removeEventListener('storage', handlePrefChange);
    };
  }, []);

  const toggleFavorite = (slug: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const currentPrefs = loadUserPreferences();
    const nextFavorites = currentPrefs.starredMatches.includes(slug)
      ? currentPrefs.starredMatches.filter((s) => s !== slug)
      : [...currentPrefs.starredMatches, slug];
    
    saveUserPreferences({ ...currentPrefs, starredMatches: nextFavorites });
    setFavorites(nextFavorites);
  };

  const handleSearchSubmit = (val: string) => {
    const trimmed = val.trim();
    if (!trimmed) return;
    setRecentSearches((prev) => {
      const updated = [trimmed, ...prev.filter((item) => item.toLowerCase() !== trimmed.toLowerCase())].slice(0, 5);
      try {
        localStorage.setItem('sportivo_searches', JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  const leagueCounts = useMemo(() => {
    if (category !== 'football') return {} as Record<FootballLeague, number>;
    const counts: Record<FootballLeague, number> = {
      All: matches.length,
      'Champions League': 0,
      'Premier League': 0,
      'La Liga': 0,
      'Bundesliga': 0,
      'Serie A': 0,
      MLS: 0,
      'Other Leagues': 0,
    };
    matches.forEach((m) => {
      const l = detectFootballLeague(m);
      counts[l] = (counts[l] || 0) + 1;
    });
    return counts;
  }, [category, matches]);

  const filtered = useMemo(() => {
    const value = query.trim().toLowerCase();
    let list = matches;

    // Filter by Watchlist
    if (showWatchlistOnly) {
      list = list.filter((m) => favorites.includes(slugify(titleOf(m))));
    }

    // Filter by League (football)
    if (category === 'football' && selectedLeague !== 'All') {
      list = list.filter((m) => detectFootballLeague(m) === selectedLeague);
    }

    // Filter by Date
    if (dateFilter !== 'all') {
      list = list.filter((m) => isMatchOnDate(m, dateFilter, timeZone));
    }

    // Filter by Search Query
    if (value) {
      list = list.filter((match) => {
        const league = category === 'football' ? detectFootballLeague(match) : '';
        return `${titleOf(match)} ${match.category || category} ${league}`.toLowerCase().includes(value);
      });
    }

    return [...list].sort((a, b) => {
      const timeA = typeof a.date === 'number' ? a.date : new Date(a.date || a.startTime || a.start_at || a.timestamp || 0).getTime() || 0;
      const timeB = typeof b.date === 'number' ? b.date : new Date(b.date || b.startTime || b.start_at || b.timestamp || 0).getTime() || 0;
      return timeA - timeB;
    });
  }, [category, dateFilter, favorites, matches, query, selectedLeague, showWatchlistOnly, timeZone]);

  const liveMatches = useMemo(() => filtered.filter((m) => statusOf(m) === 'Live'), [filtered]);
  const upcomingMatches = useMemo(() => filtered.filter((m) => statusOf(m) === 'Upcoming'), [filtered]);
  const finalMatches = useMemo(() => filtered.filter((m) => statusOf(m) === 'Final'), [filtered]);

  const activeLeagueLabel = selectedLeague === 'All' ? categoryLabel : selectedLeague;

  const renderCard = (match: Match, index: number) => {
    const title = titleOf(match);
    const slug = slugify(title);
    const isFav = favorites.includes(slug);
    const status = statusOf(match);
    const isLive = status === 'Live';
    const { first, second } = teamParts(title);
    const poster = publicUrl(match.poster || match.image || match.thumbnail || undefined);
    const matchLeague = category === 'football' ? detectFootballLeague(match) : null;
    const formattedTime = timeOf(match, timeZone);

    return (
      <a
        key={`${slug}-${index}`}
        href={`/${category}/match/${encodeURIComponent(slug)}/`}
        className={`group relative overflow-hidden rounded-2xl border bg-[#111a19] shadow-xl shadow-black/10 transition-all duration-300 hover:-translate-y-1 hover:border-[#e5b94f]/50 focus:outline-none focus:ring-2 focus:ring-[#c9f36b] ${
          isLive ? 'border-red-500/50 ring-1 ring-red-500/30' : 'border-white/10'
        }`}
      >
        {/* Watchlist Favorite Toggle Button */}
        <button
          type="button"
          onClick={(e) => toggleFavorite(slug, e)}
          aria-label={isFav ? `Remove ${title} from watchlist` : `Add ${title} to watchlist`}
          className="absolute right-2.5 top-2.5 z-20 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-sm transition-transform hover:scale-110 focus:outline-none"
        >
          <span className={`text-sm ${isFav ? 'text-amber-400' : 'text-slate-400 hover:text-white'}`}>
            {isFav ? '★' : '☆'}
          </span>
        </button>

        <div className="relative flex h-36 w-full items-center justify-center overflow-hidden bg-gradient-to-br from-[#182b2a] via-[#18212b] to-[#111a19]">
          <span
            className={`absolute left-2 top-2 z-10 flex items-center gap-1.5 rounded px-2 py-1 text-[10px] font-bold text-white shadow-md ${
              isLive ? 'bg-red-600 font-black tracking-wider' : 'bg-black/80'
            }`}
          >
            {isLive && <span className="inline-block h-1.5 w-1.5 animate-ping rounded-full bg-white"></span>}
            {isLive ? 'LIVE' : status === 'Final' ? 'Final' : formattedTime}
          </span>
          {poster ? (
            <img
              src={poster}
              alt={`${title} live stream broadcast banner`}
              width="288"
              height="144"
              loading="lazy"
              decoding="async"
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
          ) : (
            <div className="px-4 text-center text-sm font-bold text-slate-300">
              <span>{first}</span>
              {second && (
                <>
                  <span className="mx-2 text-[#c9f36b]">vs</span>
                  <span>{second}</span>
                </>
              )}
            </div>
          )}
        </div>
        <div className="p-3">
          <h3 className="line-clamp-2 text-sm font-bold text-slate-100 group-hover:text-[#e5b94f]">{title}</h3>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-400">
            <span>{match.category || category}</span>
            {matchLeague && (
              <>
                <span>•</span>
                <span className="rounded bg-white/10 px-1 py-0.2 text-[9px] font-bold tracking-normal text-[#e5b94f]">
                  {matchLeague}
                </span>
              </>
            )}
            <span>•</span>
            <span className={isLive ? 'font-black text-red-400' : ''}>
              {isLive ? 'Broadcasting Now' : status === 'Final' ? 'Final' : formattedTime}
            </span>
          </div>
        </div>
      </a>
    );
  };

  return (
    <section aria-labelledby={`schedule-title-${category}`}>
      {/* Header & Controls Toolbar */}
      <div className="mb-6 flex flex-col items-start justify-between gap-4 md:flex-row md:items-end">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-widest text-[#e5b94f]">Schedule</span>
            <span className="text-slate-600">•</span>
            <span className="inline-flex items-center gap-1 text-[10px] text-slate-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
              Live Sync
            </span>
          </div>
          <h2 id={`schedule-title-${category}`} className="text-2xl font-black text-white mt-0.5">
            {showWatchlistOnly ? '★ My Watchlist' : selectedLeague === 'All' ? `${categoryLabel}` : selectedLeague}
          </h2>
          <p className="mt-1 text-xs text-slate-400">
            {filtered.length} matches scheduled.
          </p>
        </div>

        <div className="w-full sm:w-72">
          {/* Search Box */}
          <div className="relative w-full">
            <label htmlFor={`search-${category}`} className="sr-only">Search matches or teams</label>
            <input
              id={`search-${category}`}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSearchSubmit(query);
              }}
              placeholder="Search matches or teams..."
              className="w-full rounded-lg border border-white/10 bg-[#111a19] px-4 py-2 text-sm text-white placeholder-slate-500 focus:border-[#c9f36b] focus:outline-none"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="absolute right-2.5 top-2.5 text-xs text-slate-400 hover:text-white"
                aria-label="Clear search"
              >
                ✕
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Date Navigation & Watchlist Pill Tabs */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-white/5 pb-4">
        <div className="flex flex-wrap items-center gap-2">
          {(['all', 'today', 'tomorrow', 'week'] as const).map((filter) => (
            <button
              key={filter}
              type="button"
              onClick={() => {
                setDateFilter(filter);
                setShowWatchlistOnly(false);
              }}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold capitalize transition ${
                dateFilter === filter && !showWatchlistOnly
                  ? 'bg-white/15 text-[#c9f36b]'
                  : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
              }`}
            >
              {filter === 'all' ? 'All Dates' : filter === 'week' ? 'Next 7 Days' : filter}
            </button>
          ))}

          {/* Watchlist Filter Pill */}
          <button
            type="button"
            onClick={() => setShowWatchlistOnly(!showWatchlistOnly)}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition ${
              showWatchlistOnly
                ? 'bg-amber-400/20 text-amber-300 ring-1 ring-amber-400/40'
                : 'text-slate-400 hover:bg-white/5 hover:text-amber-300'
            }`}
          >
            <span>★ Watchlist</span>
            {favorites.length > 0 && (
              <span className="rounded-full bg-amber-400/20 px-1.5 py-0.2 text-[10px] text-amber-300">
                {favorites.length}
              </span>
            )}
          </button>
        </div>

        {/* Manual Refresh & Status */}
        <div className="flex items-center gap-3 text-xs text-slate-500">
          <span>Refreshed: {lastRefreshed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          <button
            type="button"
            onClick={() => setLastRefreshed(new Date())}
            className="rounded p-1 text-slate-400 hover:bg-white/5 hover:text-white transition"
            title="Refresh schedule"
            aria-label="Refresh schedule"
          >
            ↻
          </button>
        </div>
      </div>

      {/* League Filter Pills for Football */}
      {category === 'football' && !showWatchlistOnly && (
        <div className="mb-6 flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none" role="tablist" aria-label="Football league filters">
          {FOOTBALL_LEAGUES.map((league) => {
            const count = leagueCounts[league] || 0;
            if (league !== 'All' && count === 0) return null;
            const isSelected = selectedLeague === league;
            return (
              <button
                key={league}
                type="button"
                role="tab"
                aria-selected={isSelected}
                onClick={() => setSelectedLeague(league)}
                className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-bold transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[#c9f36b] ${
                  isSelected
                    ? 'bg-[#c9f36b] text-[#0a1110] shadow-md shadow-[#c9f36b]/20 ring-2 ring-[#c9f36b]'
                    : 'border border-white/10 bg-white/5 text-slate-300 hover:border-white/20 hover:bg-white/10 hover:text-white'
                }`}
              >
                <span>{league === 'All' ? 'All Leagues' : league}</span>
                <span
                  className={`rounded-full px-1.5 py-0.2 text-[10px] font-black ${
                    isSelected ? 'bg-black/20 text-[#0a1110]' : 'bg-white/10 text-slate-400'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Recent Searches Pills */}
      {recentSearches.length > 0 && !query && (
        <div className="mb-6 flex flex-wrap items-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Recent searches:</span>
          {recentSearches.map((term, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setQuery(term)}
              className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-slate-300 hover:border-[#c9f36b]/40 hover:text-[#c9f36b] transition"
            >
              {term}
            </button>
          ))}
          <button
            type="button"
            onClick={() => {
              setRecentSearches([]);
              try {
                localStorage.removeItem('sportivo_searches');
              } catch {}
            }}
            className="text-[10px] text-slate-500 hover:text-slate-300 underline transition ml-1"
          >
            Clear
          </button>
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-slate-800 bg-[#12161f] py-16 text-center">
          <p className="font-medium text-slate-300">No fixtures found for this sport.</p>
          <p className="mt-2 text-sm text-slate-500">
            {showWatchlistOnly
              ? 'You have not added any matches to your watchlist yet. Tap the ☆ star on any fixture card to track it.'
              : selectedLeague !== 'All'
              ? `No fixtures match your search in ${selectedLeague}. Try selecting "All Leagues" or searching another term.`
              : 'Try another search or check back when the schedule updates.'}
          </p>
          {(selectedLeague !== 'All' || showWatchlistOnly || dateFilter !== 'all') && (
            <button
              type="button"
              onClick={() => {
                setSelectedLeague('All');
                setShowWatchlistOnly(false);
                setDateFilter('all');
                setQuery('');
              }}
              className="mt-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs font-bold text-[#c9f36b] hover:bg-white/10 transition"
            >
              <span>Reset all filters</span>
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-10">
          {/* Section 1: Live Matches */}
          <div>
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="relative flex h-3 w-3">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex h-3 w-3 rounded-full bg-red-500"></span>
                </span>
                <h3 className="text-base font-black text-white sm:text-lg">
                  {selectedLeague !== 'All'
                    ? `Live — ${selectedLeague}`
                    : 'Live Matches'}
                </h3>
              </div>
              {liveMatches.length > 0 && (
                <span className="rounded-full border border-red-500/40 bg-red-500/10 px-2.5 py-0.5 text-[11px] font-black text-red-400">
                  {liveMatches.length} LIVE
                </span>
              )}
            </div>

            {liveMatches.length > 0 ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {liveMatches.map((match, index) => renderCard(match, index))}
              </div>
            ) : (
              <div className="rounded-2xl border border-white/10 bg-gradient-to-r from-[#111a19] via-[#0d1615] to-[#111a19] p-6 text-center shadow-lg">
                <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full border border-slate-700 bg-white/5 text-slate-400">
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <circle cx="12" cy="12" r="10"></circle>
                    <polyline points="12 6 12 12 16 14"></polyline>
                  </svg>
                </div>
                <p className="mt-3 text-sm font-bold text-white">
                  {selectedLeague !== 'All'
                    ? `No live matches right now in ${selectedLeague}.`
                    : 'No matches currently broadcasting live.'}
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  Upcoming events and verified broadcast streams are scheduled below.
                </p>
              </div>
            )}
          </div>

          {/* Section 2: Upcoming Matches */}
          {upcomingMatches.length > 0 && (
            <div>
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-[#c9f36b]"></span>
                  <h3 className="text-base font-black text-white sm:text-lg">
                    {selectedLeague !== 'All'
                      ? `Upcoming — ${selectedLeague}`
                      : 'Upcoming Matches'}
                  </h3>
                </div>
                <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-[11px] font-semibold text-slate-400">
                  {upcomingMatches.length} Scheduled
                </span>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {upcomingMatches.map((match, index) => renderCard(match, index))}
              </div>
            </div>
          )}

          {/* Section 3: Completed / Final Matches (if any) */}
          {finalMatches.length > 0 && (
            <div>
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-slate-500"></span>
                  <h3 className="text-base font-black text-slate-400 sm:text-lg">Recent Results</h3>
                </div>
                <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-[11px] font-semibold text-slate-500">
                  {finalMatches.length} Final
                </span>
              </div>

              <div className="grid grid-cols-1 gap-4 opacity-75 sm:grid-cols-2 lg:grid-cols-4">
                {finalMatches.map((match, index) => renderCard(match, index))}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}