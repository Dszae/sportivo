import { slugify, type Match } from './sportivo';

// Browser-side StreamFree access. StreamFree's API is unreachable from Cloudflare (where our server
// runs) but allows browsers (CORS *), so the match list, single-match lookup and playable sources
// are fetched from here. The server adapter (providers/adapters/strmfree.ts) stays as the fallback.
//   GET /streams?category=x   -> { count, streams: [{ stream_key, name, iframe, additional_sources, ... }] }
//   GET /sources/{stream_key} -> { stream_key, sources: [{ quality, url, live }] }  (404 = not a real stream)
const API = 'https://streamfree.top/api/v1';
const EMBED_ORIGIN = 'https://strmfree.st';
const LIST_TTL_MS = 2 * 60 * 1000;
const TIMEOUT_MS = 5000;

/** Our category names -> StreamFree category names. */
export const STREAMFREE_CATEGORY: Record<string, string> = {
  football: 'soccer',
  cricket: 'cricket',
  basketball: 'basketball',
};

const HD_QUALITIES = new Set(['HD', 'FHD', '4K']);

/**
 * Playback ids are a bare stream key ("ghana-vs-england", assumed soccer) or "category:key"
 * ("basketball:new-york-knicks-vs-toronto-raptors"). strmfree.st 404s an embed under the wrong
 * category path, so the category has to travel with the key.
 */
export function parseStrmfreeId(id: string): { key: string; apiCategory?: string } {
  const m = /^([a-z]+):(.+)$/.exec(id);
  if (m && Object.values(STREAMFREE_CATEGORY).includes(m[1])) return { apiCategory: m[1], key: m[2] };
  return { key: id };
}

export function strmfreeIdFor(category: string, streamKey: string): string {
  const apiCategory = STREAMFREE_CATEGORY[category];
  return apiCategory && apiCategory !== 'soccer' ? `${apiCategory}:${streamKey}` : streamKey;
}

export interface StreamFreeSource {
  quality?: string;
  url?: string;
  live?: boolean;
}

export interface StreamFreePlayable {
  embedUrl: string;
  hd: boolean;
  language: string;
  isNativeVideo: false;
  /** StreamFree's docs ask for these iframes not to be sandboxed. */
  isSandboxedIframe: false;
}

/** A stream's main embed, the same URL as the list's `iframe` field: /embed/{category}/{key}1080p. */
function mainEmbedUrl(key: string, apiCategory = 'soccer'): string {
  return `${EMBED_ORIGIN}/embed/${encodeURIComponent(apiCategory)}/${encodeURIComponent(key)}1080p`;
}

function embedUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  try {
    const u = new URL(value);
    return u.origin === EMBED_ORIGIN && u.pathname.startsWith('/embed/') ? u.toString() : null;
  } catch {
    return null;
  }
}

/** Main source first (always kept: it starts on its own once live), extra sources only if not reported offline. */
export function toPlayableStreams(sources: StreamFreeSource[]): StreamFreePlayable[] {
  const out: StreamFreePlayable[] = [];
  const seen = new Set<string>();
  sources.forEach((s, idx) => {
    if (idx > 0 && s.live === false) return;
    const url = embedUrl(s.url);
    if (!url || seen.has(url)) return;
    seen.add(url);
    const quality = typeof s.quality === 'string' ? s.quality.toUpperCase() : '';
    out.push({
      embedUrl: url,
      hd: quality ? HD_QUALITIES.has(quality) : true,
      language: `Server DSZ${out.length + 1}${quality ? ` · ${quality}` : ''}`,
      isNativeVideo: false,
      isSandboxedIframe: false,
    });
  });
  return out;
}

export type SourcesResult =
  | { status: 'ok'; streams: StreamFreePlayable[] }
  /** The key is not a real stream (404) or has nothing playable. */
  | { status: 'missing' }
  /** The API could not be reached; callers fall back to our server. */
  | { status: 'error' };

export async function fetchStreamFreeSources(id: string): Promise<SourcesResult> {
  const { key, apiCategory } = parseStrmfreeId(id);
  try {
    const res = await fetch(`${API}/sources/${encodeURIComponent(key)}`, {
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (res.status === 404) return { status: 'missing' };
    if (!res.ok) return { status: 'error' };
    const body = await res.json();
    const listed: StreamFreeSource[] = Array.isArray(body?.sources) ? body.sources : [];
    // Unlike the docs' example, a real stream that isn't live yet comes back as 200 with an empty list
    // (a key with no stream is a 404). Its main embed already exists and starts on its own once the
    // stream goes live, so offer that.
    const sources = listed.length > 0 ? listed : [{ url: mainEmbedUrl(key, apiCategory) }];
    const streams = toPlayableStreams(sources);
    return streams.length > 0 ? { status: 'ok', streams } : { status: 'missing' };
  } catch {
    return { status: 'error' };
  }
}

interface StreamFreeStream {
  name?: string;
  league?: string;
  stream_key?: string;
  match_timestamp?: number;
  thumbnail_url?: string;
  additional_sources?: StreamFreeSource[];
  team1?: { name?: string; logo?: string };
  team2?: { name?: string; logo?: string };
}

const httpsOrUndefined = (v: unknown) => (typeof v === 'string' && v.startsWith('https://') ? v : undefined);

/** Head-to-head fixtures only (24/7 channels like "Willow" are skipped), and nothing long finished. */
export function streamToMatch(item: StreamFreeStream, category: string, nowSec = Math.floor(Date.now() / 1000)): Match | null {
  const title = typeof item.name === 'string' ? item.name.trim() : '';
  const key = typeof item.stream_key === 'string' ? item.stream_key : '';
  if (!title || !key || !/\s+vs\.?\s+/i.test(title)) return null;

  const start = typeof item.match_timestamp === 'number' ? item.match_timestamp : 0;
  const anyLive = Array.isArray(item.additional_sources) && item.additional_sources.some((s) => s?.live === true);
  const inWindow = start > 0 && nowSec >= start - 600 && nowSec <= start + 12600;
  const isPast = start > 0 && nowSec > start + 12600;
  if (isPast && !anyLive) return null;

  const home = item.team1?.name ? { name: item.team1.name, badge: httpsOrUndefined(item.team1.logo) } : undefined;
  const away = item.team2?.name ? { name: item.team2.name, badge: httpsOrUndefined(item.team2.logo) } : undefined;

  return {
    id: key,
    title,
    category,
    competition: item.league || undefined,
    league: item.league || undefined,
    status: anyLive || inWindow ? 'Live' : 'Upcoming',
    date: start > 0 ? start * 1000 : undefined,
    poster: httpsOrUndefined(item.thumbnail_url),
    teams: home && away ? { home, away } : undefined,
    sources: [{ source: 'strmfree', id: strmfreeIdFor(category, key), label: 'StreamFree' }],
  };
}

export interface StreamFreeList {
  /** False when the list could not be fetched (and nothing was cached): `keys` then says nothing. */
  ok: boolean;
  matches: Match[];
  /** Every stream key StreamFree has in this category, including channels and finished streams. */
  keys: Set<string>;
}

const EMPTY_LIST: StreamFreeList = { ok: false, matches: [], keys: new Set() };
const listCache = new Map<string, { at: number; data: StreamFreeList }>();
const inflight = new Map<string, Promise<StreamFreeList>>();

/** StreamFree's list for one of our categories. Never throws; returns the last good list (or `ok: false`) on failure. */
export function fetchStreamFreeList(category: string): Promise<StreamFreeList> {
  const apiCategory = STREAMFREE_CATEGORY[category];
  if (!apiCategory) return Promise.resolve(EMPTY_LIST);
  const cached = listCache.get(category);
  if (cached && Date.now() - cached.at < LIST_TTL_MS) return Promise.resolve(cached.data);
  const pending = inflight.get(category);
  if (pending) return pending;

  const request = (async () => {
    try {
      const res = await fetch(`${API}/streams?category=${encodeURIComponent(apiCategory)}`, {
        headers: { accept: 'application/json' },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (!res.ok) return cached?.data ?? EMPTY_LIST;
      const body = await res.json();
      if (!Array.isArray(body?.streams)) return cached?.data ?? EMPTY_LIST;
      const items: StreamFreeStream[] = body.streams;
      const data: StreamFreeList = {
        ok: true,
        matches: items.map((s) => streamToMatch(s, category)).filter((m): m is Match => m !== null),
        keys: new Set(items.map((s) => s.stream_key).filter((k): k is string => typeof k === 'string' && k !== '')),
      };
      listCache.set(category, { at: Date.now(), data });
      return data;
    } catch {
      return cached?.data ?? EMPTY_LIST;
    } finally {
      inflight.delete(category);
    }
  })();
  inflight.set(category, request);
  return request;
}

/** StreamFree's fixtures for one of our categories. Never throws; returns [] (or the last good list) on failure. */
export function fetchStreamFreeMatches(category: string): Promise<Match[]> {
  return fetchStreamFreeList(category).then((list) => list.matches);
}

const NO_STREAM_LEAD_MS = 30 * 60 * 1000;

/**
 * Flags matches that are live (or start within 30 minutes) but have no stream: every source is a
 * StreamFree key and StreamFree has none of them. Matches further out are left alone, since
 * StreamFree may still create their stream. Matches with any other provider are never flagged.
 */
export function markStreamless(matches: Match[], streamFreeKeys: Set<string>, now = Date.now()): Match[] {
  return matches.map((m) => {
    const sources = m.sources || [];
    const onlyStreamFree = sources.length > 0 && sources.every((s) => s.source === 'strmfree' && s.id);
    if (!onlyStreamFree) return m.noStream ? { ...m, noStream: false } : m;

    const start = typeof m.date === 'number' ? m.date : new Date(m.date || m.startTime || m.start_at || 0).getTime();
    const isLive = String(m.status || '').toLowerCase() === 'live';
    const soon = Number.isFinite(start) && start > 0 && start - now <= NO_STREAM_LEAD_MS;
    const hasStream = sources.some((s) => streamFreeKeys.has(parseStrmfreeId(s.id!).key));
    const noStream = (isLive || soon) && !hasStream;
    return noStream === Boolean(m.noStream) ? m : { ...m, noStream };
  });
}

/** Finds a StreamFree fixture by the slug our match links use (slugified title) or by its stream key. */
export async function findStreamFreeMatch(category: string, slug: string): Promise<Match | null> {
  const list = await fetchStreamFreeMatches(category);
  return list.find((m) => m.id === slug || slugify(m.title || '') === slug) ?? null;
}

const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');

function teamPair(title: string): string | null {
  const parts = title.split(/\s+(?:vs\.?|v|at|@)\s+/i);
  if (parts.length !== 2) return null;
  return [norm(parts[0]), norm(parts[1])].sort().join('|');
}

/**
 * Adds StreamFree fixtures to our server's list. A fixture already listed (same StreamFree key in its
 * sources, same slug, or same two teams in either order) is not duplicated: it gets StreamFree's real
 * key moved to the front of its sources and StreamFree's live status. Inputs are not mutated.
 */
export function mergeStreamFreeMatches(serverMatches: Match[], sfMatches: Match[]): Match[] {
  const merged = serverMatches.map((m) => ({ ...m, sources: [...(m.sources || [])] }));

  for (const sf of sfMatches) {
    const sfSource = sf.sources?.[0];
    const sfKey = sfSource?.id ? parseStrmfreeId(sfSource.id).key : sf.id;
    const sfSlug = slugify(sf.title || '');
    const sfPair = teamPair(sf.title || '');

    const existing = merged.find((m) => {
      if (m.sources.some((s) => s.source === 'strmfree' && s.id && parseStrmfreeId(s.id).key === sfKey)) return true;
      if (slugify(m.title || m.name || '') === sfSlug) return true;
      return sfPair !== null && teamPair(m.title || m.name || '') === sfPair;
    });

    if (!existing) {
      merged.push(sf);
      continue;
    }

    if (sfSource?.id) {
      const rest = existing.sources.filter((s) => !(s.source === 'strmfree' && s.id === sfSource.id));
      existing.sources = [{ ...sfSource }, ...rest];
    }
    if (sf.status === 'Live' && String(existing.status || '').toLowerCase() !== 'final') existing.status = 'Live';
  }

  return merged;
}
