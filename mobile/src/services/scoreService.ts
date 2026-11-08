import { notifyLiveMoment } from './notifications';
import { loadPreferences } from './storage';
import { fetchLiveDeskMoments } from './api';

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

/**
 * Polls live moments through the Sportivo backend API service.
 * Zero external scraping or direct upstream exposure on client devices.
 */
export async function pollCrexGroundScores(): Promise<void> {
  try {
    const prefs = await loadPreferences();
    if (!prefs.notifications.enabled || !prefs.notifications.notifyGoalsWickets) {
      return;
    }

    const payload = await fetchLiveDeskMoments();
    if (!payload) return;

    const { moments, recentBalls, score } = payload as any;

    // Initial boot: mark all historical deliveries as already seen
    if (!isInitialized) {
      if (Array.isArray(recentBalls)) {
        for (const rb of recentBalls) {
          const ballId = `${rb.over}.${rb.delivery}:${(rb.code || '').toLowerCase().trim()}`;
          seenBalls.add(ballId);
        }
      }
      if (Array.isArray(moments)) {
        for (const m of moments) {
          if (m.ballId) seenBalls.add(m.ballId);
        }
      }
      isInitialized = true;
      return;
    }

    // Process new live moments received from backend
    if (Array.isArray(moments) && moments.length > 0) {
      for (const m of moments) {
        if (!m.ballId || seenBalls.has(m.ballId)) continue;
        seenBalls.add(m.ballId);

        await notifyLiveMoment({
          key: m.ballId,
          title: m.title || '🏏 Match Moment',
          body: m.message || `Score: ${score || ''}`,
          type: m.type === 'WICKET' ? 'wicket' : 'boundary',
        });
      }
    }
  } catch (err) {
    console.warn('[ScoreService] Poller notice:', err);
  }
}

/**
 * Starts continuous 3.5s background polling for live match moments via backend
 */
export function startGroundScorePoller(): () => void {
  if (pollerInterval) {
    clearInterval(pollerInterval);
  }

  // Initial poll
  pollCrexGroundScores();

  // 4 second interval matching backend update cycle
  pollerInterval = setInterval(() => {
    pollCrexGroundScores();
  }, 4000);

  return () => {
    if (pollerInterval) {
      clearInterval(pollerInterval);
      pollerInterval = null;
    }
  };
}
