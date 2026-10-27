import { useEffect, useRef, useState } from 'react';
import type { Match } from '../lib/sportivo';
import type { PlayerState } from '../lib/providers/types';
import {
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
import { loadUserPreferences, saveUserPreferences, type UserPreferences } from '../lib/preferences';

interface StreamItem {
  embedUrl: string;
  hd?: boolean;
  language?: string;
  isNativeVideo?: boolean;
  isSandboxedIframe?: boolean;
}

type Props = { match: Match };

export default function MatchPlayer({ match }: Props) {
  const sources = match.sources || [];
  const [selectedSourceIndex, setSelectedSourceIndex] = useState(0);
  const currentSource = sources[selectedSourceIndex];

  // Explicit Player States: 'idle' | 'resolving' | 'ready' | 'playing' | 'failed' | 'unavailable' | 'unsupported'
  const [playerState, setPlayerState] = useState<PlayerState>('idle');
  const [streams, setStreams] = useState<StreamItem[]>([]);
  const [activeStream, setActiveStream] = useState<StreamItem | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [useSandbox, setUseSandbox] = useState(true);

  const [isFavorite, setIsFavorite] = useState(false);
  const [copiedToast, setCopiedToast] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [localTz, setLocalTz] = useState<string>('Local Time');

  const playerContainerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const isResolvingRef = useRef(false);

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
      setLocalTz(prefs.timeZone);
    }

    const handlePrefChange = (e: Event) => {
      const customEvent = e as CustomEvent<UserPreferences>;
      const current = customEvent.detail || loadUserPreferences();
      setIsFavorite(current.starredMatches.includes(slug));
      if (current.timeZone) {
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

  // Resolves playback signals on explicit user action
  async function resolvePlayback() {
    if (!currentSource?.source || !currentSource.id) {
      setPlayerState('unsupported');
      setErrorMessage('No valid stream source configured for this fixture.');
      return;
    }

    if (isResolvingRef.current) return;
    isResolvingRef.current = true;
    setPlayerState('resolving');
    setErrorMessage('');

    const src = encodeURIComponent(currentSource.source);
    const sid = encodeURIComponent(currentSource.id);

    try {
      const res = await fetch(`/api/stream/${src}/${sid}/`);
      const data = await res.json();

      if (!res.ok) {
        setPlayerState(res.status === 404 ? 'unavailable' : 'failed');
        setErrorMessage(data?.error || 'Broadcast signal is currently offline or waiting for pre-match feed.');
        return;
      }

      const list: any[] = Array.isArray(data) ? data : data?.streams || [data];
      const validated: StreamItem[] = list
        .map((item) => {
          const rawUrl = typeof item === 'string' ? item : item.embedUrl || item.url || '';
          const safeUrl = publicUrl(rawUrl);
          if (!safeUrl) return null;
          const isNative = safeUrl.endsWith('.m3u8') || safeUrl.endsWith('.mp4');
          return {
            embedUrl: safeUrl,
            hd: Boolean(item.hd),
            language: item.language || 'English',
            isNativeVideo: isNative,
            isSandboxedIframe: !isNative,
          };
        })
        .filter((item): item is StreamItem => Boolean(item));

      if (validated.length === 0) {
        setPlayerState('unavailable');
        setErrorMessage('Stream sources could not be validated against approved security allowlists.');
        return;
      }

      setStreams(validated);
      setActiveStream(validated[0]);
      setPlayerState('ready');
    } catch {
      setPlayerState('failed');
      setErrorMessage('Network connection to stream resolver failed. Please try again.');
    } finally {
      isResolvingRef.current = false;
    }
  }

  const handleSourceChange = (idx: number) => {
    setSelectedSourceIndex(idx);
    setPlayerState('idle');
    setStreams([]);
    setActiveStream(null);
    setErrorMessage('');
  };

  const handleServerSelect = (item: StreamItem) => {
    setActiveStream(item);
    if (item.isNativeVideo) {
      setPlayerState('ready');
    }
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

  const activeServerIndex = streams.findIndex((s) => s === activeStream);
  const activeServerLabel =
    activeServerIndex >= 0
      ? `${activeStream?.language || `Server ${activeServerIndex + 1}`} ${activeStream?.hd ? 'HD' : ''}`.trim()
      : 'Primary Server';

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
                        ? 'bg-[#c9f36b] text-[#0a1110] shadow-sm font-black'
                        : 'bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    {s.label || s.source || `Provider ${idx + 1}`}
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

        {/* Video / Player Display Area */}
        <div className="relative flex aspect-video items-center justify-center overflow-hidden bg-black">
          {/* STATE 1: IDLE - Transparent & Honest Match Kickoff Poster with Accessible Play Action */}
          {playerState === 'idle' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center overflow-hidden bg-[#0a100f] px-6 text-center">
              {/* Match Poster / Thumbnail Backdrop */}
              {match.poster && (
                <img
                  src={getSafeThumbnailUrl(match.poster)}
                  alt=""
                  width="800"
                  height="450"
                  referrerPolicy="strict-origin-when-cross-origin"
                  className="opacity-25 absolute inset-0 h-full w-full object-cover blur-[1px] pointer-events-none transition-opacity duration-500"
                  onError={(e) => {
                    (e.currentTarget as HTMLElement).style.display = 'none';
                  }}
                />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-[#050807] via-[#050807]/80 to-[#050807]/60 pointer-events-none"></div>

              {/* Match Details & Team Badges */}
              <div className="relative z-10 mb-6 max-w-lg">
                <span className="text-[11px] font-bold uppercase tracking-widest text-[#e5b94f]">
                  {league || match.category?.toUpperCase() || 'SPORTS'} · NEPAL STANDARD TIME
                </span>

                {/* Team Logos if Available */}
                {match.teams && typeof match.teams === 'object' && ('home' in match.teams || 'away' in match.teams) && (
                  <div className="my-3 flex items-center justify-center gap-6">
                    {/* Home Team */}
                    <div className="flex flex-col items-center gap-1">
                      {match.teams.home?.badge ? (
                        <div className="relative flex h-12 w-12 items-center justify-center">
                          <img
                            src={getSafeThumbnailUrl(match.teams.home.badge)}
                            alt={match.teams.home.name || ''}
                            width="48"
                            height="48"
                            className="h-12 w-12 object-contain drop-shadow"
                            onError={(e) => {
                              const el = e.currentTarget as HTMLElement;
                              el.style.display = 'none';
                              const fallback = el.nextElementSibling as HTMLElement;
                              if (fallback) fallback.classList.remove('hidden');
                            }}
                          />
                          <div className="hidden flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 text-xs font-black text-[#c9f36b]">
                            {(match.teams.home.name || 'H').slice(0, 3).toUpperCase()}
                          </div>
                        </div>
                      ) : (
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 text-xs font-black text-[#c9f36b]">
                          {(match.teams.home?.name || 'H').slice(0, 3).toUpperCase()}
                        </div>
                      )}
                      <span className="line-clamp-1 max-w-[100px] text-[11px] font-bold text-slate-300">
                        {match.teams.home?.name}
                      </span>
                    </div>

                    <span className="text-xs font-black text-[#c9f36b] px-1.5 py-0.5 rounded bg-black/40 border border-white/5">
                      VS
                    </span>

                    {/* Away Team */}
                    <div className="flex flex-col items-center gap-1">
                      {match.teams.away?.badge ? (
                        <div className="relative flex h-12 w-12 items-center justify-center">
                          <img
                            src={getSafeThumbnailUrl(match.teams.away.badge)}
                            alt={match.teams.away.name || ''}
                            width="48"
                            height="48"
                            className="h-12 w-12 object-contain drop-shadow"
                            onError={(e) => {
                              const el = e.currentTarget as HTMLElement;
                              el.style.display = 'none';
                              const fallback = el.nextElementSibling as HTMLElement;
                              if (fallback) fallback.classList.remove('hidden');
                            }}
                          />
                          <div className="hidden flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 text-xs font-black text-[#c9f36b]">
                            {(match.teams.away.name || 'A').slice(0, 3).toUpperCase()}
                          </div>
                        </div>
                      ) : (
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 text-xs font-black text-[#c9f36b]">
                          {(match.teams.away?.name || 'A').slice(0, 3).toUpperCase()}
                        </div>
                      )}
                      <span className="line-clamp-1 max-w-[100px] text-[11px] font-bold text-slate-300">
                        {match.teams.away?.name}
                      </span>
                    </div>
                  </div>
                )}

                <h3 className="mt-1 text-xl sm:text-2xl font-black text-white">{title}</h3>
                <p className="mt-2 text-xs font-semibold text-slate-400">
                  {isLive ? 'Broadcasting live now' : `Kickoff: ${timeOf(match, 'Asia/Kathmandu')}`}
                </p>
              </div>

              {/* Predictable, Accessible Play Button */}
              <button
                type="button"
                onClick={resolvePlayback}
                aria-label={`Start broadcast stream for ${title}`}
                className="relative z-10 group inline-flex items-center gap-3 rounded-2xl bg-[#c9f36b] px-6 py-3.5 text-sm font-black text-[#0a1110] shadow-lg shadow-[#c9f36b]/20 hover:bg-[#b8e25d] focus:outline-none focus:ring-4 focus:ring-[#c9f36b]/40 transition-all hover:scale-105 active:scale-95"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#0a1110] text-[#c9f36b] transition-transform group-hover:scale-110">
                  <svg className="h-4 w-4 ml-0.5" viewBox="0 0 24 24" fill="currentColor">
                    <polygon points="5 3 19 12 5 21 5 3"></polygon>
                  </svg>
                </span>
                <span>Play Broadcast Stream</span>
              </button>

              <p className="relative z-10 mt-4 text-[11px] text-slate-400">
                Sandboxed Secure Embed · Top-level ad-redirects blocked
              </p>
            </div>
          )}

          {/* STATE 2: RESOLVING - Loading indicator while preparing verified playback */}
          {playerState === 'resolving' && (
            <div className="flex flex-col items-center gap-4 px-6 text-center" aria-live="polite">
              <div className="relative flex h-16 w-16 items-center justify-center">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#c9f36b]/30"></span>
                <span className="h-10 w-10 animate-spin rounded-full border-2 border-[#c9f36b] border-t-transparent shadow-[0_0_15px_rgba(201,243,107,0.3)]"></span>
              </div>
              <div>
                <p className="text-sm font-bold text-white">Resolving Verified Broadcast Signal</p>
                <p className="mt-1 font-mono text-xs text-slate-400">Negotiating stream parameters for {title}...</p>
              </div>
            </div>
          )}

          {/* STATE 3: ERROR / UNAVAILABLE / UNSUPPORTED */}
          {(playerState === 'failed' || playerState === 'unavailable' || playerState === 'unsupported') && (
            <div className="max-w-md px-6 text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl border border-amber-500/30 bg-amber-500/10 text-amber-400 shadow-lg">
                <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="12" y1="8" x2="12" y2="12"></line>
                  <line x1="12" y1="16" x2="12.01" y2="16"></line>
                </svg>
              </div>
              <p className="text-sm font-bold text-amber-300">{errorMessage}</p>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                <button
                  type="button"
                  onClick={resolvePlayback}
                  className="rounded-lg bg-white/10 px-3 py-1.5 text-xs font-bold text-white hover:bg-white/20 transition"
                >
                  Retry Connection
                </button>
                {sources.length > 1 && (
                  <span className="text-xs text-slate-400 flex items-center">
                    or try another provider in the top bar.
                  </span>
                )}
              </div>
            </div>
          )}

          {/* STATE 4: READY & PLAYING */}
          {(playerState === 'ready' || playerState === 'playing') && activeStream && (
            <>
              {activeStream.isNativeVideo ? (
                <video
                  ref={videoRef}
                  controls
                  autoPlay
                  className="h-full w-full"
                  src={activeStream.embedUrl}
                  playsInline
                  onLoadedMetadata={() => setPlayerState('playing')}
                  onPlaying={() => setPlayerState('playing')}
                  onWaiting={() => {}}
                  onError={() => {
                    setPlayerState('failed');
                    setErrorMessage('Video playback error on this server.');
                  }}
                ></video>
              ) : (
                <iframe
                  src={activeStream.embedUrl}
                  className="h-full w-full border-0"
                  allowFullScreen
                  allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
                  {...(useSandbox
                    ? { sandbox: 'allow-scripts allow-same-origin allow-forms allow-presentation' }
                    : {})}
                  referrerPolicy="strict-origin-when-cross-origin"
                  title={`${title} live stream`}
                  onLoad={() => setPlayerState('playing')}
                ></iframe>
              )}
            </>
          )}
        </div>

        {/* Security & Server Selection Toolbar */}
        {streams.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/5 bg-[#0b100f] p-3 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <span className="mr-1 font-bold text-slate-500">Servers:</span>
              {streams.map((stream, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() => handleServerSelect(stream)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                    activeStream === stream
                      ? 'bg-[#c9f36b] text-[#0a1110] font-black shadow-sm'
                      : 'bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  {stream.language || `Server ${index + 1}`} {stream.hd ? 'HD' : ''}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setUseSandbox(!useSandbox)}
                className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-bold transition ${
                  useSandbox
                    ? 'border border-emerald-500/40 bg-emerald-500/10 text-emerald-400'
                    : 'border border-amber-500/40 bg-amber-500/10 text-amber-300'
                }`}
                title={useSandbox ? 'Anti-Popup Shield active. Popups and redirects are blocked. Click for direct mode.' : 'Direct playback mode. Click to enable Anti-Popup Shield.'}
              >
                <span>{useSandbox ? '🛡️ Anti-Popup Shield: ON' : '⚡ Direct Play: ON'}</span>
              </button>
            </div>
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
