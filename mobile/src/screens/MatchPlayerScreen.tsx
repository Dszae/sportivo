import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
  Share,
  Linking,
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
  ExternalLinkIcon,
  LocationIcon,
  BookmarkIcon,
  RadioIcon,
} from '../components/Icons';
import { Match, RootStackParamList, StreamSource } from '../types';
import { toggleStarredMatch } from '../services/storage';
import { triggerButtonHaptic } from '../services/notifications';
import { resolveMatchStreams } from '../services/api';

type RouteProps = RouteProp<RootStackParamList, 'MatchPlayer'>;

const { width } = Dimensions.get('window');

export default function MatchPlayerScreen() {
  const route = useRoute<RouteProps>();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { match } = route.params;

  const topPadding = Math.max(insets.top, Platform.OS === 'android' ? (StatusBar.currentHeight || 28) : 0) + 8;

  const [streams, setStreams] = useState<StreamSource[]>(match.streams || []);
  const [selectedServer, setSelectedServer] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isBuffering, setIsBuffering] = useState(true);
  const [isStarred, setIsStarred] = useState(false);
  const [isResolving, setIsResolving] = useState(false);
  const [hasTimedOut, setHasTimedOut] = useState(false);
  const videoRef = useRef<Video>(null);

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

  // Buffering timeout safeguard: never leave user stuck indefinitely
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

      {/* Video Player Stage */}
      <View style={styles.playerStage}>
        {activeStream.isDirectStream && activeStream.streamUrl ? (
          <Video
            ref={videoRef}
            source={{ uri: activeStream.streamUrl }}
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
            source={{
              uri: activeStream.embedUrl || 'https://sportivo.dipeshsapkota7.com.np/',
              headers: { Referer: 'https://sportivo.dipeshsapkota7.com.np/' },
            }}
            style={styles.video}
            allowsFullscreenVideo={true}
            mediaPlaybackRequiresUserAction={false}
            allowsInlineMediaPlayback={true}
            javaScriptEnabled={true}
            domStorageEnabled={true}
            mixedContentMode="always"
            originWhitelist={['*']}
            androidLayerType="hardware"
            userAgent="Mozilla/5.0 (Linux; Android 14; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36"
            onLoadStart={() => {
              setTimeout(() => setIsBuffering(false), 2000);
            }}
            onLoadEnd={() => setIsBuffering(false)}
            onLoadProgress={({ nativeEvent }) => {
              if (nativeEvent.progress > 0.35) setIsBuffering(false);
            }}
            onError={(_syntheticEvent) => {
              setIsBuffering(false);
              if (streams.length > 1) {
                setSelectedServer((selectedServer + 1) % streams.length);
              }
            }}
            renderError={() => (
              <View style={[styles.video, { justifyContent: 'center', alignItems: 'center', backgroundColor: '#000' }]}>
                <ActivityIndicator size="large" color="#c9f36b" />
                <Text style={{ color: '#c9f36b', marginTop: 12, fontSize: 12, fontWeight: 'bold' }}>
                  Connecting to High-Speed Stream...
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

      <ScrollView contentContainerStyle={styles.scrollContent}>
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
                      <RadioIcon
                        size={15}
                        color={isCurrent ? '#c9f36b' : '#94a3b8'}
                      />
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
  browserBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(201, 243, 107, 0.15)',
    borderWidth: 1,
    borderColor: '#c9f36b',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  browserBtnText: {
    color: '#c9f36b',
    fontSize: 10,
    fontWeight: '800',
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
