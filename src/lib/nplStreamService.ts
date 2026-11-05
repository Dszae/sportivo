import NodeCache from 'node-cache';

if (!((global as any).__STREAM_SERVICE_SAFETY_INIT__)) {
  (global as any).__STREAM_SERVICE_SAFETY_INIT__ = true;
  process.on('uncaughtException', (err: any) => {
    console.warn('[StreamServer] Prevented crash from uncaught exception:', err?.message);
  });
  process.on('unhandledRejection', (reason: any) => {
    console.warn('[StreamServer] Prevented crash from unhandled rejection:', reason);
  });
}

export interface StreamItem {
  id: string;
  name: string;
  url: string;
  type?: 'dash' | 'hls' | 'embed';
  isEmbed: boolean;
  priority?: number;
  status?: string;
  cached?: boolean;
}

/**
 * StreamService - High-Availability Live Video Stream Registry & Health Prober
 * Dynamically ingests, validates, caches, and selects active live feeds.
 */
export class StreamService {
  private cache: NodeCache;
  private directoryUrl: string;

  constructor() {
    this.cache = new NodeCache({ stdTTL: 900, checkperiod: 120, useClones: false });
    this.directoryUrl = process.env.STREAM_DIRECTORY_URL || 'https://yonotv.pages.dev/LINK';
  }

  normalizeUrl(url: string): string {
    if (!url || typeof url !== 'string') return '';
    let normalized = url.trim();

    const srcMatch = normalized.match(/[?&]src=([^&"']+)/i);
    if (srcMatch && srcMatch[1]) {
      normalized = decodeURIComponent(srcMatch[1]);
    }

    if (normalized.includes('_DVR.m3u8')) {
      normalized = normalized.replace('_DVR.m3u8', '.m3u8');
    }

    return normalized;
  }

  async isStreamAlive(url: string): Promise<boolean> {
    if (!url) return false;
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500);

      const res = await fetch(url, {
        method: 'HEAD',
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': '*/*',
        },
      });

      clearTimeout(timeoutId);
      return res.ok || res.status === 200 || res.status === 206;
    } catch {
      return false;
    }
  }

  async ingestCandidateFeeds(): Promise<StreamItem[]> {
    const feeds: StreamItem[] = [];

    // 1. NetTV Unencrypted 1080p DASH Cluster (Zero-Delay Real-Time Live Edge)
    feeds.push({
      id: 'NETTV-DASH-LB',
      name: 'NetTV 1080p Master (Zero Lag)',
      url: 'https://ott-lb.nettv.com.np/npl/live_match/index.mpd',
      type: 'dash',
      isEmbed: false,
      priority: 1,
    });

    feeds.push({
      id: 'NETTV-DASH-EDGE3',
      name: 'NetTV Edge 03 (1080p Direct)',
      url: 'https://ott-edge-mtdc03.nettv.com.np/npl/live_match/index.mpd',
      type: 'dash',
      isEmbed: false,
      priority: 2,
    });

    feeds.push({
      id: 'NETTV-DASH-EDGE1',
      name: 'NetTV Edge 01 (1080p Direct)',
      url: 'https://ott-edge-mtdc01.nettv.com.np/npl/live_match/index.mpd',
      type: 'dash',
      isEmbed: false,
      priority: 3,
    });

    feeds.push({
      id: 'NETTV-DASH-EDGE2',
      name: 'NetTV Edge 02 (1080p Direct)',
      url: 'https://ott-edge-mtdc02.nettv.com.np/npl/live_match/index.mpd',
      type: 'dash',
      isEmbed: false,
      priority: 4,
    });

    feeds.push({
      id: 'NETTV-DASH-EDGE4',
      name: 'NetTV Edge 04 (1080p Direct)',
      url: 'https://ott-edge-mtdc04.nettv.com.np/npl/live_match/index.mpd',
      type: 'dash',
      isEmbed: false,
      priority: 5,
    });

    // 2. Secondary Verified Action Sports Web Mirrors (Fallback)
    feeds.push({
      id: 'ACTIONSPORTS-DRM-DASH',
      name: 'Action Sports HD (Master DRM Feed)',
      url: 'https://yonotv.pages.dev/wtvplyrrr?manifest=https://a96aivottlinear-a.akamaihd.net/OTTB/iad-nitro/live/clients/dash/enc/vfq7vktpaj/out/v1/e5454d69a91c478db2e1b3e56cf9bf47/cenc.mpd&keyid=ba4284442c87f52ddeaa95c65d236805&key=56f0808d1f1fbfc0703b384081f1d340',
      type: 'embed',
      isEmbed: true,
      priority: 6,
    });

    feeds.push({
      id: 'ACTIONSPORTS-WEB-PLAYER',
      name: 'Action Sports HD (Web Player Mirror)',
      url: 'https://yonotv.pages.dev/fc',
      type: 'embed',
      isEmbed: true,
      priority: 7,
    });

    try {
      const res = await fetch(this.directoryUrl, { signal: AbortSignal.timeout(5000) });
      if (res.ok) {
        const text = await res.text();
        const channelsMatch = text.match(/const channels = \{([\s\S]*?)\};/);

        if (channelsMatch && channelsMatch[1]) {
          const body = channelsMatch[1];
          const lineRegex = /([A-Za-z0-9_-]+)\s*:\s*["']([^"']+)["']/g;
          let m: RegExpExecArray | null;

          while ((m = lineRegex.exec(body)) !== null) {
            const key = m[1].toUpperCase();
            const rawUrl = m[2];

            // Exclude foreign non-NPL cricket feeds
            if (/^(AUS|IND|ENG|PAK|WPL|FC2|FC3|ACC|SAFF)/i.test(key)) continue;

            if (key === 'NP4' || key === 'NEP1' || key === 'NPL' || key === 'NP' || key === 'NP2' || key === 'NP3') {
              const streamUrl = this.normalizeUrl(rawUrl);
              const isDirectMedia = streamUrl.includes('.m3u8') || streamUrl.includes('.mpd');

              feeds.push({
                id: `FEED-${key}`,
                name: key.includes('NP') ? 'Action Sports HD / Nepal Cricket' : `Channel ${key}`,
                url: isDirectMedia ? streamUrl : rawUrl,
                type: streamUrl.includes('.mpd') ? 'dash' : isDirectMedia ? 'hls' : 'embed',
                isEmbed: !isDirectMedia || rawUrl.includes('plyrr') || rawUrl.includes('pages.dev'),
                priority: key === 'NP4' ? 10 : 20,
              });
            }
          }
        }
      }
    } catch (err: any) {
      console.warn('[StreamService] Directory ingestion notice:', err?.message);
    }

    return feeds;
  }

  async getAutoStream(): Promise<StreamItem> {
    const cacheKey = 'stream:auto:active';
    const cached = this.cache.get<StreamItem>(cacheKey);
    if (cached) {
      return { ...cached, cached: true };
    }

    const candidates = await this.ingestCandidateFeeds();
    candidates.sort((a, b) => (a.priority || 99) - (b.priority || 99));

    for (const feed of candidates) {
      const alive = await this.isStreamAlive(feed.url);
      if (alive) {
        const payload: StreamItem = {
          id: feed.id,
          name: feed.name,
          url: feed.url,
          type: feed.type || (feed.url.includes('.mpd') ? 'dash' : feed.isEmbed ? 'embed' : 'hls'),
          isEmbed: feed.isEmbed,
        };
        this.cache.set(cacheKey, payload, 900);
        return { ...payload, cached: false };
      }
    }

    const fallback: StreamItem = {
      id: 'NETTV-DASH-LB',
      name: 'NetTV 1080p Master (Zero Lag)',
      url: 'https://ott-lb.nettv.com.np/npl/live_match/index.mpd',
      type: 'dash',
      isEmbed: false,
      cached: false,
    };
    return fallback;
  }

  async getAllActiveStreams(): Promise<StreamItem[]> {
    const cacheKey = 'stream:all:active';
    const cached = this.cache.get<StreamItem[]>(cacheKey);
    if (cached && Array.isArray(cached) && cached.length > 0) {
      return cached;
    }

    const candidates = await this.ingestCandidateFeeds();
    const verified: StreamItem[] = [];
    const seen = new Set<string>();

    await Promise.allSettled(
      candidates.map(async (feed) => {
        if (seen.has(feed.url)) return;
        seen.add(feed.url);

        const alive = await this.isStreamAlive(feed.url);
        if (alive) {
          verified.push({
            id: feed.id,
            name: feed.name,
            url: feed.url,
            type: feed.type || (feed.url.includes('.mpd') ? 'dash' : feed.isEmbed ? 'embed' : 'hls'),
            isEmbed: feed.isEmbed,
            priority: feed.priority,
            status: 'online',
          });
        }
      })
    );

    if (verified.length > 0) {
      verified.sort((a, b) => (a.priority || 99) - (b.priority || 99));
      this.cache.set(cacheKey, verified, 180);
    }

    return verified;
  }
}

export const streamService = new StreamService();
export default streamService;
