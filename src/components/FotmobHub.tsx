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

export default function FotmobHub({ initialCategory = 'all' }: Props) {
  const [activeTab, setActiveTab] = useState<TabType>('home');
  const [selectedSport, setSelectedSport] = useState<SportFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState<DateFilter>('today');
  const [selectedLeague, setSelectedLeague] = useState<string>('Premier League');
  const [activeDetailMatch, setActiveDetailMatch] = useState<Match | null>(null);

  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
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
      if (!lg) lg = m.competition || (m.category === 'npl' ? 'Nepal Premier League' : `${m.category.toUpperCase()} Fixtures`);
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
        className="flex items-center justify-between p-3.5 hover:bg-[#14201d] transition-all cursor-pointer border-b border-white/[0.06] last:border-b-0 active:bg-[#182623]"
      >
        {/* Status / Kickoff Column */}
        <div className="w-16 shrink-0 flex flex-col items-start pr-3 border-r border-white/10">
          {isLive ? (
            <span className="inline-flex items-center gap-1 rounded bg-red-600 px-1.5 py-0.5 text-[10px] font-black text-white shadow-sm animate-pulse">
              <span className="h-1.5 w-1.5 rounded-full bg-white" />
              LIVE
            </span>
          ) : (
            <span className="text-xs font-black text-[#00e676] tabular-nums">
              {kickoffTime}
            </span>
          )}
          <span className="text-[9px] font-bold text-slate-400 mt-0.5">
            {isLive ? 'Playing' : 'NST'}
          </span>
        </div>

        {/* Center: Two Team Rows */}
        <div className="flex-1 px-3 space-y-1.5 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              {homeBadge ? (
                <img src={homeBadge} alt="" className="h-5 w-5 object-contain shrink-0 drop-shadow" />
              ) : (
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/10 text-[9px] font-black text-[#00e676] shrink-0">
                  {homeName.slice(0, 2).toUpperCase()}
                </span>
              )}
              <span className="text-xs font-bold text-white truncate">{homeName}</span>
            </div>
            <span className="text-xs font-black tabular-nums text-white shrink-0">{homeScore}</span>
          </div>

          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              {awayBadge ? (
                <img src={awayBadge} alt="" className="h-5 w-5 object-contain shrink-0 drop-shadow" />
              ) : (
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/10 text-[9px] font-black text-[#00e676] shrink-0">
                  {awayName.slice(0, 2).toUpperCase()}
                </span>
              )}
              <span className="text-xs font-bold text-white truncate">{awayName}</span>
            </div>
            <span className="text-xs font-black tabular-nums text-white shrink-0">{awayScore}</span>
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2 shrink-0 pl-2">
          <button
            type="button"
            onClick={(e) => toggleFavorite(slug, e)}
            aria-label="Toggle Watchlist"
            className="p-1.5 text-sm text-slate-500 hover:text-amber-400 transition"
          >
            {isFav ? <span className="text-amber-400">★</span> : '☆'}
          </button>
          <span className="text-slate-500 text-sm">›</span>
        </div>
      </div>
    );
  };

  return (
    <div className="w-full text-slate-100 font-sans pb-24 lg:pb-12">
      {/* Top App Bar (FotMob Style) */}
      <header className="sticky top-0 z-40 bg-[#0a0f0d]/98 backdrop-blur-xl border-b border-white/10 px-4 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
          {/* Brand */}
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#00e676]/20 border border-[#00e676]/40 text-[#00e676] font-black text-lg shadow-sm">
              ⚡
            </div>
            <div>
              <span className="text-xl font-black text-white tracking-tight">
                Sportivo<span className="text-[#00e676]">.</span>
              </span>
              <p className="hidden sm:block text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                Live Sports · All in One Place
              </p>
            </div>
          </div>

          {/* Quick Actions (Notification Bell + Native APK Button) */}
          <div className="flex items-center gap-2">
            <NotificationCenter />
            <a
              href="https://github.com/Dszae/sportivo/actions"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-full bg-[#00e676] px-3 py-1.5 text-xs font-black text-[#080a0b] hover:bg-[#00c966] transition shadow-md"
            >
              <span>📲</span>
              <span className="hidden sm:inline">Download</span> APK
            </a>
          </div>
        </div>

        {/* Search Bar Input */}
        <div className="max-w-7xl mx-auto mt-3">
          <div className="relative">
            <span className="absolute left-3.5 top-2.5 text-slate-400 text-sm">🔍</span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search leagues, teams, or matches..."
              className="w-full rounded-2xl border border-white/10 bg-[#121c19] pl-10 pr-9 py-2 text-xs text-white placeholder-slate-400 focus:border-[#00e676] focus:outline-none transition"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-2 text-xs text-slate-400 hover:text-white"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Sports Category Circular Chips (FotMob Horizontal Scroll) */}
        <div className="max-w-7xl mx-auto mt-3 flex items-center gap-3 overflow-x-auto no-scrollbar py-1">
          {[
            { id: 'all', name: 'All Sports', icon: '🏆' },
            { id: 'football', name: 'Football', icon: '⚽' },
            { id: 'npl', name: 'NPL 2026', icon: '🇳🇵' },
            { id: 'cricket', name: 'Cricket', icon: '🏏' },
            { id: 'basketball', name: 'Basketball', icon: '🏀' },
          ].map((sport) => {
            const isActive = selectedSport === sport.id;
            return (
              <button
                key={sport.id}
                type="button"
                onClick={() => setSelectedSport(sport.id as SportFilter)}
                className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-bold shrink-0 transition-all border ${
                  isActive
                    ? 'border-[#00e676] bg-[#00e676] text-[#080a0b] font-black shadow-sm'
                    : 'border-white/10 bg-[#121c19] text-slate-300 hover:border-white/20 hover:text-white'
                }`}
              >
                <span>{sport.icon}</span>
                <span>{sport.name}</span>
              </button>
            );
          })}
        </div>
      </header>

      {/* Main Container: Responsive Dual Column on Desktop, Mobile Single Column */}
      <main className="max-w-7xl mx-auto px-4 pt-4 lg:grid lg:grid-cols-12 lg:gap-8">
        {/* Left / Center Content (Col 8 on PC, Col 12 on Mobile) */}
        <div className="lg:col-span-8 space-y-6">
          {/* TAB 1: HOME */}
          {activeTab === 'home' && (
            <div className="space-y-6">
              {/* LIVE NOW SECTION */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-red-500 animate-ping" />
                    <h2 className="text-xs font-black uppercase tracking-wider text-red-400">
                      Live Now ({liveMatches.length})
                    </h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveTab('matches')}
                    className="text-xs font-bold text-[#00e676] hover:underline"
                  >
                    View all &rarr;
                  </button>
                </div>

                {liveMatches.length > 0 ? (
                  <div className="rounded-2xl border border-red-500/30 bg-[#0c1412] shadow-xl overflow-hidden divide-y divide-white/5 ring-1 ring-red-500/20">
                    {liveMatches.map((m) => renderFotmobRow(m))}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-white/10 bg-[#0e1715] p-4 text-center text-xs text-slate-400">
                    <span>No matches currently playing live. Upcoming NST fixtures scheduled below.</span>
                  </div>
                )}
              </div>

              {/* FEATURED LIVE TV SPOTLIGHT BANNER */}
              {featuredTvMatch && (
                <div className="rounded-3xl border border-white/10 bg-[#0e1715] p-5 shadow-2xl relative overflow-hidden">
                  <div className="flex items-center justify-between mb-3">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-red-600 px-2.5 py-0.5 text-[10px] font-black text-white uppercase">
                      <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
                      Live TV Broadcast
                    </span>
                    <span className="text-[11px] font-bold text-[#00e676]">
                      {timeOf(featuredTvMatch, 'Asia/Kathmandu')} NST
                    </span>
                  </div>

                  <h3 className="text-base sm:text-lg font-black text-white">
                    {titleOf(featuredTvMatch)}
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {featuredTvMatch.league || featuredTvMatch.competition || 'Multi-Server HD Streaming'}
                  </p>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setActiveDetailMatch(featuredTvMatch)}
                      className="inline-flex items-center gap-2 rounded-xl bg-[#00e676] px-4 py-2 text-xs font-black text-[#080a0b] hover:bg-[#00c966] transition shadow-md"
                    >
                      <span>▶ Watch Live Feed</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab('livetv')}
                      className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-xs font-bold text-white hover:bg-white/10 transition"
                    >
                      <span>📺 Multi-Server Streams</span>
                    </button>
                  </div>
                </div>
              )}

              {/* TOP MATCHES BY LEAGUE */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-xs font-black uppercase tracking-wider text-slate-300">
                    Today's Matches by Competition
                  </h2>
                  <span className="text-[11px] text-slate-400">{filteredMatches.length} Fixtures</span>
                </div>

                <div className="space-y-4">
                  {groupedMatches.map(([leagueName, groupMatches]) => (
                    <div
                      key={leagueName}
                      className="rounded-2xl border border-white/10 bg-[#0e1715] shadow-lg overflow-hidden"
                    >
                      <div className="flex items-center justify-between px-4 py-2.5 bg-[#121c19] border-b border-white/10">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-black uppercase tracking-wider text-white">
                            {leagueName}
                          </span>
                        </div>
                        <span className="text-[10px] font-bold text-slate-400">
                          {groupMatches.length} {groupMatches.length === 1 ? 'match' : 'matches'}
                        </span>
                      </div>
                      <div className="divide-y divide-white/[0.06]">
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
            <div className="space-y-5">
              {/* Date Filter Pills */}
              <div className="flex items-center gap-2 bg-[#0e1715] p-1 rounded-2xl border border-white/10">
                {(['today', 'tomorrow', 'upcoming'] as DateFilter[]).map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setDateFilter(tab)}
                    className={`flex-1 py-1.5 text-xs font-bold rounded-xl capitalize transition-all ${
                      dateFilter === tab
                        ? 'bg-[#00e676] text-[#080a0b] font-black shadow-sm'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>

              {/* Grouped Match List */}
              <div className="space-y-4">
                {groupedMatches.map(([leagueName, groupMatches]) => (
                  <div
                    key={leagueName}
                    className="rounded-2xl border border-white/10 bg-[#0e1715] shadow-lg overflow-hidden"
                  >
                    <div className="flex items-center justify-between px-4 py-2.5 bg-[#121c19] border-b border-white/10">
                      <span className="text-xs font-black uppercase tracking-wider text-white">
                        {leagueName}
                      </span>
                      <span className="text-[10px] font-bold text-slate-400">
                        {groupMatches.length} fixtures
                      </span>
                    </div>
                    <div className="divide-y divide-white/[0.06]">
                      {groupMatches.map((m) => renderFotmobRow(m))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 3: LIVE TV */}
          {activeTab === 'livetv' && (
            <div className="space-y-5">
              <div className="rounded-3xl border border-white/10 bg-[#0e1715] p-6 shadow-2xl">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-red-600 px-2.5 py-0.5 text-[10px] font-black text-white uppercase">
                  <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
                  Live TV Stream Center
                </span>
                <h2 className="mt-3 text-xl font-black text-white">
                  Multi-Server Broadcasting Feeds
                </h2>
                <p className="mt-1 text-xs text-slate-400">
                  Select a live match below to launch authorized video players with multiple CDN fallbacks.
                </p>

                <div className="mt-5 space-y-3">
                  {matches.slice(0, 8).map((m) => {
                    const isLive = statusOf(m) === 'Live';
                    return (
                      <div
                        key={m.id || m.title}
                        onClick={() => setActiveDetailMatch(m)}
                        className="flex items-center justify-between p-3.5 rounded-2xl border border-white/10 bg-[#121c19] hover:border-[#00e676]/40 cursor-pointer transition"
                      >
                        <div>
                          <div className="text-xs font-black text-white">{titleOf(m)}</div>
                          <div className="text-[10px] text-slate-400 mt-0.5">{m.league || 'Sports Stream'}</div>
                        </div>
                        <span className={`rounded-xl px-3 py-1 text-xs font-bold ${
                          isLive ? 'bg-red-600 text-white font-black' : 'bg-white/10 text-slate-300'
                        }`}>
                          {isLive ? '▶ Watch Live' : '⏰ Schedule'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: LEAGUES & STANDINGS */}
          {activeTab === 'leagues' && (
            <div className="space-y-5">
              {/* League Selector Pills */}
              <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
                {Object.keys(STANDINGS_DATA).map((lg) => (
                  <button
                    key={lg}
                    type="button"
                    onClick={() => setSelectedLeague(lg)}
                    className={`rounded-full px-4 py-1.5 text-xs font-bold shrink-0 transition-all border ${
                      selectedLeague === lg
                        ? 'border-[#00e676] bg-[#00e676] text-[#080a0b] font-black'
                        : 'border-white/10 bg-[#0e1715] text-slate-300'
                    }`}
                  >
                    {lg}
                  </button>
                ))}
              </div>

              {/* Standings Table Card */}
              <div className="rounded-3xl border border-white/10 bg-[#0e1715] overflow-hidden shadow-xl">
                <div className="px-5 py-3.5 bg-[#121c19] border-b border-white/10 flex items-center justify-between">
                  <h3 className="text-sm font-black text-white">{selectedLeague} Standings</h3>
                  <span className="text-[10px] font-bold text-[#00e676]">2026 Season</span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-white/10 text-slate-400 text-[10px] font-black uppercase">
                        <th className="py-2.5 px-4 w-10">#</th>
                        <th className="py-2.5 px-4">Team</th>
                        <th className="py-2.5 px-3 text-center">P</th>
                        <th className="py-2.5 px-3 text-center">GD</th>
                        <th className="py-2.5 px-4 text-right">Pts</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.06]">
                      {(STANDINGS_DATA[selectedLeague] || []).map((row, idx) => (
                        <tr key={row.team} className="hover:bg-white/[0.02] transition">
                          <td className="py-3 px-4 font-black">
                            <span className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] ${
                              idx < 4 ? 'bg-[#00e676]/20 text-[#00e676] font-black' : 'text-slate-400'
                            }`}>
                              {idx + 1}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-bold text-white">{row.team}</td>
                          <td className="py-3 px-3 text-center text-slate-300 font-medium">{row.p}</td>
                          <td className="py-3 px-3 text-center text-slate-300 font-medium">{row.gd > 0 ? `+${row.gd}` : row.gd}</td>
                          <td className="py-3 px-4 text-right font-black text-[#00e676] text-sm">{row.pts}</td>
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
            <div className="space-y-5">
              {/* Profile Card */}
              <div className="rounded-3xl border border-white/10 bg-[#0e1715] p-6 shadow-xl flex items-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#00e676]/20 border border-[#00e676]/40 text-2xl font-black text-[#00e676]">
                  DS
                </div>
                <div>
                  <h3 className="text-base font-black text-white">Dipesh Sapkota</h3>
                  <p className="text-xs text-slate-400">dipeshsapkota7@gmail.com</p>
                  <span className="mt-1 inline-block rounded-full bg-[#00e676]/15 border border-[#00e676]/30 px-2.5 py-0.5 text-[9px] font-black text-[#00e676]">
                    Creator &amp; Publisher
                  </span>
                </div>
              </div>

              {/* Watchlist Section */}
              <div className="rounded-3xl border border-white/10 bg-[#0e1715] p-6 shadow-xl">
                <h3 className="text-sm font-black text-white mb-3">⭐ My Watchlist ({favorites.length})</h3>
                {favorites.length === 0 ? (
                  <p className="text-xs text-slate-400">
                    You haven't followed any matches yet. Tap the ☆ star icon on any match to receive 5-minute pre-match notifications.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {favorites.map((slug) => (
                      <div key={slug} className="flex items-center justify-between p-3 rounded-xl bg-[#121c19] text-xs font-bold text-white">
                        <span>{slug.replace(/-/g, ' ')}</span>
                        <button
                          type="button"
                          onClick={(e) => toggleFavorite(slug, e)}
                          className="text-red-400 hover:text-red-300 text-xs"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Settings Links */}
              <div className="rounded-3xl border border-white/10 bg-[#0e1715] divide-y divide-white/[0.06] overflow-hidden text-xs">
                <a href="/privacy/" className="flex items-center justify-between p-4 hover:bg-white/[0.02]">
                  <span>🔒 Privacy Policy</span>
                  <span className="text-slate-500">›</span>
                </a>
                <a href="/about-dipesh-sapkota/" className="flex items-center justify-between p-4 hover:bg-white/[0.02]">
                  <span>ℹ️ About the Creator</span>
                  <span className="text-slate-500">›</span>
                </a>
                <a href="/api-docs/" className="flex items-center justify-between p-4 hover:bg-white/[0.02]">
                  <span>⚡ Developer API Docs</span>
                  <span className="text-slate-500">›</span>
                </a>
              </div>
            </div>
          )}
        </div>

        {/* Right Sidebar on Desktop (Col 4 on PC, hidden on mobile) */}
        <div className="hidden lg:block lg:col-span-4 space-y-6">
          {/* Standings Widget */}
          <div className="rounded-3xl border border-white/10 bg-[#0e1715] p-5 shadow-xl">
            <div className="flex items-center justify-between mb-4 border-b border-white/10 pb-3">
              <h3 className="text-xs font-black uppercase tracking-wider text-white">
                Premier League Standings
              </h3>
              <span className="text-[10px] text-[#00e676] font-bold">Live Table</span>
            </div>
            <div className="space-y-2 text-xs">
              {STANDINGS_DATA['Premier League'].slice(0, 6).map((item, idx) => (
                <div key={item.team} className="flex items-center justify-between py-1 border-b border-white/[0.04]">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-slate-400 font-bold w-4">{idx + 1}</span>
                    <span className="font-bold text-white">{item.team}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-[11px] text-slate-400">{item.p}p</span>
                    <span className="text-xs font-black text-[#00e676]">{item.pts} pts</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Watchlist Widget */}
          <div className="rounded-3xl border border-white/10 bg-[#0e1715] p-5 shadow-xl">
            <h3 className="text-xs font-black uppercase tracking-wider text-amber-400 mb-2">
              ⭐ Watchlist Alerts
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Sportivo automatically warns you 5 minutes before kickoff for all your starred fixtures.
            </p>
          </div>
        </div>
      </main>

      {/* MATCH DETAIL MODAL (Matching Example 10 in Screenshot) */}
      {activeDetailMatch && (
        <>
          <div
            className="fixed inset-0 z-[99998] bg-black/85 backdrop-blur-md"
            onClick={() => setActiveDetailMatch(null)}
          />
          <div
            role="dialog"
            aria-modal="true"
            className="fixed inset-x-4 top-1/2 -translate-y-1/2 z-[99999] max-w-lg mx-auto rounded-3xl border-2 border-white/20 bg-[#0c1412] p-6 shadow-2xl text-slate-100 ring-1 ring-[#00e676]/30 overflow-hidden"
          >
            <div className="flex justify-between items-center border-b border-white/10 pb-3">
              <span className="text-xs font-bold text-[#00e676] uppercase">
                {activeDetailMatch.league || 'Match Details'}
              </span>
              <button
                type="button"
                onClick={() => setActiveDetailMatch(null)}
                className="h-8 w-8 rounded-full bg-white/10 flex items-center justify-center text-slate-300 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="my-6 text-center">
              <div className="flex items-center justify-around">
                <div>
                  <div className="h-14 w-14 mx-auto rounded-2xl bg-white/10 flex items-center justify-center text-lg font-black text-[#00e676]">
                    {teamParts(titleOf(activeDetailMatch)).first.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="text-xs font-bold text-white mt-2 max-w-[100px] truncate">
                    {teamParts(titleOf(activeDetailMatch)).first}
                  </div>
                </div>

                <div>
                  <div className="text-2xl font-black text-white tracking-wider">
                    {activeDetailMatch.teams?.home?.score ?? '-'} : {activeDetailMatch.teams?.away?.score ?? '-'}
                  </div>
                  <span className={`inline-block mt-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${
                    statusOf(activeDetailMatch) === 'Live' ? 'bg-red-600 text-white animate-pulse' : 'bg-white/10 text-slate-300'
                  }`}>
                    {statusOf(activeDetailMatch) === 'Live' ? 'LIVE NOW' : 'SCHEDULED'}
                  </span>
                </div>

                <div>
                  <div className="h-14 w-14 mx-auto rounded-2xl bg-white/10 flex items-center justify-center text-lg font-black text-[#00e676]">
                    {teamParts(titleOf(activeDetailMatch)).second.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="text-xs font-bold text-white mt-2 max-w-[100px] truncate">
                    {teamParts(titleOf(activeDetailMatch)).second}
                  </div>
                </div>
              </div>
            </div>

            <div className="border-t border-white/10 pt-4 space-y-2 text-xs">
              <div className="flex justify-between text-slate-300">
                <span>Kickoff Time:</span>
                <span className="font-bold text-white">{timeOf(activeDetailMatch, 'Asia/Kathmandu')} NST</span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span>Venue:</span>
                <span className="font-bold text-white">{activeDetailMatch.venue || 'International Ground'}</span>
              </div>
            </div>

            <div className="mt-6 flex gap-2">
              <a
                href={`/${activeDetailMatch.category || 'football'}/match/${encodeURIComponent(slugify(titleOf(activeDetailMatch)))}/`}
                className="flex-1 text-center py-2.5 rounded-xl bg-[#00e676] text-xs font-black text-[#080a0b] hover:bg-[#00c966] transition shadow-md"
              >
                Launch Live Desk &rarr;
              </a>
            </div>
          </div>
        </>
      )}

      {/* FLOATING FOTMOB BOTTOM DOCK (Mobile & Tablet) */}
      <nav
        aria-label="Fotmob Navigation Dock"
        className="fixed bottom-0 inset-x-0 z-40 bg-[#090f0d]/98 backdrop-blur-2xl border-t border-white/10 px-3 py-2 pb-[max(0.6rem,env(safe-area-inset-bottom))]"
      >
        <div className="flex items-center justify-around max-w-lg mx-auto">
          {[
            { id: 'home', label: 'Home', icon: '🏠' },
            { id: 'matches', label: 'Matches', icon: '📅' },
            { id: 'livetv', label: 'Live TV', icon: '📺' },
            { id: 'leagues', label: 'Leagues', icon: '🏆' },
            { id: 'profile', label: 'Profile', icon: '👤' },
          ].map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id as TabType)}
                className={`flex flex-col items-center gap-1 py-1 px-3 rounded-2xl transition-all duration-200 min-w-[56px] ${
                  isActive ? 'text-[#00e676] font-black scale-105' : 'text-slate-400 hover:text-white'
                }`}
              >
                <span className="text-lg leading-none">{item.icon}</span>
                <span className="text-[10px] font-bold leading-none tracking-tight">{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
