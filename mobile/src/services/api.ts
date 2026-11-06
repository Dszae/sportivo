import AsyncStorage from '@react-native-async-storage/async-storage';
import { Match, NplMatch, Category, StreamSource } from '../types';

export const API_BASE_URL = 'https://sportivo.dipeshsapkota7.com.np/api';

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
                item.isNativeVideo === true ||
                cleanUrl.endsWith('.m3u8') ||
                cleanUrl.endsWith('.mp4') ||
                cleanUrl.endsWith('.mpd');

              allResolved.push({
                id: `${s.source}-${idx}`,
                source: s.source,
                label: `Server DSZ${allResolved.length + 1}`,
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
        id: 'npl-nettv-lb',
        source: 'npl',
        label: 'Server DSZ1',
        embedUrl: 'https://ott-lb.nettv.com.np/npl/live_match/index.mpd',
        streamUrl: 'https://ott-lb.nettv.com.np/npl/live_match/index.mpd',
        isDirectStream: true,
        hd: true,
      },
      {
        id: 'npl-nettv-edge3',
        source: 'npl',
        label: 'Server DSZ2',
        embedUrl: 'https://ott-edge-mtdc03.nettv.com.np/npl/live_match/index.mpd',
        streamUrl: 'https://ott-edge-mtdc03.nettv.com.np/npl/live_match/index.mpd',
        isDirectStream: true,
        hd: true,
      },
      {
        id: 'npl-nettv-hls',
        source: 'npl',
        label: 'Server DSZ3',
        embedUrl: 'https://lb-ottnp.nettvstreamz.com/npl/live_match6/playlist.m3u8',
        streamUrl: 'https://lb-ottnp.nettvstreamz.com/npl/live_match6/playlist.m3u8',
        isDirectStream: true,
        hd: true,
      },
      {
        id: 'npl-actionsports-akamai',
        source: 'npl',
        label: 'Server DSZ4',
        embedUrl: 'https://yonotv.pages.dev/wtvplyrrr?manifest=https://a96aivottlinear-a.akamaihd.net/OTTB/pdx-nitro/live/clients/dash/enc/3qvpw810gz/out/v1/e4b320f9ef924fe59188752dcf9c7fbf/cenc.mpd&keyid=5d52529b6ff19eca2315013244513b68&key=ba5c7dfad287aab538463d9da6811a8c',
        isDirectStream: false,
        hd: true,
      }
    );
  }

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
      return await res.json();
    }
  } catch {}
  return null;
}


