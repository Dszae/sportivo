import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  StyleSheet,
  StatusBar,
  Platform,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { FootballIcon, TrophyIcon, CricketIcon, BookmarkIcon, BellIcon, ArrowForwardIcon, InfoIcon } from '../components/Icons';
import { RootStackParamList } from '../types';
import { loadPreferences } from '../services/storage';
import { triggerButtonHaptic } from '../services/notifications';
import { checkForAppUpdate, openAppUpdate, AppVersionInfo } from '../services/updateService';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function HomeScreen() {
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();
  const [refreshing, setRefreshing] = useState(false);
  const [watchlistCount, setWatchlistCount] = useState(0);
  const [updateInfo, setUpdateInfo] = useState<AppVersionInfo | null>(null);

  const topPadding = Platform.OS === 'android' ? 24 : insets.top + 8;

  const loadData = async () => {
    try {
      const prefs = await loadPreferences();
      setWatchlistCount(prefs.starredMatches.length + prefs.favoriteTeams.length);
      const update = await checkForAppUpdate();
      if (update && update.hasUpdate) {
        setUpdateInfo(update);
      }
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
      renderIcon: () => <FootballIcon size={24} color="#c9f36b" />,
      subtitle: 'Premier League, UCL, La Liga, Serie A',
      badge: 'Live Feeds',
      badgeColor: '#c9f36b',
      badgeBg: 'rgba(201, 243, 107, 0.15)',
      description: 'Real-time scores, lineups, and verified multi-server streaming links.',
    },
    {
      title: 'Nepal Premier League',
      category: 'NplTab',
      renderIcon: () => <TrophyIcon size={24} color="#ef4444" />,
      subtitle: 'Official Season 2026 Schedule',
      badge: '32 Matches',
      badgeColor: '#ef4444',
      badgeBg: 'rgba(239, 68, 68, 0.2)',
      description: 'All 8 franchises, TU Cricket Ground Kirtipur fixtures, and ball-by-ball updates.',
    },
    {
      title: 'Cricket Desk',
      category: 'CricketTab',
      renderIcon: () => <CricketIcon size={24} color="#c9f36b" />,
      subtitle: 'ICC World Cups, IPL, Bilateral Series',
      badge: 'NST Scores',
      badgeColor: '#c9f36b',
      badgeBg: 'rgba(201, 243, 107, 0.15)',
      description: 'Comprehensive cricket schedules and live ball-by-ball match tracking in NST.',
    },
    {
      title: 'My Watchlist',
      category: 'WatchlistTab',
      renderIcon: () => <BookmarkIcon size={24} color="#fbbf24" fill="#fbbf24" />,
      subtitle: 'Followed Teams & Kickoff Alerts',
      badge: `${watchlistCount} Saved`,
      badgeColor: '#fbbf24',
      badgeBg: 'rgba(251, 191, 36, 0.18)',
      description: 'Your personalized matchday schedule with 5-minute pre-match vibration alerts.',
    },
  ];

  return (
    <View style={[styles.container, { paddingTop: topPadding }]}>
      <StatusBar barStyle="light-content" backgroundColor="#080a0b" translucent={false} />

      {/* Top Header with Safe Area Clearance */}
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

        <View style={styles.headerRightActions}>
          <TouchableOpacity
            style={styles.settingsButton}
            onPress={() => navigation.navigate('NotificationSettings')}
            accessibilityLabel="Notification Settings"
          >
            <BellIcon size={20} color="#cbd5e1" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#c9f36b"
            colors={['#c9f36b']}
          />
        }
      >
        {/* In-App Direct Update Banner */}
        {updateInfo?.hasUpdate && (
          <View style={styles.updateCard}>
            <View style={styles.updateHeaderRow}>
              <View style={styles.updateBadge}>
                <Text style={styles.updateBadgeText}>UPDATE AVAILABLE · v{updateInfo.version}</Text>
              </View>
              <TouchableOpacity onPress={() => setUpdateInfo(null)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Text style={styles.dismissBtn}>✕</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.updateTitle}>New Sportivo Version Ready</Text>
            <Text style={styles.updateNotes}>{updateInfo.releaseNotes}</Text>
            <TouchableOpacity
              style={styles.updateActionBtn}
              onPress={() => openAppUpdate(updateInfo.downloadUrl)}
            >
              <Text style={styles.updateActionText}>Update Directly (v{updateInfo.version}) &rarr;</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Hero Welcome Card */}
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

        {/* Arenas Grid */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionBadge}>CHOOSE YOUR ARENA</Text>
          <Text style={styles.sectionTitle}>Live Sports Portals</Text>
        </View>

        {arenas.map((item, index) => (
          <TouchableOpacity
            key={index}
            style={styles.arenaCard}
            activeOpacity={0.8}
            onPress={async () => {
              await triggerButtonHaptic();
              navigation.navigate(item.category as any);
            }}
          >
            <View style={styles.arenaTopRow}>
              <View style={styles.iconCircle}>
                {item.renderIcon()}
              </View>
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
              <Text style={styles.arenaActionText}>Enter Desk</Text>
              <ArrowForwardIcon size={14} color="#c9f36b" />
            </View>
          </TouchableOpacity>
        ))}

        {/* About Creator Footer Card */}
        <TouchableOpacity
          style={styles.creatorCard}
          onPress={() => navigation.navigate('AboutCreator')}
          activeOpacity={0.8}
        >
          <View style={styles.creatorHeaderRow}>
            <InfoIcon size={20} color="#c9f36b" />
            <Text style={styles.creatorHeading}>About the Creator</Text>
          </View>
          <Text style={styles.creatorDescription}>
            Sportivo was created and engineered by Dipesh Sapkota, an engineering student from Nepal. Designed to bring clean sports schedules and verified streaming to fans across Nepal.
          </Text>
          <View style={styles.creatorLinkRow}>
            <Text style={styles.creatorLinkText}>View Creator Profile &amp; Projects</Text>
            <ArrowForwardIcon size={14} color="#c9f36b" />
          </View>
        </TouchableOpacity>
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
    paddingBottom: 14,
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
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  creatorHeaderBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: '#c9f36b',
  },
  headerAvatar: {
    width: '100%',
    height: '100%',
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
  updateCard: {
    backgroundColor: '#122216',
    borderWidth: 1.5,
    borderColor: '#c9f36b',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#c9f36b',
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 3,
  },
  updateHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  updateBadge: {
    backgroundColor: 'rgba(201, 243, 107, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  updateBadgeText: {
    color: '#c9f36b',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  dismissBtn: {
    color: '#94a3b8',
    fontSize: 16,
    paddingHorizontal: 6,
  },
  updateTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#ffffff',
    marginBottom: 4,
  },
  updateNotes: {
    fontSize: 12,
    color: '#cbd5e1',
    lineHeight: 18,
    marginBottom: 12,
  },
  updateActionBtn: {
    backgroundColor: '#c9f36b',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  updateActionText: {
    color: '#080a0b',
    fontSize: 12,
    fontWeight: '900',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  creatorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0e1716',
    borderWidth: 1,
    borderColor: 'rgba(201, 243, 107, 0.3)',
    borderRadius: 16,
    padding: 12,
    marginBottom: 16,
  },
  bannerAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: '#c9f36b',
    marginRight: 12,
  },
  bannerInfo: {
    flex: 1,
  },
  bannerBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  bannerBadgeText: {
    color: '#94a3b8',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(201, 243, 107, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 8,
  },
  verifiedText: {
    color: '#c9f36b',
    fontSize: 9,
    fontWeight: '900',
  },
  bannerName: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '900',
  },
  bannerSubtext: {
    color: '#94a3b8',
    fontSize: 10,
    fontWeight: '600',
    marginTop: 1,
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
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  arenaBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  arenaBadgeText: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  arenaTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '900',
    marginBottom: 3,
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
    lineHeight: 17,
    marginBottom: 14,
  },
  arenaFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
    paddingTop: 10,
  },
  arenaActionText: {
    color: '#c9f36b',
    fontSize: 12,
    fontWeight: '900',
  },
  creatorCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: '#0e1716',
    padding: 16,
    marginTop: 8,
  },
  creatorHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  creatorHeading: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '900',
  },
  creatorDescription: {
    color: '#cbd5e1',
    fontSize: 11,
    lineHeight: 17,
    marginBottom: 10,
  },
  creatorLinkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  creatorLinkText: {
    color: '#c9f36b',
    fontSize: 11,
    fontWeight: '800',
  },
});
