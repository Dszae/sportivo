import { notifyLiveMoment } from './notifications';
import { loadPreferences } from './storage';

export interface BallMoment {
  over: number;
  delivery: number;
  code: string;
  ballId: string;
  teamScore?: string;
  type: 'FOUR' | 'SIX' | 'WICKET' | 'WIDE' | 'NO_BALL' | 'RUNS';
  title: string;
  body: string;
}

const seenBalls = new Set<string>();
let isInitialized = false;
let pollerInterval: any = null;
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

  return 'https://crex.com/cricket-live-score/pka-vs-spr-4th-t20-nepal-premier-league-2026-match-updates-14EV';
}

/**
 * 2. Scrapes and decodes the live scoring state from app-root-state JSON
 */
export async function pollCrexGroundScores(): Promise<void> {
  try {
    const prefs = await loadPreferences();
    if (!prefs.notifications.enabled || !prefs.notifications.notifyGoalsWickets) {
      return;
    }

    const matchUrl = await discoverActiveMatchUrl();
    if (!matchUrl) return;

    const res = await fetch(matchUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
    });
    if (!res.ok) return;

    const html = await res.text();
    const scriptMatch = html.match(/<script id="app-root-state"[^>]*>([\s\S]*?)<\/script>/);
    if (!scriptMatch) return;

    const jsonStr = scriptMatch[1].replace(/&q;/g, '"');
    const state = JSON.parse(jsonStr);
    const sv3 = state['https://api.goscorer.com/api/v3/getSV3'] || {};

    const score = (sv3.score1 || '').replace('-', '/');
    const overs = sv3.over1 || '';
    const rbList: Array<{
      o: number;
      ts?: string;
      b?: Array<{ d: number; u: string }>;
    }> = Array.isArray(sv3.rb) ? sv3.rb : [];

    // Initial boot: mark all historical balls as already seen
    if (!isInitialized) {
      for (const overObj of rbList) {
        if (!overObj.b) continue;
        for (const b of overObj.b) {
          const ballId = `${overObj.o}.${b.d}:${(b.u || '').toLowerCase().trim()}`;
          seenBalls.add(ballId);
        }
      }
      isInitialized = true;
      return;
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

        if (resCode === '4') {
          await notifyLiveMoment({
            key: ballId,
            title: '🏏 FOUR BOUNDARY! (4 Runs)',
            body: `Boundary four! Score: ${currentScore} (${overObj.o}.${b.d} ov)`,
            type: 'boundary',
          });
        } else if (resCode === '6') {
          await notifyLiveMoment({
            key: ballId,
            title: '🚀 MAXIMUM SIX! (6 Runs)',
            body: `Huge SIX over the ropes! Score: ${currentScore} (${overObj.o}.${b.d} ov)`,
            type: 'boundary',
          });
        } else if (resCode.includes('w') && !resCode.includes('wd')) {
          await notifyLiveMoment({
            key: ballId,
            title: '💥 WICKET FALLEN!',
            body: `Wicket down! Now ${currentScore} (${overObj.o}.${b.d} ov)`,
            type: 'wicket',
          });
        } else if (resCode.includes('wd')) {
          await notifyLiveMoment({
            key: ballId,
            title: '⚠️ WIDE BALL (+1 Extra)',
            body: `Wide delivery bowled! Score: ${currentScore}`,
            type: 'boundary',
          });
        } else if (resCode.includes('nb')) {
          await notifyLiveMoment({
            key: ballId,
            title: '🚨 NO BALL / FREE HIT!',
            body: `Overstepped! Next delivery is a FREE HIT! Score: ${currentScore}`,
            type: 'boundary',
          });
        }
      }
    }
  } catch (err) {
    console.warn('[ScoreService] Poller error:', err);
  }
}

/**
 * Starts continuous 3.5s background polling for live match moments
 */
export function startGroundScorePoller(): () => void {
  if (pollerInterval) {
    clearInterval(pollerInterval);
  }

  // Initial poll
  pollCrexGroundScores();

  // 3.5 second interval matching ground scorer refresh rate
  pollerInterval = setInterval(() => {
    pollCrexGroundScores();
  }, 3500);

  return () => {
    if (pollerInterval) {
      clearInterval(pollerInterval);
      pollerInterval = null;
    }
  };
}
