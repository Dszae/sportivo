import type { APIRoute } from 'astro';
import { NPL_FIXTURES_2026, NPL_TEAMS } from '../../../lib/data/nplData';
import { getSafeCorsHeaders } from '../../../lib/security';

export const prerender = false;

export interface StandingsRow {
  rank: number;
  name: string;
  short: string;
  p: number;
  w: number;
  l: number;
  nr: number;
  nrr: string;
  pts: number;
  logo?: string;
  color?: string;
}

let cachedStandings: StandingsRow[] | null = null;
let lastFetchTime = 0;

/**
 * Scrapes official live standings directly from nepalpremierleague.org/standings
 */
async function scrapeOfficialStandings(): Promise<StandingsRow[] | null> {
  try {
    const res = await fetch('https://nepalpremierleague.org/standings', {
      headers: { 'User-Agent': 'Sportivo-LiveDesk/1.0' },
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return null;
    const html = await res.text();

    const trs = html.split('<tr');
    const rows: StandingsRow[] = [];

    for (let i = 1; i < trs.length; i++) {
      const tr = trs[i];
      if (!tr.includes('/teams/')) continue;

      // Extract team name
      const nameMatch = tr.match(/<span class="hidden sm:inline">([^<]+)<\/span>/) ||
                        tr.match(/alt="([^"]+)"/);
      if (!nameMatch) continue;
      const teamName = nameMatch[1].trim();

      // Extract numbers: P, W, L, NR, NRR, Pts
      // Clean tags to text tokens
      // Find team index or short code
      const shortMatch = tr.match(/<span class="sm:hidden">([A-Z]{3})<\/span>/);
      const short = shortMatch ? shortMatch[1] : (NPL_TEAMS[teamName]?.short || teamName.slice(0, 3).toUpperCase());

      // Parse tabular-nums tds
      const tdMatches = [...tr.matchAll(/<td[^>]*tabular-nums[^>]*>([\s\S]*?)<\/td>/g)].map(m => m[1].replace(/<[^>]+>/g, '').trim());

      if (tdMatches.length >= 6) {
        const p = Number(tdMatches[0]) || 0;
        const w = Number(tdMatches[1]) || 0;
        const l = Number(tdMatches[2]) || 0;
        const nr = Number(tdMatches[3]) || 0;
        const nrr = tdMatches[4] || '0.000';
        const pts = Number(tdMatches[5]) || 0;

        rows.push({
          rank: rows.length + 1,
          name: teamName,
          short,
          p,
          w,
          l,
          nr,
          nrr: nrr.startsWith('+') || nrr.startsWith('-') ? nrr : `+${nrr}`,
          pts,
          logo: NPL_TEAMS[teamName]?.logo,
          color: NPL_TEAMS[teamName]?.color,
        });
      }
    }

    return rows.length >= 8 ? rows : null;
  } catch {
    return null;
  }
}

/**
 * Fallback dynamic computation from all completed match results in NPL_FIXTURES_2026
 */
function computeStandingsFromFixtures(): StandingsRow[] {
  const stats: Record<string, { p: number; w: number; l: number; nr: number; pts: number }> = {};
  for (const name of Object.keys(NPL_TEAMS)) {
    stats[name] = { p: 0, w: 0, l: 0, nr: 0, pts: 0 };
  }

  const now = Date.now();
  for (const match of NPL_FIXTURES_2026) {
    const isCompleted = match.status === 'COMPLETED' || (match.summary && /won by|tied|no result/i.test(match.summary)) || (now > match.timestamp + 3.5 * 3600 * 1000);
    if (!isCompleted || !match.summary) continue;

    const summary = match.summary.toLowerCase();
    const home = match.homeTeam;
    const away = match.awayTeam;

    if (!stats[home]) stats[home] = { p: 0, w: 0, l: 0, nr: 0, pts: 0 };
    if (!stats[away]) stats[away] = { p: 0, w: 0, l: 0, nr: 0, pts: 0 };

    stats[home].p++;
    stats[away].p++;

    if (summary.includes('no result') || summary.includes('abandoned')) {
      stats[home].nr++;
      stats[away].nr++;
      stats[home].pts += 1;
      stats[away].pts += 1;
    } else {
      const winner = summary.includes(home.toLowerCase()) ? home : summary.includes(away.toLowerCase()) ? away : null;
      if (winner === home) {
        stats[home].w++;
        stats[home].pts += 2;
        stats[away].l++;
      } else if (winner === away) {
        stats[away].w++;
        stats[away].pts += 2;
        stats[home].l++;
      }
    }
  }

  const rows: StandingsRow[] = Object.keys(stats).map((name) => {
    const s = stats[name];
    return {
      rank: 1,
      name,
      short: NPL_TEAMS[name]?.short || name.slice(0, 3).toUpperCase(),
      p: s.p,
      w: s.w,
      l: s.l,
      nr: s.nr,
      nrr: '+0.000',
      pts: s.pts,
      logo: NPL_TEAMS[name]?.logo,
      color: NPL_TEAMS[name]?.color,
    };
  });

  rows.sort((a, b) => b.pts - a.pts || b.w - a.w || a.l - b.l);
  rows.forEach((r, idx) => { r.rank = idx + 1; });
  return rows;
}

export const GET: APIRoute = async ({ request }) => {
  const corsHeaders = getSafeCorsHeaders(request);
  const now = Date.now();

  if (cachedStandings && now - lastFetchTime < 60000) {
    return new Response(JSON.stringify(cachedStandings), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
        ...corsHeaders,
      },
    });
  }

  let standings = await scrapeOfficialStandings();
  if (!standings || standings.length === 0) {
    standings = computeStandingsFromFixtures();
  }

  cachedStandings = standings;
  lastFetchTime = now;

  return new Response(JSON.stringify(standings), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
      ...corsHeaders,
    },
  });
};
