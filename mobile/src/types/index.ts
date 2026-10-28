export type Category = 'football' | 'cricket' | 'basketball';

export interface StreamSource {
  id: string;
  source: string;
  label: string;
  streamUrl?: string;
  embedUrl?: string;
  isDirectStream?: boolean;
  hd?: boolean;
  language?: string;
}

export interface MatchTeams {
  home?: {
    name?: string;
    badge?: string;
  };
  away?: {
    name?: string;
    badge?: string;
  };
}

export interface Match {
  id?: string;
  slug?: string;
  title: string;
  category: Category | string;
  status: 'Live' | 'Upcoming' | 'Final' | string;
  date?: string | number;
  startTime?: string;
  timestamp?: number;
  poster?: string;
  thumbnail?: string;
  teams?: MatchTeams;
  streams?: StreamSource[];
  league?: string;
  venue?: string;
  score?: string;
  round?: string;
}

export interface NplMatch {
  id: string;
  matchNumber: number;
  homeTeam: string;
  awayTeam: string;
  homeTeamShort: string;
  awayTeamShort: string;
  homeTeamLogo?: string;
  awayTeamLogo?: string;
  homeTeamColor?: string;
  awayTeamColor?: string;
  homeScore?: string;
  awayScore?: string;
  round: string;
  venue: string;
  timestamp: number;
  status: 'UPCOMING' | 'LIVE' | 'COMPLETED';
  summary?: string;
  broadcast?: {
    authorizedEmbedUrl?: string;
    channelName?: string;
  };
}

export interface UserPreferences {
  favoriteTeams: string[];
  starredMatches: string[];
  notifications: {
    enabled: boolean;
    vibrationEnabled: boolean;
    remind30Min: boolean;
    remind5Min: boolean;
    notifyKickoff: boolean;
    notifyGoalsWickets: boolean;
  };
}

export type RootStackParamList = {
  MainTabs: undefined;
  MatchPlayer: {
    match: Match;
  };
  NotificationSettings: undefined;
};

