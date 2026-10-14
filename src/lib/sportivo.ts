export const categories = ['football', 'cricket', 'basketball'] as const;
export type Category = (typeof categories)[number];

export type Team = { logo?: string; name?: string };
export type StreamSource = { source?: string; id?: string };
export type Match = {
  title?: string;
  name?: string;
  category?: string;
  status?: string;
  time?: string;
  date?: string;
  startTime?: string;
  start_at?: string;
  timestamp?: string | number;
  teams?: Team[];
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
  return 'Upcoming';
}

export function timeOf(match: Match) {
  const value = match.date || match.startTime || match.start_at || match.timestamp;
  if (!value) return match.time || 'Time TBA';
  const date = new Date(value);
  if (Number.isNaN(date.getTime()) || date.getUTCFullYear() === 1970) return match.time || 'Time TBA';
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

export async function fetchMatches(category: Category, signal?: AbortSignal): Promise<Match[]> {
  const response = await fetch(`${upstream}/api/matches/${category}`, {
    headers: { accept: 'application/json' },
    signal,
  });
  if (!response.ok) throw new Error(`Fixture provider returned ${response.status}`);
  const data: unknown = await response.json();
  return Array.isArray(data) ? data as Match[] : [];
}

export async function fetchStream(source: string, id: string) {
  const response = await fetch(`${upstream}/api/stream/${encodeURIComponent(source)}/${encodeURIComponent(id)}`, {
    headers: { accept: 'application/json' },
  });
  if (!response.ok) throw new Error(`Stream provider returned ${response.status}`);
  return response.json();
}