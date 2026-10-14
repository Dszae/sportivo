export const categories = ['football', 'cricket', 'basketball'] as const;
export type Category = (typeof categories)[number];

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