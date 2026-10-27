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

const upstream = 'https://strmfree.st';

export function detectFootballLeague(match: Match): Exclude<FootballLeague, 'All'> {
  const raw = `${match.title || match.name || ''} ${match.league || match.competition || ''} ${(match.sources || []).map((s) => s.id || '').join(' ')}`;
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

export function publicUrl(value: string | undefined) {
  if (!value) return null;
  try {
    const url = new URL(value, upstream);
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password ? url.toString() : null;
  } catch {
    return null;
  }
}

export async function fetchMatches(category: Category, signal?: AbortSignal): Promise<Match[]> {
  const timeoutMs = 4000;
  const timeoutSignal = AbortSignal.timeout(timeoutMs);
  const effectiveSignal = signal ? AbortSignal.any([signal, timeoutSignal]) : timeoutSignal;

  const matches: Match[] = [];
  const seenSlugs = new Set<string>();

  function addMatch(m: Match) {
    const slug = slugify(titleOf(m));
    if (!slug || seenSlugs.has(slug)) return;
    seenSlugs.add(slug);
    matches.push(m);
  }

  // 1. Fetch strmfree streams
  const fetchStrmFreeStreams = async () => {
    try {
      const res = await fetch(`${upstream}/streams`, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', accept: 'application/json' },
        signal: effectiveSignal,
      });
      if (!res.ok) return;
      const data: any = await res.json();
      const strmCat = category === 'football' ? 'soccer' : category;
      const items = data?.streams?.[strmCat] || [];
      for (const item of items) {
        const team1 = item.team1;
        const team2 = item.team2;
        addMatch({
          id: item.stream_key || item.id,
          title: item.name,
          category,
          competition: item.league,
          league: item.league,
          status: 'live',
          date: item.match_timestamp ? item.match_timestamp * 1000 : Date.now(),
          poster: item.thumbnail_url
            ? item.thumbnail_url.startsWith('http')
              ? item.thumbnail_url
              : `${upstream}${item.thumbnail_url}`
            : team1?.logo || undefined,
          teams:
            team1 && team2
              ? {
                  home: { name: team1.name, badge: team1.logo },
                  away: { name: team2.name, badge: team2.logo },
                }
              : undefined,
          sources: [{ source: 'strmfree', id: item.stream_key || item.id }],
        });
      }
    } catch {
      // gracefully ignored
    }
  };

  // 2. Fetch strmfree fixtures
  const fetchStrmFreeFixtures = async () => {
    try {
      const fixCat = category === 'football' ? 'soccer' : category;
      const res = await fetch(`${upstream}/fixtures/${fixCat}`, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', accept: 'application/json' },
        signal: effectiveSignal,
      });
      if (!res.ok) return;
      const data: any = await res.json();
      const dates = Object.keys(data?.fixtures || {});
      const now = Date.now();
      for (const dateKey of dates) {
        const list = data.fixtures[dateKey]?.fixtures || [];
        for (const item of list) {
          const rawName: string = item.event_name || '';
          const title = rawName.includes(' at ') ? rawName.replace(' at ', ' vs ') : rawName;
          const matchTimeMs = item.date_unix ? item.date_unix * 1000 : new Date(dateKey).getTime();
          const isLiveNow = matchTimeMs > 0 && now >= matchTimeMs && now <= matchTimeMs + 3.5 * 3600 * 1000;
          const isPast = matchTimeMs > 0 && now > matchTimeMs + 3.5 * 3600 * 1000;
          const status = isLiveNow ? 'live' : isPast ? 'finished' : 'upcoming';

          const team1 = item.team1;
          const team2 = item.team2;
          addMatch({
            id: slugify(title),
            title,
            category,
            competition: item.competition,
            league: item.competition,
            status,
            date: matchTimeMs,
            poster: team1?.logo || team2?.logo || undefined,
            teams:
              team1 && team2
                ? {
                    home: { name: team2.name, badge: team2.logo },
                    away: { name: team1.name, badge: team1.logo },
                  }
                : undefined,
            sources: [{ source: 'strmfree', id: slugify(title) }],
          });
        }
      }
    } catch {
      // gracefully ignored
    }
  };

  // 3. Timst live-upcoming events
  const fetchTimstEvents = async () => {
    try {
      const res = await fetch('https://timst.top/api/live-upcoming', {
        headers: { 'User-Agent': 'Mozilla/5.0', accept: 'application/json' },
        signal: effectiveSignal,
      });
      if (!res.ok) return;
      const data: any = await res.json();
      const genreMap: Record<Category, number> = { football: 1, basketball: 7, cricket: 13 };
      const targetGenre = genreMap[category];
      const items = (data?.events || []).filter((e: any) => e.genre === targetGenre);
      for (const item of items) {
        const streamUrl = item.streams?.[0]?.url;
        const title = (item.name || '').replace(' @ ', ' vs ').replace(' v ', ' vs ');
        addMatch({
          id: item.url || slugify(title),
          title,
          category,
          status: 'live',
          date: item.time ? new Date(item.time).getTime() : Date.now(),
          poster: item.logo || undefined,
          sources: streamUrl ? [{ source: 'direct', id: streamUrl }] : [],
        });
      }
    } catch {
      // gracefully ignored
    }
  };

  // 4. Timst channels (24/7 live feeds for cricket, basketball, football)
  const fetchTimstChannels = async () => {
    try {
      const res = await fetch('https://timst.top/api/channels', {
        headers: { 'User-Agent': 'Mozilla/5.0', accept: 'application/json' },
        signal: effectiveSignal,
      });
      if (!res.ok) return;
      const data: any = await res.json();
      const filterTerms: Record<Category, string[]> = {
        football: ['sky sports football', 'premier sports', 'bein sports', 'tnt sports'],
        basketball: ['nba tv'],
        cricket: ['cricket', 'willow'],
      };
      const terms = filterTerms[category] || [];
      const channels = (data?.channels || []).filter((c: any) => {
        const name = (c.name || '').toLowerCase();
        return terms.some((t) => name.includes(t));
      });
      for (const chan of channels) {
        const streamUrl = chan.streams?.[0]?.url;
        if (!streamUrl) continue;
        addMatch({
          id: chan.url || slugify(chan.name),
          title: `${chan.name} — 24/7 Live Stream`,
          category,
          status: 'live',
          date: 0,
          poster: chan.logo || undefined,
          sources: [{ source: 'direct', id: streamUrl }],
        });
      }
    } catch {
      // gracefully ignored
    }
  };

  // 5. ESPN NBA Games (for basketball supplement)
  const fetchEspnNba = async () => {
    if (category !== 'basketball') return;
    try {
      const res = await fetch('https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard', {
        headers: { accept: 'application/json' },
        signal: effectiveSignal,
      });
      if (!res.ok) return;
      const data: any = await res.json();
      for (const event of data?.events || []) {
        const comp = event.competitions?.[0];
        const team1 = comp?.competitors?.[0];
        const team2 = comp?.competitors?.[1];
        const statusType = event.status?.type?.name;
        const isLive = statusType === 'STATUS_IN_PROGRESS';
        const isFinal = statusType === 'STATUS_FINAL';
        const title = event.name ? event.name.replace(' at ', ' vs ') : `${team2?.team?.name} vs ${team1?.team?.name}`;
        addMatch({
          id: event.id || slugify(title),
          title,
          category: 'basketball',
          competition: 'NBA',
          league: 'NBA',
          status: isLive ? 'live' : isFinal ? 'finished' : 'upcoming',
          date: event.date ? new Date(event.date).getTime() : Date.now(),
          poster: team1?.team?.logo || team2?.team?.logo || undefined,
          teams:
            team1 && team2
              ? {
                  home: { name: team1.team?.displayName, badge: team1.team?.logo },
                  away: { name: team2.team?.displayName, badge: team2.team?.logo },
                }
              : undefined,
          sources: [{ source: 'strmfree', id: slugify(title) }],
        });
      }
    } catch {
      // gracefully ignored
    }
  };

  await Promise.allSettled([
    fetchStrmFreeStreams(),
    fetchStrmFreeFixtures(),
    fetchTimstEvents(),
    fetchTimstChannels(),
    fetchEspnNba(),
  ]);

  // Sort: Live first, upcoming ordered by kickoff time, 24/7 feeds, completed matches last
  return matches.sort((a, b) => {
    const statusA = statusOf(a);
    const statusB = statusOf(b);
    if (statusA === 'Live' && statusB !== 'Live') return -1;
    if (statusB === 'Live' && statusA !== 'Live') return 1;

    const tsA = getMatchTimestamp(a) ?? 0;
    const tsB = getMatchTimestamp(b) ?? 0;

    // 24/7 feeds have ts === 0
    if (tsA === 0 && tsB !== 0) return 1;
    if (tsB === 0 && tsA !== 0) return -1;

    if (statusA === 'Final' && statusB !== 'Final') return 1;
    if (statusB === 'Final' && statusA !== 'Final') return -1;

    return tsA - tsB;
  });
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
  if (source === 'direct') {
    return [{ embedUrl: id, hd: true, language: 'English' }];
  }

  if (source === 'strmfree') {
    try {
      const res = await fetch(`${upstream}/api/v1/sources/${encodeURIComponent(id)}`, {
        headers: { 'User-Agent': 'Mozilla/5.0', accept: 'application/json' },
        signal: AbortSignal.timeout(4000),
      });
      if (res.ok) {
        const data = await res.json();
        const sources: string[] = data?.sources || [];
        if (sources.length > 0) {
          return sources.map((url) => ({
            embedUrl: url,
            hd: url.includes('1080p') || url.includes('720p'),
            language: 'English',
          }));
        }
      }
    } catch {
      // fallback to standard strmfree embed below
    }

    // Default embed fallback for strmfree
    return [
      {
        embedUrl: `${upstream}/embed/soccer/${encodeURIComponent(id)}1080p`,
        hd: true,
        language: 'English',
      },
    ];
  }

  if (source === 'timst') {
    return [
      {
        embedUrl: id.startsWith('http') ? id : `https://timst.top/${id}`,
        hd: true,
        language: 'English',
      },
    ];
  }

  return [{ embedUrl: id, hd: true, language: 'English' }];
}