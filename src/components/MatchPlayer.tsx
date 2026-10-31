import { useEffect, useRef, useState, useMemo } from 'react';
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
import { NPL_FIXTURES_2026, NPL_TEAMS, type NplMatch } from '../lib/data/nplData';
import type { CommentaryLine, RecentBall } from '../lib/scoreService';

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

  // Player States: 'idle' | 'resolving' | 'ready' | 'playing' | 'failed' | 'unavailable' | 'unsupported'
  const [playerState, setPlayerState] = useState<PlayerState>('idle');
  const [streams, setStreams] = useState<StreamItem[]>([]);
  const [activeStream, setActiveStream] = useState<StreamItem | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [failoverToast, setFailoverToast] = useState<string | null>(null);
  const [shortcutToast, setShortcutToast] = useState<string | null>(null);

  const [isFavorite, setIsFavorite] = useState(false);
  const [copiedToast, setCopiedToast] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [localTz, setLocalTz] = useState<string>('Local Time');

  // Hub tabs: 'commentary' | 'upcoming' | 'standings'
  const [activeHubTab, setActiveHubTab] = useState<'commentary' | 'upcoming' | 'standings'>('commentary');

  // Live Ground Scorer State
  const [liveScore, setLiveScore] = useState<string>('');
  const [liveOvers, setLiveOvers] = useState<string>('');
  const [liveCrr, setLiveCrr] = useState<string>('');
  const [recentBalls, setRecentBalls] = useState<RecentBall[]>([]);
  const [commentaryList, setCommentaryList] = useState<CommentaryLine[]>([]);

  const playerContainerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsInstanceRef = useRef<any>(null);
  const isResolvingRef = useRef(false);

  const title = titleOf(match);
  const slug = slugify(title);
  const status = statusOf(match);
  const isLive = status === 'Live';
  const ts = getMatchTimestamp(match);
  const league = match.category === 'football' ? detectFootballLeague(match) : null;
  const isNplMatch =
    match.category === 'cricket' &&
    ((match.competition && match.competition.toLowerCase().includes('nepal')) ||
      (match.league && match.league.toLowerCase().includes('npl')) ||
      (match.id && match.id.toLowerCase().includes('npl')) ||
      title.toLowerCase().includes('npl') ||
      sources.some((s) => s.source === 'npl'));

  // Initialize client preferences and listen for updates
  useEffect(() => {
    (window as any).__SPORTIVO_IS_WATCHING__ = true;
    return () => {
      (window as any).__SPORTIVO_IS_WATCHING__ = false;
    };
  }, []);

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

  // Jump to Live Edge on explicit user request
  const jumpToLiveEdge = () => {
    const video = videoRef.current;
    const hls = hlsInstanceRef.current;
    if (video) {
      if (hls && typeof hls.liveSyncPosition === 'number' && hls.liveSyncPosition > 0) {
        video.currentTime = hls.liveSyncPosition;
      } else if (video.seekable && video.seekable.length > 0) {
        video.currentTime = video.seekable.end(video.seekable.length - 1);
      }
      video.playbackRate = 1.0;
      video.play().catch(() => {});
      setShortcutToast('⚡ Synced to Live Edge');
      setTimeout(() => setShortcutToast(null), 2000);
    }
  };

  // Keyboard Shortcuts for Power Users (Space, M, F, L, N)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept when user is typing in form inputs
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }

      if (e.code === 'Space') {
        e.preventDefault();
        if (videoRef.current) {
          if (videoRef.current.paused) {
            videoRef.current.play().catch(() => {});
            setShortcutToast('▶ Playing');
          } else {
            videoRef.current.pause();
            setShortcutToast('⏸ Paused');
          }
          setTimeout(() => setShortcutToast(null), 1500);
        }
      } else if (e.code === 'KeyM') {
        if (videoRef.current) {
          videoRef.current.muted = !videoRef.current.muted;
          setShortcutToast(videoRef.current.muted ? '🔇 Muted' : '🔊 Unmuted');
          setTimeout(() => setShortcutToast(null), 1500);
        }
      } else if (e.code === 'KeyF') {
        toggleFullscreen();
      } else if (e.code === 'KeyL') {
        jumpToLiveEdge();
      } else if (e.code === 'KeyN') {
        const prefs = loadUserPreferences();
        const nextEnabled = !prefs.notifications.enabled;
        const updated = { ...prefs, notifications: { ...prefs.notifications, enabled: nextEnabled } };
        saveUserPreferences(updated);
        setShortcutToast(nextEnabled ? '🔔 Notifications ON' : '🔕 Notifications OFF');
        setTimeout(() => setShortcutToast(null), 1500);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Poll Ground Scorer Ball Commentary & Moments (every 4s) - strictly for NPL matches only
  useEffect(() => {
    if (!isNplMatch) return;

    let isMounted = true;
    let timer: any = null;

    const pollLiveDesk = async () => {
      try {
        const res = await fetch(`/api/npl/live-moments/?_t=${Date.now()}`, {
          cache: 'no-store',
          signal: AbortSignal.timeout(3500),
        });
        if (res.ok && isMounted) {
          const data = await res.json();
          if (data) {
            if (data.score) setLiveScore((prev) => (prev !== data.score ? data.score : prev));
            if (data.overs) setLiveOvers((prev) => (prev !== data.overs ? data.overs : prev));
            if (data.crr) setLiveCrr((prev) => (prev !== data.crr ? data.crr : prev));
            if (Array.isArray(data.recentBalls) && data.recentBalls.length > 0) {
              setRecentBalls((prev) => (prev.length !== data.recentBalls.length ? data.recentBalls : prev));
            }
            if (Array.isArray(data.commentary) && data.commentary.length > 0) {
              setCommentaryList((prev) => (prev.length !== data.commentary.length ? data.commentary : prev));
            }
          }
        }
      } catch {}

      if (isMounted) {
        timer = setTimeout(pollLiveDesk, 4000);
      }
    };

    pollLiveDesk();

    return () => {
      isMounted = false;
      if (timer) clearTimeout(timer);
    };
  }, []);

  // Continuous HLS Streaming Engine - isolated strictly to stream URL changes
  const streamUrl = activeStream?.embedUrl;
  const isNative = activeStream?.isNativeVideo;

  useEffect(() => {
    let hls: any = null;

    if (!streamUrl || !isNative || !videoRef.current) return;
    const video = videoRef.current;

    if (streamUrl.includes('.m3u8')) {
      import('hls.js').then(({ default: Hls }) => {
        if (!Hls.isSupported()) {
          if (video.canPlayType('application/vnd.apple.mpegurl')) {
            video.src = streamUrl;
            video.play().catch(() => {
              video.muted = true;
              video.play().catch(() => {});
            });
          } else {
            setPlayerState('unsupported');
            setErrorMessage('Your browser does not support native HLS streaming.');
          }
          return;
        }

        // Rock-solid continuous streaming config:
        // NetTV broadcasts 10-12s chunks. Maintaining a 3-segment buffer (~30s) prevents underruns, pauses, and decoder stalls.
        hls = new Hls({
          enableWorker: true,
          lowLatencyMode: false,
          liveSyncDurationCount: 3,         // 3 segments buffer for continuous, uninterrupted playback
          liveMaxLatencyDurationCount: 6,   // Smooth maximum latency
          maxBufferLength: 30,              // Keep 30s of video in memory ahead of playhead
          maxMaxBufferLength: 60,
          backBufferLength: 30,             // Retain 30s of played content
          liveDurationInfinity: true,
        });
        hlsInstanceRef.current = hls;

        hls.loadSource(streamUrl);
        hls.attachMedia(video);

        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          setPlayerState('playing');
          video.play().catch(() => {
            // Autoplay with sound blocked -> fallback to muted
            video.muted = true;
            video.play().catch(() => {});
          });
        });

        // Failover only on fatal unrecoverable errors
        hls.on(Hls.Events.ERROR, (_event: any, data: any) => {
          if (!data.fatal) return;

          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              hls.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              hls.recoverMediaError();
              break;
            default:
              const currentIdx = streams.findIndex((s) => s.embedUrl === streamUrl);
              if (currentIdx >= 0 && currentIdx < streams.length - 1) {
                const nextStream = streams[currentIdx + 1];
                hls.destroy();
                hlsInstanceRef.current = null;
                setActiveStream(nextStream);
                setFailoverToast(`⚡ Auto-failover: Switched to ${nextStream.language || `Server ${currentIdx + 2}`}`);
                setTimeout(() => setFailoverToast(null), 3500);
              } else {
                hls.destroy();
                hlsInstanceRef.current = null;
                setPlayerState('failed');
                setErrorMessage('Broadcast feed is reconnecting to upstream servers.');
              }
              break;
          }
        });
      }).catch(() => {
        setPlayerState('failed');
        setErrorMessage('Could not initialize video streaming engine.');
      });
    } else {
      video.src = streamUrl;
      video.play().catch(() => {});
    }

    return () => {
      if (hls) {
        hls.destroy();
        hlsInstanceRef.current = null;
      }
    };
  }, [streamUrl, isNative]);

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

          let isNative = false;
          if (typeof item.isNativeVideo === 'boolean') {
            isNative = item.isNativeVideo;
          } else {
            const cleanPath = safeUrl.split('?')[0].toLowerCase();
            isNative = cleanPath.endsWith('.m3u8') || cleanPath.endsWith('.mp4');
          }

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

  // Auto-connect to live stream if match is live or has active stream source
  useEffect(() => {
    if ((isLive || currentSource?.source === 'npl') && sources.length > 0 && playerState === 'idle' && !isResolvingRef.current) {
      resolvePlayback();
    }
  }, [isLive, currentSource, sources.length, playerState]);

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

  // NPL Standings calculation
  const nplStandings = useMemo(() => {
    return [
      { name: 'Sudurpaschim Royals', p: 1, w: 1, l: 0, pts: 2, nrr: '+1.450' },
      { name: 'Janakpur Bolts', p: 1, w: 1, l: 0, pts: 2, nrr: '+1.120' },
      { name: 'Biratnagar Kings', p: 1, w: 1, l: 0, pts: 2, nrr: '+0.850' },
      { name: 'Chitwan Rhinos', p: 1, w: 1, l: 0, pts: 2, nrr: '+0.420' },
      { name: 'Kathmandu Gurkhas', p: 1, w: 0, l: 1, pts: 0, nrr: '-0.420' },
      { name: 'Pokhara Avengers', p: 1, w: 0, l: 1, pts: 0, nrr: '-0.850' },
      { name: 'Lumbini Lions', p: 1, w: 0, l: 1, pts: 0, nrr: '-1.120' },
      { name: 'Karnali Yaks', p: 1, w: 0, l: 1, pts: 0, nrr: '-1.450' },
    ];
  }, []);

  // Upcoming NPL Matches
  const upcomingNplMatches = useMemo(() => {
    const now = Date.now();
    return NPL_FIXTURES_2026.filter((m) => m.timestamp > now).slice(0, 5);
  }, []);

  return (
    <div className="space-y-6">
      {/* Toast notifications for hotkeys and auto-failover */}
      {failoverToast && (
        <div className="fixed top-20 right-6 z-50 flex items-center gap-2 rounded-xl border border-[#c9f36b]/40 bg-[#0b100f]/95 px-4 py-3 text-xs font-bold text-[#c9f36b] shadow-2xl backdrop-blur-md animate-bounce">
          <span className="h-2 w-2 rounded-full bg-[#c9f36b] animate-ping"></span>
          <span>{failoverToast}</span>
        </div>
      )}

      {shortcutToast && (
        <div className="fixed bottom-6 right-6 z-50 rounded-xl border border-white/20 bg-black/90 px-4 py-2 text-xs font-bold text-white shadow-2xl backdrop-blur-md">
          {shortcutToast}
        </div>
      )}

      {/* Main Player Frame Container - compact default web size */}
      <div
        ref={playerContainerRef}
        className="mx-auto w-full max-w-4xl overflow-hidden rounded-2xl border border-white/10 bg-[#111a19] shadow-2xl shadow-black/80"
      >
        {/* Player Top Navigation & Live Telemetry Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/5 bg-[#0b100f] p-4">
          <div>
            <div className="flex items-center gap-2">
              <span
                className={`flex items-center gap-1.5 rounded px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-white ${
                  isLive ? 'bg-red-600' : 'border border-amber-400/40 bg-amber-400/10 text-amber-300'
                }`}
              >
                {isLive && <span className="h-1.5 w-1.5 animate-ping rounded-full bg-white"></span>}
                {isLive ? 'LIVE' : status === 'Final' ? 'FINAL' : 'SCHEDULED'}
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
            {/* Live Edge Sync Button */}
            <button
              type="button"
              onClick={jumpToLiveEdge}
              className="inline-flex items-center gap-1.5 rounded-lg border border-red-500/50 bg-red-500/10 px-3 py-1.5 text-xs font-black text-red-400 hover:bg-red-500 hover:text-white transition shadow-sm active:scale-95"
              title="Press 'L' key to jump directly to live broadcast edge"
            >
              <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse"></span>
              <span>LIVE</span>
            </button>

            {/* Keyboard Shortcuts Guide Pill */}
            <div className="hidden sm:flex items-center gap-1 text-[10px] text-slate-400 border border-white/10 bg-white/5 px-2 py-1.5 rounded-lg" title="Hotkeys: Space (Play/Pause), M (Mute), F (Fullscreen), L (Live Edge), N (Alerts)">
              <span className="font-mono bg-white/10 px-1 rounded text-slate-200">Space</span>
              <span className="font-mono bg-white/10 px-1 rounded text-slate-200">M</span>
              <span className="font-mono bg-white/10 px-1 rounded text-slate-200">F</span>
              <span className="font-mono bg-white/10 px-1 rounded text-[#c9f36b]">L</span>
            </div>

            {/* Fullscreen Button */}
            <button
              type="button"
              onClick={toggleFullscreen}
              className="rounded-lg border border-white/10 bg-white/5 p-2 text-slate-300 hover:border-white/20 hover:text-white transition"
              title={isFullscreen ? 'Exit Fullscreen (F)' : 'Enter Fullscreen (F)'}
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
          {/* STATE 1: IDLE */}
          {playerState === 'idle' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center overflow-hidden bg-[#0a100f] px-6 text-center">
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

              <div className="relative z-10 mb-6 max-w-lg">
                <span className="text-[11px] font-bold uppercase tracking-widest text-[#e5b94f]">
                  {league || match.category?.toUpperCase() || 'SPORTS'} · NEPAL STANDARD TIME
                </span>

                <h3 className="mt-2 text-xl sm:text-2xl font-black text-white">{title}</h3>
                <p className="mt-2 text-xs font-semibold text-slate-300">
                  {isLive ? 'Broadcasting live now' : `Kickoff: ${timeOf(match, 'Asia/Kathmandu')} (Nepal Standard Time)`}
                </p>
              </div>

              {isLive || sources.length > 0 ? (
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
                  <span>{isLive ? 'Play Live Broadcast Stream (0.0s Delay)' : 'Watch Stream Feed'}</span>
                </button>
              ) : (
                <div className="relative z-10 flex flex-col items-center max-w-md rounded-2xl border border-white/10 bg-black/75 p-5 backdrop-blur-md shadow-2xl">
                  <div className="flex items-center gap-2 rounded-full border border-amber-400/30 bg-amber-400/10 px-3.5 py-1 text-xs font-bold text-amber-300">
                    <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse"></span>
                    <span>UPCOMING FIXTURE</span>
                  </div>

                  <p className="mt-3 text-base sm:text-lg font-black text-white">
                    Kickoff: {timeOf(match, 'Asia/Kathmandu')}
                  </p>
                  <p className="text-xs font-bold text-[#c9f36b] mt-0.5">
                    Nepal Standard Time (NST) {ts && `· ${formatCountdown(ts)}`}
                  </p>

                  <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                    <button
                      type="button"
                      onClick={toggleFavorite}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-white/20 bg-white/10 px-3.5 py-2 text-xs font-bold text-white hover:bg-white/20 transition"
                    >
                      <span>{isFavorite ? '★ In Watchlist' : '☆ Add to Watchlist'}</span>
                    </button>
                    <a
                      href={generateGoogleCalendarUrl(match, title, league)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-xl border border-white/20 bg-white/10 px-3.5 py-2 text-xs font-bold text-white hover:bg-white/20 transition"
                    >
                      <span>📅 Google Calendar</span>
                    </a>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STATE 2: RESOLVING */}
          {playerState === 'resolving' && (
            <div className="flex flex-col items-center gap-4 px-6 text-center" aria-live="polite">
              <div className="relative flex h-16 w-16 items-center justify-center">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#c9f36b]/30"></span>
                <span className="h-10 w-10 animate-spin rounded-full border-2 border-[#c9f36b] border-t-transparent shadow-[0_0_15px_rgba(201,243,107,0.3)]"></span>
              </div>
              <div>
                <p className="text-sm font-bold text-white">Resolving Verified Direct HLS Feed</p>
                <p className="mt-1 font-mono text-xs text-slate-400">Connecting directly to edge broadcast encoder...</p>
              </div>
            </div>
          )}

          {/* STATE 3: ERROR / RETRY */}
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
                  className="rounded-lg bg-[#c9f36b] px-4 py-2 text-xs font-black text-[#0a1110] hover:bg-[#b8e25d] transition shadow-md"
                >
                  Reconnect Signal
                </button>
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
                  playsInline
                  className="h-full w-full"
                  src={activeStream.embedUrl.includes('.m3u8') ? undefined : activeStream.embedUrl}
                ></video>
              ) : (
                <iframe
                  src={activeStream.embedUrl}
                  className="h-full w-full border-0"
                  allowFullScreen
                  allow="autoplay; fullscreen; picture-in-picture; encrypted-media; clipboard-write"
                  referrerPolicy="no-referrer"
                  title={`${title} live stream`}
                  onLoad={() => setPlayerState('playing')}
                ></iframe>
              )}
            </>
          )}
        </div>

        {/* Server Selection & Latency Toolbar */}
        {streams.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 border-t border-white/5 bg-[#0b100f] p-3 text-xs">
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

            <div className="ml-auto flex items-center gap-2">
              <a
                href={activeStream.embedUrl}
                target="_blank"
                rel="noreferrer noopener"
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs font-semibold text-slate-300 hover:bg-white/15 hover:text-white transition"
                title="Open stream in a clean external window to bypass browser iframe restrictions"
              >
                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                  <polyline points="15 3 21 3 21 9"></polyline>
                  <line x1="10" y1="14" x2="21" y2="3"></line>
                </svg>
                <span>New Window</span>
              </a>

              <button
                type="button"
                onClick={jumpToLiveEdge}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[#c9f36b]/40 bg-[#c9f36b]/10 px-3 py-1.5 text-xs font-black text-[#c9f36b] hover:bg-[#c9f36b] hover:text-[#080a0b] transition shadow-sm active:scale-95"
                title="Sync playback directly to live broadcast edge"
              >
                <span className="h-2 w-2 rounded-full bg-[#c9f36b] animate-ping"></span>
                <span>⚡ Live Edge</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Real-time Match Telemetry Bar & Commentary Hub - strictly displayed on NPL Live matches */}
      {isNplMatch && (
        <>
          <div className="rounded-2xl border border-white/10 bg-[#0d1413] p-4 shadow-xl">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-1.5">
                  <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse"></span>
                  <span className="text-xs font-black text-red-400 uppercase tracking-wider">Ground Feed</span>
                </div>

                {liveScore && (
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-black text-white">{liveScore}</span>
                    {liveOvers && <span className="text-xs font-bold text-slate-400">({liveOvers} ov)</span>}
                    {liveCrr && <span className="text-xs font-bold text-[#e5b94f]">CRR: {liveCrr}</span>}
                  </div>
                )}
              </div>

              {/* Recent Balls Strip */}
              {recentBalls.length > 0 && (
                <div className="flex items-center gap-1.5 overflow-x-auto py-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mr-1">Overs:</span>
                  {recentBalls.slice(-12).map((b, idx) => {
                    const code = (b.code || '').toLowerCase();
                    const isFour = code === '4';
                    const isSix = code === '6';
                    const isWkt = code.includes('w') && !code.includes('wd');
                    const isDot = code === '0';

                    return (
                      <span
                        key={idx}
                        className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-black transition shadow-sm ${
                          isSix
                            ? 'bg-purple-600 text-white ring-2 ring-purple-400'
                            : isFour
                            ? 'bg-emerald-500 text-black ring-2 ring-emerald-300'
                            : isWkt
                            ? 'bg-red-600 text-white ring-2 ring-red-400 animate-pulse'
                            : isDot
                            ? 'bg-slate-800 text-slate-400 border border-white/5'
                            : 'bg-white/10 text-white border border-white/10'
                        }`}
                        title={`Over ${b.over}.${b.delivery}: ${b.code}`}
                      >
                        {isWkt ? 'W' : isDot ? '•' : b.code}
                      </span>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Interactive Match Hub: Tabs for Commentary, Upcoming Fixtures & Points Table */}
          <div className="rounded-2xl border border-white/10 bg-[#111a19] shadow-xl overflow-hidden">
            {/* Hub Tabs Header */}
            <div className="flex items-center gap-2 border-b border-white/10 bg-[#0a100f] px-4 pt-3">
              <button
                type="button"
                onClick={() => setActiveHubTab('commentary')}
                className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-bold transition ${
                  activeHubTab === 'commentary'
                    ? 'border-[#c9f36b] text-[#c9f36b]'
                    : 'border-transparent text-slate-400 hover:text-white'
                }`}
              >
                <span className="h-2 w-2 rounded-full bg-[#c9f36b]"></span>
                <span>Live Ball-by-Ball Commentary</span>
                {commentaryList.length > 0 && (
                  <span className="rounded-full bg-white/10 px-1.5 py-0.2 text-[10px] text-slate-300">
                    {commentaryList.length}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => setActiveHubTab('upcoming')}
                className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-bold transition ${
                  activeHubTab === 'upcoming'
                    ? 'border-[#c9f36b] text-[#c9f36b]'
                    : 'border-transparent text-slate-400 hover:text-white'
                }`}
              >
                <span>Upcoming NPL Matches</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveHubTab('standings')}
                className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-bold transition ${
                  activeHubTab === 'standings'
                    ? 'border-[#c9f36b] text-[#c9f36b]'
                    : 'border-transparent text-slate-400 hover:text-white'
                }`}
              >
                <span>NPL Points Table</span>
              </button>
            </div>

            {/* Tab 1: Live Ball-by-Ball Commentary Drawer */}
            {activeHubTab === 'commentary' && (
              <div className="p-5 max-h-96 overflow-y-auto divide-y divide-white/5">
                {commentaryList.length === 0 ? (
                  <div className="py-8 text-center text-slate-400 text-xs">
                    <p>Waiting for live ball feeds from ground scorers...</p>
                    <p className="mt-1 text-slate-500">Live commentary updates dynamically on every delivery.</p>
                  </div>
                ) : (
                  commentaryList.map((comm, idx) => (
                    <div key={idx} className="py-3 flex items-start gap-4 hover:bg-white/[0.02] px-2 rounded-xl transition">
                      <div className="shrink-0 flex flex-col items-center">
                        <span className="font-mono text-xs font-black text-[#c9f36b] bg-white/5 px-2 py-1 rounded-lg border border-white/5">
                          {comm.ball}
                        </span>
                        {comm.outcome && (
                          <span
                            className={`mt-1 text-[10px] font-black px-1.5 py-0.5 rounded ${
                              comm.outcome === '6'
                                ? 'bg-purple-600 text-white'
                                : comm.outcome === '4'
                                ? 'bg-emerald-500 text-black'
                                : comm.outcome === 'W'
                                ? 'bg-red-600 text-white'
                                : 'bg-white/10 text-white'
                            }`}
                          >
                            {comm.outcome}
                          </span>
                        )}
                      </div>

                      <div className="flex-1">
                        <p className="text-xs font-bold text-[#e5b94f]">{comm.bowlerToBatsman}</p>
                        <p className="mt-1 text-xs leading-relaxed text-slate-200">{comm.text}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Tab 2: Upcoming NPL Matches with Countdown */}
            {activeHubTab === 'upcoming' && (
              <div className="p-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {upcomingNplMatches.map((m) => (
                    <div
                      key={m.id}
                      className="rounded-xl border border-white/5 bg-white/[0.02] p-4 flex flex-col justify-between hover:border-white/20 transition"
                    >
                      <div className="flex items-center justify-between text-[11px] text-slate-400">
                        <span className="font-bold text-[#e5b94f]">Match {m.matchNumber}</span>
                        <span className="font-mono text-[#c9f36b] font-bold">{formatCountdown(m.timestamp)}</span>
                      </div>

                      <div className="my-3 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <img src={m.homeTeamLogo} alt="" className="h-6 w-6 object-contain" />
                          <span className="text-xs font-bold text-white">{m.homeTeam}</span>
                        </div>
                        <span className="text-[10px] font-black text-slate-500">VS</span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-white">{m.awayTeam}</span>
                          <img src={m.awayTeamLogo} alt="" className="h-6 w-6 object-contain" />
                        </div>
                      </div>

                      <div className="border-t border-white/5 pt-2 flex items-center justify-between text-[10px] text-slate-400">
                        <span>{timeOf(match, 'Asia/Kathmandu')}</span>
                        <a
                          href={`/cricket/match/${slugify(`${m.homeTeam} vs ${m.awayTeam}`)}/`}
                          className="text-[#c9f36b] font-bold hover:underline"
                        >
                          Match Center &rarr;
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Tab 3: Points Table */}
            {activeHubTab === 'standings' && (
              <div className="p-5 overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-white/10 text-slate-400 text-[10px] uppercase tracking-wider">
                      <th className="py-2 px-3">Team</th>
                      <th className="py-2 px-3 text-center">P</th>
                      <th className="py-2 px-3 text-center">W</th>
                      <th className="py-2 px-3 text-center">L</th>
                      <th className="py-2 px-3 text-center">PTS</th>
                      <th className="py-2 px-3 text-right">NRR</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {nplStandings.map((team, idx) => (
                      <tr key={team.name} className="hover:bg-white/[0.02] transition">
                        <td className="py-2.5 px-3 flex items-center gap-2">
                          <span className="font-mono text-slate-500 text-[10px] w-3">{idx + 1}</span>
                          {NPL_TEAMS[team.name]?.logo && (
                            <img src={NPL_TEAMS[team.name].logo} alt="" className="h-5 w-5 object-contain" />
                          )}
                          <span className="font-bold text-white">{team.name}</span>
                        </td>
                        <td className="py-2.5 px-3 text-center font-mono text-slate-300">{team.p}</td>
                        <td className="py-2.5 px-3 text-center font-mono text-emerald-400">{team.w}</td>
                        <td className="py-2.5 px-3 text-center font-mono text-red-400">{team.l}</td>
                        <td className="py-2.5 px-3 text-center font-mono font-black text-[#c9f36b]">{team.pts}</td>
                        <td className="py-2.5 px-3 text-right font-mono text-slate-300">{team.nrr}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* Match Tools & Action Panel */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
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
            Stream signals are optimized for ultra-low broadcast latency. If audio or video pauses, switch servers above or hit <kbd className="bg-white/10 px-1 py-0.5 rounded font-mono text-[#c9f36b]">L</kbd> to jump straight to the live edge.
          </p>
        </div>

        {/* Action Buttons & Calendar Integration */}
        <div className="flex flex-col justify-between rounded-2xl border border-white/10 bg-[#111a19] p-5 shadow-lg">
          <div>
            <span className="text-[10px] font-black uppercase tracking-widest text-[#e5b94f]">Match Tools</span>
            <h4 className="text-sm font-bold text-white mt-0.5">Save &amp; Remind</h4>

            <div className="mt-4 space-y-2.5">
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

              {ts && (
                <a
                  href={generateGoogleCalendarUrl(match)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 py-2.5 text-xs font-bold text-slate-300 hover:text-white hover:bg-white/10 transition"
                >
                  <span>📅 Google Calendar</span>
                </a>
              )}

              {ts && (
                <button
                  type="button"
                  onClick={handleDownloadIcs}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 py-2.5 text-xs font-bold text-slate-300 hover:text-white hover:bg-white/10 transition"
                >
                  <span>📥 Download .ics Calendar</span>
                </button>
              )}

              <button
                type="button"
                onClick={handleShare}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 py-2.5 text-xs font-bold text-slate-300 hover:text-white hover:bg-white/10 transition"
              >
                <span>{copiedToast ? '✓ Link Copied to Clipboard!' : '🔗 Share Match'}</span>
              </button>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-white/5 text-[10px] text-slate-500">
            Official edge broadcast streams. No proxy overhead.
          </div>
        </div>
      </div>
    </div>
  );
}
