import { useEffect, useMemo, useState } from 'react';
import { NPL_FIXTURES_2026, getCalibratedNplFixtures, type NplMatch } from '../lib/data/nplData';
import { slugify, publicUrl } from '../lib/sportivo';
import { loadUserPreferences, saveUserPreferences, type UserPreferences } from '../lib/preferences';
import { playNotificationChime, requestNotificationPermission } from '../lib/notificationService';

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

// Team crest with an initials fallback when the logo fails to load.
function TeamCrest({ logo, name, short, color, size }: { logo?: string; name: string; short: string; color?: string; size: number }) {
  const [failed, setFailed] = useState(false);
  if (logo && !failed) {
    return (
      <img
        src={logo}
        alt={name}
        width={size}
        height={size}
        style={{ width: size, height: size }}
        className="shrink-0 object-contain"
        onError={() => setFailed(true)}
      />
    );
  }
  return (
    <span
      className="clock flex shrink-0 items-center justify-center rounded-full text-xs text-fg"
      style={{ width: size, height: size, backgroundColor: color || '#2a302d' }}
      aria-label={name}
    >
      {short}
    </span>
  );
}

export default function NplSchedule() {
  const [activeTab, setActiveTab] = useState<Tab>('today');
  const [fixtures, setFixtures] = useState<NplMatch[]>(() => getCalibratedNplFixtures());
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

  const [prefs, setPrefs] = useState<UserPreferences>(() => loadUserPreferences());

  useEffect(() => {
    const handlePrefs = (e: Event) => {
      const ce = e as CustomEvent<UserPreferences>;
      if (ce.detail) setPrefs(ce.detail);
      else setPrefs(loadUserPreferences());
    };
    window.addEventListener('sportivo:preferences-changed', handlePrefs);
    return () => window.removeEventListener('sportivo:preferences-changed', handlePrefs);
  }, []);

  const toggleFollowNplMatch = (match: FormattedNplMatch) => {
    const slug = `npl-match-${match.matchNumber}`;
    const isStarred = prefs.starredMatches.includes(slug);
    const nextStarred = isStarred
      ? prefs.starredMatches.filter((s) => s !== slug)
      : [...prefs.starredMatches, slug];

    if (!isStarred && typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
      requestNotificationPermission();
    }

    const updated: UserPreferences = {
      ...prefs,
      starredMatches: nextStarred,
    };
    saveUserPreferences(updated);
    setPrefs(updated);
  };

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

  const StarIcon = ({ filled }: { filled: boolean }) => (
    <svg className="icon" viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3l2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 17.8 6.2 20.9l1.1-6.5L2.6 9.8l6.5-.9z" />
    </svg>
  );

  const Crest = ({ logo, name, short, color, size = 32 }: { logo?: string; name: string; short: string; color?: string; size?: number }) => (
    <TeamCrest logo={logo} name={name} short={short} color={color} size={size} />
  );

  const shortVenue = (venue: string) => venue.replace('Tribhuvan University International Cricket Ground', 'TU Cricket Ground');
  const shortDate = (ts: number) => formatKathmanduDate(ts).replace(/,\s*\d{4}$/, '');

  const renderMatchCard = (m: NplMatch) => {
    const matchSlug = slugify(`${m.homeTeam} vs ${m.awayTeam}`);
    const detailUrl = `/cricket/match/${encodeURIComponent(matchSlug)}/`;
    const nowMs = Date.now();
    const hasConcludedSummary = Boolean(m.summary && /won by|tied|no result|abandoned|defeated/i.test(m.summary));
    const isCompleted = m.status === 'COMPLETED' || hasConcludedSummary || nowMs > m.timestamp + 3.25 * 3600 * 1000;
    const isLive = !isCompleted && (m.status === 'LIVE' || (nowMs >= m.timestamp - 15 * 60 * 1000 && nowMs <= m.timestamp + 3.25 * 3600 * 1000));
    const isFollowed =
      prefs.starredMatches.includes(`npl-match-${m.matchNumber}`) ||
      prefs.favoriteTeams.some(
        (t) => t.toLowerCase() === m.homeTeam.toLowerCase() || t.toLowerCase() === m.awayTeam.toLowerCase()
      );

    return (
      <div key={m.id} className={`card flex flex-col transition-colors duration-fast ease-out hover:border-line-strong ${isLive ? 'border-line-strong' : ''} ${isCompleted ? 'opacity-80' : ''}`}>
        <div className="flex h-10 items-center justify-between border-b border-line px-4">
          <span className="meta">
            Match <span className="clock">{m.matchNumber}</span>, {m.round}
          </span>
          {isLive ? (
            <span className="live-tag">
              <span className="live-dot" />
              Live
            </span>
          ) : isCompleted ? (
            <span className="meta">Final</span>
          ) : null}
        </div>

        <div className="flex-1 p-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <Crest logo={m.homeTeamLogo} name={m.homeTeam} short={m.homeTeamShort} color={m.homeTeamColor} />
                <span className="truncate text-[15px] text-fg">{m.homeTeam}</span>
              </div>
              {m.homeScore && <span className="clock shrink-0 text-[15px] text-fg">{m.homeScore}</span>}
            </div>
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <Crest logo={m.awayTeamLogo} name={m.awayTeam} short={m.awayTeamShort} color={m.awayTeamColor} />
                <span className="truncate text-[15px] text-fg">{m.awayTeam}</span>
              </div>
              {m.awayScore && <span className="clock shrink-0 text-[15px] text-fg">{m.awayScore}</span>}
            </div>
          </div>

          {m.summary && <p className="mt-4 text-sm leading-5 text-fg-2">{m.summary}</p>}

          <div className="mt-4 flex items-center justify-between gap-3 border-t border-line pt-3">
            <span className="clock whitespace-nowrap text-xs text-fg-2">{shortDate(m.timestamp)}</span>
            <span className="clock whitespace-nowrap text-xs text-fg">{formatKathmanduTime(m.timestamp)}</span>
          </div>
        </div>

        <div className="flex h-12 items-center justify-between gap-2 border-t border-line px-2">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                toggleFollowNplMatch(m);
              }}
              aria-pressed={isFollowed}
              title={isFollowed ? 'In your watchlist, alerts 5 minutes before start' : 'Add to watchlist for an alert 5 minutes before start'}
              className={`inline-flex h-8 w-8 items-center justify-center rounded-md transition-colors duration-fast ease-out hover:bg-ink-700 ${isFollowed ? 'text-lime' : 'text-fg-3 hover:text-fg'}`}
            >
              <StarIcon filled={isFollowed} />
            </button>
            <a href={detailUrl} className="btn btn-ghost btn-sm">
              Details
            </a>
          </div>
          {isLive ? (
            <a href={detailUrl} className="btn btn-live btn-sm">
              Watch live
            </a>
          ) : (
            <span className="meta pr-2">{isCompleted ? 'Final' : ''}</span>
          )}
        </div>
      </div>
    );
  };

  const liveFixture = useMemo(() => {
    const nowMs = Date.now();
    return fixtures.find((m) => {
      const hasConcluded =
        m.status === 'COMPLETED' ||
        Boolean(m.summary && /won by|tied|no result|abandoned|defeated/i.test(m.summary)) ||
        nowMs > m.timestamp + 3.25 * 3600 * 1000;
      if (hasConcluded) return false;
      if (m.status === 'LIVE') return true;
      return nowMs >= m.timestamp - 15 * 60 * 1000 && nowMs <= m.timestamp + 3.25 * 3600 * 1000;
    });
  }, [fixtures]);

  const featuredUpcoming = useMemo(() => {
    if (liveFixture) return null;
    const nowMs = Date.now();
    const todayUpcoming = todayMatches.find((m) => {
      const hasConcluded =
        m.status === 'COMPLETED' ||
        Boolean(m.summary && /won by|tied|no result|abandoned|defeated/i.test(m.summary)) ||
        nowMs > m.timestamp + 3.25 * 3600 * 1000;
      return !hasConcluded && nowMs < m.timestamp;
    });
    return todayUpcoming || nextUpcoming || null;
  }, [liveFixture, todayMatches, nextUpcoming]);

  const liveSlug = liveFixture ? slugify(`${liveFixture.homeTeam} vs ${liveFixture.awayTeam}`) : '';
  const liveStreamUrl = liveSlug ? `/cricket/match/${encodeURIComponent(liveSlug)}/` : '';

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: 'today', label: 'Today', count: todayMatches.length },
    { key: 'upcoming', label: 'Upcoming', count: upcomingMatches.length },
    { key: 'all', label: 'All matches', count: allMatches.length },
  ];

  return (
    <div className="w-full">
      {liveFixture && (
        <section className="panel mb-10 overflow-hidden border-line-strong" aria-label="Live now">
          <div className="flex h-12 items-center justify-between border-b border-line px-5">
            <span className="live-tag text-sm">
              <span className="live-dot" />
              Live now
            </span>
            <span className="meta hidden sm:inline">
              Match <span className="clock">{liveFixture.matchNumber}</span>, {shortVenue(liveFixture.venue || 'TU Cricket Ground')}
            </span>
          </div>

          <div className="grid gap-8 p-5 sm:p-6 lg:grid-cols-12 lg:items-center">
            <div className="space-y-4 lg:col-span-8">
              <div className="flex items-center justify-between gap-4">
                <div className="flex min-w-0 items-center gap-4">
                  <Crest logo={liveFixture.homeTeamLogo} name={liveFixture.homeTeam} short={liveFixture.homeTeamShort} color={liveFixture.homeTeamColor} size={44} />
                  <span className="truncate text-2xl font-medium tracking-[-0.01em] text-fg sm:text-[28px]">{liveFixture.homeTeam}</span>
                </div>
                {liveFixture.homeScore && <span className="clock shrink-0 text-2xl text-fg sm:text-[28px]">{liveFixture.homeScore}</span>}
              </div>
              <div className="flex items-center justify-between gap-4">
                <div className="flex min-w-0 items-center gap-4">
                  <Crest logo={liveFixture.awayTeamLogo} name={liveFixture.awayTeam} short={liveFixture.awayTeamShort} color={liveFixture.awayTeamColor} size={44} />
                  <span className="truncate text-2xl font-medium tracking-[-0.01em] text-fg sm:text-[28px]">{liveFixture.awayTeam}</span>
                </div>
                {liveFixture.awayScore && <span className="clock shrink-0 text-2xl text-fg sm:text-[28px]">{liveFixture.awayScore}</span>}
              </div>
              {liveFixture.summary && <p className="text-sm text-fg-2">{liveFixture.summary}</p>}
            </div>

            <div className="flex flex-col gap-4 lg:col-span-4 lg:items-end">
              <div className="text-sm text-fg-2 lg:text-right">
                <p>
                  Started <span className="clock text-fg">{formatKathmanduTime(liveFixture.timestamp)}</span>
                </p>
                <p className="mt-1 meta">Action Sports HD, NetTV and DishHome</p>
              </div>
              <a href={liveStreamUrl} className="btn btn-live btn-lg w-full sm:w-auto">
                Watch live
              </a>
            </div>
          </div>
        </section>
      )}

      {!liveFixture && featuredUpcoming && (
        <section className="panel mb-10 overflow-hidden border-line" aria-label="Up next">
          <div className="flex h-12 items-center justify-between border-b border-line px-5">
            <span className="chip text-xs">
              Next match
            </span>
            <span className="meta hidden sm:inline">
              Match <span className="clock">{featuredUpcoming.matchNumber}</span>, {shortVenue(featuredUpcoming.venue || 'TU Cricket Ground')}
            </span>
          </div>

          <div className="grid gap-8 p-5 sm:p-6 lg:grid-cols-12 lg:items-center">
            <div className="space-y-4 lg:col-span-8">
              <div className="flex items-center gap-4">
                <Crest logo={featuredUpcoming.homeTeamLogo} name={featuredUpcoming.homeTeam} short={featuredUpcoming.homeTeamShort} color={featuredUpcoming.homeTeamColor} size={44} />
                <span className="truncate text-2xl font-medium tracking-[-0.01em] text-fg sm:text-[28px]">{featuredUpcoming.homeTeam}</span>
              </div>
              <div className="flex items-center gap-4">
                <Crest logo={featuredUpcoming.awayTeamLogo} name={featuredUpcoming.awayTeam} short={featuredUpcoming.awayTeamShort} color={featuredUpcoming.awayTeamColor} size={44} />
                <span className="truncate text-2xl font-medium tracking-[-0.01em] text-fg sm:text-[28px]">{featuredUpcoming.awayTeam}</span>
              </div>
            </div>

            <div className="flex flex-col gap-4 lg:col-span-4 lg:items-end">
              <div className="text-sm text-fg-2 lg:text-right">
                <p>
                  Kickoff <span className="clock text-fg">{formatKathmanduTime(featuredUpcoming.timestamp)}</span>
                </p>
                <p className="mt-1 meta">{shortDate(featuredUpcoming.timestamp)} · Action Sports HD, NetTV</p>
              </div>
              <a href={`/cricket/match/${encodeURIComponent(slugify(`${featuredUpcoming.homeTeam} vs ${featuredUpcoming.awayTeam}`))}/`} className="btn btn-secondary btn-lg w-full sm:w-auto">
                Match details
              </a>
            </div>
          </div>
        </section>
      )}

      <div className="mb-6 flex flex-col gap-4 border-b border-line pb-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="eyebrow">Cricket, Nepal</p>
          <h1 className="mt-2 text-3xl font-medium tracking-[-0.01em] text-fg sm:text-4xl">Nepal Premier League 2026</h1>
          <p className="mt-2 text-sm text-fg-2">
            Fixtures, live scores and streams for all <span className="clock">{allMatches.length}</span> matches, in Nepal Standard Time
          </p>
        </div>

        <div className="relative w-full lg:w-64">
          <svg className="icon pointer-events-none absolute left-3 top-2.5 text-fg-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search"
            aria-label="Search teams or rounds"
            className="input pl-9 pr-8"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              aria-label="Clear search"
              className="absolute right-1.5 top-1.5 inline-flex h-6 w-6 items-center justify-center rounded text-fg-3 hover:text-fg"
            >
              <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M6 6l12 12M18 6 6 18" />
              </svg>
            </button>
          )}
        </div>
      </div>

      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-1" role="tablist" aria-label="Fixtures">
          {tabs.map((t) => (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={activeTab === t.key}
              onClick={() => setActiveTab(t.key)}
              className={`chip ${activeTab === t.key ? 'chip-active' : ''}`}
            >
              <span>{t.label}</span>
              <span className="chip-count">{t.count}</span>
            </button>
          ))}
        </div>
        <span className="meta">TU Cricket Ground, Kirtipur. Synced <span className="clock">{lastSyncTime}</span></span>
      </div>

      {displayedMatches.length === 0 ? (
        activeTab === 'today' ? (
          <div className="card p-8">
            <p className="text-base text-fg">No NPL matches today</p>
            <p className="mt-1 text-sm text-fg-2">
              Nothing scheduled for <span className="clock">{formatKathmanduDate(Date.now())}</span>
            </p>

            {nextUpcoming && (
              <div className="mt-6 flex flex-col gap-3 rounded-xl border border-line bg-ink-900 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="eyebrow">Next match</p>
                  <p className="mt-1 text-[15px] text-fg">
                    {nextUpcoming.homeTeam} v {nextUpcoming.awayTeam}
                  </p>
                  <p className="clock mt-1 text-xs text-fg-2">
                    {formatKathmanduDate(nextUpcoming.timestamp)}, {formatKathmanduTime(nextUpcoming.timestamp)}
                  </p>
                </div>
                <button type="button" onClick={() => setActiveTab('upcoming')} className="btn btn-secondary btn-sm">
                  Upcoming fixtures
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="card px-6 py-12 text-center">
            <p className="text-sm text-fg">No matches for “{query}”</p>
            <button type="button" onClick={() => setQuery('')} className="btn btn-secondary btn-sm mt-4">
              Clear search
            </button>
          </div>
        )
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">{displayedMatches.map((m) => renderMatchCard(m))}</div>
      )}
    </div>
  );
}
