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
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Match, RootStackParamList } from '../types';
import { fetchMatches, formatKathmanduTime } from '../services/api';
import { loadPreferences, toggleStarredMatch } from '../services/storage';
import { triggerButtonHaptic } from '../services/notifications';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const LEAGUES = [
  'All',
  'Premier League',
  'La Liga',
  'Champions League',
  'Serie A',
  'Bundesliga',
  'MLS',
];

function teamParts(title: string) {
  const parts = title.split(/\s+vs\.?\s+|\s+-\s+/i);
  return { first: parts[0]?.trim() || title, second: parts[1]?.trim() || '' };
}

export default function FootballScreen() {
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();
  const topPadding = Math.max(insets.top, Platform.OS === 'android' ? (StatusBar.currentHeight || 28) : 0) + 8;
  const [matches, setMatches] = useState<Match[]>([]);
  const [selectedLeague, setSelectedLeague] = useState('All');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [starredSlugs, setStarredSlugs] = useState<string[]>([]);

  const loadData = useCallback(async () => {
    try {
      const [data, prefs] = await Promise.all([
        fetchMatches('football'),
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
    const league = (m.league || '').toLowerCase();
    const sel = selectedLeague.toLowerCase();
    return title.includes(sel) || league.includes(sel);
  });

  const renderMatchCard = ({ item }: { item: Match }) => {
    const slug = item.slug || item.title.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const isStarred = starredSlugs.includes(slug);
    const isLive = item.status === 'Live';
    const kickoff = formatKathmanduTime(item.timestamp || item.startTime || Date.now());
    const { first, second } = teamParts(item.title);
    const homeTeam = item.teams?.home?.name || first || 'Home';
    const awayTeam = item.teams?.away?.name || second || 'Away';
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
          <Text style={styles.timeLabel}>{isLive ? 'Playing' : 'NST'}</Text>
        </View>

        {/* Center: Two Team Rows (FotMob Layout) */}
        <View style={styles.teamsColumn}>
          {/* Home Team */}
          <View style={styles.teamRow}>
            <View style={styles.teamBadge}>
              <Text style={styles.teamBadgeText}>{homeTeam.slice(0, 2).toUpperCase()}</Text>
            </View>
            <Text style={styles.teamName} numberOfLines={1}>{homeTeam}</Text>
            <Text style={styles.scoreText}>{homeScore}</Text>
          </View>

          {/* Away Team */}
          <View style={styles.teamRow}>
            <View style={styles.teamBadge}>
              <Text style={styles.teamBadgeText}>{awayTeam.slice(0, 2).toUpperCase()}</Text>
            </View>
            <Text style={styles.teamName} numberOfLines={1}>{awayTeam}</Text>
            <Text style={styles.scoreText}>{awayScore}</Text>
          </View>
        </View>

        {/* Right Action Column */}
        <View style={styles.actionColumn}>
          <TouchableOpacity
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            onPress={() => handleToggleStar(slug)}
            style={styles.starTouch}
          >
            <Ionicons
              name={isStarred ? 'bookmark' : 'bookmark-outline'}
              size={18}
              color={isStarred ? '#fbbf24' : '#64748b'}
            />
          </TouchableOpacity>
          <Ionicons name="chevron-forward" size={16} color="#64748b" />
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: topPadding }]}>
      {/* Horizontal League Filters */}
      <View style={styles.filtersBar}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.leaguesScroll}
        >
          {LEAGUES.map((league) => {
            const isSelected = selectedLeague === league;
            return (
              <TouchableOpacity
                key={league}
                onPress={() => setSelectedLeague(league)}
                style={[styles.leaguePill, isSelected && styles.leaguePillActive]}
              >
                <Text
                  style={[
                    styles.leaguePillText,
                    isSelected && styles.leaguePillTextActive,
                  ]}
                >
                  {league}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {loading ? (
        <View style={styles.centerLoading}>
          <ActivityIndicator size="large" color="#c9f36b" />
          <Text style={styles.loadingText}>Loading Football Matches...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredMatches}
          keyExtractor={(item, index) => `${item.title}-${index}`}
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
              <Ionicons name="football-outline" size={40} color="#64748b" style={{ marginBottom: 12 }} />
              <Text style={styles.emptyTitle}>No Fixtures In This League</Text>
              <Text style={styles.emptySubtitle}>Select "All" to view all worldwide fixtures.</Text>
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
  filtersBar: {
    paddingVertical: 10,
    backgroundColor: '#0c1211',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  leaguesScroll: {
    paddingHorizontal: 16,
    gap: 8,
  },
  leaguePill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  leaguePillActive: {
    backgroundColor: '#c9f36b',
    borderColor: '#c9f36b',
  },
  leaguePillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#94a3b8',
  },
  leaguePillTextActive: {
    color: '#080a0b',
    fontWeight: '900',
  },
  listContent: {
    padding: 14,
    paddingBottom: 32,
  },
  fotmobCard: {
    backgroundColor: '#0e1615',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
  },
  liveCard: {
    borderColor: 'rgba(239,68,68,0.5)',
    backgroundColor: '#161e1c',
  },
  timeColumn: {
    width: 62,
    borderRightWidth: 1,
    borderRightColor: 'rgba(255,255,255,0.08)',
    paddingRight: 8,
    alignItems: 'flex-start',
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#dc2626',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
    gap: 4,
  },
  liveDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#ffffff',
  },
  liveText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#ffffff',
  },
  kickoffText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#c9f36b',
  },
  timeLabel: {
    fontSize: 8,
    fontWeight: '700',
    color: '#94a3b8',
    marginTop: 2,
  },
  teamsColumn: {
    flex: 1,
    paddingHorizontal: 12,
    gap: 8,
  },
  teamRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  teamBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.08)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  teamBadgeText: {
    fontSize: 8,
    fontWeight: '900',
    color: '#c9f36b',
  },
  teamName: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    color: '#ffffff',
  },
  scoreText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#ffffff',
  },
  actionColumn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingLeft: 8,
    borderLeftWidth: 1,
    borderLeftColor: 'rgba(255,255,255,0.05)',
  },
  starTouch: {
    padding: 4,
  },
  starSymbol: {
    fontSize: 16,
    color: '#475569',
  },
  starActive: {
    color: '#fbbf24',
  },
  chevron: {
    fontSize: 18,
    fontWeight: '900',
    color: '#475569',
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

