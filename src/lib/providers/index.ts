import type { Category, NormalizedMatch, PlaybackResolution, ProviderAdapter } from './types';
import { StrmFreeAdapter } from './adapters/strmfree';
import { EspnAdapter } from './adapters/espn';
import { TimstAdapter } from './adapters/timst';
import { PpvAdapter } from './adapters/ppv';
import { DaddyLiveAdapter } from './adapters/daddylive';
import { DemoAdapter } from './adapters/demo';
import { nplAdapter } from './adapters/npl';
import { sanitizeIdentifier } from './allowlist';
import { logDiagnostic } from './diagnostics';
import { edgeGet, edgePut, keepAlive, withTimeout } from '../edgeCache';

export * from './types';
export * from './allowlist';
export * from './diagnostics';

const adapters: Record<string, ProviderAdapter> = {
  npl: nplAdapter,
  ppv: new PpvAdapter(),
  strmfree: new StrmFreeAdapter(),
  espn: new EspnAdapter(),
  timst: new TimstAdapter(),
  daddylive: new DaddyLiveAdapter(),
  daddy: new DaddyLiveAdapter(), // Alias
  demo: new DemoAdapter(),
};

export function getProvider(sourceName: string): ProviderAdapter | null {
  const normalized = sourceName.toLowerCase();
  return adapters[normalized] || null;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Fetches and merges matches across active providers with bounded timeouts.
 * Prioritizes live streams, followed by chronological upcoming fixtures.
 */
// Two-level cache, served stale-while-revalidate:
//  1. per-isolate memory (instant, but lost whenever Cloudflare starts a new isolate)
//  2. colo-wide Cache API shared by all isolates (a few ms)
// Pages never wait on upstream providers unless both levels are empty.
type CacheEntry = { data: NormalizedMatch[]; at: number; freshFor: number };
const memoryCache: Partial<Record<Category, CacheEntry>> = {};
const inflight: Partial<Record<Category, Promise<NormalizedMatch[]>>> = {};

const FRESH_MS = 60 * 1000;
/** Freshness when a provider missed its deadline, so its late data is picked up soon. */
const DEGRADED_FRESH_MS = 10 * 1000;
/** Stale data older than this is not served; the request waits for a refresh instead. */
const STALE_MAX_MS = 15 * 60 * 1000;
/**
 * How long a page waits for any single provider. Upstreams blocked from Cloudflare
 * (PPV, StreamFree) otherwise hold every cold page load for their full timeout.
 * Slow providers keep running in the background and fill their own caches.
 */
const PROVIDER_DEADLINE_MS = 2500;

async function readCache(category: Category): Promise<CacheEntry | null> {
  const mem = memoryCache[category];
  if (mem && Date.now() - mem.at < mem.freshFor) return mem;
  const edge = await edgeGet<CacheEntry>(`matches/${category}`);
  if (edge && Array.isArray(edge.data) && (!mem || edge.at > mem.at)) {
    memoryCache[category] = edge;
    return edge;
  }
  return mem ?? null;
}

function refreshMatches(category: Category): Promise<NormalizedMatch[]> {
  let pending = inflight[category];
  if (!pending) {
    pending = collectMatches(category)
      .then(async ({ data, degraded }) => {
        const entry: CacheEntry = { data, at: Date.now(), freshFor: degraded ? DEGRADED_FRESH_MS : FRESH_MS };
        memoryCache[category] = entry;
        await edgePut(`matches/${category}`, entry, STALE_MAX_MS / 1000);
        return data;
      })
      .finally(() => {
        delete inflight[category];
      });
    inflight[category] = pending;
  }
  // Every request that triggers or joins the refresh keeps it alive past its own response.
  keepAlive(pending);
  return pending;
}

export async function fetchUnifiedMatches(category: Category, signal?: AbortSignal): Promise<NormalizedMatch[]> {
  const entry = await readCache(category);
  if (entry) {
    const age = Date.now() - entry.at;
    if (age < entry.freshFor) return entry.data;
    if (age < STALE_MAX_MS) {
      refreshMatches(category).catch(() => {});
      return entry.data;
    }
  }
  const pending = refreshMatches(category);
  if (!signal) return pending;
  if (signal.aborted) return entry?.data ?? [];
  return new Promise<NormalizedMatch[]>((resolve) => {
    signal.addEventListener('abort', () => resolve(entry?.data ?? []), { once: true });
    pending.then(resolve, () => resolve(entry?.data ?? []));
  });
}

async function collectMatches(category: Category): Promise<{ data: NormalizedMatch[]; degraded: boolean }> {
  // Hard budget for provider requests. Callers stop waiting after PROVIDER_DEADLINE_MS,
  // but requests may run until this to fill provider-level caches in the background.
  const effectiveSignal = AbortSignal.timeout(8000);
  let degraded = false;
  const deadline = <T,>(promise: Promise<T>, fallback: T) =>
    withTimeout(promise, PROVIDER_DEADLINE_MS, fallback, () => {
      degraded = true;
    });

  const ppv = adapters.ppv;
  const strmfree = adapters.strmfree;
  const espn = adapters.espn;
  const npl = adapters.npl;
  // Ingest PPV, NPL, StrmFree, and ESPN
  const promises: Promise<any>[] = [
    // PPV is not used for football (its upstream blocks Cloudflare; StreamFree covers football)
    category === 'football' ? Promise.resolve([]) : deadline(ppv.fetchMatches(category, effectiveSignal), []),
    // DaddyLive channels are not listed: their players refuse our domain ("Not allowed to stream.
    // Contact admin." on dembed.st, a blank page on thedaddy.pk). Re-enable once they allow the site.
    Promise.resolve([]),
    deadline(strmfree.fetchMatches(category, effectiveSignal), []),
    deadline(espn.fetchMatches(category, effectiveSignal), []),
  ];
  if (category === 'cricket') {
    promises.push(deadline(npl.fetchMatches(category, effectiveSignal), []));
  }

  const [ppvResults, daddyResults, strmfreeResults, espnResults, nplResults] = await Promise.allSettled(promises);

  const matches: NormalizedMatch[] = [];
  const seenSlugs = new Set<string>();

  function isMatchWise(item: NormalizedMatch): boolean {
    const title = (item.title || '').trim();
    if (!title) return false;

    if (category === 'cricket') {
      // For cricket, allow verified live broadcast channels or competitive matches
      const isVerifiedCricketFeed = /willow|fox cricket|sky sports cricket/i.test(title);
      const isCricketMatch = /\s+vs\.?\s+|\s+v\s+|\s+at\s+/i.test(title);
      return isVerifiedCricketFeed || isCricketMatch;
    }

    // Exclude general 24/7 TV channels from football and basketball grids
    if (/^(beIN|Sky Sports|TNT Sports|ESPN|Fox Sports|SuperSport|Sony Sports|EuroSport|Match TV|DAZN|Premier Sports)/i.test(title)) {
      if (!/\s+vs\.?\s+|\s+v\s+|\s+at\s+/i.test(title)) {
        return false;
      }
    }

    if (item.teams && typeof item.teams === 'object' && item.teams.home && item.teams.away) {
      return true;
    }

    // Must be a head-to-head fixture ("Team A vs Team B" or "Team A at Team B")
    if (/\s+vs\.?\s+/i.test(title) || /\s+v\s+/i.test(title) || /\s+at\s+/i.test(title)) {
      return true;
    }
    return false;
  }

  function ingest(items: NormalizedMatch[]) {
    const now = Date.now();
    for (const item of items) {
      // Strictly only ingest head-to-head matches ("this vs this team")
      if (!isMatchWise(item)) continue;

      // Drop completed/past results per user requirement
      if (item.status === 'Final') continue;
      if (typeof item.date === 'number' && item.date > 0 && now - item.date > 3.5 * 60 * 60 * 1000) {
        continue;
      }

      const slug = slugify(item.title);
      if (!slug) continue;

      const existing = matches.find((m) => slugify(m.title) === slug);
      if (existing) {
        // Merge sources so users get PPV + StrmFree fallback options
        for (const s of item.sources || []) {
          if (!existing.sources.some((es) => es.id === s.id && es.source === s.source)) {
            existing.sources.push(s);
          }
        }
        if (!existing.poster && item.poster) existing.poster = item.poster;

        // Merge team info and badges
        if (item.teams) {
          if (!existing.teams) {
            existing.teams = item.teams;
          } else {
            if (!existing.teams.home?.badge && item.teams.home?.badge) {
              existing.teams.home = { ...existing.teams.home, badge: item.teams.home.badge };
            }
            if (!existing.teams.away?.badge && item.teams.away?.badge) {
              existing.teams.away = { ...existing.teams.away, badge: item.teams.away.badge };
            }
          }
        }
        continue;
      }

      seenSlugs.add(slug);
      matches.push(item);
    }
  }

  // 1. Ingest NPL (top priority for cricket fixtures in Nepal)
  if (category === 'cricket' && nplResults && nplResults.status === 'fulfilled') {
    ingest(nplResults.value);
  }

  // 2. Ingest DaddyLive (verified high-availability 24/7 sports networks)
  if (daddyResults && daddyResults.status === 'fulfilled') {
    ingest(daddyResults.value);
  }

  // 3. Ingest PPV (primary official stream provider: verified matches, 16:9 posters, and clean embeds)
  if (ppvResults.status === 'fulfilled') {
    ingest(ppvResults.value);
  }

  // 2. Ingest StrmFree (adds multi-server streams and club badges)
  if (strmfreeResults.status === 'fulfilled') {
    ingest(strmfreeResults.value);
  }

  // 3. Ingest ESPN (strictly enriches existing streamable fixtures with verified crests & metadata)
  if (espnResults.status === 'fulfilled') {
    for (const espnMatch of espnResults.value) {
      if (espnMatch.status === 'Final') continue;
      const slug = slugify(espnMatch.title);
      const existing = matches.find((m) => {
        const mSlug = slugify(m.title);
        if (mSlug === slug) return true;
        if (espnMatch.teams?.home?.name && espnMatch.teams?.away?.name && m.teams?.home?.name && m.teams?.away?.name) {
          const h1 = espnMatch.teams.home.name.toLowerCase();
          const a1 = espnMatch.teams.away.name.toLowerCase();
          const h2 = m.teams.home.name.toLowerCase();
          const a2 = m.teams.away.name.toLowerCase();
          if ((h1.includes(h2) || h2.includes(h1)) && (a1.includes(a2) || a2.includes(a1))) {
            return true;
          }
        }
        return false;
      });

      if (existing) {
        if (!existing.poster && espnMatch.poster) existing.poster = espnMatch.poster;
        if (espnMatch.teams) {
          if (!existing.teams) {
            existing.teams = espnMatch.teams;
          } else {
            if (!existing.teams.home?.badge && espnMatch.teams.home?.badge) {
              existing.teams.home = { ...existing.teams.home, badge: espnMatch.teams.home.badge };
            }
            if (!existing.teams.away?.badge && espnMatch.teams.away?.badge) {
              existing.teams.away = { ...existing.teams.away, badge: espnMatch.teams.away.badge };
            }
          }
        }
        if (espnMatch.competition && (!existing.competition || existing.competition === existing.category)) {
          existing.competition = espnMatch.competition;
        }
      } else if (espnMatch.status === 'Live' || category === 'football' || category === 'basketball') {
        // Football and basketball fixtures are ESPN's upcoming and live schedule: StreamFree's own list is
        // unreachable from Cloudflare, so ESPN is the only list that works in production.
        // Ingest verified live matches happening right now so live dashboards never report false "no match" states
        seenSlugs.add(slug);
        matches.push(espnMatch);
      }
    }
  }

  // Filter out any past/completed fixtures
  const activeMatches = matches.filter((m) => {
    if (m.status === 'Final') return false;
    if (typeof m.date === 'number' && m.date > 0 && Date.now() - m.date > 3.5 * 60 * 60 * 1000) {
      return false;
    }
    return true;
  });

  // Sort: Live matches first, then upcoming by start time
  const sorted = activeMatches.sort((a, b) => {
    const aLive = a.status === 'Live' ? 1 : 0;
    const bLive = b.status === 'Live' ? 1 : 0;
    if (aLive !== bLive) return bLive - aLive;

    const aTime = a.date || 0;
    const bTime = b.date || 0;
    if (aTime === 0 && bTime > 0) return 1;
    if (bTime === 0 && aTime > 0) return -1;
    return aTime - bTime;
  });
  return { data: sorted, degraded };
}

/**
 * Resolves verified playback streams for a given source and match ID.
 * Enforces identifier sanitization and domain allowlists.
 */
export async function resolveUnifiedPlayback(
  source: string,
  id: string,
  signal?: AbortSignal
): Promise<PlaybackResolution> {
  const safeSource = sanitizeIdentifier(source);
  const safeId = sanitizeIdentifier(id);

  if (!safeSource || !safeId) {
    logDiagnostic({
      provider: source || 'unknown',
      operation: 'resolveUnifiedPlayback:invalid_params',
      durationMs: 0,
      status: 400,
      error: 'Invalid source or id format',
    });
    return {
      status: 'unsupported',
      streams: [],
      error: 'Invalid stream request parameters.',
      provider: source || 'unknown',
    };
  }

  const provider = getProvider(safeSource);
  if (!provider) {
    return {
      status: 'unsupported',
      streams: [],
      error: `Unsupported stream provider: ${safeSource}`,
      provider: safeSource,
    };
  }

  return provider.resolvePlayback(safeId, signal);
}

