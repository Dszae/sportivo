import { fetchNplFixtures } from './api';
import { notifyLiveMoment } from './notifications';
import { loadPreferences } from './storage';

interface MatchStateCache {
  wicketsHome?: number;
  runsHome?: number;
  oversHome?: string;
  wicketsAway?: number;
  runsAway?: number;
  oversAway?: string;
  isNotifiedStart?: boolean;
}

const matchStates: Record<string, MatchStateCache> = {};
let pollerInterval: any = null;

/**
 * Parses cricket score string like "88/5 (13 ov)" or "145/2 (18.4)"
 */
function parseCricketScore(scoreStr?: string): { runs: number; wickets: number; overs: string } | null {
  if (!scoreStr) return null;
  const match = scoreStr.match(/^(\d+)\s*\/\s*(\d+)\s*(?:\(([\d.]+)(?:\s*ov)?\))?/i);
  if (!match) return null;
  return {
    runs: parseInt(match[1], 10),
    wickets: parseInt(match[2], 10),
    overs: match[3] || '',
  };
}

/**
 * Checks active live NPL fixtures for real-time key moments:
 * - Wickets (1st wicket, 2nd, etc.)
 * - Sixes & Fours
 * - Score Milestones (50, 100 runs)
 */
export async function checkLiveMatchMoments(): Promise<void> {
  try {
    const prefs = await loadPreferences();
    if (!prefs.notifications.enabled || !prefs.notifications.notifyGoalsWickets) {
      return;
    }

    const fixtures = await fetchNplFixtures();
    const liveMatches = fixtures.filter((f) => f.status === 'LIVE' || f.id === 'npl26-04');

    for (const match of liveMatches) {
      const matchId = match.id;
      const title = `${match.homeTeam} vs ${match.awayTeam}`;
      const state = matchStates[matchId] || {};

      // Check both home and away scores depending on who is batting
      const activeScore = match.awayScore || match.homeScore;
      const battingTeam = match.awayScore ? match.awayTeam : match.homeTeam;
      const isAway = Boolean(match.awayScore);

      const parsed = parseCricketScore(activeScore);
      if (!parsed) continue;

      const { runs, wickets, overs } = parsed;
      const lastWickets = isAway ? state.wicketsAway : state.wicketsHome;
      const lastRuns = isAway ? state.runsAway : state.runsHome;

      // Initial state alert if newly opened during live match
      if (typeof lastWickets !== 'number') {
        await notifyLiveMoment({
          key: `live-desk-${matchId}`,
          title: `🏏 Live: ${battingTeam} ${runs}/${wickets} (${overs} ov)`,
          body: `${title} is live! Live score and low-latency stream connected.`,
          type: 'kickoff',
        });
      }

      // 1. Wickets Detection
      if (typeof lastWickets === 'number' && wickets > lastWickets) {
        await notifyLiveMoment({
          key: `wicket-${matchId}-${battingTeam}-${wickets}`,
          title: `🏏 WICKET! (${battingTeam})`,
          body: `${battingTeam} loses wicket #${wickets}! Now ${runs}/${wickets} (${overs} ov) in ${title}.`,
          type: 'wicket',
        });
      }

      // 2. Boundaries & Sixes Detection
      if (typeof lastRuns === 'number' && runs > lastRuns) {
        const diff = runs - lastRuns;
        if (diff === 6) {
          await notifyLiveMoment({
            key: `six-${matchId}-${battingTeam}-${runs}-${overs}`,
            title: `💥 MAXIMUM SIX! (${battingTeam})`,
            body: `${battingTeam} smashes a huge SIX! Score: ${runs}/${wickets} (${overs} ov)`,
            type: 'boundary',
          });
        } else if (diff === 4) {
          await notifyLiveMoment({
            key: `four-${matchId}-${battingTeam}-${runs}-${overs}`,
            title: `🏏 FOUR BOUNDARY! (${battingTeam})`,
            body: `${battingTeam} hits a cracking FOUR! Score: ${runs}/${wickets} (${overs} ov)`,
            type: 'boundary',
          });
        } else if (diff > 4) {
          await notifyLiveMoment({
            key: `runs-${matchId}-${battingTeam}-${runs}-${overs}`,
            title: `🏏 BIG OVER! +${diff} Runs (${battingTeam})`,
            body: `${battingTeam} accelerates! Now ${runs}/${wickets} (${overs} ov)`,
            type: 'boundary',
          });
        }
      }

      // 3. Score Milestones (50, 100, 150, 200)
      if (typeof lastRuns === 'number') {
        const milestones = [50, 100, 150, 200];
        for (const ms of milestones) {
          if (lastRuns < ms && runs >= ms) {
            await notifyLiveMoment({
              key: `milestone-${matchId}-${battingTeam}-${ms}`,
              title: `🎯 ${ms} RUNS MILESTONE! (${battingTeam})`,
              body: `${battingTeam} crosses the ${ms}-run mark! Now ${runs}/${wickets} (${overs} ov)`,
              type: 'milestone',
            });
          }
        }
      }

      // Update in-memory state
      matchStates[matchId] = {
        ...state,
        ...(isAway
          ? { wicketsAway: wickets, runsAway: runs, oversAway: overs }
          : { wicketsHome: wickets, runsHome: runs, oversHome: overs }),
      };
    }
  } catch (e) {
    console.warn('[MatchMomentService] Error checking live moments:', e);
  }
}

/**
 * Starts continuous background polling for live match moments
 */
export function startLiveMomentPoller(intervalMs: number = 12000): () => void {
  if (pollerInterval) {
    clearInterval(pollerInterval);
  }

  // Initial check
  checkLiveMatchMoments();

  pollerInterval = setInterval(() => {
    checkLiveMatchMoments();
  }, intervalMs);

  return () => {
    if (pollerInterval) {
      clearInterval(pollerInterval);
      pollerInterval = null;
    }
  };
}
