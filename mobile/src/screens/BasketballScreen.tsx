import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  StyleSheet,
  ActivityIndicator,
  Platform,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BookmarkIcon, ChevronForwardIcon, BasketballIcon } from '../components/Icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Match, RootStackParamList } from '../types';
import { fetchMatches, formatKathmanduTime } from '../services/api';
import { loadPreferences, toggleStarredMatch } from '../services/storage';
import { triggerButtonHaptic } from '../services/notifications';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const LEAGUES = [
  'All',
  'NBA',
  'EuroLeague',
  'NCAA',
  'College Basketball',
];

function teamParts(title: string) {
  const parts = title.split(/\s+vs\.?\s+|\s+at\s+|\s+-\s+/i);
  return { first: parts[0]?.trim() || title, second: parts[1]?.trim() || '' };
}

export default function BasketballScreen() {
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();
  const topPadding = insets.top || (Platform.OS === 'android' ? (StatusBar.currentHeight || 0) : 0);
  const [matches, setMatches] = useState<Match[]>([]);
  const [selectedLeague, setSelectedLeague] = useState('All');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [starredSlugs, setStarredSlugs] = useState<string[]>([]);

  const loadData = useCallback(async () => {
    try {
      const [data, prefs] = await Promise.all([
        fetchMatches('basketball'),
        loadPreferences(),
      ]);
      setMatches(data);
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

  const handleToggleStar = async (slug: string) => {
    await triggerButtonHaptic();
    const updated = await toggleStarredMatch(slug);
    setStarredSlugs(updated);
  };

  const filteredMatches = matches.filter((m) => {
    if (selectedLeague === 'All') return true;
    const title = m.title.toLowerCase();
    const league = (m.league || m.competition || '').toLowerCase();
    const sel = selectedLeague.toLowerCase();
    return title.includes(sel) || league.includes(sel);
  });

  const renderMatchCard = ({ item }: { item: Match }) => {
    const slug = item.slug || item.title.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const isStarred = starredSlugs.includes(slug);
    const matchTime = typeof item.date === 'number' ? item.date : (item.timestamp || (item.date ? new Date(item.date).getTime() : 0));
    const isLive = Boolean(
      item.status?.toLowerCase() === 'live' ||
      item.status?.toLowerCase() === 'in' ||
      (matchTime > 0 && Date.now() >= matchTime - 10 * 60 * 1000 && Date.now() <= matchTime + 150 * 60 * 1000 && item.status?.toLowerCase() !== 'final')
    );
    const kickoff = matchTime > 0 ? formatKathmanduTime(matchTime) : (isLive ? 'Live' : 'Upcoming');
    const { first, second } = teamParts(item.title);
    const homeTeam = item.teams?.home?.name || second || first || 'Team 1';
    const awayTeam = item.teams?.away?.name || first || second || 'Team 2';
    const homeScore = item.teams?.home?.score ?? '-';
    const awayScore = item.teams?.away?.score ?? '-';

    return (
      <TouchableOpacity
        activeOpacity={0.88}
        onPress={() => navigation.navigate('MatchPlayer', { match: item })}
        style={[styles.fotmobCard, isLive && styles.liveCard]}
      >
        {/* Status / Kickoff Column */}
        <View style={styles.timeColumn}>
          {isLive ? (
            <View style={styles.liveBadge}>
              <View style={styles.liveDot} />
              <Text style={styles.liveText}>LIVE</Text>
            </View>
          ) : (
            <Text style={styles.kickoffText}>{kickoff}</Text>
          )}
          <Text style={styles.tzLabel}>NST</Text>
        </View>

        {/* Teams & Scores Block */}
        <View style={styles.teamsBlock}>
          {/* Home Team */}
          <View style={styles.teamRow}>
            <View style={styles.teamNameWrapper}>
              <Text style={styles.teamNameText} numberOfLines={1}>
                {homeTeam}
              </Text>
            </View>
            <Text style={[styles.scoreText, isLive && styles.scoreActive]}>
              {homeScore}
            </Text>
          </View>

          {/* Away Team */}
          <View style={styles.teamRow}>
            <View style={styles.teamNameWrapper}>
              <Text style={styles.teamNameText} numberOfLines={1}>
                {awayTeam}
              </Text>
            </View>
            <Text style={[styles.scoreText, isLive && styles.scoreActive]}>
              {awayScore}
            </Text>
          </View>

          {/* League / Competition Tag */}
          <View style={styles.metaRow}>
            <Text style={styles.leagueTagText} numberOfLines={1}>
              {item.competition || item.league || 'Basketball'}
            </Text>
            {item.sources && item.sources.length > 0 && (
              <Text style={styles.sourcesCountText}>
                {item.sources.length} {item.sources.length === 1 ? 'stream' : 'servers'}
              </Text>
            )}
          </View>
        </View>

        {/* Action Column: Star & Watch Arrow */}
        <View style={styles.actionsColumn}>
          <TouchableOpacity
            style={styles.starTouchArea}
            onPress={() => handleToggleStar(slug)}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            accessibilityLabel={isStarred ? 'Unstar match' : 'Star match'}
          >
            <BookmarkIcon
              size={18}
              color={isStarred ? '#fbbf24' : '#64748b'}
              fill={isStarred ? '#fbbf24' : undefined}
            />
          </TouchableOpacity>
          <ChevronForwardIcon size={14} color="#64748b" />
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* Top Header */}
      <View style={[styles.screenHeader, { paddingTop: topPadding + 6 }]}>
        <View style={styles.brandRow}>
          <View style={styles.brandDot} />
          <Text style={styles.brandText}>Sportivo</Text>
          <View style={styles.headerBadge}>
            <Text style={styles.headerBadgeText}>Basketball</Text>
          </View>
        </View>
        <TouchableOpacity
          style={styles.headerChip}
          onPress={() => navigation.navigate('WatchlistTab' as any)}
        >
          <BookmarkIcon size={16} color="#94a3b8" />
          <Text style={styles.headerChipText}>Watchlist</Text>
        </TouchableOpacity>
      </View>

      {/* Screen Title & NST Subtitle */}
      <View style={styles.titleSection}>
        <Text style={styles.screenTitle}>Basketball Fixtures</Text>
        <Text style={styles.screenSubtitle}>
          NBA, EuroLeague & NCAA tip-offs converted to Nepal Standard Time
        </Text>
      </View>

      {/* League Filter Chips */}
      <View style={styles.filterSection}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterList}
        >
          {LEAGUES.map((league) => {
            const isSelected = selectedLeague === league;
            return (
              <TouchableOpacity
                key={league}
                onPress={() => setSelectedLeague(league)}
                style={[styles.filterChip, isSelected && styles.filterChipActive]}
                activeOpacity={0.7}
              >
                <Text style={[styles.filterText, isSelected && styles.filterTextActive]}>
                  {league}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Fixtures List */}
      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#c9f36b" />
          <Text style={styles.loadingText}>Syncing basketball fixtures...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredMatches}
          keyExtractor={(item, index) => item.id || item.slug || `bb-${index}`}
          renderItem={renderMatchCard}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#c9f36b"
              colors={['#c9f36b']}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <BasketballIcon size={40} color="#475569" />
              <Text style={styles.emptyTitle}>No Basketball Games Found</Text>
              <Text style={styles.emptySubtitle}>
                {selectedLeague !== 'All'
                  ? `No scheduled matches for ${selectedLeague} today.`
                  : 'Check back later for upcoming NBA & EuroLeague fixtures.'}
              </Text>
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
    backgroundColor: '#090d0b',
  },
  screenHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 10,
    backgroundColor: '#090d0b',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  brandDot: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
    backgroundColor: '#c9f36b',
  },
  brandText: {
    fontSize: 17,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: -0.3,
  },
  headerBadge: {
    backgroundColor: 'rgba(201, 243, 107, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(201, 243, 107, 0.25)',
  },
  headerBadgeText: {
    color: '#c9f36b',
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  headerChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 16,
  },
  headerChipText: {
    fontSize: 12,
    color: '#94a3b8',
    fontWeight: '600',
  },
  titleSection: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  screenTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: -0.4,
  },
  screenSubtitle: {
    fontSize: 13,
    color: '#94a3b8',
    marginTop: 4,
    lineHeight: 18,
  },
  filterSection: {
    paddingVertical: 10,
  },
  filterList: {
    paddingHorizontal: 16,
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  filterChipActive: {
    backgroundColor: '#c9f36b',
    borderColor: '#c9f36b',
  },
  filterText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#94a3b8',
  },
  filterTextActive: {
    color: '#090d0b',
    fontWeight: '700',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
    gap: 10,
  },
  fotmobCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#131b17',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.07)',
  },
  liveCard: {
    borderColor: 'rgba(201, 243, 107, 0.35)',
    backgroundColor: '#16231c',
  },
  timeColumn: {
    width: 60,
    alignItems: 'center',
    justifyContent: 'center',
    borderRightWidth: 1,
    borderRightColor: 'rgba(255, 255, 255, 0.08)',
    paddingRight: 10,
    marginRight: 12,
  },
  kickoffText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#f8fafc',
    textAlign: 'center',
  },
  tzLabel: {
    fontSize: 10,
    color: '#64748b',
    marginTop: 2,
    fontWeight: '600',
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    paddingHorizontal: 6,
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
    fontSize: 10,
    fontWeight: '800',
  },
  teamsBlock: {
    flex: 1,
    justifyContent: 'center',
  },
  teamRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 2,
  },
  teamNameWrapper: {
    flex: 1,
    marginRight: 8,
  },
  teamNameText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
  },
  scoreText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#94a3b8',
    minWidth: 20,
    textAlign: 'right',
  },
  scoreActive: {
    color: '#c9f36b',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.04)',
  },
  leagueTagText: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '500',
    flex: 1,
  },
  sourcesCountText: {
    fontSize: 10,
    color: '#38bdf8',
    fontWeight: '600',
  },
  actionsColumn: {
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: 8,
    gap: 12,
  },
  starTouchArea: {
    padding: 4,
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  loadingText: {
    color: '#94a3b8',
    fontSize: 13,
    marginTop: 12,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 24,
    gap: 8,
  },
  emptyTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
    marginTop: 8,
  },
  emptySubtitle: {
    color: '#64748b',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
});
