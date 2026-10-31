import React, { useState, useEffect, useRef, useMemo } from 'react';
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
} from 'react-native';
import { Video, ResizeMode, AVPlaybackStatus } from 'expo-av';
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
} from '../components/Icons';
import { Match, RootStackParamList, StreamSource, NplMatch } from '../types';
import { toggleStarredMatch } from '../services/storage';
import { triggerButtonHaptic, setPlayerScreenActive } from '../services/notifications';
import {
  resolveMatchStreams,
  fetchLiveDeskMoments,
  LiveScorerMobile,
  fetchNplFixtures,
  formatKathmanduTime,
} from '../services/api';

type RouteProps = RouteProp<RootStackParamList, 'MatchPlayer'>;

const { width } = Dimensions.get('window');

const NPL_TEAMS_DATA = [
  { name: 'Sudurpaschim Royals', p: 1, w: 1, l: 0, pts: 2, nrr: '+1.450' },
  { name: 'Janakpur Bolts', p: 1, w: 1, l: 0, pts: 2, nrr: '+1.120' },
  { name: 'Biratnagar Kings', p: 1, w: 1, l: 0, pts: 2, nrr: '+0.850' },
  { name: 'Chitwan Rhinos', p: 1, w: 1, l: 0, pts: 2, nrr: '+0.420' },
  { name: 'Kathmandu Gurkhas', p: 1, w: 0, l: 1, pts: 0, nrr: '-0.420' },
  { name: 'Pokhara Avengers', p: 1, w: 0, l: 1, pts: 0, nrr: '-0.850' },
  { name: 'Lumbini Lions', p: 1, w: 0, l: 1, pts: 0, nrr: '-1.120' },
  { name: 'Karnali Yaks', p: 1, w: 0, l: 1, pts: 0, nrr: '-1.450' },
];

export default function MatchPlayerScreen() {
  const route = useRoute<RouteProps>();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { match } = route.params;

  const topPadding = Math.max(insets.top, Platform.OS === 'android' ? (StatusBar.currentHeight || 28) : 0) + 8;

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

  const videoRef = useRef<Video>(null);

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
    label: 'Action Sports HD (Native Stream)',
    embedUrl: 'https://ottnlive-fstream.nettvstreamz.com/live_hls/npl_match_3/tracks-v1a1/mono.m3u8',
    streamUrl: 'https://ottnlive-fstream.nettvstreamz.com/live_hls/npl_match_3/tracks-v1a1/mono.m3u8',
    isDirectStream: true,
    hd: true,
  };

  const activeStream = streams.length > 0 ? streams[selectedServer] || streams[0] : fallbackStream;

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
    <View style={[styles.container, { paddingTop: topPadding }]}>
      <StatusBar barStyle="light-content" backgroundColor="#080a0b" />

      {/* Top Bar with Back Button */}
      <View style={styles.topBar}>
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

      {/* Video Player Stage (ExoPlayer Native Streaming) */}
      <View style={styles.playerStage}>
        {activeStream.streamUrl || activeStream.embedUrl?.includes('.m3u8') ? (
          <Video
            ref={videoRef}
            source={{ uri: activeStream.streamUrl || activeStream.embedUrl || '' }}
            style={styles.video}
            useNativeControls
            resizeMode={ResizeMode.CONTAIN}
            shouldPlay={isPlaying}
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
            source={{ uri: activeStream.embedUrl || activeStream.streamUrl || '' }}
            style={styles.video}
            allowsFullscreenVideo
            allowsInlineMediaPlayback
            mediaPlaybackRequiresUserAction={false}
            javaScriptEnabled
            domStorageEnabled
            renderError={() => (
              <View style={[styles.video, { justifyContent: 'center', alignItems: 'center', backgroundColor: '#000' }]}>
                <ActivityIndicator size="large" color="#c9f36b" />
                <Text style={{ color: '#c9f36b', marginTop: 12, fontSize: 12, fontWeight: 'bold' }}>
                  Connecting to Live Broadcast...
                </Text>
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
      </View>

      {/* Switch Server Helper if user wants to change stream */}
      {hasTimedOut && streams.length > 1 && (
        <View style={styles.streamHelperBanner}>
          <View style={styles.streamHelperTextRow}>
            <AlertCircleIcon size={16} color="#fbbf24" />
            <Text style={styles.streamHelperTitle}>Switch to backup stream if buffering</Text>
          </View>
          <View style={styles.streamHelperActions}>
            <TouchableOpacity
              style={styles.retryBtn}
              onPress={() => {
                setHasTimedOut(false);
                setIsBuffering(true);
                setSelectedServer((selectedServer + 1) % streams.length);
              }}
            >
              <RefreshIcon size={12} color="#080a0b" />
              <Text style={styles.retryBtnText}>Next Server</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Real-time Match Telemetry Bar (Live Score & Recent Balls) - NPL Matches Only */}
      {isNplMatch && liveDesk && (
        <View style={styles.telemetryBar}>
          <View style={styles.telemetryScoreRow}>
            <View style={styles.telemetryBadge}>
              <View style={styles.liveDot} />
              <Text style={styles.telemetryBadgeText}>GROUND</Text>
            </View>
            {liveDesk.score ? (
              <View style={styles.scoreTextRow}>
                <Text style={styles.scoreNumber}>{liveDesk.score}</Text>
                {liveDesk.overs && <Text style={styles.oversNumber}>({liveDesk.overs} ov)</Text>}
                {liveDesk.crr && <Text style={styles.crrNumber}>CRR: {liveDesk.crr}</Text>}
              </View>
            ) : null}
          </View>

          {/* Recent Balls Strip */}
          {liveDesk.recentBalls && liveDesk.recentBalls.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.ballsStrip}>
              {liveDesk.recentBalls.slice(-10).map((b, idx) => {
                const code = (b.code || '').toLowerCase();
                const isFour = code === '4';
                const isSix = code === '6';
                const isWkt = code.includes('w') && !code.includes('wd');
                const isDot = code === '0';

                return (
                  <View
                    key={idx}
                    style={[
                      styles.ballCircle,
                      isSix && styles.ballSix,
                      isFour && styles.ballFour,
                      isWkt && styles.ballWicket,
                      isDot && styles.ballDot,
                    ]}
                  >
                    <Text
                      style={[
                        styles.ballText,
                        isFour && styles.ballFourText,
                        (isSix || isWkt) && styles.ballWhiteText,
                      ]}
                    >
                      {isWkt ? 'W' : isDot ? '•' : b.code}
                    </Text>
                  </View>
                );
              })}
            </ScrollView>
          )}
        </View>
      )}

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Interactive Match Hub Tabs - Strictly for NPL matches */}
        {isNplMatch && (
          <View style={styles.hubContainer}>
            <View style={styles.hubHeader}>
              <TouchableOpacity
                style={[styles.hubTab, activeHubTab === 'commentary' && styles.hubTabActive]}
                onPress={() => setActiveHubTab('commentary')}
              >
                <Text style={[styles.hubTabText, activeHubTab === 'commentary' && styles.hubTabTextActive]}>
                  Commentary
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.hubTab, activeHubTab === 'upcoming' && styles.hubTabActive]}
                onPress={() => setActiveHubTab('upcoming')}
              >
                <Text style={[styles.hubTabText, activeHubTab === 'upcoming' && styles.hubTabTextActive]}>
                  Fixtures
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

            {/* Hub Tab Content */}
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
                              comm.outcome === '6' && styles.ballSix,
                              comm.outcome === '4' && styles.ballFour,
                              comm.outcome === 'W' && styles.ballWicket,
                            ]}
                          >
                            <Text style={styles.commBadgeText}>{comm.outcome}</Text>
                          </View>
                        )}
                      </View>
                      <View style={styles.commTextCol}>
                        <Text style={styles.commBowlerText}>{comm.bowlerToBatsman}</Text>
                        <Text style={styles.commDescText}>{comm.text}</Text>
                      </View>
                    </View>
                  ))
                ) : (
                  <Text style={styles.emptyText}>Waiting for live ground scorer commentary feeds...</Text>
                )}
              </View>
            )}

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

            {activeHubTab === 'standings' && (
              <View style={styles.hubBody}>
                <View style={styles.tableHeader}>
                  <Text style={[styles.tableCol, { flex: 3 }]}>Team</Text>
                  <Text style={[styles.tableCol, { flex: 1, textAlign: 'center' }]}>P</Text>
                  <Text style={[styles.tableCol, { flex: 1, textAlign: 'center' }]}>W</Text>
                  <Text style={[styles.tableCol, { flex: 1, textAlign: 'center' }]}>PTS</Text>
                  <Text style={[styles.tableCol, { flex: 1.5, textAlign: 'right' }]}>NRR</Text>
                </View>
                {NPL_TEAMS_DATA.map((t, idx) => (
                  <View key={idx} style={styles.tableRow}>
                    <Text style={[styles.teamName, { flex: 3 }]} numberOfLines={1}>
                      {idx + 1}. {t.name}
                    </Text>
                    <Text style={[styles.tableVal, { flex: 1, textAlign: 'center' }]}>{t.p}</Text>
                    <Text style={[styles.tableVal, { flex: 1, textAlign: 'center', color: '#10b981' }]}>{t.w}</Text>
                    <Text style={[styles.tableVal, { flex: 1, textAlign: 'center', fontWeight: '900', color: '#c9f36b' }]}>
                      {t.pts}
                    </Text>
                    <Text style={[styles.tableVal, { flex: 1.5, textAlign: 'right' }]}>{t.nrr}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

        {/* Match Header Information */}
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

        {/* Server Selection Desk */}
        <View style={styles.serverSection}>
          <Text style={styles.sectionHeader}>MULTI-SERVER LIVE DESK</Text>
          <Text style={styles.serverSubtext}>
            Switch servers below if any broadcast feed encounters buffering or lag.
          </Text>

          <View style={styles.serverList}>
            {(streams.length > 0 ? streams : [fallbackStream]).map((stream, idx) => {
              const isCurrent = idx === selectedServer;
              return (
                <TouchableOpacity
                  key={stream.id || idx}
                  style={[styles.serverCard, isCurrent && styles.serverCardActive]}
                  onPress={async () => {
                    await triggerButtonHaptic();
                    setSelectedServer(idx);
                  }}
                >
                  <View style={styles.serverInfo}>
                    <View style={styles.serverTitleRow}>
                      <RadioIcon size={15} color={isCurrent ? '#c9f36b' : '#94a3b8'} />
                      <Text style={[styles.serverTitle, isCurrent && styles.serverTitleActive]}>
                        {stream.label || `Server ${idx + 1}`}
                      </Text>
                      {stream.hd && (
                        <View style={styles.hdBadge}>
                          <Text style={styles.hdBadgeText}>HD</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.serverSourceText}>
                      Provider: {stream.source || 'Verified CDN'} · NST Synced
                    </Text>
                  </View>

                  <View style={[styles.serverSelectCircle, isCurrent && styles.serverSelectCircleActive]}>
                    {isCurrent && <View style={styles.serverSelectInner} />}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </ScrollView>
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
    backgroundColor: '#0c1413',
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
