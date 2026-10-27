import { sanitizePlaybackUrl, fetchUnifiedMatches, resolveUnifiedPlayback } from './providers';

export const categories = ['football', 'cricket', 'basketball'] as const;
export type Category = (typeof categories)[number];

export const FOOTBALL_LEAGUES = [
  'All',
  'Premier League',
  'La Liga',
  'Champions League',
  'Bundesliga',
  'Ligue 1',
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

const LIGUE_1_CLUBS = [
  'psg', 'paris saint-germain', 'paris sg', 'paris', 'marseille', 'om', 'olympique de marseille',
  'monaco', 'as monaco', 'lyon', 'olympique lyonnais', 'ol', 'lille', 'losc', 'nice', 'ogc nice',
  'rennes', 'stade rennais', 'lens', 'rc lens', 'strasbourg', 'brest', 'stade brestois',
  'toulouse', 'reims', 'stade de reims', 'nantes', 'fc nantes', 'montpellier', 'auxerre',
  'angers', 'le havre', 'saint-etienne', 'as saint-etienne', 'st etienne', 'lorient', 'metz'
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
  competition?: string;
  league?: string;
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


export function detectFootballLeague(match: Match): Exclude<FootballLeague, 'All'> {
  const raw = `${match.title || match.name || ''} ${match.league || match.competition || ''} ${(match.sources || []).map((s) => s.id || '').join(' ')}`;
  const text = normalizeText(raw);

  // 1. Champions League
  if (
    text.includes('champions-league') ||
    text.includes('champions league') ||
    text.includes('uefa champions') ||
    text.includes('-ucl-')
  ) {
    return 'Champions League';
  }

  // 2. Explicit League Names in title or competition metadata
  if (text.includes('premier-league') || text.includes('premier league') || text.includes('premierleague') || text.includes('epl')) {
    return 'Premier League';
  }
  if (text.includes('la-liga') || text.includes('la liga') || text.includes('laliga') || text.includes('primera-division')) {
    return 'La Liga';
  }
  if (text.includes('bundesliga')) {
    return 'Bundesliga';
  }
  if (text.includes('ligue 1') || text.includes('ligue-1') || text.includes('ligue1') || text.includes('french ligue')) {
    return 'Ligue 1';
  }
  if (text.includes('serie-a') || text.includes('serie a') || text.includes('seriea')) {
    return 'Serie A';
  }
  if (text.includes('major-league-soccer') || text.includes('mls') || text.includes('-mls-')) {
    return 'MLS';
  }

  // 3. Match against known league clubs
  const titleNorm = normalizeText(match.title || match.name || '');
  const parts = titleNorm.split(/\s+vs\.?\s+|\s+-\s+/i);
  const t1 = parts[0]?.trim() || '';
  const t2 = parts[1]?.trim() || '';

  const isEpl1 = PREMIER_LEAGUE_CLUBS.some((c) => t1.includes(c));
  const isEpl2 = PREMIER_LEAGUE_CLUBS.some((c) => t2.includes(c));
  if (isEpl1 || isEpl2) return 'Premier League';

  const isLaLiga1 = LA_LIGA_CLUBS.some((c) => t1.includes(c));
  const isLaLiga2 = LA_LIGA_CLUBS.some((c) => t2.includes(c));
  if (isLaLiga1 || isLaLiga2) return 'La Liga';

  const isBunde1 = BUNDESLIGA_CLUBS.some((c) => t1.includes(c));
  const isBunde2 = BUNDESLIGA_CLUBS.some((c) => t2.includes(c));
  if (isBunde1 || isBunde2) return 'Bundesliga';

  const isLigue1_1 = LIGUE_1_CLUBS.some((c) => t1.includes(c));
  const isLigue1_2 = LIGUE_1_CLUBS.some((c) => t2.includes(c));
  if (isLigue1_1 || isLigue1_2) return 'Ligue 1';

  const isSerieA1 = SERIE_A_CLUBS.some((c) => t1.includes(c));
  const isSerieA2 = SERIE_A_CLUBS.some((c) => t2.includes(c));
  if (isSerieA1 || isSerieA2) return 'Serie A';

  const isMls1 = MLS_CLUBS.some((c) => t1.includes(c));
  const isMls2 = MLS_CLUBS.some((c) => t2.includes(c));
  if (isMls1 || isMls2) return 'MLS';

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
  // 1. Timestamp-based calculation is ground truth: a fixture in the future can NEVER be live
  const rawDate = match.date || match.startTime || match.start_at || match.timestamp;
  if (rawDate) {
    const start = typeof rawDate === 'number' ? rawDate : new Date(rawDate).getTime();
    if (!Number.isNaN(start) && start > 0) {
      const now = Date.now();
      // If kickoff is more than 10 minutes in the future, it is strictly UPCOMING
      if (start - now > 10 * 60 * 1000) {
        return 'Upcoming';
      }
      // Active broadcast: 10 minutes prior to kickoff up to 3.5 hours after kickoff
      if (now >= start - 10 * 60 * 1000 && now <= start + 3.5 * 60 * 60 * 1000) {
        return 'Live';
      }
      if (now > start + 3.5 * 60 * 60 * 1000) {
        return 'Final';
      }
    }
  }

  // 2. 24/7 channels or permanent continuous feeds (e.g. Willow Cricket with date <= 0)
  if (typeof match.date === 'number' && match.date <= 0) return 'Live';

  // 3. Fallback to upstream status string if no timestamp available
  const status = String(match.status || '').toLowerCase();
  const time = String(match.time || '').toLowerCase();
  if (['live', 'inplay', 'in-play', 'ongoing'].includes(status) || time === 'live') return 'Live';
  if (['finished', 'complete', 'completed', 'ended', 'result'].includes(status)) return 'Final';

  return 'Upcoming';
}

export function getMatchTimestamp(match: Match): number | null {
  const value = match.date || match.startTime || match.start_at || match.timestamp;
  if (!value) return null;
  const num = typeof value === 'number' ? value : new Date(value).getTime();
  return Number.isNaN(num) || num <= 0 ? null : num;
}

export function timeOf(match: Match, timeZone: string = 'Asia/Kathmandu') {
  const value = match.date || match.startTime || match.start_at || match.timestamp;
  if (!value) return match.time || 'Time TBA';
  if (typeof value === 'number' && value <= 0) return '24/7 Live Feed';
  const date = new Date(value);
  if (Number.isNaN(date.getTime()) || date.getUTCFullYear() <= 1970) return match.time || 'Time TBA';
  try {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: timeZone || 'Asia/Kathmandu',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).format(date);
  } catch {
    return new Intl.DateTimeFormat('en-NP', {
      timeZone: 'Asia/Kathmandu',
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(date);
  }
}

export function isMatchOnDate(
  match: Match,
  filter: 'all' | 'today' | 'tomorrow' | 'week',
  timeZone: string = 'Asia/Kathmandu'
): boolean {
  if (filter === 'all') return true;
  const ts = getMatchTimestamp(match);
  if (!ts) return false;

  const tz = timeZone || 'Asia/Kathmandu';
  const now = new Date();
  const target = new Date(ts);

  try {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const nowDateStr = formatter.format(now);
    const matchDateStr = formatter.format(target);

    if (filter === 'today') {
      return nowDateStr === matchDateStr;
    }

    if (filter === 'tomorrow') {
      const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      const tomorrowDateStr = formatter.format(tomorrow);
      return tomorrowDateStr === matchDateStr;
    }

    if (filter === 'week') {
      const diffDays = (ts - now.getTime()) / (1000 * 60 * 60 * 24);
      return diffDays >= -0.5 && diffDays <= 7.5;
    }
  } catch {
    return true;
  }

  return true;
}

export function formatCountdown(targetTimestamp: number): string {
  const diff = targetTimestamp - Date.now();
  if (diff <= 0) return 'Kickoff now';
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diff % (1000 * 60)) / 1000);

  if (hours > 24) {
    const days = Math.floor(hours / 24);
    return `In ${days}d ${hours % 24}h`;
  }
  if (hours > 0) {
    return `In ${hours}h ${minutes}m`;
  }
  return `In ${minutes}m ${seconds}s`;
}

export function generateGoogleCalendarUrl(match: Match): string {
  const title = titleOf(match);
  const ts = getMatchTimestamp(match);
  if (!ts) return '';
  const start = new Date(ts);
  const end = new Date(ts + 2 * 60 * 60 * 1000);

  const startUtc = start.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  const endUtc = end.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

  const dates = `${startUtc}/${endUtc}`;
  const slug = slugify(title);
  const details = encodeURIComponent(
    `Watch ${title} live stream online on Sportivo:\nhttps://sportivo.dipeshsapkota7.com.np/${match.category || 'football'}/match/${slug}/`
  );
  const name = encodeURIComponent(`${title} — Sportivo`);
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${name}&dates=${dates}&details=${details}&location=Sportivo`;
}

export function generateIcsCalendarContent(match: Match): string {
  const title = titleOf(match);
  const ts = getMatchTimestamp(match);
  if (!ts) return '';
  const start = new Date(ts);
  const end = new Date(ts + 2 * 60 * 60 * 1000);

  const startUtc = start.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  const endUtc = end.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  const nowUtc = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

  const slug = slugify(title);
  const url = `https://sportivo.dipeshsapkota7.com.np/${match.category || 'football'}/match/${slug}/`;

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Sportivo//Live Sports Fixtures//EN',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:sportivo-${slug}-${ts}@sportivo.dipeshsapkota7.com.np`,
    `DTSTAMP:${nowUtc}`,
    `DTSTART:${startUtc}`,
    `DTEND:${endUtc}`,
    `SUMMARY:${title} (Sportivo Live)`,
    `DESCRIPTION:Watch ${title} on Sportivo: ${url}`,
    `URL:${url}`,
    'STATUS:CONFIRMED',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
}

export function getSafeThumbnailUrl(url: string | undefined): string | undefined {
  if (!url || typeof url !== 'string') return undefined;
  const trimmed = url.trim();
  if (!trimmed) return undefined;
  if (trimmed.startsWith('/')) return trimmed;

  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const parsed = new URL(trimmed);
      const host = parsed.hostname.toLowerCase();
      if (
        host === 'localhost' ||
        host === '127.0.0.1' ||
        host === '0.0.0.0' ||
        host === '::1' ||
        host.endsWith('.local') ||
        host.endsWith('.internal') ||
        host === '169.254.169.254' ||
        /^10\./.test(host) ||
        /^192\.168\./.test(host) ||
        /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(host)
      ) {
        return undefined;
      }
      // Route all external images through the local /api/thumbnail/ proxy
      // This prevents adblockers, Brave Shields, and ISP DNS filtering from blocking team logos and posters
      return `/api/thumbnail/?url=${encodeURIComponent(trimmed)}`;
    } catch {
      return undefined;
    }
  }

  return undefined;
}

export function publicUrl(value: string | undefined): string | null {
  if (!value || typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const parsed = new URL(trimmed);
      if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
        return parsed.toString();
      }
    } catch {}
  }
  return null;
}

export async function fetchMatches(category: Category, signal?: AbortSignal): Promise<Match[]> {
  try {
    const list = await fetchUnifiedMatches(category, signal);
    return list.slice(0, 30);
  } catch {
    return [];
  }
}

export async function fetchLiveMatches(signal?: AbortSignal): Promise<Match[]> {
  try {
    const results = await Promise.all(categories.map((c) => fetchMatches(c, signal)));
    const allMatches = results.flat();
    return allMatches.filter((m) => statusOf(m) === 'Live');
  } catch {
    return [];
  }
}

export async function fetchStream(source: string, id: string) {
  const resolution = await resolveUnifiedPlayback(source, id);
  if (resolution.status === 'ready' && resolution.streams.length > 0) {
    return resolution.streams;
  }
  return [];
}