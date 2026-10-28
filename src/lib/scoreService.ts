/**
 * Real-time Ground Scorer Event Engine (CREX / Goscorer Engine)
 * Extracts real-time ball-by-ball match moments: 4s, 6s, Wickets, Wides, No Balls
 */

export interface BallMoment {
  over: number;
  delivery: number;
  code: string;
  ballId: string;
  teamScore?: string;
  type: 'FOUR' | 'SIX' | 'WICKET' | 'WIDE' | 'NO_BALL' | 'RUNS';
  title: string;
  message: string;
}

const seenBalls = new Set<string>();
let isInitialized = false;
let activeMatchUrl: string | null = null;
let lastDiscoveryTime = 0;

/**
 * 1. Dynamic Match Discovery
 * Resolves active NPL match URL from live tournament schedule
 */
export async function discoverActiveMatchUrl(): Promise<string | null> {
  const now = Date.now();
  if (activeMatchUrl && now - lastDiscoveryTime < 60000) {
    return activeMatchUrl;
  }

  try {
    const res = await fetch('https://crex.com/fixtures/match-list', {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return activeMatchUrl;
    const html = await res.text();
    const matchRegex = /"https:\/\/crex\.com\/cricket-live-score\/([^"]*(?:nepal|npl|pka|spr|ktg|cwr|btr|jkb|kry|lbl)[^"]*)"/gi;
    const matches = [...html.matchAll(matchRegex)].map((m) => m[0].replace(/"/g, ''));

    if (matches.length > 0) {
      activeMatchUrl = matches[0];
      lastDiscoveryTime = now;
      return activeMatchUrl;
    }
  } catch {}

  // Fallback to today's active match URL if discovery fails
  return 'https://crex.com/cricket-live-score/pka-vs-spr-4th-t20-nepal-premier-league-2026-match-updates-14EV';
}

/**
 * 2. Fetch and decode live scoring state from app-root-state
 */
export async function fetchLiveBallMoments(): Promise<{
  score: string;
  overs: string;
  moments: BallMoment[];
} | null> {
  const matchUrl = await discoverActiveMatchUrl();
  if (!matchUrl) return null;

  try {
    const res = await fetch(matchUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
      signal: AbortSignal.timeout(3500),
    });
    if (!res.ok) return null;
    const html = await res.text();

    const match = html.match(/<script id="app-root-state"[^>]*>([\s\S]*?)<\/script>/);
    if (!match) return null;

    const raw = match[1];
    const scoreMatch = raw.match(/&q;score1&q;:&q;([^&]+)&q;/);
    const overMatch = raw.match(/&q;over1&q;:&q;([^&]+)&q;/);
    const score = scoreMatch ? scoreMatch[1].replace('-', '/') : '';
    const overs = overMatch ? overMatch[1] : '';

    // Extract Recent Balls matrix (rb array)
    const rbIdx = raw.indexOf('&q;rb&q;:');
    if (rbIdx === -1) {
      return { score, overs, moments: [] };
    }

    const rbStart = raw.indexOf('[', rbIdx);
    let depth = 0;
    let rbEnd = rbStart;
    for (let i = rbStart; i < raw.length; i++) {
      if (raw[i] === '[') depth++;
      else if (raw[i] === ']') {
        depth--;
        if (depth === 0) {
          rbEnd = i + 1;
          break;
        }
      }
    }

    const rbJson = raw.substring(rbStart, rbEnd).replace(/&q;/g, '"');
    const rbList: Array<{
      o: number;
      ts?: string;
      b?: Array<{ d: number; u: string }>;
    }> = JSON.parse(rbJson);

    const newMoments: BallMoment[] = [];

    // First boot: mark all historical balls as seen
    if (!isInitialized) {
      for (const overObj of rbList) {
        if (!overObj.b) continue;
        for (const b of overObj.b) {
          const ballId = `${overObj.o}.${b.d}:${b.u}`;
          seenBalls.add(ballId);
        }
      }
      isInitialized = true;
      return { score, overs, moments: [] };
    }

    // Process new deliveries
    for (const overObj of rbList) {
      if (!overObj.b) continue;
      for (const b of overObj.b) {
        const resCode = (b.u || '').toLowerCase().trim();
        const ballId = `${overObj.o}.${b.d}:${resCode}`;

        if (seenBalls.has(ballId)) continue;
        seenBalls.add(ballId);

        const currentScore = overObj.ts || score;

        // Map Ball Code to Match Moment
        if (resCode === '4') {
          newMoments.push({
            over: overObj.o,
            delivery: b.d,
            code: b.u,
            ballId,
            teamScore: currentScore,
            type: 'FOUR',
            title: '🏏 FOUR BOUNDARY! (4 Runs)',
            message: `Cracking boundary four! Score: ${currentScore} (${overObj.o}.${b.d} ov)`,
          });
        } else if (resCode === '6') {
          newMoments.push({
            over: overObj.o,
            delivery: b.d,
            code: b.u,
            ballId,
            teamScore: currentScore,
            type: 'SIX',
            title: '🚀 MAXIMUM SIX! (6 Runs)',
            message: `Smashed out of the park for SIX! Score: ${currentScore} (${overObj.o}.${b.d} ov)`,
          });
        } else if (resCode.includes('w') && !resCode.includes('wd')) {
          newMoments.push({
            over: overObj.o,
            delivery: b.d,
            code: b.u,
            ballId,
            teamScore: currentScore,
            type: 'WICKET',
            title: '💥 WICKET FALLEN!',
            message: `Wicket is down! Now ${currentScore} (${overObj.o}.${b.d} ov)`,
          });
        } else if (resCode.includes('wd')) {
          newMoments.push({
            over: overObj.o,
            delivery: b.d,
            code: b.u,
            ballId,
            teamScore: currentScore,
            type: 'WIDE',
            title: '⚠️ WIDE BALL (+1 Extra)',
            message: `Bowled wide down the leg side! Score: ${currentScore}`,
          });
        } else if (resCode.includes('nb')) {
          newMoments.push({
            over: overObj.o,
            delivery: b.d,
            code: b.u,
            ballId,
            teamScore: currentScore,
            type: 'NO_BALL',
            title: '🚨 NO BALL / FREE HIT!',
            message: `Overstepped! Next delivery is a FREE HIT! Score: ${currentScore}`,
          });
        }
      }
    }

    return { score, overs, moments: newMoments };
  } catch {
    return null;
  }
}

