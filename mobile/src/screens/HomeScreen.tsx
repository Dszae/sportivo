import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  StyleSheet,
  StatusBar,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import { loadPreferences } from '../services/storage';
import { triggerButtonHaptic } from '../services/notifications';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function HomeScreen() {
  const navigation = useNavigation<any>();
  const [refreshing, setRefreshing] = useState(false);
  const [watchlistCount, setWatchlistCount] = useState(0);

  const loadData = async () => {
    try {
      const prefs = await loadPreferences();
      setWatchlistCount(prefs.starredMatches.length + prefs.favoriteTeams.length);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
    const unsubscribe = navigation.addListener('focus', () => {
      loadData();
    });
    return unsubscribe;
  }, [navigation]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const arenas = [
    {
      title: 'Football Desk',
      category: 'FootballTab',
      icon: '⚽',
      subtitle: 'Premier League, UCL, La Liga, Serie A',
      badge: 'Live Feeds',
      badgeColor: '#c9f36b',
      badgeBg: 'rgba(201, 243, 107, 0.15)',
      description: 'Real-time scores, lineups, and verified multi-server streaming links.',
    },
    {
      title: 'Nepal Premier League',
      category: 'NplTab',
      icon: '🇳🇵',
      subtitle: 'Official Season 2026 Schedule',
      badge: '32 Matches',
      badgeColor: '#ef4444',
      badgeBg: 'rgba(239, 68, 68, 0.2)',
      description: 'All 8 franchises, TU Cricket Ground Kirtipur fixtures, and ball-by-ball updates.',
    },
    {
      title: 'Cricket Desk',
      category: 'CricketTab',
      icon: '🏏',
      subtitle: 'ICC World Cups, IPL, Bilateral Series',
      badge: 'NST Scores',
      badgeColor: '#c9f36b',
      badgeBg: 'rgba(201, 243, 107, 0.15)',
      description: 'Comprehensive cricket schedules and live ball-by-ball match tracking in NST.',
    },
    {
      title: 'My Watchlist',
      category: 'WatchlistTab',
      icon: '⭐',
      subtitle: 'Followed Teams & Kickoff Alerts',
      badge: `${watchlistCount} Saved`,
      badgeColor: '#fbbf24',
      badgeBg: 'rgba(251, 191, 36, 0.18)',
      description: 'Your personalized matchday schedule with 5-minute pre-match vibration alerts.',
    },
  ];

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#080a0b" />

      {/* Top Header */}
      <View style={styles.header}>
        <View style={styles.brandRow}>
          <View style={styles.logoDotContainer}>
            <View style={styles.logoDotPing} />
            <View style={styles.logoDot} />
          </View>
          <View>
            <Text style={styles.logoText}>
              Sportivo<Text style={styles.logoAccent}>.</Text>
            </Text>
            <Text style={styles.logoSubtext}>LIVE SPORTS DESK · NEPAL</Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.settingsButton}
          onPress={() => {
            triggerButtonHaptic();
            navigation.navigate('NotificationSettings');
          }}
          activeOpacity={0.8}
        >
          <Text style={styles.settingsIcon}>🔔</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#c9f36b" />
        }
      >
        {/* Hero Spotlight Banner */}
        <View style={styles.heroCard}>
          <View style={styles.heroBadgeRow}>
            <View style={styles.liveBadge}>
              <View style={styles.liveBadgeDot} />
              <Text style={styles.liveBadgeText}>NST SYNCHRONIZED</Text>
            </View>
            <Text style={styles.timezoneText}>Asia/Kathmandu (UTC+5:45)</Text>
          </View>

          <Text style={styles.heroTitle}>Sports Hub &amp; Live Fixture Desks</Text>
          <Text style={styles.heroDescription}>
            Select your sport arena below to explore today's live kickoff times, score tracking, and streaming links without clutter.
          </Text>
        </View>

        {/* Section Heading */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionBadge}>CHOOSE YOUR ARENA</Text>
          <Text style={styles.sectionTitle}>Live Sports Portals</Text>
        </View>

        {/* Sports Arena Grid Cards */}
        {arenas.map((item) => (
          <TouchableOpacity
            key={item.category}
            style={styles.arenaCard}
            onPress={() => {
              triggerButtonHaptic();
              navigation.navigate(item.category);
            }}
            activeOpacity={0.85}
          >
            <View style={styles.arenaTopRow}>
              <Text style={styles.arenaIcon}>{item.icon}</Text>
              <View style={[styles.arenaBadge, { backgroundColor: item.badgeBg }]}>
                <Text style={[styles.arenaBadgeText, { color: item.badgeColor }]}>
                  {item.badge}
                </Text>
              </View>
            </View>

            <Text style={styles.arenaTitle}>{item.title}</Text>
            <Text style={styles.arenaSubtitle}>{item.subtitle}</Text>
            <Text style={styles.arenaDescription}>{item.description}</Text>

            <View style={styles.arenaFooter}>
              <Text style={styles.arenaCta}>Enter Desk</Text>
              <Text style={styles.arenaArrow}>→</Text>
            </View>
          </TouchableOpacity>
        ))}

        {/* Info Card */}
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>About Sportivo</Text>
          <Text style={styles.infoText}>
            Engineered by Dipesh Sapkota. Real-time scores, 5-minute pre-match notifications, and native ExoPlayer live streams.
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
    backgroundColor: '#0c1413',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  logoDotContainer: {
    width: 12,
    height: 12,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoDotPing: {
    position: 'absolute',
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#c9f36b',
    opacity: 0.5,
  },
  logoDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#c9f36b',
  },
  logoText: {
    fontSize: 20,
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: -0.5,
  },
  logoAccent: {
    color: '#c9f36b',
  },
  logoSubtext: {
    fontSize: 9,
    fontWeight: '800',
    color: '#94a3b8',
    letterSpacing: 0.8,
  },
  settingsButton: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  settingsIcon: {
    fontSize: 16,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  heroCard: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: '#0e1716',
    padding: 18,
    marginBottom: 20,
  },
  heroBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(201, 243, 107, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    gap: 5,
  },
  liveBadgeDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#c9f36b',
  },
  liveBadgeText: {
    color: '#c9f36b',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  timezoneText: {
    color: '#94a3b8',
    fontSize: 10,
    fontWeight: '600',
  },
  heroTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '900',
    marginBottom: 6,
  },
  heroDescription: {
    color: '#cbd5e1',
    fontSize: 12,
    lineHeight: 18,
  },
  sectionHeader: {
    marginBottom: 12,
  },
  sectionBadge: {
    color: '#c9f36b',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.5,
    marginBottom: 2,
  },
  sectionTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '900',
  },
  arenaCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: '#111b19',
    padding: 16,
    marginBottom: 12,
  },
  arenaTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  arenaIcon: {
    fontSize: 28,
  },
  arenaBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  arenaBadgeText: {
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  arenaTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '900',
    marginBottom: 2,
  },
  arenaSubtitle: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 6,
  },
  arenaDescription: {
    color: '#cbd5e1',
    fontSize: 12,
    lineHeight: 16,
    marginBottom: 12,
  },
  arenaFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
    paddingTop: 10,
  },
  arenaCta: {
    color: '#c9f36b',
    fontSize: 12,
    fontWeight: '800',
  },
  arenaArrow: {
    color: '#c9f36b',
    fontSize: 14,
    fontWeight: '900',
  },
  infoCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    backgroundColor: 'rgba(255,255,255,0.02)',
    padding: 14,
    marginTop: 8,
    alignItems: 'center',
  },
  infoTitle: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 4,
  },
  infoText: {
    color: '#64748b',
    fontSize: 10,
    textAlign: 'center',
    lineHeight: 14,
  },
});
