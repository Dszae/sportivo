import AsyncStorage from '@react-native-async-storage/async-storage';
import { Match, NplMatch, Category } from '../types';

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

  const sources = match.sources || [];
  if (sources.length === 0) {
    return [];
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
              const isDirect = url.includes('.m3u8') || url.includes('.mp4');
              allResolved.push({
                id: `${s.source}-${idx}`,
                source: s.source,
                label: item.language || `Server ${allResolved.length + 1} (${s.source})`,
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

