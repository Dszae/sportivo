import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Image,
  RefreshControl,
  StyleSheet,
  ActivityIndicator,
  StatusBar,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Match, RootStackParamList } from '../types';
import { fetchMatches, formatKathmanduTime } from '../services/api';
import { loadPreferences, toggleStarredMatch } from '../services/storage';
import { triggerButtonHaptic } from '../services/notifications';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function HomeScreen() {
  const navigation = useNavigation<NavigationProp>();
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [starredSlugs, setStarredSlugs] = useState<string[]>([]);

  const loadData = useCallback(async () => {
    try {
      const [football, cricket, basketball, prefs] = await Promise.all([
        fetchMatches('football'),
        fetchMatches('cricket'),
        fetchMatches('basketball'),
        loadPreferences(),
      ]);

      setStarredSlugs(prefs.starredMatches);
      const combined = [...football, ...cricket, ...basketball].sort((a, b) => {
        // Live matches first
        if (a.status === 'Live' && b.status !== 'Live') return -1;
        if (b.status === 'Live' && a.status !== 'Live') return 1;
        return (a.timestamp || 0) - (b.timestamp || 0);
      });

      setMatches(combined);
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

  const liveMatches = matches.filter((m) => m.status === 'Live');
  const upcomingMatches = matches.filter((m) => m.status !== 'Live' && m.status !== 'Final');

  const renderMatchCard = ({ item }: { item: Match }) => {
    const slug = item.slug || item.title.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const isStarred = starredSlugs.includes(slug);
    const isLive = item.status === 'Live';
    const kickoffFormatted = formatKathmanduTime(item.timestamp || item.startTime || Date.now());

    return (
      <TouchableOpacity
        activeOpacity={0.88}
        onPress={() => navigation.navigate('MatchPlayer', { match: item })}
        style={[styles.card, isLive && styles.liveCard]}
      >
        {/* Card Header */}
        <View style={styles.cardHeader}>
          <View style={styles.headerLeft}>
            {isLive ? (
              <View style={styles.liveBadge}>
                <View style={styles.liveDot} />
                <Text style={styles.liveText}>LIVE</Text>
              </View>
            ) : (
              <View style={styles.scheduledBadge}>
                <Text style={styles.scheduledText}>⏰ {kickoffFormatted} NST</Text>
              </View>
            )}
            <Text style={styles.sportBadge}>
              {item.category === 'football' ? '⚽ Football' : item.category === 'cricket' ? '🏏 Cricket' : '🏀 Basketball'}
            </Text>
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

        {/* Card Body: Teams & Match Title */}
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

        {/* Card Footer: Watch Action */}
        <View style={styles.cardFooter}>
          <Text style={styles.footerAction}>
            {isLive ? '📺 Watch Live Stream & Score' : '⚡ View Fixture & Commentary'} &rarr;
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#080a0b" />

      {/* Top Header */}
      <View style={styles.topBar}>
        <View>
          <View style={styles.brandRow}>
            <View style={styles.brandDot} />
            <Text style={styles.brandText}>Sportivo<Text style={styles.brandAccent}>.</Text></Text>
            <View style={styles.nepalPill}>
              <Text style={styles.nepalText}>NEPAL</Text>
            </View>
          </View>
          <Text style={styles.tagline}>Live Sports Desk · Nepal Standard Time</Text>
        </View>

        <TouchableOpacity
          onPress={() => navigation.navigate('NotificationSettings')}
          style={styles.settingsBtn}
        >
          <Text style={styles.settingsIcon}>🔔</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.centerLoading}>
          <ActivityIndicator size="large" color="#c9f36b" />
          <Text style={styles.loadingText}>Loading Live Fixtures...</Text>
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
          ListHeaderComponent={
            liveMatches.length > 0 ? (
              <View style={styles.liveHeaderSection}>
                <View style={styles.livePulseRow}>
                  <View style={styles.pulsingRedDot} />
                  <Text style={styles.liveSectionTitle}>LIVE BROADCASTS NOW ({liveMatches.length})</Text>
                </View>
              </View>
            ) : null
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyIcon}>🏟️</Text>
              <Text style={styles.emptyTitle}>No Live Broadcasts Right Now</Text>
              <Text style={styles.emptySubtitle}>
                Pull down to refresh or check upcoming match schedules below.
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
    backgroundColor: '#080a0b',
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
    backgroundColor: '#0c1211',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  brandDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#c9f36b',
  },
  brandText: {
    fontSize: 22,
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: -0.5,
  },
  brandAccent: {
    color: '#c9f36b',
  },
  nepalPill: {
    backgroundColor: 'rgba(229,185,79,0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(229,185,79,0.3)',
  },
  nepalText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#e5b94f',
  },
  tagline: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 2,
    fontWeight: '600',
  },
  settingsBtn: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  settingsIcon: {
    fontSize: 16,
  },
  listContent: {
    padding: 16,
    paddingBottom: 32,
  },
  liveHeaderSection: {
    marginBottom: 12,
  },
  livePulseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pulsingRedDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ef4444',
  },
  liveSectionTitle: {
    fontSize: 12,
    fontWeight: '900',
    color: '#f87171',
    letterSpacing: 0.8,
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
  sportBadge: {
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
    lineHeight: 18,
  },
});
