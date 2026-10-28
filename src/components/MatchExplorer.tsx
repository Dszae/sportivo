import { useEffect, useMemo, useState } from 'react';
import type { Category, FootballLeague, Match } from '../lib/sportivo';
import {
  FOOTBALL_LEAGUES,
  detectFootballLeague,
  getSafeThumbnailUrl,
  isMatchOnDate,
  publicUrl,
  slugify,
  statusOf,
  timeOf,
  titleOf,
} from '../lib/sportivo';
import { loadUserPreferences, saveUserPreferences, type UserPreferences } from '../lib/preferences';
import { playNotificationChime } from '../lib/notificationService';

type Props = { category: Category; matches: Match[]; exploreUrl?: string };
type DateFilter = 'all' | 'today' | 'tomorrow' | 'week';

function teamParts(title: string) {
  const parts = title.split(/\s+vs\.?\s+|\s+-\s+/i);
  return { first: parts[0]?.trim() || title, second: parts[1]?.trim() || '' };
}

export default function MatchExplorer({ category, matches, exploreUrl }: Props) {
  const [query, setQuery] = useState('');
  const [selectedLeague, setSelectedLeague] = useState<FootballLeague>('All');
  const [dateFilter, setDateFilter] = useState<DateFilter>('all');
  const [showWatchlistOnly, setShowWatchlistOnly] = useState(false);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [favoriteTeams, setFavoriteTeams] = useState<string[]>([]);
  const [timeZone, setTimeZone] = useState<'Asia/Kathmandu' | string>('Asia/Kathmandu');
  const [visibleCount, setVisibleCount] = useState(16);

  const categoryLabel = category[0].toUpperCase() + category.slice(1);

  useEffect(() => {
    setVisibleCount(16);
  }, [selectedLeague, dateFilter, query, showWatchlistOnly]);

  // Sync client preferences (starred matches, favorite teams & timezone)
  useEffect(() => {
    const prefs = loadUserPreferences();
    setFavorites(prefs.starredMatches || []);
    setFavoriteTeams(prefs.favoriteTeams || []);
    if (prefs.timeZone) setTimeZone(prefs.timeZone);

    const handlePrefChange = (e: Event) => {
      const customEvent = e as CustomEvent<UserPreferences>;
      const current = customEvent.detail || loadUserPreferences();
      setFavorites(current.starredMatches || []);
      setFavoriteTeams(current.favoriteTeams || []);
      if (current.timeZone) setTimeZone(current.timeZone);
    };

    window.addEventListener('sportivo:preferences-changed', handlePrefChange);
    window.addEventListener('storage', handlePrefChange);
    return () => {
      window.removeEventListener('sportivo:preferences-changed', handlePrefChange);
      window.removeEventListener('storage', handlePrefChange);
    };
  }, []);

  // Check if a match belongs to the user's watchlist (via starred matches or followed teams)
  const isMatchInWatchlist = (match: Match) => {
    const title = titleOf(match);
    const slug = slugify(title);
    if (favorites.includes(slug)) return true;
    if (favoriteTeams.length > 0) {
      const titleLower = title.toLowerCase();
      if (favoriteTeams.some((team) => titleLower.includes(team.toLowerCase()))) {
        return true;
      }
    }
    return false;
  };

  // Only count active fixtures in THIS category/explorer that belong to the user's watchlist
  const activeWatchlistMatches = useMemo(() => {
    return matches.filter((m) => {
      if (statusOf(m) === 'Final') return false;
      return isMatchInWatchlist(m);
    });
  }, [matches, favorites, favoriteTeams]);

  const watchlistCount = activeWatchlistMatches.length;

  const toggleFavorite = (slug: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const currentPrefs = loadUserPreferences();
    const isAdding = !currentPrefs.starredMatches.includes(slug);
    const nextFavorites = isAdding
      ? [...currentPrefs.starredMatches, slug]
      : currentPrefs.starredMatches.filter((s) => s !== slug);

    saveUserPreferences({ ...currentPrefs, starredMatches: nextFavorites });
    setFavorites(nextFavorites);
  };

  // Only count active fixtures (exclude finished/Final results per user instruction)
  const leagueCounts = useMemo(() => {
    if (category !== 'football') return {} as Record<FootballLeague, number>;
    const counts: Record<FootballLeague, number> = {
      All: 0,
      'Premier League': 0,
      'La Liga': 0,
      'Champions League': 0,
      'Bundesliga': 0,
      'Ligue 1': 0,
      'Serie A': 0,
      MLS: 0,
      'Other Leagues': 0,
    };

    // Filter active matches by date if dateFilter is active
    const active = matches.filter((m) => {
      if (statusOf(m) === 'Final') return false;
      if (dateFilter !== 'all' && !isMatchOnDate(m, dateFilter, timeZone)) return false;
      return true;
    });

    counts.All = active.length;
    active.forEach((m) => {
      const l = detectFootballLeague(m);
      counts[l] = (counts[l] || 0) + 1;
    });
    return counts;
  }, [category, matches, dateFilter, timeZone]);

  // If currently selected league has 0 matches under the active filter, auto-reset to 'All'
  useEffect(() => {
    if (selectedLeague !== 'All' && (leagueCounts[selectedLeague] || 0) === 0) {
      setSelectedLeague('All');
    }
  }, [leagueCounts, selectedLeague]);

  // Only display leagues that actually have 1 or more fixtures
  const availableLeagues = useMemo(() => {
    if (category !== 'football') return [];
    return FOOTBALL_LEAGUES.filter((l) => l === 'All' || (leagueCounts[l] || 0) > 0);
  }, [category, leagueCounts]);

  const filtered = useMemo(() => {
    const value = query.trim().toLowerCase();
    // Exclude completed/final matches
    let list = matches.filter((m) => statusOf(m) !== 'Final');

    // Filter by Watchlist
    if (showWatchlistOnly) {
      list = list.filter((m) => isMatchInWatchlist(m));
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
  }, [category, dateFilter, favorites, favoriteTeams, matches, query, selectedLeague, showWatchlistOnly, timeZone]);

  const liveMatches = useMemo(() => filtered.filter((m) => statusOf(m) === 'Live'), [filtered]);
  const upcomingMatches = useMemo(() => filtered.filter((m) => statusOf(m) === 'Upcoming'), [filtered]);

  const hasTomorrowMatches = useMemo(
    () => matches.some((m) => statusOf(m) !== 'Final' && isMatchOnDate(m, 'tomorrow', timeZone)),
    [matches, timeZone]
  );
  const hasWeekMatches = useMemo(
    () => matches.some((m) => statusOf(m) !== 'Final' && isMatchOnDate(m, 'week', timeZone)),
    [matches, timeZone]
  );

  const availableDateFilters = useMemo(() => {
    const filters: DateFilter[] = ['all'];
    const hasToday = matches.some((m) => statusOf(m) !== 'Final' && isMatchOnDate(m, 'today', timeZone));
    if (hasToday) filters.push('today');
    if (hasTomorrowMatches) filters.push('tomorrow');
    if (hasWeekMatches) filters.push('week');
    return filters;
  }, [hasTomorrowMatches, hasWeekMatches, matches, timeZone]);

  useEffect(() => {
    if (dateFilter === 'tomorrow' && !hasTomorrowMatches) setDateFilter('all');
    if (dateFilter === 'week' && !hasWeekMatches) setDateFilter('all');
  }, [dateFilter, hasTomorrowMatches, hasWeekMatches]);

  const displayedUpcoming = useMemo(() => upcomingMatches.slice(0, visibleCount), [upcomingMatches, visibleCount]);
  const remainingUpcoming = upcomingMatches.length - displayedUpcoming.length;

  const sportIcon = category === 'football' ? '⚽' : category === 'cricket' ? '🏏' : '🏀';

  const renderCard = (match: Match, index: number) => {
    const title = titleOf(match);
    const slug = slugify(title);
    const isFav = isMatchInWatchlist(match);
    const status = statusOf(match);
    const isLive = status === 'Live';
    const { first, second } = teamParts(title);
    const rawPoster = match.poster || match.image || match.thumbnail || undefined;
    const defaultThumbnail =
      getSafeThumbnailUrl(
        category === 'cricket'
          ? 'https://static.ppvservices.st/assets/thumb/2e3cba2a94ae6af4b958675e73fe91e9-thumbnail.jpg'
          : category === 'basketball'
          ? 'https://images.unsplash.com/photo-1546519638-68e109498ffc?q=80&w=600&auto=format&fit=crop'
          : 'https://images.unsplash.com/photo-1522778119026-d647f0596c20?q=80&w=600&auto=format&fit=crop'
      ) || '/sportivo-video-thumbnail.png';
    const poster = getSafeThumbnailUrl(publicUrl(rawPoster) || rawPoster) || defaultThumbnail;
    const matchLeague = category === 'football' ? detectFootballLeague(match) : null;
    const formattedTime = timeOf(match, timeZone);

    return (
      <a
        key={`${slug}-${index}`}
        href={`/${category}/match/${encodeURIComponent(slug)}/`}
        className={`group relative flex flex-col justify-between overflow-hidden rounded-2xl border bg-[#0b100f] shadow-lg shadow-black/30 transition-all duration-300 hover:-translate-y-1 hover:border-[#c9f36b]/40 hover:shadow-xl hover:shadow-[#c9f36b]/10 focus:outline-none focus:ring-2 focus:ring-[#c9f36b] ${
          isLive ? 'border-red-500/50 ring-1 ring-red-500/30' : 'border-white/10'
        }`}
      >
        {/* Watchlist Star Toggle */}
        <button
          type="button"
          onClick={(e) => toggleFavorite(slug, e)}
          aria-label={isFav ? `Remove ${title} from watchlist` : `Add ${title} to watchlist`}
          className="absolute right-2.5 top-2.5 z-20 flex h-7 w-7 items-center justify-center rounded-full bg-black/75 border border-white/10 text-white backdrop-blur-sm transition-transform hover:scale-110 focus:outline-none"
        >
          <span aria-hidden="true" className={`text-xs ${isFav ? 'text-amber-400 font-bold' : 'text-slate-400 hover:text-white'}`}>
            {isFav ? '★' : '☆'}
          </span>
        </button>

        {/* Thumbnail Stage */}
        <div className="relative flex h-36 w-full items-center justify-center overflow-hidden bg-[#070c0b]">
          <img
            src={poster}
            alt={title}
            width="288"
            height="144"
            loading="lazy"
            decoding="async"
            onError={(e) => {
              const el = e.currentTarget as HTMLImageElement;
              if (el.src !== defaultThumbnail && el.src !== '/sportivo-video-thumbnail.png') {
                el.src = defaultThumbnail;
              } else {
                el.src = '/sportivo-video-thumbnail.png';
              }
            }}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />

          {/* Vignette */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#0b100f] via-black/20 to-black/30 pointer-events-none" />

          {/* Status Badge */}
          <span
            className={`absolute left-2.5 top-2.5 z-20 flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[10px] font-bold shadow-md ${
              isLive ? 'bg-red-600 font-black tracking-wider text-white' : 'bg-[#060a09]/90 border border-white/10 text-slate-200 backdrop-blur-sm'
            }`}
          >
            {isLive && <span className="inline-block h-1.5 w-1.5 animate-ping rounded-full bg-white" aria-hidden="true" />}
            {isLive ? 'LIVE' : `${formattedTime} NST`}
          </span>

          {/* Team Crests Overlay */}
          {match.teams && typeof match.teams === 'object' && (match.teams.home || match.teams.away) && (
            <div className="absolute inset-x-2 bottom-2 z-10 flex items-center justify-between gap-2 rounded-xl bg-black/70 px-2.5 py-1 backdrop-blur-md border border-white/10">
              <div className="flex items-center gap-1.5 flex-1 min-w-0">
                <div className="relative flex h-5 w-5 shrink-0 items-center justify-center">
                  {match.teams.home?.badge && (
                    <img
                      src={getSafeThumbnailUrl(match.teams.home.badge)}
                      alt=""
                      width="20"
                      height="20"
                      className="h-5 w-5 shrink-0 object-contain drop-shadow"
                      onError={(e) => {
                        const el = e.currentTarget as HTMLElement;
                        el.style.display = 'none';
                        const fallback = el.parentElement?.querySelector('.team-badge-fallback') as HTMLElement;
                        if (fallback) fallback.style.display = 'flex';
                      }}
                    />
                  )}
                  <span
                    className="team-badge-fallback h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/15 text-[9px] font-black text-[#c9f36b]"
                    style={{ display: match.teams.home?.badge ? 'none' : 'flex' }}
                  >
                    {(match.teams.home?.name || first || 'H').slice(0, 2).toUpperCase()}
                  </span>
                </div>
                <span className="truncate text-[11px] font-bold text-white">
                  {match.teams.home?.name || first}
                </span>
              </div>

              <span className="text-[10px] font-black text-[#c9f36b] shrink-0 px-1">VS</span>

              <div className="flex items-center justify-end gap-1.5 flex-1 min-w-0">
                <span className="truncate text-[11px] font-bold text-white text-right">
                  {match.teams.away?.name || second}
                </span>
                <div className="relative flex h-5 w-5 shrink-0 items-center justify-center">
                  {match.teams.away?.badge && (
                    <img
                      src={getSafeThumbnailUrl(match.teams.away.badge)}
                      alt=""
                      width="20"
                      height="20"
                      className="h-5 w-5 shrink-0 object-contain drop-shadow"
                      onError={(e) => {
                        const el = e.currentTarget as HTMLElement;
                        el.style.display = 'none';
                        const fallback = el.parentElement?.querySelector('.team-badge-fallback') as HTMLElement;
                        if (fallback) fallback.style.display = 'flex';
                      }}
                    />
                  )}
                  <span
                    className="team-badge-fallback h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/15 text-[9px] font-black text-[#c9f36b]"
                    style={{ display: match.teams.away?.badge ? 'none' : 'flex' }}
                  >
                    {(match.teams.away?.name || second || 'A').slice(0, 2).toUpperCase()}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Metadata Footer */}
        <div className="p-3.5 bg-[#070b0a] border-t border-white/5">
          <h3 className="truncate text-sm font-black text-slate-100 group-hover:text-[#c9f36b] transition-colors">
            {title}
          </h3>
          <p className="mt-0.5 truncate text-xs text-slate-400 font-medium">
            {match.competition || matchLeague || `${categoryLabel} Broadcast`}
          </p>

          <div className="mt-2.5 flex items-center justify-between text-[10px] font-bold">
            <span className="rounded bg-white/5 px-2 py-0.5 uppercase tracking-wider text-slate-300 border border-white/5">
              {matchLeague || category}
            </span>
            {isLive ? (
              <span className="flex items-center gap-1 font-black text-red-400">
                <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />
                <span>Broadcasting Live</span>
              </span>
            ) : (
              <span className="font-mono text-[11px] font-bold text-[#c9f36b]">
                {formattedTime} NST
              </span>
            )}
          </div>
        </div>
      </a>
    );
  };

  return (
    <div aria-labelledby={`section-title-${category}`} className="w-full">
      {/* Clean Minimal Broadcast Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-white/[0.08] pb-5">
        <div className="flex items-center gap-3">
          <span className="text-2xl" aria-hidden="true">{sportIcon}</span>
          <div>
            <div className="flex items-center gap-2.5">
              <h2 id={`section-title-${category}`} className="text-xl sm:text-2xl font-black tracking-tight text-white">
                {showWatchlistOnly ? '★ Watchlist Fixtures' : selectedLeague === 'All' ? `${categoryLabel}` : selectedLeague}
              </h2>
              {liveMatches.length > 0 ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-red-500/15 border border-red-500/30 px-2.5 py-0.5 text-[11px] font-black text-red-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />
                  <span>{liveMatches.length} LIVE</span>
                </span>
              ) : (
                <span className="rounded-full bg-white/5 border border-white/10 px-2.5 py-0.5 text-[11px] font-bold text-slate-400">
                  {filtered.length} Scheduled
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Clean Controls (Search + Explore Link) */}
        <div className="flex items-center gap-3">
          <div className="relative w-full sm:w-56">
            <span className="absolute left-3 top-2 text-slate-500 text-xs" aria-hidden="true">🔍</span>
            <input
              id={`search-${category}`}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={`Search ${category}...`}
              className="w-full rounded-full border border-white/10 bg-[#101716] pl-8 pr-7 py-1.5 text-xs text-white placeholder-slate-500 focus:border-[#c9f36b] focus:outline-none transition"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="absolute right-2.5 top-1.5 text-xs text-slate-400 hover:text-white"
                aria-label="Clear search"
              >
                ✕
              </button>
            )}
          </div>

          {exploreUrl && (
            <a
              href={exploreUrl}
              className="hidden sm:inline-flex items-center gap-1 text-xs font-bold text-[#c9f36b] hover:underline shrink-0"
            >
              <span>Explore</span>
              <span aria-hidden="true">&rarr;</span>
            </a>
          )}
        </div>
      </div>

      {/* Streamlined Filter Pills (Only shown when meaningful choices exist) */}
      {(availableLeagues.length > 2 || availableDateFilters.length > 2 || watchlistCount > 0 || showWatchlistOnly) && (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          {/* Active League Pills (Only leagues that actually have active matches) */}
          <div className="flex flex-wrap items-center gap-1.5">
            {category === 'football' && availableLeagues.length > 2 && !showWatchlistOnly && (
              availableLeagues.map((league) => {
                const count = leagueCounts[league] || 0;
                const isSelected = selectedLeague === league;
                return (
                  <button
                    key={league}
                    type="button"
                    onClick={() => setSelectedLeague(league)}
                    className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold transition-all ${
                      isSelected
                        ? 'bg-[#c9f36b] text-[#080c0b] shadow-sm'
                        : 'border border-white/10 bg-white/5 text-slate-300 hover:border-white/20 hover:text-white'
                    }`}
                  >
                    <span>{league === 'All' ? 'All Leagues' : league}</span>
                    <span className={`text-[10px] ${isSelected ? 'opacity-80' : 'text-slate-400'}`}>
                      {count}
                    </span>
                  </button>
                );
              })
            )}

            {/* Date Filters: Only shown if fixtures span across multiple dates */}
            {availableDateFilters.length > 2 && (
              <div className="flex items-center gap-1 bg-white/5 p-0.5 rounded-full border border-white/10">
                {availableDateFilters.map((filter) => {
                  const isSelected = dateFilter === filter && !showWatchlistOnly;
                  return (
                    <button
                      key={filter}
                      type="button"
                      onClick={() => {
                        setDateFilter(filter);
                        setShowWatchlistOnly(false);
                      }}
                      className={`rounded-full px-3 py-0.5 text-xs font-bold transition-all ${
                        isSelected ? 'bg-white/20 text-white shadow-sm' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      {filter === 'all' ? 'All' : filter === 'today' ? 'Today' : filter === 'tomorrow' ? 'Tomorrow' : '7 Days'}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Watchlist Filter Pill: Accurately reflects active matches in this section */}
          {(watchlistCount > 0 || showWatchlistOnly) && (
            <button
              type="button"
              onClick={() => {
                if (!showWatchlistOnly) {
                  setSelectedLeague('All');
                  setDateFilter('all');
                  setQuery('');
                  setShowWatchlistOnly(true);
                } else {
                  setShowWatchlistOnly(false);
                }
              }}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold transition-all ${
                showWatchlistOnly
                  ? 'border border-amber-400/50 bg-amber-400/20 text-amber-300 shadow-sm'
                  : 'border border-white/10 bg-white/5 text-slate-400 hover:text-amber-300'
              }`}
            >
              <span>★ Watchlist</span>
              <span className="rounded-full bg-amber-400/20 px-1.5 py-0.2 text-[10px] font-black text-amber-300">
                {watchlistCount}
              </span>
            </button>
          )}
        </div>
      )}

      {/* Main Grid Content */}
      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-white/5 bg-[#090d0c] py-12 px-6 text-center">
          {showWatchlistOnly ? (
            <>
              <p className="font-bold text-slate-300">No active {categoryLabel} fixtures in your watchlist.</p>
              <p className="mt-1.5 text-xs text-slate-400 max-w-sm mx-auto">
                Tap the ☆ star on any fixture card or follow teams in{' '}
                <a href="/dashboard/" className="text-[#c9f36b] hover:underline font-bold">
                  My Watchlist
                </a>{' '}
                to monitor them here.
              </p>
            </>
          ) : (
            <>
              <p className="font-bold text-slate-300">No active fixtures found for this selection.</p>
              <p className="mt-1.5 text-xs text-slate-500">
                Try selecting "All Leagues" or resetting the date filter.
              </p>
            </>
          )}
          {(selectedLeague !== 'All' || showWatchlistOnly || dateFilter !== 'all' || query) && (
            <button
              type="button"
              onClick={() => {
                setSelectedLeague('All');
                setShowWatchlistOnly(false);
                setDateFilter('all');
                setQuery('');
              }}
              className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs font-bold text-[#c9f36b] hover:bg-white/10 transition"
            >
              <span>Reset filters</span>
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-8">
          {/* Live Matches Section — Top priority */}
          {liveMatches.length > 0 ? (
            <div>
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="h-4 w-1.5 rounded-full bg-red-500 shadow-sm shadow-red-500/50" aria-hidden="true" />
                  <h3 className="text-xs font-black uppercase tracking-wider text-red-400 flex items-center gap-2">
                    <span>LIVE BROADCASTS NOW</span>
                    <span className="inline-block h-2 w-2 rounded-full bg-red-500 animate-ping" aria-hidden="true" />
                  </h3>
                </div>
                <span className="rounded-full bg-red-500/15 border border-red-500/30 px-2.5 py-0.5 text-[11px] font-black text-red-400">
                  {liveMatches.length} Playing Live
                </span>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {liveMatches.map((match, index) => renderCard(match, index))}
              </div>
            </div>
          ) : (
            /* User Requirement: When no live match is happening, show clear message at top of desk */
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-white/10 bg-[#070d0c]/80 px-4 py-3 text-xs text-slate-300 shadow-inner">
              <div className="flex items-center gap-2.5">
                <span className="h-2 w-2 rounded-full bg-slate-500 shrink-0" aria-hidden="true" />
                <span className="font-semibold text-slate-200">
                  {selectedLeague !== 'All'
                    ? `No matches currently playing live in ${selectedLeague}.`
                    : `No matches broadcasting live right now in ${categoryLabel}.`}
                </span>
              </div>
              <span className="text-[11px] text-[#c9f36b] font-medium flex items-center gap-1 shrink-0">
                <span>Upcoming kickoff fixtures scheduled below (NST)</span>
                <span aria-hidden="true">&darr;</span>
              </span>
            </div>
          )}

          {/* Upcoming Fixtures Section */}
          {upcomingMatches.length > 0 && (
            <div>
              <div className="mb-3 flex items-center justify-between pt-1">
                <div className="flex items-center gap-2">
                  <span className="h-4 w-1.5 rounded-full bg-[#c9f36b] shadow-sm shadow-[#c9f36b]/50" aria-hidden="true" />
                  <h3 className="text-xs font-black uppercase tracking-wider text-[#c9f36b]">
                    Scheduled Kickoffs (NST)
                  </h3>
                </div>
                <span className="text-[11px] font-bold text-slate-400">{upcomingMatches.length} Fixtures</span>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {displayedUpcoming.map((match, index) => renderCard(match, index))}
              </div>

              {/* Single Minimal Pagination Control */}
              {remainingUpcoming > 0 && (
                <div className="mt-6 flex justify-center">
                  <button
                    type="button"
                    onClick={() => setVisibleCount((prev) => prev + 16)}
                    className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-6 py-2 text-xs font-bold text-slate-300 hover:border-[#c9f36b]/40 hover:bg-[#c9f36b]/10 hover:text-[#c9f36b] transition-all"
                  >
                    <span>Show more fixtures</span>
                    <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-[#c9f36b]">
                      +{Math.min(remainingUpcoming, 16)}
                    </span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
