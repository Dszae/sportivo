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
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  SearchIcon,
  BookmarkIcon,
  CricketIcon,
} from '../components/Icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { NplMatch, RootStackParamList } from '../types';
import {
  fetchNplFixtures,
  fetchLiveDeskMoments,
  LiveScorerMobile,
  formatKathmanduTime,
  formatKathmanduDate,
  getKathmanduDateKey,
} from '../services/api';
import { loadPreferences, toggleStarredMatch } from '../services/storage';
import { triggerButtonHaptic } from '../services/notifications';
import { LiveDot } from '../components/Live';
import { colors, fonts, radius, ui } from '../theme';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type Tab = 'today' | 'upcoming' | 'all';

function TeamCrest({
  uri,
  name,
  short,
  color,
  size = 32,
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

function shortVenue(venue: string = '') {
  return venue.replace('Tribhuvan University International Cricket Ground', 'TU Cricket Ground');
}

export default function NplScreen() {
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();
  const topPadding = insets.top || (Platform.OS === 'android' ? (StatusBar.currentHeight || 0) : 0);

  const [fixtures, setFixtures] = useState<NplMatch[]>([]);
  const [activeTab, setActiveTab] = useState<Tab>('today');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [starredSlugs, setStarredSlugs] = useState<string[]>([]);
  const [lastSyncTime, setLastSyncTime] = useState('Just now');
  const [liveTelemetry, setLiveTelemetry] = useState<LiveScorerMobile | null>(null);

  // Poll real-time live telemetry every 3 seconds
  useEffect(() => {
    let isMounted = true;
    let timer: any = null;

    async function pollLiveTelemetry() {
      try {
        const data = await fetchLiveDeskMoments();
        if (isMounted && data && (data.score || data.overs || data.header)) {
          setLiveTelemetry(data);
        }
      } catch {}
    }

    pollLiveTelemetry();

    timer = setInterval(pollLiveTelemetry, 3000);

    return () => {
      isMounted = false;
      if (timer) clearInterval(timer);
    };
  }, []);

  const getTeamLiveScore = useCallback(
    (teamName: string, teamShort: string) => {
      if (!liveTelemetry?.header) {
        return null;
      }
      const h = liveTelemetry.header;
      const norm = (s?: string) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      const tNorm = norm(teamName);
      const sNorm = norm(teamShort);

      const t1Name = norm(h.team1Name);
      const t1Short = norm(h.team1Short);
      const t2Name = norm(h.team2Name);
      const t2Short = norm(h.team2Short);

      const isTeam1 =
        Boolean(t1Name && (tNorm.includes(t1Name) || t1Name.includes(tNorm))) ||
        Boolean(t1Short && (sNorm === t1Short || tNorm.includes(t1Short) || sNorm.includes(t1Short)));

      const isTeam2 =
        Boolean(t2Name && (tNorm.includes(t2Name) || t2Name.includes(tNorm))) ||
        Boolean(t2Short && (sNorm === t2Short || tNorm.includes(t2Short) || sNorm.includes(t2Short)));

      if (isTeam1) {
        const score = h.team1Score || '';
        const overs = h.team1Overs ? (h.team1Overs.includes('ov') ? h.team1Overs : `${h.team1Overs} ov`) : '';
        const display = score ? (overs && !score.includes('ov') && !score.includes('(') ? `${score} (${overs})` : score) : '';
        return {
          score,
          overs,
          display,
          isBatting: h.activeTeam === 1,
        };
      }

      if (isTeam2) {
        const score = h.team2Score || '';
        const overs = h.team2Overs ? (h.team2Overs.includes('ov') ? h.team2Overs : `${h.team2Overs} ov`) : '';
        const display = score ? (overs && !score.includes('ov') && !score.includes('(') ? `${score} (${overs})` : score) : '';
        return {
          score,
          overs,
          display,
          isBatting: h.activeTeam === 2,
        };
      }

      return null;
    },
    [liveTelemetry]
  );

  const loadData = useCallback(async () => {
    try {
      const [data, prefs] = await Promise.all([
        fetchNplFixtures(),
        loadPreferences(),
      ]);
      setFixtures(data);
      setStarredSlugs(prefs.starredMatches);
      setLastSyncTime(
        new Intl.DateTimeFormat('en-US', {
          timeZone: 'Asia/Kathmandu',
          hour: 'numeric',
          minute: '2-digit',
        }).format(new Date()) + ' NST'
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

  const handleToggleStar = async (matchId: string, matchNumber: number) => {
    await triggerButtonHaptic();
    const slug = `npl-match-${matchNumber}`;
    const updated = await toggleStarredMatch(matchId || slug);
    setStarredSlugs(updated);
  };

  // Grouping & live fixture calculations (same logic as web NplSchedule.tsx)
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

  // Compute live fixture for Hero Panel: strictly auto-hides if match is COMPLETED
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
        {/* Live Fixture Hero Panel (Matches web .panel mb-10 overflow-hidden border-line-strong) */}
        {liveFixture && (() => {
          const liveHomeScore = getTeamLiveScore(liveFixture.homeTeam, liveFixture.homeTeamShort);
          const liveAwayScore = getTeamLiveScore(liveFixture.awayTeam, liveFixture.awayTeamShort);

          return (
            <View style={styles.heroPanel}>
              <View style={styles.heroHeader}>
                <View style={styles.liveTag}>
                  <LiveDot size={8} />
                  <Text style={styles.liveTagText}>Live now</Text>
                </View>
                <Text style={styles.heroMeta}>
                  Match <Text style={styles.clockInline}>{liveFixture.matchNumber}</Text>, {shortVenue(liveFixture.venue || 'TU Cricket Ground')}
                </Text>
              </View>

              <View style={styles.heroBody}>
                <View style={styles.heroTeams}>
                  {/* Home Team */}
                  <View style={styles.heroTeamRow}>
                    <View style={styles.heroTeamLeft}>
                      <TeamCrest
                        uri={liveFixture.homeTeamLogo}
                        name={liveFixture.homeTeam}
                        short={liveFixture.homeTeamShort}
                        color={liveFixture.homeTeamColor}
                        size={44}
                      />
                      <Text style={styles.heroTeamName} numberOfLines={1}>
                        {liveFixture.homeTeam}
                      </Text>
                    </View>
                    {(liveHomeScore?.display || liveFixture.homeScore) ? (
                      <Text style={[styles.heroScoreText, liveHomeScore?.isBatting && { color: colors.lime, fontWeight: '700' }]}>
                        {liveHomeScore?.display || liveFixture.homeScore}
                      </Text>
                    ) : null}
                  </View>

                  {/* Away Team */}
                  <View style={styles.heroTeamRow}>
                    <View style={styles.heroTeamLeft}>
                      <TeamCrest
                        uri={liveFixture.awayTeamLogo}
                        name={liveFixture.awayTeam}
                        short={liveFixture.awayTeamShort}
                        color={liveFixture.awayTeamColor}
                        size={44}
                      />
                      <Text style={styles.heroTeamName} numberOfLines={1}>
                        {liveFixture.awayTeam}
                      </Text>
                    </View>
                    {(liveAwayScore?.display || liveFixture.awayScore) ? (
                      <Text style={[styles.heroScoreText, liveAwayScore?.isBatting && { color: colors.lime, fontWeight: '700' }]}>
                        {liveAwayScore?.display || liveFixture.awayScore}
                      </Text>
                    ) : null}
                  </View>

                  {/* Clean Live Equation / Target note */}
                  {(liveTelemetry?.header?.tossNote || liveTelemetry?.target || liveTelemetry?.crr) ? (
                    <View style={{ marginTop: 8, paddingTop: 6, borderTopWidth: 1, borderTopColor: colors.line }}>
                      <Text style={{ color: colors.lime, fontSize: 13, fontFamily: fonts.mono, fontWeight: '600' }} numberOfLines={2}>
                        {liveTelemetry?.header?.tossNote || liveTelemetry?.target}
                      </Text>
                      {(liveTelemetry?.crr || liveTelemetry?.rrr) ? (
                        <Text style={{ color: colors.fg3, fontSize: 11, fontFamily: fonts.mono, marginTop: 2 }}>
                          {liveTelemetry?.crr ? `CRR: ${liveTelemetry.crr}` : ''}
                          {liveTelemetry?.crr && liveTelemetry?.rrr && liveTelemetry.rrr !== '--' ? ' • ' : ''}
                          {liveTelemetry?.rrr && liveTelemetry.rrr !== '--' ? `RRR: ${liveTelemetry.rrr}` : ''}
                        </Text>
                      ) : null}
                    </View>
                  ) : liveFixture.summary ? (
                    <Text style={styles.heroSummaryText}>{liveFixture.summary}</Text>
                  ) : null}
                </View>

                <View style={styles.heroActions}>
                  <View style={styles.heroTiming}>
                    <Text style={styles.heroStartedText}>
                      Started <Text style={styles.clockHighlight}>{formatKathmanduTime(liveFixture.timestamp)}</Text>
                    </Text>
                    <Text style={styles.heroBroadcasterText}>Action Sports HD, NetTV and DishHome</Text>
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
                    <Text style={styles.heroWatchBtnText}>Watch live</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          );
        })()}

        {/* Tournament Header (Eyebrow, Screen Title, Subtitle, Search) */}
        <View style={styles.titleSection}>
          <Text style={styles.eyebrow}>Cricket, Nepal</Text>
          <Text style={styles.screenTitle}>Nepal Premier League 2026</Text>
          <Text style={styles.screenSubtitle}>
            Fixtures, live scores and streams for all{' '}
            <Text style={styles.clockInline}>{allMatches.length}</Text> matches, in Nepal Standard Time
          </Text>

          {/* Search Bar (Matches web .input pl-9 pr-8) */}
          <View style={styles.searchBar}>
            <SearchIcon size={16} color={colors.fg3} style={styles.searchIcon} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search"
              placeholderTextColor={colors.fg3}
              style={styles.searchInput}
              returnKeyType="search"
            />
            {query ? (
              <TouchableOpacity
                onPress={() => setQuery('')}
                style={styles.searchClearBtn}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={styles.searchClearText}>✕</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>

        {/* Filter Chips (Matches web .chip and .chip-active segmented controls) */}
        <View style={styles.chipsSection}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsScroll}>
            <TouchableOpacity
              style={[styles.chip, activeTab === 'today' && styles.chipActive]}
              onPress={() => {
                triggerButtonHaptic();
                setActiveTab('today');
              }}
            >
              <Text style={[styles.chipLabel, activeTab === 'today' && styles.chipLabelActive]}>
                Today
              </Text>
              <Text style={[styles.chipCount, activeTab === 'today' && styles.chipCountActive]}>
                {todayMatches.length}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.chip, activeTab === 'upcoming' && styles.chipActive]}
              onPress={() => {
                triggerButtonHaptic();
                setActiveTab('upcoming');
              }}
            >
              <Text style={[styles.chipLabel, activeTab === 'upcoming' && styles.chipLabelActive]}>
                Upcoming
              </Text>
              <Text style={[styles.chipCount, activeTab === 'upcoming' && styles.chipCountActive]}>
                {upcomingMatches.length}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.chip, activeTab === 'all' && styles.chipActive]}
              onPress={() => {
                triggerButtonHaptic();
                setActiveTab('all');
              }}
            >
              <Text style={[styles.chipLabel, activeTab === 'all' && styles.chipLabelActive]}>
                All matches
              </Text>
              <Text style={[styles.chipCount, activeTab === 'all' && styles.chipCountActive]}>
                {allMatches.length}
              </Text>
            </TouchableOpacity>
          </ScrollView>

          <Text style={styles.venueMeta}>
            TU Cricket Ground, Kirtipur. Synced <Text style={styles.clockInline}>{lastSyncTime}</Text>
          </Text>
        </View>
      </View>
    );
  };

  const renderMatchCard = ({ item }: { item: NplMatch }) => {
    const isStarred =
      starredSlugs.includes(item.id) || starredSlugs.includes(`npl-match-${item.matchNumber}`);
    const isLive = item.status === 'LIVE';
    const isCompleted = item.status === 'COMPLETED';

    const cardHomeScore = isLive ? getTeamLiveScore(item.homeTeam, item.homeTeamShort) : null;
    const cardAwayScore = isLive ? getTeamLiveScore(item.awayTeam, item.awayTeamShort) : null;

    return (
      <View style={[styles.card, isLive && styles.cardLive]}>
        {/* Card Header (Matches web .card header h-10 border-b border-line px-4) */}
        <View style={styles.cardHeader}>
          <Text style={styles.cardMeta}>
            Match <Text style={styles.clockInline}>{item.matchNumber}</Text>, {item.round}
          </Text>
          {isLive ? (
            <View style={styles.liveTag}>
              <LiveDot size={8} />
              <Text style={styles.liveTagText}>Live</Text>
            </View>
          ) : isCompleted ? (
            <Text style={styles.cardMeta}>Final</Text>
          ) : null}
        </View>

        {/* Card Body (Matches web .card body p-4 space-y-3) */}
        <View style={styles.cardBody}>
          {/* Home Team */}
          <View style={styles.teamRow}>
            <View style={styles.teamLeft}>
              <TeamCrest
                uri={item.homeTeamLogo}
                name={item.homeTeam}
                short={item.homeTeamShort}
                color={item.homeTeamColor}
                size={32}
              />
              <Text style={styles.teamName} numberOfLines={1}>
                {item.homeTeam}
              </Text>
            </View>
            {(cardHomeScore?.display || item.homeScore) ? (
              <Text style={[styles.teamScore, cardHomeScore?.isBatting && { color: colors.lime, fontWeight: '700' }]}>
                {cardHomeScore?.display || item.homeScore}
              </Text>
            ) : null}
          </View>

          {/* Away Team */}
          <View style={styles.teamRow}>
            <View style={styles.teamLeft}>
              <TeamCrest
                uri={item.awayTeamLogo}
                name={item.awayTeam}
                short={item.awayTeamShort}
                color={item.awayTeamColor}
                size={32}
              />
              <Text style={styles.teamName} numberOfLines={1}>
                {item.awayTeam}
              </Text>
            </View>
            {(cardAwayScore?.display || item.awayScore) ? (
              <Text style={[styles.teamScore, cardAwayScore?.isBatting && { color: colors.lime, fontWeight: '700' }]}>
                {cardAwayScore?.display || item.awayScore}
              </Text>
            ) : null}
          </View>

          {/* Summary / Result Text */}
          {item.summary ? (
            <Text style={styles.summaryText}>{item.summary}</Text>
          ) : isLive && (liveTelemetry?.header?.tossNote || liveTelemetry?.target || liveTelemetry?.crr) ? (
            <Text style={[styles.summaryText, { color: colors.lime }]} numberOfLines={1}>
              {liveTelemetry?.header?.tossNote || `${liveTelemetry?.target || ''} • CRR: ${liveTelemetry?.crr || ''}`}
            </Text>
          ) : null}

          {/* Schedule Footer (Matches web border-t border-line pt-3 flex justify-between) */}
          <View style={styles.cardScheduleRow}>
            <Text style={styles.cardDate}>{formatKathmanduDate(item.timestamp)}</Text>
            <Text style={styles.cardTime}>{formatKathmanduTime(item.timestamp)}</Text>
          </View>
        </View>

        {/* Card Actions (Matches web h-12 border-t border-line px-2 flex justify-between) */}
        <View style={styles.cardFooter}>
          <View style={styles.cardFooterLeft}>
            <TouchableOpacity
              onPress={() => handleToggleStar(item.id, item.matchNumber)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={styles.starBtn}
            >
              <BookmarkIcon
                size={18}
                color={isStarred ? colors.lime : colors.fg3}
                fill={isStarred ? colors.lime : undefined}
              />
            </TouchableOpacity>

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
              <Text style={styles.detailsBtnText}>Details</Text>
            </TouchableOpacity>
          </View>

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
              <Text style={styles.watchLiveBtnText}>Watch live</Text>
            </TouchableOpacity>
          ) : (
            <Text style={styles.cardFooterMeta}>{isCompleted ? 'Final' : ''}</Text>
          )}
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: topPadding }]}>
      {loading ? (
        <View style={styles.centerLoading}>
          <ActivityIndicator size="large" color={colors.lime} />
          <Text style={styles.loadingText}>Loading NPL schedule...</Text>
        </View>
      ) : (
        <FlatList
          data={displayedMatches}
          keyExtractor={(item) => item.id}
          renderItem={renderMatchCard}
          ListHeaderComponent={renderHeader}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.lime}
              colors={[colors.lime]}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <CricketIcon size={40} color={colors.fg3} style={{ marginBottom: 12 }} />
              <Text style={styles.emptyTitle}>
                {query ? `No matches for "${query}"` : 'No NPL matches today'}
              </Text>
              <Text style={styles.emptySubtitle}>
                {query
                  ? 'Try searching with another team or venue name.'
                  : `Nothing scheduled for ${formatKathmanduDate(Date.now())}`}
              </Text>
              {query ? (
                <TouchableOpacity onPress={() => setQuery('')} style={styles.emptyActionBtn}>
                  <Text style={styles.emptyActionText}>Clear search</Text>
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
    backgroundColor: colors.ink900,
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
    color: colors.fg2,
    fontFamily: fonts.sansMedium,
  },

  /* Live Now Hero Panel (Matches web .panel overflow-hidden border-line-strong) */
  heroPanel: {
    backgroundColor: colors.ink800,
    borderRadius: radius.panel,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    overflow: 'hidden',
    marginBottom: 24,
    marginTop: 8,
  },
  heroHeader: {
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  liveTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  liveTagText: {
    fontFamily: fonts.sansMedium,
    fontSize: 13,
    color: colors.live,
  },
  heroMeta: {
    fontFamily: fonts.sans,
    fontSize: 12,
    color: colors.fg3,
  },
  heroBody: {
    padding: 16,
    gap: 20,
  },
  heroTeams: {
    gap: 12,
  },
  heroTeamRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  heroTeamLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  heroTeamName: {
    fontFamily: fonts.sansMedium,
    fontSize: 20,
    color: colors.fg,
    flex: 1,
  },
  heroScoreText: {
    fontFamily: fonts.monoMedium,
    fontSize: 20,
    color: colors.fg,
  },
  heroSummaryText: {
    fontFamily: fonts.sans,
    fontSize: 14,
    color: colors.fg2,
    marginTop: 4,
  },
  heroActions: {
    gap: 12,
  },
  heroTiming: {
    gap: 2,
  },
  heroStartedText: {
    fontFamily: fonts.sans,
    fontSize: 13,
    color: colors.fg2,
  },
  heroBroadcasterText: {
    fontFamily: fonts.sans,
    fontSize: 12,
    color: colors.fg3,
  },
  heroWatchBtn: {
    height: 44,
    backgroundColor: colors.fg,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroWatchBtnText: {
    fontFamily: fonts.sansMedium,
    fontSize: 15,
    color: colors.ink900,
  },

  /* Title Section (Matches web eyebrow + screenTitle + subtitle + search) */
  titleSection: {
    marginBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    paddingBottom: 20,
  },
  eyebrow: {
    fontFamily: fonts.sans,
    fontSize: 13,
    color: colors.fg3,
  },
  screenTitle: {
    fontFamily: fonts.sansMedium,
    fontSize: 28,
    color: colors.fg,
    marginTop: 6,
    letterSpacing: -0.3,
  },
  screenSubtitle: {
    fontFamily: fonts.sans,
    fontSize: 14,
    lineHeight: 20,
    color: colors.fg2,
    marginTop: 8,
  },
  searchBar: {
    height: 38,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.ink900,
    paddingHorizontal: 12,
    marginTop: 16,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontFamily: fonts.sans,
    fontSize: 14,
    color: colors.fg,
    paddingVertical: 0,
  },
  searchClearBtn: {
    padding: 4,
  },
  searchClearText: {
    color: colors.fg3,
    fontSize: 12,
  },

  /* Chips Section (Matches web .chip and .chip-active segmented controls) */
  chipsSection: {
    marginBottom: 20,
    gap: 10,
  },
  chipsScroll: {
    flexDirection: 'row',
    gap: 6,
  },
  chip: {
    height: 34,
    paddingHorizontal: 12,
    borderRadius: radius.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  chipActive: {
    backgroundColor: colors.ink700,
  },
  chipLabel: {
    fontFamily: fonts.sansMedium,
    fontSize: 13,
    color: colors.fg2,
  },
  chipLabelActive: {
    color: colors.fg,
  },
  chipCount: {
    fontFamily: fonts.mono,
    fontSize: 12,
    color: colors.fg3,
  },
  chipCountActive: {
    color: colors.fg2,
  },
  venueMeta: {
    fontFamily: fonts.sans,
    fontSize: 12,
    color: colors.fg3,
    marginTop: 2,
  },

  /* Card (Matches web .card rounded-2xl border border-line bg-ink-800) */
  card: {
    backgroundColor: colors.ink800,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.line,
    marginBottom: 16,
    overflow: 'hidden',
  },
  cardLive: {
    borderColor: colors.lineStrong,
  },
  cardHeader: {
    height: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  cardMeta: {
    fontFamily: fonts.sans,
    fontSize: 12,
    color: colors.fg3,
  },
  cardBody: {
    padding: 16,
    gap: 12,
  },
  teamRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  teamLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  teamName: {
    fontFamily: fonts.sans,
    fontSize: 15,
    color: colors.fg,
    flex: 1,
  },
  teamScore: {
    fontFamily: fonts.mono,
    fontSize: 15,
    color: colors.fg,
  },
  summaryText: {
    fontFamily: fonts.sans,
    fontSize: 13,
    lineHeight: 18,
    color: colors.fg2,
    marginTop: 4,
  },
  cardScheduleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: colors.line,
    paddingTop: 12,
    marginTop: 4,
  },
  cardDate: {
    fontFamily: fonts.mono,
    fontSize: 12,
    color: colors.fg2,
  },
  cardTime: {
    fontFamily: fonts.mono,
    fontSize: 12,
    color: colors.fg,
  },

  /* Card Footer (Matches web h-12 border-t border-line px-2) */
  cardFooter: {
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: colors.line,
    paddingHorizontal: 8,
  },
  cardFooterLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  starBtn: {
    width: 34,
    height: 34,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailsBtn: {
    height: 32,
    paddingHorizontal: 12,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailsBtnText: {
    fontFamily: fonts.sansMedium,
    fontSize: 13,
    color: colors.fg2,
  },
  watchLiveBtn: {
    height: 32,
    paddingHorizontal: 14,
    borderRadius: radius.md,
    backgroundColor: colors.fg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  watchLiveBtnText: {
    fontFamily: fonts.sansMedium,
    fontSize: 13,
    color: colors.ink900,
  },
  cardFooterMeta: {
    fontFamily: fonts.sans,
    fontSize: 12,
    color: colors.fg3,
    paddingRight: 8,
  },

  /* Common utilities */
  clockInline: {
    fontFamily: fonts.mono,
  },
  clockHighlight: {
    fontFamily: fonts.mono,
    color: colors.fg,
  },
  avatarFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarFallbackText: {
    fontFamily: fonts.sansMedium,
    fontSize: 11,
    color: colors.fg,
  },

  /* Empty State */
  emptyContainer: {
    paddingVertical: 48,
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  emptyTitle: {
    fontFamily: fonts.sansMedium,
    fontSize: 16,
    color: colors.fg,
    marginBottom: 4,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontFamily: fonts.sans,
    fontSize: 13,
    color: colors.fg2,
    textAlign: 'center',
    lineHeight: 18,
  },
  emptyActionBtn: {
    marginTop: 14,
    backgroundColor: colors.ink700,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: radius.md,
  },
  emptyActionText: {
    fontFamily: fonts.sansMedium,
    fontSize: 13,
    color: colors.fg,
  },
});
