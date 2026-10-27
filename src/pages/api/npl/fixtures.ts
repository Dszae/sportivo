import type { APIRoute } from 'astro';
import { NPL_FIXTURES_2026, type NplMatch } from '../../../lib/data/nplData';

export const prerender = false;

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

let lastUpstreamSync = 0;
let cachedUpstreamUpdates: Map<string, Partial<NplMatch>> = new Map();

/**
 * Automatically scrapes live scores, overs, and match statuses from official NPL feed
 */
async function fetchOfficialScoreUpdates(): Promise<Map<string, Partial<NplMatch>>> {
  const now = Date.now();
  if (now - lastUpstreamSync < 30000 && cachedUpstreamUpdates.size > 0) {
    return cachedUpstreamUpdates;
  }

  try {
    const res = await fetch('https://nepalpremierleague.org/fixtures', {
      headers: { 'User-Agent': 'Sportivo-LiveDesk/1.0' },
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return cachedUpstreamUpdates;

    const html = await res.text();
    const updates = new Map<string, Partial<NplMatch>>();

    const matchIdRegex = /href="\/matches\/(npl26-\d+)"/g;
    let m: RegExpExecArray | null;
    const matchIds: string[] = [];
    while ((m = matchIdRegex.exec(html)) !== null) {
      if (!matchIds.includes(m[1])) matchIds.push(m[1]);
    }

    for (const id of matchIds) {
      const idx = html.indexOf(`href="/matches/${id}"`);
      if (idx === -1) continue;
      const snippet = html.substring(idx, idx + 2000);

      const isLive = snippet.includes('Live</span>') || snippet.includes('>Live<');
      const isConcluded = snippet.includes('won by');
      const wonMatch = snippet.match(/([A-Za-z\s]+won by[^\n<]+)/);

      const scoreMatches = [
        ...snippet.matchAll(
          /tabular-nums">(\d+)(?:<!-- -->)?\/(?:<!-- -->)?(\d+)<span[^>]*>\((?:<!-- -->)?([\d.]+)/g
        ),
      ];

      const partial: Partial<NplMatch> = {};
      if (isConcluded) {
        partial.status = 'COMPLETED';
      } else if (isLive) {
        partial.status = 'LIVE';
      }

      if (scoreMatches.length >= 2) {
        partial.homeScore = `${scoreMatches[0][1]}/${scoreMatches[0][2]} (${scoreMatches[0][3]} ov)`;
        partial.awayScore = `${scoreMatches[1][1]}/${scoreMatches[1][2]} (${scoreMatches[1][3]} ov)`;
      } else if (scoreMatches.length === 1) {
        partial.homeScore = `${scoreMatches[0][1]}/${scoreMatches[0][2]} (${scoreMatches[0][3]} ov)`;
      }

      if (wonMatch) {
        partial.summary = wonMatch[1].replace(/\\/g, '').trim();
      }

      if (Object.keys(partial).length > 0) {
        updates.set(id, partial);
      }
    }

    if (updates.size > 0) {
      cachedUpstreamUpdates = updates;
      lastUpstreamSync = now;
    }
    return cachedUpstreamUpdates;
  } catch {
    return cachedUpstreamUpdates;
  }
}

export const GET: APIRoute = async () => {
  let fixtures: NplMatch[] = NPL_FIXTURES_2026;

  // 1. Check Supabase for real-time live score and status overrides
  try {
    const supabase = getSupabaseClient();
    if (supabase) {
      const { data, error } = await supabase
        .from('npl_matches')
        .select('*, npl_broadcasts(*)')
        .order('start_time', { ascending: true });

      if (!error && Array.isArray(data) && data.length > 0) {
        fixtures = data.map((row: any) => {
          const activeBroadcast = row.npl_broadcasts?.find(
            (b: any) => b.authorization_status === 'authorized'
          );
          return {
            id: row.id,
            matchNumber: row.match_number,
            round: row.round,
            competition: row.competition || 'Nepal Premier League',
            season: row.season || '2026',
            homeTeam: row.home_team,
            awayTeam: row.away_team,
            homeTeamShort: row.home_team_short,
            awayTeamShort: row.away_team_short,
            homeTeamColor: row.home_team_color,
            awayTeamColor: row.away_team_color,
            homeTeamLogo: row.home_team_logo,
            awayTeamLogo: row.away_team_logo,
            startTime: row.start_time,
            timestamp: new Date(row.start_time).getTime(),
            venue: row.venue,
            status: row.status,
            homeScore: row.home_score,
            awayScore: row.away_score,
            summary: row.summary,
            broadcast: activeBroadcast
              ? {
                  provider: activeBroadcast.provider,
                  authorizedEmbedUrl: activeBroadcast.authorized_embed_url,
                  isHls: activeBroadcast.is_hls,
                  availabilityStatus: activeBroadcast.availability_status,
                }
              : undefined,
            sourceUrl: row.source_url || `https://nepalpremierleague.org/matches/${row.id}`,
          };
        });
      }
    }
  } catch {}

  // 2. Overlay live official score & overs updates
  try {
    const liveUpdates = await fetchOfficialScoreUpdates();
    if (liveUpdates.size > 0) {
      fixtures = fixtures.map((f) => {
        const update = liveUpdates.get(f.id);
        if (update) {
          // Never regress an explicitly COMPLETED match back to LIVE
          const newStatus =
            f.status === 'COMPLETED' ? 'COMPLETED' : update.status || f.status;

          return {
            ...f,
            ...update,
            status: newStatus,
            broadcast: newStatus === 'COMPLETED' ? undefined : f.broadcast,
          };
        }
        return f;
      });
    }
  } catch {}

  return new Response(
    JSON.stringify({
      fixtures,
      lastSync: new Date().toISOString(),
    }),
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=30, stale-while-revalidate=60',
      },
    }
  );
};
