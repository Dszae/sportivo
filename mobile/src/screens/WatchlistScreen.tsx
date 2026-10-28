import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  TextInput,
  Platform,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BookmarkIcon, ClockIcon } from '../components/Icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Match, RootStackParamList } from '../types';
import { fetchMatches, fetchNplFixtures, formatKathmanduTime } from '../services/api';
import { loadPreferences, toggleFavoriteTeam } from '../services/storage';
import { triggerButtonHaptic, autoScheduleAllMatchAlerts } from '../services/notifications';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const POPULAR_NPL_TEAMS = [
  'Biratnagar Kings',
  'Chitwan Rhinos',
  'Janakpur Bolts',
  'Karnali Yaks',
  'Kathmandu Gurkhas',
  'Lumbini Lions',
  'Pokhara Avengers',
  'Sudurpaschim Royals',
];

const POPULAR_FOOTBALL_TEAMS = [
  'Real Madrid',
  'Barcelona',
  'Arsenal',
  'Manchester City',
  'Liverpool',
  'Manchester United',
  'Bayern Munich',
];

export default function WatchlistScreen() {
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();
  const topPadding = Math.max(insets.top, Platform.OS === 'android' ? (StatusBar.currentHeight || 28) : 0) + 8;
  const [favoriteTeams, setFavoriteTeams] = useState<string[]>([]);
  const [starredMatches, setStarredMatches] = useState<string[]>([]);
  const [matchedFixtures, setMatchedFixtures] = useState<Match[]>([]);
  const [customTeamInput, setCustomTeamInput] = useState('');
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      const [prefs, football, cricket] = await Promise.all([
        loadPreferences(),
        fetchMatches('football'),
        fetchMatches('cricket'),
      ]);

      setFavoriteTeams(prefs.favoriteTeams);
      setStarredMatches(prefs.starredMatches);

      const all = [...football, ...cricket];
      // Filter fixtures involving favorite teams or starred matches
      const matched = all.filter((m) => {
        const titleLower = m.title.toLowerCase();
        const hasFavTeam = prefs.favoriteTeams.some((t) => titleLower.includes(t.toLowerCase()));
        const slug = m.slug || m.title.toLowerCase().replace(/[^a-z0-9]+/g, '-');
        const isStarred = prefs.starredMatches.includes(slug);
        return hasFavTeam || isStarred;
      });

      setMatchedFixtures(matched);
      if (matched.length > 0) {
        autoScheduleAllMatchAlerts(
          matched.map((m) => ({
            title: m.title,
            timestamp: m.timestamp || (m as any).startTime || (m as any).date || 0,
          }))
        );
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleToggleTeam = async (team: string) => {
    await triggerButtonHaptic();
    const updated = await toggleFavoriteTeam(team);
    setFavoriteTeams(updated);
    loadData();
  };

  const handleAddCustomTeam = () => {
    const trimmed = customTeamInput.trim();
    if (!trimmed) return;
    handleToggleTeam(trimmed);
    setCustomTeamInput('');
  };

  return (
    <ScrollView
      style={[styles.container, { paddingTop: topPadding }]}
      contentContainerStyle={styles.scrollContent}
    >
      {/* Top Banner */}
      <View style={styles.banner}>
        <BookmarkIcon size={32} color="#fbbf24" fill="#fbbf24" style={{ marginBottom: 8 }} />
        <Text style={styles.bannerTitle}>My Personal Watchlist</Text>
        <Text style={styles.bannerSubtitle}>
          Follow your favorite clubs and NPL franchises. Match alerts will automatically fire 5 minutes before kickoff!
        </Text>
      </View>

      {/* Your Match Schedule */}
      <View style={styles.section}>
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>YOUR MATCH SCHEDULE</Text>
          <View style={styles.countBadge}>
            <Text style={styles.countText}>{matchedFixtures.length} Matches</Text>
          </View>
        </View>

        {loading ? (
          <ActivityIndicator size="small" color="#c9f36b" style={{ marginVertical: 20 }} />
        ) : matchedFixtures.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyText}>
              No upcoming matches for your followed teams right now. Add teams below to populate your desk!
            </Text>
          </View>
        ) : (
          matchedFixtures.map((item, idx) => {
            const isLive = item.status === 'Live';
            const kickoff = formatKathmanduTime(item.timestamp || item.startTime || Date.now());

            return (
              <TouchableOpacity
                key={idx}
                activeOpacity={0.85}
                onPress={() => navigation.navigate('MatchPlayer', { match: item })}
                style={[styles.matchCard, isLive && styles.liveMatchCard]}
              >
                <View style={styles.matchCardTop}>
                  <View style={styles.statusPill}>
                    {isLive ? (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#ef4444' }} />
                        <Text style={[styles.statusText, { color: '#ef4444' }]}>LIVE</Text>
                      </View>
                    ) : (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <ClockIcon size={11} color="#94a3b8" />
                        <Text style={styles.statusText}>{kickoff} NST</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.categoryTag}>{item.category?.toUpperCase()}</Text>
                </View>

                <Text style={styles.matchCardTitle}>{item.title}</Text>
                <Text style={styles.watchLink}>Tap to view broadcast &rarr;</Text>
              </TouchableOpacity>
            );
          })
        )}
      </View>

      {/* Follow NPL Franchises */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>NEPAL PREMIER LEAGUE TEAMS</Text>
        <Text style={styles.sectionHint}>Tap any franchise to add or remove from your watchlist:</Text>

        <View style={styles.chipsContainer}>
          {POPULAR_NPL_TEAMS.map((team) => {
            const isFav = favoriteTeams.some((t) => t.toLowerCase() === team.toLowerCase());
            return (
              <TouchableOpacity
                key={team}
                onPress={() => handleToggleTeam(team)}
                style={[styles.chip, isFav && styles.chipActiveNpl]}
              >
                <Text style={[styles.chipText, isFav && styles.chipTextActive]}>
                  {isFav ? '✓ ' : '+ '}
                  {team}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Follow World Football Clubs */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>WORLD FOOTBALL CLUBS</Text>

        <View style={styles.chipsContainer}>
          {POPULAR_FOOTBALL_TEAMS.map((team) => {
            const isFav = favoriteTeams.some((t) => t.toLowerCase() === team.toLowerCase());
            return (
              <TouchableOpacity
                key={team}
                onPress={() => handleToggleTeam(team)}
                style={[styles.chip, isFav && styles.chipActiveFootball]}
              >
                <Text style={[styles.chipText, isFav && styles.chipTextActive]}>
                  {isFav ? '✓ ' : '+ '}
                  {team}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Add Custom Team */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>ADD ANY OTHER TEAM</Text>
        <View style={styles.inputRow}>
          <TextInput
            value={customTeamInput}
            onChangeText={setCustomTeamInput}
            placeholder="e.g. Chelsea, Nepal, India..."
            placeholderTextColor="#64748b"
            style={styles.textInput}
          />
          <TouchableOpacity style={styles.addBtn} onPress={handleAddCustomTeam}>
            <Text style={styles.addBtnText}>Add</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#080a0b',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 48,
  },
  banner: {
    backgroundColor: '#111a19',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    padding: 16,
    marginBottom: 20,
  },
  bannerIcon: {
    fontSize: 28,
    marginBottom: 8,
  },
  bannerTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#ffffff',
  },
  bannerSubtitle: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 4,
    lineHeight: 18,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '900',
    color: '#e5b94f',
    letterSpacing: 0.8,
  },
  countBadge: {
    backgroundColor: 'rgba(201,243,107,0.15)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  countText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#c9f36b',
  },
  sectionHint: {
    fontSize: 11,
    color: '#94a3b8',
    marginBottom: 12,
  },
  emptyBox: {
    backgroundColor: '#0f1715',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  emptyText: {
    fontSize: 12,
    color: '#94a3b8',
    lineHeight: 18,
    textAlign: 'center',
  },
  matchCard: {
    backgroundColor: '#121c1a',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    padding: 14,
    marginBottom: 10,
  },
  liveMatchCard: {
    borderColor: 'rgba(239,68,68,0.5)',
    backgroundColor: '#162220',
  },
  matchCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  statusPill: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#cbd5e1',
  },
  categoryTag: {
    fontSize: 10,
    fontWeight: '700',
    color: '#94a3b8',
  },
  matchCardTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#ffffff',
  },
  watchLink: {
    fontSize: 11,
    fontWeight: '700',
    color: '#c9f36b',
    marginTop: 8,
  },
  chipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  chipActiveNpl: {
    backgroundColor: '#dc2626',
    borderColor: '#ef4444',
  },
  chipActiveFootball: {
    backgroundColor: '#c9f36b',
    borderColor: '#c9f36b',
  },
  chipText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#cbd5e1',
  },
  chipTextActive: {
    color: '#080a0b',
    fontWeight: '900',
  },
  inputRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  textInput: {
    flex: 1,
    backgroundColor: '#111a19',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 13,
    color: '#ffffff',
  },
  addBtn: {
    backgroundColor: '#c9f36b',
    borderRadius: 12,
    paddingHorizontal: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addBtnText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#080a0b',
  },
});

