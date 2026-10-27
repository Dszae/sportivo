import type { Category, NormalizedMatch, PlaybackResolution, ProviderAdapter } from '../types';
import { logDiagnostic } from '../diagnostics';

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

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
        const res = await fetch('https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard', {
          signal: effectiveSignal,
        });
        if (res.ok) {
          const data = (await res.json()) as any;
          const events = data?.events || [];
          for (const ev of events) {
            const comp = ev?.competitions?.[0];
            const competitors = comp?.competitors || [];
            const home = competitors.find((c: any) => c.homeAway === 'home');
            const away = competitors.find((c: any) => c.homeAway === 'away');
            const title = ev.name || `${home?.team?.displayName || 'Home'} vs ${away?.team?.displayName || 'Away'}`;
            const slug = slugify(title);

            const isLive = comp?.status?.type?.state === 'in';
            const isCompleted = comp?.status?.type?.state === 'post';
            // User requirement: Never ingest completed past matches ("remove those recent results")
            if (isCompleted) continue;
            const status = isLive ? 'Live' : 'Upcoming';

            matches.push({
              id: ev.id ? `espn-nba-${ev.id}` : slug,
              title,
              category: 'basketball',
              competition: 'NBA',
              league: 'NBA',
              status,
              date: ev.date ? new Date(ev.date).getTime() : undefined,
              poster: home?.team?.logo || away?.team?.logo || undefined,
              teams: {
                home: { name: home?.team?.displayName || 'Home', badge: home?.team?.logo },
                away: { name: away?.team?.displayName || 'Away', badge: away?.team?.logo },
              },
              sources: [{ source: 'espn', id: slug, label: 'ESPN Scoreboard' }],
            });
          }
        }
      } else if (category === 'football') {
        const leagues = [
          'eng.1', // Premier League
          'esp.1', // La Liga
          'ger.1', // Bundesliga
          'ita.1', // Serie A
          'uefa.champions', // Champions League
        ];

        for (const league of leagues) {
          if (matches.length >= 25) break;
          try {
            const res = await fetch(
              `https://site.api.espn.com/apis/site/v2/sports/soccer/${league}/scoreboard`,
              { signal: effectiveSignal }
            );
            if (res.ok) {
              const data = (await res.json()) as any;
              const events = data?.events || [];
              for (const ev of events) {
                const comp = ev?.competitions?.[0];
                const competitors = comp?.competitors || [];
                const home = competitors.find((c: any) => c.homeAway === 'home');
                const away = competitors.find((c: any) => c.homeAway === 'away');
                const title = ev.name || `${home?.team?.displayName || 'Home'} vs ${away?.team?.displayName || 'Away'}`;
                const slug = slugify(title);

                const isLive = comp?.status?.type?.state === 'in';
                const isCompleted = comp?.status?.type?.state === 'post';
                // User requirement: Never ingest completed past matches ("remove those recent results")
                if (isCompleted) continue;
                const status = isLive ? 'Live' : 'Upcoming';

                matches.push({
                  id: ev.id ? `espn-soc-${ev.id}` : slug,
                  title,
                  category: 'football',
                  competition: data?.leagues?.[0]?.name || league.toUpperCase(),
                  league: data?.leagues?.[0]?.name || league.toUpperCase(),
                  status,
                  date: ev.date ? new Date(ev.date).getTime() : undefined,
                  poster: home?.team?.logo || away?.team?.logo || undefined,
                  teams: {
                    home: { name: home?.team?.displayName || 'Home', badge: home?.team?.logo },
                    away: { name: away?.team?.displayName || 'Away', badge: away?.team?.logo },
                  },
                  sources: [{ source: 'espn', id: slug, label: 'ESPN Desk' }],
                });
              }
            }
          } catch {}
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

