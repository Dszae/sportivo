import type { Category, NormalizedMatch, PlaybackResolution, ProviderAdapter } from '../types';
import { sanitizePlaybackUrl } from '../allowlist';
import { logDiagnostic } from '../diagnostics';

const UPSTREAM = 'https://api.ppv.st/api/streams';
const BACKUP_PING = 'https://api.ppv.st/api/ping';

interface PpvStreamItem {
  id: number;
  name: string;
  tag?: string;
  source_tag?: string;
  poster?: string;
  uri_name?: string;
  starts_at?: number;
  ends_at?: number;
  always_live?: number;
  locale?: string;
  category_name?: string;
  iframe?: string;
  substreams?: any[];
  viewers?: string | number;
}

interface PpvCategoryItem {
  category: string;
  id: number;
  always_live?: number;
  streams: PpvStreamItem[];
}

interface PpvResponse {
  success: boolean;
  timestamp: number;
  streams: PpvCategoryItem[];
}

let cachedStreams: PpvCategoryItem[] | null = null;
let lastStreamsFetch = 0;
const CACHE_TTL_MS = 90 * 1000; // 90 seconds (upstream recommendation ~1 minute)

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function extractTeams(name: string) {
  const isAt = name.includes(' at ');
  const parts = name.split(/\s+vs\.?\s+|\s+at\s+|\s+-\s+/i);
  if (parts.length === 2) {
    const first = parts[0].trim();
    const second = parts[1].trim();
    return {
      home: { name: isAt ? second : first },
      away: { name: isAt ? first : second },
    };
  }
  return undefined;
}

let activeMirrorDomains: string[] = ['ppv.st', 'ppv.tj', 'ppvs.pk', 'ppv.rw', 'ppv.ms', 'ppv.bi', 'ppv.ug'];
let lastPingFetch = 0;
const PING_TTL_MS = 15 * 60 * 1000; // Check mirror ping every 15 minutes

async function refreshMirrorDomains(signal?: AbortSignal): Promise<void> {
  const now = Date.now();
  if (now - lastPingFetch < PING_TTL_MS) return;

  try {
    const timeoutSignal = AbortSignal.timeout(3500);
    const effectiveSignal = signal ? AbortSignal.any([signal, timeoutSignal]) : timeoutSignal;
    const res = await fetch(BACKUP_PING, { signal: effectiveSignal });
    if (res.ok) {
      const data = await res.json();
      if (data?.success && Array.isArray(data.domains) && data.domains.length > 0) {
        activeMirrorDomains = data.domains;
        lastPingFetch = now;
      }
    }
  } catch {}
}

async function getPpvData(signal?: AbortSignal): Promise<PpvCategoryItem[]> {
  const now = Date.now();
  if (cachedStreams && now - lastStreamsFetch < CACHE_TTL_MS) {
    return cachedStreams;
  }

  // Refresh mirror domains periodically in background
  refreshMirrorDomains(signal).catch(() => {});

  const timeoutSignal = AbortSignal.timeout(5000);
  const effectiveSignal = signal ? AbortSignal.any([signal, timeoutSignal]) : timeoutSignal;

  // Try primary upstream first, then fallback to mirrors if primary is unreachable
  const candidateUrls = [
    UPSTREAM,
    ...activeMirrorDomains.map((domain) => `https://api.${domain}/api/streams`),
  ];
  // Deduplicate URLs
  const uniqueUrls = Array.from(new Set(candidateUrls));

  for (const url of uniqueUrls) {
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Sportivo/2.0',
          Accept: 'application/json',
        },
        signal: effectiveSignal,
      });

      if (res.ok) {
        const data = (await res.json()) as PpvResponse;
        if (data?.success && Array.isArray(data.streams)) {
          cachedStreams = data.streams;
          lastStreamsFetch = now;
          return cachedStreams;
        }
      }
    } catch (err: any) {
      // Continue to next mirror candidate
    }
  }

  return cachedStreams || [];
}

export class PpvAdapter implements ProviderAdapter {
  readonly name = 'ppv';
  readonly isAuthorized = false; // Open API integration
  readonly statusClassification = 'partially-verified' as const;

  async fetchMatches(category: Category, signal?: AbortSignal): Promise<NormalizedMatch[]> {
    const startTime = Date.now();
    const matches: NormalizedMatch[] = [];
    const seenSlugs = new Set<string>();

    const targetCategoryName =
      category === 'football' ? 'Football' : category === 'cricket' ? 'Cricket' : 'Basketball';

    try {
      const categoriesData = await getPpvData(signal);
      const catObj = categoriesData.find(
        (c) => c.category?.toLowerCase() === targetCategoryName.toLowerCase()
      );

      if (catObj && Array.isArray(catObj.streams)) {
        const nowSec = Math.floor(Date.now() / 1000);

        for (const item of catObj.streams) {
          if (!item.name) continue;

          // Exclude raw 24/7 channels in match grids unless they have a competitive match title
          const isChannel = item.always_live === 1 && !/\s+vs\.?\s+|\s+at\s+/i.test(item.name);
          if (isChannel && category !== 'cricket') continue;

          const slug = slugify(item.name);
          if (seenSlugs.has(slug)) continue;
          seenSlugs.add(slug);

          const startsAt = typeof item.starts_at === 'number' ? item.starts_at : 0;
          const endsAt = typeof item.ends_at === 'number' ? item.ends_at : 0;

          const isLive =
            item.always_live === 1 ||
            (startsAt > 0 && nowSec >= startsAt && (endsAt === 0 || nowSec <= endsAt + 1800));
          const isFinal = endsAt > 0 && nowSec > endsAt + 1800;
          const status = category === 'cricket' ? 'Live' : isLive ? 'Live' : isFinal ? 'Final' : 'Upcoming';

          const matchTimeMs = startsAt > 0 ? startsAt * 1000 : Date.now();
          const teams = extractTeams(item.name);
          const displayTitle =
            category === 'cricket' && !item.name.toLowerCase().includes('cricket')
              ? `${item.name} Cricket Live`
              : item.name;

          matches.push({
            id: item.uri_name || String(item.id),
            title: displayTitle,
            category,
            competition: item.tag || item.source_tag || (category === 'cricket' ? 'Live Cricket Broadcast' : undefined),
            league: item.tag || item.source_tag || (category === 'cricket' ? 'Live Cricket' : undefined),
            status,
            date: matchTimeMs,
            poster: item.poster && item.poster.startsWith('https://') ? item.poster : undefined,
            teams,
            sources: [
              {
                source: this.name,
                id: item.uri_name || String(item.id),
                label: item.source_tag || item.tag || 'PPV HD',
              },
            ],
          });
        }
      }

      logDiagnostic({
        provider: this.name,
        operation: `fetchMatches:${category}`,
        durationMs: Date.now() - startTime,
        status: matches.length > 0 ? 200 : 404,
      });
    } catch (err: any) {
      logDiagnostic({
        provider: this.name,
        operation: `fetchMatches:${category}`,
        durationMs: Date.now() - startTime,
        status: 'error',
        error: err.message,
      });
    }

    return matches;
  }

  async resolvePlayback(id: string, signal?: AbortSignal): Promise<PlaybackResolution> {
    const rawTarget = id.trim().toLowerCase();
    const categoriesData = await getPpvData(signal);

    let foundStream: PpvStreamItem | null = null;

    for (const cat of categoriesData) {
      for (const s of cat.streams || []) {
        if (s.uri_name?.toLowerCase() === rawTarget || String(s.id) === rawTarget) {
          foundStream = s;
          break;
        }
      }
      if (foundStream) break;
    }

    if (!foundStream || !foundStream.iframe) {
      return {
        status: 'unavailable',
        streams: [],
        error: 'Stream feed is preparing or currently offline upstream.',
        provider: this.name,
      };
    }

    // Extract embed URL from iframe property (could be raw URL or <iframe src="..."> string)
    let rawEmbedUrl = foundStream.iframe.trim();
    if (rawEmbedUrl.includes('<iframe')) {
      const match = rawEmbedUrl.match(/src=["']([^"']+)["']/i);
      if (match && match[1]) {
        rawEmbedUrl = match[1];
      }
    }

    const validated = sanitizePlaybackUrl(rawEmbedUrl);
    if (!validated) {
      return {
        status: 'unsupported',
        streams: [],
        error: 'Playback embed URL from provider failed security allowlist check.',
        provider: this.name,
      };
    }

    const isNative = validated.endsWith('.m3u8') || validated.endsWith('.mp4');

    const resultStreams = [
      {
        embedUrl: validated,
        hd: true,
        language: foundStream.source_tag || (foundStream.locale ? foundStream.locale.toUpperCase() : 'HD English'),
        isNativeVideo: isNative,
        isSandboxedIframe: !isNative,
      },
    ];

    // If stream has alternative substreams (e.g. Willow 2, Willow Sports), append them as alternate servers
    if (Array.isArray(foundStream.substreams)) {
      for (const sub of foundStream.substreams) {
        if (!sub?.iframe) continue;
        let subUrl = sub.iframe.trim();
        if (subUrl.includes('<iframe')) {
          const match = subUrl.match(/src=["']([^"']+)["']/i);
          if (match && match[1]) subUrl = match[1];
        }
        const validSub = sanitizePlaybackUrl(subUrl);
        if (validSub) {
          const subNative = validSub.endsWith('.m3u8') || validSub.endsWith('.mp4');
          resultStreams.push({
            embedUrl: validSub,
            hd: true,
            language: sub.source_tag || sub.name || `Server ${resultStreams.length + 1}`,
            isNativeVideo: subNative,
            isSandboxedIframe: !subNative,
          });
        }
      }
    }

    return {
      status: 'ready',
      streams: resultStreams,
      provider: this.name,
    };
  }
}

