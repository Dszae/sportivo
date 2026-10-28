import AsyncStorage from '@react-native-async-storage/async-storage';
import { UserPreferences } from '../types';

const STORAGE_KEYS = {
  PREFERENCES: '@sportivo_preferences_v1',
  WATCHLIST_MATCHES: '@sportivo_starred_matches_v1',
  WATCHLIST_TEAMS: '@sportivo_favorite_teams_v1',
};

export const DEFAULT_PREFERENCES: UserPreferences = {
  favoriteTeams: [
    'Biratnagar Kings',
    'Janakpur Bolts',
    'Chitwan Rhinos',
    'Real Madrid',
    'Barcelona',
    'Arsenal',
  ],
  starredMatches: [],
  notifications: {
    enabled: true,
    vibrationEnabled: true,
    remind30Min: true,
    remind5Min: true,
    notifyKickoff: true,
    notifyGoalsWickets: true,
  },
};

export async function loadPreferences(): Promise<UserPreferences> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEYS.PREFERENCES);
    if (raw) {
      return { ...DEFAULT_PREFERENCES, ...JSON.parse(raw) };
    }
  } catch {}
  return DEFAULT_PREFERENCES;
}

export async function savePreferences(prefs: UserPreferences): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEYS.PREFERENCES, JSON.stringify(prefs));
  } catch {}
}

export async function toggleStarredMatch(matchId: string): Promise<string[]> {
  try {
    const prefs = await loadPreferences();
    const exists = prefs.starredMatches.includes(matchId);
    const updated = exists
      ? prefs.starredMatches.filter((id) => id !== matchId)
      : [...prefs.starredMatches, matchId];

    await savePreferences({ ...prefs, starredMatches: updated });
    return updated;
  } catch {
    return [];
  }
}

export async function toggleFavoriteTeam(teamName: string): Promise<string[]> {
  try {
    const prefs = await loadPreferences();
    const exists = prefs.favoriteTeams.some((t) => t.toLowerCase() === teamName.toLowerCase());
    const updated = exists
      ? prefs.favoriteTeams.filter((t) => t.toLowerCase() !== teamName.toLowerCase())
      : [...prefs.favoriteTeams, teamName];

    await savePreferences({ ...prefs, favoriteTeams: updated });
    return updated;
  } catch {
    return [];
  }
}

