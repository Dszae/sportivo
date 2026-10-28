export interface NotificationSettings {
  enabled: boolean;
  soundEnabled: boolean;
  remind30Min: boolean; // 30 minutes before kickoff
  remind5Min: boolean;  // 5 minutes before kickoff
  notifyKickoff: boolean; // match started
  notifyGoalsWickets: boolean; // goals, equalizers, wickets
  notifyCards: boolean; // red cards
  notifyHalfTime: boolean; // half time & innings breaks
  notifyFullTime: boolean; // full time & match conclusions
}

export interface UserPreferences {
  favoriteSports: string[];
  favoriteLeagues: string[];
  favoriteTeams: string[];
  starredMatches: string[]; // match slugs
  timeZone: string; // e.g. "Asia/Kathmandu", "UTC", "America/New_York"
  notifications: NotificationSettings;
}

export const POPULAR_TEAMS = [
  // Nepal Premier League (NPL 2026)
  { name: 'Biratnagar Kings', sport: 'cricket', league: 'NPL' },
  { name: 'Chitwan Rhinos', sport: 'cricket', league: 'NPL' },
  { name: 'Janakpur Bolts', sport: 'cricket', league: 'NPL' },
  { name: 'Karnali Yaks', sport: 'cricket', league: 'NPL' },
  { name: 'Kathmandu Gurkhas', sport: 'cricket', league: 'NPL' },
  { name: 'Lumbini Lions', sport: 'cricket', league: 'NPL' },
  { name: 'Pokhara Avengers', sport: 'cricket', league: 'NPL' },
  { name: 'Sudurpaschim Royals', sport: 'cricket', league: 'NPL' },
  // Football
  { name: 'Real Madrid', sport: 'football', league: 'La Liga' },
  { name: 'Barcelona', sport: 'football', league: 'La Liga' },
  { name: 'Manchester City', sport: 'football', league: 'Premier League' },
  { name: 'Arsenal', sport: 'football', league: 'Premier League' },
  { name: 'Liverpool', sport: 'football', league: 'Premier League' },
  { name: 'Manchester United', sport: 'football', league: 'Premier League' },
  { name: 'Chelsea', sport: 'football', league: 'Premier League' },
  { name: 'Bayern Munich', sport: 'football', league: 'Bundesliga' },
  { name: 'Borussia Dortmund', sport: 'football', league: 'Bundesliga' },
  { name: 'Paris Saint-Germain', sport: 'football', league: 'Other Leagues' },
  { name: 'Inter Milan', sport: 'football', league: 'Serie A' },
  { name: 'Juventus', sport: 'football', league: 'Serie A' },
  { name: 'AC Milan', sport: 'football', league: 'Serie A' },
  { name: 'Inter Miami', sport: 'football', league: 'MLS' },
  // Cricket
  { name: 'India', sport: 'cricket', league: 'ICC' },
  { name: 'Nepal', sport: 'cricket', league: 'ICC' },
  { name: 'Australia', sport: 'cricket', league: 'ICC' },
  { name: 'England', sport: 'cricket', league: 'ICC' },
  { name: 'Chennai Super Kings', sport: 'cricket', league: 'IPL' },
  { name: 'Mumbai Indians', sport: 'cricket', league: 'IPL' },
  { name: 'Royal Challengers Bengaluru', sport: 'cricket', league: 'IPL' },
  // Basketball
  { name: 'Los Angeles Lakers', sport: 'basketball', league: 'NBA' },
  { name: 'Golden State Warriors', sport: 'basketball', league: 'NBA' },
  { name: 'Boston Celtics', sport: 'basketball', league: 'NBA' },
  { name: 'Miami Heat', sport: 'basketball', league: 'NBA' },
];

export const POPULAR_COMPETITIONS = [
  { name: 'NPL', sport: 'cricket' },
  { name: 'Champions League', sport: 'football' },
  { name: 'Premier League', sport: 'football' },
  { name: 'La Liga', sport: 'football' },
  { name: 'Bundesliga', sport: 'football' },
  { name: 'Serie A', sport: 'football' },
  { name: 'MLS', sport: 'football' },
  { name: 'IPL', sport: 'cricket' },
  { name: 'ICC World Cup', sport: 'cricket' },
  { name: 'NBA', sport: 'basketball' },
  { name: 'EuroLeague', sport: 'basketball' },
];

export const COMMON_TIMEZONES = [
  { value: 'Asia/Kathmandu', label: 'Kathmandu (UTC+5:45)' },
  { value: 'Asia/Kolkata', label: 'India (UTC+5:30)' },
  { value: 'UTC', label: 'UTC (GMT)' },
  { value: 'Europe/London', label: 'London (UTC+0 / BST)' },
  { value: 'Europe/Madrid', label: 'Madrid / Paris (UTC+1 / CEST)' },
  { value: 'America/New_York', label: 'New York (EDT/EST)' },
  { value: 'America/Los_Angeles', label: 'Los Angeles (PDT/PST)' },
  { value: 'Asia/Dubai', label: 'Dubai (UTC+4)' },
  { value: 'Asia/Tokyo', label: 'Tokyo (UTC+9)' },
  { value: 'Australia/Sydney', label: 'Sydney (AEST/AEDT)' },
];

const PREFS_KEY = 'sportivo_user_preferences_v1';
const LEGACY_FAVS_KEY = 'sportivo_favs';

export function getDefaultPreferences(): UserPreferences {
  return {
    favoriteSports: ['football', 'cricket', 'basketball'],
    favoriteLeagues: ['Premier League', 'Champions League', 'NPL', 'La Liga'],
    favoriteTeams: [],
    starredMatches: [],
    timeZone: 'Asia/Kathmandu',
    notifications: {
      enabled: true,
      soundEnabled: true,
      remind30Min: false,
      remind5Min: true,
      notifyKickoff: true,
      notifyGoalsWickets: true,
      notifyCards: true,
      notifyHalfTime: true,
      notifyFullTime: true,
    },
  };
}

export function loadUserPreferences(): UserPreferences {
  const defaults = getDefaultPreferences();
  if (typeof window === 'undefined') return defaults;

  try {
    const raw = localStorage.getItem(PREFS_KEY);
    let prefs: Partial<UserPreferences> = raw ? JSON.parse(raw) : defaults;

    // Migrate legacy sportivo_favs if present
    const legacyFavs = localStorage.getItem(LEGACY_FAVS_KEY);
    if (legacyFavs) {
      try {
        const parsed: string[] = JSON.parse(legacyFavs);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const combined = Array.from(new Set([...(prefs.starredMatches || []), ...parsed]));
          prefs = { ...prefs, starredMatches: combined };
        }
      } catch {}
    }

    const n = prefs.notifications;
    return {
      favoriteSports: Array.isArray(prefs.favoriteSports) ? prefs.favoriteSports : defaults.favoriteSports,
      favoriteLeagues: Array.isArray(prefs.favoriteLeagues) ? prefs.favoriteLeagues : defaults.favoriteLeagues,
      favoriteTeams: Array.isArray(prefs.favoriteTeams) ? prefs.favoriteTeams : defaults.favoriteTeams,
      starredMatches: Array.isArray(prefs.starredMatches) ? prefs.starredMatches : defaults.starredMatches,
      timeZone: prefs.timeZone || defaults.timeZone,
      notifications: {
        enabled: n?.enabled ?? defaults.notifications.enabled,
        soundEnabled: n?.soundEnabled ?? defaults.notifications.soundEnabled,
        remind30Min: n?.remind30Min ?? defaults.notifications.remind30Min,
        remind5Min: n?.remind5Min ?? defaults.notifications.remind5Min,
        notifyKickoff: n?.notifyKickoff ?? defaults.notifications.notifyKickoff,
        notifyGoalsWickets: n?.notifyGoalsWickets ?? defaults.notifications.notifyGoalsWickets,
        notifyCards: n?.notifyCards ?? defaults.notifications.notifyCards,
        notifyHalfTime: n?.notifyHalfTime ?? defaults.notifications.notifyHalfTime,
        notifyFullTime: n?.notifyFullTime ?? defaults.notifications.notifyFullTime,
      },
    };
  } catch {
    return defaults;
  }
}

export function saveUserPreferences(prefs: UserPreferences): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
    // Keep legacy sportivo_favs synchronized for backward compatibility with existing code
    localStorage.setItem(LEGACY_FAVS_KEY, JSON.stringify(prefs.starredMatches));
    window.dispatchEvent(new CustomEvent('sportivo:preferences-changed', { detail: prefs }));
  } catch {}
}

export function isTeamFavorited(teamName: string, prefs?: UserPreferences): boolean {
  const current = prefs || loadUserPreferences();
  const target = teamName.trim().toLowerCase();
  return current.favoriteTeams.some((t) => t.trim().toLowerCase() === target);
}

export function toggleFavoriteTeam(teamName: string): UserPreferences {
  const current = loadUserPreferences();
  const trimmed = teamName.trim();
  const lower = trimmed.toLowerCase();
  const exists = current.favoriteTeams.some((t) => t.trim().toLowerCase() === lower);

  const updatedTeams = exists
    ? current.favoriteTeams.filter((t) => t.trim().toLowerCase() !== lower)
    : [...current.favoriteTeams, trimmed];

  const next: UserPreferences = {
    ...current,
    favoriteTeams: updatedTeams,
  };
  saveUserPreferences(next);
  return next;
}

