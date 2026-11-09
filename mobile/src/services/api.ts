import AsyncStorage from '@react-native-async-storage/async-storage';
import { Match, NplMatch, Category, StreamSource } from '../types';

export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL || 'https://sportivo.dipeshsapkota7.com.np/api';

const CACHE_KEYS = {
  FOOTBALL: 'cache_matches_football',
  CRICKET: 'cache_matches_cricket',
  BASKETBALL: 'cache_matches_basketball',
  NPL: 'cache_matches_npl',
};

/**
 * Fetch matches for a specific sport category with automatic offline cache fallback
 */
export async function fetchMatches(category: Category): Promise<Match[]> {
  const cacheKey = `cache_matches_${category}`;
  try {
    const response = await fetch(`${API_BASE_URL}/matches/${category}/`, {
      headers: { Accept: 'application/json' },
    });

    if (response.ok) {
      const data: Match[] = await response.json();
      await AsyncStorage.setItem(cacheKey, JSON.stringify(data));
      return data;
    }
  } catch (error) {
    console.warn(`[API] Failed to fetch ${category} matches from network, loading offline cache`, error);
  }

  // Fallback to offline cached data
  try {
    const cached = await AsyncStorage.getItem(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }
  } catch {}

  return [];
}

/**
 * Fetch official Nepal Premier League (NPL 2026) live standings / points table
 */
export async function fetchNplStandings(): Promise<any[]> {
  try {
    const response = await fetch(`${API_BASE_URL}/npl/standings/`, {
      headers: { Accept: 'application/json' },
    });
    if (response.ok) {
      return await response.json();
    }
  } catch (e) {
    console.warn('[API] Could not fetch NPL standings:', e);
  }
  return [];
}

/**
 * Fetch official Nepal Premier League (NPL 2026) fixtures
 */
export async function fetchNplFixtures(): Promise<NplMatch[]> {
  try {
    const response = await fetch(`${API_BASE_URL}/npl/fixtures/`, {
      headers: { Accept: 'application/json' },
    });

    if (response.ok) {
      const json = await response.json();
      const fixtures: NplMatch[] = json.fixtures || [];
      await AsyncStorage.setItem(CACHE_KEYS.NPL, JSON.stringify(fixtures));
      return fixtures;
    }
  } catch (error) {
    console.warn('[API] Failed to fetch NPL fixtures from network, loading offline cache', error);
  }

  try {
    const cached = await AsyncStorage.getItem(CACHE_KEYS.NPL);
    if (cached) {
      return JSON.parse(cached);
    }
  } catch {}

  return [];
}

/**
 * Sanitize live cricket commentary and scoreboard text.
 * Strips mojibake artifacts, pseudo-HTML tags, and decodes HTML entities.
 */
export function cleanCricketText(raw: string | undefined | null): string {
  if (!raw || typeof raw !== 'string') return '';
  let str = raw;

  // 1. Fix UTF-8 / Windows-1252 mojibake artifacts
  str = str
    .replace(/â€¢/g, '•')
    .replace(/â€“/g, '–')
    .replace(/â€”/g, '—')
    .replace(/â€™/g, "'")
    .replace(/â€˜/g, "'")
    .replace(/â€œ/g, '"')
    .replace(/â€ /g, '"')
    .replace(/â€/g, '"')
    .replace(/Ã©/g, 'é')
    .replace(/Ã¡/g, 'á')
    .replace(/Â·/g, '·')
    .replace(/Â/g, '');

  // 2. Strip pseudo-HTML tags like &l;b&g;, &l;/b&g;, &l;span&g;, &l;/span&g;
  str = str.replace(/&l;[\s\S]*?&g;/gi, '');

  // 3. Strip standard HTML tags
  str = str.replace(/<\/?[a-z0-9_-]+[^>]*>/gi, '');

  // 4. Decode common HTML and cricket shorthand entities
  str = str
    .replace(/&s;/gi, "'")
    .replace(/&bull;/gi, '•')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&apos;/gi, "'")
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&mdash;/gi, '—')
    .replace(/&ndash;/gi, '–');

  // 5. Clean any lingering &l; or &g; or unresolved entities
  str = str.replace(/&l;/gi, '').replace(/&g;/gi, '');
  str = str.replace(/&[a-z0-9#]+;/gi, '');

  return str.trim();
}

/**
 * Resolve live multi-server streams for a match from Sportivo API
 */
export async function resolveMatchStreams(match: Match): Promise<StreamSource[]> {
  if (match.streams && match.streams.length > 0) {
    return match.streams;
  }

  let sources = match.sources || [];
  const isNpl =
    match.category === 'cricket' ||
    (match.id && match.id.includes('npl')) ||
    (match.title &&
      (match.title.toLowerCase().includes('pokhara') ||
        match.title.toLowerCase().includes('sudurpaschim') ||
        match.title.toLowerCase().includes('npl')));

  if (sources.length === 0 && isNpl) {
    sources = [{ source: 'npl', id: match.id || 'npl26-10', label: 'Action Sports HD / NPL Live' }];
  }

  const allResolved: StreamSource[] = [];

  for (const s of sources) {
    try {
      const src = encodeURIComponent(s.source);
      const sid = encodeURIComponent(s.id);
      const res = await fetch(`${API_BASE_URL}/stream/${src}/${sid}/`, {
        headers: { Accept: 'application/json' },
      });
      if (res.ok) {
        const list = await res.json();
        if (Array.isArray(list)) {
          list.forEach((item, idx) => {
            const url = item.embedUrl || item.streamUrl || item.url;
            if (url) {
              const cleanUrl = url.split('?')[0].toLowerCase();
              const isDirect =
                item.isNativeVideo === true &&
                (cleanUrl.endsWith('.m3u8') || cleanUrl.endsWith('.mp4')) &&
                !url.includes('plyrr') &&
                !url.includes('pages.dev');

              allResolved.push({
                id: `${s.source}-${idx}`,
                source: s.source,
                label: `Server ${allResolved.length + 1} HD`,
                embedUrl: url,
                streamUrl: isDirect ? url : undefined,
                isDirectStream: isDirect,
                hd: item.hd !== false,
              });
            }
          });
        }
      }
    } catch (e) {
      console.warn(`[API] Could not resolve stream for ${s.source}:`, e);
    }
  }

  // If upstream API was unreachable, provide offline-resilient verified streams for NPL
  if (allResolved.length === 0 && isNpl) {
    allResolved.push(
      {
        id: 'npl-multidevice-feed',
        source: 'npl',
        label: 'Server 1 HD (Multi-Device Action Sports)',
        embedUrl: 'https://yonotv.pages.dev/wtvplyrrr?manifest=https://a96aivottlinear-a.akamaihd.net/OTTB/iad-nitro/live/clients/dash/enc/8wxsmuwvra/out/v1/06f2368f16e8470b8593cb77dcad31fe/cenc.mpd&keyid=f638f10e9bee65a698926a527722e332&key=a9f519367caf419607f6705e3d767935',
        isDirectStream: false,
        hd: true,
      },
      {
        id: 'npl-nettv-edge-mtdc3',
        source: 'npl',
        label: 'Server 2 HD (NetTV Edge MTDC Live 3)',
        embedUrl: 'https://ott-edge-mtdc.nettv.com.np/npl/live_match3/index.mpd?CMCD=br%3D4194%2Cot%3Dm%2Cmtp%3D4194%2Csu%2Ccid%3D%22a-rz--cricket--p82103164700970876976%22%2Csf%3Dd%2Csid%3D%222822474a-c730-4fd1-8cc2-e615573de093%22%2Cst%3Dv',
        streamUrl: 'https://ott-edge-mtdc.nettv.com.np/npl/live_match3/index.mpd?CMCD=br%3D4194%2Cot%3Dm%2Cmtp%3D4194%2Csu%2Ccid%3D%22a-rz--cricket--p82103164700970876976%22%2Csf%3Dd%2Csid%3D%222822474a-c730-4fd1-8cc2-e615573de093%22%2Cst%3Dv',
        isDirectStream: false,
        hd: true,
      },
      {
        id: 'npl-nettv-lb3',
        source: 'npl',
        label: 'Server 3 HD (NetTV LB Live 3)',
        embedUrl: 'https://ott-lb.nettv.com.np/npl/live_match3/index.mpd?CMCD=br%3D4194%2Cot%3Dm%2Cmtp%3D4194%2Csu%2Ccid%3D%22a-rz--cricket--p82103164700970876976%22%2Csf%3Dd%2Csid%3D%222822474a-c730-4fd1-8cc2-e615573de093%22%2Cst%3Dv',
        streamUrl: 'https://ott-lb.nettv.com.np/npl/live_match3/index.mpd?CMCD=br%3D4194%2Cot%3Dm%2Cmtp%3D4194%2Csu%2Ccid%3D%22a-rz--cricket--p82103164700970876976%22%2Csf%3Dd%2Csid%3D%222822474a-c730-4fd1-8cc2-e615573de093%22%2Cst%3Dv',
        isDirectStream: false,
        hd: true,
      },
      {
        id: 'npl-nettv-edge-mtdc3-alt',
        source: 'npl',
        label: 'Server 4 HD (NetTV Edge MTDC Alt)',
        embedUrl: 'https://ott-edge-mtdc.nettv.com.np/npl/live_match3/index.mpd?CMCD=br%3D4194%2Cot%3Dm%2Cmtp%3D4194%2Csu%2Ccid%3D%22a-rz--cricket--p82103164700970876976%22%2Csf%3Dd%2Csid%3D%2272e4fbbc-1164-432c-a971-e66e1720d965%22%2Cst%3Dv',
        streamUrl: 'https://ott-edge-mtdc.nettv.com.np/npl/live_match3/index.mpd?CMCD=br%3D4194%2Cot%3Dm%2Cmtp%3D4194%2Csu%2Ccid%3D%22a-rz--cricket--p82103164700970876976%22%2Csf%3Dd%2Csid%3D%2272e4fbbc-1164-432c-a971-e66e1720d965%22%2Cst%3Dv',
        isDirectStream: false,
        hd: true,
      },
      {
        id: 'npl-nettv-lb3-alt',
        source: 'npl',
        label: 'Server 5 HD (NetTV LB Alt)',
        embedUrl: 'https://ott-lb.nettv.com.np/npl/live_match3/index.mpd?CMCD=br%3D4194%2Cot%3Dm%2Cmtp%3D4194%2Csu%2Ccid%3D%22a-rz--cricket--p82103164700970876976%22%2Csf%3Dd%2Csid%3D%2272e4fbbc-1164-432c-a971-e66e1720d965%22%2Cst%3Dv',
        streamUrl: 'https://ott-lb.nettv.com.np/npl/live_match3/index.mpd?CMCD=br%3D4194%2Cot%3Dm%2Cmtp%3D4194%2Csu%2Ccid%3D%22a-rz--cricket--p82103164700970876976%22%2Csf%3Dd%2Csid%3D%2272e4fbbc-1164-432c-a971-e66e1720d965%22%2Cst%3Dv',
        isDirectStream: false,
        hd: true,
      },
      {
        id: 'npl-actionsports-akamai',
        source: 'npl',
        label: 'Server 6 HD (Akamai Master)',
        embedUrl: 'https://yonotv.pages.dev/wtvplyrrr?manifest=https://a96aivottlinear-a.akamaihd.net/OTTB/pdx-nitro/live/clients/dash/enc/3qvpw810gz/out/v1/e4b320f9ef924fe59188752dcf9c7fbf/cenc.mpd&keyid=5d52529b6ff19eca2315013244513b68&key=ba5c7dfad287aab538463d9da6811a8c',
        isDirectStream: false,
        hd: true,
      },
      {
        id: 'npl-nettv-hls',
        source: 'npl',
        label: 'Server 7 HD (TU Ground HLS)',
        embedUrl: 'https://lb-ottnp.nettvstreamz.com/npl/live_match6/playlist.m3u8',
        streamUrl: 'https://lb-ottnp.nettvstreamz.com/npl/live_match6/playlist.m3u8',
        isDirectStream: true,
        hd: true,
      }
    );
  }

  // Prioritize direct unencrypted HLS first, then multi-device webview feeds
  allResolved.sort((a, b) => {
    if (a.isDirectStream && !b.isDirectStream) return -1;
    if (!a.isDirectStream && b.isDirectStream) return 1;
    return 0;
  });

  allResolved.forEach((item, idx) => {
    item.label = `Server ${idx + 1} HD`;
  });

  return allResolved;
}

/**
 * Format any timestamp into Nepal Standard Time (NST) with AM/PM
 */
export function formatKathmanduTime(timestamp: number | string): string {
  try {
    const date = new Date(timestamp);
    return new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Kathmandu',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).format(date);
  } catch {
    return '8:45 PM';
  }
}

export function formatKathmanduDate(timestamp: number | string): string {
  try {
    const date = new Date(timestamp);
    return new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Kathmandu',
      month: 'short',
      day: 'numeric',
    }).format(date);
  } catch {
    return 'Today';
  }
}

export function getKathmanduDateKey(timestamp: number | string): string {
  const parts = new Intl.DateTimeFormat('en', {
    timeZone: 'Asia/Kathmandu',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(timestamp));
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export interface LiveScorerMobile {
  score: string;
  overs: string;
  crr?: string;
  rrr?: string;
  target?: string;
  header?: {
    matchNumber?: string;
    matchTitle?: string;
    venue?: string;
    tossNote?: string;
    team1Short?: string;
    team1Name?: string;
    team1Score?: string;
    team1Overs?: string;
    team2Short?: string;
    team2Name?: string;
    team2Score?: string;
    team2Overs?: string;
    activeTeam?: 1 | 2;
    target?: string;
    crr?: string;
    rrr?: string;
  };
  batters?: Array<{
    name: string;
    isOnStrike: boolean;
    runs: string;
    balls: string;
    fours: string;
    sixes: string;
    strikeRate?: string;
  }>;
  bowler?: {
    name: string;
    figures: string;
    overs?: string;
    economy?: string;
  };
  recentBalls: Array<{
    over: number;
    delivery: number;
    code: string;
    teamScore?: string;
    isBoundary: boolean;
    isWicket: boolean;
  }>;
  commentary: Array<{
    ball: string;
    bowlerToBatsman: string;
    text: string;
    outcome?: string;
    isBoundary?: boolean;
    isWicket?: boolean;
  }>;
}

export async function fetchLiveDeskMoments(): Promise<LiveScorerMobile | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/npl/live-moments/?_t=${Date.now()}`, {
      headers: { Accept: 'application/json' },
    });
    if (res.ok) {
      const data: LiveScorerMobile = await res.json();
      if (data) {
        if (data.header) {
          if (data.header.tossNote) data.header.tossNote = cleanCricketText(data.header.tossNote);
          if (data.header.target) data.header.target = cleanCricketText(data.header.target);
          if (data.header.venue) data.header.venue = cleanCricketText(data.header.venue);
        }
        if (Array.isArray(data.batters)) {
          data.batters.forEach((b) => {
            b.name = cleanCricketText(b.name);
          });
        }
        if (data.bowler) {
          data.bowler.name = cleanCricketText(data.bowler.name);
        }
        if (Array.isArray(data.commentary)) {
          data.commentary.forEach((c) => {
            c.bowlerToBatsman = cleanCricketText(c.bowlerToBatsman);
            c.text = cleanCricketText(c.text);
          });
        }
      }
      return data;
    }
  } catch {}
  return null;
}


