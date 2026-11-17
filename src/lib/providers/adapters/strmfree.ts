import type { Category, NormalizedMatch, PlaybackResolution, PlaybackStream, ProviderAdapter } from '../types';
import { sanitizePlaybackUrl } from '../allowlist';
import { logDiagnostic } from '../diagnostics';

// Documented public API (no key). The docs ask for caching on our side and no polling per page load.
//   GET /streams?category=x   -> { count, streams: [{ stream_key, iframe, additional_sources, ... }] }
//   GET /sources/{stream_key} -> { stream_key, sources: [{ quality, url, live }] }  (404 = not a real stream)
const API = 'https://streamfree.top/api/v1';
const EMBED_HOST = 'https://strmfree.st/embed';
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

const HD_QUALITIES = new Set(['HD', 'FHD', '4K']);

interface StreamFreeSource {
  quality?: string;
  url?: string;
  live?: boolean;
}

interface StreamFreeStream {
  name?: string;
  category?: string;
  league?: string;
  stream_key?: string;
  match_timestamp?: number;
  thumbnail_url?: string;
  /** Main embed URL; exists from the moment the stream is created and starts playing on its own once live. */
  iframe?: string;
  additional_sources?: StreamFreeSource[];
}

const listCache = new Map<string, { data: StreamFreeStream[]; at: number }>();
/** stream_key -> list entry, filled by every successful list fetch. */
const streamByKey = new Map<string, StreamFreeStream>();
/** stream_key -> sources (null = 404, the key is not a real stream). */
const sourcesCache = new Map<string, { data: StreamFreeSource[] | null; at: number }>();
const lastFailure = new Map<string, number>();

function inBackoff(key: string): boolean {
  const at = lastFailure.get(key);
  return at !== undefined && Date.now() - at < FAILURE_BACKOFF_MS;
}

type JsonResult = { ok: true; body: any } | { ok: false; status: number | 'error' };

async function getJson(url: string, key: string): Promise<JsonResult> {
  const started = Date.now();
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT, accept: 'application/json' },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) {
      logDiagnostic({ provider: 'strmfree', operation: `api:${key}`, durationMs: Date.now() - started, status: res.status });
      return { ok: false, status: res.status };
    }
    return { ok: true, body: await res.json() };
  } catch (err: any) {
    logDiagnostic({ provider: 'strmfree', operation: `api:${key}`, durationMs: Date.now() - started, status: 'error', error: err?.message });
    return { ok: false, status: 'error' };
  }
}

async function fetchStreamList(apiCategory: string): Promise<StreamFreeStream[]> {
  const cached = listCache.get(apiCategory);
  if (cached && Date.now() - cached.at < LIST_TTL_MS) return cached.data;
  if (inBackoff(`list:${apiCategory}`)) return cached?.data ?? [];

  const res = await getJson(`${API}/streams?category=${encodeURIComponent(apiCategory)}`, `list:${apiCategory}`);
  if (!res.ok || !Array.isArray(res.body?.streams)) {
    lastFailure.set(`list:${apiCategory}`, Date.now());
    return cached?.data ?? [];
  }

  const data = res.body.streams as StreamFreeStream[];
  listCache.set(apiCategory, { data, at: Date.now() });
  for (const s of data) {
    if (typeof s.stream_key === 'string' && s.stream_key) streamByKey.set(s.stream_key, s);
  }
  return data;
}

/**
 * Source list for a key. Returns null when the key is not a real stream (404),
 * undefined when the API could not be reached (caller falls back to the URL pattern).
 */
async function fetchSources(streamKey: string): Promise<StreamFreeSource[] | null | undefined> {
  const cached = sourcesCache.get(streamKey);
  if (cached && Date.now() - cached.at < SOURCES_TTL_MS) return cached.data;
  // One backoff for the whole endpoint: when it is blocked (e.g. from Cloudflare) every key fails the same way.
  if (inBackoff('sources')) return cached?.data;

  const res = await getJson(`${API}/sources/${encodeURIComponent(streamKey)}`, 'sources');
  if (!res.ok) {
    if (res.status === 404) {
      sourcesCache.set(streamKey, { data: null, at: Date.now() });
      return null;
    }
    lastFailure.set('sources', Date.now());
    return cached?.data;
  }
  const data = Array.isArray(res.body?.sources) ? (res.body.sources as StreamFreeSource[]) : [];
  sourcesCache.set(streamKey, { data, at: Date.now() });
  return data;
}

/** Main source first (always kept: it starts on its own once live), extra sources only if not reported offline. */
function toPlaybackStreams(sources: StreamFreeSource[]): PlaybackStream[] {
  const streams: PlaybackStream[] = [];
  const seen = new Set<string>();
  sources.forEach((s, idx) => {
    if (idx > 0 && s.live === false) return;
    const url = typeof s.url === 'string' ? sanitizePlaybackUrl(s.url) : null;
    if (!url || seen.has(url)) return;
    seen.add(url);
    const quality = typeof s.quality === 'string' ? s.quality.toUpperCase() : '';
    streams.push({
      embedUrl: url,
      hd: quality ? HD_QUALITIES.has(quality) : true,
      language: `Server DSZ${streams.length + 1}${quality ? ` · ${quality}` : ''}`,
      // Don't sandbox these iframes (StreamFree's docs ask for that).
      isSandboxedIframe: false,
    });
  });
  return streams;
}

function sourcesFromListEntry(item: StreamFreeStream): StreamFreeSource[] {
  const extra = Array.isArray(item.additional_sources) ? item.additional_sources : [];
  return typeof item.iframe === 'string' ? [{ url: item.iframe }, ...extra] : extra;
}

/** Last resort when the API is unreachable: per the docs the main embed ends in "1080p", extras add a number. */
function guessedSources(streamKey: string, apiCategory: string): StreamFreeSource[] {
  return [`${streamKey}1080p`, `${streamKey}1080p2`, `${streamKey}1080p3`].map((path) => ({
    url: `${EMBED_HOST}/${encodeURIComponent(apiCategory)}/${encodeURIComponent(path)}`,
  }));
}

/**
 * Playback ids are a bare stream key ("ghana-vs-england", assumed soccer) or "category:key"
 * ("basketball:new-york-knicks-vs-toronto-raptors"). The category matters for the fallback URL:
 * strmfree.st 404s an embed under the wrong category path.
 */
function parsePlaybackId(id: string): { key: string; apiCategory?: string } {
  const m = /^([a-z]+):(.+)$/.exec(id);
  if (m && Object.values(API_CATEGORY).includes(m[1])) return { apiCategory: m[1], key: m[2] };
  return { key: id };
}

export function strmfreePlaybackId(category: Category, streamKey: string): string {
  const apiCategory = API_CATEGORY[category];
  return apiCategory && apiCategory !== 'soccer' ? `${apiCategory}:${streamKey}` : streamKey;
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

      // The main iframe has no live flag; additional sources do.
      const anyLive = Array.isArray(item.additional_sources) && item.additional_sources.some((s) => s.live === true);
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
    // 1. Stream already seen in a list fetch: its iframe + additional_sources are authoritative.
    // 2. Otherwise ask /sources/{key}; a 404 means the key is not a real stream (e.g. a wrong home/away guess).
    // 3. API unreachable: fall back to the documented URL pattern.
    const { key, apiCategory } = parsePlaybackId(id);
    const listed = streamByKey.get(key);
    let sources: StreamFreeSource[] | null | undefined = listed ? sourcesFromListEntry(listed) : undefined;

    if (!sources || sources.length === 0) {
      const fetched = await fetchSources(key);
      if (fetched === null) {
        return {
          status: 'unavailable',
          streams: [],
          error: 'No StreamFree broadcast exists for this match.',
          provider: this.name,
        };
      }
      sources = fetched && fetched.length > 0 ? fetched : guessedSources(key, listed?.category || apiCategory || 'soccer');
    }

    const streams = toPlaybackStreams(sources);
    if (streams.length > 0) {
      return { status: 'ready', streams, provider: this.name };
    }

    return {
      status: 'unavailable',
      streams: [],
      error: 'Broadcast feed is currently offline or waiting for pre-match signal.',
      provider: this.name,
    };
  }
}
