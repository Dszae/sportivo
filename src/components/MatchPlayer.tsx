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
import {
  cleanCricketText,
  type CommentaryLine,
  type RecentBall,
  type LiveBatter,
  type LiveBowler,
  type LiveMatchHeader,
} from '../lib/scoreService';

interface StreamItem {
  embedUrl: string;
  hd?: boolean;
  language?: string;
  isNativeVideo?: boolean;
  isSandboxedIframe?: boolean;
  licenseUrl?: string;
}

type Props = {
  match: Match;
  showNplHub?: boolean; // Ball-by-ball commentary and table hub strictly in NPL live section only
  initialStreams?: StreamItem[];
};

// Shaka Player dynamic CDN loader for zero-delay DASH (.mpd) streams
let shakaLoadPromise: Promise<any> | null = null;
function getShaka(): Promise<any> {
  if (typeof window === 'undefined') return Promise.reject(new Error('Window undefined'));
  if ((window as any).shaka) return Promise.resolve((window as any).shaka);
  if (shakaLoadPromise) return shakaLoadPromise;

  shakaLoadPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-shaka]');
    if (existing) {
      if ((window as any).shaka) {
        resolve((window as any).shaka);
      } else {
        existing.addEventListener('load', () => resolve((window as any).shaka));
        existing.addEventListener('error', (e) => {
          shakaLoadPromise = null;
          reject(e);
        });
      }
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/shaka-player/4.7.11/shaka-player.compiled.js';
    script.async = true;
    script.setAttribute('data-shaka', 'true');
    script.onload = () => resolve((window as any).shaka);
    script.onerror = (e) => {
      shakaLoadPromise = null;
      reject(e);
    };
    document.head.appendChild(script);
  });

  return shakaLoadPromise;
}

export default function MatchPlayer({ match, showNplHub = false, initialStreams }: Props) {
  const sources = match.sources || [];
  const [selectedSourceIndex, setSelectedSourceIndex] = useState(0);
  const currentSource = sources[selectedSourceIndex];

  const hasInitial = Array.isArray(initialStreams) && initialStreams.length > 0;
  // Player States: 'idle' | 'resolving' | 'ready' | 'playing' | 'failed' | 'unavailable' | 'unsupported'
  const [playerState, setPlayerState] = useState<PlayerState>(() => (hasInitial ? 'ready' : 'idle'));
  const [streams, setStreams] = useState<StreamItem[]>(() => (hasInitial ? initialStreams! : []));
  const [activeStream, setActiveStream] = useState<StreamItem | null>(() => (hasInitial ? initialStreams![0] : null));
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
  const [liveRrr, setLiveRrr] = useState<string>('');
  const [liveTarget, setLiveTarget] = useState<string>('');
  const [liveHeader, setLiveHeader] = useState<LiveMatchHeader | null>(null);
  const [liveBatters, setLiveBatters] = useState<LiveBatter[]>([]);
  const [liveBowler, setLiveBowler] = useState<LiveBowler | null>(null);
  const [recentBalls, setRecentBalls] = useState<RecentBall[]>([]);
  const [commentaryList, setCommentaryList] = useState<CommentaryLine[]>([]);

  const playerContainerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoEl, setVideoEl] = useState<HTMLVideoElement | null>(null);
  const hlsInstanceRef = useRef<any>(null);
  const shakaInstanceRef = useRef<any>(null);
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

  // Fullscreen event listener (cross-browser support)
  useEffect(() => {
    const handleFullscreenChange = () => {
      const doc: any = document;
      const fsElement = doc.fullscreenElement || doc.webkitFullscreenElement || doc.mozFullScreenElement;
      setIsFullscreen(Boolean(fsElement));
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
    };
  }, []);

  // Jump to Live Edge on explicit user request
  const jumpToLiveEdge = () => {
    const video = videoEl || videoRef.current;
    const hls = hlsInstanceRef.current;
    const shaka = shakaInstanceRef.current;
    if (video) {
      if (shaka && typeof shaka.seekRange === 'function') {
        const range = shaka.seekRange();
        if (range && typeof range.end === 'number' && range.end > 0) {
          video.currentTime = Math.max(0, range.end - 0.5);
        }
      } else if (hls && typeof hls.liveSyncPosition === 'number' && hls.liveSyncPosition > 0) {
        video.currentTime = hls.liveSyncPosition;
      } else if (video.seekable && video.seekable.length > 0) {
        video.currentTime = video.seekable.end(video.seekable.length - 1);
      }
      video.playbackRate = 1.0;
      video.play().catch(() => {});
      setShortcutToast('Synced to live edge');
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
            setShortcutToast('Playing');
          } else {
            videoRef.current.pause();
            setShortcutToast('Paused');
          }
          setTimeout(() => setShortcutToast(null), 1500);
        }
      } else if (e.code === 'KeyM') {
        if (videoRef.current) {
          videoRef.current.muted = !videoRef.current.muted;
          setShortcutToast(videoRef.current.muted ? 'Muted' : 'Unmuted');
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
        setShortcutToast(nextEnabled ? 'Notifications on' : 'Notifications off');
        setTimeout(() => setShortcutToast(null), 1500);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Check if iOS (iPhone/iPad) where Widevine DRM is unsupported by WebKit
  useEffect(() => {
    if (typeof navigator === 'undefined') return;
    const isIOS =
      /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

    if (isIOS && streams.length > 0) {
      // Find the first iOS-compatible stream (iframe or non-Widevine)
      const iosCompatible = streams.find(
        (s) => !s.embedUrl.includes('.mpd') || s.isSandboxedIframe
      );
      if (iosCompatible && activeStream?.embedUrl.includes('.mpd') && !activeStream.isSandboxedIframe) {
        setActiveStream(iosCompatible);
      }
    }
  }, [streams]);

  // Poll Ground Scorer Ball Commentary & Moments (every 4s) - strictly for NPL matches in NPL Live section only
  useEffect(() => {
    if (!showNplHub || !isNplMatch) return;

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
            if (data.rrr) setLiveRrr((prev) => (prev !== data.rrr ? data.rrr : prev));
            if (data.target) setLiveTarget((prev) => (prev !== data.target ? data.target : prev));
            if (data.header) setLiveHeader(data.header);
            if (Array.isArray(data.batters)) setLiveBatters(data.batters);
            if (data.bowler) setLiveBowler(data.bowler);
            if (Array.isArray(data.recentBalls) && data.recentBalls.length > 0) {
              setRecentBalls((prev) => (prev.length !== data.recentBalls.length ? data.recentBalls : prev));
            }
            if (Array.isArray(data.commentary) && data.commentary.length > 0) {
              setCommentaryList((prev) => {
                const combined = [...data.commentary];
                for (const oldItem of prev) {
                  const exists = combined.some(
                    (c) => c.ball === oldItem.ball && c.text === oldItem.text
                  );
                  if (!exists) combined.push(oldItem);
                }
                return combined;
              });
            }
          }
        }
      } catch {}

      if (isMounted) {
        timer = setTimeout(pollLiveDesk, 4000);
      }
    };

    // Fetch official live standings
    const fetchStandings = async () => {
      try {
        const res = await fetch('/api/npl/standings/');
        if (res.ok && isMounted) {
          const list = await res.json();
          if (Array.isArray(list) && list.length > 0) {
            setNplStandings(list);
          }
        }
      } catch {}
    };

    pollLiveDesk();
    fetchStandings();

    const standingsTimer = setInterval(fetchStandings, 30000);

    return () => {
      isMounted = false;
      if (timer) clearTimeout(timer);
      clearInterval(standingsTimer);
    };
  }, []);

  // Continuous Video Streaming Engine - supporting both HLS (.m3u8) and zero-delay NetTV DASH (.mpd)
  const streamUrl = activeStream?.embedUrl;
  const isNative = activeStream?.isNativeVideo;

  useEffect(() => {
    let hls: any = null;
    let shakaPlayer: any = null;

    if (!streamUrl || !isNative || !videoEl) return;
    const video = videoEl;

    const failoverToNext = () => {
      const currentIdx = streams.findIndex((s) => s.embedUrl === streamUrl);
      if (currentIdx >= 0 && currentIdx < streams.length - 1) {
        const nextStream = streams[currentIdx + 1];
        if (shakaPlayer) {
          shakaPlayer.destroy().catch(() => {});
          shakaInstanceRef.current = null;
        }
        setActiveStream(nextStream);
        setFailoverToast(`Switched to server ${currentIdx + 2}`);
        setTimeout(() => setFailoverToast(null), 3500);
      } else {
        setPlayerState('failed');
        setErrorMessage('Broadcast feed is reconnecting to upstream servers.');
      }
    };

    // 1. DASH (.mpd) Stream Engine via Shaka Player (NetTV 1080p Zero-Delay Cluster)
    if (streamUrl.includes('.mpd')) {
      getShaka()
        .then(async (shaka) => {
          if (!shaka || !shaka.Player) {
            failoverToNext();
            return;
          }

          // Install all polyfills BEFORE checking browser support
          shaka.polyfill.installAll();

          if (!shaka.Player.isBrowserSupported()) {
            console.warn('[Shaka] Device/browser does not support Shaka MediaSource');
            failoverToNext();
            return;
          }

          // Check if Widevine DRM is required and supported by this device
          const isWidevine =
            streamUrl.includes('nettv.com.np') || Boolean(activeStream?.licenseUrl);
          if (isWidevine && typeof navigator !== 'undefined' && navigator.requestMediaKeySystemAccess) {
            try {
              await navigator.requestMediaKeySystemAccess('com.widevine.alpha', [
                {
                  initDataTypes: ['cenc'],
                  videoCapabilities: [{ contentType: 'video/mp4; codecs="avc1.42E01E"' }],
                },
              ]);
            } catch (err: any) {
              console.warn('[Shaka] Widevine DRM not supported on this device/browser:', err?.message || err);
              failoverToNext();
              return;
            }
          }

          const player = new shaka.Player();
          shakaPlayer = player;
          shakaInstanceRef.current = player;

          // Only trigger failover on CRITICAL severity (2), not recoverable warnings (1)
          player.addEventListener('error', (event: any) => {
            const detail = event?.detail;
            console.warn('[Shaka] Runtime notice:', detail);
            if (detail && detail.severity === 2) {
              failoverToNext();
            }
          });

          await player.attach(video);

          // Configure robust mobile buffering parameters:
          player.configure({
            streaming: {
              lowLatencyMode: false, // Prevents mobile network packet jitter from causing instant stalls
              inaccurateManifestTolerance: 1,
              rebufferingGoal: 2, // 2s minimum buffer before resuming
              bufferingGoal: 6, // 6s buffer ahead on mobile
              bufferBehind: 15,
              retryParameters: {
                maxAttempts: 4,
                baseDelay: 1000,
                backoffFactor: 1.5,
                fuzzFactor: 0.5,
                timeout: 10000,
              },
            },
          });

          // DRM decryption (Widevine or ClearKey)
          try {
            const urlObj = new URL(streamUrl, 'https://sportivo.internal');
            const keyId = urlObj.searchParams.get('keyid');
            const key = urlObj.searchParams.get('key');
            const licenseParam = urlObj.searchParams.get('license') || urlObj.searchParams.get('widevine');
            const widevineLicense =
              activeStream?.licenseUrl ||
              licenseParam ||
              (streamUrl.includes('nettv.com.np')
                ? 'https://widevine-dash.ezdrm.com/proxy?pX=196792&user_id=M2ZhNWI0YzAtNzgxNy00MjRlLWFlODMtZWFmYWJmNDRmMjU1&CustomData=eyJyZXNlbGxlcl9pZCI6IjEwNyIsInN1YnNjcmliZXJfaWQiOiIxMDc3NDk3NiIsInNlcmlhbCI6ImdsXzExMTUwMTQwMDk4MTM0NDk0MDcxMi0xMDciLCJtYXRjaF9rZXkiOiJhLXJ6LS1jcmlja2V0LS1wODIxMDMxNjQ3MDA5NzA4NzY5NzYiLCJleHAiOjE3OTQyMjQzMTksInNpZCI6IjdhMWJmNzExNTNiYjljOTNmOGQwYWJlOWY0NGRjNjJjIiwicGxhdGZvcm0iOiJ3ZWIiLCJlbnRpdGxlZF91bnRpbCI6MTc5NDIzNzgxOSwibWF4X2NvbmN1cnJlbnQiOjEsInN1YnNjcmliZXJfc3RiX2lkIjoiMTM3Mzg1NTAiLCJ1YmJfZ3VpZCI6IjNmYTViNGMwLTc4MTctNDI0ZS1hZTgzLWVhZmFiZjQ0ZjI1NSJ9.eXeuibnuH9Nrm3s16kg2Pst92shpPB9DaBqm5gmJnzQ'
                : undefined);

            const drmConfig: any = {};
            if (keyId && key) {
              drmConfig.clearKeys = { [keyId]: key };
            }
            if (widevineLicense) {
              drmConfig.servers = {
                'com.widevine.alpha': widevineLicense,
              };
            }

            if (Object.keys(drmConfig).length > 0) {
              player.configure({ drm: drmConfig });
            }
          } catch {}

          await player.load(streamUrl);

          setPlayerState('playing');
          // For mobile browsers: ensure muted is true and playsinline is set before play()
          video.muted = true;
          video.playsInline = true;
          video.setAttribute('playsinline', 'true');
          video.setAttribute('webkit-playsinline', 'true');
          try {
            await video.play();
          } catch {
            // Autoplay with muted is allowed on modern browsers
          }
        })
        .catch((err: any) => {
          console.warn('[Shaka] Init failure:', err);
          failoverToNext();
        });
    } else if (streamUrl.includes('.m3u8')) {
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
            video.muted = true;
            video.play().catch(() => {});
          });
        });

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
                setFailoverToast(`Switched to server ${currentIdx + 2}`);
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
      if (shakaPlayer) {
        shakaPlayer.destroy().catch(() => {});
        shakaInstanceRef.current = null;
      }
    };
  }, [streamUrl, isNative, videoEl]);

  // Resolves playback signals on explicit user action
  async function resolvePlayback(force = false) {
    if (status === 'Final') {
      setPlayerState('unavailable');
      setErrorMessage('This match has concluded. Live broadcast has ended.');
      return;
    }

    if (!currentSource?.source || !currentSource.id) {
      setPlayerState('unsupported');
      setErrorMessage('No valid stream source configured for this fixture.');
      return;
    }

    if (isResolvingRef.current && !force) return;
    isResolvingRef.current = true;
    setPlayerState('resolving');
    setErrorMessage('');

    const src = encodeURIComponent(currentSource.source);
    const sid = encodeURIComponent(currentSource.id);

    try {
      const res = await fetch(`/api/stream/${src}/${sid}/`, {
        signal: AbortSignal.timeout(6000),
      });
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
            isNative =
              cleanPath.endsWith('.m3u8') ||
              cleanPath.endsWith('.mp4') ||
              cleanPath.endsWith('.mpd') ||
              safeUrl.includes('.mpd');
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

  // Auto-connect to live stream ONLY if match is actively LIVE, not concluded, and not already preloaded from SSR backend
  useEffect(() => {
    if (isLive && status !== 'Final' && sources.length > 0 && playerState === 'idle' && !isResolvingRef.current) {
      if (!streams || streams.length === 0) {
        resolvePlayback();
      }
    }
  }, [isLive, status, sources.length, playerState, streams]);

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
    const elem: any = playerContainerRef.current;
    if (!elem) return;
    const doc: any = document;
    const isFs = Boolean(doc.fullscreenElement || doc.webkitFullscreenElement || doc.mozFullScreenElement);
    if (!isFs) {
      if (elem.requestFullscreen) {
        elem.requestFullscreen().catch(() => {});
      } else if (elem.webkitRequestFullscreen) {
        elem.webkitRequestFullscreen();
      } else if (elem.mozRequestFullScreen) {
        elem.mozRequestFullScreen();
      }
    } else {
      if (doc.exitFullscreen) {
        doc.exitFullscreen().catch(() => {});
      } else if (doc.webkitExitFullscreen) {
        doc.webkitExitFullscreen();
      } else if (doc.mozCancelFullScreen) {
        doc.mozCancelFullScreen();
      }
    }
  };

  const handleShare = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${title} â€” Live on Sportivo`,
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

  // Real-time official NPL Standings state
  const [nplStandings, setNplStandings] = useState<any[]>(() => [
    { rank: 1, name: 'Lumbini Lions', short: 'LUM', p: 4, w: 3, l: 1, nr: 0, nrr: '+1.526', pts: 6 },
    { rank: 2, name: 'Kathmandu Gurkhas', short: 'KTG', p: 4, w: 3, l: 1, nr: 0, nrr: '+1.341', pts: 6 },
    { rank: 3, name: 'Sudurpaschim Royals', short: 'SUR', p: 5, w: 3, l: 2, nr: 0, nrr: '-0.036', pts: 6 },
    { rank: 4, name: 'Chitwan Rhinos', short: 'CHR', p: 3, w: 2, l: 1, nr: 0, nrr: '+0.207', pts: 4 },
    { rank: 5, name: 'Janakpur Bolts', short: 'JAN', p: 5, w: 2, l: 3, nr: 0, nrr: '-0.083', pts: 4 },
    { rank: 6, name: 'Karnali Yaks', short: 'KAR', p: 4, w: 2, l: 2, nr: 0, nrr: '-0.320', pts: 4 },
    { rank: 7, name: 'Biratnagar Kings', short: 'BIR', p: 5, w: 2, l: 3, nr: 0, nrr: '-0.820', pts: 4 },
    { rank: 8, name: 'Pokhara Avengers', short: 'POK', p: 4, w: 0, l: 4, nr: 0, nrr: '-1.959', pts: 0 },
  ]);

  // Upcoming NPL Matches
  const upcomingNplMatches = useMemo(() => {
    const now = Date.now();
    return NPL_FIXTURES_2026.filter((m) => m.timestamp > now).slice(0, 5);
  }, []);

  const categoryLabel = match.category || 'Sports';

  return (
    <div className="space-y-4 sm:space-y-6 w-full max-w-full overflow-hidden">
      {/* Toast notifications for hotkeys and auto-failover */}
      {failoverToast && (
        <div className="animate-fade-in fixed top-20 right-6 z-50 flex items-center gap-2 rounded-lg border border-line bg-ink-800 px-4 py-2 text-sm text-fg shadow-float">
          <span>{failoverToast}</span>
        </div>
      )}

      {shortcutToast && (
        <div className="fixed bottom-6 right-6 z-50 rounded-lg border border-line bg-ink-800 px-4 py-2 text-sm text-fg shadow-float">
          {shortcutToast}
        </div>
      )}

      {/* Main Player Frame Container - compact default web size (can be fullscreened anytime) */}
      <div
        ref={playerContainerRef}
        className={`sportivo-player-container mx-auto w-full overflow-hidden ${
          isFullscreen
            ? 'fixed inset-0 z-50 h-screen w-screen max-w-none rounded-none border-0 bg-black flex flex-col justify-center'
            : 'max-w-2xl lg:max-w-3xl rounded-2xl border border-line bg-ink-800'
        }`}
      >
        {/* Player Top Navigation & Live Telemetry Bar - completely hidden in fullscreen mode */}
        {!isFullscreen && (
          <div className="player-top-bar flex items-center justify-between gap-2 border-b border-line bg-ink-950 p-2.5 sm:p-4 overflow-hidden">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 sm:gap-3 overflow-hidden">
                {isLive ? (
                  <span className="live-tag text-xs sm:text-sm shrink-0">
                    <span className="live-dot"></span>
                    Live
                  </span>
                ) : (
                  <span className="meta shrink-0 text-xs">{status === 'Final' ? 'Final' : 'Scheduled'}</span>
                )}
                <h2 className="text-xs sm:text-base font-medium text-fg truncate">{title}</h2>
              </div>

              {sources.length > 1 && (
                <div className="mt-1.5 flex items-center gap-1 overflow-x-auto no-scrollbar">
                  <span className="meta mr-1 shrink-0 text-xs">Servers</span>
                  {sources.map((_s, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleSourceChange(idx)}
                      className={`chip shrink-0 text-xs ${selectedSourceIndex === idx ? 'chip-active' : ''}`}
                    >
                      Server <span className="clock">{idx + 1}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              {/* Live Edge Sync Button */}
              <button
                type="button"
                onClick={jumpToLiveEdge}
                className="btn btn-secondary btn-sm text-xs"
                title="Press 'L' key to jump directly to live broadcast edge"
              >
                {isLive && <span className="live-dot"></span>}
                <span className="hidden sm:inline">Live edge</span>
                <span className="sm:hidden">Live</span>
              </button>

              {/* Keyboard Shortcuts Guide Pill */}
              <div
                className="hidden h-9 items-center gap-1 rounded-lg border border-line bg-ink-800 px-2 lg:flex"
                title="Hotkeys: Space (Play/Pause), M (Mute), F (Fullscreen), L (Live Edge), N (Alerts)"
              >
                <span className="clock rounded-md bg-ink-700 px-1 text-xs text-fg-2">Space</span>
                <span className="clock rounded-md bg-ink-700 px-1 text-xs text-fg-2">M</span>
                <span className="clock rounded-md bg-ink-700 px-1 text-xs text-fg-2">F</span>
                <span className="clock rounded-md bg-ink-700 px-1 text-xs text-fg-2">L</span>
                <span className="clock rounded-md bg-ink-700 px-1 text-xs text-fg-2">N</span>
              </div>

              {/* Fullscreen Button */}
              <button
                type="button"
                onClick={toggleFullscreen}
                className="icon-btn"
                title={isFullscreen ? 'Exit fullscreen (F)' : 'Enter fullscreen (F)'}
                aria-label={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
              >
                <svg
                  className="icon"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  {isFullscreen ? (
                    <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"></path>
                  ) : (
                    <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"></path>
                  )}
                </svg>
              </button>

              <a href="../" className="btn btn-ghost">
                <svg
                  className="icon"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M19 12H5"></path>
                  <path d="M12 19l-7-7 7-7"></path>
                </svg>
                <span>Fixtures</span>
              </a>
            </div>
          </div>
        )}

        {/* Video / Player Display Area */}
        <div
          className={`player-display-area relative group flex items-center justify-center overflow-hidden bg-black ${
            isFullscreen ? 'h-full w-full' : 'aspect-video'
          }`}
        >
          {isFullscreen && (
            <button
              type="button"
              onClick={toggleFullscreen}
              className="icon-btn absolute top-4 right-4 z-50 border-line-strong bg-ink-950/80 text-fg opacity-0 backdrop-blur-sm transition-opacity duration-fast ease-out group-hover:opacity-100 focus:opacity-100"
              title="Exit fullscreen (F or Esc)"
              aria-label="Exit Fullscreen"
            >
              <svg
                className="icon"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"></path>
              </svg>
            </button>
          )}
          {/* STATE 1: IDLE */}
          {playerState === 'idle' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center overflow-hidden bg-ink-950 px-6 text-center">
              {match.poster && (
                <>
                  <img
                    src={getSafeThumbnailUrl(match.poster)}
                    alt=""
                    width="800"
                    height="450"
                    referrerPolicy="strict-origin-when-cross-origin"
                    className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-25"
                    onError={(e) => {
                      (e.currentTarget as HTMLElement).style.display = 'none';
                    }}
                  />
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-ink-950 via-ink-950/80 to-ink-950/50"></div>
                </>
              )}

              <div className="relative z-10 mb-6 max-w-lg">
                <span className="eyebrow capitalize">{league || categoryLabel}</span>

                <h3 className="mt-2 text-xl font-medium text-fg sm:text-2xl">{title}</h3>
                <p className="mt-2 text-sm text-fg-2">
                  {status === 'Final' ? (
                    'Full time'
                  ) : isLive ? (
                    'Live now'
                  ) : (
                    <>
                      Kickoff <span className="clock">{timeOf(match, 'Asia/Kathmandu')} NST</span>
                    </>
                  )}
                </p>
              </div>

              {status === 'Final' ? (
                <div className="relative z-10 flex max-w-md flex-col items-center rounded-2xl border border-line bg-ink-950/80 p-5 text-center backdrop-blur-sm">
                  <span className="meta">Match Concluded · Full Time</span>
                  {(match as any)?.score ? (
                    <div className="mt-3 flex items-center justify-center gap-4">
                      <span className="clock text-lg font-medium text-fg">{(match as any).score.home || ''}</span>
                      <span className="text-fg-3">—</span>
                      <span className="clock text-lg font-medium text-fg">{(match as any).score.away || ''}</span>
                    </div>
                  ) : (
                    <p className="mt-2 text-base font-medium text-fg">Final result</p>
                  )}
                  {(match as any)?.summary ? (
                    <p className="mt-2 text-sm font-medium text-lime">{(match as any).summary}</p>
                  ) : (
                    <p className="mt-1 text-sm text-fg-2">This broadcast has ended. Official results are above.</p>
                  )}
                  <a href="/npl/" className="btn btn-secondary btn-sm mt-4">
                    View NPL Schedule &amp; Standings
                  </a>
                </div>
              ) : isLive || sources.length > 0 ? (
                <button
                  type="button"
                  onClick={() => resolvePlayback(true)}
                  aria-label={`Start broadcast stream for ${title}`}
                  className={`btn btn-lg relative z-10 ${isLive ? 'btn-live' : 'btn-primary'}`}
                >
                  <svg
                    className="icon"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polygon points="6 4 20 12 6 20 6 4"></polygon>
                  </svg>
                  <span>{isLive ? 'Watch live' : 'Watch stream'}</span>
                </button>
              ) : (
                <div className="relative z-10 flex max-w-md flex-col items-center rounded-2xl border border-line bg-ink-950/80 p-5 backdrop-blur-sm">
                  <span className="meta">Upcoming</span>

                  <p className="clock mt-2 text-lg text-fg">
                    {timeOf(match, 'Asia/Kathmandu')} NST
                  </p>
                  {ts && <p className="clock mt-1 text-sm text-fg-2">{formatCountdown(ts)}</p>}

                  <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                    <button type="button" onClick={toggleFavorite} className="btn btn-sm btn-secondary">
                      <svg
                        className={`icon ${isFavorite ? 'text-lime' : ''}`}
                        viewBox="0 0 24 24"
                        fill={isFavorite ? 'currentColor' : 'none'}
                        stroke="currentColor"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
                      </svg>
                      <span>{isFavorite ? 'In watchlist' : 'Add to watchlist'}</span>
                    </button>
                    <a
                      href={generateGoogleCalendarUrl(match, title, league)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-sm btn-secondary"
                    >
                      <svg
                        className="icon"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                        <line x1="16" y1="2" x2="16" y2="6"></line>
                        <line x1="8" y1="2" x2="8" y2="6"></line>
                        <line x1="3" y1="10" x2="21" y2="10"></line>
                      </svg>
                      <span>Google Calendar</span>
                    </a>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STATE 2: RESOLVING */}
          {playerState === 'resolving' && (
            <div className="flex flex-col items-center gap-4 px-6 text-center" aria-live="polite">
              <span className="h-10 w-10 animate-spin rounded-full border-2 border-lime border-t-transparent"></span>
              <div>
                <p className="text-sm font-medium text-fg">Connecting to the stream</p>
                <p className="mt-1 text-sm text-fg-3">Finding the direct broadcast feed</p>
              </div>
            </div>
          )}

          {/* STATE 3: ERROR / RETRY */}
          {(playerState === 'failed' || playerState === 'unavailable' || playerState === 'unsupported') && (
            <div className="max-w-md px-6 text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl border border-line bg-ink-800 text-fg-2">
                <svg
                  className="icon"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="12" y1="8" x2="12" y2="12"></line>
                  <line x1="12" y1="16" x2="12.01" y2="16"></line>
                </svg>
              </div>
              <p className="text-sm text-fg">{errorMessage}</p>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                <button type="button" onClick={resolvePlayback} className="btn btn-primary">
                  Reconnect
                </button>
              </div>
            </div>
          )}

          {/* STATE 4: READY & PLAYING */}
          {(playerState === 'ready' || playerState === 'playing') && activeStream && (
            <>
              {activeStream.isNativeVideo ? (
                <video
                  ref={(el) => {
                    (videoRef as any).current = el;
                    setVideoEl(el);
                  }}
                  controls
                  autoPlay
                  playsInline
                  className="h-full w-full bg-black"
                ></video>
              ) : (
                <iframe
                  src={activeStream.embedUrl}
                  className="h-full w-full border-0"
                  allowFullScreen
                  allow="autoplay; fullscreen; picture-in-picture; encrypted-media; clipboard-write; display-capture"
                  referrerPolicy="no-referrer-when-downgrade"
                  title={`${title} live stream`}
                  onLoad={() => setPlayerState('playing')}
                ></iframe>
              )}
            </>
          )}
        </div>

        {/* Server Selection & Latency Toolbar - hidden in fullscreen mode */}
        {streams.length > 0 && !isFullscreen && (
          <div className="player-server-bar flex items-center gap-1.5 border-t border-line bg-ink-950 p-2 sm:p-3 overflow-x-auto no-scrollbar">
            <span className="meta mr-1 shrink-0 text-xs">Servers</span>
            {streams.map((stream, index) => (
              <button
                key={index}
                type="button"
                onClick={() => handleServerSelect(stream)}
                className={`chip shrink-0 text-xs ${activeStream === stream ? 'chip-active' : ''}`}
              >
                Server <span className="clock">{index + 1}</span>
                {stream.hd && <span className="chip-count">HD</span>}
              </button>
            ))}

            <button
              type="button"
              onClick={jumpToLiveEdge}
              className="btn btn-sm btn-secondary ml-auto shrink-0 text-xs"
              title="Sync playback directly to live broadcast edge"
            >
              {isLive && <span className="live-dot"></span>}
              <span className="hidden sm:inline">Live edge</span>
              <span className="sm:hidden">Live</span>
            </button>
          </div>
        )}
      </div>

      {/* Real-time Match Telemetry Bar & Commentary Hub - strictly displayed in NPL Live section only */}
      {showNplHub && isNplMatch && (
        <>
          {/* Dedicated Broadcast Cricket Telemetry Scoreboard */}
          {(() => {
            const matchNumber = liveHeader?.matchNumber || '19';
            const matchTitle = liveHeader?.matchTitle || `Match ${matchNumber} • NPL 2026`;
            const venue = liveHeader?.venue || 'TU International Cricket Ground, Kirtipur';
            const tossNote = liveHeader?.tossNote || 'PKA opt to Bat';

            // Dynamic team names & short codes based on ongoing live match
            const t1Name = liveHeader?.team1Name || match.teams?.home?.name || 'Pokhara Avengers';
            const t1Short =
              liveHeader?.team1Short ||
              (match.teams?.home?.name ? match.teams.home.name.slice(0, 3).toUpperCase() : 'PKA');
            const t1Score = liveHeader?.team1Score || liveScore || '179/2';
            const t1Overs = liveHeader?.team1Overs || (liveOvers ? `(${liveOvers} ov)` : '');
            const t1IsBatting = liveHeader ? liveHeader.activeTeam === 1 : true;

            const t2Name = liveHeader?.team2Name || match.teams?.away?.name || 'Karnali Yaks';
            const t2Short =
              liveHeader?.team2Short ||
              (match.teams?.away?.name ? match.teams.away.name.slice(0, 3).toUpperCase() : 'KNY');
            const t2Score = liveHeader?.team2Score || (match.score?.away || 'Yet to Bat');
            const t2Overs = liveHeader?.team2Overs || '';
            const t2IsBatting = liveHeader ? liveHeader.activeTeam === 2 : false;

            const displayTarget = liveTarget || liveHeader?.target || '';
            const displayCrr = liveCrr || liveHeader?.crr || '';
            const displayRrr =
              liveRrr && liveRrr !== '--'
                ? liveRrr
                : liveHeader?.rrr && liveHeader.rrr !== '--'
                ? liveHeader.rrr
                : '';

            const activeBatters = liveBatters || [];
            const activeBowler = liveBowler;
            const displayRecent =
              recentBalls && recentBalls.length > 0 ? recentBalls.slice(-8) : [];

            return (
              <div className="card p-3 sm:p-5 shadow-panel w-full max-w-full overflow-hidden">
                {/* Top Match Header Bar */}
                <div className="flex items-center justify-between gap-2 border-b border-line pb-2.5 sm:pb-3 overflow-hidden">
                  <div className="flex min-w-0 items-center gap-1.5 text-xs sm:text-sm overflow-hidden">
                    <span className="live-dot shrink-0" />
                    <span className="font-semibold text-fg shrink-0">{matchTitle}</span>
                    <span className="text-fg-3 hidden sm:inline">|</span>
                    <span className="truncate text-fg-2 text-xs sm:text-sm">{venue}</span>
                  </div>
                  {tossNote && (
                    <span className="chip text-[11px] sm:text-xs shrink-0 py-0.5 px-2 max-w-[130px] truncate">
                      {tossNote}
                    </span>
                  )}
                </div>

                {/* Mobile View (< sm): High-Density 2-Row Match Scoreboard */}
                <div className="sm:hidden py-3 space-y-2.5">
                  {/* Row 1: Team 1 */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="rounded bg-ink-700 border border-line px-1.5 py-0.5 font-mono text-[11px] font-semibold text-fg shrink-0">
                        {t1Short}
                      </span>
                      <span className="truncate text-sm font-semibold text-fg">
                        {t1Name}
                      </span>
                      {t1IsBatting && (
                        <span className="live-dot shrink-0" title="Currently Batting" />
                      )}
                    </div>
                    <div className="flex items-baseline gap-1.5 shrink-0">
                      <span className="font-mono text-xl font-bold tracking-tight text-fg">
                        {t1Score}
                      </span>
                      {t1Overs && (
                        <span className="font-mono text-xs text-fg-3">
                          {t1Overs.startsWith('(') ? t1Overs : `(${t1Overs})`}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Row 2: Team 2 */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="rounded bg-ink-700 border border-line px-1.5 py-0.5 font-mono text-[11px] font-semibold text-fg shrink-0">
                        {t2Short}
                      </span>
                      <span className="truncate text-sm font-semibold text-fg">
                        {t2Name}
                      </span>
                      {t2IsBatting && (
                        <span className="live-dot shrink-0" title="Currently Batting" />
                      )}
                    </div>
                    <div className="flex items-baseline gap-1.5 shrink-0">
                      <span
                        className={`font-mono text-xl font-bold tracking-tight ${
                          t2Score === 'Yet to Bat' ? 'text-fg-3 text-sm' : 'text-fg'
                        }`}
                      >
                        {t2Score}
                      </span>
                      {t2Overs && (
                        <span className="font-mono text-xs text-fg-3">
                          {t2Overs.startsWith('(') ? t2Overs : `(${t2Overs})`}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Mobile Match Meta Strip: Target / CRR / RRR */}
                  <div className="flex flex-wrap items-center justify-between gap-1.5 pt-1 text-xs border-t border-line/40">
                    <div className="flex items-center gap-1.5">
                      {displayTarget ? (
                        <span className="chip text-[11px] text-lime border-lime/30 py-0.5 px-2">
                          {displayTarget}
                        </span>
                      ) : (
                        <span className="text-[11px] font-mono text-fg-3">
                          Innings 1
                        </span>
                      )}
                    </div>
                    {(displayCrr || displayRrr) && (
                      <div className="flex items-center gap-1.5">
                        {displayCrr && (
                          <span className="chip text-[11px] font-mono py-0.5 px-2">
                            CRR: {displayCrr}
                          </span>
                        )}
                        {displayRrr && (
                          <span className="chip text-[11px] font-mono text-lime border-lime/30 py-0.5 px-2">
                            RRR: {displayRrr}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Desktop View (>= sm): Broadcast 3-Column Scoreboard */}
                <div className="hidden sm:grid sm:grid-cols-[1fr_auto_1fr] sm:items-center gap-4 py-4">
                  {/* Team 1 (Left) */}
                  <div className="flex flex-col">
                    <div className="flex items-center gap-2">
                      <span className="rounded bg-ink-700 border border-line px-2 py-0.5 font-mono text-xs font-semibold text-fg">
                        {t1Short}
                      </span>
                      <span className="text-sm sm:text-base font-semibold text-fg">
                        {t1Name}
                      </span>
                      {t1IsBatting && (
                        <span className="live-dot" title="Currently Batting" />
                      )}
                    </div>
                    <div className="mt-1.5 flex items-baseline gap-2">
                      <span className="font-mono text-2xl sm:text-3xl font-bold tracking-tight text-fg">
                        {t1Score}
                      </span>
                      {t1Overs && (
                        <span className="font-mono text-xs sm:text-sm text-fg-3">
                          {t1Overs.startsWith('(') ? t1Overs : `(${t1Overs})`}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Center: VS & Target */}
                  <div className="flex flex-col items-center justify-center gap-1.5">
                    <span className="text-xs font-bold uppercase tracking-wider text-fg-3">
                      VS
                    </span>
                    {displayTarget ? (
                      <span className="chip text-xs text-lime border-lime/30">
                        {displayTarget}
                      </span>
                    ) : (
                      <span className="text-[11px] font-mono text-fg-3">
                        Innings 1
                      </span>
                    )}
                  </div>

                  {/* Team 2 (Right) */}
                  <div className="flex flex-col items-end text-right">
                    <div className="flex items-center gap-2 flex-row-reverse">
                      {t2IsBatting && (
                        <span className="live-dot" title="Currently Batting" />
                      )}
                      <span className="text-sm sm:text-base font-semibold text-fg">
                        {t2Name}
                      </span>
                      <span className="rounded bg-ink-700 border border-line px-2 py-0.5 font-mono text-xs font-semibold text-fg">
                        {t2Short}
                      </span>
                    </div>
                    <div className="mt-1.5 flex items-baseline gap-2 flex-row-reverse">
                      <span
                        className={`font-mono text-2xl sm:text-3xl font-bold tracking-tight ${
                          t2Score === 'Yet to Bat' ? 'text-fg-3 text-lg sm:text-xl' : 'text-fg'
                        }`}
                      >
                        {t2Score}
                      </span>
                      {t2Overs && (
                        <span className="font-mono text-xs sm:text-sm text-fg-3">
                          {t2Overs.startsWith('(') ? t2Overs : `(${t2Overs})`}
                        </span>
                      )}
                    </div>
                    {/* Telemetry CRR & RRR badges */}
                    {(displayCrr || displayRrr) && (
                      <div className="mt-1.5 flex items-center gap-1.5 justify-end">
                        {displayCrr && (
                          <span className="chip text-[11px] font-mono">
                            CRR: {displayCrr}
                          </span>
                        )}
                        {displayRrr && (
                          <span className="chip text-[11px] font-mono text-lime border-lime/30">
                            RRR: {displayRrr}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Batters & Active Bowler Row */}
                {(activeBatters.length > 0 || activeBowler?.name) && (
                  <div className="mt-2 grid grid-cols-1 gap-3 border-t border-line pt-3 sm:gap-6 sm:pt-4 md:grid-cols-2">
                    {/* Batters */}
                    <div>
                      <div className="eyebrow mb-1.5 text-[11px] sm:text-xs">
                        Batters
                      </div>
                      <div className="space-y-1 sm:space-y-1.5">
                        {activeBatters.slice(0, 2).map((bat, idx) => (
                          <div key={idx} className="flex items-center justify-between text-xs sm:text-sm">
                            <span className="flex min-w-0 items-center gap-1 font-semibold text-fg truncate">
                              <span className="truncate">{bat.name}</span>
                              {bat.isOnStrike && <span className="text-lime font-bold shrink-0">*</span>}
                            </span>
                            <span className="font-mono text-fg-2 shrink-0 ml-2">
                              <span className="font-bold text-fg">{bat.runs}</span>{' '}
                              <span className="text-[11px] sm:text-xs text-fg-3">
                                ({bat.balls}b{bat.fours ? `, ${bat.fours}x4` : ''}{bat.sixes ? `, ${bat.sixes}x6` : ''})
                              </span>
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Active Bowler */}
                    {activeBowler?.name && (
                      <div>
                        <div className="eyebrow mb-1.5 text-[11px] sm:text-xs">
                          Active Bowler
                        </div>
                        <div className="flex items-center justify-between text-xs sm:text-sm">
                          <span className="font-semibold text-fg truncate mr-2">
                            {activeBowler.name}
                          </span>
                          <span className="font-mono text-xs sm:text-base font-bold text-fg shrink-0">
                            {activeBowler.figures}
                            {activeBowler.overs && (
                              <span className="ml-1 text-[11px] sm:text-xs text-fg-3 font-normal">
                                ({activeBowler.overs})
                              </span>
                            )}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Recent Deliveries Bar */}
                {displayRecent.length > 0 && (
                  <div className="mt-3 flex items-center gap-2 border-t border-line pt-2.5 overflow-hidden">
                    <span className="eyebrow shrink-0 text-[11px] sm:text-xs">
                      Recent
                    </span>
                    <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
                      {displayRecent.map((b, idx) => {
                        const code = (b.code || '').trim();
                        const lowerCode = code.toLowerCase();
                        const isSix = lowerCode === '6';
                        const isFour = lowerCode === '4';
                        const isWkt =
                          lowerCode === 'w' || (lowerCode.includes('w') && !lowerCode.includes('wd'));
                        const isExtra = lowerCode.includes('wd') || lowerCode.includes('nb');
                        const isDot = lowerCode === '0';

                        return (
                          <span
                            key={idx}
                            className={`flex h-6 w-6 sm:h-7 sm:w-7 shrink-0 items-center justify-center rounded-md font-mono text-[11px] sm:text-xs font-semibold ${
                              isSix
                                ? 'bg-lime text-lime-ink font-bold shadow-sm'
                                : isFour
                                ? 'border border-line-strong bg-ink-600 text-fg font-semibold'
                                : isWkt
                                ? 'bg-red-500 text-white font-bold animate-pulse'
                                : isExtra
                                ? 'border border-amber-500/40 bg-amber-500/20 text-amber-400 font-semibold'
                                : isDot
                                ? 'bg-ink-700/60 text-fg-3'
                                : 'bg-ink-700 text-fg'
                            }`}
                            title={`Delivery: ${code}`}
                          >
                            {code}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })()}

          {/* Interactive Match Hub: Tabs for Commentary, Upcoming Fixtures & Points Table */}
          <div className="card overflow-hidden w-full max-w-full">
            {/* Hub Tabs Header */}
            <div className="flex items-center gap-1.5 border-b border-line bg-ink-950 p-2 overflow-x-auto no-scrollbar">
              <button
                type="button"
                onClick={() => setActiveHubTab('commentary')}
                className={`chip shrink-0 text-xs ${activeHubTab === 'commentary' ? 'chip-active' : ''}`}
              >
                <span>Commentary</span>
                {commentaryList.length > 0 && <span className="chip-count">{commentaryList.length}</span>}
              </button>

              <button
                type="button"
                onClick={() => setActiveHubTab('upcoming')}
                className={`chip shrink-0 text-xs ${activeHubTab === 'upcoming' ? 'chip-active' : ''}`}
              >
                <span>Upcoming</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveHubTab('standings')}
                className={`chip shrink-0 text-xs ${activeHubTab === 'standings' ? 'chip-active' : ''}`}
              >
                <span>Points table</span>
              </button>
            </div>

            {/* Tab 1: Live Ball-by-Ball Commentary Drawer */}
            {activeHubTab === 'commentary' && (
              <div className="max-h-96 overflow-y-auto">
                {commentaryList.length === 0 ? (
                  <div className="py-8 text-center text-sm text-fg-3">
                    <p>Waiting for the ground scorer</p>
                    <p className="mt-1">Commentary updates on every delivery</p>
                  </div>
                ) : (
                  commentaryList.map((comm, idx) => (
                    <div key={idx} className="row items-start gap-4">
                      <div className="flex w-12 shrink-0 flex-col items-center">
                        <span className="clock w-full rounded-md bg-ink-700 px-2 py-1 text-center text-xs text-fg">
                          {comm.ball}
                        </span>
                        {comm.outcome && (
                          <span
                            className={`clock mt-1 rounded-md px-2 py-1 text-xs ${
                              comm.outcome === '6'
                                ? 'bg-lime text-lime-ink'
                                : comm.outcome === '4'
                                ? 'bg-ink-600 text-fg'
                                : comm.outcome === 'W'
                                ? 'bg-fg text-ink-900'
                                : 'bg-ink-700 text-fg-2'
                            }`}
                          >
                            {comm.outcome}
                          </span>
                        )}
                      </div>

                      <div className="flex-1 min-w-0 overflow-hidden break-words">
                        <p className="text-xs sm:text-sm text-fg-2 truncate">{cleanCricketText(comm.bowlerToBatsman)}</p>
                        <p className="mt-0.5 sm:mt-1 text-xs sm:text-sm leading-relaxed text-fg break-words">{cleanCricketText(comm.text)}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Tab 2: Upcoming NPL Matches with Countdown */}
            {activeHubTab === 'upcoming' && (
              <div className="p-5">
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  {upcomingNplMatches.map((m) => (
                    <div
                      key={m.id}
                      className="flex flex-col justify-between rounded-lg border border-line bg-ink-900 p-4 transition-colors duration-fast ease-out hover:border-line-strong"
                    >
                      <div className="flex items-center justify-between">
                        <span className="clock meta">Match {m.matchNumber}</span>
                        <span className="clock text-xs text-fg-2">{formatCountdown(m.timestamp)}</span>
                      </div>

                      <div className="my-3 flex items-center justify-between gap-2">
                        <div className="flex min-w-0 items-center gap-2">
                          <img src={m.homeTeamLogo} alt="" className="h-5 w-5 sm:h-6 sm:w-6 object-contain shrink-0" />
                          <span className="text-xs sm:text-sm font-medium text-fg truncate">{m.homeTeam}</span>
                        </div>
                        <span className="meta shrink-0">v</span>
                        <div className="flex min-w-0 items-center gap-2 justify-end">
                          <span className="text-xs sm:text-sm font-medium text-fg truncate">{m.awayTeam}</span>
                          <img src={m.awayTeamLogo} alt="" className="h-5 w-5 sm:h-6 sm:w-6 object-contain shrink-0" />
                        </div>
                      </div>

                      <div className="flex items-center justify-between border-t border-line pt-2">
                        <span className="clock meta">{timeOf(match, 'Asia/Kathmandu')} NST</span>
                        <a
                          href={`/cricket/match/${slugify(`${m.homeTeam} vs ${m.awayTeam}`)}/`}
                          className="inline-flex items-center gap-1 text-xs text-lime hover:underline"
                        >
                          <span>Match centre</span>
                          <svg
                            className="icon"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <path d="M5 12h14"></path>
                            <path d="M12 5l7 7-7 7"></path>
                          </svg>
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Tab 3: Points Table */}
            {activeHubTab === 'standings' && (
              <div className="w-full max-w-full overflow-hidden p-3 sm:p-5">
                <div className="mb-2 sm:mb-3 flex items-center justify-between">
                  <span className="eyebrow text-xs sm:text-sm">NPL 2026 Standings</span>
                  <span className="text-[11px] sm:text-xs font-mono text-fg-3">Top 4 qualify</span>
                </div>
                <div className="w-full max-w-full overflow-x-auto no-scrollbar">
                  <table className="w-full text-left text-xs sm:text-sm">
                    <thead>
                      <tr className="meta border-b border-line text-[11px] sm:text-xs">
                        <th className="h-8 sm:h-9 px-1.5 sm:px-3 font-normal">#</th>
                        <th className="h-8 sm:h-9 px-1.5 sm:px-3 font-normal">Team</th>
                        <th className="h-8 sm:h-9 px-1.5 sm:px-3 text-right font-normal">P</th>
                        <th className="h-8 sm:h-9 px-1.5 sm:px-3 text-right font-normal">W</th>
                        <th className="h-8 sm:h-9 px-1.5 sm:px-3 text-right font-normal hidden sm:table-cell">L</th>
                        <th className="h-8 sm:h-9 px-1.5 sm:px-3 text-right font-normal hidden sm:table-cell">NR</th>
                        <th className="h-8 sm:h-9 px-1.5 sm:px-3 text-right font-normal">Pts</th>
                        <th className="h-8 sm:h-9 px-1.5 sm:px-3 text-right font-normal">NRR</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {nplStandings.map((team, idx) => (
                        <tr
                          key={team.name}
                          className={`transition-colors duration-fast ease-out hover:bg-ink-700/60 ${
                            idx < 4 ? 'bg-ink-800/40' : ''
                          }`}
                        >
                          <td className="clock h-8 sm:h-10 px-1.5 sm:px-3 text-[11px] sm:text-xs text-fg-3">
                            <div className="flex items-center gap-1">
                              {idx < 4 && <span className="h-1.5 w-1.5 rounded-full bg-lime shrink-0" />}
                              <span>{team.rank || idx + 1}</span>
                            </div>
                          </td>
                          <td className="h-8 sm:h-10 px-1.5 sm:px-3 min-w-0">
                            <div className="flex items-center gap-1.5 sm:gap-2">
                              {(team.logo || NPL_TEAMS[team.name]?.logo) && (
                                <img
                                  src={team.logo || NPL_TEAMS[team.name]?.logo}
                                  alt=""
                                  className="h-4 w-4 sm:h-5 sm:w-5 object-contain shrink-0"
                                />
                              )}
                              <span className="font-medium text-fg truncate text-xs sm:text-sm">
                                <span className="sm:hidden">{team.short || team.name.slice(0, 3).toUpperCase()}</span>
                                <span className="hidden sm:inline">{team.name}</span>
                              </span>
                            </div>
                          </td>
                          <td className="clock h-8 sm:h-10 px-1.5 sm:px-3 text-right text-fg-2">{team.p}</td>
                          <td className="clock h-8 sm:h-10 px-1.5 sm:px-3 text-right font-medium text-lime">{team.w}</td>
                          <td className="clock h-8 sm:h-10 px-1.5 sm:px-3 text-right text-fg-3 hidden sm:table-cell">{team.l}</td>
                          <td className="clock h-8 sm:h-10 px-1.5 sm:px-3 text-right text-fg-3 hidden sm:table-cell">{team.nr ?? 0}</td>
                          <td className="clock h-8 sm:h-10 px-1.5 sm:px-3 text-right font-bold text-lime">{team.pts}</td>
                          <td
                            className={`clock h-8 sm:h-10 px-1.5 sm:px-3 text-right font-mono text-[11px] sm:text-xs ${
                              String(team.nrr).startsWith('+') ? 'text-lime' : 'text-fg-3'
                            }`}
                          >
                            {team.nrr}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* Match Tools & Action Panel */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="card p-5 lg:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4">
            <div>
              <span className="eyebrow">Match details</span>
              <h3 className="mt-1 text-lg font-medium text-fg">{title}</h3>
            </div>

            {ts && (
              <span suppressHydrationWarning className="clock text-sm text-fg-2">
                {formatCountdown(ts)}
              </span>
            )}
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-lg border border-line bg-ink-900 p-3">
              <span className="meta">Kickoff</span>
              <p className="clock mt-1 text-sm text-fg">{timeOf(match, 'Asia/Kathmandu')} NST</p>
            </div>

            <div className="rounded-lg border border-line bg-ink-900 p-3">
              <span className="meta">Local time</span>
              <p className="clock mt-1 text-sm text-fg-2">{timeOf(match, localTz)}</p>
            </div>

            <div className="rounded-lg border border-line bg-ink-900 p-3">
              <span className="meta">Competition</span>
              <p className="mt-1 text-sm capitalize text-fg">{league || categoryLabel}</p>
            </div>
          </div>

          <p className="mt-4 text-sm leading-relaxed text-fg-3">
            If the picture pauses, switch servers above or press{' '}
            <kbd className="clock rounded-md bg-ink-700 px-1 text-xs text-fg">L</kbd> to jump to the live edge.
          </p>
        </div>

        {/* Action Buttons & Calendar Integration */}
        <div className="card flex flex-col justify-between p-5">
          <div>
            <span className="eyebrow">Match tools</span>
            <h4 className="mt-1 text-sm font-medium text-fg">Save and remind</h4>

            <div className="mt-4 space-y-2">
              <button type="button" onClick={toggleFavorite} className="btn btn-secondary w-full">
                <svg
                  className={`icon ${isFavorite ? 'text-lime' : ''}`}
                  viewBox="0 0 24 24"
                  fill={isFavorite ? 'currentColor' : 'none'}
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
                </svg>
                <span>{isFavorite ? 'In watchlist' : 'Add to watchlist'}</span>
              </button>

              {ts && (
                <a
                  href={generateGoogleCalendarUrl(match)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-secondary w-full"
                >
                  <svg
                    className="icon"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                    <line x1="16" y1="2" x2="16" y2="6"></line>
                    <line x1="8" y1="2" x2="8" y2="6"></line>
                    <line x1="3" y1="10" x2="21" y2="10"></line>
                  </svg>
                  <span>Google Calendar</span>
                </a>
              )}

              {ts && (
                <button type="button" onClick={handleDownloadIcs} className="btn btn-secondary w-full">
                  <svg
                    className="icon"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                    <polyline points="7 10 12 15 17 10"></polyline>
                    <line x1="12" y1="15" x2="12" y2="3"></line>
                  </svg>
                  <span>Download .ics</span>
                </button>
              )}

              <button type="button" onClick={handleShare} className="btn btn-secondary w-full">
                {copiedToast ? (
                  <svg
                    className="icon"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                ) : (
                  <svg
                    className="icon"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
                    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
                  </svg>
                )}
                <span>{copiedToast ? 'Link copied' : 'Share match'}</span>
              </button>
            </div>
          </div>

          <div className="meta mt-4 border-t border-line pt-3">Direct broadcast streams, no proxy</div>
        </div>
      </div>
    </div>
  );
}
