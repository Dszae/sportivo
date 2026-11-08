import React, { useState, useEffect, useMemo } from 'react';
import type { Match } from '../lib/sportivo';
import {
  detectFootballLeague,
  formatKathmanduTime,
  getSafeThumbnailUrl,
  slugify,
  statusOf,
  timeOf,
  titleOf,
} from '../lib/sportivo';
import { loadUserPreferences, saveUserPreferences, type UserPreferences } from '../lib/preferences';
import NotificationCenter from './NotificationCenter';

interface Props {
  initialCategory?: string;
  initialMatches?: Match[];
}

type TabType = 'home' | 'matches' | 'livetv' | 'leagues' | 'profile';
type SportFilter = 'all' | 'football' | 'cricket' | 'basketball' | 'npl';
type DateFilter = 'today' | 'tomorrow' | 'upcoming';

function teamParts(title: string) {
  const parts = title.split(/\s+vs\.?\s+|\s+-\s+/i);
  return { first: parts[0]?.trim() || title, second: parts[1]?.trim() || '' };
}

// Standings data for premier leagues
const STANDINGS_DATA: Record<string, { team: string; p: number; gd: number; pts: number; crest?: string }[]> = {
  'Premier League': [
    { team: 'Liverpool', p: 10, gd: 14, pts: 25 },
    { team: 'Man City', p: 10, gd: 12, pts: 23 },
    { team: 'Arsenal', p: 10, gd: 10, pts: 20 },
    { team: 'Aston Villa', p: 10, gd: 7, pts: 19 },
    { team: 'Tottenham', p: 10, gd: 6, pts: 18 },
    { team: 'Man United', p: 10, gd: 3, pts: 17 },
    { team: 'Newcastle', p: 10, gd: 2, pts: 16 },
    { team: 'Brighton', p: 10, gd: 1, pts: 15 },
  ],
  'Nepal Premier League (NPL)': [
    { team: 'Biratnagar Kings', p: 4, gd: 6, pts: 8 },
    { team: 'Janakpur Bolts', p: 4, gd: 4, pts: 6 },
    { team: 'Kathmandu Gurkhas', p: 4, gd: 2, pts: 6 },
    { team: 'Pokhara Avengers', p: 4, gd: 1, pts: 4 },
    { team: 'Sudurpaschim Royals', p: 4, gd: 0, pts: 4 },
    { team: 'Chitwan Rhinos', p: 4, gd: -1, pts: 2 },
    { team: 'Lumbini Lions', p: 4, gd: -4, pts: 2 },
    { team: 'Karnali Yaks', p: 4, gd: -8, pts: 0 },
  ],
  'La Liga': [
    { team: 'Barcelona', p: 11, gd: 24, pts: 30 },
    { team: 'Real Madrid', p: 11, gd: 10, pts: 24 },
    { team: 'Atletico Madrid', p: 11, gd: 9, pts: 20 },
    { team: 'Athletic Club', p: 11, gd: 5, pts: 18 },
    { team: 'Villarreal', p: 11, gd: 2, pts: 18 },
  ],
};

export default function FotmobHub({ initialCategory = 'all', initialMatches }: Props) {
  const [activeTab, setActiveTab] = useState<TabType>('home');
  const [selectedSport, setSelectedSport] = useState<SportFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState<DateFilter>('today');
  const [selectedLeague, setSelectedLeague] = useState<string>('Premier League');
  const [activeDetailMatch, setActiveDetailMatch] = useState<Match | null>(null);

  const hasInitial = Array.isArray(initialMatches) && initialMatches.length > 0;
  const [matches, setMatches] = useState<Match[]>(() => (hasInitial ? initialMatches! : []));
  const [loading, setLoading] = useState(() => !hasInitial);
  const [prefs, setPrefs] = useState<UserPreferences>(() => loadUserPreferences());
  const [favorites, setFavorites] = useState<string[]>([]);

  // Load matches from API
  useEffect(() => {
    let isMounted = true;
    const fetchAll = async () => {
      try {
        const [fRes, cRes, bRes, nplRes] = await Promise.allSettled([
          fetch('/api/matches/football'),
          fetch('/api/matches/cricket'),
          fetch('/api/matches/basketball'),
          fetch('/api/npl/fixtures'),
        ]);

        let combined: Match[] = [];
        if (fRes.status === 'fulfilled' && fRes.value.ok) {
          const list = await fRes.value.json();
          combined = combined.concat(list.map((m: any) => ({ ...m, category: 'football' })));
        }
        if (cRes.status === 'fulfilled' && cRes.value.ok) {
          const list = await cRes.value.json();
          combined = combined.concat(list.map((m: any) => ({ ...m, category: 'cricket' })));
        }
        if (bRes.status === 'fulfilled' && bRes.value.ok) {
          const list = await bRes.value.json();
          combined = combined.concat(list.map((m: any) => ({ ...m, category: 'basketball' })));
        }
        if (nplRes.status === 'fulfilled' && nplRes.value.ok) {
          const json = await nplRes.value.json();
          const nplMatches = (json.fixtures || []).map((m: any) => ({
            id: `npl-${m.matchNumber}`,
            title: `${m.homeTeam} vs ${m.awayTeam}`,
            category: 'npl',
            league: 'Nepal Premier League',
            status: m.status === 'Live' ? 'Live' : m.status === 'Completed' ? 'Final' : 'Upcoming',
            timestamp: m.timestamp,
            teams: {
              home: { name: m.homeTeam, badge: m.homeTeamLogo, score: m.homeScore },
              away: { name: m.awayTeam, badge: m.awayTeamLogo, score: m.awayScore },
            },
            venue: m.venue,
          }));
          combined = combined.concat(nplMatches);
        }

        if (isMounted) {
          setMatches(combined);
          setLoading(false);
        }
      } catch {
        if (isMounted) setLoading(false);
      }
    };

    fetchAll();
    const interval = setInterval(fetchAll, 30000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  // Sync preferences
  useEffect(() => {
    const p = loadUserPreferences();
    setPrefs(p);
    setFavorites(p.starredMatches || []);
    const handleStorage = () => {
      const updated = loadUserPreferences();
      setPrefs(updated);
      setFavorites(updated.starredMatches || []);
    };
    window.addEventListener('sportivo:preferences-changed', handleStorage);
    return () => window.removeEventListener('sportivo:preferences-changed', handleStorage);
  }, []);

  const toggleFavorite = (slug: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const isFav = favorites.includes(slug);
    const updated = isFav ? favorites.filter((s) => s !== slug) : [...favorites, slug];
    const newPrefs = { ...prefs, starredMatches: updated };
    saveUserPreferences(newPrefs);
    setFavorites(updated);
  };

  // Filter matches
  const filteredMatches = useMemo(() => {
    return matches.filter((m) => {
      if (selectedSport === 'football' && m.category !== 'football') return false;
      if (selectedSport === 'cricket' && m.category !== 'cricket') return false;
      if (selectedSport === 'basketball' && m.category !== 'basketball') return false;
      if (selectedSport === 'npl' && m.category !== 'npl') return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const t = (m.title || '').toLowerCase();
        const l = (m.league || '').toLowerCase();
        if (!t.includes(q) && !l.includes(q)) return false;
      }
      return true;
    });
  }, [matches, selectedSport, searchQuery]);

  const liveMatches = useMemo(() => {
    return filteredMatches.filter((m) => statusOf(m) === 'Live');
  }, [filteredMatches]);

  const upcomingMatches = useMemo(() => {
    return filteredMatches.filter((m) => statusOf(m) === 'Upcoming');
  }, [filteredMatches]);

  // Group by league
  const groupedMatches = useMemo(() => {
    const map = new Map<string, Match[]>();
    filteredMatches.forEach((m) => {
      let lg = m.league;
      if (!lg && m.category === 'football') lg = detectFootballLeague(m);
      if (!lg) lg = m.competition || (m.category === 'npl' ? 'Nepal Premier League' : `${m.category.charAt(0).toUpperCase()}${m.category.slice(1)} fixtures`);
      if (!map.has(lg)) map.set(lg, []);
      map.get(lg)!.push(m);
    });
    return Array.from(map.entries());
  }, [filteredMatches]);

  // Featured TV stream match (prefer live match, or first upcoming)
  const featuredTvMatch = useMemo(() => {
    return liveMatches[0] || upcomingMatches[0] || matches[0] || null;
  }, [liveMatches, upcomingMatches, matches]);

  // Render a compact FotMob match row
  const renderFotmobRow = (match: Match) => {
    const title = titleOf(match);
    const slug = slugify(title);
    const isFav = favorites.includes(slug);
    const isLive = statusOf(match) === 'Live';
    const { first, second } = teamParts(title);
    const homeName = match.teams?.home?.name || first;
    const awayName = match.teams?.away?.name || second;
    const homeBadge = match.teams?.home?.badge ? getSafeThumbnailUrl(match.teams.home.badge) : null;
    const awayBadge = match.teams?.away?.badge ? getSafeThumbnailUrl(match.teams.away.badge) : null;
    const homeScore = match.teams?.home?.score ?? '-';
    const awayScore = match.teams?.away?.score ?? '-';
    const kickoffTime = timeOf(match, 'Asia/Kathmandu');

    return (
      <div
        key={slug}
        onClick={() => setActiveDetailMatch(match)}
        className="row cursor-pointer active:bg-ink-700"
      >
        {/* Status / kickoff column */}
        <div className="w-20 shrink-0 flex flex-col items-start gap-1 pr-3 border-r border-line">
          {isLive ? (
            <span className="live-tag">
              <span className="live-dot" />
              Live
            </span>
          ) : (
            <span className="clock text-xs text-fg">{kickoffTime}</span>
          )}
          <span className="meta">{isLive ? 'Playing' : 'NST'}</span>
        </div>

        {/* Center: two team rows */}
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              {homeBadge ? (
                <img src={homeBadge} alt="" className="h-5 w-5 object-contain shrink-0" />
              ) : (
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-ink-700 text-xs text-fg-2 shrink-0">
                  {homeName.slice(0, 2).toUpperCase()}
                </span>
              )}
              <span className="text-sm text-fg truncate">{homeName}</span>
            </div>
            <span className={`clock text-sm shrink-0 w-6 text-right ${isLive ? 'text-fg' : 'text-fg-3'}`}>{homeScore}</span>
          </div>

          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              {awayBadge ? (
                <img src={awayBadge} alt="" className="h-5 w-5 object-contain shrink-0" />
              ) : (
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-ink-700 text-xs text-fg-2 shrink-0">
                  {awayName.slice(0, 2).toUpperCase()}
                </span>
              )}
              <span className="text-sm text-fg truncate">{awayName}</span>
            </div>
            <span className={`clock text-sm shrink-0 w-6 text-right ${isLive ? 'text-fg' : 'text-fg-3'}`}>{awayScore}</span>
          </div>
        </div>

        {/* Right: actions */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={(e) => toggleFavorite(slug, e)}
            aria-label="Toggle Watchlist"
            className={`inline-flex h-8 w-8 items-center justify-center rounded-lg transition-colors duration-fast ease-out hover:bg-ink-700 ${
              isFav ? 'text-fg' : 'text-fg-3 hover:text-fg'
            }`}
          >
            <svg className="icon" viewBox="0 0 24 24" fill={isFav ? 'currentColor' : 'none'} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
          </button>
          <svg className="icon text-fg-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </div>
      </div>
    );
  };

  return (
    <div className="w-full text-fg font-sans pb-24 lg:pb-12">
      {/* Top app bar */}
      <header className="sticky top-0 z-40 bg-ink-950/95 backdrop-blur-xl border-b border-line px-4 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
          {/* Brand */}
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-ink-700 text-lime shadow-lift">
              <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
              </svg>
            </div>
            <div>
              <span className="text-xl font-medium text-fg">
                Sportivo<span className="text-lime">.</span>
              </span>
              <p className="hidden sm:block meta">Live scores and kickoffs in NST</p>
            </div>
          </div>

          {/* Quick actions (notification bell + APK download) */}
          <div className="flex items-center gap-2">
            <NotificationCenter />
            <a
              href="/download/sportivo.apk"
              download="sportivo.apk"
              className="btn btn-secondary btn-sm"
            >
              <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="7 10 12 15 17 10"></polyline>
                <line x1="12" y1="15" x2="12" y2="3"></line>
              </svg>
              <span><span className="hidden sm:inline">Download </span>APK</span>
            </a>
          </div>
        </div>

        {/* Search */}
        <div className="max-w-7xl mx-auto mt-3">
          <div className="relative">
            <span className="absolute left-3 top-1/2 -mt-2 text-fg-3">
              <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
              </svg>
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search"
              className="input pl-10 pr-10"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                aria-label="Clear search"
                className="absolute right-1 top-1/2 -mt-4 inline-flex h-8 w-8 items-center justify-center rounded-md text-fg-3 transition-colors duration-fast ease-out hover:text-fg"
              >
                <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Sport filter chips */}
        <div className="max-w-7xl mx-auto mt-3 flex items-center gap-1 overflow-x-auto no-scrollbar">
          {[
            { id: 'all', name: 'All' },
            { id: 'football', name: 'Football' },
            { id: 'npl', name: 'NPL 2026' },
            { id: 'cricket', name: 'Cricket' },
            { id: 'basketball', name: 'Basketball' },
          ].map((sport) => {
            const isActive = selectedSport === sport.id;
            return (
              <button
                key={sport.id}
                type="button"
                onClick={() => setSelectedSport(sport.id as SportFilter)}
                className={`chip ${isActive ? 'chip-active' : ''}`}
              >
                <span>{sport.name}</span>
              </button>
            );
          })}
        </div>
      </header>

      {/* Main container: two columns on desktop, one on mobile */}
      <main className="max-w-7xl mx-auto px-4 pt-6 lg:grid lg:grid-cols-12 lg:gap-8">
        {/* Left / center content */}
        <div className="lg:col-span-8 space-y-8">
          {/* TAB 1: HOME */}
          {activeTab === 'home' && (
            <div className="space-y-8">
              {/* Live section */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="eyebrow flex items-center gap-2">
                    {liveMatches.length > 0 && <span className="live-dot" />}
                    <span>Live</span>
                    <span className="clock text-xs">{liveMatches.length}</span>
                  </h2>
                  <button
                    type="button"
                    onClick={() => setActiveTab('matches')}
                    className="btn btn-ghost btn-sm"
                  >
                    View all
                  </button>
                </div>

                {liveMatches.length > 0 ? (
                  <div className="card overflow-hidden">
                    {liveMatches.map((m) => renderFotmobRow(m))}
                  </div>
                ) : (
                  <div className="card p-4 text-center text-sm text-fg-3">
                    <span>No matches live right now. Today's kickoffs are below.</span>
                  </div>
                )}
              </div>

              {/* Featured stream */}
              {featuredTvMatch && (
                <div className="panel p-5">
                  <div className="flex items-center justify-between mb-3">
                    {statusOf(featuredTvMatch) === 'Live' ? (
                      <span className="live-tag">
                        <span className="live-dot" />
                        Live
                      </span>
                    ) : (
                      <span className="eyebrow">Up next</span>
                    )}
                    <span className="clock text-xs text-fg-2">
                      {timeOf(featuredTvMatch, 'Asia/Kathmandu')} NST
                    </span>
                  </div>

                  <h3 className="text-lg font-medium text-fg">
                    {titleOf(featuredTvMatch)}
                  </h3>
                  <p className="text-sm text-fg-3 mt-1">
                    {featuredTvMatch.league || featuredTvMatch.competition || 'Stream links'}
                  </p>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setActiveDetailMatch(featuredTvMatch)}
                      className={`btn ${statusOf(featuredTvMatch) === 'Live' ? 'btn-live' : 'btn-primary'}`}
                    >
                      <svg className="icon" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
                        <polygon points="5 3 19 12 5 21 5 3"></polygon>
                      </svg>
                      <span>{statusOf(featuredTvMatch) === 'Live' ? 'Watch live' : 'Open match'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab('livetv')}
                      className="btn btn-secondary"
                    >
                      <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="2" y="7" width="20" height="15" rx="2" ry="2"></rect>
                        <polyline points="17 2 12 7 7 2"></polyline>
                      </svg>
                      <span>All streams</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Matches by competition */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="eyebrow">Today's matches by competition</h2>
                  <span className="clock text-xs text-fg-3">{filteredMatches.length} fixtures</span>
                </div>

                <div className="space-y-4">
                  {groupedMatches.map(([leagueName, groupMatches]) => (
                    <div key={leagueName} className="card overflow-hidden">
                      <div className="flex items-center justify-between gap-3 px-4 h-9 border-b border-line">
                        <span className="eyebrow truncate">{leagueName}</span>
                        <span className="clock text-xs text-fg-3 shrink-0">
                          {groupMatches.length} {groupMatches.length === 1 ? 'match' : 'matches'}
                        </span>
                      </div>
                      <div>
                        {groupMatches.map((m) => renderFotmobRow(m))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: MATCHES */}
          {activeTab === 'matches' && (
            <div className="space-y-6">
              {/* Date filter */}
              <div className="flex items-center gap-1 rounded-[10px] border border-line bg-ink-800 p-1">
                {(['today', 'tomorrow', 'upcoming'] as DateFilter[]).map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setDateFilter(tab)}
                    className={`chip flex-1 justify-center rounded-md capitalize ${dateFilter === tab ? 'chip-active' : ''}`}
                  >
                    {tab}
                  </button>
                ))}
              </div>

              {/* Grouped match list */}
              <div className="space-y-4">
                {groupedMatches.map(([leagueName, groupMatches]) => (
                  <div key={leagueName} className="card overflow-hidden">
                    <div className="flex items-center justify-between gap-3 px-4 h-9 border-b border-line">
                      <span className="eyebrow truncate">{leagueName}</span>
                      <span className="clock text-xs text-fg-3 shrink-0">
                        {groupMatches.length} fixtures
                      </span>
                    </div>
                    <div>
                      {groupMatches.map((m) => renderFotmobRow(m))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 3: LIVE TV */}
          {activeTab === 'livetv' && (
            <div className="space-y-6">
              <div className="panel p-6">
                <span className="eyebrow">Live TV</span>
                <h2 className="mt-2 text-xl font-medium text-fg">
                  Streams
                </h2>
                <p className="mt-1 text-sm text-fg-3">
                  Pick a match to open its stream links.
                </p>

                <div className="mt-5 card overflow-hidden">
                  {matches.slice(0, 8).map((m) => {
                    const isLive = statusOf(m) === 'Live';
                    return (
                      <div
                        key={m.id || m.title}
                        onClick={() => setActiveDetailMatch(m)}
                        className="row cursor-pointer justify-between"
                      >
                        <div className="min-w-0">
                          <div className="text-sm text-fg truncate">{titleOf(m)}</div>
                          <div className="meta mt-1">{m.league || 'Stream'}</div>
                        </div>
                        {isLive ? (
                          <span className="btn btn-live btn-sm">
                            <span className="live-dot" />
                            Watch live
                          </span>
                        ) : (
                          <span className="meta shrink-0">Scheduled</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: LEAGUES & STANDINGS */}
          {activeTab === 'leagues' && (
            <div className="space-y-6">
              {/* League selector */}
              <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
                {Object.keys(STANDINGS_DATA).map((lg) => (
                  <button
                    key={lg}
                    type="button"
                    onClick={() => setSelectedLeague(lg)}
                    className={`chip ${selectedLeague === lg ? 'chip-active' : ''}`}
                  >
                    {lg}
                  </button>
                ))}
              </div>

              {/* Standings table */}
              <div className="panel overflow-hidden">
                <div className="px-5 h-12 border-b border-line flex items-center justify-between">
                  <h3 className="text-sm font-medium text-fg">{selectedLeague} standings</h3>
                  <span className="meta">2026 season</span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-line text-fg-3 text-xs">
                        <th className="h-9 px-4 w-12 font-medium text-right">#</th>
                        <th className="h-9 px-4 font-medium">Team</th>
                        <th className="h-9 px-3 font-medium text-right">P</th>
                        <th className="h-9 px-3 font-medium text-right">GD</th>
                        <th className="h-9 px-4 font-medium text-right">Pts</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {(STANDINGS_DATA[selectedLeague] || []).map((row, idx) => (
                        <tr key={row.team} className="hover:bg-ink-700/60 transition-colors duration-fast ease-out">
                          <td className={`h-11 px-4 clock text-xs text-right ${idx < 4 ? 'text-fg' : 'text-fg-3'}`}>
                            {idx + 1}
                          </td>
                          <td className="h-11 px-4 text-fg">{row.team}</td>
                          <td className="h-11 px-3 clock text-right text-fg-2">{row.p}</td>
                          <td className="h-11 px-3 clock text-right text-fg-2">{row.gd > 0 ? `+${row.gd}` : row.gd}</td>
                          <td className="h-11 px-4 clock text-right font-medium text-fg">{row.pts}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: PROFILE & WATCHLIST */}
          {activeTab === 'profile' && (
            <div className="space-y-6">
              {/* Profile card */}
              <div className="panel p-6 flex items-center gap-4">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-ink-700 text-xl font-medium text-fg shadow-lift">
                  DS
                </div>
                <div className="min-w-0">
                  <h3 className="text-base font-medium text-fg">Dipesh Sapkota</h3>
                  <p className="text-sm text-fg-3 truncate">dipeshsapkota7@gmail.com</p>
                  <p className="meta mt-1">Creator and publisher</p>
                </div>
              </div>

              {/* Watchlist */}
              <div className="panel p-6">
                <div className="flex items-center gap-2 mb-3">
                  <svg className="icon text-fg-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
                  </svg>
                  <h3 className="text-sm font-medium text-fg">
                    Watchlist <span className="clock text-fg-3">{favorites.length}</span>
                  </h3>
                </div>
                {favorites.length === 0 ? (
                  <p className="text-sm text-fg-3">
                    No starred matches yet. Star a match to get a reminder 5 minutes before kickoff.
                  </p>
                ) : (
                  <div>
                    {favorites.map((slug) => (
                      <div key={slug} className="flex items-center justify-between gap-3 h-10 border-b border-line last:border-b-0 text-sm text-fg">
                        <span className="truncate">{slug.replace(/-/g, ' ')}</span>
                        <button
                          type="button"
                          onClick={(e) => toggleFavorite(slug, e)}
                          className="btn btn-ghost btn-sm"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Settings links */}
              <div className="panel overflow-hidden text-sm">
                <a href="/privacy/" className="row justify-between text-fg">
                  <span className="flex items-center gap-2">
                    <svg className="icon text-fg-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                      <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                    </svg>
                    Privacy policy
                  </span>
                  <svg className="icon text-fg-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </a>
                <a href="/about-dipesh-sapkota/" className="row justify-between text-fg">
                  <span className="flex items-center gap-2">
                    <svg className="icon text-fg-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10"></circle>
                      <line x1="12" y1="16" x2="12" y2="12"></line>
                      <line x1="12" y1="8" x2="12.01" y2="8"></line>
                    </svg>
                    About the creator
                  </span>
                  <svg className="icon text-fg-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </a>
                <a href="/api-docs/" className="row justify-between text-fg">
                  <span className="flex items-center gap-2">
                    <svg className="icon text-fg-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
                      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
                    </svg>
                    API docs
                  </span>
                  <svg className="icon text-fg-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </a>
              </div>
            </div>
          )}
        </div>

        {/* Right sidebar on desktop */}
        <div className="hidden lg:block lg:col-span-4 space-y-6">
          {/* Standings widget */}
          <div className="panel p-5">
            <div className="flex items-center justify-between mb-3 border-b border-line pb-3">
              <h3 className="eyebrow">Premier League standings</h3>
              <span className="meta">2026 season</span>
            </div>
            <div className="text-sm">
              {STANDINGS_DATA['Premier League'].slice(0, 6).map((item, idx) => (
                <div key={item.team} className="flex items-center justify-between gap-3 h-9 border-b border-line last:border-b-0">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="clock text-xs text-fg-3 w-4 text-right shrink-0">{idx + 1}</span>
                    <span className="text-fg truncate">{item.team}</span>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="clock text-xs text-fg-3">{item.p} P</span>
                    <span className="clock text-fg w-6 text-right">{item.pts}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Watchlist widget */}
          <div className="panel p-5">
            <div className="flex items-center gap-2 mb-2">
              <svg className="icon text-fg-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
              </svg>
              <h3 className="eyebrow">Watchlist reminders</h3>
            </div>
            <p className="text-sm text-fg-3 leading-relaxed">
              You get a reminder 5 minutes before kickoff for every starred fixture.
            </p>
          </div>
        </div>
      </main>

      {/* Match detail modal */}
      {activeDetailMatch && (
        <>
          <div
            className="fixed inset-0 z-[99998] bg-ink-950/80"
            onClick={() => setActiveDetailMatch(null)}
          />
          <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 pointer-events-none">
          <div
            role="dialog"
            aria-modal="true"
            className="panel pointer-events-auto w-full max-w-lg p-6 shadow-float text-fg overflow-hidden animate-fade-in"
          >
            <div className="flex justify-between items-center border-b border-line pb-3">
              <span className="eyebrow truncate">
                {activeDetailMatch.league || 'Match details'}
              </span>
              <button
                type="button"
                onClick={() => setActiveDetailMatch(null)}
                aria-label="Close"
                className="icon-btn h-8 w-8"
              >
                <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <div className="my-6 text-center">
              <div className="flex items-center justify-around">
                <div>
                  <div className="h-14 w-14 mx-auto rounded-full bg-ink-700 flex items-center justify-center text-lg font-medium text-fg shadow-lift">
                    {teamParts(titleOf(activeDetailMatch)).first.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="text-sm text-fg mt-2 max-w-[100px] truncate">
                    {teamParts(titleOf(activeDetailMatch)).first}
                  </div>
                </div>

                <div className="flex flex-col items-center gap-2">
                  <div className="clock text-2xl text-fg">
                    {activeDetailMatch.teams?.home?.score ?? '-'} : {activeDetailMatch.teams?.away?.score ?? '-'}
                  </div>
                  {statusOf(activeDetailMatch) === 'Live' ? (
                    <span className="live-tag">
                      <span className="live-dot" />
                      Live
                    </span>
                  ) : (
                    <span className="meta">Scheduled</span>
                  )}
                </div>

                <div>
                  <div className="h-14 w-14 mx-auto rounded-full bg-ink-700 flex items-center justify-center text-lg font-medium text-fg shadow-lift">
                    {teamParts(titleOf(activeDetailMatch)).second.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="text-sm text-fg mt-2 max-w-[100px] truncate">
                    {teamParts(titleOf(activeDetailMatch)).second}
                  </div>
                </div>
              </div>
            </div>

            <div className="border-t border-line pt-4 space-y-2 text-sm">
              <div className="flex justify-between gap-3 text-fg-2">
                <span>Kickoff</span>
                <span className="clock text-fg">{timeOf(activeDetailMatch, 'Asia/Kathmandu')} NST</span>
              </div>
              <div className="flex justify-between gap-3 text-fg-2">
                <span>Venue</span>
                <span className="text-fg text-right truncate">{activeDetailMatch.venue || 'Venue to be confirmed'}</span>
              </div>
            </div>

            <div className="mt-6 flex gap-2">
              <a
                href={`/${activeDetailMatch.category || 'football'}/match/${encodeURIComponent(slugify(titleOf(activeDetailMatch)))}/`}
                className={`btn flex-1 ${statusOf(activeDetailMatch) === 'Live' ? 'btn-live' : 'btn-primary'}`}
              >
                {statusOf(activeDetailMatch) === 'Live' ? 'Watch live' : 'Open match'}
              </a>
            </div>
          </div>
          </div>
        </>
      )}

      {/* Bottom navigation dock (mobile and tablet) */}
      <nav
        aria-label="Fotmob Navigation Dock"
        className="fixed bottom-0 inset-x-0 z-40 bg-ink-950 border-t border-line px-3 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]"
      >
        <div className="flex items-center justify-around max-w-lg mx-auto">
          {[
            {
              id: 'home',
              label: 'Home',
              icon: (
                <svg className="icon h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                  <polyline points="9 22 9 12 15 12 15 22" />
                </svg>
              ),
            },
            {
              id: 'matches',
              label: 'Matches',
              icon: (
                <svg className="icon h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                  <line x1="16" y1="2" x2="16" y2="6" />
                  <line x1="8" y1="2" x2="8" y2="6" />
                  <line x1="3" y1="10" x2="21" y2="10" />
                </svg>
              ),
            },
            {
              id: 'livetv',
              label: 'Live TV',
              icon: (
                <svg className="icon h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="7" width="20" height="15" rx="2" ry="2" />
                  <polyline points="17 2 12 7 7 2" />
                </svg>
              ),
            },
            {
              id: 'leagues',
              label: 'Leagues',
              icon: (
                <svg className="icon h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
                  <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
                  <path d="M4 22h16" />
                  <path d="M10 14.66V17c0 .55-.45 1-1 1H7" />
                  <path d="M14 14.66V17c0 .55.45 1 1 1h2" />
                  <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
                </svg>
              ),
            },
            {
              id: 'profile',
              label: 'Profile',
              icon: (
                <svg className="icon h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
              ),
            },
          ].map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id as TabType)}
                className={`flex flex-col items-center justify-center gap-1 h-12 px-3 rounded-lg transition-colors duration-fast ease-out min-w-[56px] ${
                  isActive ? 'bg-ink-800 text-fg shadow-lift' : 'text-fg-3 hover:text-fg-2'
                }`}
              >
                <span className="shrink-0 leading-none">{item.icon}</span>
                <span className="text-xs leading-none">{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

