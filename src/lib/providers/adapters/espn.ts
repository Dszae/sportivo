import type { Category, NormalizedMatch, PlaybackResolution, ProviderAdapter } from '../types';
import { logDiagnostic } from '../diagnostics';

// StreamFree stream key for a fixture, e.g. "Ghana" + "England" -> "ghana-vs-england".
// Keeps Unicode letters because StreamFree keys do too ("belgium-vs-türkiye").
function streamKeyFor(home: string, away: string): string {
  const clean = (s: string) =>
    s
      .toLowerCase()
      .trim()
      .replace(/[^\p{L}\p{N}\s-]/gu, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-+|-+$/g, '');
  return `${clean(home)}-vs-${clean(away)}`;
}

// Today and tomorrow (UTC). Without a date ESPN returns the last finished matchday only.
function scoreboardDates(): string[] {
  const dayKey = (offsetDays: number) => {
    const d = new Date(Date.now() + offsetDays * 86400000);
    return `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}${String(d.getUTCDate()).padStart(2, '0')}`;
  };
  return [dayKey(0), dayKey(1)];
}

const BASKETBALL_LEAGUES: { path: string; idPrefix: string; label: string }[] = [
  { path: 'nba', idPrefix: 'espn-nba', label: 'NBA' },
  { path: 'mens-college-basketball', idPrefix: 'espn-ncaab', label: "NCAA Men's Basketball" },
];

export class EspnAdapter implements ProviderAdapter {
  readonly name = 'espn';
  readonly isAuthorized = true; // Free, public, unauthenticated scoreboard API
  readonly statusClassification = 'verified' as const;

  async fetchMatches(category: Category, signal?: AbortSignal): Promise<NormalizedMatch[]> {
    const startTime = Date.now();
    const timeoutSignal = AbortSignal.timeout(3500);
    const effectiveSignal = signal ? AbortSignal.any([signal, timeoutSignal]) : timeoutSignal;
    const matches: NormalizedMatch[] = [];

    try {
      if (category === 'basketball') {
        const dates = scoreboardDates();
        const fetches = await Promise.allSettled(
          BASKETBALL_LEAGUES.flatMap((league) =>
            dates.map(async (date) => {
              const res = await fetch(
                `https://site.api.espn.com/apis/site/v2/sports/basketball/${league.path}/scoreboard?dates=${date}`,
                { signal: effectiveSignal }
              );
              if (!res.ok) return null;
              return { data: (await res.json()) as any, league };
            })
          )
        );

        const seenEvents = new Set<string>();
        for (const resItem of fetches) {
          if (resItem.status !== 'fulfilled' || !resItem.value) continue;
          const { data, league } = resItem.value;
          for (const ev of data?.events || []) {
            if (matches.length >= 60) break;
            if (ev?.id) {
              if (seenEvents.has(String(ev.id))) continue;
              seenEvents.add(String(ev.id));
            }
            const comp = ev?.competitions?.[0];
            const competitors = comp?.competitors || [];
            const home = competitors.find((c: any) => c.homeAway === 'home');
            const away = competitors.find((c: any) => c.homeAway === 'away');
            const homeName = home?.team?.displayName || 'Home';
            const awayName = away?.team?.displayName || 'Away';

            const isLive = comp?.status?.type?.state === 'in';
            const isCompleted = comp?.status?.type?.state === 'post';
            // User requirement: Never ingest completed past matches ("remove those recent results")
            if (isCompleted) continue;

            // StreamFree keys use the same full team names ("new-york-knicks-vs-toronto-raptors"),
            // listed away-first or home-first, so offer both orders.
            const keyA = streamKeyFor(awayName, homeName);
            const keyB = streamKeyFor(homeName, awayName);

            matches.push({
              id: ev.id ? `${league.idPrefix}-${ev.id}` : keyA,
              title: `${awayName} vs ${homeName}`,
              category: 'basketball',
              competition: league.label,
              league: league.label,
              status: isLive ? 'Live' : 'Upcoming',
              date: ev.date ? new Date(ev.date).getTime() : undefined,
              poster: home?.team?.logo || away?.team?.logo || undefined,
              teams: {
                home: { name: homeName, badge: home?.team?.logo },
                away: { name: awayName, badge: away?.team?.logo },
              },
              sources: [
                { source: 'strmfree', id: keyA, label: 'StreamFree' },
                { source: 'strmfree', id: keyB, label: 'StreamFree (alt)' },
              ],
            });
          }
        }
      } else if (category === 'football') {
        const leagues = [
          'eng.1', // Premier League
          'esp.1', // La Liga
          'ger.1', // Bundesliga
          'ita.1', // Serie A
          'fra.1', // Ligue 1
          'uefa.champions', // Champions League
          'uefa.europa', // Europa League
          'afc.champions', // AFC Champions League
          // International windows (club leagues pause, so these are the only fixtures that week)
          'uefa.nations', // UEFA Nations League
          'fifa.friendly', // International friendlies
          'fifa.world', // FIFA World Cup
          'fifa.worldq.uefa', // World Cup qualifying (UEFA)
        ];

        const dates = scoreboardDates();

        const leagueFetches = await Promise.allSettled(
          leagues.flatMap((league) =>
            dates.map(async (date) => {
              const res = await fetch(
                `https://site.api.espn.com/apis/site/v2/sports/soccer/${league}/scoreboard?dates=${date}`,
                { signal: effectiveSignal }
              );
              if (!res.ok) return null;
              const data = (await res.json()) as any;
              return { data, league };
            })
          )
        );

        const seenEvents = new Set<string>();
        for (const resItem of leagueFetches) {
          if (resItem.status !== 'fulfilled' || !resItem.value) continue;
          const { data, league } = resItem.value;
          const events = data?.events || [];
          for (const ev of events) {
            if (matches.length >= 60) break;
            if (ev?.id) {
              if (seenEvents.has(String(ev.id))) continue;
              seenEvents.add(String(ev.id));
            }
            const comp = ev?.competitions?.[0];
            const competitors = comp?.competitors || [];
            const home = competitors.find((c: any) => c.homeAway === 'home');
            const away = competitors.find((c: any) => c.homeAway === 'away');
            const homeName = home?.team?.displayName || 'Home';
            const awayName = away?.team?.displayName || 'Away';
            const title = `${homeName} vs ${awayName}`;

            const isLive = comp?.status?.type?.state === 'in';
            const isCompleted = comp?.status?.type?.state === 'post';
            // User requirement: Never ingest completed past matches ("remove those recent results")
            if (isCompleted) continue;
            const status = isLive ? 'Live' : 'Upcoming';

            // Fixtures come from ESPN; the playable links come from StreamFree. StreamFree keys look
            // like "home-vs-away" (or the reverse order), so offer both as alternate servers.
            const keyA = streamKeyFor(homeName, awayName);
            const keyB = streamKeyFor(awayName, homeName);

            matches.push({
              id: ev.id ? `espn-soc-${ev.id}` : keyA,
              title,
              category: 'football',
              competition: data?.leagues?.[0]?.name || league.toUpperCase(),
              league: data?.leagues?.[0]?.name || league.toUpperCase(),
              status,
              date: ev.date ? new Date(ev.date).getTime() : undefined,
              poster: home?.team?.logo || away?.team?.logo || undefined,
              teams: {
                home: { name: homeName, badge: home?.team?.logo },
                away: { name: awayName, badge: away?.team?.logo },
              },
              sources: [
                { source: 'strmfree', id: keyA, label: 'StreamFree' },
                { source: 'strmfree', id: keyB, label: 'StreamFree (alt)' },
              ],
            });
          }
        }
      }

      logDiagnostic({
        provider: this.name,
        operation: `fetchMatches:${category}`,
        durationMs: Date.now() - startTime,
        status: 200,
      });
    } catch (err: any) {
      logDiagnostic({
        provider: this.name,
        operation: `fetchMatches:${category}`,
        durationMs: Date.now() - startTime,
        status: 'error',
        error: err.message,
      });
    }

    return matches;
  }

  async resolvePlayback(_id: string): Promise<PlaybackResolution> {
    // ESPN Scoreboard provides live scores/schedule, but not open video streams
    return {
      status: 'unsupported',
      streams: [],
      error: 'ESPN provides live schedule data. Video streaming requires an active broadcaster feed.',
      provider: this.name,
    };
  }
}

