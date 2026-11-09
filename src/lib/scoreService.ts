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

/**
 * Thoroughly sanitizes and cleans raw commentary strings from cricket feeds.
 * Eliminates:
 * - Mojibake UTF-8 decoding artifacts (â€¢ -> •, â€“ -> –, â€™ -> ', â€œ/â€  -> ")
 * - Pseudo-HTML tags (&l;b&g;, &l;/b&g;, &l;i&g;, &l;span&g;, etc.)
 * - Standard HTML tags (<b>, <span>, etc.)
 * - Provider shorthand entities (&s; -> ', &bull; -> •, &quot;, &apos;, &amp;)
 * - Redundant whitespace
 */
export function cleanCricketText(raw: string | undefined | null): string {
  if (!raw || typeof raw !== 'string') return '';
  let str = raw;

  // 1. Fix UTF-8 / Windows-1252 mojibake artifacts
  str = str
    .replace(/â€¢/g, '•')
    .replace(/â€“/g, '–')
    .replace(/â€”/g, '—')
    .replace(/â€™/g, "'")
    .replace(/â€˜/g, "'")
    .replace(/â€œ/g, '"')
    .replace(/â€ /g, '"')
    .replace(/â€/g, '"')
    .replace(/Ã©/g, 'é')
    .replace(/Ã¡/g, 'á')
    .replace(/Â·/g, '·')
    .replace(/Â/g, '');

  // 2. Strip pseudo-HTML tags like &l;b&g;, &l;/b&g;, &l;span&g;, &l;/span&g;
  str = str.replace(/&l;\/?[a-z0-9_-]+[^&]*&g;/gi, '');
  str = str.replace(/&l;[^&]*&g;/gi, '');

  // 3. Strip standard HTML tags
  str = str.replace(/<\/?[a-z0-9_-]+[^>]*>/gi, '');

  // 4. Decode common HTML and cricket shorthand entities
  str = str
    .replace(/&s;/gi, "'")
    .replace(/&bull;/gi, '•')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&apos;/gi, "'")
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&mdash;/gi, '—')
    .replace(/&ndash;/gi, '–');

  // 5. Clean any lingering &l; or &g; or unresolved &...; entities
  str = str.replace(/&[lg];/gi, '').replace(/&[a-z0-9#]+;/gi, '');

  // 6. Normalize whitespace
  return str.replace(/\s+/g, ' ').trim();
}

export interface LiveBatter {
  name: string;
  isOnStrike: boolean;
  runs: string;
  balls: string;
  fours: string;
  sixes: string;
  strikeRate?: string;
}

export interface LiveBowler {
  name: string;
  figures: string;
  overs?: string;
  economy?: string;
}

export interface LiveMatchHeader {
  matchNumber?: string;
  matchTitle?: string;
  venue?: string;
  tossNote?: string;
  team1Short?: string;
  team1Name?: string;
  team1Score?: string;
  team1Overs?: string;
  team2Short?: string;
  team2Name?: string;
  team2Score?: string;
  team2Overs?: string;
  activeTeam?: 1 | 2;
  target?: string;
  crr?: string;
  rrr?: string;
}

export interface LiveScorerPayload {
  score: string;
  overs: string;
  crr?: string;
  rrr?: string;
  target?: string;
  header?: LiveMatchHeader;
  batters?: LiveBatter[];
  bowler?: LiveBowler;
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
    const feedsKey = Object.keys(state).find((k) => k.includes('getBallFeeds'));
    const feeds = feedsKey && Array.isArray(state[feedsKey]) ? state[feedsKey] : [];

    const score = (sv3.score1 || '').replace('-', '/');
    const overs = sv3.over1 || '';
    const crr = sv3.crr || '';

    // Extract structured commentary from getBallFeeds (handling all versions v1/v2/v3)
    const commentary: CommentaryLine[] = [];
    if (Array.isArray(feeds)) {
      for (const item of feeds) {
        if (!item) continue;
        if (item.type === 'b' && item.o) {
          const resCode = (item.b || '').trim();
          const lowerCode = resCode.toLowerCase();
          const rawC2 = item.c2 || '';
          const lowerC2 = rawC2.toLowerCase();

          const isFour = lowerCode === '4' || (lowerC2.includes('four') && !lowerC2.includes('four balls'));
          const isSix = lowerCode === '6' || lowerC2.includes('six');
          const isWkt =
            lowerCode === 'w' ||
            (lowerCode.includes('w') && !lowerCode.includes('wd') && !lowerCode.includes('wide')) ||
            (/\b(out|bowled|caught|lbw|stumped|run out)\b/i.test(lowerC2) && !lowerC2.includes('not out'));
          const cleanText = cleanCricketText(rawC2);
          const cleanBowler = cleanCricketText(item.c1 || '');

          commentary.push({
            ball: String(item.o),
            bowlerToBatsman: cleanBowler,
            text: cleanText,
            outcome: isSix ? '6' : isFour ? '4' : isWkt ? 'W' : resCode,
            isBoundary: isFour || isSix,
            isWicket: isWkt,
          });
        } else if (item.type === 't' && (item.c || item.tsl)) {
          commentary.push({
            ball: 'Info',
            bowlerToBatsman: 'Match Update',
            text: cleanCricketText(item.c || item.tsl),
          });
        } else if (item.type === 'o') {
          commentary.push({
            ball: `Ov ${item.o || ''}`,
            bowlerToBatsman: cleanCricketText(item.bowler || 'End of Over'),
            text: cleanCricketText(item.tsl || `${item.runs || 0} runs off the over`),
            outcome: `${item.runs || 0}r`,
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

    // Extract dynamic match metadata, batters, and bowler for the comprehensive broadcast scoreboard
    const matchMetaKey = Object.keys(state).find((k) => k.startsWith('match-'));
    const matchMeta = matchMetaKey ? state[matchMetaKey] : null;

    const batters: LiveBatter[] = [];
    if (sv3.player_full_name1 || sv3.pname1) {
      batters.push({
        name: cleanCricketText(sv3.player_full_name1 || sv3.pname1 || ''),
        isOnStrike: sv3.os1 === 1,
        runs: String(sv3.run1 || '0'),
        balls: String(sv3.ball1 || '0').replace(/[()]/g, ''),
        fours: String(sv3.four1 || '0'),
        sixes: String(sv3.six1 || '0'),
        strikeRate: String(sv3.sr1 || ''),
      });
    }
    if (sv3.player_full_name2 || sv3.pname2) {
      batters.push({
        name: cleanCricketText(sv3.player_full_name2 || sv3.pname2 || ''),
        isOnStrike: sv3.os2 === 1,
        runs: String(sv3.run2 || '0'),
        balls: String(sv3.ball2 || '0').replace(/[()]/g, ''),
        fours: String(sv3.four2 || '0'),
        sixes: String(sv3.six2 || '0'),
        strikeRate: String(sv3.sr2 || ''),
      });
    }

    let bowler: LiveBowler | undefined;
    if (sv3.bowler_full_name || sv3.bname) {
      bowler = {
        name: cleanCricketText(sv3.bowler_full_name || sv3.bname || ''),
        figures: sv3.bwr || '',
        overs: sv3.bover ? String(sv3.bover).replace(/[()]/g, '') : '',
        economy: sv3.beco ? String(sv3.beco) : '',
      };
    }

    const matchNumber = String(sv3.mn || matchMeta?.mn || '19');
    const venue = String(
      matchMeta?.v || sv3.v || 'TU International Cricket Ground, Kirtipur'
    );
    const tossNote = cleanCricketText(sv3.comment1 || '');

    const currentInning = Number(sv3.inning || 1);
    const team1Short = sv3.team1short || sv3.team1 || 'PKA';
    const team1Name = sv3.team1_f_n || 'Pokhara Avengers';
    const team1Score = score || (sv3.score1 ? String(sv3.score1).replace('-', '/') : '');
    const team1Overs = overs ? `${overs} ov` : (sv3.over1 ? `${sv3.over1} ov` : '');

    const team2Short = sv3.team2short || sv3.team2 || 'KNY';
    const team2Name = sv3.team2_f_n || 'Karnali Yaks';
    const team2Score = sv3.score2
      ? String(sv3.score2).replace('-', '/')
      : currentInning === 1
      ? 'Yet to Bat'
      : '';
    const team2Overs = sv3.over2 ? `${sv3.over2} ov` : '';

    let target = '';
    if (currentInning >= 2 && team1Score) {
      const runsMatch = team1Score.match(/^(\d+)/);
      if (runsMatch) {
        target = `Target ${parseInt(runsMatch[1], 10) + 1}`;
      }
    }

    const header: LiveMatchHeader = {
      matchNumber,
      matchTitle: `Match ${matchNumber} • NPL 2026`,
      venue,
      tossNote,
      team1Short,
      team1Name,
      team1Score,
      team1Overs,
      team2Short,
      team2Name,
      team2Score,
      team2Overs,
      activeTeam: (currentInning === 2 ? 2 : 1) as 1 | 2,
      target,
      crr: sv3.crr || crr,
      rrr: sv3.rrr || '--',
    };

    return {
      score,
      overs,
      crr,
      rrr: sv3.rrr || '--',
      target,
      header,
      batters,
      bowler,
      moments: newMoments,
      recentBalls,
      commentary,
    };
  } catch {
    return null;
  }
}
