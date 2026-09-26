import React, { useState, useEffect } from 'react';

export default function SportsStreamer() {
  const [matches, setMatches] = useState([]);
  const [filteredMatches, setFilteredMatches] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMatch, setSelectedMatch] = useState(null);
  const [streams, setStreams] = useState([]);
  const [activeStream, setActiveStream] = useState(null);
  const [activeCategory, setActiveCategory] = useState('football');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchMatches(activeCategory);
  }, [activeCategory]);

  useEffect(() => {
    if (!searchQuery) {
      setFilteredMatches(matches);
    } else {
      const lowerQuery = searchQuery.toLowerCase();
      setFilteredMatches(
        matches.filter(match => 
          (match.title && match.title.toLowerCase().includes(lowerQuery)) ||
          (match.category && match.category.toLowerCase().includes(lowerQuery))
        )
      );
    }
  }, [searchQuery, matches]);

  const fetchMatches = async (category) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/matches/${category}`);
      if (!response.ok) throw new Error('Failed to fetch matches');
      const data = await response.json();
      setMatches(data || []);
      setFilteredMatches(data || []);
    } catch (err) {
      setError(err.message);
      setMatches([]);
      setFilteredMatches([]);
    } finally {
      setLoading(false);
    }
  };

  const loadStream = async (match) => {
    setSelectedMatch(match);
    setStreams([]);
    setActiveStream(null);
    setError(null);

    if (!match.sources || match.sources.length === 0) {
      setError('No stream sources available for this match.');
      return;
    }

    try {
      const source = match.sources[0];
      const response = await fetch(`/api/stream/${source.source}/${source.id}`);
      if (!response.ok) throw new Error('Failed to fetch stream details');
      
      const streamData = await response.json();
      const actualData = streamData.contents ? JSON.parse(streamData.contents) : streamData;
      const parsedStreams = Array.isArray(actualData) ? actualData : [actualData];
      setStreams(parsedStreams);
      
      if (parsedStreams.length > 0) {
        setActiveStream(parsedStreams[0]);
      }
    } catch (err) {
      console.error(err);
      setError('Stream is currently offline or failed to parse.');
    }
  };

  const getStreamUrl = (stream) => {
    if (!stream) return '';
    if (typeof stream === 'string') return stream;
    return stream.embedUrl || stream.url || '';
  };

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
    <div className="min-h-screen bg-[#0b0e14] text-slate-100 font-sans flex flex-col justify-between selection:bg-blue-600 selection:text-white">
      <div>
        <header className="border-b border-slate-800/80 bg-[#12161f] sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-4">
            
            <a href="/" className="flex flex-col group cursor-pointer hover:opacity-80 transition-opacity">
              <div className="flex items-center gap-3">
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                </span>
                <h1 className="text-2xl font-black tracking-tight text-white leading-none">
                  Sportivo<span className="text-blue-500">.</span>
                </h1>
              </div>
              <span className="text-[10px] font-bold text-slate-500 ml-6 mt-1 uppercase tracking-widest group-hover:text-blue-400 transition-colors">
                by Dipesh Sapkota
              </span>
            </a>

            <nav className="flex gap-2">
              {['football', 'cricket', 'basketball'].map((cat) => (
                <button
                  key={cat}
                  onClick={() => {
                    setActiveCategory(cat);
                    setSearchQuery('');
                  }}
                  className={`px-5 py-2 rounded-full text-xs font-bold capitalize transition-all ${
                    activeCategory === cat
                      ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20'
                      : 'text-slate-400 hover:text-white bg-slate-800/50 hover:bg-slate-700'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </nav>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-6 py-8">
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
                  onClick={() => setSelectedMatch(null)}
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
                <span className="text-[10px] font-bold tracking-widest uppercase text-blue-500">
                  Real-time Schedule
                </span>
                <h3 className="text-2xl font-black text-white">Live & Upcoming Matches</h3>
              </div>
              
              <div className="flex w-full md:w-auto items-center gap-3">
                <input
                  type="text"
                  placeholder="Search matches or teams..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full md:w-72 bg-[#12161f] border border-slate-800 text-sm rounded-lg px-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
                />
              </div>
            </div>

            {loading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                  <div key={i} className="h-48 bg-[#12161f] rounded-xl animate-pulse"></div>
                ))}
              </div>
            ) : filteredMatches.length === 0 ? (
              <div className="text-center py-16 bg-[#12161f] border border-slate-800 rounded-xl">
                <p className="text-slate-400 font-medium">No fixtures found.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {filteredMatches.map((match, idx) => {
                  const { isMatch, teamA, teamB } = parseMatchTeams(match.title);
                  
                  const isLive = match.status === 'live' || (match.time && match.time.toLowerCase().includes('live')) || !match.time;
                  
                  // Grab the exact poster image provided by the API
                  let matchPoster = match.poster || match.image || match.thumbnail || null;
                  
                  // Make sure relative image links become absolute links so they load correctly
                  if (matchPoster && matchPoster.startsWith('/')) {
                    matchPoster = `https://streamed.pk${matchPoster}`;
                  }

                  const teamALogo = match?.teams?.[0]?.logo || `https://ui-avatars.com/api/?name=${encodeURIComponent(teamA)}&background=1e293b&color=3b82f6&bold=true`;
                  const teamBLogo = match?.teams?.[1]?.logo || `https://ui-avatars.com/api/?name=${encodeURIComponent(teamB)}&background=1e293b&color=ef4444&bold=true`;

                  return (
                    <div
                      key={idx}
                      onClick={() => loadStream(match)}
                      className="bg-[#12161f] rounded-xl overflow-hidden cursor-pointer hover:ring-2 ring-blue-500 transition-all group"
                    >
                      <div className="relative h-32 w-full bg-slate-800 flex overflow-hidden">
                        
                        {/* Time/Live Badge */}
                        <div className="absolute top-2 left-2 z-20">
                          {isLive ? (
                            <span className="bg-red-600 text-white text-[10px] font-black px-2 py-1 rounded shadow">LIVE</span>
                          ) : (
                            <span className="bg-black/80 text-white text-[10px] font-bold px-2 py-1 rounded shadow backdrop-blur-sm">
                              {match.time || 'Upcoming'}
                            </span>
                          )}
                        </div>
                        
                        <div className="absolute top-2 right-2 z-20">
                          <span className="text-yellow-400 bg-black/60 p-1 rounded-full text-xs shadow">⭐</span>
                        </div>

                        {/* If API provided a poster, show it. Otherwise, generate the split fallback. */}
                        {matchPoster ? (
                          <img src={matchPoster} alt={match.title} className="w-full h-full object-cover transition-transform group-hover:scale-105 duration-300" />
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
                        <h4 className="font-bold text-sm text-slate-100 group-hover:text-blue-400 transition-colors line-clamp-1">
                          {match.title}
                        </h4>
                        <div className="flex items-center gap-1 mt-1 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                          <span>{match.category || activeCategory}</span>
                          {match.time && !isLive && (
                            <>
                              <span className="mx-1">|</span>
                              <span>{match.time}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </main>
      </div>

      <footer className="border-t border-slate-800/80 bg-[#12161f] mt-16 py-6">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 font-medium">Built by</span>
            <span className="text-xs font-black text-slate-300">Dipesh Sapkota</span>
          </div>

          <div className="flex items-center gap-4 flex-wrap justify-center">
            <a href="https://github.com/dszae" target="_blank" rel="noreferrer" className="text-slate-500 hover:text-white text-sm transition">GitHub</a>
            <a href="https://linkedin.com/in/dszae" target="_blank" rel="noreferrer" className="text-slate-500 hover:text-blue-500 text-sm transition">LinkedIn</a>
            <a href="https://facebook.com/dsz.ae" target="_blank" rel="noreferrer" className="text-slate-500 hover:text-blue-600 text-sm transition">Facebook</a>
            <a href="https://www.dipeshsapkota7.com.np/" target="_blank" rel="noreferrer" className="text-blue-500 hover:text-blue-400 font-bold text-sm transition">Portfolio ↗</a>
          </div>
        </div>
      </footer>
    </div>
  );
}