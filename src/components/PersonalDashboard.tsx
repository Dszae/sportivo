import { useEffect, useMemo, useState } from 'react';
import type { Category, FootballLeague, Match } from '../lib/sportivo';
import {
  FOOTBALL_LEAGUES,
  categories,
  detectFootballLeague,
  formatCountdown,
  generateGoogleCalendarUrl,
  generateIcsCalendarContent,
  getMatchTimestamp,
  getSafeThumbnailUrl,
  publicUrl,
  slugify,
  statusOf,
  timeOf,
  titleOf,
} from '../lib/sportivo';
import {
  COMMON_TIMEZONES,
  POPULAR_COMPETITIONS,
  POPULAR_TEAMS,
  UserPreferences,
  getDefaultPreferences,
  loadUserPreferences,
  saveUserPreferences,
} from '../lib/preferences';
import { requestNotificationPermission, dispatchNotification } from '../lib/notificationService';

type Props = {
  allMatchesByCategory: Record<string, Match[]>;
};

function teamParts(title: string) {
  const parts = title.split(/\s+vs\.?\s+|\s+-\s+/i);
  return { first: parts[0]?.trim() || title, second: parts[1]?.trim() || '' };
}

function StarIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="icon"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 3.5l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17.5l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="icon"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="icon"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export default function PersonalDashboard({ allMatchesByCategory }: Props) {
  const [prefs, setPrefs] = useState<UserPreferences>(getDefaultPreferences());
  const [activeTab, setActiveTab] = useState<'feed' | 'starred' | 'customize'>('feed');
  const [teamSearchQuery, setTeamSearchQuery] = useState('');
  const [customTeamInput, setCustomTeamInput] = useState('');
  const [downloadToast, setDownloadToast] = useState('');

  // Synchronize on mount and handle storage/event updates
  useEffect(() => {
    setPrefs(loadUserPreferences());

    const handleUpdate = (e: Event) => {
      const customEvent = e as CustomEvent<UserPreferences>;
      if (customEvent.detail) {
        setPrefs(customEvent.detail);
      } else {
        setPrefs(loadUserPreferences());
      }
    };

    window.addEventListener('sportivo:preferences-changed', handleUpdate);
    window.addEventListener('storage', handleUpdate);
    return () => {
      window.removeEventListener('sportivo:preferences-changed', handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, []);

  const updatePreferences = (updater: (prev: UserPreferences) => UserPreferences) => {
    setPrefs((current) => {
      const updated = updater(current);
      saveUserPreferences(updated);
      return updated;
    });
  };

  // Star / unstar match
  const toggleStarredMatch = (slug: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    updatePreferences((prev) => {
      const exists = prev.starredMatches.includes(slug);
      const next = exists
        ? prev.starredMatches.filter((s) => s !== slug)
        : [...prev.starredMatches, slug];
      return { ...prev, starredMatches: next };
    });
  };

  // Toggle Favorite Sport
  const toggleSport = (sport: string) => {
    updatePreferences((prev) => {
      const exists = prev.favoriteSports.includes(sport);
      const next = exists
        ? prev.favoriteSports.filter((s) => s !== sport)
        : [...prev.favoriteSports, sport];
      // ensure at least 1 sport selected
      return { ...prev, favoriteSports: next.length > 0 ? next : [sport] };
    });
  };

  // Toggle Favorite League / Competition
  const toggleLeague = (league: string) => {
    updatePreferences((prev) => {
      const exists = prev.favoriteLeagues.includes(league);
      const next = exists
        ? prev.favoriteLeagues.filter((l) => l !== league)
        : [...prev.favoriteLeagues, league];
      return { ...prev, favoriteLeagues: next };
    });
  };

  // Toggle Favorite Team
  const toggleTeam = (teamName: string) => {
    updatePreferences((prev) => {
      const exists = prev.favoriteTeams.some(
        (t) => t.toLowerCase() === teamName.toLowerCase()
      );
      const next = exists
        ? prev.favoriteTeams.filter((t) => t.toLowerCase() !== teamName.toLowerCase())
        : [...prev.favoriteTeams, teamName];
      return { ...prev, favoriteTeams: next };
    });
  };

  // Add custom team
  const addCustomTeam = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = customTeamInput.trim();
    if (!trimmed) return;
    toggleTeam(trimmed);
    setCustomTeamInput('');
  };

  // Change Timezone
  const handleTimezoneChange = (tz: string) => {
    updatePreferences((prev) => ({ ...prev, timeZone: tz }));
  };

  // Flat list of all matches across available sports
  const allMatches = useMemo(() => {
    const list: { match: Match; category: string }[] = [];
    Object.entries(allMatchesByCategory).forEach(([category, matches]) => {
      matches.forEach((match) => {
        list.push({ match, category: match.category || category });
      });
    });
    return list;
  }, [allMatchesByCategory]);

  // Personalized Match Matcher
  const isPersonalMatch = (match: Match, cat: string) => {
    // 1. Matches from favorite sports
    if (!prefs.favoriteSports.includes(cat)) {
      return false;
    }

    const title = titleOf(match).toLowerCase();
    const league = cat === 'football' ? detectFootballLeague(match) : '';

    // If user has specific teams selected, check if team is playing
    if (prefs.favoriteTeams.length > 0) {
      const matchesFavTeam = prefs.favoriteTeams.some((team) =>
        title.includes(team.toLowerCase())
      );
      if (matchesFavTeam) return true;
    }

    // Check if match belongs to favorite league/competition
    if (prefs.favoriteLeagues.length > 0) {
      if (league && prefs.favoriteLeagues.includes(league)) return true;
      const matchesLeagueName = prefs.favoriteLeagues.some((fl) =>
        title.includes(fl.toLowerCase())
      );
      if (matchesLeagueName) return true;
    }

    // If user has no specific team or league preferences, show all from selected favorite sports
    if (prefs.favoriteTeams.length === 0 && prefs.favoriteLeagues.length === 0) {
      return true;
    }

    return false;
  };

  // Personalized Feed Matches
  const personalizedFeed = useMemo(() => {
    return allMatches
      .filter(({ match, category }) => isPersonalMatch(match, category))
      .sort((a, b) => {
        const timeA = getMatchTimestamp(a.match) || 0;
        const timeB = getMatchTimestamp(b.match) || 0;
        return timeA - timeB;
      });
  }, [allMatches, prefs]);

  // Starred Matches
  const starredList = useMemo(() => {
    return allMatches
      .filter(({ match }) => prefs.starredMatches.includes(slugify(titleOf(match))))
      .sort((a, b) => {
        const timeA = getMatchTimestamp(a.match) || 0;
        const timeB = getMatchTimestamp(b.match) || 0;
        return timeA - timeB;
      });
  }, [allMatches, prefs.starredMatches]);

  // Active items for current view
  const currentFeed = activeTab === 'starred' ? starredList : personalizedFeed;

  const liveItems = useMemo(
    () => currentFeed.filter(({ match }) => statusOf(match) === 'Live'),
    [currentFeed]
  );
  const upcomingItems = useMemo(
    () => currentFeed.filter(({ match }) => statusOf(match) === 'Upcoming'),
    [currentFeed]
  );
  const finalItems = useMemo(
    () => currentFeed.filter(({ match }) => statusOf(match) === 'Final'),
    [currentFeed]
  );

  // Download ICS
  const downloadIcs = (match: Match, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      const ics = generateIcsCalendarContent(match);
      const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${slugify(titleOf(match))}.ics`;
      a.click();
      URL.revokeObjectURL(url);
      setDownloadToast(`Added ${titleOf(match)} to calendar`);
      setTimeout(() => setDownloadToast(''), 3000);
    } catch {}
  };

  const renderTeamBadge = (
    badge: string | undefined,
    fallbackName: string,
    fallbackLetter: string
  ) => (
    <div className="relative flex h-6 w-6 shrink-0 items-center justify-center">
      {badge && (
        <img
          src={getSafeThumbnailUrl(badge)}
          alt=""
          width="24"
          height="24"
          className="h-6 w-6 shrink-0 object-contain"
          onError={(e) => {
            const el = e.currentTarget as HTMLElement;
            el.style.display = 'none';
            const fallback = el.parentElement?.querySelector('.team-badge-fallback') as HTMLElement;
            if (fallback) fallback.style.display = 'flex';
          }}
        />
      )}
      <span
        className="team-badge-fallback clock h-6 w-6 shrink-0 items-center justify-center rounded-full bg-ink-700 text-xs text-fg-2"
        style={{ display: badge ? 'none' : 'flex' }}
      >
        {(fallbackName || fallbackLetter).slice(0, 2).toUpperCase()}
      </span>
    </div>
  );

  const renderDashboardCard = (item: { match: Match; category: string }, index: number) => {
    const { match, category } = item;
    const title = titleOf(match);
    const slug = slugify(title);
    const isStarred = prefs.starredMatches.includes(slug);
    const status = statusOf(match);
    const isLive = status === 'Live';
    const { first, second } = teamParts(title);
    const poster = publicUrl(match.poster || match.image || match.thumbnail || undefined);
    const league = category === 'football' ? detectFootballLeague(match) : null;
    const formattedTime = timeOf(match, prefs.timeZone);

    return (
      <div
        key={`${slug}-${index}`}
        className="card group relative flex flex-col justify-between overflow-hidden transition-colors duration-fast ease-out hover:border-line-strong"
      >
        <a
          href={`/${category}/match/${encodeURIComponent(slug)}/`}
          className="flex-1 focus:outline-none"
        >
          {/* Thumbnail */}
          <div className="relative flex h-36 w-full items-center justify-center overflow-hidden bg-ink-900">
            <span
              className={`absolute left-3 top-3 z-10 inline-flex h-6 items-center gap-1.5 rounded-md bg-ink-950/80 px-2 text-xs ${
                isLive ? 'text-live' : 'text-fg-2'
              }`}
            >
              {isLive && <span className="live-dot"></span>}
              {isLive ? (
                'Live'
              ) : status === 'Final' ? (
                'Final'
              ) : (
                <span className="clock">{formattedTime}</span>
              )}
            </span>

            <img
              src={getSafeThumbnailUrl(poster) || '/sportivo-video-thumbnail.png'}
              alt={title}
              width="288"
              height="144"
              loading="lazy"
              decoding="async"
              onError={(e) => {
                const el = e.currentTarget as HTMLImageElement;
                if (el.src !== '/sportivo-video-thumbnail.png') {
                  el.src = '/sportivo-video-thumbnail.png';
                }
              }}
              className="h-full w-full object-cover"
            />

            {/* Team crests over the thumbnail when home/away present */}
            {match.teams && typeof match.teams === 'object' && (match.teams.home || match.teams.away) && (
              <div className="absolute inset-x-3 bottom-3 z-10 flex h-9 items-center justify-center gap-2 rounded-lg bg-ink-950/80 px-2">
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  {renderTeamBadge(match.teams.home?.badge, match.teams.home?.name || first, 'H')}
                  <span className="line-clamp-1 text-xs font-medium text-fg">
                    {match.teams.home?.name || first}
                  </span>
                </div>

                <span className="shrink-0 text-xs text-fg-3">v</span>

                <div className="flex min-w-0 flex-1 items-center justify-end gap-2">
                  <span className="line-clamp-1 text-right text-xs font-medium text-fg">
                    {match.teams.away?.name || second}
                  </span>
                  {renderTeamBadge(match.teams.away?.badge, match.teams.away?.name || second, 'A')}
                </div>
              </div>
            )}
          </div>

          <div className="p-4">
            <h4 className="line-clamp-2 text-sm font-medium text-fg">{title}</h4>
            <div className="meta mt-2 flex flex-wrap items-center gap-1.5">
              <span className="capitalize">{category}</span>
              {league && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>{league}</span>
                </>
              )}
              <span aria-hidden="true">·</span>
              {isLive ? (
                <span className="text-live">Live</span>
              ) : status === 'Final' ? (
                <span>Final</span>
              ) : (
                <span className="clock">{formattedTime}</span>
              )}
            </div>
          </div>
        </a>

        {/* Card actions */}
        <div className="flex h-12 items-center justify-between border-t border-line px-2">
          <button
            type="button"
            onClick={(e) => toggleStarredMatch(slug, e)}
            className={`btn btn-ghost btn-sm ${isStarred ? 'text-lime hover:text-lime' : ''}`}
            title={isStarred ? 'Remove from starred' : 'Star this match'}
          >
            <StarIcon filled={isStarred} />
            <span>{isStarred ? 'Starred' : 'Star'}</span>
          </button>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={(e) => downloadIcs(match, e)}
              className="btn btn-ghost btn-sm w-8 px-0"
              title="Add to calendar (.ics)"
              aria-label="Add to calendar"
            >
              <svg
                viewBox="0 0 24 24"
                className="icon"
                fill="none"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <rect x="3.5" y="5" width="17" height="15.5" rx="2" />
                <path d="M3.5 10h17M8 3v4M16 3v4" />
              </svg>
            </button>
            <a
              href={`/${category}/match/${encodeURIComponent(slug)}/`}
              className={`btn btn-sm ${isLive ? 'btn-live' : 'btn-secondary'}`}
            >
              {isLive ? 'Watch live' : 'Watch'}
            </a>
          </div>
        </div>
      </div>
    );
  };

  const renderSectionHeading = (label: string, count: number, live = false) => (
    <div className="mb-4 flex items-center justify-between">
      <h3 className="flex items-center gap-2 text-xl font-medium text-fg">
        {live && count > 0 && <span className="live-dot"></span>}
        <span>{label}</span>
      </h3>
      {count > 0 && <span className="clock text-sm text-fg-3">{count}</span>}
    </div>
  );

  return (
    <div className="animate-fade-in space-y-8">
      {/* Toast */}
      {downloadToast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-lg border border-line-strong bg-ink-800 px-4 py-3 text-sm text-fg shadow-float">
          <span className="text-lime">
            <CheckIcon />
          </span>
          <span>{downloadToast}</span>
        </div>
      )}

      {/* Page header, timezone and stats */}
      <div className="space-y-6">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-3xl font-semibold text-fg">Watchlist</h2>
            <p className="mt-2 text-sm text-fg-2">
              Teams, competitions and starred matches you follow. Kickoff times in your timezone.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <label className="flex items-center gap-2 text-sm text-fg-2">
              <span className="text-fg-3">Timezone</span>
              <select
                value={prefs.timeZone}
                onChange={(e) => handleTimezoneChange(e.target.value)}
                className="input h-9 w-auto"
                aria-label="Select local timezone"
              >
                {COMMON_TIMEZONES.map((tz) => (
                  <option key={tz.value} value={tz.value}>
                    {tz.label}
                  </option>
                ))}
                {!COMMON_TIMEZONES.some((t) => t.value === prefs.timeZone) && (
                  <option value={prefs.timeZone}>{prefs.timeZone}</option>
                )}
              </select>
            </label>

            <button
              type="button"
              onClick={() => setActiveTab('customize')}
              className="btn btn-secondary"
            >
              Edit following
            </button>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="card p-5">
            <p className="eyebrow">Teams</p>
            <p className="clock mt-2 text-2xl text-fg">{prefs.favoriteTeams.length}</p>
          </div>
          <div className="card p-5">
            <p className="eyebrow">Competitions</p>
            <p className="clock mt-2 text-2xl text-fg">{prefs.favoriteLeagues.length}</p>
          </div>
          <div className="card p-5">
            <p className="eyebrow">Sports</p>
            <p className="clock mt-2 text-2xl text-fg">{prefs.favoriteSports.length}</p>
          </div>
        </div>

        {/* Active filters */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="meta mr-1">Filters</span>
          {prefs.favoriteSports.map((sport) => (
            <span
              key={sport}
              className="inline-flex h-7 items-center rounded-md bg-ink-700 px-2 text-xs capitalize text-fg-2"
            >
              {sport}
            </span>
          ))}
          {prefs.favoriteLeagues.map((league) => (
            <span
              key={league}
              className="inline-flex h-7 items-center rounded-md bg-ink-700 px-2 text-xs text-fg-2"
            >
              {league}
            </span>
          ))}
          {prefs.favoriteTeams.map((team) => (
            <span
              key={team}
              className="inline-flex h-7 items-center gap-1 rounded-md bg-ink-700 pl-2 pr-1 text-xs text-fg"
            >
              <span>{team}</span>
              <button
                type="button"
                onClick={() => toggleTeam(team)}
                className="inline-flex h-5 w-5 items-center justify-center rounded text-fg-3 transition-colors duration-fast ease-out hover:bg-ink-600 hover:text-fg"
                title={`Remove ${team}`}
              >
                <svg
                  viewBox="0 0 24 24"
                  className="icon h-3 w-3"
                  fill="none"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </span>
          ))}
          {prefs.favoriteTeams.length === 0 && prefs.favoriteLeagues.length === 0 && (
            <span className="meta">
              Showing every match in your sports. Choose teams or competitions to narrow the feed.
            </span>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line pb-4">
        <div
          className="no-scrollbar -mx-4 flex items-center gap-1 overflow-x-auto scroll-smooth px-4 sm:mx-0 sm:px-0"
          role="tablist"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'feed'}
            onClick={() => setActiveTab('feed')}
            className={`chip ${activeTab === 'feed' ? 'chip-active' : ''}`}
          >
            <span>Feed</span>
            <span className="chip-count">{personalizedFeed.length}</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'starred'}
            onClick={() => setActiveTab('starred')}
            className={`chip ${activeTab === 'starred' ? 'chip-active' : ''}`}
          >
            <StarIcon filled={false} />
            <span>Starred</span>
            <span className="chip-count">{starredList.length}</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'customize'}
            onClick={() => setActiveTab('customize')}
            className={`chip ${activeTab === 'customize' ? 'chip-active' : ''}`}
          >
            <span>Following</span>
          </button>
        </div>

        <div className="meta">Saved in this browser</div>
      </div>

      {/* Tab: following */}
      {activeTab === 'customize' && (
        <div className="card space-y-8 p-6">
          <div>
            <h3 className="text-xl font-medium text-fg">Following</h3>
            <p className="mt-1 text-sm text-fg-2">
              Choose sports, competitions and teams to shape your feed and alerts.
            </p>
          </div>

          {/* Sports */}
          <div>
            <h4 className="eyebrow">Sports</h4>
            <div className="mt-3 flex flex-wrap gap-2">
              {categories.map((sport) => {
                const isSelected = prefs.favoriteSports.includes(sport);
                return (
                  <button
                    key={sport}
                    type="button"
                    onClick={() => toggleSport(sport)}
                    className={`chip capitalize ${isSelected ? 'chip-active' : ''}`}
                  >
                    {isSelected ? <CheckIcon /> : <PlusIcon />}
                    <span>{sport}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Competitions */}
          <div>
            <h4 className="eyebrow">Competitions</h4>
            <div className="mt-3 flex flex-wrap gap-2">
              {POPULAR_COMPETITIONS.map(({ name, sport }) => {
                const isSelected = prefs.favoriteLeagues.includes(name);
                return (
                  <button
                    key={name}
                    type="button"
                    onClick={() => toggleLeague(name)}
                    className={`chip ${isSelected ? 'chip-active' : ''}`}
                  >
                    {isSelected ? <CheckIcon /> : <PlusIcon />}
                    <span>{name}</span>
                    <span className="meta">{sport}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Teams */}
          <div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h4 className="eyebrow">Teams</h4>
              <form onSubmit={addCustomTeam} className="flex items-center gap-2">
                <input
                  type="text"
                  value={customTeamInput}
                  onChange={(e) => setCustomTeamInput(e.target.value)}
                  placeholder="Add a team"
                  className="input w-48 sm:w-56"
                />
                <button type="submit" className="btn btn-secondary">
                  Add
                </button>
              </form>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
              {POPULAR_TEAMS.map(({ name, league }) => {
                const isSelected = prefs.favoriteTeams.some(
                  (t) => t.toLowerCase() === name.toLowerCase()
                );
                return (
                  <button
                    key={name}
                    type="button"
                    onClick={() => toggleTeam(name)}
                    className={`flex flex-col items-start rounded-lg border p-3 text-left transition-colors duration-fast ease-out ${
                      isSelected
                        ? 'border-line-strong bg-ink-700 text-fg shadow-lift'
                        : 'border-line bg-ink-800 text-fg-2 hover:bg-ink-700 hover:text-fg'
                    }`}
                  >
                    <span className="text-sm font-medium leading-tight">{name}</span>
                    <span className="meta mt-1">{league}</span>
                    <span
                      className={`mt-3 inline-flex items-center gap-1 text-xs ${
                        isSelected ? 'text-lime' : 'text-fg-3'
                      }`}
                    >
                      {isSelected ? <CheckIcon /> : <PlusIcon />}
                      <span>{isSelected ? 'Following' : 'Follow'}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Alerts */}
          <div className="flex items-start gap-3 rounded-lg border border-line bg-ink-900 p-4">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center text-fg-3">
              <svg
                viewBox="0 0 24 24"
                className="icon"
                fill="none"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z" />
                <path d="M10 20a2 2 0 0 0 4 0" />
              </svg>
            </span>
            <div className="text-sm">
              <span className="block font-medium text-fg">Live alerts on</span>
              <span className="text-fg-2">
                Teams and matches you follow get a reminder five minutes before kickoff, a stream alert, and score updates.
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-line pt-4">
            <button
              type="button"
              onClick={() => {
                setPrefs(loadUserPreferences());
                setActiveTab('feed');
              }}
              className="btn btn-primary"
            >
              Done
            </button>
            <button
              type="button"
              onClick={() => {
                const defaults = {
                  favoriteSports: ['football', 'cricket', 'basketball'],
                  favoriteLeagues: [],
                  favoriteTeams: [],
                  starredMatches: [],
                  timeZone: prefs.timeZone,
                };
                saveUserPreferences(defaults);
                setPrefs(defaults);
              }}
              className="btn btn-ghost"
            >
              Reset preferences
            </button>
          </div>
        </div>
      )}

      {/* Tab: feed and starred */}
      {activeTab !== 'customize' && (
        <>
          {currentFeed.length === 0 ? (
            <div className="card px-6 py-16 text-center">
              <p className="text-sm text-fg-2">
                {activeTab === 'starred'
                  ? 'No starred matches yet. Star a match in the feed to keep it here.'
                  : 'No matches match your preferences.'}
              </p>
              <button
                type="button"
                onClick={() => setActiveTab('customize')}
                className="btn btn-secondary mt-4"
              >
                Edit following
              </button>
            </div>
          ) : (
            <div className="space-y-10">
              {/* Live */}
              <div>
                {renderSectionHeading('Live', liveItems.length, true)}

                {liveItems.length > 0 ? (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    {liveItems.map((item, index) => renderDashboardCard(item, index))}
                  </div>
                ) : (
                  <div className="card px-6 py-5 text-center">
                    <p className="text-sm text-fg-2">
                      Nothing live right now. Upcoming kickoffs are shown in {prefs.timeZone}.
                    </p>
                  </div>
                )}
              </div>

              {/* Upcoming */}
              {upcomingItems.length > 0 && (
                <div>
                  {renderSectionHeading('Upcoming', upcomingItems.length)}
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    {upcomingItems.map((item, index) => renderDashboardCard(item, index))}
                  </div>
                </div>
              )}

              {/* Results */}
              {finalItems.length > 0 && (
                <div>
                  {renderSectionHeading('Results', finalItems.length)}
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    {finalItems.map((item, index) => renderDashboardCard(item, index))}
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
