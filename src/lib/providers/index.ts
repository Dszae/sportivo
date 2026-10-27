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
export async function fetchUnifiedMatches(category: Category, signal?: AbortSignal): Promise<NormalizedMatch[]> {
  const timeoutSignal = AbortSignal.timeout(4000);
  const effectiveSignal = signal ? AbortSignal.any([signal, timeoutSignal]) : timeoutSignal;

  const ppv = adapters.ppv;
  const strmfree = adapters.strmfree;
  const espn = adapters.espn;
  const npl = adapters.npl;

  // Ingest PPV, NPL, StrmFree, and ESPN
  const promises: Promise<any>[] = [
    ppv.fetchMatches(category, effectiveSignal),
    strmfree.fetchMatches(category, effectiveSignal),
    espn.fetchMatches(category, effectiveSignal),
  ];
  if (category === 'cricket') {
    promises.push(npl.fetchMatches(category, effectiveSignal));
  }

  const [ppvResults, strmfreeResults, espnResults, nplResults] = await Promise.allSettled(promises);

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

  // 2. Ingest PPV (primary official stream provider: verified matches, 16:9 posters, and clean embeds)
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
  return activeMatches.sort((a, b) => {
    const aLive = a.status === 'Live' ? 1 : 0;
    const bLive = b.status === 'Live' ? 1 : 0;
    if (aLive !== bLive) return bLive - aLive;

    const aTime = a.date || 0;
    const bTime = b.date || 0;
    if (aTime === 0 && bTime > 0) return 1;
    if (bTime === 0 && aTime > 0) return -1;
    return aTime - bTime;
  });
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

