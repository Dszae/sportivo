import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
  Share,
  Platform,
  StatusBar,
  BackHandler,
  Linking,
} from 'react-native';
import { Video, ResizeMode, AVPlaybackStatus, VideoFullscreenUpdate } from 'expo-av';
import * as ScreenOrientation from 'expo-screen-orientation';
import { WebView } from 'react-native-webview';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ArrowBackIcon,
  ShareIcon,
  AlertCircleIcon,
  RefreshIcon,
  LocationIcon,
  BookmarkIcon,
  RadioIcon,
  MaximizeIcon,
  MinimizeIcon,
} from '../components/Icons';
import { Match, RootStackParamList, StreamSource, NplMatch } from '../types';
import { toggleStarredMatch } from '../services/storage';
import { triggerButtonHaptic, setPlayerScreenActive } from '../services/notifications';
import {
  resolveMatchStreams,
  fetchLiveDeskMoments,
  LiveScorerMobile,
  fetchNplFixtures,
  fetchNplStandings,
  formatKathmanduTime,
  cleanCricketText,
} from '../services/api';

type RouteProps = RouteProp<RootStackParamList, 'MatchPlayer'>;

const { width } = Dimensions.get('window');

const NPL_STANDINGS_DEFAULT = [
  { rank: 1, name: 'Lumbini Lions', short: 'LUM', p: 4, w: 3, l: 1, nr: 0, nrr: '+1.526', pts: 6 },
  { rank: 2, name: 'Kathmandu Gurkhas', short: 'KTG', p: 4, w: 3, l: 1, nr: 0, nrr: '+1.341', pts: 6 },
  { rank: 3, name: 'Sudurpaschim Royals', short: 'SUR', p: 5, w: 3, l: 2, nr: 0, nrr: '-0.036', pts: 6 },
  { rank: 4, name: 'Chitwan Rhinos', short: 'CHR', p: 3, w: 2, l: 1, nr: 0, nrr: '+0.207', pts: 4 },
  { rank: 5, name: 'Janakpur Bolts', short: 'JAN', p: 5, w: 2, l: 3, nr: 0, nrr: '-0.083', pts: 4 },
  { rank: 6, name: 'Karnali Yaks', short: 'KAR', p: 4, w: 2, l: 2, nr: 0, nrr: '-0.320', pts: 4 },
  { rank: 7, name: 'Biratnagar Kings', short: 'BIR', p: 5, w: 2, l: 3, nr: 0, nrr: '-0.820', pts: 4 },
  { rank: 8, name: 'Pokhara Avengers', short: 'POK', p: 4, w: 0, l: 4, nr: 0, nrr: '-1.959', pts: 0 },
];

export default function MatchPlayerScreen() {
  const route = useRoute<RouteProps>();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { match } = route.params;

  const topPadding = insets.top || (Platform.OS === 'android' ? (StatusBar.currentHeight || 0) : 0);

  const isNplMatch =
    match.category === 'cricket' &&
    ((match.competition && match.competition.toLowerCase().includes('nepal')) ||
      (match.league && match.league.toLowerCase().includes('npl')) ||
      (match.id && match.id.toLowerCase().includes('npl')) ||
      (match.title && match.title.toLowerCase().includes('npl')) ||
      (Array.isArray(match.sources) && match.sources.some((s) => s.source === 'npl')));

  const [streams, setStreams] = useState<StreamSource[]>(match.streams || []);
  const [selectedServer, setSelectedServer] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isBuffering, setIsBuffering] = useState(true);
  const [isStarred, setIsStarred] = useState(false);
  const [isResolving, setIsResolving] = useState(false);
  const [hasTimedOut, setHasTimedOut] = useState(false);

  // Hub tabs: 'commentary' | 'upcoming' | 'standings'
  const [activeHubTab, setActiveHubTab] = useState<'commentary' | 'upcoming' | 'standings'>('commentary');

  // Live Ground Scorer State
  const [liveDesk, setLiveDesk] = useState<LiveScorerMobile | null>(null);
  const [upcomingMatches, setUpcomingMatches] = useState<NplMatch[]>([]);
  const [standings, setStandings] = useState<any[]>(NPL_STANDINGS_DEFAULT);

  // Load live standings
  useEffect(() => {
    let isMounted = true;
    fetchNplStandings().then((data) => {
      if (isMounted && data && data.length > 0) {
        setStandings(data);
      }
    });
    return () => {
      isMounted = false;
    };
  }, []);

  const videoRef = useRef<Video>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Toggle horizontal landscape fullscreen
  const toggleFullscreen = async () => {
    try {
      if (!isFullscreen) {
        await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
        setIsFullscreen(true);
        StatusBar.setHidden(true, 'fade');
      } else {
        await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
        setIsFullscreen(false);
        StatusBar.setHidden(false, 'fade');
      }
    } catch (err) {
      console.warn('Orientation change error:', err);
    }
  };

  // Handle hardware back button in landscape mode
  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (isFullscreen) {
        toggleFullscreen();
        return true;
      }
      return false;
    });

    return () => {
      backHandler.remove();
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {});
      StatusBar.setHidden(false);
    };
  }, [isFullscreen]);

  // Mark player screen as active to silence intrusive notifications while watching
  useEffect(() => {
    setPlayerScreenActive(true);
    return () => {
      setPlayerScreenActive(false);
    };
  }, []);

  // Auto-resolve live streaming sources on screen open
  useEffect(() => {
    let isMounted = true;
    async function loadStreams() {
      setIsResolving(true);
      try {
        const resolved = await resolveMatchStreams(match);
        if (isMounted && resolved.length > 0) {
          setStreams(resolved);
        }
      } catch (e) {
        console.warn('Failed to resolve streams:', e);
      } finally {
        if (isMounted) setIsResolving(false);
      }
    }
    loadStreams();
    return () => {
      isMounted = false;
    };
  }, [match]);

  // Poll Ground Scorer Ball Commentary & Live Moments (every 4s) strictly for NPL matches
  useEffect(() => {
    if (!isNplMatch) return;

    let isMounted = true;
    let timer: any = null;

    const poll = async () => {
      try {
        const data = await fetchLiveDeskMoments();
        if (data && isMounted) {
          setLiveDesk(data);
        }
      } catch {}

      if (isMounted) {
        timer = setTimeout(poll, 4000);
      }
    };

    poll();

    // Fetch upcoming fixtures
    fetchNplFixtures().then((list) => {
      if (isMounted) {
        const now = Date.now();
        setUpcomingMatches(list.filter((m) => m.timestamp > now).slice(0, 5));
      }
    });

    return () => {
      isMounted = false;
      if (timer) clearTimeout(timer);
    };
  }, [isNplMatch]);

  // Buffering timeout safeguard
  useEffect(() => {
    setHasTimedOut(false);
    setIsBuffering(true);
    const dismissTimer = setTimeout(() => {
      setIsBuffering(false);
    }, 2500);
    const timeoutTimer = setTimeout(() => {
      setHasTimedOut(true);
    }, 6000);
    return () => {
      clearTimeout(dismissTimer);
      clearTimeout(timeoutTimer);
    };
  }, [selectedServer]);

  // Current active stream source
  const fallbackStream: StreamSource = {
    id: 'server-1',
    source: 'npl',
    label: 'Server 1 HD',
    embedUrl: 'https://yonotv.pages.dev/wtvplyrrr?manifest=https://a96aivottlinear-a.akamaihd.net/OTTB/iad-nitro/live/clients/dash/enc/8wxsmuwvra/out/v1/06f2368f16e8470b8593cb77dcad31fe/cenc.mpd&keyid=f638f10e9bee65a698926a527722e332&key=a9f519367caf419607f6705e3d767935',
    streamUrl: 'https://yonotv.pages.dev/wtvplyrrr?manifest=https://a96aivottlinear-a.akamaihd.net/OTTB/iad-nitro/live/clients/dash/enc/8wxsmuwvra/out/v1/06f2368f16e8470b8593cb77dcad31fe/cenc.mpd&keyid=f638f10e9bee65a698926a527722e332&key=a9f519367caf419607f6705e3d767935',
    isDirectStream: false,
    hd: true,
  };

  const activeStream = streams.length > 0 ? streams[selectedServer] || streams[0] : fallbackStream;

  const getWebViewSource = useCallback((stream: StreamSource) => {
    const rawUrl = (stream.embedUrl || stream.streamUrl || '').trim();
    if (!rawUrl) {
      return { html: '<body style="background:#000;"></body>' };
    }

    const cleanPath = rawUrl.split('?')[0].toLowerCase();
    const isRawMpd = cleanPath.endsWith('.mpd') && !rawUrl.includes('pages.dev') && !rawUrl.includes('plyrr');

    if (isRawMpd) {
      const activeLicense =
        stream.licenseUrl ||
        'https://widevine-dash.ezdrm.com/proxy?pX=196792&user_id=M2ZhNWI0YzAtNzgxNy00MjRlLWFlODMtZWFmYWJmNDRmMjU1&CustomData=eyJyZXNlbGxlcl9pZCI6IjEwNyIsInN1YnNjcmliZXJfaWQiOiIxMDc3NDk3NiIsInNlcmlhbCI6ImdsXzExMTUwMTQwMDk4MTM0NDk0MDcxMi0xMDciLCJtYXRjaF9rZXkiOiJhLXJ6LS1jcmlja2V0LS1wODIxMDMxNjQ3MDA5NzA4NzY5NzYiLCJleHAiOjE3OTQyMjQzMTksInNpZCI6IjdhMWJmNzExNTNiYjljOTNmOGQwYWJlOWY0NGRjNjJjIiwicGxhdGZvcm0iOiJ3ZWIiLCJlbnRpdGxlZF91bnRpbCI6MTc5NDIzNzgxOSwibWF4X2NvbmN1cnJlbnQiOjEsInN1YnNjcmliZXJfc3RiX2lkIjoiMTM3Mzg1NTAiLCJ1YmJfZ3VpZCI6IjNmYTViNGMwLTc4MTctNDI0ZS1hZTgzLWVhZmFiZjQ0ZjI1NSJ9.eXeuibnuH9Nrm3s16kg2Pst92shpPB9DaBqm5gmJnzQ';

      return {
        html: `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <script src="https://cdnjs.cloudflare.com/ajax/libs/shaka-player/4.7.11/shaka-player.compiled.js"></script>
  <style>
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; width: 100%; height: 100%; background: #000; overflow: hidden; }
    video { width: 100%; height: 100%; object-fit: contain; }
  </style>
</head>
<body>
  <video id="player" autoplay playsinline webkit-playsinline controls></video>
  <script>
    async function init() {
      shaka.polyfill.installAll();
      if (!shaka.Player.isBrowserSupported()) return;
      const video = document.getElementById('player');
      const player = new shaka.Player(video);
      player.configure({
        drm: {
          servers: {
            'com.widevine.alpha': '${activeLicense}'
          }
        },
        streaming: {
          rebufferingGoal: 2,
          bufferingGoal: 4,
          lowLatencyMode: true
        }
      });
      try {
        await player.load('${rawUrl}');
        video.play().catch(function() {});
      } catch (err) {
        console.error('Shaka load error:', err);
      }
    }
    document.addEventListener('DOMContentLoaded', init);
  </script>
</body>
</html>`,
        baseUrl: 'https://sportivo.dipeshsapkota7.com.np',
      };
    }

    // For third-party embed streams (DaddyLive, PPV, StrmFree, YonoTV, etc.):
    // Embed inside an iframe hosted from Sportivo's domain so window.top !== window.self,
    // which completely satisfies the "This player only works when embedded" requirement.
    const escapedUrl = rawUrl.replace(/"/g, '&quot;');
    return {
      html: `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <meta name="referrer" content="no-referrer-when-downgrade">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { width: 100%; height: 100%; background: #000; overflow: hidden; }
    iframe { width: 100%; height: 100%; border: 0; display: block; }
  </style>
</head>
<body>
  <iframe
    src="${escapedUrl}"
    allow="autoplay; fullscreen; picture-in-picture; encrypted-media; clipboard-write; display-capture"
    allowfullscreen="true"
    webkitallowfullscreen="true"
    mozallowfullscreen="true"
    referrerpolicy="no-referrer-when-downgrade"
  ></iframe>
</body>
</html>`,
      baseUrl: 'https://sportivo.dipeshsapkota7.com.np',
    };
  }, []);

  const isDirectVideo = Boolean(
    activeStream.isDirectStream &&
    activeStream.streamUrl &&
    (activeStream.streamUrl.endsWith('.m3u8') || activeStream.streamUrl.endsWith('.mp4')) &&
    !activeStream.embedUrl?.includes('plyrr') &&
    !activeStream.embedUrl?.includes('pages.dev') &&
    !activeStream.streamUrl?.includes('plyrr') &&
    !activeStream.streamUrl?.includes('pages.dev')
  );

  const handleShare = async () => {
    try {
      await Share.share({
        title: `${match.title} on Sportivo`,
        message: `Watch ${match.title} live on Sportivo! Live streaming in Nepal Standard Time: https://sportivo.dipeshsapkota7.com.np/`,
      });
    } catch {}
  };

  const handleToggleStar = async () => {
    await triggerButtonHaptic();
    const slug = match.slug || match.title.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    await toggleStarredMatch(slug);
    setIsStarred(!isStarred);
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent hidden={isFullscreen} />

      {/* Top Bar with Back Button */}
      {!isFullscreen && (
        <View style={[styles.topBar, { paddingTop: topPadding + 6 }]}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backButton}
            accessibilityLabel="Back"
          >
            <ArrowBackIcon size={20} color="#c9f36b" />
            <Text style={styles.backButtonText}>Back</Text>
          </TouchableOpacity>
          <Text style={styles.topBarTitle} numberOfLines={1}>
            {match.title}
          </Text>
          <TouchableOpacity onPress={handleShare} style={styles.shareButton} accessibilityLabel="Share">
            <ShareIcon size={18} color="#cbd5e1" />
          </TouchableOpacity>
        </View>
      )}

      {/* Video Player Stage (ExoPlayer Native Streaming or WebView) */}
      <View style={[styles.playerStage, isFullscreen && styles.playerStageFullscreen]}>
        {isDirectVideo ? (
          <Video
            ref={videoRef}
            source={{ uri: activeStream.streamUrl || activeStream.embedUrl || '' }}
            style={styles.video}
            useNativeControls
            resizeMode={ResizeMode.CONTAIN}
            shouldPlay={isPlaying}
            onFullscreenUpdate={async (event) => {
              if (
                event.fullscreenUpdate === VideoFullscreenUpdate.PLAYER_WILL_PRESENT ||
                event.fullscreenUpdate === VideoFullscreenUpdate.PLAYER_DID_PRESENT
              ) {
                setIsFullscreen(true);
                StatusBar.setHidden(true, 'fade');
                await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE).catch(() => {});
              } else if (
                event.fullscreenUpdate === VideoFullscreenUpdate.PLAYER_WILL_DISMISS ||
                event.fullscreenUpdate === VideoFullscreenUpdate.PLAYER_DID_DISMISS
              ) {
                setIsFullscreen(false);
                StatusBar.setHidden(false, 'fade');
                await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {});
              }
            }}
            onPlaybackStatusUpdate={(status: AVPlaybackStatus) => {
              if (status.isLoaded) {
                setIsBuffering(status.isBuffering);
                setIsPlaying(status.isPlaying);
                if (status.isPlaying) setHasTimedOut(false);
              }
            }}
          />
        ) : (
          <WebView
            source={getWebViewSource(activeStream)}
            style={styles.video}
            allowsFullscreenVideo
            allowsInlineMediaPlayback
            mediaPlaybackRequiresUserAction={false}
            javaScriptEnabled
            domStorageEnabled
            originWhitelist={['*']}
            mixedContentMode="always"
            allowsProtectedMedia
            userAgent="Mozilla/5.0 (Linux; Android 14; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36"
            setSupportMultipleWindows={false}
            sharedCookiesEnabled
            thirdPartyCookiesEnabled
            androidLayerType="hardware"
            onLoadStart={() => setIsBuffering(true)}
            onLoadEnd={() => setIsBuffering(false)}
            renderError={() => (
              <View style={[styles.video, { justifyContent: 'center', alignItems: 'center', backgroundColor: '#000', padding: 16 }]}>
                <Text style={{ color: '#ef4444', fontSize: 13, fontWeight: 'bold', textAlign: 'center', marginBottom: 8 }}>
                  Feed blocked by external stream host policy
                </Text>
                <TouchableOpacity
                  style={{ backgroundColor: '#c9f36b', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, marginBottom: 8 }}
                  onPress={() => {
                    const url = activeStream.embedUrl || activeStream.streamUrl;
                    if (url) Linking.openURL(url).catch(() => {});
                  }}
                >
                  <Text style={{ color: '#090d0b', fontWeight: 'bold', fontSize: 12 }}>Open in External Player ↗</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={{ backgroundColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 8 }}
                  onPress={() => setSelectedServer((selectedServer + 1) % Math.max(1, streams.length))}
                >
                  <Text style={{ color: '#ffffff', fontSize: 11 }}>Switch Server</Text>
                </TouchableOpacity>
              </View>
            )}
          />
        )}

        {isBuffering && (
          <View style={styles.bufferingOverlay} pointerEvents="none">
            <ActivityIndicator size="large" color="#c9f36b" />
            <Text style={styles.bufferingText}>Connecting to Live Broadcast...</Text>
          </View>
        )}

        {/* Fullscreen Landscape Toggle Button */}
        <TouchableOpacity
          style={styles.fullscreenToggleBtn}
          onPress={toggleFullscreen}
          accessibilityLabel={isFullscreen ? 'Exit Fullscreen' : 'Landscape Fullscreen'}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          {isFullscreen ? (
            <MinimizeIcon size={20} color="#ffffff" />
          ) : (
            <MaximizeIcon size={20} color="#ffffff" />
          )}
        </TouchableOpacity>
      </View>

      {!isFullscreen && (
        <>
          {/* Server Selection Toolbar (Directly under video, matching Web Screenshot 3) */}
          <View style={styles.serverToolbar}>
            <Text style={styles.serverToolbarLabel}>Servers</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.serverScroll}>
              {(streams.length > 0 ? streams : [fallbackStream]).map((stream, idx) => {
                const isCurrent = idx === selectedServer;
                return (
                  <TouchableOpacity
                    key={stream.id || idx}
                    style={[styles.serverChip, isCurrent && styles.serverChipActive]}
                    onPress={async () => {
                      await triggerButtonHaptic();
                      setSelectedServer(idx);
                    }}
                  >
                    <Text style={[styles.serverChipText, isCurrent && styles.serverChipTextActive]}>
                      {stream.label || `Server ${idx + 1} HD`}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            <View style={styles.liveEdgePill}>
              <View style={styles.liveDot} />
              <Text style={styles.liveEdgeText}>Live edge</Text>
            </View>
          </View>

          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            {/* Live Scoreboard Card (Matches web Screenshots 2 & 3) */}
            {isNplMatch && (
              <View style={styles.scoreboardCard}>
                {/* Scoreboard Header: Match Title | Venue + Toss Badge */}
                <View style={styles.sbHeader}>
                  <View style={styles.sbHeaderLeft}>
                    <View style={styles.liveDot} />
                    <Text style={styles.sbMatchTitle} numberOfLines={1}>
                      {liveDesk?.header?.matchTitle || match.title}
                    </Text>
                    <Text style={styles.sbDivider}>|</Text>
                    <Text style={styles.sbVenue} numberOfLines={1}>
                      {liveDesk?.header?.venue || match.venue || 'TU Cricket Ground, Kirtipur'}
                    </Text>
                  </View>
                  {liveDesk?.header?.tossNote ? (
                    <View style={styles.tossBadge}>
                      <Text style={styles.tossBadgeText} numberOfLines={1}>
                        {cleanCricketText(liveDesk.header.tossNote)}
                      </Text>
                    </View>
                  ) : null}
                </View>

                {/* Scoreboard Body: 2 Teams with Batting Indicator & Target Equation */}
                <View style={styles.sbScoresBody}>
                  {/* Team 1 */}
                  <View style={styles.sbTeamRow}>
                    <View style={styles.sbTeamInfo}>
                      <View style={styles.sbShortBadge}>
                        <Text style={styles.sbShortText}>
                          {liveDesk?.header?.team1Short || 'T1'}
                        </Text>
                      </View>
                      <Text style={styles.sbTeamName} numberOfLines={1}>
                        {liveDesk?.header?.team1Name || 'Team 1'}
                      </Text>
                      {liveDesk?.header?.activeTeam === 1 && (
                        <View style={styles.activeBatDot} />
                      )}
                    </View>
                    <View style={styles.sbScoreGroup}>
                      <Text style={styles.sbScoreMain}>
                        {liveDesk?.header?.team1Score || liveDesk?.score || '0/0'}
                      </Text>
                      {liveDesk?.header?.team1Overs ? (
                        <Text style={styles.sbOversText}>
                          ({liveDesk.header.team1Overs.replace(/[()]/g, '')})
                        </Text>
                      ) : liveDesk?.overs ? (
                        <Text style={styles.sbOversText}>({liveDesk.overs} ov)</Text>
                      ) : null}
                    </View>
                  </View>

                  {/* VS / Target Equation Row */}
                  <View style={styles.sbEquationRow}>
                    {liveDesk?.header?.target || liveDesk?.target ? (
                      <View style={styles.targetPill}>
                        <Text style={styles.targetPillText}>
                          {cleanCricketText(liveDesk.header?.target || liveDesk.target)}
                        </Text>
                      </View>
                    ) : (
                      <Text style={styles.inningsText}>Innings 1</Text>
                    )}
                    {(liveDesk?.header?.crr || liveDesk?.crr || liveDesk?.header?.rrr || liveDesk?.rrr) ? (
                      <View style={styles.runRatesRow}>
                        {(liveDesk?.header?.crr || liveDesk?.crr) ? (
                          <View style={styles.ratePill}>
                            <Text style={styles.ratePillText}>
                              CRR: {liveDesk.header?.crr || liveDesk.crr}
                            </Text>
                          </View>
                        ) : null}
                        {(liveDesk?.header?.rrr || liveDesk?.rrr) && (liveDesk.header?.rrr || liveDesk.rrr) !== '--' ? (
                          <View style={[styles.ratePill, styles.rrrPill]}>
                            <Text style={styles.rrrPillText}>
                              RRR: {liveDesk.header?.rrr || liveDesk.rrr}
                            </Text>
                          </View>
                        ) : null}
                      </View>
                    ) : null}
                  </View>

                  {/* Team 2 */}
                  <View style={styles.sbTeamRow}>
                    <View style={styles.sbTeamInfo}>
                      <View style={styles.sbShortBadge}>
                        <Text style={styles.sbShortText}>
                          {liveDesk?.header?.team2Short || 'T2'}
                        </Text>
                      </View>
                      <Text style={styles.sbTeamName} numberOfLines={1}>
                        {liveDesk?.header?.team2Name || 'Team 2'}
                      </Text>
                      {liveDesk?.header?.activeTeam === 2 && (
                        <View style={styles.activeBatDot} />
                      )}
                    </View>
                    <View style={styles.sbScoreGroup}>
                      <Text
                        style={[
                          styles.sbScoreMain,
                          (!liveDesk?.header?.team2Score || liveDesk.header.team2Score === 'Yet to Bat') &&
                            styles.sbScoreMuted,
                        ]}
                      >
                        {liveDesk?.header?.team2Score || 'Yet to Bat'}
                      </Text>
                      {liveDesk?.header?.team2Overs ? (
                        <Text style={styles.sbOversText}>
                          ({liveDesk.header.team2Overs.replace(/[()]/g, '')})
                        </Text>
                      ) : null}
                    </View>
                  </View>
                </View>

                {/* Batters & Active Bowler */}
                {((liveDesk?.batters && liveDesk.batters.length > 0) || liveDesk?.bowler?.name) && (
                  <View style={styles.playersSection}>
                    {/* Batters */}
                    {liveDesk?.batters && liveDesk.batters.length > 0 && (
                      <View style={styles.battersCol}>
                        <Text style={styles.colEyebrow}>BATTERS</Text>
                        {liveDesk.batters.slice(0, 2).map((bat, idx) => (
                          <View key={idx} style={styles.playerRow}>
                            <Text style={styles.playerName} numberOfLines={1}>
                              {cleanCricketText(bat.name)}
                              {bat.isOnStrike && <Text style={{ color: '#c9f36b' }}> *</Text>}
                            </Text>
                            <Text style={styles.playerStats}>
                              <Text style={styles.playerRuns}>{bat.runs}</Text>{' '}
                              <Text style={styles.playerMeta}>
                                ({bat.balls}b{bat.fours ? `, ${bat.fours}x4` : ''}{bat.sixes ? `, ${bat.sixes}x6` : ''})
                              </Text>
                            </Text>
                          </View>
                        ))}
                      </View>
                    )}

                    {/* Bowler */}
                    {liveDesk?.bowler?.name && (
                      <View style={styles.bowlerCol}>
                        <Text style={styles.colEyebrow}>ACTIVE BOWLER</Text>
                        <View style={styles.playerRow}>
                          <Text style={styles.playerName} numberOfLines={1}>
                            {cleanCricketText(liveDesk.bowler.name)}
                          </Text>
                          <Text style={styles.playerStats}>
                            <Text style={styles.playerRuns}>{liveDesk.bowler.figures}</Text>
                            {liveDesk.bowler.overs ? (
                              <Text style={styles.playerMeta}> ({liveDesk.bowler.overs})</Text>
                            ) : null}
                          </Text>
                        </View>
                      </View>
                    )}
                  </View>
                )}

                {/* Recent Balls Strip */}
                {liveDesk?.recentBalls && liveDesk.recentBalls.length > 0 && (
                  <View style={styles.recentStripContainer}>
                    <Text style={styles.recentLabel}>RECENT</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.recentBallsScroll}>
                      {liveDesk.recentBalls.slice(-10).map((b, idx) => {
                        const code = (b.code || '').toLowerCase().trim();
                        const isFour = code === '4';
                        const isSix = code === '6';
                        const isWkt = code.includes('w') && !code.includes('wd');
                        const isDot = code === '0';

                        return (
                          <View
                            key={idx}
                            style={[
                              styles.recentBallCircle,
                              isSix && styles.recentBallSix,
                              isFour && styles.recentBallFour,
                              isWkt && styles.recentBallWicket,
                              isDot && styles.recentBallDot,
                            ]}
                          >
                            <Text
                              style={[
                                styles.recentBallText,
                                isFour && styles.recentBallFourText,
                                (isSix || isWkt) && styles.recentBallWhiteText,
                              ]}
                            >
                              {isWkt ? 'W' : isDot ? '•' : b.code}
                            </Text>
                          </View>
                        );
                      })}
                    </ScrollView>
                  </View>
                )}
              </View>
            )}

            {/* Interactive Hub Tabs (Commentary | Upcoming | Points Table) */}
            {isNplMatch && (
              <View style={styles.hubContainer}>
                <View style={styles.hubHeader}>
                  <TouchableOpacity
                    style={[styles.hubTab, activeHubTab === 'commentary' && styles.hubTabActive]}
                    onPress={() => setActiveHubTab('commentary')}
                  >
                    <Text style={[styles.hubTabText, activeHubTab === 'commentary' && styles.hubTabTextActive]}>
                      Commentary {liveDesk?.commentary?.length ? `(${liveDesk.commentary.length})` : ''}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.hubTab, activeHubTab === 'upcoming' && styles.hubTabActive]}
                    onPress={() => setActiveHubTab('upcoming')}
                  >
                    <Text style={[styles.hubTabText, activeHubTab === 'upcoming' && styles.hubTabTextActive]}>
                      Upcoming
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.hubTab, activeHubTab === 'standings' && styles.hubTabActive]}
                    onPress={() => setActiveHubTab('standings')}
                  >
                    <Text style={[styles.hubTabText, activeHubTab === 'standings' && styles.hubTabTextActive]}>
                      Points Table
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Tab 1: Ball-by-ball Commentary */}
                {activeHubTab === 'commentary' && (
                  <View style={styles.hubBody}>
                    {liveDesk && liveDesk.commentary && liveDesk.commentary.length > 0 ? (
                      liveDesk.commentary.map((comm, idx) => (
                        <View key={idx} style={styles.commItem}>
                          <View style={styles.commBallCol}>
                            <Text style={styles.commBallText}>{comm.ball}</Text>
                            {comm.outcome && (
                              <View
                                style={[
                                  styles.commBadge,
                                  comm.outcome === '6' && styles.recentBallSix,
                                  comm.outcome === '4' && styles.recentBallFour,
                                  comm.outcome === 'W' && styles.recentBallWicket,
                                ]}
                              >
                                <Text style={styles.commBadgeText}>{comm.outcome}</Text>
                              </View>
                            )}
                          </View>
                          <View style={styles.commTextCol}>
                            <Text style={styles.commBowlerText}>{cleanCricketText(comm.bowlerToBatsman)}</Text>
                            <Text style={styles.commDescText}>{cleanCricketText(comm.text)}</Text>
                          </View>
                        </View>
                      ))
                    ) : (
                      <Text style={styles.emptyText}>Waiting for live ground scorer commentary feeds...</Text>
                    )}
                  </View>
                )}

                {/* Tab 2: Upcoming Matches */}
                {activeHubTab === 'upcoming' && (
                  <View style={styles.hubBody}>
                    {upcomingMatches.map((m) => (
                      <View key={m.id} style={styles.upcomingCard}>
                        <View style={styles.upcomingTop}>
                          <Text style={styles.upcomingMatchNum}>Match {m.matchNumber}</Text>
                          <Text style={styles.upcomingTime}>{formatKathmanduTime(m.timestamp)}</Text>
                        </View>
                        <Text style={styles.upcomingTitle}>
                          {m.homeTeam} vs {m.awayTeam}
                        </Text>
                        <Text style={styles.upcomingVenue}>{m.venue}</Text>
                      </View>
                    ))}
                  </View>
                )}

                {/* Tab 3: Points Table */}
                {activeHubTab === 'standings' && (
                  <View style={styles.hubBody}>
                    <View style={styles.tableHeader}>
                      <Text style={[styles.tableCol, { width: 28 }]}>#</Text>
                      <Text style={[styles.tableCol, { flex: 1 }]}>Team</Text>
                      <Text style={[styles.tableCol, { width: 30, textAlign: 'center' }]}>P</Text>
                      <Text style={[styles.tableCol, { width: 30, textAlign: 'center' }]}>W</Text>
                      <Text style={[styles.tableCol, { width: 34, textAlign: 'center' }]}>PTS</Text>
                      <Text style={[styles.tableCol, { width: 56, textAlign: 'right' }]}>NRR</Text>
                    </View>
                    {(standings.length > 0 ? standings : NPL_STANDINGS_DEFAULT).map((t, idx) => (
                      <View key={idx} style={[styles.tableRow, idx < 4 && styles.tableRowTop4]}>
                        <View style={{ width: 28, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                          {idx < 4 && <View style={styles.top4Dot} />}
                          <Text style={styles.tableRank}>{t.rank || idx + 1}</Text>
                        </View>
                        <Text style={styles.teamNameText} numberOfLines={1}>
                          {t.name}
                        </Text>
                        <Text style={[styles.tableVal, { width: 30, textAlign: 'center' }]}>{t.p}</Text>
                        <Text style={[styles.tableVal, { width: 30, textAlign: 'center', color: '#c9f36b' }]}>{t.w}</Text>
                        <Text style={[styles.tableVal, { width: 34, textAlign: 'center', fontWeight: '900', color: '#c9f36b' }]}>
                          {t.pts}
                        </Text>
                        <Text style={[styles.tableVal, { width: 56, textAlign: 'right', fontFamily: 'monospace' }]}>
                          {t.nrr}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            )}

            {/* Match Meta Card */}
            <View style={styles.metaCard}>
              <View style={styles.metaTopRow}>
                <View style={styles.liveIndicator}>
                  <View style={styles.liveDot} />
                  <Text style={styles.liveText}>
                    {match.status === 'LIVE' || match.status === 'Live' ? 'LIVE NOW' : 'FIXTURE DESK'}
                  </Text>
                </View>
                <Text style={styles.leagueText}>
                  {match.league || match.competition || 'SPORTS'} · NST
                </Text>
              </View>

              <Text style={styles.matchTitle}>{match.title}</Text>
              {match.venue && (
                <View style={styles.venueRow}>
                  <LocationIcon size={13} color="#94a3b8" />
                  <Text style={styles.venueText}>{match.venue}</Text>
                </View>
              )}

              {/* Action Row */}
              <View style={styles.actionRow}>
                <TouchableOpacity
                  style={[styles.actionButton, isStarred && styles.actionButtonActive]}
                  onPress={handleToggleStar}
                >
                  <BookmarkIcon
                    size={16}
                    color={isStarred ? '#fbbf24' : '#cbd5e1'}
                    fill={isStarred ? '#fbbf24' : undefined}
                  />
                  <Text style={[styles.actionButtonText, isStarred && styles.actionButtonTextActive]}>
                    {isStarred ? 'Saved to Watchlist' : 'Add to Watchlist'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.actionButton} onPress={handleShare}>
                  <ShareIcon size={16} color="#cbd5e1" />
                  <Text style={styles.actionButtonText}>Share</Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#080a0b',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 10,
    backgroundColor: '#080a0b',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(201, 243, 107, 0.1)',
  },
  backButtonText: {
    color: '#c9f36b',
    fontSize: 12,
    fontWeight: '800',
  },
  topBarTitle: {
    flex: 1,
    textAlign: 'center',
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '900',
    paddingHorizontal: 8,
  },
  shareButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  playerStage: {
    width: width,
    height: (width * 9) / 16,
    backgroundColor: '#000000',
    position: 'relative',
  },
  playerStageFullscreen: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
    zIndex: 99999,
    backgroundColor: '#000000',
  },
  fullscreenToggleBtn: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    zIndex: 100,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
  },
  video: {
    width: '100%',
    height: '100%',
  },
  bufferingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(8, 10, 11, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  bufferingText: {
    color: '#c9f36b',
    fontSize: 12,
    fontWeight: '800',
  },
  /* Servers Toolbar under Player */
  serverToolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0a0f0e',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  serverToolbarLabel: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '700',
    marginRight: 8,
  },
  serverScroll: {
    flexDirection: 'row',
    gap: 6,
    paddingRight: 8,
  },
  serverChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  serverChipActive: {
    backgroundColor: '#c9f36b',
    borderColor: '#c9f36b',
  },
  serverChipText: {
    color: '#cbd5e1',
    fontSize: 11,
    fontWeight: '700',
  },
  serverChipTextActive: {
    color: '#080a0b',
    fontWeight: '900',
  },
  liveEdgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(201, 243, 107, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(201, 243, 107, 0.25)',
  },
  liveEdgeText: {
    color: '#c9f36b',
    fontSize: 10,
    fontWeight: '800',
  },

  /* Match Scoreboard Card (Matching Web Screenshots 2 & 3) */
  scoreboardCard: {
    backgroundColor: '#0b1413',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    marginBottom: 16,
    overflow: 'hidden',
  },
  sbHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
    gap: 8,
  },
  sbHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
    minWidth: 0,
  },
  sbMatchTitle: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
    flexShrink: 0,
  },
  sbDivider: {
    color: '#64748b',
    fontSize: 12,
  },
  sbVenue: {
    color: '#94a3b8',
    fontSize: 11,
    flex: 1,
  },
  tossBadge: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    maxWidth: 140,
  },
  tossBadgeText: {
    color: '#cbd5e1',
    fontSize: 10,
    fontWeight: '700',
  },
  sbScoresBody: {
    padding: 14,
    gap: 10,
  },
  sbTeamRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  sbTeamInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    minWidth: 0,
  },
  sbShortBadge: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  sbShortText: {
    color: '#ffffff',
    fontFamily: 'monospace',
    fontSize: 10,
    fontWeight: '800',
  },
  sbTeamName: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
    flex: 1,
  },
  activeBatDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#c9f36b',
  },
  sbScoreGroup: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
    flexShrink: 0,
  },
  sbScoreMain: {
    color: '#ffffff',
    fontFamily: 'monospace',
    fontSize: 18,
    fontWeight: '900',
  },
  sbScoreMuted: {
    color: '#64748b',
    fontSize: 13,
    fontWeight: '600',
  },
  sbOversText: {
    color: '#94a3b8',
    fontFamily: 'monospace',
    fontSize: 11,
  },
  sbEquationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    paddingVertical: 6,
  },
  targetPill: {
    backgroundColor: 'rgba(201, 243, 107, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(201, 243, 107, 0.25)',
  },
  targetPillText: {
    color: '#c9f36b',
    fontSize: 11,
    fontWeight: '800',
  },
  inningsText: {
    color: '#64748b',
    fontSize: 11,
    fontFamily: 'monospace',
  },
  runRatesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  ratePill: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  ratePillText: {
    color: '#94a3b8',
    fontSize: 10,
    fontFamily: 'monospace',
    fontWeight: '700',
  },
  rrrPill: {
    backgroundColor: 'rgba(201, 243, 107, 0.1)',
  },
  rrrPillText: {
    color: '#c9f36b',
    fontSize: 10,
    fontFamily: 'monospace',
    fontWeight: '700',
  },

  /* Batters & Bowler */
  playersSection: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
    gap: 10,
  },
  battersCol: {
    gap: 4,
  },
  bowlerCol: {
    gap: 4,
    marginTop: 4,
  },
  colEyebrow: {
    color: '#64748b',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  playerName: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
    flex: 1,
  },
  playerStats: {
    flexShrink: 0,
  },
  playerRuns: {
    color: '#ffffff',
    fontFamily: 'monospace',
    fontSize: 12,
    fontWeight: '800',
  },
  playerMeta: {
    color: '#94a3b8',
    fontSize: 10,
    fontFamily: 'monospace',
  },

  /* Recent Balls Strip */
  recentStripContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
    gap: 8,
  },
  recentLabel: {
    color: '#64748b',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  recentBallsScroll: {
    flexDirection: 'row',
    gap: 5,
  },
  recentBallCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(255,255,255,0.08)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  recentBallSix: {
    backgroundColor: '#c9f36b',
  },
  recentBallFour: {
    backgroundColor: 'rgba(201, 243, 107, 0.25)',
    borderWidth: 1,
    borderColor: '#c9f36b',
  },
  recentBallWicket: {
    backgroundColor: '#ef4444',
  },
  recentBallDot: {
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  recentBallText: {
    color: '#cbd5e1',
    fontSize: 10,
    fontWeight: '900',
  },
  recentBallFourText: {
    color: '#c9f36b',
  },
  recentBallWhiteText: {
    color: '#080a0b',
  },

  tableRowTop4: {
    backgroundColor: 'rgba(201, 243, 107, 0.04)',
  },
  top4Dot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#c9f36b',
  },
  tableRank: {
    color: '#94a3b8',
    fontSize: 11,
    fontFamily: 'monospace',
  },
  teamNameText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
    flex: 1,
  },

  streamHelperBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#0c1514',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(201, 243, 107, 0.2)',
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  streamHelperTextRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  streamHelperTitle: {
    color: '#cbd5e1',
    fontSize: 11,
    fontWeight: '700',
  },
  streamHelperActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#c9f36b',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  retryBtnText: {
    color: '#080a0b',
    fontSize: 10,
    fontWeight: '900',
  },
  telemetryBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#0c1211',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  telemetryScoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  telemetryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  telemetryBadgeText: {
    color: '#ef4444',
    fontSize: 8,
    fontWeight: '900',
  },
  scoreTextRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  scoreNumber: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '900',
  },
  oversNumber: {
    color: '#94a3b8',
    fontSize: 10,
    fontWeight: '700',
  },
  crrNumber: {
    color: '#e5b94f',
    fontSize: 10,
    fontWeight: '700',
    marginLeft: 4,
  },
  ballsStrip: {
    flexDirection: 'row',
    gap: 5,
    paddingLeft: 8,
  },
  ballCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  ballSix: {
    backgroundColor: '#9333ea',
  },
  ballFour: {
    backgroundColor: '#10b981',
  },
  ballWicket: {
    backgroundColor: '#ef4444',
  },
  ballDot: {
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  ballText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '900',
  },
  ballFourText: {
    color: '#080a0b',
  },
  ballWhiteText: {
    color: '#ffffff',
  },
  hubContainer: {
    backgroundColor: '#0e1716',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    marginBottom: 16,
    overflow: 'hidden',
  },
  hubHeader: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
    backgroundColor: '#0a100f',
  },
  hubTab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  hubTabActive: {
    borderBottomColor: '#c9f36b',
  },
  hubTabText: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '700',
  },
  hubTabTextActive: {
    color: '#c9f36b',
    fontWeight: '900',
  },
  hubBody: {
    padding: 12,
  },
  commItem: {
    flexDirection: 'row',
    gap: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  commBallCol: {
    alignItems: 'center',
    width: 32,
  },
  commBallText: {
    color: '#c9f36b',
    fontSize: 10,
    fontWeight: '900',
  },
  commBadge: {
    width: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
  },
  commBadgeText: {
    color: '#ffffff',
    fontSize: 9,
    fontWeight: '900',
  },
  commTextCol: {
    flex: 1,
  },
  commBowlerText: {
    color: '#e5b94f',
    fontSize: 11,
    fontWeight: '800',
  },
  commDescText: {
    color: '#cbd5e1',
    fontSize: 11,
    lineHeight: 16,
    marginTop: 2,
  },
  upcomingCard: {
    backgroundColor: 'rgba(255,255,255,0.02)',
    padding: 10,
    borderRadius: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)',
  },
  upcomingTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  upcomingMatchNum: {
    color: '#e5b94f',
    fontSize: 10,
    fontWeight: '800',
  },
  upcomingTime: {
    color: '#c9f36b',
    fontSize: 10,
    fontWeight: '700',
  },
  upcomingTitle: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
  },
  upcomingVenue: {
    color: '#94a3b8',
    fontSize: 9,
    marginTop: 2,
  },
  tableHeader: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
    paddingBottom: 6,
    marginBottom: 6,
  },
  tableCol: {
    color: '#94a3b8',
    fontSize: 9,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 5,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.02)',
  },
  teamName: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
  },
  tableVal: {
    color: '#cbd5e1',
    fontSize: 11,
    fontWeight: '600',
  },
  emptyText: {
    color: '#94a3b8',
    fontSize: 11,
    textAlign: 'center',
    paddingVertical: 16,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  metaCard: {
    backgroundColor: '#0e1716',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    padding: 16,
    marginBottom: 16,
  },
  metaTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#ef4444',
  },
  liveText: {
    color: '#ef4444',
    fontSize: 9,
    fontWeight: '900',
  },
  leagueText: {
    color: '#94a3b8',
    fontSize: 10,
    fontWeight: '700',
  },
  matchTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '900',
    marginBottom: 6,
  },
  venueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 12,
  },
  venueText: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '600',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
    paddingTop: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.06)',
    paddingVertical: 8,
    borderRadius: 10,
  },
  actionButtonActive: {
    backgroundColor: 'rgba(251, 191, 36, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.4)',
  },
  actionButtonText: {
    color: '#cbd5e1',
    fontSize: 11,
    fontWeight: '800',
  },
  actionButtonTextActive: {
    color: '#fbbf24',
  },
  serverSection: {
    marginTop: 4,
  },
  sectionHeader: {
    color: '#c9f36b',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1,
    marginBottom: 4,
  },
  serverSubtext: {
    color: '#94a3b8',
    fontSize: 11,
    lineHeight: 16,
    marginBottom: 12,
  },
  serverList: {
    gap: 8,
  },
  serverCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#0e1716',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 14,
    padding: 14,
  },
  serverCardActive: {
    borderColor: '#c9f36b',
    backgroundColor: 'rgba(201, 243, 107, 0.06)',
  },
  serverInfo: {
    flex: 1,
  },
  serverTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 3,
  },
  serverTitle: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
  },
  serverTitleActive: {
    color: '#c9f36b',
  },
  hdBadge: {
    backgroundColor: 'rgba(201, 243, 107, 0.2)',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
  },
  hdBadgeText: {
    color: '#c9f36b',
    fontSize: 9,
    fontWeight: '900',
  },
  serverSourceText: {
    color: '#94a3b8',
    fontSize: 10,
    fontWeight: '600',
  },
  serverSelectCircle: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  serverSelectCircleActive: {
    borderColor: '#c9f36b',
  },
  serverSelectInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#c9f36b',
  },
});
