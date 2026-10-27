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
