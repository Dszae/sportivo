/**
 * Real-time Ground Scorer Event Engine (CREX / Goscorer Engine)
 * Extracts real-time ball-by-ball match moments: 4s, 6s, Wickets, Wides, No Balls,
 * along with detailed live ball commentary and over history.
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

export interface RecentBall {
  over: number;
  delivery: number;
  code: string;
  teamScore?: string;
  isBoundary: boolean;
  isWicket: boolean;
  isExtra: boolean;
}

export interface CommentaryLine {
  ball: string;
  bowlerToBatsman: string;
  text: string;
  outcome?: string;
  isBoundary?: boolean;
  isWicket?: boolean;
}

export interface LiveScorerPayload {
  score: string;
  overs: string;
  crr?: string;
  moments: BallMoment[];
  recentBalls: RecentBall[];
  commentary: CommentaryLine[];
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
 * 2. Fetch and decode live scoring state from app-root-state JSON
 */
export async function fetchLiveBallMoments(): Promise<LiveScorerPayload | null> {
  const matchUrl = await discoverActiveMatchUrl();
  if (!matchUrl) return null;

  try {
    const res = await fetch(matchUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
      signal: AbortSignal.timeout(3500),
    });
    if (!res.ok) return null;
    const html = await res.text();

    const scriptMatch = html.match(/<script id="app-root-state"[^>]*>([\s\S]*?)<\/script>/);
    if (!scriptMatch) return null;

    const jsonStr = scriptMatch[1].replace(/&q;/g, '"');
    const state = JSON.parse(jsonStr);

    const sv3 = state['https://api.goscorer.com/api/v3/getSV3'] || {};
    const feeds = state['https://content.crickapi.com/commentary/v2/getBallFeeds'] || [];

    const score = (sv3.score1 || '').replace('-', '/');
    const overs = sv3.over1 || '';
    const crr = sv3.crr || '';

    // Extract structured commentary from getBallFeeds
    const commentary: CommentaryLine[] = [];
    if (Array.isArray(feeds)) {
      for (const item of feeds) {
        if (!item) continue;
        if (item.type === 'b' && item.o) {
          const resCode = item.b || '';
          const isFour = resCode === '4' || (item.c2 || '').toLowerCase().includes('four');
          const isSix = resCode === '6' || (item.c2 || '').toLowerCase().includes('six');
          const isWkt = resCode.toLowerCase().includes('w') || (item.c2 || '').toLowerCase().includes('wicket');
          const cleanText = (item.c2 || '')
            .replace(/&[lg]t;/g, '')
            .replace(/<\/?b>/g, '')
            .trim();

          commentary.push({
            ball: String(item.o),
            bowlerToBatsman: item.c1 || '',
            text: cleanText,
            outcome: isSix ? '6' : isFour ? '4' : isWkt ? 'W' : resCode,
            isBoundary: isFour || isSix,
            isWicket: isWkt,
          });
        } else if (item.type === 't' && item.c) {
          commentary.push({
            ball: 'Info',
            bowlerToBatsman: 'Match Update',
            text: item.c,
          });
        }
      }
    }

    // Extract recent balls from getSV3.rb
    const recentBalls: RecentBall[] = [];
    const newMoments: BallMoment[] = [];
    const rbList: Array<{
      o: number;
      ts?: string;
      b?: Array<{ d: number; u: string }>;
    }> = Array.isArray(sv3.rb) ? sv3.rb : [];

    for (const overObj of rbList) {
      if (!overObj.b) continue;
      for (const b of overObj.b) {
        const resCode = (b.u || '').trim();
        const lowerCode = resCode.toLowerCase();
        const isBoundary = lowerCode === '4' || lowerCode === '6';
        const isWkt = lowerCode.includes('w') && !lowerCode.includes('wd');
        const isExt = lowerCode.includes('wd') || lowerCode.includes('nb') || lowerCode.includes('by') || lowerCode.includes('lb');

        recentBalls.push({
          over: overObj.o,
          delivery: b.d,
          code: resCode,
          teamScore: overObj.ts,
          isBoundary,
          isWicket: isWkt,
          isExtra: isExt,
        });

        const ballId = `${overObj.o}.${b.d}:${resCode}`;
        const currentScore = overObj.ts || score;

        // Build moment item
        let momentItem: BallMoment | null = null;
        if (lowerCode === '4') {
          momentItem = {
            over: overObj.o,
            delivery: b.d,
            code: b.u,
            ballId,
            teamScore: currentScore,
            type: 'FOUR',
            title: '🏏 FOUR BOUNDARY! (4 Runs)',
            message: `Cracking boundary four! Score: ${currentScore} (${overObj.o}.${b.d} ov)`,
          };
        } else if (lowerCode === '6') {
          momentItem = {
            over: overObj.o,
            delivery: b.d,
            code: b.u,
            ballId,
            teamScore: currentScore,
            type: 'SIX',
            title: '🚀 MAXIMUM SIX! (6 Runs)',
            message: `Smashed out of the park for SIX! Score: ${currentScore} (${overObj.o}.${b.d} ov)`,
          };
        } else if (isWkt) {
          momentItem = {
            over: overObj.o,
            delivery: b.d,
            code: b.u,
            ballId,
            teamScore: currentScore,
            type: 'WICKET',
            title: '💥 WICKET FALLEN!',
            message: `Wicket is down! Now ${currentScore} (${overObj.o}.${b.d} ov)`,
          };
        } else if (lowerCode.includes('wd')) {
          momentItem = {
            over: overObj.o,
            delivery: b.d,
            code: b.u,
            ballId,
            teamScore: currentScore,
            type: 'WIDE',
            title: '⚠️ WIDE BALL (+1 Extra)',
            message: `Bowled wide down the leg side! Score: ${currentScore}`,
          };
        } else if (lowerCode.includes('nb')) {
          momentItem = {
            over: overObj.o,
            delivery: b.d,
            code: b.u,
            ballId,
            teamScore: currentScore,
            type: 'NO_BALL',
            title: '🚨 NO BALL / FREE HIT!',
            message: `Overstepped! Next delivery is a FREE HIT! Score: ${currentScore}`,
          };
        }

        if (momentItem) {
          if (!seenBalls.has(ballId)) {
            newMoments.push(momentItem);
            seenBalls.add(ballId);
          }
        }
      }
    }

    // On cold boot: if newMoments contains all history, keep the latest 5 key moments so clients
    // immediately have populated data in Notification Center without flooding
    if (!isInitialized) {
      isInitialized = true;
      if (newMoments.length > 5) {
        newMoments.splice(0, newMoments.length - 5);
      }
    }

    return {
      score,
      overs,
      crr,
      moments: newMoments,
      recentBalls,
      commentary,
    };
  } catch {
    return null;
  }
}
