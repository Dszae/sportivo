import type { Category, NormalizedMatch, PlaybackResolution, ProviderAdapter } from '../types';
import { sanitizePlaybackUrl } from '../allowlist';
import { logDiagnostic } from '../diagnostics';

const UPSTREAM = 'https://timst.top';

const CATEGORY_FILTERS: Record<Category, RegExp> = {
  cricket: /cricket|willow|star sports|sky sports cricket|sony|ptv|ten sports|a sports|supersport.*cricket/i,
  basketball: /nba|basketball/i,
  football: /football|premier|sky sports football|bein|tnt|laliga|bundesliga|serie a|soccer|espn|match tv|dazn/i,
};

interface TimstStream {
  name?: string;
  url: string;
  vip?: boolean;
}

interface TimstChannel {
  url?: string;
  name: string;
  logo?: string;
  genre?: number;
  flag?: string;
  vip?: boolean;
  viewers?: number;
  streams?: TimstStream[];
}

let cachedChannels: TimstChannel[] | null = null;
let lastChannelsFetch = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

async function getTimstChannels(signal?: AbortSignal): Promise<TimstChannel[]> {
  const now = Date.now();
  if (cachedChannels && now - lastChannelsFetch < CACHE_TTL_MS) {
    return cachedChannels;
  }

  const timeoutSignal = AbortSignal.timeout(8000);
  const effectiveSignal = signal ? AbortSignal.any([signal, timeoutSignal]) : timeoutSignal;

  try {
    const res = await fetch(`${UPSTREAM}/api/channels`, { signal: effectiveSignal });
    if (res.ok) {
      const data = (await res.json()) as any;
      if (Array.isArray(data?.channels) && data.channels.length > 0) {
        cachedChannels = data.channels;
        lastChannelsFetch = now;
        return cachedChannels!;
      }
    }
  } catch (err: any) {
    // If upstream fetch fails but we have cached channels, use them gracefully
    if (cachedChannels) {
      return cachedChannels;
    }
  }

  return cachedChannels || [];
}

export class TimstAdapter implements ProviderAdapter {
  readonly name = 'timst';
  readonly isAuthorized = false; // Unverified SLA
  readonly statusClassification = 'partially-verified' as const;

  async fetchMatches(category: Category, signal?: AbortSignal): Promise<NormalizedMatch[]> {
    const startTime = Date.now();
    const matches: NormalizedMatch[] = [];
    const pattern = CATEGORY_FILTERS[category];

    try {
      const allChannels = await getTimstChannels(signal);
      const filtered = allChannels.filter((c) => pattern.test(c?.name || ''));

      for (const ch of filtered) {
        if (!ch?.name) continue;
        const channelKey = ch.url || ch.name;
        const channelStreams = Array.isArray(ch.streams) ? ch.streams : [];

        matches.push({
          id: channelKey,
          title: ch.name,
          category,
          competition: `${category[0].toUpperCase() + category.slice(1)} 24/7 Live TV`,
          league: '24/7 Broadcast',
          status: 'Live',
          date: 0, // continuous 24/7 stream
          poster: ch.logo && ch.logo.startsWith('http') ? ch.logo : undefined,
          sources: channelStreams.length > 0
            ? channelStreams.map((s, idx) => ({
                source: 'timst',
                id: s.url || channelKey,
                label: s.name ? `${s.name} ${idx + 1}` : `Timst Server ${idx + 1}`,
              }))
            : [{ source: 'timst', id: channelKey, label: 'Timst HD' }],
        });
      }

      logDiagnostic({
        provider: this.name,
        operation: `fetchMatches:${category}`,
        durationMs: Date.now() - startTime,
        status: allChannels.length > 0 ? 200 : 503,
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
    const rawTarget = id.trim();
    let streamUrl: string | null = null;
    let streamLabel = 'HD Broadcast';

    // 1. If id is already a direct stream URL (e.g. https://ehgembxe.cfd/...)
    if (rawTarget.startsWith('https://')) {
      streamUrl = rawTarget;
    } else {
      // 2. Look up the channel by key or name
      const channels = await getTimstChannels(signal);
      const normalizedTarget = rawTarget.toLowerCase().replace(/[^a-z0-9]/g, '');

      const found = channels.find((c) => {
        if (!c.name) return false;
        if (c.url && c.url.toLowerCase() === rawTarget.toLowerCase()) return true;
        if (c.name.toLowerCase() === rawTarget.toLowerCase()) return true;
        const normName = c.name.toLowerCase().replace(/[^a-z0-9]/g, '');
        return normName === normalizedTarget;
      });

      if (found && Array.isArray(found.streams) && found.streams.length > 0) {
        streamUrl = found.streams[0].url;
        streamLabel = found.streams[0].name || found.name;
      }
    }

    // Never return the TimStreams homepage
    if (!streamUrl || streamUrl === UPSTREAM || streamUrl.endsWith('timst.top') || streamUrl.endsWith('timst.top/')) {
      return {
        status: 'unavailable',
        streams: [],
        error: 'Live stream player is currently awaiting upstream signal.',
        provider: this.name,
      };
    }

    const validated = sanitizePlaybackUrl(streamUrl);
    if (!validated) {
      return {
        status: 'unsupported',
        streams: [],
        error: 'Stream URL is not from an approved domain.',
        provider: this.name,
      };
    }

    const isNative = validated.endsWith('.m3u8') || validated.endsWith('.mp4');

    return {
      status: 'ready',
      streams: [
        {
          embedUrl: validated,
          hd: true,
          language: streamLabel,
          isNativeVideo: isNative,
          isSandboxedIframe: !isNative,
        },
      ],
      provider: this.name,
    };
  }
}
