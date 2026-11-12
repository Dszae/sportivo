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

// "Nov 6, 11:45 PM" -> { date: "Nov 6", time: "11:45 PM" }; strings without a date pass through as time.
function splitKickoff(formatted: string) {
  const i = formatted.lastIndexOf(', ');
  if (i === -1) return { date: '', time: formatted };
  return { date: formatted.slice(0, i), time: formatted.slice(i + 2) };
}

export default function MatchExplorer({ category, matches: initialMatches, exploreUrl }: Props) {
  const [matches, setMatches] = useState<Match[]>(initialMatches || []);
  const [query, setQuery] = useState('');
  const [selectedLeague, setSelectedLeague] = useState<FootballLeague>('All');
  const [dateFilter, setDateFilter] = useState<DateFilter>('all');
  const [showWatchlistOnly, setShowWatchlistOnly] = useState(false);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [favoriteTeams, setFavoriteTeams] = useState<string[]>([]);
  const [timeZone, setTimeZone] = useState<'Asia/Kathmandu' | string>('Asia/Kathmandu');
  const [visibleCount, setVisibleCount] = useState(16);
  const [viewMode, setViewMode] = useState<'fotmob' | 'grid'>('fotmob');

  const categoryLabel = category[0].toUpperCase() + category.slice(1);

  // Client-side instant fetch & live sync
  useEffect(() => {
    let cancelled = false;
    const fetchFresh = async () => {
      try {
        const res = await fetch(`/api/matches/${category}/`);
        if (res.ok) {
          const freshData = await res.json();
          if (!cancelled && Array.isArray(freshData) && freshData.length > 0) {
            setMatches(freshData);
          }
        }
      } catch {}
    };

    // If initial server matches was empty, fetch immediately; otherwise poll every 45s
    if (!initialMatches || initialMatches.length === 0) {
      fetchFresh();
    }
    const interval = setInterval(fetchFresh, 45000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [category]);

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

  const groupedUpcoming = useMemo(() => {
    const map = new Map<string, Match[]>();
    displayedUpcoming.forEach((m) => {
      let lg = category === 'football' ? detectFootballLeague(m) : null;
      if (!lg) lg = m.competition || `${categoryLabel} Fixtures`;
      if (!map.has(lg)) map.set(lg, []);
      map.get(lg)!.push(m);
    });
    return Array.from(map.entries());
  }, [displayedUpcoming, category, categoryLabel]);

  const StarIcon = ({ filled }: { filled: boolean }) => (
    <svg
      className="icon"
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 3l2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 17.8 6.2 20.9l1.1-6.5L2.6 9.8l6.5-.9z" />
    </svg>
  );

  const Crest = ({ src, name }: { src: string | null | undefined; name: string }) =>
    src ? (
      <img src={src} alt="" width="24" height="24" className="h-6 w-6 shrink-0 object-contain" />
    ) : (
      <span className="clock flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-ink-600 text-xs text-fg-2">
        {name.slice(0, 2).toUpperCase()}
      </span>
    );

  const renderFotMobRow = (match: Match, index: number) => {
    const title = titleOf(match);
    const slug = slugify(title);
    const isFav = isMatchInWatchlist(match);
    const status = statusOf(match);
    const isLive = status === 'Live';
    const { first, second } = teamParts(title);
    const homeName = match.teams?.home?.name || first || 'Home';
    const awayName = match.teams?.away?.name || second || 'Away';
    const homeBadge = match.teams?.home?.badge ? getSafeThumbnailUrl(match.teams.home.badge) : null;
    const awayBadge = match.teams?.away?.badge ? getSafeThumbnailUrl(match.teams.away.badge) : null;
    const homeScore = match.teams?.home?.score;
    const awayScore = match.teams?.away?.score;
    const formattedTime = timeOf(match, timeZone);
    const kickoff = splitKickoff(formattedTime);

    return (
      <a
        key={`${slug}-${index}`}
        href={`/${category}/match/${encodeURIComponent(slug)}/`}
        className="group flex items-center gap-4 border-b border-line px-4 py-3 transition-colors duration-fast ease-out last:border-b-0 hover:bg-ink-700/60 focus:bg-ink-700/60 focus:outline-none"
      >
        <div className="flex w-[104px] shrink-0 flex-col gap-0.5 border-r border-line pr-4">
          {isLive ? (
            <span className="live-tag">
              <span className="live-dot" />
              Live
            </span>
          ) : (
            <span className="clock whitespace-nowrap text-[13px] text-fg">{kickoff.time}</span>
          )}
          <span className="meta clock whitespace-nowrap">{isLive ? 'In play' : kickoff.date || 'NST'}</span>
        </div>

        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2.5">
              <Crest src={homeBadge} name={homeName} />
              <span className="truncate text-sm text-fg">{homeName}</span>
            </div>
            <span className="clock shrink-0 text-sm text-fg">{homeScore !== undefined ? homeScore : ''}</span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2.5">
              <Crest src={awayBadge} name={awayName} />
              <span className="truncate text-sm text-fg">{awayName}</span>
            </div>
            <span className="clock shrink-0 text-sm text-fg">{awayScore !== undefined ? awayScore : ''}</span>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1 pl-2">
          {isLive && <span className="btn btn-live btn-sm hidden sm:inline-flex">Watch</span>}
          <button
            type="button"
            onClick={(e) => toggleFavorite(slug, e)}
            aria-label={isFav ? `Remove ${title} from watchlist` : `Add ${title} to watchlist`}
            className={`inline-flex h-8 w-8 items-center justify-center rounded-md transition-colors duration-fast ease-out hover:bg-ink-600 ${
              isFav ? 'text-lime' : 'text-fg-3 hover:text-fg'
            }`}
          >
            <StarIcon filled={isFav} />
          </button>
          <svg className="icon text-fg-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="m9 6 6 6-6 6" />
          </svg>
        </div>
      </a>
    );
  };

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
    const hasTeams = match.teams && typeof match.teams === 'object' && (match.teams.home || match.teams.away);

    return (
      <a
        key={`${slug}-${index}`}
        href={`/${category}/match/${encodeURIComponent(slug)}/`}
        className="card group relative flex flex-col overflow-hidden transition-colors duration-fast ease-out hover:border-line-strong focus:outline-none"
      >
        <button
          type="button"
          onClick={(e) => toggleFavorite(slug, e)}
          aria-label={isFav ? `Remove ${title} from watchlist` : `Add ${title} to watchlist`}
          className={`absolute right-2 top-2 z-20 inline-flex h-8 w-8 items-center justify-center rounded-md bg-ink-950/80 transition-colors duration-fast ease-out hover:bg-ink-950 ${
            isFav ? 'text-lime' : 'text-fg-2 hover:text-fg'
          }`}
        >
          <StarIcon filled={isFav} />
        </button>

        <div className="relative h-36 w-full overflow-hidden bg-ink-950">
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
            className="h-full w-full object-cover"
            style={{ filter: 'saturate(0.85)' }}
          />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-ink-800 via-ink-950/20 to-ink-950/30" />

          <span className="absolute left-2 top-2 z-20 inline-flex h-6 items-center gap-1.5 rounded-md bg-ink-950/85 px-2 text-xs text-fg">
            {isLive ? (
              <>
                <span className="live-dot" aria-hidden="true" />
                Live
              </>
            ) : (
              <span className="clock">{formattedTime}</span>
            )}
          </span>

          {hasTeams && (
            <div className="absolute inset-x-2 bottom-2 z-10 flex items-center justify-between gap-2 rounded-lg bg-ink-950/85 px-2.5 py-1.5">
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <div className="relative flex h-5 w-5 shrink-0 items-center justify-center">
                  {match.teams!.home?.badge && (
                    <img
                      src={getSafeThumbnailUrl(match.teams!.home.badge)}
                      alt=""
                      width="20"
                      height="20"
                      className="h-5 w-5 shrink-0 object-contain"
                      onError={(e) => {
                        const el = e.currentTarget as HTMLElement;
                        el.style.display = 'none';
                        const fallback = el.parentElement?.querySelector('.team-badge-fallback') as HTMLElement;
                        if (fallback) fallback.style.display = 'flex';
                      }}
                    />
                  )}
                  <span
                    className="team-badge-fallback clock h-6 w-6 shrink-0 items-center justify-center rounded-full bg-ink-600 text-xs text-fg-2"
                    style={{ display: match.teams!.home?.badge ? 'none' : 'flex' }}
                  >
                    {(match.teams!.home?.name || first || 'H').slice(0, 2).toUpperCase()}
                  </span>
                </div>
                <span className="truncate text-xs text-fg">{match.teams!.home?.name || first}</span>
              </div>

              <span className="meta shrink-0">v</span>

              <div className="flex min-w-0 flex-1 items-center justify-end gap-2">
                <span className="truncate text-right text-xs text-fg">{match.teams!.away?.name || second}</span>
                <div className="relative flex h-5 w-5 shrink-0 items-center justify-center">
                  {match.teams!.away?.badge && (
                    <img
                      src={getSafeThumbnailUrl(match.teams!.away.badge)}
                      alt=""
                      width="20"
                      height="20"
                      className="h-5 w-5 shrink-0 object-contain"
                      onError={(e) => {
                        const el = e.currentTarget as HTMLElement;
                        el.style.display = 'none';
                        const fallback = el.parentElement?.querySelector('.team-badge-fallback') as HTMLElement;
                        if (fallback) fallback.style.display = 'flex';
                      }}
                    />
                  )}
                  <span
                    className="team-badge-fallback clock h-6 w-6 shrink-0 items-center justify-center rounded-full bg-ink-600 text-xs text-fg-2"
                    style={{ display: match.teams!.away?.badge ? 'none' : 'flex' }}
                  >
                    {(match.teams!.away?.name || second || 'A').slice(0, 2).toUpperCase()}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-1 flex-col p-4">
          <h3 className="truncate text-sm font-medium text-fg">{title}</h3>
          <p className="mt-1 truncate text-xs text-fg-2">{match.competition || matchLeague || categoryLabel}</p>
          <div className="mt-3 flex items-center justify-between">
            <span className="meta capitalize">{matchLeague || category}</span>
            {isLive ? (
              <span className="live-tag">
                <span className="live-dot" />
                Live
              </span>
            ) : (
              <span className="clock text-xs text-fg-2">{formattedTime} NST</span>
            )}
          </div>
        </div>
      </a>
    );
  };

  const sportIcon =
    category === 'football' ? (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 3a14 14 0 0 1 3.5 9 14 14 0 0 1-3.5 9 14 14 0 0 1-3.5-9A14 14 0 0 1 12 3zM3 12h18" />
      </>
    ) : category === 'cricket' ? (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="m5.6 5.6 3.8 3.8M14.6 9.4l3.8-3.8M14.6 14.6l3.8 3.8M9.4 14.6l-3.8 3.8" />
      </>
    ) : (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M3.5 10a9 9 0 0 1 6.5-6.5M20.5 14a9 9 0 0 1-6.5 6.5M3 12h18M12 3v18" />
      </>
    );

  const anyFilterActive = selectedLeague !== 'All' || showWatchlistOnly || dateFilter !== 'all' || Boolean(query);

  return (
    <div aria-labelledby={`section-title-${category}`} className="w-full">
      <div className="mb-6 flex flex-col gap-4 border-b border-line pb-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          <span className="icon-btn pointer-events-none text-fg-2" aria-hidden="true">
            <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
              {sportIcon}
            </svg>
          </span>
          <h2 id={`section-title-${category}`} className="text-2xl font-medium tracking-[-0.01em] text-fg">
            {showWatchlistOnly ? 'Watchlist' : selectedLeague === 'All' ? categoryLabel : selectedLeague}
          </h2>
          {liveMatches.length > 0 ? (
            <span className="live-tag">
              <span className="live-dot" />
              <span className="clock">{liveMatches.length}</span> live
            </span>
          ) : (
            <span className="meta">
              <span className="clock">{filtered.length}</span> scheduled
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <div className="flex shrink-0 items-center gap-0.5 rounded-lg border border-line bg-ink-900 p-0.5" role="group" aria-label="View">
            <button
              type="button"
              onClick={() => setViewMode('fotmob')}
              aria-pressed={viewMode === 'fotmob'}
              className={`btn btn-sm gap-1.5 rounded-md ${viewMode === 'fotmob' ? 'bg-ink-700 text-fg shadow-lift' : 'text-fg-3 hover:text-fg'}`}
              title="Matchday list"
            >
              <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M4 6h16M4 12h16M4 18h16" />
              </svg>
              <span className="hidden sm:inline">List</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              aria-pressed={viewMode === 'grid'}
              className={`btn btn-sm gap-1.5 rounded-md ${viewMode === 'grid' ? 'bg-ink-700 text-fg shadow-lift' : 'text-fg-3 hover:text-fg'}`}
              title="Grid"
            >
              <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="4" y="4" width="6" height="6" rx="1" />
                <rect x="14" y="4" width="6" height="6" rx="1" />
                <rect x="14" y="14" width="6" height="6" rx="1" />
                <rect x="4" y="14" width="6" height="6" rx="1" />
              </svg>
              <span className="hidden sm:inline">Grid</span>
            </button>
          </div>

          <div className="relative w-full sm:w-56">
            <svg className="icon pointer-events-none absolute left-3 top-2.5 text-fg-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" />
            </svg>
            <input
              id={`search-${category}`}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search"
              aria-label={`Search ${category}`}
              className="input pl-9 pr-8"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="absolute right-1.5 top-1.5 inline-flex h-6 w-6 items-center justify-center rounded text-fg-3 hover:text-fg"
                aria-label="Clear search"
              >
                <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M6 6l12 12M18 6 6 18" />
                </svg>
              </button>
            )}
          </div>

          {exploreUrl && (
            <a href={exploreUrl} className="btn btn-ghost btn-sm hidden shrink-0 sm:inline-flex">
              All {category}
              <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M5 12h14m-6-6 6 6-6 6" />
              </svg>
            </a>
          )}
        </div>
      </div>

      {(availableLeagues.length > 2 || availableDateFilters.length > 2 || watchlistCount > 0 || showWatchlistOnly) && (
        <div className="no-scrollbar -mx-4 mb-6 flex items-center gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:justify-between sm:px-0">
          <div className="flex shrink-0 items-center gap-1 sm:flex-wrap">
            {category === 'football' && availableLeagues.length > 2 && !showWatchlistOnly &&
              availableLeagues.map((league) => {
                const count = leagueCounts[league] || 0;
                const isSelected = selectedLeague === league;
                return (
                  <button
                    key={league}
                    type="button"
                    onClick={() => setSelectedLeague(league)}
                    aria-pressed={isSelected}
                    className={`chip ${isSelected ? 'chip-active' : ''}`}
                  >
                    <span>{league === 'All' ? 'All leagues' : league}</span>
                    <span className="chip-count">{count}</span>
                  </button>
                );
              })}

            {availableDateFilters.length > 2 && (
              <div className="ml-1 flex shrink-0 items-center gap-0.5 rounded-lg border border-line bg-ink-900 p-0.5" role="group" aria-label="Date">
                {availableDateFilters.map((filter) => {
                  const isSelected = dateFilter === filter && !showWatchlistOnly;
                  return (
                    <button
                      key={filter}
                      type="button"
                      aria-pressed={isSelected}
                      onClick={() => {
                        setDateFilter(filter);
                        setShowWatchlistOnly(false);
                      }}
                      className={`chip h-7 rounded-md px-2.5 ${isSelected ? 'bg-ink-700 text-fg shadow-lift' : ''}`}
                    >
                      {filter === 'all' ? 'All' : filter === 'today' ? 'Today' : filter === 'tomorrow' ? 'Tomorrow' : '7 days'}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {(watchlistCount > 0 || showWatchlistOnly) && (
            <button
              type="button"
              aria-pressed={showWatchlistOnly}
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
              className={`chip ${showWatchlistOnly ? 'chip-active text-lime' : ''}`}
            >
              <StarIcon filled={showWatchlistOnly} />
              <span>Watchlist</span>
              <span className="chip-count">{watchlistCount}</span>
            </button>
          )}
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="card px-6 py-12 text-center">
          {showWatchlistOnly ? (
            <>
              <p className="text-sm text-fg">No {category} fixtures in your watchlist</p>
              <p className="mx-auto mt-1.5 max-w-sm text-sm text-fg-2">
                Star any fixture, or follow teams from your{' '}
                <a href="/dashboard/" className="text-fg underline underline-offset-4">watchlist</a>
              </p>
            </>
          ) : (
            <>
              <p className="text-sm text-fg">No fixtures for this selection</p>
              <p className="mt-1.5 text-sm text-fg-2">Try all leagues or another date</p>
            </>
          )}
          {anyFilterActive && (
            <button
              type="button"
              onClick={() => {
                setSelectedLeague('All');
                setShowWatchlistOnly(false);
                setDateFilter('all');
                setQuery('');
              }}
              className="btn btn-secondary btn-sm mt-5"
            >
              Reset filters
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-10">
          {liveMatches.length > 0 ? (
            <div>
              <div className="mb-3 flex items-center justify-between">
                <h3 className="live-tag text-sm">
                  <span className="live-dot" />
                  Live now
                </h3>
                <span className="meta">
                  <span className="clock">{liveMatches.length}</span> in play
                </span>
              </div>
              {viewMode === 'fotmob' ? (
                <div className="card overflow-hidden border-line-strong">
                  {liveMatches.map((match, index) => renderFotMobRow(match, index))}
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  {liveMatches.map((match, index) => renderCard(match, index))}
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-1 rounded-xl border border-line bg-ink-800 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
              <span className="text-fg-2">
                {selectedLeague !== 'All' ? `Nothing live in ${selectedLeague} right now` : `Nothing live in ${category} right now`}
              </span>
              {upcomingMatches.length > 0 && (
                <span className="text-fg-2">
                  Next: <span className="text-fg">{titleOf(upcomingMatches[0])}</span>,{' '}
                  <span className="clock text-fg">{timeOf(upcomingMatches[0], timeZone)} NST</span>
                </span>
              )}
            </div>
          )}

          {upcomingMatches.length > 0 && (
            <div>
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-medium text-fg">Scheduled kickoffs</h3>
                <span className="meta">
                  <span className="clock">{upcomingMatches.length}</span> fixtures, NST
                </span>
              </div>

              {viewMode === 'fotmob' ? (
                <div className="space-y-4">
                  {groupedUpcoming.map(([leagueName, leagueMatches]) => (
                    <div key={leagueName} className="card overflow-hidden">
                      <div className="flex h-10 items-center justify-between border-b border-line bg-ink-900/60 px-4">
                        <span className="text-[13px] font-medium text-fg-2">{leagueName}</span>
                        <span className="meta clock">{leagueMatches.length}</span>
                      </div>
                      <div>{leagueMatches.map((match, index) => renderFotMobRow(match, index))}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  {displayedUpcoming.map((match, index) => renderCard(match, index))}
                </div>
              )}

              {remainingUpcoming > 0 && (
                <div className="mt-6 flex justify-center">
                  <button type="button" onClick={() => setVisibleCount((prev) => prev + 16)} className="btn btn-secondary">
                    Show <span className="clock">{Math.min(remainingUpcoming, 16)}</span> more
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
