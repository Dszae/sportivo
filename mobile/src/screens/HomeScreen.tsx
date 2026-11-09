import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  BookmarkIcon,
  BellIcon,
  FootballIcon,
  CricketIcon,
  TrophyIcon,
  ChevronForwardIcon,
  BasketballIcon,
} from '../components/Icons';
import { Match, NplMatch, RootStackParamList } from '../types';
import { fetchMatches, fetchNplFixtures, formatKathmanduTime, formatKathmanduDate } from '../services/api';
import { loadPreferences } from '../services/storage';
import { triggerButtonHaptic } from '../services/notifications';
import { checkForAppUpdate, downloadAndInstallUpdate, installCachedApk, AppVersionInfo } from '../services/updateService';
import { LiveDot } from '../components/Live';
import { colors, fonts, radius } from '../theme';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const HERO_IMAGE =
  'https://images.unsplash.com/photo-1574629810360-7efbbe195018?q=80&w=2000&auto=format&fit=crop';

function nstClock() {
  try {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Kathmandu',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).format(new Date()) + ' NST';
  } catch {
    return 'NST';
  }
}

export default function HomeScreen() {
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();
  const topPadding = insets.top || (Platform.OS === 'android' ? (StatusBar.currentHeight || 0) : 0);

  const [refreshing, setRefreshing] = useState(false);
  const [watchlistCount, setWatchlistCount] = useState(0);
  const [updateInfo, setUpdateInfo] = useState<AppVersionInfo | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [isReadyToInstall, setIsReadyToInstall] = useState(false);

  const [currentTime, setCurrentTime] = useState(nstClock());
  const [footballMatches, setFootballMatches] = useState<Match[]>([]);
  const [cricketMatches, setCricketMatches] = useState<Match[]>([]);
  const [basketballMatches, setBasketballMatches] = useState<Match[]>([]);
  const [nplFixtures, setNplFixtures] = useState<NplMatch[]>([]);

  // Update clock every 15s
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(nstClock()), 15000);
    return () => clearInterval(timer);
  }, []);

  const handleStartUpdate = async () => {
    if (!updateInfo) return;
    setIsDownloading(true);
    setDownloadProgress(0);
    setIsReadyToInstall(false);
    const res = await downloadAndInstallUpdate(updateInfo.downloadUrl, (pct) => {
      setDownloadProgress(pct);
      if (pct >= 100) {
        setIsReadyToInstall(true);
      }
    });
    setIsDownloading(false);
    if (!res.success) {
      Alert.alert('Update Notice', res.error || 'Could not complete update.');
    }
  };

  const handleInstallNow = async () => {
    const res = await installCachedApk();
    if (!res.success) {
      Alert.alert('Install Notice', res.error || 'Please allow installing unknown apps in Android Settings.');
    }
  };

  const loadData = useCallback(async () => {
    try {
      const [fb, cr, bb, npl, prefs, update] = await Promise.all([
        fetchMatches('football').catch(() => []),
        fetchMatches('cricket').catch(() => []),
        fetchMatches('basketball').catch(() => []),
        fetchNplFixtures().catch(() => []),
        loadPreferences().catch(() => ({ starredMatches: [], favoriteTeams: [] })),
        checkForAppUpdate().catch(() => null),
      ]);

      setFootballMatches(fb);
      setCricketMatches(cr);
      setBasketballMatches(bb);
      setNplFixtures(npl);
      setWatchlistCount(prefs.starredMatches.length + prefs.favoriteTeams.length);
      if (update && update.hasUpdate) {
        setUpdateInfo(update);
      }
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    const unsubscribe = navigation.addListener('focus', () => {
      loadData();
    });
    return unsubscribe;
  }, [loadData, navigation]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  // Up Next match preview: Live matches first, then upcoming
  const heroMatches = useMemo(() => {
    const combined: Array<{ match: Match; category: string; isLive: boolean; time: string; sortTime: number }> = [];

    // Add NPL matches
    for (const m of nplFixtures) {
      if (m.status === 'COMPLETED') continue;
      const isLive = Boolean(
        m.status === 'LIVE' ||
        (m.timestamp && Date.now() >= m.timestamp - 15 * 60 * 1000 && Date.now() <= m.timestamp + 3.75 * 3600 * 1000)
      );
      combined.push({
        match: {
          id: m.id,
          title: `${m.homeTeam} vs ${m.awayTeam}`,
          category: 'cricket',
          status: isLive ? 'Live' : 'Upcoming',
          timestamp: m.timestamp,
          venue: m.venue,
          sources: [
            { source: 'npl', id: m.id, label: 'Action Sports HD / NPL Live' },
          ],
        },
        category: 'NPL',
        isLive,
        time: formatKathmanduTime(m.timestamp),
        sortTime: m.timestamp,
      });
    }

    // Add Football matches
    for (const m of footballMatches) {
      if (m.status?.toLowerCase() === 'final') continue;
      const matchTime = typeof m.date === 'number' ? m.date : (m.timestamp || (m.date ? new Date(m.date).getTime() : 0));
      const isLive = Boolean(
        m.status?.toLowerCase() === 'live' ||
        m.status?.toLowerCase() === 'in' ||
        (matchTime > 0 && Date.now() >= matchTime - 5 * 60 * 1000 && Date.now() <= matchTime + 115 * 60 * 1000)
      );
      combined.push({
        match: m,
        category: 'Football',
        isLive,
        time: matchTime > 0 ? formatKathmanduTime(matchTime) : (isLive ? 'Live' : 'Upcoming'),
        sortTime: matchTime || Date.now(),
      });
    }

    // Add Cricket matches
    for (const m of cricketMatches) {
      if (m.status?.toLowerCase() === 'final') continue;
      if (m.id && m.id.startsWith('npl26-') && nplFixtures.length > 0) continue;
      const matchTime = typeof m.date === 'number' ? m.date : (m.timestamp || (m.date ? new Date(m.date).getTime() : 0));
      const isLive = Boolean(
        m.status?.toLowerCase() === 'live' ||
        m.status?.toLowerCase() === 'in' ||
        (matchTime > 0 && Date.now() >= matchTime - 15 * 60 * 1000 && Date.now() <= matchTime + 3.5 * 3600 * 1000)
      );
      combined.push({
        match: m,
        category: 'Cricket',
        isLive,
        time: matchTime > 0 ? formatKathmanduTime(matchTime) : (isLive ? 'Live' : 'Upcoming'),
        sortTime: matchTime || Date.now(),
      });
    }

    // Add Basketball matches
    for (const m of basketballMatches) {
      if (m.status?.toLowerCase() === 'final') continue;
      const matchTime = typeof m.date === 'number' ? m.date : (m.timestamp || (m.date ? new Date(m.date).getTime() : 0));
      const isLive = Boolean(
        m.status?.toLowerCase() === 'live' ||
        m.status?.toLowerCase() === 'in' ||
        (matchTime > 0 && Date.now() >= matchTime - 10 * 60 * 1000 && Date.now() <= matchTime + 150 * 60 * 1000)
      );
      combined.push({
        match: m,
        category: 'Basketball',
        isLive,
        time: matchTime > 0 ? formatKathmanduTime(matchTime) : (isLive ? 'Live' : 'Upcoming'),
        sortTime: matchTime || Date.now(),
      });
    }

    // Sort: live first, then chronological
    combined.sort((a, b) => {
      if (a.isLive !== b.isLive) return b.isLive ? 1 : -1;
      return a.sortTime - b.sortTime;
    });

    return combined.slice(0, 6);
  }, [basketballMatches, cricketMatches, footballMatches, nplFixtures]);

  return (
    <View style={styles.container}>
      {/* Floodlit pitch background spanning to the absolute top behind transparent header */}
      <View style={styles.heroBackgroundContainer} pointerEvents="none">
        <Image source={{ uri: HERO_IMAGE }} style={styles.heroBackgroundImage} />
        <View style={styles.heroBackgroundGradient} />
      </View>

      {/* Top Header (Completely transparent, matching web SiteHeader) */}
      <View style={[styles.siteHeader, { paddingTop: topPadding + 6 }]}>
        <View style={styles.brandRow}>
          <View style={styles.brandDot} />
          <Text style={styles.brandText}>Sportivo</Text>
        </View>

        <View style={styles.headerRight}>
          <TouchableOpacity
            style={styles.headerChip}
            onPress={() => navigation.navigate('WatchlistTab' as any)}
          >
            <BookmarkIcon size={16} color={colors.fg2} />
            <Text style={styles.headerChipText}>Watchlist</Text>
            {watchlistCount > 0 && (
              <Text style={styles.headerChipCount}>{watchlistCount}</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.iconBtn}
            onPress={() => navigation.navigate('NotificationSettings')}
            accessibilityLabel="Notifications"
          >
            <BellIcon size={16} color={colors.fg2} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.lime}
            colors={[colors.lime]}
          />
        }
      >
        {/* In-App Update Banner */}
        {updateInfo?.hasUpdate && (
          <View style={styles.updateCard}>
            <View style={styles.updateTop}>
              <View style={styles.updateBadge}>
                <Text style={styles.updateBadgeText}>UPDATE AVAILABLE · v{updateInfo.version}</Text>
              </View>
              <TouchableOpacity onPress={() => setUpdateInfo(null)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Text style={styles.dismissBtn}>✕</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.updateTitle}>New Sportivo Version Ready</Text>
            <Text style={styles.updateNotes}>{updateInfo.releaseNotes}</Text>
            {isDownloading ? (
              <View style={styles.progressContainer}>
                <View style={styles.progressBarBg}>
                  <View style={[styles.progressBarFill, { width: `${downloadProgress}%` }]} />
                </View>
                <Text style={styles.progressText}>
                  Downloading update in background... {downloadProgress}%
                </Text>
              </View>
            ) : isReadyToInstall ? (
              <TouchableOpacity style={styles.updateActionBtn} onPress={handleInstallNow}>
                <Text style={styles.updateActionText}>Install Update v{updateInfo.version} Now ⚡</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={styles.updateActionBtn} onPress={handleStartUpdate}>
                <Text style={styles.updateActionText}>Update in Background (v{updateInfo.version}) →</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Hero Showcase (Matches web HeroShowcase.tsx) */}
        <View style={styles.heroSection}>
          <View style={styles.heroContent}>
            <Text style={styles.eyebrow}>Live sports desk, Nepal</Text>
            <Text style={styles.heroHeadline}>Every kickoff, in Nepal time</Text>
            <Text style={styles.heroSubtitle}>
              Football, cricket and basketball fixtures with live scores and streams, converted to Nepal Standard Time so you never do the maths.
            </Text>

            <View style={styles.heroButtonsRow}>
              <TouchableOpacity
                style={styles.btnPrimary}
                onPress={() => {
                  triggerButtonHaptic();
                  navigation.navigate('NplTab' as any);
                }}
              >
                <Text style={styles.btnPrimaryText}>Watch NPL 2026</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.btnSecondary}
                onPress={() => {
                  triggerButtonHaptic();
                  navigation.navigate('FootballTab' as any);
                }}
              >
                <Text style={styles.btnSecondaryText}>Today's fixtures</Text>
              </TouchableOpacity>
            </View>

            {/* Up Next Panel (Matches web Up Next panel) */}
            <View style={styles.upNextPanel}>
              <View style={styles.upNextHeader}>
                <Text style={styles.upNextTitle}>Up next</Text>
                <Text style={styles.clockText}>{currentTime}</Text>
              </View>

              {heroMatches.length === 0 ? (
                <Text style={styles.upNextEmpty}>No fixtures scheduled yet</Text>
              ) : (
                heroMatches.map((item, idx) => (
                  <TouchableOpacity
                    key={idx}
                    style={styles.upNextRow}
                    activeOpacity={0.7}
                    onPress={() => {
                      triggerButtonHaptic();
                      navigation.navigate('MatchPlayer', { match: item.match });
                    }}
                  >
                    <View style={styles.upNextTimeCol}>
                      {item.isLive ? (
                        <View style={styles.liveTag}>
                          <LiveDot size={8} />
                          <Text style={styles.liveTagText}>Live</Text>
                        </View>
                      ) : (
                        <Text style={styles.upNextTimeText}>{item.time}</Text>
                      )}
                    </View>

                    <Text style={styles.upNextMatchTitle} numberOfLines={1}>
                      {item.match.title}
                    </Text>

                    <Text style={styles.upNextCategoryBadge}>{item.category}</Text>
                  </TouchableOpacity>
                ))
              )}
            </View>
          </View>
        </View>

        {/* Quick Portals by Sport */}
        <View style={styles.desksSection}>
          <View style={styles.deskHeader}>
            <Text style={styles.eyebrow}>Fixtures by sport</Text>
            <Text style={styles.sectionTitle}>Live Desks</Text>
          </View>

          <TouchableOpacity
            style={styles.deskRow}
            activeOpacity={0.7}
            onPress={() => navigation.navigate('NplTab' as any)}
          >
            <View style={styles.deskIconCircle}>
              <TrophyIcon size={20} color={colors.live} />
            </View>
            <View style={styles.deskInfo}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={styles.deskTitle}>Nepal Premier League (NPL)</Text>
                <View style={styles.deskLiveBadge}>
                  <LiveDot size={6} />
                  <Text style={styles.deskLiveText}>LIVE</Text>
                </View>
              </View>
              <Text style={styles.deskSubtitle}>Official 2026 Season Fixtures &amp; Scores</Text>
            </View>
            <ChevronForwardIcon size={16} color={colors.fg3} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.deskRow}
            activeOpacity={0.7}
            onPress={() => navigation.navigate('FootballTab' as any)}
          >
            <View style={styles.deskIconCircle}>
              <FootballIcon size={20} color={colors.lime} />
            </View>
            <View style={styles.deskInfo}>
              <Text style={styles.deskTitle}>Football Desk</Text>
              <Text style={styles.deskSubtitle}>Premier League, Champions League, La Liga, Serie A</Text>
            </View>
            <ChevronForwardIcon size={16} color={colors.fg3} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.deskRow}
            activeOpacity={0.7}
            onPress={() => navigation.navigate('CricketTab' as any)}
          >
            <View style={styles.deskIconCircle}>
              <CricketIcon size={20} color={colors.lime} />
            </View>
            <View style={styles.deskInfo}>
              <Text style={styles.deskTitle}>Cricket Desk</Text>
              <Text style={styles.deskSubtitle}>ICC Tournaments, IPL, Bilateral Series</Text>
            </View>
            <ChevronForwardIcon size={16} color={colors.fg3} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.deskRow}
            activeOpacity={0.7}
            onPress={() => navigation.navigate('BasketballTab' as any)}
          >
            <View style={styles.deskIconCircle}>
              <BasketballIcon size={20} color={colors.lime} />
            </View>
            <View style={styles.deskInfo}>
              <Text style={styles.deskTitle}>Basketball Desk</Text>
              <Text style={styles.deskSubtitle}>NBA, EuroLeague, NCAA Regular &amp; Playoffs</Text>
            </View>
            <ChevronForwardIcon size={16} color={colors.fg3} />
          </TouchableOpacity>
        </View>

        {/* What Sportivo Does (Matches web What Sportivo does section) */}
        <View style={styles.pillarsSection}>
          <Text style={styles.eyebrow}>What Sportivo does</Text>
          <Text style={styles.pillarsHeading}>
            One place for fixtures, scores and streams, in NST
          </Text>
          <Text style={styles.pillarsSubtitle}>
            Schedules from upstream sports feeds are converted to Nepal Standard Time, paired with live status and stream servers, and kept in sync while a match is on.
          </Text>

          <View style={styles.pillarGrid}>
            <View style={styles.pillarItem}>
              <Text style={styles.pillarTitle}>Nepal Standard Time</Text>
              <Text style={styles.pillarDesc}>
                Every kickoff is shown in UTC+5:45. No conversion on your side.
              </Text>
            </View>

            <View style={styles.pillarItem}>
              <Text style={styles.pillarTitle}>Several stream servers</Text>
              <Text style={styles.pillarDesc}>
                Each match lists verified servers. If one drops, switch to the next.
              </Text>
            </View>

            <View style={styles.pillarItem}>
              <Text style={styles.pillarTitle}>Watchlist</Text>
              <Text style={styles.pillarDesc}>
                Star any match or team to follow it with pre-match alerts.
              </Text>
            </View>

            <View style={styles.pillarItem}>
              <Text style={styles.pillarTitle}>Live status &amp; alerts</Text>
              <Text style={styles.pillarDesc}>
                Real-time scores and notifications when starred matches kick off.
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.ink900,
  },
  siteHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 10,
    backgroundColor: 'transparent',
    borderBottomWidth: 0,
    zIndex: 10,
  },
  heroBackgroundContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 480,
    overflow: 'hidden',
  },
  heroBackgroundImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
    opacity: 0.40,
  },
  heroBackgroundGradient: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(12, 16, 18, 0.70)',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  brandDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.lime,
  },
  brandText: {
    fontFamily: fonts.sansSemibold,
    fontSize: 17,
    color: colors.fg,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerChip: {
    height: 32,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    borderRadius: radius.md,
    backgroundColor: colors.ink800,
    borderWidth: 1,
    borderColor: colors.line,
    gap: 6,
  },
  headerChipText: {
    fontFamily: fonts.sansMedium,
    fontSize: 12,
    color: colors.fg2,
  },
  headerChipCount: {
    fontFamily: fonts.mono,
    fontSize: 11,
    color: colors.fg3,
  },
  iconBtn: {
    width: 32,
    height: 32,
    borderRadius: radius.md,
    backgroundColor: colors.ink800,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    paddingBottom: 40,
  },

  /* Update Card */
  updateCard: {
    backgroundColor: colors.ink800,
    marginHorizontal: 16,
    marginTop: 12,
    padding: 16,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.lineStrong,
  },
  updateTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  updateBadge: {
    backgroundColor: 'rgba(201, 243, 107, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  updateBadgeText: {
    color: colors.lime,
    fontSize: 11,
    fontWeight: '700',
  },
  dismissBtn: {
    color: colors.fg3,
    fontSize: 14,
  },
  updateTitle: {
    fontFamily: fonts.sansMedium,
    fontSize: 16,
    color: colors.fg,
    marginBottom: 4,
  },
  updateNotes: {
    fontFamily: fonts.sans,
    fontSize: 13,
    color: colors.fg2,
    lineHeight: 18,
    marginBottom: 12,
  },
  updateActionBtn: {
    backgroundColor: colors.lime,
    paddingVertical: 10,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  updateActionText: {
    fontFamily: fonts.sansMedium,
    fontSize: 13,
    color: colors.limeInk,
  },
  progressContainer: {
    marginTop: 8,
  },
  progressBarBg: {
    height: 6,
    backgroundColor: colors.ink700,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: colors.lime,
  },
  progressText: {
    fontFamily: fonts.sans,
    fontSize: 12,
    color: colors.fg3,
    marginTop: 6,
    textAlign: 'center',
  },

  /* Hero Showcase */
  heroSection: {
    position: 'relative',
    paddingBottom: 24,
  },
  heroContent: {
    paddingHorizontal: 16,
    paddingTop: 28,
  },
  eyebrow: {
    fontFamily: fonts.sans,
    fontSize: 13,
    color: colors.fg3,
  },
  heroHeadline: {
    fontFamily: fonts.sansSemibold,
    fontSize: 32,
    lineHeight: 38,
    color: colors.fg,
    marginTop: 8,
    letterSpacing: -0.5,
  },
  heroSubtitle: {
    fontFamily: fonts.sans,
    fontSize: 15,
    lineHeight: 22,
    color: colors.fg2,
    marginTop: 10,
  },
  heroButtonsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 20,
    marginBottom: 24,
  },
  btnPrimary: {
    height: 42,
    paddingHorizontal: 18,
    borderRadius: radius.md,
    backgroundColor: colors.lime,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPrimaryText: {
    fontFamily: fonts.sansMedium,
    fontSize: 14,
    color: colors.limeInk,
  },
  btnSecondary: {
    height: 42,
    paddingHorizontal: 18,
    borderRadius: radius.md,
    backgroundColor: colors.ink700,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnSecondaryText: {
    fontFamily: fonts.sansMedium,
    fontSize: 14,
    color: colors.fg,
  },

  /* Up Next Panel (Matches web Up Next panel) */
  upNextPanel: {
    backgroundColor: colors.ink800,
    borderRadius: radius.panel,
    borderWidth: 1,
    borderColor: colors.line,
    overflow: 'hidden',
  },
  upNextHeader: {
    height: 46,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  upNextTitle: {
    fontFamily: fonts.sansMedium,
    fontSize: 14,
    color: colors.fg,
  },
  clockText: {
    fontFamily: fonts.mono,
    fontSize: 12,
    color: colors.fg2,
  },
  upNextEmpty: {
    padding: 20,
    fontFamily: fonts.sans,
    fontSize: 13,
    color: colors.fg3,
    textAlign: 'center',
  },
  upNextRow: {
    height: 46,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    gap: 12,
  },
  upNextTimeCol: {
    width: 80,
  },
  liveTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  liveTagText: {
    fontFamily: fonts.sansMedium,
    fontSize: 12,
    color: colors.live,
  },
  upNextTimeText: {
    fontFamily: fonts.mono,
    fontSize: 12,
    color: colors.fg2,
  },
  upNextMatchTitle: {
    flex: 1,
    fontFamily: fonts.sans,
    fontSize: 13,
    color: colors.fg,
  },
  upNextCategoryBadge: {
    fontFamily: fonts.sans,
    fontSize: 11,
    color: colors.fg3,
  },

  /* Live Desks Section */
  desksSection: {
    paddingHorizontal: 16,
    paddingTop: 24,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    gap: 12,
  },
  deskHeader: {
    marginBottom: 4,
  },
  sectionTitle: {
    fontFamily: fonts.sansMedium,
    fontSize: 22,
    color: colors.fg,
    marginTop: 4,
  },
  deskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.ink800,
    padding: 14,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    gap: 12,
  },
  deskIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.ink700,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deskInfo: {
    flex: 1,
  },
  deskTitle: {
    fontFamily: fonts.sansMedium,
    fontSize: 15,
    color: colors.fg,
  },
  deskSubtitle: {
    fontFamily: fonts.sans,
    fontSize: 12,
    color: colors.fg3,
    marginTop: 2,
  },
  deskLiveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(229, 72, 77, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  deskLiveText: {
    fontFamily: fonts.sansMedium,
    fontSize: 10,
    color: colors.live,
  },

  /* Pillars Section (What Sportivo Does) */
  pillarsSection: {
    paddingHorizontal: 16,
    paddingTop: 32,
    marginTop: 24,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  pillarsHeading: {
    fontFamily: fonts.sansMedium,
    fontSize: 22,
    lineHeight: 28,
    color: colors.fg,
    marginTop: 6,
  },
  pillarsSubtitle: {
    fontFamily: fonts.sans,
    fontSize: 14,
    lineHeight: 20,
    color: colors.fg2,
    marginTop: 8,
    marginBottom: 20,
  },
  pillarGrid: {
    gap: 14,
  },
  pillarItem: {
    backgroundColor: colors.ink800,
    padding: 14,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
  },
  pillarTitle: {
    fontFamily: fonts.sansMedium,
    fontSize: 14,
    color: colors.fg,
    marginBottom: 4,
  },
  pillarDesc: {
    fontFamily: fonts.sans,
    fontSize: 13,
    lineHeight: 18,
    color: colors.fg2,
  },
});
