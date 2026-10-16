import { useEffect, useRef, useState } from 'react';
import type { Match } from '../lib/sportivo';
import {
  detectFootballLeague,
  formatCountdown,
  generateGoogleCalendarUrl,
  generateIcsCalendarContent,
  getMatchTimestamp,
  publicUrl,
  slugify,
  statusOf,
  timeOf,
  titleOf,
} from '../lib/sportivo';
import { loadUserPreferences, saveUserPreferences, type UserPreferences } from '../lib/preferences';

type Stream = { embedUrl?: string; url?: string; language?: string; hd?: boolean } | string;
type Props = { match: Match };

function streamUrl(stream: Stream) {
  return typeof stream === 'string' ? stream : stream.embedUrl || stream.url || '';
}

export default function MatchPlayer({ match }: Props) {
  const sources = match.sources || [];
  const [selectedSourceIndex, setSelectedSourceIndex] = useState(0);
  const currentSource = sources[selectedSourceIndex];

  const [streams, setStreams] = useState<Stream[]>([]);
  const [active, setActive] = useState<Stream | null>(null);
  const [loading, setLoading] = useState(Boolean(currentSource?.source && currentSource.id));
  const [error, setError] = useState(
    currentSource?.source && currentSource.id ? '' : 'No stream sources available for this match.'
  );

  const [isFavorite, setIsFavorite] = useState(false);
  const [copiedToast, setCopiedToast] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [timeZone, setTimeZone] = useState<'Asia/Kathmandu' | string>('Asia/Kathmandu');
  const [localTz, setLocalTz] = useState<string>('Local Time');

  const playerContainerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const title = titleOf(match);
  const slug = slugify(title);
  const status = statusOf(match);
  const isLive = status === 'Live';
  const ts = getMatchTimestamp(match);
  const league = match.category === 'football' ? detectFootballLeague(match) : null;

  // Initialize client preferences and listen for updates
  useEffect(() => {
    const prefs = loadUserPreferences();
    setIsFavorite(prefs.starredMatches.includes(slug));
    if (prefs.timeZone) {
      setTimeZone(prefs.timeZone);
      setLocalTz(prefs.timeZone);
    }

    const handlePrefChange = (e: Event) => {
      const customEvent = e as CustomEvent<UserPreferences>;
      const current = customEvent.detail || loadUserPreferences();
      setIsFavorite(current.starredMatches.includes(slug));
      if (current.timeZone) {
        setTimeZone(current.timeZone);
        setLocalTz(current.timeZone);
      }
    };

    window.addEventListener('sportivo:preferences-changed', handlePrefChange);
    window.addEventListener('storage', handlePrefChange);
    return () => {
      window.removeEventListener('sportivo:preferences-changed', handlePrefChange);
      window.removeEventListener('storage', handlePrefChange);
    };
  }, [slug]);

  // Fullscreen event listener
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Fetch streams from provider
  useEffect(() => {
    if (!currentSource?.source || !currentSource.id) return;

    let cancelled = false;

    fetch(`/api/stream/${encodeURIComponent(currentSource.source)}/${encodeURIComponent(currentSource.id)}`)
      .then((response) => {
        if (!response.ok) throw new Error('Stream unavailable');
        return response.json();
      })
      .then((payload) => {
        if (cancelled) return;
        const parsed = typeof payload?.contents === 'string' ? JSON.parse(payload.contents) : payload;
        const available = (Array.isArray(parsed) ? parsed : [parsed]).filter((item): item is Stream =>
          Boolean(publicUrl(streamUrl(item)))
        );
        if (available.length === 0) {
          setError(
            'Live broadcast feeds typically go online 15 minutes before official kickoff. Check back shortly or switch providers above.'
          );
        } else {
          setStreams(available);
          setActive(available[0] || null);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError(
            'This stream feed is currently offline or waiting for pre-match broadcast signal. Live streams activate 15 minutes before kickoff.'
          );
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [currentSource?.id, currentSource?.source]);

  const handleSourceChange = (idx: number) => {
    setSelectedSourceIndex(idx);
    setLoading(true);
    setError('');
    setStreams([]);
    setActive(null);
  };

  const toggleFavorite = () => {
    const currentPrefs = loadUserPreferences();
    const nextStarred = currentPrefs.starredMatches.includes(slug)
      ? currentPrefs.starredMatches.filter((s) => s !== slug)
      : [...currentPrefs.starredMatches, slug];
    saveUserPreferences({ ...currentPrefs, starredMatches: nextStarred });
    setIsFavorite(nextStarred.includes(slug));
  };

  const toggleFullscreen = () => {
    if (!playerContainerRef.current) return;
    if (!document.fullscreenElement) {
      playerContainerRef.current.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  const handleShare = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${title} — Live on Sportivo`,
          text: `Watch ${title} live stream and match fixtures on Sportivo`,
          url,
        });
        return;
      } catch {}
    }
    // Fallback: clipboard copy
    try {
      await navigator.clipboard.writeText(url);
      setCopiedToast(true);
      setTimeout(() => setCopiedToast(false), 2500);
    } catch {}
  };

  const handleDownloadIcs = () => {
    const icsContent = generateIcsCalendarContent(match);
    if (!icsContent) return;
    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${slug}-sportivo.ics`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
  };

  const url = active ? publicUrl(streamUrl(active)) : null;

  return (
    <div className="space-y-6">
      {/* Player Frame Container */}
      <div
        ref={playerContainerRef}
        className="overflow-hidden rounded-2xl border border-white/10 bg-[#111a19] shadow-2xl shadow-black/80"
      >
        {/* Player Top Navigation & Provider Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/5 bg-[#0b100f] p-4">
          <div>
            <div className="flex items-center gap-2">
              <span
                className={`flex items-center gap-1.5 rounded px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-white ${
                  isLive ? 'bg-red-600' : 'bg-slate-800'
                }`}
              >
                {isLive && <span className="h-1.5 w-1.5 animate-ping rounded-full bg-white"></span>}
                {isLive ? 'LIVE' : status}
              </span>
              <h2 className="text-base font-bold text-slate-100">{title}</h2>
            </div>

            {sources.length > 1 && (
              <div className="mt-2.5 flex flex-wrap items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Providers:</span>
                {sources.map((s, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSourceChange(idx)}
                    className={`rounded-lg px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider transition ${
                      selectedSourceIndex === idx
                        ? 'bg-[#c9f36b] text-[#0a1110] shadow-sm'
                        : 'bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    {s.source || `Provider ${idx + 1}`}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Fullscreen Button */}
            <button
              type="button"
              onClick={toggleFullscreen}
              className="rounded-lg border border-white/10 bg-white/5 p-2 text-slate-300 hover:border-white/20 hover:text-white transition"
              title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
              aria-label={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                {isFullscreen ? (
                  <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"></path>
                ) : (
                  <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"></path>
                )}
              </svg>
            </button>

            <a
              href="../"
              className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-bold text-slate-300 hover:border-white/20 hover:text-white transition"
            >
              &larr; Fixtures
            </a>
          </div>
        </div>

        {/* Video / Iframe Stream Area */}
        <div className="relative flex aspect-video items-center justify-center bg-black">
          {loading ? (
            <div className="flex flex-col items-center gap-3">
              <span className="h-8 w-8 animate-spin rounded-full border-2 border-[#c9f36b] border-t-transparent"></span>
              <p className="font-mono text-xs text-slate-400">Connecting to stream provider broadcast signal...</p>
            </div>
          ) : error ? (
            <div className="max-w-md px-6 text-center">
              <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full border border-amber-500/30 bg-amber-500/10 text-amber-400">
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="12" y1="8" x2="12" y2="12"></line>
                  <line x1="12" y1="16" x2="12.01" y2="16"></line>
                </svg>
              </div>
              <p className="text-sm font-semibold text-amber-300">{error}</p>
              {sources.length > 1 && (
                <p className="mt-2 text-xs text-slate-400">
                  Multiple stream sources are available for this fixture. Try switching providers in the top bar.
                </p>
              )}
            </div>
          ) : !url ? (
            <p className="font-mono text-sm text-slate-400">Waiting for stream signal...</p>
          ) : url.includes('.m3u8') ? (
            <video
              ref={videoRef}
              controls
              autoPlay
              className="h-full w-full"
              src={url}
              playsInline
            ></video>
          ) : (
            <iframe
              src={url}
              className="h-full w-full border-0"
              allowFullScreen
              allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
              referrerPolicy="no-referrer"
              title={`${title} live stream`}
            ></iframe>
          )}
        </div>

        {/* Server Selector Bar */}
        {streams.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 border-t border-white/5 bg-[#0b100f] p-3">
            <span className="mr-2 text-xs font-bold text-slate-500">Servers:</span>
            {streams.map((stream, index) => (
              <button
                key={index}
                type="button"
                onClick={() => setActive(stream)}
                className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                  active === stream
                    ? 'bg-[#c9f36b] text-[#0a1110] font-black shadow-sm'
                    : 'bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white'
                }`}
              >
                {typeof stream === 'string'
                  ? `Server ${index + 1}`
                  : `${stream.language || `Server ${index + 1}`} ${stream.hd ? 'HD' : ''}`}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Match Companion Panel */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Match Info & Countdown */}
        <div className="rounded-2xl border border-white/10 bg-[#111a19] p-5 shadow-lg lg:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/5 pb-4">
            <div>
              <span className="text-[10px] font-black uppercase tracking-widest text-[#e5b94f]">Match Companion</span>
              <h3 className="text-lg font-black text-white mt-0.5">{title}</h3>
            </div>

            {ts && (
              <span suppressHydrationWarning className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-bold text-[#c9f36b]">
                <span className="h-2 w-2 rounded-full bg-[#c9f36b]"></span>
                {formatCountdown(ts)}
              </span>
            )}
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3 text-xs">
            <div className="rounded-xl border border-white/5 bg-white/5 p-3">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Kickoff Time</span>
              <p className="mt-1 font-bold text-white">{timeOf(match, 'Asia/Kathmandu')}</p>
            </div>

            <div className="rounded-xl border border-white/5 bg-white/5 p-3">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Local Time</span>
              <p className="mt-1 font-bold text-slate-200">{timeOf(match, localTz)}</p>
            </div>

            <div className="rounded-xl border border-white/5 bg-white/5 p-3">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Competition</span>
              <p className="mt-1 font-bold text-[#e5b94f]">
                {league || match.category?.toUpperCase() || 'SPORTS'}
              </p>
            </div>
          </div>

          <p className="mt-4 text-xs leading-relaxed text-slate-400">
            Stream signals are optimized for low latency. If audio or video pauses, switch servers above.
          </p>
        </div>

        {/* Action Buttons & Calendar Integration */}
        <div className="flex flex-col justify-between rounded-2xl border border-white/10 bg-[#111a19] p-5 shadow-lg">
          <div>
            <span className="text-[10px] font-black uppercase tracking-widest text-[#e5b94f]">Match Tools</span>
            <h4 className="text-sm font-bold text-white mt-0.5">Save &amp; Remind</h4>

            <div className="mt-4 space-y-2.5">
              {/* Watchlist Toggle */}
              <button
                type="button"
                onClick={toggleFavorite}
                className={`w-full inline-flex items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-bold transition ${
                  isFavorite
                    ? 'border border-amber-400/50 bg-amber-400/10 text-amber-300'
                    : 'border border-white/10 bg-white/5 text-slate-300 hover:text-white hover:bg-white/10'
                }`}
              >
                <span>{isFavorite ? '★ Saved to Watchlist' : '☆ Add to Watchlist'}</span>
              </button>

              {/* Add to Google Calendar */}
              {ts && (
                <a
                  href={generateGoogleCalendarUrl(match)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 py-2.5 text-xs font-bold text-slate-300 hover:text-white hover:bg-white/10 transition"
                >
                  <svg className="h-4 w-4 text-[#c9f36b]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                    <line x1="16" y1="2" x2="16" y2="6"></line>
                    <line x1="8" y1="2" x2="8" y2="6"></line>
                    <line x1="3" y1="10" x2="21" y2="10"></line>
                  </svg>
                  <span>Add to Google Calendar</span>
                </a>
              )}

              {/* Download .ics Calendar File */}
              {ts && (
                <button
                  type="button"
                  onClick={handleDownloadIcs}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 py-2.5 text-xs font-bold text-slate-300 hover:text-white hover:bg-white/10 transition"
                >
                  <svg className="h-4 w-4 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                    <polyline points="7 10 12 15 17 10"></polyline>
                    <line x1="12" y1="15" x2="12" y2="3"></line>
                  </svg>
                  <span>Download .ics Calendar</span>
                </button>
              )}

              {/* Share Button */}
              <button
                type="button"
                onClick={handleShare}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 py-2.5 text-xs font-bold text-slate-300 hover:text-white hover:bg-white/10 transition"
              >
                <svg className="h-4 w-4 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="18" cy="5" r="3"></circle>
                  <circle cx="6" cy="12" r="3"></circle>
                  <circle cx="18" cy="19" r="3"></circle>
                  <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line>
                  <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
                </svg>
                <span>{copiedToast ? '✓ Link Copied to Clipboard!' : 'Share Match'}</span>
              </button>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-white/5 text-[10px] text-slate-500">
            Authorized embed sources. No subscription required.
          </div>
        </div>
      </div>
    </div>
  );
}