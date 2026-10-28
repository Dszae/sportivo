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
      setDownloadToast(`Added ${titleOf(match)} to calendar!`);
      setTimeout(() => setDownloadToast(''), 3000);
    } catch {}
  };

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
        className={`group relative flex flex-col justify-between overflow-hidden rounded-2xl border bg-[#111a19] shadow-xl shadow-black/20 transition-all duration-300 hover:-translate-y-1 hover:border-[#c9f36b]/60 ${
          isLive ? 'border-red-500/50 ring-1 ring-red-500/30' : 'border-white/10'
        }`}
      >
        <a
          href={`/${category}/match/${encodeURIComponent(slug)}/`}
          className="flex-1 focus:outline-none"
        >
          {/* Top Image or Versus Banner */}
          <div className="relative flex h-36 w-full items-center justify-center overflow-hidden bg-gradient-to-br from-[#182b2a] via-[#18212b] to-[#111a19]">
            <span
              className={`absolute left-3 top-3 z-10 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-black tracking-wide ${
                isLive
                  ? 'bg-red-600 text-white shadow-md shadow-red-600/30'
                  : status === 'Final'
                  ? 'bg-slate-700/80 text-slate-200'
                  : 'bg-black/70 text-slate-200 backdrop-blur-sm'
              }`}
            >
              {isLive && <span className="inline-block h-1.5 w-1.5 animate-ping rounded-full bg-white"></span>}
              {isLive ? 'LIVE' : status === 'Final' ? 'Final' : formattedTime}
            </span>

            {/* Real Visible Match Thumbnail */}
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
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            />

            {/* Dark Bottom Vignette Gradient */}
            <div className="absolute inset-0 bg-gradient-to-t from-[#0b100f] via-black/20 to-black/30 pointer-events-none"></div>

            {/* Team Crests Overlaid on Thumbnail if Home/Away Present */}
            {match.teams && typeof match.teams === 'object' && (match.teams.home || match.teams.away) && (
              <div className="absolute inset-x-2 bottom-2 z-10 flex items-center justify-center gap-2 rounded-xl bg-black/60 px-2.5 py-1 backdrop-blur-md border border-white/10">
                {/* Home Team */}
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
                  <span className="line-clamp-1 text-[11px] font-bold text-white">
                    {match.teams.home?.name || first}
                  </span>
                </div>

                <span className="text-[10px] font-black text-[#c9f36b] shrink-0">VS</span>

                {/* Away Team */}
                <div className="flex items-center justify-end gap-1.5 flex-1 min-w-0">
                  <span className="line-clamp-1 text-[11px] font-bold text-white text-right">
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

          <div className="p-4">
            <h4 className="line-clamp-2 text-sm font-bold text-slate-100 group-hover:text-[#c9f36b]">
              {title}
            </h4>
            <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-500">
              <span className="capitalize">{category}</span>
              {league && (
                <>
                  <span>•</span>
                  <span className="rounded bg-white/10 px-1 py-0.2 text-[9px] font-bold text-[#e5b94f]">
                    {league}
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

        {/* Card Action Footer */}
        <div className="flex items-center justify-between border-t border-white/5 bg-black/20 px-3 py-2 text-xs">
          <button
            type="button"
            onClick={(e) => toggleStarredMatch(slug, e)}
            className={`inline-flex items-center gap-1 rounded px-2 py-1 font-semibold transition ${
              isStarred
                ? 'bg-amber-400/20 text-amber-300'
                : 'text-slate-400 hover:bg-white/5 hover:text-white'
            }`}
            title={isStarred ? 'Remove from starred' : 'Star this match'}
          >
            <span>{isStarred ? '★ Starred' : '☆ Star'}</span>
          </button>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={(e) => downloadIcs(match, e)}
              className="rounded p-1 text-slate-400 hover:bg-white/5 hover:text-white transition"
              title="Add to Calendar (.ics)"
              aria-label="Add to calendar"
            >
              📅
            </button>
            <a
              href={`/${category}/match/${encodeURIComponent(slug)}/`}
              className="inline-flex items-center gap-1 rounded bg-[#c9f36b]/10 px-2 py-1 text-[11px] font-bold text-[#c9f36b] hover:bg-[#c9f36b]/20 transition"
            >
              <span>Watch</span>
              <span>&rarr;</span>
            </a>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-8">
      {/* Toast Notification */}
      {downloadToast && (
        <div className="fixed bottom-5 right-5 z-50 rounded-xl border border-emerald-500/40 bg-[#101716] px-4 py-3 text-sm font-bold text-emerald-300 shadow-2xl backdrop-blur-md">
          ✓ {downloadToast}
        </div>
      )}

      {/* Preferences Overview Banner & Timezone Selector */}
      <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-[#111a19] via-[#0d1615] to-[#142321] p-6 shadow-xl">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex h-2 w-2 rounded-full bg-[#c9f36b]"></span>
              <span className="text-xs font-bold uppercase tracking-widest text-[#e5b94f]">
                Personal Desk
              </span>
            </div>
            <h2 className="text-2xl font-black text-white mt-1">Your Curated Sports Feed</h2>
            <p className="mt-1 text-xs text-slate-400 max-w-xl">
              Following{' '}
              <strong className="text-white">
                {prefs.favoriteTeams.length} teams
              </strong>
              ,{' '}
              <strong className="text-white">
                {prefs.favoriteLeagues.length} competitions
              </strong>
              , and{' '}
              <strong className="text-white">
                {prefs.favoriteSports.length} sports
              </strong>
              . Automatically converted to your local timezone.
            </p>
          </div>

          {/* Timezone Switcher Pill */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex items-center gap-2 text-xs text-slate-300">
              <span className="text-slate-400">Timezone:</span>
              <select
                value={prefs.timeZone}
                onChange={(e) => handleTimezoneChange(e.target.value)}
                className="rounded-lg border border-white/10 bg-[#0c1312] px-3 py-1.5 text-xs font-semibold text-white focus:border-[#c9f36b] focus:outline-none"
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
            </div>

            <button
              type="button"
              onClick={() => setActiveTab('customize')}
              className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs font-bold text-[#c9f36b] hover:bg-[#c9f36b]/10 transition"
            >
              <span>⚙ Customize Feed</span>
            </button>
          </div>
        </div>

        {/* Following Summary Badges */}
        <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-white/5 pt-4">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
            Active Filters:
          </span>
          {prefs.favoriteSports.map((sport) => (
            <span
              key={sport}
              className="rounded-md bg-white/5 px-2 py-0.5 text-xs font-medium text-slate-300 capitalize border border-white/5"
            >
              {sport}
            </span>
          ))}
          {prefs.favoriteLeagues.map((league) => (
            <span
              key={league}
              className="rounded-md bg-[#e5b94f]/10 px-2 py-0.5 text-xs font-semibold text-[#e5b94f] border border-[#e5b94f]/20"
            >
              {league}
            </span>
          ))}
          {prefs.favoriteTeams.map((team) => (
            <span
              key={team}
              className="inline-flex items-center gap-1 rounded-md bg-[#c9f36b]/10 px-2 py-0.5 text-xs font-semibold text-[#c9f36b] border border-[#c9f36b]/20"
            >
              <span>{team}</span>
              <button
                type="button"
                onClick={() => toggleTeam(team)}
                className="text-slate-400 hover:text-red-400 ml-0.5"
                title={`Remove ${team}`}
              >
                ×
              </button>
            </span>
          ))}
          {prefs.favoriteTeams.length === 0 && prefs.favoriteLeagues.length === 0 && (
            <span className="text-xs text-slate-500 italic">
              Showing all matches for your selected sports. Tap "Customize Feed" to pick clubs &amp; leagues.
            </span>
          )}
        </div>
      </div>

      {/* Tabs Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/5 pb-4">
        <div className="flex items-center gap-2" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'feed'}
            onClick={() => setActiveTab('feed')}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition ${
              activeTab === 'feed'
                ? 'bg-[#c9f36b] text-[#0a1110] shadow-md shadow-[#c9f36b]/20'
                : 'bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white'
            }`}
          >
            <span>My Match Feed</span>
            <span
              className={`rounded-full px-1.5 py-0.2 text-[10px] font-black ${
                activeTab === 'feed' ? 'bg-black/20 text-black' : 'bg-white/10 text-slate-400'
              }`}
            >
              {personalizedFeed.length}
            </span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'starred'}
            onClick={() => setActiveTab('starred')}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition ${
              activeTab === 'starred'
                ? 'bg-amber-400 text-black shadow-md shadow-amber-400/20'
                : 'bg-white/5 text-slate-300 hover:bg-white/10 hover:text-amber-300'
            }`}
          >
            <span>★ Starred Matches</span>
            <span
              className={`rounded-full px-1.5 py-0.2 text-[10px] font-black ${
                activeTab === 'starred' ? 'bg-black/20 text-black' : 'bg-white/10 text-slate-400'
              }`}
            >
              {starredList.length}
            </span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'customize'}
            onClick={() => setActiveTab('customize')}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition ${
              activeTab === 'customize'
                ? 'bg-white/20 text-white'
                : 'bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white'
            }`}
          >
            <span>⚙ Follow Teams &amp; Leagues</span>
          </button>
        </div>

        <div className="text-xs text-slate-500">
          Preferences saved locally across browser sessions
        </div>
      </div>

      {/* TAB CONTENT: CUSTOMIZE PREFERENCES */}
      {activeTab === 'customize' && (
        <div className="space-y-8 rounded-2xl border border-white/10 bg-[#111a19] p-6">
          <div>
            <h3 className="text-lg font-black text-white">Customize Your Sports Experience</h3>
            <p className="mt-1 text-xs text-slate-400">
              Choose your sports, follow your favorite clubs or national teams, and tailor your live scores and streaming schedule.
            </p>
          </div>

          {/* 1. Favorite Sports */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#e5b94f]">1. Select Sports</h4>
            <div className="mt-3 flex flex-wrap gap-2.5">
              {categories.map((sport) => {
                const isSelected = prefs.favoriteSports.includes(sport);
                return (
                  <button
                    key={sport}
                    type="button"
                    onClick={() => toggleSport(sport)}
                    className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold capitalize transition ${
                      isSelected
                        ? 'border border-[#c9f36b] bg-[#c9f36b]/15 text-[#c9f36b]'
                        : 'border border-white/10 bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    <span>{isSelected ? '✓' : '+'}</span>
                    <span>{sport}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. Favorite Competitions / Leagues */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#e5b94f]">
              2. Follow Competitions &amp; Tournaments
            </h4>
            <div className="mt-3 flex flex-wrap gap-2">
              {POPULAR_COMPETITIONS.map(({ name, sport }) => {
                const isSelected = prefs.favoriteLeagues.includes(name);
                return (
                  <button
                    key={name}
                    type="button"
                    onClick={() => toggleLeague(name)}
                    className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-bold transition ${
                      isSelected
                        ? 'bg-[#e5b94f] text-[#0a1110] shadow-md shadow-[#e5b94f]/20'
                        : 'border border-white/10 bg-white/5 text-slate-300 hover:border-white/20 hover:text-white'
                    }`}
                  >
                    <span>{isSelected ? '✓' : '+'}</span>
                    <span>{name}</span>
                    <span className="text-[10px] opacity-60">({sport})</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 3. Follow Favorite Teams */}
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-[#e5b94f]">
                3. Follow Teams &amp; Clubs
              </h4>
              {/* Custom Team Add */}
              <form onSubmit={addCustomTeam} className="flex items-center gap-2">
                <input
                  type="text"
                  value={customTeamInput}
                  onChange={(e) => setCustomTeamInput(e.target.value)}
                  placeholder="Add any team name..."
                  className="rounded-lg border border-white/10 bg-[#0c1312] px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:border-[#c9f36b] focus:outline-none"
                />
                <button
                  type="submit"
                  className="rounded-lg bg-[#c9f36b] px-3 py-1.5 text-xs font-bold text-black hover:bg-[#b8e25d] transition"
                >
                  Add
                </button>
              </form>
            </div>

            {/* Popular Teams Grid */}
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
                    className={`flex flex-col items-start justify-between rounded-xl border p-2.5 text-left transition ${
                      isSelected
                        ? 'border-[#c9f36b] bg-[#c9f36b]/10 text-white ring-1 ring-[#c9f36b]'
                        : 'border-white/10 bg-white/5 text-slate-300 hover:border-white/20 hover:bg-white/10'
                    }`}
                  >
                    <span className="text-xs font-bold leading-tight">{name}</span>
                    <span className="mt-1 text-[10px] text-slate-500">{league}</span>
                    <span className="mt-2 text-[10px] font-bold text-[#c9f36b]">
                      {isSelected ? '✓ Following' : '+ Follow'}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Automatic Watchlist Notifications Badge */}
          <div className="rounded-xl border border-[#c9f36b]/30 bg-[#c9f36b]/10 p-3.5 flex items-center gap-3">
            <span className="text-xl">🔔</span>
            <div className="text-xs">
              <span className="font-bold text-white block">Automatic Live Alerts Active</span>
              <span className="text-slate-300">
                All teams and matches in your watchlist automatically trigger 5-minute kickoff warnings, live stream alerts, and real-time score updates.
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-white/5 pt-4">
            <button
              type="button"
              onClick={() => {
                setPrefs(loadUserPreferences());
                setActiveTab('feed');
              }}
              className="rounded-xl bg-[#c9f36b] px-5 py-2 text-xs font-black text-black hover:bg-[#b8e25d] transition"
            >
              Done &amp; View My Feed &rarr;
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
              className="text-xs text-slate-400 hover:text-red-400 transition"
            >
              Reset all preferences
            </button>
          </div>
        </div>
      )}

      {/* TAB CONTENT: FEED & STARRED */}
      {activeTab !== 'customize' && (
        <>
          {currentFeed.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-[#111a19] py-16 px-6 text-center shadow-lg">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-slate-700 bg-white/5 text-slate-400 text-xl">
                {activeTab === 'starred' ? '★' : '🎯'}
              </div>
              <h3 className="mt-4 text-base font-bold text-white">
                {activeTab === 'starred'
                  ? 'No Starred Matches Yet'
                  : 'No matches found matching your active preferences.'}
              </h3>
              <p className="mt-2 text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
                {activeTab === 'starred'
                  ? 'Tap the ☆ Star button on any match card in your feed or across the site to keep track of games you care about.'
                  : 'Try selecting additional sports or adding more teams and competitions in your preferences.'}
              </p>
              <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => setActiveTab('customize')}
                  className="rounded-full bg-[#c9f36b] px-5 py-2 text-xs font-black text-black hover:bg-[#b8e25d] transition"
                >
                  ⚙ Customize Preferences
                </button>
                {activeTab === 'starred' && (
                  <button
                    type="button"
                    onClick={() => setActiveTab('feed')}
                    className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-bold text-slate-300 hover:bg-white/10 transition"
                  >
                    View Personal Feed
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-10">
              {/* Live Section */}
              <div>
                <div className="mb-4 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className="relative flex h-3 w-3">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75"></span>
                      <span className="relative inline-flex h-3 w-3 rounded-full bg-red-500"></span>
                    </span>
                    <h3 className="text-base font-black text-white sm:text-lg">
                      {activeTab === 'starred' ? 'Live Starred Matches' : 'Live In Your Feed'}
                    </h3>
                  </div>
                  {liveItems.length > 0 && (
                    <span className="rounded-full border border-red-500/40 bg-red-500/10 px-2.5 py-0.5 text-[11px] font-black text-red-400">
                      {liveItems.length} LIVE
                    </span>
                  )}
                </div>

                {liveItems.length > 0 ? (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    {liveItems.map((item, index) => renderDashboardCard(item, index))}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-white/10 bg-gradient-to-r from-[#111a19] via-[#0d1615] to-[#111a19] p-5 text-center shadow-lg">
                    <p className="text-xs font-bold text-slate-300">
                      No live matches broadcasting right now in your curated list.
                    </p>
                    <p className="mt-1 text-[11px] text-slate-500">
                      Upcoming kickoff times calibrated in your selected timezone ({prefs.timeZone}) are listed below.
                    </p>
                  </div>
                )}
              </div>

              {/* Upcoming Section */}
              {upcomingItems.length > 0 && (
                <div>
                  <div className="mb-4 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <span className="h-2.5 w-2.5 rounded-full bg-[#c9f36b]"></span>
                      <h3 className="text-base font-black text-white sm:text-lg">
                        {activeTab === 'starred' ? 'Upcoming Starred Matches' : 'Upcoming For You'}
                      </h3>
                    </div>
                    <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-[11px] font-semibold text-slate-400">
                      {upcomingItems.length} Scheduled
                    </span>
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    {upcomingItems.map((item, index) => renderDashboardCard(item, index))}
                  </div>
                </div>
              )}

              {/* Final / Recent Results */}
              {finalItems.length > 0 && (
                <div>
                  <div className="mb-4 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <span className="h-2.5 w-2.5 rounded-full bg-slate-500"></span>
                      <h3 className="text-base font-black text-slate-400 sm:text-lg">
                        Recent Results
                      </h3>
                    </div>
                    <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-[11px] font-semibold text-slate-500">
                      {finalItems.length} Final
                    </span>
                  </div>

                  <div className="grid grid-cols-1 gap-4 opacity-75 sm:grid-cols-2 lg:grid-cols-4">
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

