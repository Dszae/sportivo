export const categories = ['football', 'cricket', 'basketball'] as const;
export type Category = (typeof categories)[number];

export const FOOTBALL_LEAGUES = [
  'All',
  'Champions League',
  'Premier League',
  'La Liga',
  'Bundesliga',
  'Serie A',
  'MLS',
  'Other Leagues',
] as const;
export type FootballLeague = (typeof FOOTBALL_LEAGUES)[number];

const PREMIER_LEAGUE_CLUBS = [
  'arsenal', 'aston villa', 'bournemouth', 'brentford', 'brighton', 'chelsea',
  'crystal palace', 'everton', 'fulham', 'ipswich', 'leicester', 'liverpool',
  'manchester city', 'man city', 'manchester united', 'man utd', 'man united',
  'newcastle', 'nottingham forest', 'nottingham', 'southampton', 'tottenham',
  'spurs', 'west ham', 'wolves', 'wolverhampton', 'sunderland', 'leeds united',
  'hull city', 'coventry city', 'burnley', 'sheffield united', 'sheffield wednesday',
  'middlesbrough', 'norwich', 'west brom', 'luton', 'watford', 'blackburn', 'stoke city',
  'derby county', 'portsmouth', 'preston', 'swansea', 'cardiff', 'millwall', 'bristol city', 'qpr'
];

const LA_LIGA_CLUBS = [
  'alaves', 'athletic club', 'athletic bilbao', 'atletico madrid', 'barcelona', 'celta vigo',
  'espanyol', 'getafe', 'girona', 'las palmas', 'leganes', 'mallorca', 'osasuna', 'rayo vallecano',
  'real betis', 'real madrid', 'real sociedad', 'sevilla', 'valencia', 'valladolid', 'villarreal',
  'granada', 'cadiz', 'almeria', 'elche', 'levante', 'racing santander', 'zaragoza', 'sporting gijon',
  'eibar', 'tenerife', 'oviedo'
];

const BUNDESLIGA_CLUBS = [
  'augsburg', 'bayer leverkusen', 'leverkusen', 'bayern munich', 'bayern', 'bochum',
  'borussia dortmund', 'dortmund', 'borussia monchengladbach', 'eintracht frankfurt', 'frankfurt',
  'freiburg', 'heidenheim', 'hoffenheim', 'holstein kiel', 'leipzig', 'rb leipzig', 'mainz',
  'st. pauli', 'stuttgart', 'union berlin', 'werder bremen', 'wolfsburg', 'hamburg', 'hertha bsc',
  'hertha berlin', 'schalke', 'hannover', 'nurnberg', 'fortuna dusseldorf', 'kaiserslautern',
  'karlsruher', 'paderborn', 'greuther furth', 'darmstadt', 'cologne', 'koln'
];

const SERIE_A_CLUBS = [
  'atalanta', 'bologna', 'cagliari', 'como', 'empoli', 'fiorentina', 'genoa',
  'hellas verona', 'verona', 'inter milan', 'inter', 'internazionale', 'juventus',
  'lazio', 'lecce', 'monza', 'napoli', 'parma', 'roma', 'as roma', 'torino', 'udinese', 'venezia',
  'sassuolo', 'salernitana', 'frosinone', 'cremonese', 'spezia', 'sampdoria', 'palermo',
  'bari', 'brescia', 'cesena', 'pisa', 'catanzaro', 'modena', 'reggiana'
];

const MLS_CLUBS = [
  'atlanta united', 'austin fc', 'charlotte fc', 'chicago fire', 'fc cincinnati',
  'colorado rapids', 'columbus crew', 'd.c. united', 'dc united', 'fc dallas',
  'houston dynamo', 'sporting kansas city', 'la galaxy', 'lafc', 'los angeles fc',
  'inter miami', 'minnesota united', 'cf montreal', 'montreal', 'nashville sc',
  'new england revolution', 'new york city fc', 'nycfc', 'new york red bulls', 'red bull new york',
  'orlando city', 'philadelphia union', 'portland timbers', 'real salt lake', 'san jose earthquakes',
  'seattle sounders', 'st. louis city', 'toronto fc', 'vancouver whitecaps'
];

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

export type Team = { logo?: string; name?: string };
export type StreamSource = { source?: string; id?: string };
export type Match = {
  id?: string;
  title?: string;
  name?: string;
  category?: string;
  status?: string;
  time?: string;
  date?: string | number;
  startTime?: string;
  start_at?: string;
  timestamp?: string | number;
  teams?: Team[] | { home?: { name?: string; badge?: string }; away?: { name?: string; badge?: string } };
  poster?: string;
  image?: string;
  thumbnail?: string;
  sources?: StreamSource[];
};

const upstream = 'https://streamed.pk';

export function detectFootballLeague(match: Match): Exclude<FootballLeague, 'All'> {
  const raw = `${match.title || match.name || ''} ${(match.sources || []).map((s) => s.id || '').join(' ')}`;
  const text = normalizeText(raw);

  // 1. Champions League
  if (text.includes('champions-league') || text.includes('champions league') || text.includes('uefa champions') || text.includes('-ucl-')) {
    return 'Champions League';
  }

  // 2. MLS
  if (text.includes('major-league-soccer') || text.includes(' mls') || text.includes('-mls-')) {
    return 'MLS';
  }

  const titleNorm = normalizeText(match.title || match.name || '');
  const parts = titleNorm.split(/\s+vs\.?\s+|\s+-\s+/i);
  const t1 = parts[0]?.trim() || '';
  const t2 = parts[1]?.trim() || '';

  const isMls1 = MLS_CLUBS.some((c) => t1.includes(c));
  const isMls2 = MLS_CLUBS.some((c) => t2.includes(c));
  if (isMls1 || isMls2) return 'MLS';

  const isEpl1 = PREMIER_LEAGUE_CLUBS.some((c) => t1.includes(c));
  const isEpl2 = PREMIER_LEAGUE_CLUBS.some((c) => t2.includes(c));
  if (isEpl1 && isEpl2) return 'Premier League';

  const isLaLiga1 = LA_LIGA_CLUBS.some((c) => t1.includes(c));
  const isLaLiga2 = LA_LIGA_CLUBS.some((c) => t2.includes(c));
  if (isLaLiga1 && isLaLiga2) return 'La Liga';

  const isBunde1 = BUNDESLIGA_CLUBS.some((c) => t1.includes(c));
  const isBunde2 = BUNDESLIGA_CLUBS.some((c) => t2.includes(c));
  if (isBunde1 && isBunde2) return 'Bundesliga';

  const isSerieA1 = SERIE_A_CLUBS.some((c) => t1.includes(c));
  const isSerieA2 = SERIE_A_CLUBS.some((c) => t2.includes(c));
  if (isSerieA1 && isSerieA2) return 'Serie A';

  // Explicit league strings in source / URL
  if (text.includes('premier-league') || text.includes('premierleague') || text.includes('epl')) return 'Premier League';
  if (text.includes('la-liga') || text.includes('laliga') || text.includes('primera-division')) return 'La Liga';
  if (text.includes('bundesliga')) return 'Bundesliga';
  if (text.includes('serie-a') || text.includes('seriea')) return 'Serie A';

  return 'Other Leagues';
}

export function isCategory(value: string): value is Category {
  return categories.includes(value as Category);
}

export function titleOf(match: Match) {
  return match.title || match.name || 'Untitled fixture';
}

export function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 100) || 'fixture';
}

export function statusOf(match: Match) {
  const status = String(match.status || '').toLowerCase();
  const time = String(match.time || '').toLowerCase();
  if (['live', 'inplay', 'in-play', 'ongoing'].includes(status) || time === 'live') return 'Live';
  if (['finished', 'complete', 'completed', 'ended', 'result'].includes(status)) return 'Final';

  // 24/7 channels or permanent continuous broadcasts
  if (typeof match.date === 'number' && match.date <= 0) return 'Live';

  // Timestamp-based calculation: matches within broadcast duration window
  const rawDate = match.date || match.startTime || match.start_at || match.timestamp;
  if (rawDate) {
    const start = typeof rawDate === 'number' ? rawDate : new Date(rawDate).getTime();
    if (!Number.isNaN(start) && start > 0) {
      const now = Date.now();
      // Estimated active broadcast: from match start up to 3.5 hours
      if (now >= start && now <= start + 3.5 * 60 * 60 * 1000) {
        return 'Live';
      }
      if (now > start + 3.5 * 60 * 60 * 1000) {
        return 'Final';
      }
    }
  }

  return 'Upcoming';
}

export function timeOf(match: Match) {
  const value = match.date || match.startTime || match.start_at || match.timestamp;
  if (!value) return match.time || 'Time TBA';
  if (typeof value === 'number' && value <= 0) return '24/7 Live Feed';
  const date = new Date(value);
  if (Number.isNaN(date.getTime()) || date.getUTCFullYear() <= 1970) return match.time || 'Time TBA';
  return new Intl.DateTimeFormat('en-NP', {
    timeZone: 'Asia/Kathmandu',
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

export function publicUrl(value: string | undefined) {
  if (!value) return null;
  try {
    const url = new URL(value, upstream);
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password ? url.toString() : null;
  } catch {
    return null;
  }
}

export async function fetchLiveMatches(signal?: AbortSignal): Promise<Match[]> {
  try {
    const response = await fetch(`${upstream}/api/matches/live`, {
      headers: { accept: 'application/json' },
      signal,
    });
    if (!response.ok) return [];
    const data: unknown = await response.json();
    return Array.isArray(data) ? (data as Match[]) : [];
  } catch {
    return [];
  }
}

export async function fetchMatches(category: Category, signal?: AbortSignal): Promise<Match[]> {
  const [matchesRes, liveRes] = await Promise.allSettled([
    fetch(`${upstream}/api/matches/${category}`, {
      headers: { accept: 'application/json' },
      signal,
    }),
    fetch(`${upstream}/api/matches/live`, {
      headers: { accept: 'application/json' },
      signal,
    }),
  ]);

  if (matchesRes.status !== 'fulfilled' || !matchesRes.value.ok) {
    const code = matchesRes.status === 'fulfilled' ? matchesRes.value.status : 'network error';
    throw new Error(`Fixture provider returned ${code}`);
  }

  const data: unknown = await matchesRes.value.json();
  const matches = Array.isArray(data) ? (data as Match[]) : [];

  const liveIds = new Set<string>();
  if (liveRes.status === 'fulfilled' && liveRes.value.ok) {
    try {
      const liveData: unknown = await liveRes.value.json();
      if (Array.isArray(liveData)) {
        liveData.forEach((item: Match) => {
          if (item.id) liveIds.add(item.id);
        });
      }
    } catch {
      // live fallback gracefully omitted
    }
  }

  return matches.map((match) => {
    if (match.id && liveIds.has(match.id)) {
      return { ...match, status: 'live' };
    }
    return match;
  });
}

export async function fetchStream(source: string, id: string) {
  const response = await fetch(`${upstream}/api/stream/${encodeURIComponent(source)}/${encodeURIComponent(id)}`, {
    headers: { accept: 'application/json' },
  });
  if (!response.ok) throw new Error(`Stream provider returned ${response.status}`);
  return response.json();
}