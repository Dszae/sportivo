import type { APIRoute } from 'astro';
import { fetchMatches, type Match, titleOf, slugify, statusOf, getMatchTimestamp } from '../../../lib/sportivo';
import { NPL_FIXTURES_2026 } from '../../../lib/data/nplData';
import { broadcastMatchPush, getAllSubscriptions } from '../../../lib/pushServer';

export const prerender = false;

// In-memory record of dispatched alerts to prevent duplicate push notifications
const dispatchedAlertsCache = new Map<string, number>();

function isAlreadyDispatched(key: string): boolean {
  const ts = dispatchedAlertsCache.get(key);
  if (!ts) return false;
  // Expire after 12 hours
  if (Date.now() - ts > 12 * 3600 * 1000) {
    dispatchedAlertsCache.delete(key);
    return false;
  }
  return true;
}

function markDispatched(key: string): void {
  dispatchedAlertsCache.set(key, Date.now());
}

export const GET: APIRoute = async () => {
  const subscribers = getAllSubscriptions();
  if (subscribers.length === 0) {
    return new Response(
      JSON.stringify({ status: 'ok', subscribers: 0, dispatched: 0 }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const now = Date.now();
  let totalDispatched = 0;

  try {
    // 1. Fetch live and upcoming fixtures from all sports
    const [footballMatches, cricketMatches, basketballMatches] = await Promise.all([
      fetchMatches('football').catch(() => [] as Match[]),
      fetchMatches('cricket').catch(() => [] as Match[]),
      fetchMatches('basketball').catch(() => [] as Match[]),
    ]);

    const allSports: { list: Match[]; category: string }[] = [
      { list: footballMatches, category: 'football' },
      { list: cricketMatches, category: 'cricket' },
      { list: basketballMatches, category: 'basketball' },
    ];

    // Evaluate standard sports matches
    for (const { list, category } of allSports) {
      for (const match of list) {
        const title = titleOf(match);
        const slug = slugify(title);
        const status = statusOf(match);
        const matchTime = getMatchTimestamp(match);

        if (status === 'Final') continue;

        // Kickoff time reminders (Upcoming matches)
        if (matchTime && matchTime > now) {
          const diffMinutes = Math.round((matchTime - now) / 60000);

          // 5-Minute Warning (window: 2 to 7 minutes before start)
          if (diffMinutes >= 2 && diffMinutes <= 7) {
            const key = `push:5m:${slug}:${Math.floor(matchTime / 3600000)}`;
            if (!isAlreadyDispatched(key)) {
              markDispatched(key);
              const sent = await broadcastMatchPush({
                key,
                type: '5min_warning',
                title: '🔔 Kickoff in 5 Minutes!',
                message: `${title} is about to begin! Get ready to watch live.`,
                matchTitle: title,
                matchUrl: `/${category}/match/${encodeURIComponent(slug)}/`,
                category,
                slug,
              });
              totalDispatched += sent;
            }
          }

          // 30-Minute Reminder (window: 27 to 33 minutes before start)
          if (diffMinutes >= 27 && diffMinutes <= 33) {
            const key = `push:30m:${slug}:${Math.floor(matchTime / 3600000)}`;
            if (!isAlreadyDispatched(key)) {
              markDispatched(key);
              const sent = await broadcastMatchPush({
                key,
                type: '30min_warning',
                title: '⚽ Matchday Reminder (30m)',
                message: `${title} kicks off in 30 minutes!`,
                matchTitle: title,
                matchUrl: `/${category}/match/${encodeURIComponent(slug)}/`,
                category,
                slug,
              });
              totalDispatched += sent;
            }
          }
        }

        // Live kickoff alert
        if (status === 'Live' && matchTime) {
          const sinceStartMin = Math.round((now - matchTime) / 60000);
          if (sinceStartMin >= 0 && sinceStartMin <= 6) {
            const key = `push:kickoff:${slug}:${Math.floor(matchTime / 3600000)}`;
            if (!isAlreadyDispatched(key)) {
              markDispatched(key);
              const sent = await broadcastMatchPush({
                key,
                type: 'kickoff',
                title: '🟢 Match Started!',
                message: `${title} is now LIVE! Stream is active.`,
                matchTitle: title,
                matchUrl: `/${category}/match/${encodeURIComponent(slug)}/`,
                category,
                slug,
              });
              totalDispatched += sent;
            }
          }
        }
      }
    }

    // 2. Evaluate NPL 2026 Fixtures
    for (const fixture of NPL_FIXTURES_2026) {
      if (fixture.status === 'COMPLETED') continue;

      const title = `${fixture.homeTeam} vs ${fixture.awayTeam}`;
      const slug = `npl-match-${fixture.matchNumber}`;
      const kickoffTime = fixture.timestamp || (fixture.startTime ? new Date(fixture.startTime).getTime() : 0);

      if (kickoffTime && kickoffTime > now) {
        const diffMinutes = Math.round((kickoffTime - now) / 60000);

        // 5-Minute Warning
        if (diffMinutes >= 2 && diffMinutes <= 7) {
          const key = `push:5m:${slug}:${Math.floor(kickoffTime / 3600000)}`;
          if (!isAlreadyDispatched(key)) {
            markDispatched(key);
            const sent = await broadcastMatchPush({
              key,
              type: '5min_warning',
              title: '🔔 NPL Kickoff in 5 Minutes!',
              message: `${fixture.homeTeam} 🆚 ${fixture.awayTeam} · Match ${fixture.matchNumber} at TU Cricket Ground!`,
              matchTitle: title,
              matchUrl: `/npl/`,
              category: 'cricket',
              slug,
              teams: [fixture.homeTeam, fixture.awayTeam],
            });
            totalDispatched += sent;
          }
        }

        // 30-Minute Reminder
        if (diffMinutes >= 27 && diffMinutes <= 33) {
          const key = `push:30m:${slug}:${Math.floor(kickoffTime / 3600000)}`;
          if (!isAlreadyDispatched(key)) {
            markDispatched(key);
            const sent = await broadcastMatchPush({
              key,
              type: '30min_warning',
              title: '🏏 NPL Match Reminder (30m)',
              message: `${fixture.homeTeam} vs ${fixture.awayTeam} begins in 30 minutes at ${fixture.venue}!`,
              matchTitle: title,
              matchUrl: `/npl/`,
              category: 'cricket',
              slug,
              teams: [fixture.homeTeam, fixture.awayTeam],
            });
            totalDispatched += sent;
          }
        }
      }
    }

    return new Response(
      JSON.stringify({
        status: 'ok',
        subscribers: subscribers.length,
        dispatched: totalDispatched,
        timestamp: new Date().toISOString(),
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error?.message || 'Error processing alerts' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

