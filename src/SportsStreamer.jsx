import React, { useState, useEffect } from 'react';

const isSafeExternalUrl = (value) => {
  if (!value || typeof value !== 'string') return false;
  try {
    const url = new URL(value, window.location.origin);
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password;
  } catch {
    return false;
  }
};

const toMatchSlug = (title) => (title || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const getStreamUrl = (stream) => {
  if (!stream) return '';
  if (typeof stream === 'string') return stream;
  return stream.embedUrl || stream.url || '';
};

const getMatchStatus = (match) => {
  const status = String(match?.status || '').toLowerCase();
  const time = String(match?.time || '').toLowerCase();
  if (['live', 'inplay', 'in-play', 'ongoing'].includes(status) || time === 'live') return 'live';
  if (['finished', 'complete', 'completed', 'ended', 'result'].includes(status)) return 'result';

  if (typeof match?.date === 'number' && match.date <= 0) return 'live';

  const timestamp = match?.date || match?.startTime || match?.start_at || match?.timestamp;
  if (timestamp) {
    const start = typeof timestamp === 'number' ? timestamp : new Date(timestamp).getTime();
    if (!Number.isNaN(start) && start > 0) {
      const now = Date.now();
      if (now >= start && now <= start + 3.5 * 60 * 60 * 1000) return 'live';
      if (now > start + 3.5 * 60 * 60 * 1000) return 'result';
    }
  }

  return 'upcoming';
};

const getMatchTime = (match) => {
  const timestamp = match?.date || match?.startTime || match?.start_at || match?.timestamp;
  if (!timestamp) return match?.time || 'Time TBA';
  if (typeof timestamp === 'number' && timestamp <= 0) return '24/7 Live Feed';
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime()) || date.getUTCFullYear() <= 1970) return match?.time || 'Time TBA';
  return new Intl.DateTimeFormat('en-NP', {
    timeZone: 'Asia/Kathmandu',
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
};

const getMatchTitle = (match) => match?.title || match?.name || 'Untitled fixture';

const getCategoryFromPath = () => {
  const category = window.location.pathname.split('/').filter(Boolean)[0];
  return ['football', 'cricket', 'basketball'].includes(category) ? category : 'football';
};

const getMatchSlugFromPath = () => {
  const parts = window.location.pathname.split('/').filter(Boolean);
  return parts[1] === 'match' ? parts[2] : null;
};

export default function SportsStreamer() {
  const [matches, setMatches] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMatch, setSelectedMatch] = useState(null);
  const [streams, setStreams] = useState([]);
  const [activeStream, setActiveStream] = useState(null);
  const [activeCategory] = useState(getCategoryFromPath);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  useEffect(() => {
    const controller = new AbortController();
    fetchMatches(activeCategory, controller.signal);
    return () => controller.abort();
  }, [activeCategory]);

  useEffect(() => {
    const categoryLabel = activeCategory[0].toUpperCase() + activeCategory.slice(1);
    const isHome = window.location.pathname === '/';
    const title = isHome
      ? 'Sportivo by Dipesh Sapkota | Live Scores & Sports Fixtures'
      : `${categoryLabel} Fixtures & Live Scores | Sportivo`;
    const description = isHome
      ? 'Follow football, cricket, and basketball fixtures with local kickoff times and verified stream availability on Sportivo.'
      : `Follow ${activeCategory} fixtures, results, local kickoff times, and verified stream availability on Sportivo.`;
    const canonical = `https://sportivo.dipeshsapkota7.com.np${isHome ? '/' : `/${activeCategory}/`}`;

    document.title = title;
    document.querySelector('meta[name="description"]')?.setAttribute('content', description);
    document.querySelector('link[rel="canonical"]')?.setAttribute('href', canonical);
  }, [activeCategory]);

  useEffect(() => {
    const handleUrlChange = () => {
      const params = new URLSearchParams(window.location.search);
      const matchSlug = params.get('match') || getMatchSlugFromPath();
      
      if (matchSlug && matches.length > 0) {
        const found = matches.find(m => {
          const slug = toMatchSlug(getMatchTitle(m));
          return slug === matchSlug;
        });
        if (found && (!selectedMatch || getMatchTitle(selectedMatch) !== getMatchTitle(found))) {
          loadStream(found, false);
        }
      } else if (!matchSlug && selectedMatch) {
        setSelectedMatch(null);
        setStreams([]);
        setActiveStream(null);
      }
    };

    if (matches.length > 0) {
      handleUrlChange();
    }
    window.addEventListener('popstate', handleUrlChange);
    return () => window.removeEventListener('popstate', handleUrlChange);
  }, [matches, selectedMatch]);

  const filteredMatches = (searchQuery
    ? matches.filter((match) => {
        const lowerQuery = searchQuery.toLowerCase();
        return (match.title && match.title.toLowerCase().includes(lowerQuery)) ||
          (match.category && match.category.toLowerCase().includes(lowerQuery));
      })
    : matches
  ).slice().sort((a, b) => {
    const statusA = getMatchStatus(a);
    const statusB = getMatchStatus(b);
    if (statusA === 'live' && statusB !== 'live') return -1;
    if (statusB === 'live' && statusA !== 'live') return 1;
    if (statusA === 'upcoming' && statusB === 'result') return -1;
    if (statusB === 'upcoming' && statusA === 'result') return 1;

    const timeA = typeof a.date === 'number' ? a.date : new Date(a.date || a.startTime || a.start_at || a.timestamp || 0).getTime() || 0;
    const timeB = typeof b.date === 'number' ? b.date : new Date(b.date || b.startTime || b.start_at || b.timestamp || 0).getTime() || 0;
    return timeA - timeB;
  });

  async function fetchMatches(category, signal) {
    setLoading(true);
    setError(null);
    let data = null;

    try {
      const response = await fetch(`/api/matches/${encodeURIComponent(category)}/`, { signal });
      if (response.ok) data = await response.json();
    } catch {}

    if (!data) {
      try {
        const response = await fetch(`/api/matches/${encodeURIComponent(category)}`, { signal });
        if (response.ok) data = await response.json();
      } catch {}
    }

    if (!data) {
      try {
        const response = await fetch(`https://streamed.pk/api/matches/${encodeURIComponent(category)}`, { signal });
        if (response.ok) data = await response.json();
      } catch (err) {
        if (err.name === 'AbortError') return;
      }
    }

    if (data && Array.isArray(data)) {
      setMatches(data);
      setLastUpdated(new Date());
    } else {
      setError('Unable to load fixtures right now.');
      setMatches([]);
    }
    setLoading(false);
  }

  async function loadStream(match, updateUrl = true) {
    setSelectedMatch(match);
    setStreams([]);
    setActiveStream(null);
    setError(null);

    if (updateUrl && getMatchTitle(match)) {
      const slug = toMatchSlug(getMatchTitle(match));
      const newUrl = `${window.location.pathname}?match=${slug}`;
      window.history.pushState({ path: newUrl }, '', newUrl);
    }

    if (!match.sources || match.sources.length === 0) {
      setError('No stream sources available for this match.');
      return;
    }

    try {
      const source = match.sources[0];
      if (!source?.source || !source?.id) throw new Error('Invalid stream source');

      const src = encodeURIComponent(source.source);
      const sid = encodeURIComponent(source.id);
      let streamData = null;

      try {
        const res = await fetch(`/api/stream/${src}/${sid}/`);
        if (res.ok) streamData = await res.json();
      } catch {}

      if (!streamData) {
        try {
          const res = await fetch(`/api/stream/${src}/${sid}`);
          if (res.ok) streamData = await res.json();
        } catch {}
      }

      if (!streamData) {
        try {
          const res = await fetch(`https://streamed.pk/api/stream/${src}/${sid}`);
          if (res.ok) streamData = await res.json();
        } catch {}
      }

      if (!streamData) throw new Error('Failed to fetch stream details');
      
      let actualData = streamData;
      if (typeof streamData.contents === 'string') {
        try {
          actualData = JSON.parse(streamData.contents);
        } catch {
          throw new Error('Invalid stream response');
        }
      }
      const parsedStreams = (Array.isArray(actualData) ? actualData : [actualData])
        .filter((stream) => isSafeExternalUrl(getStreamUrl(stream)));
      setStreams(parsedStreams);
      
      if (parsedStreams.length > 0) {
        setActiveStream(parsedStreams[0]);
      } else {
        setError('No active stream feeds available for this fixture yet. Live feeds typically go online 15 minutes before kickoff.');
      }
    } catch (err) {
      console.error(err);
      setError('This stream is currently offline. Live feeds typically go live 15 minutes before kickoff.');
    }
  }

  const parseMatchTeams = (title) => {
    if (!title) return { isMatch: false, teamA: 'Unknown', teamB: '' };
    const parts = title.split(/\s+vs\.?\s+|\s+-\s+/i);
    if (parts.length >= 2) {
      return { isMatch: true, teamA: parts[0].trim(), teamB: parts[1].trim() };
    }
    return { isMatch: false, teamA: title, teamB: '' };
  };

  const currentUrl = getStreamUrl(activeStream);

  return (
    <div className="site-shell min-h-screen text-slate-100 flex flex-col justify-between">
      <div>
        <header className="site-header border-b border-white/10 bg-[#101716]/95 backdrop-blur sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-4">
            
            <a href="/" className="flex flex-col group cursor-pointer hover:opacity-80 transition-opacity" aria-label="Sportivo home">
              <div className="flex items-center gap-3">
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#e5b94f] opacity-50"></span>
                  <span className="site-logo-dot relative inline-flex rounded-full h-3 w-3"></span>
                </span>
                <h1 className="text-2xl font-black tracking-tight text-white leading-none">
                  Sportivo<span className="site-accent">.</span>
                </h1>
              </div>
              <span className="text-[10px] font-bold text-slate-500 ml-6 mt-1 uppercase tracking-widest group-hover:text-[#c9f36b] transition-colors">
                Sports fixtures by Dipesh Sapkota
              </span>
            </a>

            <nav className="flex gap-2">
              {['football', 'cricket', 'basketball'].map((cat) => (
                <a
                  key={cat}
                  href={`/${cat}/`}
                  aria-current={activeCategory === cat && !selectedMatch ? 'page' : undefined}
                  className={`px-5 py-2 rounded-full text-xs font-bold capitalize transition-all ${
                    activeCategory === cat && !selectedMatch
                      ? 'site-button-active'
                      : 'text-slate-400 hover:text-white bg-white/5 hover:bg-white/10'
                  }`}
                >
                  {cat}
                </a>
              ))}
            </nav>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-6 py-8">
          {!selectedMatch && (
            <section className="relative mb-12 overflow-hidden rounded-2xl border border-white/10 bg-[#111716] px-6 py-10 sm:px-10 sm:py-14">
              <div className="pointer-events-none absolute inset-y-0 right-0 w-1/3 bg-gradient-to-l from-[#c9f36b]/10 to-transparent" />
              <div className="relative max-w-2xl">
                <div className="mb-5 flex items-center gap-3 text-[10px] font-black uppercase tracking-[0.28em] text-[#e5b94f]">
                  <span className="h-px w-8 bg-[#c9f36b]" />
                  The live fixture desk
                </div>
                <h2 className="max-w-xl text-4xl font-black leading-[0.98] tracking-tight text-white sm:text-6xl">
                  Stay close to the <span className="text-[#c9f36b]">moment.</span>
                </h2>
                <p className="mt-5 max-w-lg text-sm leading-6 text-slate-400 sm:text-base">
                  A focused home for the games you care about. Browse the schedule, find your fixture, and switch to the best available stream.
                </p>
                <div className="mt-8 flex flex-wrap items-center gap-3 text-xs font-bold text-slate-400">
                  <span className="rounded-full border border-white/10 bg-white/5 px-4 py-2">{filteredMatches.length || 0} fixtures on deck</span>
                  <span className="rounded-full border border-[#3c9b7e]/30 bg-[#3c9b7e]/10 px-4 py-2 text-[#83d7bd]">Football · Cricket · Basketball</span>
                </div>
              </div>
            </section>
          )}

          {selectedMatch && (
            <section className="mb-12 bg-[#12161f] border border-slate-800 rounded-xl overflow-hidden shadow-2xl shadow-black/80">
              <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-[#0b0e14]">
                <div className="flex items-center gap-3">
                  <span className="bg-red-600 text-white text-[10px] font-black px-2 py-1 rounded">LIVE</span>
                  <h2 className="font-bold text-base sm:text-lg text-slate-100">
                    {selectedMatch.title || 'Live Event'}
                  </h2>
                </div>
                <button
                  onClick={() => {
                    setSelectedMatch(null);
                    window.history.pushState({}, '', window.location.pathname);
                  }}
                  className="text-slate-400 hover:text-white px-3 py-1.5 text-xs font-bold rounded-lg bg-slate-800 hover:bg-slate-700 transition"
                >
                  Close Player ✕
                </button>
              </div>

              <div className="aspect-video bg-black relative flex items-center justify-center">
                {error ? (
                  <p className="text-red-400 font-mono text-sm">{error}</p>
                ) : !activeStream ? (
                  <p className="text-slate-400 animate-pulse font-mono text-sm">
                    Connecting to stream...
                  </p>
                ) : !currentUrl ? (
                  <p className="text-red-400 font-mono text-sm">Stream link unavailable.</p>
                ) : currentUrl.includes('.m3u8') ? (
                  <video controls autoPlay className="w-full h-full" src={currentUrl}></video>
                ) : (
                  <iframe
                    src={currentUrl}
                    className="w-full h-full border-0"
                    allowFullScreen
                    allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
                    referrerPolicy="no-referrer"
                    title="Live Stream"
                  ></iframe>
                )}
              </div>

              {streams.length > 0 && (
                <div className="p-3 bg-[#0b0e14] border-t border-slate-800 flex items-center gap-2 overflow-x-auto">
                  <span className="text-xs font-bold text-slate-500 mr-2">Servers:</span>
                  {streams.map((s, idx) => (
                    <button
                      key={idx}
                      onClick={() => setActiveStream(s)}
                      className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${
                        activeStream === s
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                      }`}
                    >
                      {s.language || `Server ${idx + 1}`} {s.hd ? 'HD' : ''}
                    </button>
                  ))}
                </div>
              )}
            </section>
          )}

          <section>
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-6 gap-4">
              <div>
                  <span className="text-[10px] font-bold tracking-widest uppercase text-[#e5b94f]">
                  Real-time Schedule
                </span>
                <h3 className="text-2xl font-black text-white">Live & Upcoming Matches</h3>
                <p className="mt-1 text-xs text-slate-500" aria-live="polite">
                  {lastUpdated ? `Updated ${lastUpdated.toLocaleTimeString('en-NP', { hour: 'numeric', minute: '2-digit' })} Nepal time` : 'Checking the latest fixtures'}
                </p>
              </div>
              
              <div className="flex w-full md:w-auto items-center gap-3">
                <input
                  type="text"
                  placeholder="Search matches or teams..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  aria-label="Search matches or teams"
                  className="w-full md:w-72 bg-[#111a19] border border-white/10 text-sm rounded-lg px-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-[#c9f36b] transition-colors"
                />
              </div>
            </div>

            {error && !selectedMatch && (
              <div className="mb-5 flex flex-col gap-3 rounded-xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-200 sm:flex-row sm:items-center sm:justify-between" role="alert">
                <span>Fixtures are temporarily unavailable. Nothing has been invented or substituted.</span>
                <button
                  type="button"
                  onClick={() => fetchMatches(activeCategory)}
                  className="self-start rounded-lg border border-red-300/30 px-3 py-2 text-xs font-bold text-red-100 transition hover:bg-red-300/10 sm:self-auto"
                >
                  Try again
                </button>
              </div>
            )}

            {loading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                  <div key={i} className="h-48 bg-[#12161f] rounded-xl animate-pulse" aria-hidden="true"></div>
                ))}
              </div>
            ) : filteredMatches.length === 0 ? (
              <div className="text-center py-16 bg-[#12161f] border border-slate-800 rounded-xl">
                <p className="text-slate-300 font-medium">No fixtures found for this sport.</p>
                <p className="mt-2 text-sm text-slate-500">Try another category or check back when the schedule updates.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {filteredMatches.map((match, idx) => {
                  const matchTitle = getMatchTitle(match);
                  const { isMatch, teamA, teamB } = parseMatchTeams(matchTitle);
                  const matchStatus = getMatchStatus(match);
                  const isLive = matchStatus === 'live';
                  const matchTime = getMatchTime(match);
                  
                  let matchPoster = match.poster || match.image || match.thumbnail || null;
                  if (matchPoster && matchPoster.startsWith('/')) {
                    matchPoster = `https://streamed.pk${matchPoster}`;
                  }
                  if (!isSafeExternalUrl(matchPoster)) matchPoster = null;

                  const teamALogo = match?.teams?.[0]?.logo || `https://ui-avatars.com/api/?name=${encodeURIComponent(teamA)}&background=1e293b&color=3b82f6&bold=true`;
                  const teamBLogo = match?.teams?.[1]?.logo || `https://ui-avatars.com/api/?name=${encodeURIComponent(teamB)}&background=1e293b&color=ef4444&bold=true`;

                  return (
                    <article
                      key={idx}
                      onClick={() => loadStream(match, true)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          loadStream(match, true);
                        }
                      }}
                      role="button"
                      tabIndex="0"
                      aria-label={`Open ${matchTitle}`}
                      className="bg-[#111a19] border border-white/10 rounded-2xl overflow-hidden cursor-pointer hover:-translate-y-1 hover:border-[#e5b94f]/50 hover:ring-2 ring-[#e5b94f]/20 transition-all duration-300 group shadow-xl shadow-black/10"
                    >
                      <div className="relative h-36 w-full bg-gradient-to-br from-[#182b2a] via-[#18212b] to-[#111a19] flex overflow-hidden">
                        
                        <div className="absolute top-2 left-2 z-20">
                          {isLive ? (
                            <span className="bg-red-600 text-white text-[10px] font-black px-2 py-1 rounded shadow">LIVE</span>
                          ) : (
                              <span className="bg-black/80 text-white text-[10px] font-bold px-2 py-1 rounded shadow backdrop-blur-sm">
                              {matchStatus === 'result' ? 'Final' : matchTime}
                            </span>
                          )}
                        </div>
                        
                        <div className="absolute top-2 right-2 z-20">
                          <span className="text-yellow-400 bg-black/60 p-1 rounded-full text-xs shadow">⭐</span>
                        </div>

                        {matchPoster ? (
                          <img src={matchPoster} alt={`${matchTitle} poster`} className="w-full h-full object-cover transition-transform group-hover:scale-105 duration-500" loading="lazy" />
                        ) : isMatch ? (
                          <>
                            <div className="w-[55%] h-full absolute left-0 bg-slate-700/50 flex items-center justify-center border-r-2 border-[#12161f] transition-transform group-hover:scale-105 duration-300" style={{ clipPath: 'polygon(0 0, 100% 0, 80% 100%, 0% 100%)' }}>
                               <img src={teamALogo} alt={teamA} className="w-12 h-12 object-contain drop-shadow-lg -ml-4" />
                            </div>
                            <div className="w-[55%] h-full absolute right-0 bg-slate-800 flex items-center justify-center transition-transform group-hover:scale-105 duration-300" style={{ clipPath: 'polygon(20% 0, 100% 0, 100% 100%, 0% 100%)' }}>
                               <img src={teamBLogo} alt={teamB} className="w-12 h-12 object-contain drop-shadow-lg ml-4" />
                            </div>
                          </>
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-slate-800 transition-transform group-hover:scale-105 duration-300">
                             <img src={teamALogo} alt={teamA} className="w-16 h-16 rounded-full shadow-xl" />
                          </div>
                        )}
                      </div>

                      <div className="p-3">
                        <h4 className="font-bold text-sm text-slate-100 group-hover:text-[#e5b94f] transition-colors line-clamp-1">
                          {matchTitle}
                        </h4>
                        <div className="flex items-center gap-1 mt-1 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                          <span>{match.category || activeCategory}</span>
                          {matchStatus !== 'live' && (
                            <>
                              <span className="mx-1">|</span>
                              <span>{matchStatus === 'result' ? 'Final' : matchTime}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        </main>
      </div>

      <footer className="border-t border-white/10 bg-[#101716]/80 mt-16 py-6">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 font-medium">Built by</span>
            <a rel="author" href="/about-dipesh-sapkota/" className="text-xs font-black text-slate-300 hover:text-[#e5b94f] transition-colors">
              Dipesh Sapkota
            </a>
          </div>

          <div className="flex items-center gap-3">
            <a 
              href="https://github.com/dszae" 
              target="_blank" 
              rel="noopener noreferrer"
              className="p-2 rounded-lg bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 transition"
              title="GitHub"
            >
              <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
              </svg>
            </a>

            <a 
              href="https://linkedin.com/in/dszae" 
              target="_blank" 
              rel="noopener noreferrer"
              className="p-2 rounded-lg bg-slate-800 text-slate-300 hover:text-blue-400 hover:bg-slate-700 transition"
              title="LinkedIn"
            >
              <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" />
              </svg>
            </a>

            <a 
              href="https://facebook.com/dsz.ae" 
              target="_blank" 
              rel="noopener noreferrer"
              className="p-2 rounded-lg bg-slate-800 text-slate-300 hover:text-blue-500 hover:bg-slate-700 transition"
              title="Facebook"
            >
              <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                <path d="M9 8h-3v4h3v12h5v-12h3.642l.358-4h-4v-1.667c0-.955.192-1.333 1.115-1.333h2.885v-5h-3.808c-3.596 0-5.192 1.583-5.192 4.615v3.385z"/>
              </svg>
            </a>

            <a 
              href="https://www.dipeshsapkota7.com.np/" 
              target="_blank" 
              rel="noreferrer" 
              className="px-3 py-2 rounded-lg bg-blue-600/10 border border-blue-500/20 text-xs font-bold text-blue-400 hover:bg-blue-600 hover:text-white transition"
            >
              Portfolio ↗
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}