import type { Category, NormalizedMatch, PlaybackResolution, ProviderAdapter } from '../types';
import { sanitizePlaybackUrl } from '../allowlist';
import { logDiagnostic } from '../diagnostics';

// Documented public API (no key). The docs ask for caching on our side and no polling per page load.
const API = 'https://streamfree.top/api/v1';
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Sportivo/2.0';
const LIST_TTL_MS = 2 * 60 * 1000;
const SOURCES_TTL_MS = 60 * 1000;
const FAILURE_BACKOFF_MS = 5 * 60 * 1000;

// Our category names -> StreamFree category names
const API_CATEGORY: Record<string, string> = {
  football: 'soccer',
  cricket: 'cricket',
  basketball: 'basketball',
};

interface StreamFreeSource {
  quality?: string;
  url?: string;
  live?: boolean;
  broadcast?: string | null;
}

interface StreamFreeStream {
  name?: string;
  category?: string;
  league?: string;
  stream_key?: string;
  match_timestamp?: number;
  sources?: StreamFreeSource[];
  thumbnail_url?: string;
}

const listCache = new Map<string, { data: StreamFreeStream[]; at: number }>();
const sourcesCache = new Map<string, { data: StreamFreeSource[]; at: number }>();
const lastFailure = new Map<string, number>();

function inBackoff(key: string): boolean {
  const at = lastFailure.get(key);
  return at !== undefined && Date.now() - at < FAILURE_BACKOFF_MS;
}

async function getJson(url: string, key: string): Promise<any | null> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT, accept: 'application/json' },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) {
      logDiagnostic({ provider: 'strmfree', operation: `api:${key}`, durationMs: 0, status: res.status });
      return null;
    }
    return await res.json();
  } catch (err: any) {
    logDiagnostic({ provider: 'strmfree', operation: `api:${key}`, durationMs: 0, status: 'error', error: err?.message });
    return null;
  }
}

async function fetchStreamList(apiCategory: string): Promise<StreamFreeStream[]> {
  const cached = listCache.get(apiCategory);
  if (cached && Date.now() - cached.at < LIST_TTL_MS) return cached.data;
  if (inBackoff(`list:${apiCategory}`)) return cached?.data ?? [];

  const body = await getJson(`${API}/streams?category=${encodeURIComponent(apiCategory)}`, `list:${apiCategory}`);
  if (!body || !Array.isArray(body.streams)) {
    lastFailure.set(`list:${apiCategory}`, Date.now());
    return cached?.data ?? [];
  }

  const data = body.streams as StreamFreeStream[];
  listCache.set(apiCategory, { data, at: Date.now() });
  return data;
}

async function fetchSources(streamKey: string): Promise<StreamFreeSource[]> {
  const cached = sourcesCache.get(streamKey);
  if (cached && Date.now() - cached.at < SOURCES_TTL_MS) return cached.data;
  if (inBackoff(`sources:${streamKey}`)) return cached?.data ?? [];

  const body = await getJson(`${API}/sources/${encodeURIComponent(streamKey)}`, `sources:${streamKey}`);
  if (!body || !Array.isArray(body.sources)) {
    lastFailure.set(`sources:${streamKey}`, Date.now());
    return cached?.data ?? [];
  }

  const data = body.sources as StreamFreeSource[];
  sourcesCache.set(streamKey, { data, at: Date.now() });
  return data;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export class StrmFreeAdapter implements ProviderAdapter {
  readonly name = 'strmfree';
  readonly isAuthorized = false; // Third-party provider, unverified commercial SLA
  readonly statusClassification = 'partially-verified' as const;

  async fetchMatches(category: Category, _signal?: AbortSignal): Promise<NormalizedMatch[]> {
    const apiCategory = API_CATEGORY[category];
    if (!apiCategory) return [];

    const items = await fetchStreamList(apiCategory);
    const matches: NormalizedMatch[] = [];
    const seenSlugs = new Set<string>();
    const nowSec = Math.floor(Date.now() / 1000);

    for (const item of items) {
      let title = typeof item.name === 'string' ? item.name.trim() : '';
      const streamKey = typeof item.stream_key === 'string' ? item.stream_key : '';
      if (!title || !streamKey) continue;

      if (category === 'cricket' && !title.toLowerCase().includes('cricket') && !/\s+vs\.?\s+|\s+v\s+/i.test(title)) {
        title = `${title} Cricket Live`;
      }

      const slug = slugify(title);
      if (seenSlugs.has(slug)) continue;
      seenSlugs.add(slug);

      const startSec = typeof item.match_timestamp === 'number' ? item.match_timestamp : 0;
      const isLiveNow = startSec > 0 && nowSec >= startSec - 600 && nowSec <= startSec + 12600;
      const isPast = startSec > 0 && nowSec > startSec + 12600;
      const status = startSec === 0 ? 'Live' : isLiveNow ? 'Live' : isPast ? 'Final' : 'Upcoming';

      const anyLive = Array.isArray(item.sources) && item.sources.some((s) => s.live === true);
      const thumb = typeof item.thumbnail_url === 'string' && item.thumbnail_url.startsWith('https://') ? item.thumbnail_url : undefined;

      matches.push({
        id: streamKey,
        title,
        category,
        competition: item.league || undefined,
        league: item.league || undefined,
        status: anyLive && status !== 'Final' ? 'Live' : status,
        date: startSec > 0 ? startSec * 1000 : undefined,
        poster: thumb,
        sources: [{ source: 'strmfree', id: streamKey, label: 'StrmFree HD' }],
      });
    }

    return matches;
  }

  async resolvePlayback(id: string, _signal?: AbortSignal): Promise<PlaybackResolution> {
    const sources = await fetchSources(id);

    // Live sources first; the embed starts on its own once its source goes live.
    const ordered = [...sources].sort((a, b) => Number(b.live === true) - Number(a.live === true));
    const validatedStreams = ordered
      .map((s) => ({ url: typeof s.url === 'string' ? sanitizePlaybackUrl(s.url) : null, quality: s.quality || '' }))
      .filter((s): s is { url: string; quality: string } => Boolean(s.url))
      .map((s, idx) => ({
        embedUrl: s.url,
        hd: /1080|720|FHD|HD|4K/i.test(s.quality) || s.url.includes('1080p') || s.url.includes('720p'),
        language: `Server DSZ${idx + 1}`,
        isSandboxedIframe: true,
      }));

    if (validatedStreams.length > 0) {
      return { status: 'ready', streams: validatedStreams, provider: this.name };
    }

    return {
      status: 'unavailable',
      streams: [],
      error: 'Broadcast feed is currently offline or waiting for pre-match signal.',
      provider: this.name,
    };
  }
}
