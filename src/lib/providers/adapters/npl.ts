import type { Category, NormalizedMatch, PlaybackResolution, ProviderAdapter } from '../types';
import { sanitizePlaybackUrl } from '../allowlist';
import { logDiagnostic } from '../diagnostics';
import { NPL_FIXTURES_2026, type NplMatch } from '../../data/nplData';

let cachedNplMatches: NormalizedMatch[] | null = null;
let lastNplFetch = 0;
const CACHE_TTL_MS = 60 * 1000; // 60s cache

/**
 * Checks if Supabase credentials are available in environment
 */
function getSupabaseClient() {
  const url = process.env.SUPABASE_URL || (typeof import.meta !== 'undefined' && import.meta.env?.SUPABASE_URL);
  const key = process.env.SUPABASE_ANON_KEY || (typeof import.meta !== 'undefined' && import.meta.env?.SUPABASE_ANON_KEY);
  if (!url || !key) return null;

  try {
    const { createClient } = require('@supabase/supabase-js');
    return createClient(url, key);
  } catch {
    return null;
  }
}

/**
 * Maps fixture IDs (e.g. "npl26-02") to backend IDs (e.g. "NPL2")
 */
function toNplBackendId(id: string): string {
  const match = id.match(/npl26-0?(\d+)/i);
  if (match) {
    return `NPL${match[1]}`;
  }
  return id;
}

/**
 * Convert NplMatch record into NormalizedMatch for Sportivo aggregator
 */
function toNormalizedMatch(m: NplMatch): NormalizedMatch {
  const sources = [
    {
      source: 'npl',
      id: m.id,
      label: m.broadcast?.provider || 'NPL Live Feed',
    },
  ];

  return {
    id: m.id,
    title: `${m.homeTeam} vs ${m.awayTeam}`,
    category: 'cricket',
    competition: 'Nepal Premier League',
    league: 'NPL',
    status: m.status === 'LIVE' ? 'Live' : m.status === 'COMPLETED' ? 'Final' : 'Upcoming',
    date: m.timestamp,
    teams: {
      home: {
        name: m.homeTeam,
        badge: m.homeTeamLogo,
      },
      away: {
        name: m.awayTeam,
        badge: m.awayTeamLogo,
      },
    },
    poster: m.homeTeamLogo || 'https://nepalpremierleague.org/icon.svg',
    sources,
  };
}

export const nplAdapter: ProviderAdapter = {
  name: 'npl',
  isAuthorized: true,
  statusClassification: 'verified',

  async fetchMatches(category: Category, signal?: AbortSignal): Promise<NormalizedMatch[]> {
    if (category !== 'cricket') {
      return [];
    }

    const now = Date.now();
    if (cachedNplMatches && now - lastNplFetch < CACHE_TTL_MS) {
      return cachedNplMatches;
    }

    // 1. Try querying Supabase database if configured
    try {
      const supabase = getSupabaseClient();
      if (supabase) {
        const { data, error } = await supabase
          .from('npl_matches')
          .select('*, npl_broadcasts(*)')
          .order('start_time', { ascending: true });

        if (!error && Array.isArray(data) && data.length > 0) {
          const mapped: NormalizedMatch[] = data.map((row: any) => {
            const activeBroadcast = row.npl_broadcasts?.find(
              (b: any) => b.authorization_status === 'authorized'
            );
            return {
              id: row.id,
              title: `${row.home_team} vs ${row.away_team}`,
              category: 'cricket',
              competition: row.competition || 'Nepal Premier League',
              league: 'NPL',
              status: row.status === 'LIVE' ? 'Live' : row.status === 'COMPLETED' ? 'Final' : 'Upcoming',
              date: new Date(row.start_time).getTime(),
              teams: {
                home: { name: row.home_team, badge: row.home_team_logo },
                away: { name: row.away_team, badge: row.away_team_logo },
              },
              poster: row.home_team_logo,
              sources: activeBroadcast
                ? [
                    {
                      source: 'npl',
                      id: row.id,
                      label: activeBroadcast.provider,
                    },
                  ]
                : [],
            };
          });

          cachedNplMatches = mapped;
          lastNplFetch = now;
          logDiagnostic('npl', 'info', `Loaded ${mapped.length} fixtures from Supabase`);
          return mapped;
        }
      }
    } catch (err: any) {
      logDiagnostic('npl', 'warning', `Supabase query skipped or failed: ${err?.message}`);
    }

    // 2. Fallback to Verified In-Memory Dataset (Always available, last known good state)
    const normalized = NPL_FIXTURES_2026.map(toNormalizedMatch);
    cachedNplMatches = normalized;
    lastNplFetch = now;
    return normalized;
  },

  async resolvePlayback(id: string, signal?: AbortSignal): Promise<PlaybackResolution> {
    // 1. Query NPL Backend Microservice (if running or configured)
    const backendBase =
      process.env.NPL_BACKEND_URL ||
      (typeof import.meta !== 'undefined' && import.meta.env?.NPL_BACKEND_URL) ||
      'http://localhost:3000';

    const candidateIds = [toNplBackendId(id), id];

    for (const testId of candidateIds) {
      try {
        const backendEndpoint = `${backendBase.replace(/\/$/, '')}/api/stream?id=${encodeURIComponent(testId)}`;
        const res = await fetch(backendEndpoint, {
          signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(5000)]) : AbortSignal.timeout(5000),
        });

        if (res.ok) {
          const body = await res.json();
          if (body && body.url) {
            const safeUrl = sanitizePlaybackUrl(body.url);
            if (safeUrl) {
              const isNative = safeUrl.endsWith('.m3u8') || safeUrl.endsWith('.mp4');
              return {
                status: 'ready',
                provider: 'NPL Official Stream',
                streams: [
                  {
                    embedUrl: safeUrl,
                    hd: true,
                    isNativeVideo: isNative,
                    isSandboxedIframe: !isNative,
                    language: 'Nepali / English',
                  },
                ],
              };
            }
          }
        }
      } catch (backendErr: any) {
        logDiagnostic('npl', 'debug', `Backend microservice check for ${testId}: ${backendErr?.message}`);
      }
    }

    // 2. Direct upstream resolution (Cloud / Vercel fallback matching npl microservice)
    for (const testId of candidateIds) {
      try {
        const directRes = await fetch(`https://yonotv.pages.dev/LINK?id=${encodeURIComponent(testId)}`, {
          signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(4000)]) : AbortSignal.timeout(4000),
        });
        if (directRes.ok) {
          const html = await directRes.text();
          const pattern = new RegExp(`${testId}:\\s*["']([^"']+)["']`, 'i');
          const match = html.match(pattern);
          if (match && match[1]) {
            let streamUrl = match[1];
            const srcMatch = streamUrl.match(/src=([^&"']+)/i);
            if (srcMatch && srcMatch[1]) {
              streamUrl = decodeURIComponent(srcMatch[1]);
            }
            const safeUrl = sanitizePlaybackUrl(streamUrl);
            if (safeUrl && (safeUrl.endsWith('.m3u8') || safeUrl.endsWith('.mp4'))) {
              return {
                status: 'ready',
                provider: 'NPL Live Stream (NetTV)',
                streams: [
                  {
                    embedUrl: safeUrl,
                    hd: true,
                    isNativeVideo: true,
                    isSandboxedIframe: false,
                    language: 'Nepali / English',
                  },
                ],
              };
            }
          }
        }
      } catch (err: any) {
        logDiagnostic('npl', 'debug', `Direct upstream resolution for ${testId}: ${err?.message}`);
      }
    }

    // 2. Check Supabase broadcasts if available
    try {
      const supabase = getSupabaseClient();
      if (supabase) {
        const { data, error } = await supabase
          .from('npl_broadcasts')
          .select('*')
          .eq('match_id', id)
          .eq('authorization_status', 'authorized')
          .limit(1)
          .maybeSingle();

        if (!error && data && data.authorized_embed_url) {
          const safeUrl = sanitizePlaybackUrl(data.authorized_embed_url);
          if (safeUrl) {
            const isNative = data.is_hls || safeUrl.endsWith('.m3u8') || safeUrl.endsWith('.mp4');
            return {
              status: 'ready',
              provider: data.provider || 'NPL Verified Broadcast',
              streams: [
                {
                  embedUrl: safeUrl,
                  hd: true,
                  isNativeVideo: isNative,
                  isSandboxedIframe: !isNative,
                  language: 'Nepali / English',
                },
              ],
            };
          }
        }
      }
    } catch {}

    // 3. Check Static/Verified Data Model
    const fixture = NPL_FIXTURES_2026.find((m) => m.id === id);
    if (!fixture || !fixture.broadcast) {
      return {
        status: 'unavailable',
        provider: 'NPL Broadcast Desk',
        streams: [],
        error: 'No authorized broadcast feed is currently available for this fixture. Live feeds typically go live 15 minutes before kickoff.',
      };
    }

    const { broadcast } = fixture;
    const safeUrl = sanitizePlaybackUrl(broadcast.authorizedEmbedUrl);
    if (!safeUrl) {
      return {
        status: 'unavailable',
        provider: broadcast.provider || 'NPL Official Broadcast',
        streams: [],
        error: 'The broadcast endpoint did not pass security validation.',
      };
    }

    const isNative = broadcast.isHls || safeUrl.endsWith('.m3u8') || safeUrl.endsWith('.mp4');
    return {
      status: 'ready',
      provider: broadcast.provider,
      streams: [
        {
          embedUrl: safeUrl,
          hd: true,
          isNativeVideo: isNative,
          isSandboxedIframe: !isNative,
          language: 'Nepali / English',
        },
      ],
    };
  },
};
