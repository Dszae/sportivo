class SimpleMemoryCache {
  private store = new Map<string, { value: any; expiry: number }>();

  get<T>(key: string): T | undefined {
    const item = this.store.get(key);
    if (!item) return undefined;
    if (Date.now() > item.expiry) {
      this.store.delete(key);
      return undefined;
    }
    return item.value as T;
  }

  set(key: string, value: any, ttlSeconds: number = 900): void {
    this.store.set(key, { value, expiry: Date.now() + ttlSeconds * 1000 });
  }

  del(key: string): void {
    this.store.delete(key);
  }

  flushAll(): void {
    this.store.clear();
  }
}

if (typeof process !== 'undefined' && typeof process.on === 'function') {
  if (!((globalThis as any).__STREAM_SERVICE_SAFETY_INIT__)) {
    (globalThis as any).__STREAM_SERVICE_SAFETY_INIT__ = true;
    process.on('uncaughtException', (err: any) => {
      console.warn('[StreamServer] Prevented crash from uncaught exception:', err?.message);
    });
    process.on('unhandledRejection', (reason: any) => {
      console.warn('[StreamServer] Prevented crash from unhandled rejection:', reason);
    });
  }
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
  licenseUrl?: string;
}

/**
 * StreamService - High-Availability Live Video Stream Registry & Health Prober
 * Dynamically ingests, validates, caches, and selects active live feeds.
 */
export class StreamService {
  private cache: SimpleMemoryCache;
  private directoryUrl: string;

  constructor() {
    this.cache = new SimpleMemoryCache();
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

    // 1. Direct Multi-Device HLS Stream (GoogleVideo HD - Unencrypted Native)
    feeds.push({
      id: 'DIRECT-HLS-GV-MATCH20',
      name: 'Action Sports HD (Direct 1080p Stream 1)',
      url: 'https://manifest.googlevideo.com/api/manifest/hls_variant/expire/1794244959/ei/_6zxaq6bDq7t4t4Ppd7T2Qs/ip/103.167.232.247/id/ea982876dd667b38/source/youtube/requiressl/yes/xpc/EgVo2aDSNQ%3D%3D/playback_host/rr1---sn-uxjihpoqn-cigs.googlevideo.com/cps/38/met/1794223359%2C/mh/mB/mm/31%2C29/mn/sn-uxjihpoqn-cigs%2Csn-fapo3ox25a-3uhz/ms/au%2Crdu/mv/m/mvi/1/pl/24/rms/au%2Cau/hfr/1/demuxed/1/tts_caps/1/maudio/1/pcm2/no/initcwndbps/1193250/bui/AZFAFb9km0bFKKtvPKTFS9JS4y5lOTMFRK1l5OI4tjEgvlHoVhxdK0fBwqvCOaHK524jDgVFz_4HFkxN/spc/mpRQ_66caick_gKXMsGNPq_l78X2-xPLI0iADGzhgefjlRgQ2Lcg8h0thQ7uH3A/vprv/1/go/1/rqh/5/epbp/1/mt/1794222856/fvip/4/nvgoi/1/short_key/1/ncsapi/1/keepalive/yes/fexp/51565115/dover/13/itag/0/playlist_type/DVR/sparams/expire%2Cei%2Cip%2Cid%2Csource%2Crequiressl%2Cxpc%2Chfr%2Cdemuxed%2Ctts_caps%2Cmaudio%2Cpcm2%2Cbui%2Cspc%2Cvprv%2Cgo%2Crqh%2Citag%2Cplaylist_type/sig/AE0s2JYwRgIhAPto41gFNMJuNtt7LNma4MLU1635K0gPvlnRo1KQCpgeAiEA0Q01I_JmbqL-RfEz_HthGfT-5I8Mnq67nJgvuMX8XUw%3D/lsparams/playback_host%2Ccps%2Cmet%2Cmh%2Cmm%2Cmn%2Cms%2Cmv%2Cmvi%2Cpl%2Crms%2Cinitcwndbps/lsig/APaTxxMwRQIgYdkcuVXgZvRc61JsO5kdDdOQfpeWErQxrOZYnbrTWuICIQDtBKJVYQE8_dYXeVNz-wcAnbdBW9MKra8GbRbh6Qu5nA%3D%3D/file/index.m3u8',
      type: 'hls',
      isEmbed: false,
      priority: 1,
    });

    // 2. NetTV Live Match 3 - Edge MTDC (Match 20 Active Session)
    feeds.push({
      id: 'NETTV-DASH-EDGE-MTDC3',
      name: 'NetTV Action Sports HD (Edge MTDC Live 3)',
      url: 'https://ott-edge-mtdc.nettv.com.np/npl/live_match3/index.mpd?CMCD=br%3D4194%2Cot%3Dm%2Cmtp%3D4194%2Csu%2Ccid%3D%22a-rz--cricket--p82103164700970876976%22%2Csf%3Dd%2Csid%3D%222822474a-c730-4fd1-8cc2-e615573de093%22%2Cst%3Dv',
      type: 'dash',
      isEmbed: false,
      priority: 2,
      licenseUrl: 'https://widevine-dash.ezdrm.com/proxy?pX=196792&user_id=M2ZhNWI0YzAtNzgxNy00MjRlLWFlODMtZWFmYWJmNDRmMjU1&CustomData=eyJyZXNlbGxlcl9pZCI6IjEwNyIsInN1YnNjcmliZXJfaWQiOiIxMDc3NDk3NiIsInNlcmlhbCI6ImdsXzExMTUwMTQwMDk4MTM0NDk0MDcxMi0xMDciLCJtYXRjaF9rZXkiOiJhLXJ6LS1jcmlja2V0LS1wODIxMDMxNjQ3MDA5NzA4NzY5NzYiLCJleHAiOjE3OTQyMjQzMTksInNpZCI6IjdhMWJmNzExNTNiYjljOTNmOGQwYWJlOWY0NGRjNjJjIiwicGxhdGZvcm0iOiJ3ZWIiLCJlbnRpdGxlZF91bnRpbCI6MTc5NDIzNzgxOSwibWF4X2NvbmN1cnJlbnQiOjEsInN1YnNjcmliZXJfc3RiX2lkIjoiMTM3Mzg1NTAiLCJ1YmJfZ3VpZCI6IjNmYTViNGMwLTc4MTctNDI0ZS1hZTgzLWVhZmFiZjQ0ZjI1NSJ9.eXeuibnuH9Nrm3s16kg2Pst92shpPB9DaBqm5gmJnzQ',
    });

    // 3. NetTV Live Match 3 - Load Balancer (Match 20 Active Session)
    feeds.push({
      id: 'NETTV-DASH-LB3',
      name: 'NetTV Action Sports HD (LB Live 3)',
      url: 'https://ott-lb.nettv.com.np/npl/live_match3/index.mpd?CMCD=br%3D4194%2Cot%3Dm%2Cmtp%3D4194%2Csu%2Ccid%3D%22a-rz--cricket--p82103164700970876976%22%2Csf%3Dd%2Csid%3D%222822474a-c730-4fd1-8cc2-e615573de093%22%2Cst%3Dv',
      type: 'dash',
      isEmbed: false,
      priority: 3,
      licenseUrl: 'https://widevine-dash.ezdrm.com/proxy?pX=196792&user_id=M2ZhNWI0YzAtNzgxNy00MjRlLWFlODMtZWFmYWJmNDRmMjU1&CustomData=eyJyZXNlbGxlcl9pZCI6IjEwNyIsInN1YnNjcmliZXJfaWQiOiIxMDc3NDk3NiIsInNlcmlhbCI6ImdsXzExMTUwMTQwMDk4MTM0NDk0MDcxMi0xMDciLCJtYXRjaF9rZXkiOiJhLXJ6LS1jcmlja2V0LS1wODIxMDMxNjQ3MDA5NzA4NzY5NzYiLCJleHAiOjE3OTQyMjQzMTksInNpZCI6IjdhMWJmNzExNTNiYjljOTNmOGQwYWJlOWY0NGRjNjJjIiwicGxhdGZvcm0iOiJ3ZWIiLCJlbnRpdGxlZF91bnRpbCI6MTc5NDIzNzgxOSwibWF4X2NvbmN1cnJlbnQiOjEsInN1YnNjcmliZXJfc3RiX2lkIjoiMTM3Mzg1NTAiLCJ1YmJfZ3VpZCI6IjNmYTViNGMwLTc4MTctNDI0ZS1hZTgzLWVhZmFiZjQ0ZjI1NSJ9.eXeuibnuH9Nrm3s16kg2Pst92shpPB9DaBqm5gmJnzQ',
    });

    // 4. Action Sports HD Akamai Master Player
    feeds.push({
      id: 'ACTIONSPORTS-AKAMAI-NEP',
      name: 'Action Sports HD (Akamai Master)',
      url: 'https://yonotv.pages.dev/wtvplyrrr?manifest=https://a96aivottlinear-a.akamaihd.net/OTTB/pdx-nitro/live/clients/dash/enc/3qvpw810gz/out/v1/e4b320f9ef924fe59188752dcf9c7fbf/cenc.mpd&keyid=5d52529b6ff19eca2315013244513b68&key=ba5c7dfad287aab538463d9da6811a8c',
      type: 'embed',
      isEmbed: true,
      priority: 4,
    });

    // 5. Direct HLS Broadcast Feed (TU Ground Live Feed)
    feeds.push({
      id: 'NETTV-HLS-DIRECT',
      name: 'Action Sports HD (Direct HLS Feed)',
      url: 'https://lb-ottnp.nettvstreamz.com/npl/live_match6/playlist.m3u8',
      type: 'hls',
      isEmbed: false,
      priority: 5,
    });

    // 5. Action Sports HD Akamai Backup Player
    feeds.push({
      id: 'ACTIONSPORTS-AKAMAI-NEP4',
      name: 'Action Sports HD (Akamai Backup)',
      url: 'https://yonotv.pages.dev/wtvplyrrr?manifest=https://a96aivottlinear-a.akamaihd.net/OTTB/iad-nitro/live/clients/dash/enc/q4skycp0em/out/v1/ff0967ee82ad427abee362dc40a4f60f/cenc.mpd&keyid=5d52529b6ff19eca2315013244513b68&key=ba5c7dfad287aab538463d9da6811a8c',
      type: 'embed',
      isEmbed: true,
      priority: 5,
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

            // Exclude foreign non-NPL cricket feeds (FanCode, Australia, India, England, Pakistan, etc.)
            if (/^(AUS|IND|ENG|PAK|WPL|FC|ACC|SAFF|NP4|NP2|NP3|NP$|NEP5)/i.test(key)) continue;

            if (/^(NEP[0-9]*|NPL)$/i.test(key)) {
              const streamUrl = this.normalizeUrl(rawUrl);
              const isDirectMedia = streamUrl.includes('.m3u8') || streamUrl.includes('.mpd');

              feeds.push({
                id: `FEED-${key}`,
                name: `Action Sports HD (${key})`,
                url: isDirectMedia ? streamUrl : rawUrl,
                type: streamUrl.includes('.mpd') ? 'dash' : isDirectMedia ? 'hls' : 'embed',
                isEmbed: !isDirectMedia || rawUrl.includes('plyrr') || rawUrl.includes('pages.dev'),
                priority: key === 'NEP5' ? 2 : key === 'NEP' ? 4 : 10,
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
