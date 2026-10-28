import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Match, RootStackParamList } from '../types';
import { fetchMatches, formatKathmanduTime } from '../services/api';
import { loadPreferences, toggleStarredMatch } from '../services/storage';
import { triggerButtonHaptic } from '../services/notifications';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function CricketScreen() {
  const navigation = useNavigation<NavigationProp>();
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [starredSlugs, setStarredSlugs] = useState<string[]>([]);

  const loadData = useCallback(async () => {
    try {
      const [data, prefs] = await Promise.all([
        fetchMatches('cricket'),
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

  const renderMatchCard = ({ item }: { item: Match }) => {
    const slug = item.slug || item.title.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const isStarred = starredSlugs.includes(slug);
    const isLive = item.status === 'Live';
    const kickoff = formatKathmanduTime(item.timestamp || item.startTime || Date.now());

    return (
      <TouchableOpacity
        activeOpacity={0.88}
        onPress={() => navigation.navigate('MatchPlayer', { match: item })}
        style={[styles.card, isLive && styles.liveCard]}
      >
        <View style={styles.cardHeader}>
          <View style={styles.headerLeft}>
            {isLive ? (
              <View style={styles.liveBadge}>
                <View style={styles.liveDot} />
                <Text style={styles.liveText}>LIVE</Text>
              </View>
            ) : (
              <View style={styles.scheduledBadge}>
                <Text style={styles.scheduledText}>⏰ {kickoff} NST</Text>
              </View>
            )}
            <Text style={styles.leagueText}>Cricket</Text>
          </View>

          <TouchableOpacity
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            onPress={() => handleToggleStar(slug)}
            style={styles.starBtn}
          >
            <Text style={[styles.starIcon, isStarred && styles.starActive]}>
              {isStarred ? '★' : '☆'}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.cardBody}>
          <Text style={styles.matchTitle} numberOfLines={2}>
            {item.title}
          </Text>
          {item.venue && (
            <Text style={styles.venueText} numberOfLines={1}>
              📍 {item.venue}
            </Text>
          )}
        </View>

        <View style={styles.cardFooter}>
          <Text style={styles.footerAction}>
            {isLive ? '🏏 Watch Live Ball-by-Ball' : '⚡ View Fixture Details'} &rarr;
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {loading ? (
        <View style={styles.centerLoading}>
          <ActivityIndicator size="large" color="#c9f36b" />
          <Text style={styles.loadingText}>Loading Cricket Matches...</Text>
        </View>
      ) : (
        <FlatList
          data={matches}
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
              <Text style={styles.emptyIcon}>🏏</Text>
              <Text style={styles.emptyTitle}>No Cricket Matches Active</Text>
              <Text style={styles.emptySubtitle}>Check the NPL tab for Nepal Premier League fixtures!</Text>
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
  listContent: {
    padding: 16,
    paddingBottom: 32,
  },
  card: {
    backgroundColor: '#121c1a',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    marginBottom: 14,
    overflow: 'hidden',
  },
  liveCard: {
    borderColor: 'rgba(239,68,68,0.5)',
    backgroundColor: '#162220',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingTop: 12,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#dc2626',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    gap: 4,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#ffffff',
  },
  liveText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#ffffff',
  },
  scheduledBadge: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  scheduledText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#cbd5e1',
  },
  leagueText: {
    fontSize: 11,
    color: '#94a3b8',
    fontWeight: '600',
  },
  starBtn: {
    padding: 4,
  },
  starIcon: {
    fontSize: 18,
    color: '#64748b',
  },
  starActive: {
    color: '#fbbf24',
  },
  cardBody: {
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  matchTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#ffffff',
    lineHeight: 20,
  },
  venueText: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 6,
  },
  cardFooter: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  footerAction: {
    fontSize: 11,
    fontWeight: '800',
    color: '#c9f36b',
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
