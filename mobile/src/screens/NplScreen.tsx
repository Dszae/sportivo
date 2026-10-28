import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  StyleSheet,
  ActivityIndicator,
  Platform,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BookmarkIcon, CalendarIcon, FlameIcon, CricketIcon } from '../components/Icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { NplMatch, RootStackParamList } from '../types';
import { fetchNplFixtures, formatKathmanduTime, formatKathmanduDate } from '../services/api';
import { loadPreferences, toggleStarredMatch } from '../services/storage';
import { triggerButtonHaptic, autoScheduleAllMatchAlerts } from '../services/notifications';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function NplScreen() {
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();
  const topPadding = Math.max(insets.top, Platform.OS === 'android' ? (StatusBar.currentHeight || 28) : 0) + 8;
  const [fixtures, setFixtures] = useState<NplMatch[]>([]);
  const [activeTab, setActiveTab] = useState<'all' | 'today' | 'upcoming'>('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [starredSlugs, setStarredSlugs] = useState<string[]>([]);

  const loadData = useCallback(async () => {
    try {
      const [data, prefs] = await Promise.all([
        fetchNplFixtures(),
        loadPreferences(),
      ]);
      setFixtures(data);
      setStarredSlugs(prefs.starredMatches);
      // Only schedule alerts for genuinely upcoming future matches
      autoScheduleAllMatchAlerts(
        data
          .filter((f) => f.status === 'UPCOMING' && f.timestamp > Date.now())
          .map((f) => ({
            title: `${f.homeTeam} vs ${f.awayTeam}`,
            timestamp: f.timestamp,
          }))
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const handleToggleStar = async (matchId: string) => {
    await triggerButtonHaptic();
    const updated = await toggleStarredMatch(matchId);
    setStarredSlugs(updated);
    const match = fixtures.find((f) => f.id === matchId);
    if (match && updated.includes(matchId)) {
      await autoScheduleAllMatchAlerts([
        {
          title: `${match.homeTeam} vs ${match.awayTeam}`,
          timestamp: match.timestamp,
        },
      ]);
    }
  };

  const filteredFixtures = fixtures.filter((m) => {
    if (activeTab === 'today') {
      const todayStr = new Date().toISOString().split('T')[0];
      const matchStr = new Date(m.timestamp).toISOString().split('T')[0];
      return todayStr === matchStr;
    }
    if (activeTab === 'upcoming') {
      return m.status === 'UPCOMING';
    }
    return true;
  });

  const renderNplCard = ({ item }: { item: NplMatch }) => {
    const isStarred = starredSlugs.includes(item.id) || starredSlugs.includes(`npl-${item.matchNumber}`);
    const isLive = item.status === 'LIVE';
    const isCompleted = item.status === 'COMPLETED';

    return (
      <View style={[styles.card, isLive && styles.liveCard]}>
        {/* Card Header: Round & Status */}
        <View style={styles.cardHeader}>
          <Text style={styles.roundText}>{item.round} · Match {item.matchNumber}</Text>
          <View style={styles.headerRight}>
            {isLive ? (
              <View style={styles.liveBadge}>
                <View style={styles.liveDot} />
                <Text style={styles.liveText}>LIVE</Text>
              </View>
            ) : isCompleted ? (
              <View style={styles.completedBadge}>
                <Text style={styles.completedText}>FINAL</Text>
              </View>
            ) : (
              <View style={styles.upcomingBadge}>
                <Text style={styles.upcomingText}>UPCOMING</Text>
              </View>
            )}

            <TouchableOpacity
              onPress={() => handleToggleStar(item.id)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              style={styles.starBtn}
            >
              <BookmarkIcon
                size={18}
                color={isStarred ? '#fbbf24' : '#64748b'}
                fill={isStarred ? '#fbbf24' : undefined}
              />
            </TouchableOpacity>
          </View>
        </View>

        {/* Teams & Scores */}
        <View style={styles.cardBody}>
          {/* Home Team */}
          <View style={styles.teamRow}>
            <View style={styles.teamLeft}>
              <View
                style={[
                  styles.teamAvatar,
                  { backgroundColor: item.homeTeamColor || '#c9f36b' },
                ]}
              >
                <Text style={styles.teamShortText}>{item.homeTeamShort}</Text>
              </View>
              <Text style={styles.teamName} numberOfLines={1}>
                {item.homeTeam}
              </Text>
            </View>
            {item.homeScore ? (
              <Text style={styles.scoreText}>{item.homeScore}</Text>
            ) : null}
          </View>

          {/* Away Team */}
          <View style={styles.teamRow}>
            <View style={styles.teamLeft}>
              <View
                style={[
                  styles.teamAvatar,
                  { backgroundColor: item.awayTeamColor || '#38bdf8' },
                ]}
              >
                <Text style={styles.teamShortText}>{item.awayTeamShort}</Text>
              </View>
              <Text style={styles.teamName} numberOfLines={1}>
                {item.awayTeam}
              </Text>
            </View>
            {item.awayScore ? (
              <Text style={styles.scoreText}>{item.awayScore}</Text>
            ) : null}
          </View>

          {item.summary ? (
            <View style={styles.summaryBox}>
              <Text style={styles.summaryText}>{item.summary}</Text>
            </View>
          ) : null}
        </View>

        {/* Card Footer */}
        <View style={styles.cardFooter}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <CalendarIcon size={13} color="#94a3b8" />
            <Text style={styles.scheduleText}>
              {formatKathmanduDate(item.timestamp)} · {formatKathmanduTime(item.timestamp)} NST
            </Text>
          </View>

          {isLive ? (
            <TouchableOpacity
              style={styles.watchLiveBtn}
              onPress={() =>
                navigation.navigate('MatchPlayer', {
                  match: {
                    id: item.id,
                    title: `${item.homeTeam} vs ${item.awayTeam}`,
                    category: 'cricket',
                    status: 'Live',
                    venue: item.venue,
                    timestamp: item.timestamp,
                    sources: [
                      { source: 'npl', id: item.id, label: 'Action Sports HD / NPL Live' },
                    ],
                    streams: [
                      {
                        id: 'nettv-hls',
                        source: 'npl',
                        label: 'Action Sports HD (Native Stream)',
                        embedUrl: 'https://ottnlive-fstream.nettvstreamz.com/live_hls/npl_match_3/tracks-v1a1/mono.m3u8',
                        streamUrl: 'https://ottnlive-fstream.nettvstreamz.com/live_hls/npl_match_3/tracks-v1a1/mono.m3u8',
                        isDirectStream: true,
                        hd: true,
                      },
                      {
                        id: 'npl-youtube',
                        source: 'npl',
                        label: 'Official Stadium Direct (0 Delay HD)',
                        embedUrl: 'https://www.youtube-nocookie.com/embed/Z_yjma948Ug?autoplay=1&modestbranding=1&rel=0',
                        isDirectStream: false,
                        hd: true,
                      },
                      {
                        id: 'nettv-server-2',
                        source: 'npl',
                        label: 'Action Sports HD (Server 2)',
                        embedUrl: 'https://ottnlive-fstream.nettvstreamz.com/live_hls/npl_live/tracks-v1a1/mono.m3u8',
                        streamUrl: 'https://ottnlive-fstream.nettvstreamz.com/live_hls/npl_live/tracks-v1a1/mono.m3u8',
                        isDirectStream: true,
                        hd: true,
                      },
                    ],
                  },
                })
              }
            >
              <Text style={styles.watchLiveText}>Watch Live &rarr;</Text>
            </TouchableOpacity>
          ) : (
            <Text style={styles.venueShort}>TU Cricket Ground</Text>
          )}
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: topPadding }]}>
      {/* Top Banner */}
      <View style={styles.topBanner}>
        <View style={styles.nplTitleRow}>
          <FlameIcon size={24} color="#ef4444" style={{ marginRight: 8 }} />
          <View>
            <Text style={styles.nplTitle}>Nepal Premier League 2026</Text>
            <Text style={styles.nplSubtitle}>Official 32-Match Schedule · TU Cricket Ground</Text>
          </View>
        </View>

        {/* Filter Pills */}
        <View style={styles.pillsRow}>
          <TouchableOpacity
            style={[styles.pill, activeTab === 'all' && styles.pillActive]}
            onPress={() => setActiveTab('all')}
          >
            <Text style={[styles.pillText, activeTab === 'all' && styles.pillTextActive]}>
              All Matches ({fixtures.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.pill, activeTab === 'today' && styles.pillActive]}
            onPress={() => setActiveTab('today')}
          >
            <Text style={[styles.pillText, activeTab === 'today' && styles.pillTextActive]}>
              Today
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.pill, activeTab === 'upcoming' && styles.pillActive]}
            onPress={() => setActiveTab('upcoming')}
          >
            <Text style={[styles.pillText, activeTab === 'upcoming' && styles.pillTextActive]}>
              Upcoming
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {loading ? (
        <View style={styles.centerLoading}>
          <ActivityIndicator size="large" color="#ef4444" />
          <Text style={styles.loadingText}>Loading NPL Schedule...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredFixtures}
          keyExtractor={(item) => item.id}
          renderItem={renderNplCard}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#ef4444"
              colors={['#ef4444']}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <CricketIcon size={40} color="#64748b" style={{ marginBottom: 12 }} />
              <Text style={styles.emptyTitle}>No NPL Fixtures In This Tab</Text>
              <Text style={styles.emptySubtitle}>Switch to "All Matches" to see the full tournament schedule.</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#080a0b',
  },
  topBanner: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 12,
    backgroundColor: '#0f1715',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  nplTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  flagIcon: {
    fontSize: 26,
  },
  nplTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: -0.3,
  },
  nplSubtitle: {
    fontSize: 11,
    color: '#94a3b8',
    fontWeight: '600',
    marginTop: 2,
  },
  pillsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  pill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  pillActive: {
    backgroundColor: '#dc2626',
    borderColor: '#ef4444',
  },
  pillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94a3b8',
  },
  pillTextActive: {
    color: '#ffffff',
    fontWeight: '900',
  },
  listContent: {
    padding: 16,
    paddingBottom: 32,
  },
  card: {
    backgroundColor: '#111a19',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    marginBottom: 14,
    overflow: 'hidden',
  },
  liveCard: {
    borderColor: 'rgba(239,68,68,0.6)',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingTop: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
    paddingBottom: 8,
  },
  roundText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94a3b8',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#dc2626',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    gap: 4,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#ffffff',
  },
  liveText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#ffffff',
  },
  completedBadge: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  completedText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#cbd5e1',
  },
  upcomingBadge: {
    backgroundColor: 'rgba(251,191,36,0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(251,191,36,0.3)',
  },
  upcomingText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#fbbf24',
  },
  starBtn: {
    padding: 2,
  },
  starIcon: {
    fontSize: 18,
    color: '#64748b',
  },
  starActive: {
    color: '#fbbf24',
  },
  cardBody: {
    padding: 14,
  },
  teamRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  teamLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  teamAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  teamShortText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#ffffff',
  },
  teamName: {
    fontSize: 14,
    fontWeight: '800',
    color: '#ffffff',
    flex: 1,
  },
  scoreText: {
    fontSize: 14,
    fontWeight: '900',
    color: '#ffffff',
    fontVariant: ['tabular-nums'],
  },
  summaryBox: {
    backgroundColor: 'rgba(201,243,107,0.08)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginTop: 4,
  },
  summaryText: {
    fontSize: 11,
    color: '#c9f36b',
    fontWeight: '600',
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  scheduleText: {
    fontSize: 11,
    color: '#94a3b8',
    fontWeight: '600',
  },
  venueShort: {
    fontSize: 10,
    color: '#64748b',
    fontWeight: '600',
  },
  watchLiveBtn: {
    backgroundColor: '#dc2626',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  watchLiveText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#ffffff',
  },
  centerLoading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 13,
    color: '#94a3b8',
    fontWeight: '600',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 48,
    paddingHorizontal: 24,
  },
  emptyIcon: {
    fontSize: 40,
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#ffffff',
  },
  emptySubtitle: {
    fontSize: 12,
    color: '#94a3b8',
    textAlign: 'center',
    marginTop: 6,
  },
});

