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
import { fetchNplFixtures, formatKathmanduTime, formatKathmanduDate, getKathmanduDateKey } from '../services/api';
import { loadPreferences, toggleStarredMatch } from '../services/storage';
import { triggerButtonHaptic } from '../services/notifications';
import { LiveTag } from '../components/Live';
import { colors, fonts } from '../theme';

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
  };

  const filteredFixtures = fixtures.filter((m) => {
    if (activeTab === 'today') {
      return getKathmanduDateKey(Date.now()) === getKathmanduDateKey(m.timestamp);
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
              <LiveTag label="LIVE" style={styles.liveBadge} />
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
                        id: 'yonotv-primary',
                        source: 'npl',
                        label: 'Action Sports HD (YonoTV Live)',
                        embedUrl: 'https://yonotv.pages.dev/fc',
                        streamUrl: 'https://yonotv.pages.dev/fc',
                        isDirectStream: false,
                        hd: true,
                      },
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
              <Text style={styles.watchLiveText}>Watch Live →</Text>
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
    backgroundColor: colors.ink900,
  },
  topBanner: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 12,
    backgroundColor: colors.ink950,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
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
    fontFamily: fonts.sansSemibold,
    color: colors.fg,
    letterSpacing: -0.3,
  },
  nplSubtitle: {
    fontSize: 11,
    fontFamily: fonts.sansMedium,
    color: colors.fg3,
    marginTop: 2,
  },
  pillsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  pill: {
    paddingHorizontal: 12,
    minHeight: 36,
    justifyContent: 'center',
    borderRadius: 8,
    backgroundColor: colors.ink800,
    borderWidth: 1,
    borderColor: colors.lineStrong,
  },
  pillActive: {
    backgroundColor: colors.lime,
    borderColor: colors.lime,
  },
  pillText: {
    fontSize: 11,
    fontFamily: fonts.sansMedium,
    color: colors.fg2,
  },
  pillTextActive: {
    color: colors.limeInk,
  },
  listContent: {
    padding: 16,
    paddingBottom: 32,
  },
  card: {
    backgroundColor: colors.ink800,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.line,
    marginBottom: 14,
    overflow: 'hidden',
  },
  liveCard: {
    borderColor: 'rgba(229,72,77,0.6)',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingTop: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    paddingBottom: 8,
  },
  roundText: {
    fontSize: 11,
    fontFamily: fonts.sansMedium,
    color: colors.fg3,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  liveBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: 'rgba(229,72,77,0.12)',
  },
  completedBadge: {
    backgroundColor: colors.ink700,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  completedText: {
    fontSize: 9,
    fontFamily: fonts.sansMedium,
    color: colors.fg2,
  },
  upcomingBadge: {
    backgroundColor: 'rgba(76,195,138,0.1)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(76,195,138,0.24)',
  },
  upcomingText: {
    fontSize: 9,
    fontFamily: fonts.sansMedium,
    color: colors.up,
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
    fontFamily: fonts.sansSemibold,
    color: colors.fg,
  },
  teamName: {
    fontSize: 14,
    fontFamily: fonts.sansMedium,
    color: colors.fg,
    flex: 1,
  },
  scoreText: {
    fontSize: 14,
    fontFamily: fonts.monoMedium,
    color: colors.fg,
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
    fontFamily: fonts.sansMedium,
    color: colors.lime,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: colors.line,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: colors.ink900,
  },
  scheduleText: {
    fontSize: 11,
    fontFamily: fonts.mono,
    color: colors.fg2,
  },
  venueShort: {
    fontSize: 10,
    fontFamily: fonts.sansMedium,
    color: colors.fg3,
  },
  watchLiveBtn: {
    backgroundColor: colors.live,
    paddingHorizontal: 10,
    minHeight: 36,
    justifyContent: 'center',
    borderRadius: 8,
  },
  watchLiveText: {
    fontSize: 11,
    fontFamily: fonts.sansMedium,
    color: colors.black,
  },
  centerLoading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 13,
    fontFamily: fonts.sansMedium,
    color: colors.fg2,
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
    fontFamily: fonts.sansMedium,
    color: colors.fg,
  },
  emptySubtitle: {
    fontSize: 12,
    fontFamily: fonts.sans,
    color: colors.fg2,
    textAlign: 'center',
    marginTop: 6,
  },
});

