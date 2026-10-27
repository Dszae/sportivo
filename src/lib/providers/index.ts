import type { Category, NormalizedMatch, PlaybackResolution, ProviderAdapter } from './types';
import { StrmFreeAdapter } from './adapters/strmfree';
import { EspnAdapter } from './adapters/espn';
import { TimstAdapter } from './adapters/timst';
import { DaddyLiveAdapter } from './adapters/daddylive';
import { DemoAdapter } from './adapters/demo';
import { sanitizeIdentifier } from './allowlist';
import { logDiagnostic } from './diagnostics';

export * from './types';
export * from './allowlist';
export * from './diagnostics';

const adapters: Record<string, ProviderAdapter> = {
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

  const strmfree = adapters.strmfree;
  const espn = adapters.espn;
  const timst = adapters.timst;

  const [strmfreeResults, espnResults, timstResults] = await Promise.allSettled([
    strmfree.fetchMatches(category, effectiveSignal),
    espn.fetchMatches(category, effectiveSignal),
    timst.fetchMatches(category, effectiveSignal),
  ]);

  const matches: NormalizedMatch[] = [];
  const seenSlugs = new Set<string>();

  function ingest(items: NormalizedMatch[]) {
    for (const item of items) {
      const slug = slugify(item.title);
      if (!slug || seenSlugs.has(slug)) continue;
      seenSlugs.add(slug);
      matches.push(item);
    }
  }

  // 1. Ingest StrmFree (primary for live multi-server streams)
  if (strmfreeResults.status === 'fulfilled') {
    ingest(strmfreeResults.value);
  }

  // 2. Ingest ESPN (official scoreboards & team crests)
  if (espnResults.status === 'fulfilled') {
    ingest(espnResults.value);
  }

  // 3. Ingest 24/7 channels
  if (timstResults.status === 'fulfilled') {
    ingest(timstResults.value);
  }

  // Sort: Live matches first, then upcoming by start time
  return matches.sort((a, b) => {
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

