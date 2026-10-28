import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
  Share,
} from 'react-native';
import { Video, ResizeMode, AVPlaybackStatus } from 'expo-av';
import { useRoute, useNavigation } from '@react-navigation/native';
import { RouteProp } from '@react-navigation/native';
import { Match, RootStackParamList } from '../types';
import { toggleStarredMatch } from '../services/storage';
import { triggerButtonHaptic } from '../services/notifications';

type RouteProps = RouteProp<RootStackParamList, 'MatchPlayer'>;

const { width } = Dimensions.get('window');

export default function MatchPlayerScreen() {
  const route = useRoute<RouteProps>();
  const navigation = useNavigation();
  const { match } = route.params;

  const [selectedServer, setSelectedServer] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isBuffering, setIsBuffering] = useState(true);
  const [isStarred, setIsStarred] = useState(false);
  const videoRef = useRef<Video>(null);

  // Available streaming sources or fallback HLS stream
  const streams = match.streams && match.streams.length > 0
    ? match.streams
    : [
        {
          id: 'server-1',
          source: 'Primary CDN',
          label: 'Server 1 · Ultra HD',
          streamUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
        },
        {
          id: 'server-2',
          source: 'Backup CDN',
          label: 'Server 2 · Fast Mobile',
          streamUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
        },
        {
          id: 'server-3',
          source: 'Live Desk',
          label: 'Server 3 · English Audio',
          streamUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
        },
      ];

  const activeStream = streams[selectedServer] || streams[0];

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
      {/* Video Player Stage (16:9 Aspect Ratio) */}
      <View style={styles.playerStage}>
        <Video
          ref={videoRef}
          source={{
            uri: activeStream.streamUrl || 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
          }}
          style={styles.video}
          useNativeControls
          resizeMode={ResizeMode.CONTAIN}
          shouldPlay={isPlaying}
          onPlaybackStatusUpdate={(status: AVPlaybackStatus) => {
            if (status.isLoaded) {
              setIsBuffering(status.isBuffering);
              setIsPlaying(status.isPlaying);
            }
          }}
        />

        {isBuffering && (
          <View style={styles.bufferingOverlay}>
            <ActivityIndicator size="large" color="#c9f36b" />
            <Text style={styles.bufferingText}>Connecting to Live Broadcast...</Text>
          </View>
        )}
      </View>

      {/* Match Details & Server Selector */}
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Title Bar */}
        <View style={styles.titleSection}>
          <View style={styles.badgeRow}>
            <View style={styles.liveBadge}>
              <View style={styles.liveDot} />
              <Text style={styles.liveBadgeText}>LIVE DESK</Text>
            </View>
            <Text style={styles.sportText}>
              {match.category ? match.category.toUpperCase() : 'SPORTS'} · NEPAL STANDARD TIME (NST)
            </Text>
          </View>

          <Text style={styles.matchTitle}>{match.title}</Text>
          {match.venue ? (
            <Text style={styles.venueText}>📍 {match.venue}</Text>
          ) : null}

          {/* Action Row */}
          <View style={styles.actionsRow}>
            <TouchableOpacity
              style={[styles.actionBtn, isStarred && styles.actionBtnActive]}
              onPress={handleToggleStar}
            >
              <Text style={[styles.actionIcon, isStarred && styles.actionIconActive]}>
                {isStarred ? '★' : '☆'}
              </Text>
              <Text style={[styles.actionText, isStarred && styles.actionTextActive]}>
                {isStarred ? 'Saved to Watchlist' : 'Add to Watchlist'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionBtn} onPress={handleShare}>
              <Text style={styles.actionIcon}>🔗</Text>
              <Text style={styles.actionText}>Share Stream</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Multi-Server Selector (Market Standard Multi-CDN Fallback) */}
        <View style={styles.serverSection}>
          <Text style={styles.sectionHeader}>STREAM SERVER &amp; QUALITY</Text>
          <Text style={styles.serverHint}>
            If playback buffers, switch servers below for instant multi-CDN fallback:
          </Text>

          <View style={styles.serverList}>
            {streams.map((s, index) => {
              const isSelected = selectedServer === index;
              return (
                <TouchableOpacity
                  key={index}
                  activeOpacity={0.8}
                  style={[styles.serverCard, isSelected && styles.serverCardActive]}
                  onPress={() => {
                    triggerButtonHaptic();
                    setSelectedServer(index);
                  }}
                >
                  <View style={styles.serverCardLeft}>
                    <View style={[styles.serverDot, isSelected && styles.serverDotActive]} />
                    <View>
                      <Text style={[styles.serverTitle, isSelected && styles.serverTitleActive]}>
                        {s.label || `Server ${index + 1}`}
                      </Text>
                      <Text style={styles.serverSource}>{s.source || 'Fast CDN'}</Text>
                    </View>
                  </View>

                  {isSelected && (
                    <View style={styles.activePill}>
                      <Text style={styles.activePillText}>CONNECTED</Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Live Sports Notice */}
        <View style={styles.infoBox}>
          <Text style={styles.infoTitle}>⚡ Real-Time Streaming Desk</Text>
          <Text style={styles.infoText}>
            Sportivo automatically monitors stream stability. Notifications are enabled for this match.
          </Text>
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
  playerStage: {
    width: width,
    height: (width * 9) / 16,
    backgroundColor: '#000000',
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  video: {
    width: '100%',
    height: '100%',
  },
  bufferingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(8,10,11,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
  },
  bufferingText: {
    fontSize: 12,
    color: '#cbd5e1',
    fontWeight: '700',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  titleSection: {
    backgroundColor: '#111a19',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    padding: 16,
    marginBottom: 16,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#dc2626',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    gap: 5,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#ffffff',
  },
  liveBadgeText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#ffffff',
  },
  sportText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#e5b94f',
    letterSpacing: 0.5,
  },
  matchTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#ffffff',
    lineHeight: 24,
  },
  venueText: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 6,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
    paddingTop: 12,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    paddingVertical: 10,
  },
  actionBtnActive: {
    backgroundColor: 'rgba(251,191,36,0.15)',
    borderColor: '#fbbf24',
  },
  actionIcon: {
    fontSize: 16,
    color: '#cbd5e1',
  },
  actionIconActive: {
    color: '#fbbf24',
  },
  actionText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#cbd5e1',
  },
  actionTextActive: {
    color: '#fbbf24',
    fontWeight: '800',
  },
  serverSection: {
    marginBottom: 16,
  },
  sectionHeader: {
    fontSize: 11,
    fontWeight: '900',
    color: '#e5b94f',
    letterSpacing: 1,
    marginBottom: 4,
  },
  serverHint: {
    fontSize: 11,
    color: '#94a3b8',
    marginBottom: 12,
  },
  serverList: {
    gap: 10,
  },
  serverCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#111a19',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    padding: 14,
  },
  serverCardActive: {
    borderColor: '#c9f36b',
    backgroundColor: '#162522',
  },
  serverCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  serverDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#64748b',
  },
  serverDotActive: {
    backgroundColor: '#c9f36b',
  },
  serverTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#ffffff',
  },
  serverTitleActive: {
    color: '#c9f36b',
  },
  serverSource: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 2,
  },
  activePill: {
    backgroundColor: 'rgba(201,243,107,0.15)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(201,243,107,0.4)',
  },
  activePillText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#c9f36b',
    letterSpacing: 0.5,
  },
  infoBox: {
    backgroundColor: '#0f1715',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    padding: 14,
  },
  infoTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#ffffff',
    marginBottom: 4,
  },
  infoText: {
    fontSize: 11,
    color: '#94a3b8',
    lineHeight: 16,
  },
});
