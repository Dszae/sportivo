import React, { useEffect, useState, useCallback, useMemo } from 'react';
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
  Image,
  TextInput,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  SearchIcon,
  BookmarkIcon,
  CalendarIcon,
  CricketIcon,
  LocationIcon,
} from '../components/Icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { NplMatch, RootStackParamList } from '../types';
import {
  fetchNplFixtures,
  formatKathmanduTime,
  formatKathmanduDate,
  getKathmanduDateKey,
} from '../services/api';
import { loadPreferences, toggleStarredMatch } from '../services/storage';
import { triggerButtonHaptic } from '../services/notifications';
import { LiveDot } from '../components/Live';
import { colors, fonts, radius } from '../theme';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type Tab = 'today' | 'upcoming' | 'all';

function TeamCrest({
  uri,
  name,
  short,
  color,
  size = 34,
}: {
  uri?: string;
  name: string;
  short: string;
  color?: string;
  size?: number;
}) {
  const [failed, setFailed] = useState(false);

  if (uri && !failed) {
    return (
      <Image
        source={{ uri }}
        style={{ width: size, height: size, resizeMode: 'contain' }}
        onError={() => setFailed(true)}
      />
    );
  }

  return (
    <View
      style={[
        styles.avatarFallback,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color || colors.ink600,
        },
      ]}
      accessibilityLabel={name}
    >
      <Text style={styles.avatarFallbackText}>{short || name.slice(0, 3).toUpperCase()}</Text>
    </View>
  );
}

export default function NplScreen() {
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();
  const topPadding = Math.max(insets.top, Platform.OS === 'android' ? (StatusBar.currentHeight || 28) : 0) + 8;

  const [fixtures, setFixtures] = useState<NplMatch[]>([]);
  const [activeTab, setActiveTab] = useState<Tab>('today');
  const [query, setQuery] = useState('');
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

  const handleToggleStar = async (matchId: string, matchNumber: number) => {
    await triggerButtonHaptic();
    const slug = `npl-match-${matchNumber}`;
    const updated = await toggleStarredMatch(matchId || slug);
    setStarredSlugs(updated);
  };

  // Grouping & live fixture calculations
  const todayYmd = useMemo(() => getKathmanduDateKey(Date.now()), []);

  const { todayMatches, upcomingMatches, allMatches } = useMemo(() => {
    const today: NplMatch[] = [];
    const upcoming: NplMatch[] = [];
    const sorted = [...fixtures].sort((a, b) => a.timestamp - b.timestamp);
    const nowMs = Date.now();

    for (const match of sorted) {
      const matchYmd = getKathmanduDateKey(match.timestamp);
      if (matchYmd === todayYmd) {
        today.push(match);
      } else if (match.timestamp > nowMs && match.status !== 'COMPLETED') {
        upcoming.push(match);
      }
    }

    return {
      todayMatches: today,
      upcomingMatches: upcoming,
      allMatches: sorted,
    };
  }, [fixtures, todayYmd]);

  // Compute live fixture for Hero Banner: strictly auto-hides if match is COMPLETED
  const liveFixture = useMemo(() => {
    const nowMs = Date.now();
    return fixtures.find((m) => {
      if (m.status === 'COMPLETED') return false;
      if (m.status === 'LIVE') return true;
      return nowMs >= m.timestamp - 15 * 60 * 1000 && nowMs <= m.timestamp + 3.75 * 3600 * 1000;
    });
  }, [fixtures]);

  // Filter list based on selected tab and search query
  const displayedMatches = useMemo(() => {
    let list: NplMatch[] = [];
    if (activeTab === 'today') list = todayMatches;
    else if (activeTab === 'upcoming') list = upcomingMatches;
    else list = allMatches;

    if (!query.trim()) return list;
    const q = query.toLowerCase();
    return list.filter(
      (m) =>
        m.homeTeam.toLowerCase().includes(q) ||
        m.awayTeam.toLowerCase().includes(q) ||
        (m.round && m.round.toLowerCase().includes(q)) ||
        (m.venue && m.venue.toLowerCase().includes(q))
    );
  }, [activeTab, allMatches, query, todayMatches, upcomingMatches]);

  const renderHeader = () => {
    return (
      <View>
        {/* Top Live Match Hero Banner (Auto-dismisses when match completes) */}
        {liveFixture && (
          <View style={styles.heroBanner}>
            <View style={styles.heroTopRow}>
              <View style={styles.heroLiveBeacon}>
                <LiveDot size={8} style={{ marginRight: 6 }} />
                <Text style={styles.heroBeaconText}>MATCH HAPPENING RIGHT NOW</Text>
              </View>
              <Text style={styles.heroMatchMeta}>
                Match {liveFixture.matchNumber} · TU Cricket Ground
              </Text>
            </View>

            <View style={styles.heroCategoryRow}>
              <View style={styles.heroLivePill}>
                <Text style={styles.heroLivePillText}>🔴 LIVE ON AIR</Text>
              </View>
              <Text style={styles.heroTournamentText}>Nepal Premier League 2026</Text>
            </View>

            <View style={styles.heroTeamsContainer}>
              <View style={styles.heroTeamSide}>
                <TeamCrest
                  uri={liveFixture.homeTeamLogo}
                  name={liveFixture.homeTeam}
                  short={liveFixture.homeTeamShort}
                  color={liveFixture.homeTeamColor}
                  size={42}
                />
                <Text style={styles.heroTeamName} numberOfLines={1}>
                  {liveFixture.homeTeam}
                </Text>
                {liveFixture.homeScore ? (
                  <Text style={styles.heroScoreText}>{liveFixture.homeScore}</Text>
                ) : null}
              </View>

              <Text style={styles.heroVs}>vs</Text>

              <View style={styles.heroTeamSide}>
                <TeamCrest
                  uri={liveFixture.awayTeamLogo}
                  name={liveFixture.awayTeam}
                  short={liveFixture.awayTeamShort}
                  color={liveFixture.awayTeamColor}
                  size={42}
                />
                <Text style={styles.heroTeamName} numberOfLines={1}>
                  {liveFixture.awayTeam}
                </Text>
                {liveFixture.awayScore ? (
                  <Text style={styles.heroScoreText}>{liveFixture.awayScore}</Text>
                ) : null}
              </View>
            </View>

            {liveFixture.summary ? (
              <View style={styles.heroSummaryBox}>
                <Text style={styles.heroSummaryText}>{liveFixture.summary}</Text>
              </View>
            ) : null}

            <View style={styles.heroScheduleLine}>
              <Text style={styles.heroKickoffText}>
                📅 Today • Kickoff: {formatKathmanduTime(liveFixture.timestamp)}
              </Text>
              <Text style={styles.heroBroadcastText}>
                Broadcasting live on Action Sports HD & Multi-Server Digital Stream
              </Text>
            </View>

            <TouchableOpacity
              style={styles.heroWatchBtn}
              activeOpacity={0.88}
              onPress={() => {
                triggerButtonHaptic();
                navigation.navigate('MatchPlayer', {
                  match: {
                    id: liveFixture.id,
                    title: `${liveFixture.homeTeam} vs ${liveFixture.awayTeam}`,
                    category: 'cricket',
                    status: 'Live',
                    venue: liveFixture.venue,
                    timestamp: liveFixture.timestamp,
                    sources: [
                      { source: 'npl', id: liveFixture.id, label: 'Action Sports HD / NPL Live' },
                    ],
                  },
                });
              }}
            >
              <Text style={styles.heroWatchBtnText}>🔴 Watch Live Stream ⚡</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Tournament Header */}
        <View style={styles.tournamentHeader}>
          <View style={styles.titleRow}>
            <View style={styles.nplBadge}>
              <Text style={styles.nplBadgeText}>NPL</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.tournamentTitle}>Nepal Premier League (NPL) 2026</Text>
            </View>
            {liveFixture && (
              <View style={styles.liveOnAirTag}>
                <LiveDot size={6} style={{ marginRight: 4 }} />
                <Text style={styles.liveOnAirText}>LIVE</Text>
              </View>
            )}
          </View>
          <Text style={styles.tournamentSubtitle}>
            Official Season Fixtures, Live Scores & Broadcasting Desk — Synced to Nepal Standard Time (NST / UTC+5:45)
          </Text>
        </View>

        {/* Search Bar */}
        <View style={styles.searchBar}>
          <SearchIcon size={16} color="#64748b" style={styles.searchIcon} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search teams or round..."
            placeholderTextColor="#64748b"
            style={styles.searchInput}
            returnKeyType="search"
          />
          {query ? (
            <TouchableOpacity
              onPress={() => setQuery('')}
              style={styles.clearSearchBtn}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={styles.clearSearchText}>✕</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Filter Pills with Counts */}
        <View style={styles.pillsRow}>
          <TouchableOpacity
            style={[styles.pill, activeTab === 'today' && styles.pillActive]}
            onPress={() => {
              triggerButtonHaptic();
              setActiveTab('today');
            }}
          >
            <Text style={[styles.pillText, activeTab === 'today' && styles.pillTextActive]}>
              Today's Matches
            </Text>
            <View style={[styles.pillCount, activeTab === 'today' && styles.pillCountActive]}>
              <Text style={[styles.pillCountText, activeTab === 'today' && styles.pillCountTextActive]}>
                {todayMatches.length}
              </Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.pill, activeTab === 'upcoming' && styles.pillActive]}
            onPress={() => {
              triggerButtonHaptic();
              setActiveTab('upcoming');
            }}
          >
            <Text style={[styles.pillText, activeTab === 'upcoming' && styles.pillTextActive]}>
              Upcoming Fixtures
            </Text>
            <View style={[styles.pillCount, activeTab === 'upcoming' && styles.pillCountActive]}>
              <Text style={[styles.pillCountText, activeTab === 'upcoming' && styles.pillCountTextActive]}>
                {upcomingMatches.length}
              </Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.pill, activeTab === 'all' && styles.pillActive]}
            onPress={() => {
              triggerButtonHaptic();
              setActiveTab('all');
            }}
          >
            <Text style={[styles.pillText, activeTab === 'all' && styles.pillTextActive]}>
              All Season Matches
            </Text>
            <View style={[styles.pillCount, activeTab === 'all' && styles.pillCountActive]}>
              <Text style={[styles.pillCountText, activeTab === 'all' && styles.pillCountTextActive]}>
                {allMatches.length}
              </Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Venue Location Indicator */}
        <View style={styles.venueRow}>
          <View style={styles.venueDot} />
          <Text style={styles.venueText}>TU International Cricket Ground, Kirtipur</Text>
        </View>
      </View>
    );
  };

  const renderNplCard = ({ item }: { item: NplMatch }) => {
    const isStarred =
      starredSlugs.includes(item.id) || starredSlugs.includes(`npl-match-${item.matchNumber}`);
    const isLive = item.status === 'LIVE';
    const isCompleted = item.status === 'COMPLETED';

    return (
      <View style={[styles.card, isLive && styles.cardLive]}>
        {/* Card Header: Round, Watchlist, Status */}
        <View style={styles.cardHeader}>
          <Text style={styles.roundText}>
            Match {item.matchNumber} · {item.round}
          </Text>

          <View style={styles.cardHeaderRight}>
            <TouchableOpacity
              onPress={() => handleToggleStar(item.id, item.matchNumber)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={[styles.watchlistBtn, isStarred && styles.watchlistBtnActive]}
            >
              <BookmarkIcon
                size={14}
                color={isStarred ? '#c9f36b' : '#64748b'}
                fill={isStarred ? '#c9f36b' : undefined}
                style={{ marginRight: 4 }}
              />
              <Text style={[styles.watchlistText, isStarred && styles.watchlistTextActive]}>
                {isStarred ? 'Saved' : 'Watchlist'}
              </Text>
            </TouchableOpacity>

            {isLive ? (
              <View style={styles.liveBadge}>
                <LiveDot size={6} style={{ marginRight: 4 }} />
                <Text style={styles.liveBadgeText}>LIVE</Text>
              </View>
            ) : isCompleted ? (
              <View style={styles.completedBadge}>
                <Text style={styles.completedBadgeText}>COMPLETED</Text>
              </View>
            ) : (
              <View style={styles.upcomingBadge}>
                <Text style={styles.upcomingBadgeText}>UPCOMING</Text>
              </View>
            )}
          </View>
        </View>

        {/* Teams and Scores */}
        <View style={styles.teamsSection}>
          {/* Home Team */}
          <View style={styles.teamRow}>
            <View style={styles.teamInfo}>
              <TeamCrest
                uri={item.homeTeamLogo}
                name={item.homeTeam}
                short={item.homeTeamShort}
                color={item.homeTeamColor}
                size={34}
              />
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
            <View style={styles.teamInfo}>
              <TeamCrest
                uri={item.awayTeamLogo}
                name={item.awayTeam}
                short={item.awayTeamShort}
                color={item.awayTeamColor}
                size={34}
              />
              <Text style={styles.teamName} numberOfLines={1}>
                {item.awayTeam}
              </Text>
            </View>
            {item.awayScore ? (
              <Text style={styles.scoreText}>{item.awayScore}</Text>
            ) : null}
          </View>

          {/* Summary / Result Box */}
          {item.summary ? (
            <View style={styles.summaryContainer}>
              <Text style={styles.summaryText}>{item.summary}</Text>
            </View>
          ) : null}
        </View>

        {/* Schedule & Venue */}
        <View style={styles.scheduleRow}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <CalendarIcon size={12} color="#94a3b8" />
            <Text style={styles.scheduleDateText}>
              {formatKathmanduDate(item.timestamp)} • {formatKathmanduTime(item.timestamp)}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
            <LocationIcon size={11} color="#64748b" />
            <Text style={styles.venueShortText}>TU Ground</Text>
          </View>
        </View>

        {/* Card Footer Actions */}
        <View style={styles.cardFooter}>
          <TouchableOpacity
            style={styles.detailsBtn}
            onPress={() => {
              triggerButtonHaptic();
              navigation.navigate('MatchPlayer', {
                match: {
                  id: item.id,
                  title: `${item.homeTeam} vs ${item.awayTeam}`,
                  category: 'cricket',
                  status: isLive ? 'Live' : isCompleted ? 'Final' : 'Upcoming',
                  venue: item.venue,
                  timestamp: item.timestamp,
                  sources: [
                    { source: 'npl', id: item.id, label: 'Action Sports HD / NPL Live' },
                  ],
                },
              });
            }}
          >
            <Text style={styles.detailsBtnText}>Match Details →</Text>
          </TouchableOpacity>

          {isLive ? (
            <TouchableOpacity
              style={styles.watchLiveBtn}
              activeOpacity={0.88}
              onPress={() => {
                triggerButtonHaptic();
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
                  },
                });
              }}
            >
              <Text style={styles.watchLiveBtnText}>🔴 Watch Live</Text>
            </TouchableOpacity>
          ) : isCompleted ? (
            <Text style={styles.statusFooterConcluded}>Match Concluded</Text>
          ) : (
            <Text style={styles.statusFooterUpcoming}>
              Starts at {formatKathmanduTime(item.timestamp)}
            </Text>
          )}
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: topPadding }]}>
      {loading ? (
        <View style={styles.centerLoading}>
          <ActivityIndicator size="large" color="#ef4444" />
          <Text style={styles.loadingText}>Loading NPL Season Fixtures...</Text>
        </View>
      ) : (
        <FlatList
          data={displayedMatches}
          keyExtractor={(item) => item.id}
          renderItem={renderNplCard}
          ListHeaderComponent={renderHeader}
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
              <CricketIcon size={44} color="#64748b" style={{ marginBottom: 12 }} />
              <Text style={styles.emptyTitle}>
                {query ? `No matches found for "${query}"` : 'No Fixtures In This Tab'}
              </Text>
              <Text style={styles.emptySubtitle}>
                {query
                  ? 'Try searching by another team name or match round.'
                  : 'Check "All Season Matches" to see the full 32-match NPL schedule.'}
              </Text>
              {query ? (
                <TouchableOpacity onPress={() => setQuery('')} style={styles.emptyActionBtn}>
                  <Text style={styles.emptyActionText}>Clear Search</Text>
                </TouchableOpacity>
              ) : null}
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
    backgroundColor: '#0a0d0c',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  centerLoading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#94a3b8',
    fontFamily: fonts.sansMedium,
  },

  /* Hero Live Banner */
  heroBanner: {
    backgroundColor: '#150808',
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: 'rgba(239, 68, 68, 0.45)',
    padding: 16,
    marginBottom: 18,
    marginTop: 8,
    shadowColor: '#ef4444',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 4,
  },
  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  heroLiveBeacon: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  heroBeaconText: {
    color: '#ef4444',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  heroMatchMeta: {
    color: '#94a3b8',
    fontSize: 12,
    fontFamily: fonts.mono,
  },
  heroCategoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  heroLivePill: {
    backgroundColor: '#ef4444',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  heroLivePillText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
  },
  heroTournamentText: {
    color: '#cbd5e1',
    fontSize: 12,
    fontWeight: '500',
  },
  heroTeamsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginVertical: 6,
  },
  heroTeamSide: {
    flex: 1,
    alignItems: 'center',
  },
  heroTeamName: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
    marginTop: 6,
    textAlign: 'center',
  },
  heroScoreText: {
    color: '#c9f36b',
    fontSize: 14,
    fontFamily: fonts.mono,
    fontWeight: '700',
    marginTop: 2,
  },
  heroVs: {
    color: '#ef4444',
    fontSize: 14,
    fontWeight: '800',
    marginHorizontal: 8,
  },
  heroSummaryBox: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderRadius: 8,
    padding: 8,
    marginTop: 10,
  },
  heroSummaryText: {
    color: '#fca5a5',
    fontSize: 12,
    textAlign: 'center',
    fontFamily: fonts.sansMedium,
  },
  heroScheduleLine: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(239, 68, 68, 0.2)',
  },
  heroKickoffText: {
    color: '#edf0ee',
    fontSize: 12,
    fontFamily: fonts.mono,
  },
  heroBroadcastText: {
    color: '#64748b',
    fontSize: 11,
    marginTop: 2,
  },
  heroWatchBtn: {
    backgroundColor: '#ef4444',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 14,
    shadowColor: '#ef4444',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 3,
  },
  heroWatchBtnText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },

  /* Tournament Header Section */
  tournamentHeader: {
    marginBottom: 14,
    marginTop: 4,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  nplBadge: {
    backgroundColor: '#ef4444',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  nplBadgeText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  tournamentTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '700',
  },
  liveOnAirTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
  },
  liveOnAirText: {
    color: '#ef4444',
    fontSize: 10,
    fontWeight: '700',
  },
  tournamentSubtitle: {
    color: '#94a3b8',
    fontSize: 12,
    lineHeight: 16,
    marginTop: 2,
  },

  /* Search Bar */
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#141817',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(237, 240, 238, 0.08)',
    paddingHorizontal: 12,
    height: 42,
    marginBottom: 12,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    color: '#ffffff',
    fontSize: 14,
    paddingVertical: 0,
  },
  clearSearchBtn: {
    padding: 4,
  },
  clearSearchText: {
    color: '#94a3b8',
    fontSize: 12,
  },

  /* Filter Pills */
  pillsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  pill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#141817',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(237, 240, 238, 0.08)',
    paddingVertical: 8,
    paddingHorizontal: 8,
    gap: 6,
  },
  pillActive: {
    backgroundColor: '#c9f36b',
    borderColor: '#c9f36b',
  },
  pillText: {
    color: '#94a3b8',
    fontSize: 12,
    fontFamily: fonts.sansMedium,
  },
  pillTextActive: {
    color: '#0a1110',
    fontWeight: '700',
  },
  pillCount: {
    backgroundColor: 'rgba(237, 240, 238, 0.08)',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 10,
  },
  pillCountActive: {
    backgroundColor: '#0a1110',
  },
  pillCountText: {
    color: '#94a3b8',
    fontSize: 11,
    fontFamily: fonts.mono,
  },
  pillCountTextActive: {
    color: '#c9f36b',
    fontWeight: '700',
  },

  /* Venue Row */
  venueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
    gap: 6,
  },
  venueDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#4cc38a',
  },
  venueText: {
    color: '#94a3b8',
    fontSize: 12,
  },

  /* Match Card */
  card: {
    backgroundColor: '#141817',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(237, 240, 238, 0.08)',
    marginBottom: 14,
    overflow: 'hidden',
  },
  cardLive: {
    borderColor: 'rgba(239, 68, 68, 0.55)',
    backgroundColor: '#181111',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(237, 240, 238, 0.06)',
  },
  roundText: {
    color: '#94a3b8',
    fontSize: 12,
    fontFamily: fonts.sansMedium,
  },
  cardHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  watchlistBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(237, 240, 238, 0.04)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  watchlistBtnActive: {
    backgroundColor: 'rgba(201, 243, 107, 0.12)',
  },
  watchlistText: {
    color: '#64748b',
    fontSize: 11,
    fontWeight: '500',
  },
  watchlistTextActive: {
    color: '#c9f36b',
    fontWeight: '600',
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  liveBadgeText: {
    color: '#ef4444',
    fontSize: 11,
    fontWeight: '700',
  },
  completedBadge: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  completedBadgeText: {
    color: '#fbbf24',
    fontSize: 10,
    fontWeight: '700',
  },
  upcomingBadge: {
    backgroundColor: 'rgba(148, 163, 184, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  upcomingBadgeText: {
    color: '#94a3b8',
    fontSize: 10,
    fontWeight: '600',
  },

  /* Teams Section */
  teamsSection: {
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  teamRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  teamInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 10,
  },
  teamName: {
    color: '#edf0ee',
    fontSize: 15,
    fontWeight: '600',
    flex: 1,
  },
  scoreText: {
    color: '#edf0ee',
    fontSize: 14,
    fontFamily: fonts.mono,
    fontWeight: '700',
  },
  summaryContainer: {
    backgroundColor: 'rgba(237, 240, 238, 0.04)',
    borderRadius: 8,
    padding: 8,
    marginTop: 6,
  },
  summaryText: {
    color: '#94a3b8',
    fontSize: 12,
    fontFamily: fonts.sansMedium,
  },

  /* Schedule Row */
  scheduleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(237, 240, 238, 0.06)',
  },
  scheduleDateText: {
    color: '#94a3b8',
    fontSize: 12,
    fontFamily: fonts.mono,
  },
  venueShortText: {
    color: '#64748b',
    fontSize: 11,
  },

  /* Card Footer Actions */
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(237, 240, 238, 0.06)',
    backgroundColor: 'rgba(0, 0, 0, 0.15)',
  },
  detailsBtn: {
    paddingVertical: 4,
  },
  detailsBtnText: {
    color: '#94a3b8',
    fontSize: 13,
    fontFamily: fonts.sansMedium,
  },
  watchLiveBtn: {
    backgroundColor: '#ef4444',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 8,
  },
  watchLiveBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  statusFooterConcluded: {
    color: '#64748b',
    fontSize: 12,
    fontFamily: fonts.sansMedium,
  },
  statusFooterUpcoming: {
    color: '#94a3b8',
    fontSize: 12,
    fontFamily: fonts.mono,
  },

  /* Crest / Avatar Fallback */
  avatarFallback: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarFallbackText: {
    color: '#edf0ee',
    fontSize: 11,
    fontWeight: '700',
  },

  /* Empty State */
  emptyContainer: {
    paddingVertical: 48,
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  emptyTitle: {
    color: '#edf0ee',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
    textAlign: 'center',
  },
  emptySubtitle: {
    color: '#64748b',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
  emptyActionBtn: {
    marginTop: 14,
    backgroundColor: '#1e2321',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  emptyActionText: {
    color: '#c9f36b',
    fontSize: 13,
    fontWeight: '600',
  },
});
