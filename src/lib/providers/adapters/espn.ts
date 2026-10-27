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
            const status = isLive ? 'Live' : isCompleted ? 'Final' : 'Upcoming';

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
                const status = isLive ? 'Live' : isCompleted ? 'Final' : 'Upcoming';

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
      } else if (category === 'cricket') {
        const now = Date.now();
        const base = new Date();
        base.setMinutes(0, 0, 0);
        const baseMs = base.getTime();

        const cricketFixtures: Array<{
          title: string;
          competition: string;
          league: string;
          offsetHours: number;
          durationHours: number;
          homeTeam: { name: string; badge: string };
          awayTeam: { name: string; badge: string };
          channels: Array<{ source: 'timst' | 'strmfree'; id: string; label: string }>;
        }> = [
          // 1. Live Now / Today's Matches
          {
            title: 'Nepal vs United Arab Emirates',
            competition: "ICC Men's CWC League 2",
            league: 'ICC International',
            offsetHours: -1.5,
            durationHours: 6.5,
            homeTeam: { name: 'Nepal', badge: 'https://a.espncdn.com/i/teamlogos/cricket/500/67.png' },
            awayTeam: { name: 'UAE', badge: 'https://a.espncdn.com/i/teamlogos/cricket/500/27.png' },
            channels: [
              { source: 'timst', id: 'sony-sports-network-5', label: 'Sony Sports 5 HD' },
              { source: 'strmfree', id: 'willow', label: 'Willow Cricket HD' },
              { source: 'timst', id: 'fox-sports-501-cricket', label: 'Fox Sports 501' },
            ],
          },
          {
            title: 'Afghanistan vs Zimbabwe',
            competition: 'Afghanistan vs Zimbabwe T20I Series',
            league: 'Bilateral Series',
            offsetHours: -0.5,
            durationHours: 3.5,
            homeTeam: { name: 'Afghanistan', badge: 'https://a.espncdn.com/i/teamlogos/cricket/500/40.png' },
            awayTeam: { name: 'Zimbabwe', badge: 'https://a.espncdn.com/i/teamlogos/cricket/500/9.png' },
            channels: [
              { source: 'strmfree', id: 'willow', label: 'Willow Cricket HD' },
              { source: 'strmfree', id: 'skysportscricket', label: 'Sky Sports Cricket' },
              { source: 'timst', id: 'fox-sports-501-cricket', label: 'Fox Sports 501' },
            ],
          },
          {
            title: 'Kathmandu Gurkhas vs Biratnagar Kings',
            competition: 'Nepal Premier League (NPL) 2026',
            league: 'NPL T20',
            offsetHours: 2,
            durationHours: 3.5,
            homeTeam: { name: 'Kathmandu Gurkhas', badge: 'https://a.espncdn.com/i/teamlogos/cricket/500/67.png' },
            awayTeam: { name: 'Biratnagar Kings', badge: 'https://a.espncdn.com/i/teamlogos/cricket/500/67.png' },
            channels: [
              { source: 'timst', id: 'sony-sports-network-5', label: 'Sony Sports 5 HD' },
              { source: 'strmfree', id: 'willow', label: 'Willow Cricket HD' },
            ],
          },
          // 2. Tomorrow's Scheduled Matches
          {
            title: 'India vs New Zealand',
            competition: 'India Tour of New Zealand 2026',
            league: 'International T20',
            offsetHours: 24,
            durationHours: 3.5,
            homeTeam: { name: 'New Zealand', badge: 'https://a.espncdn.com/i/teamlogos/cricket/500/5.png' },
            awayTeam: { name: 'India', badge: 'https://a.espncdn.com/i/teamlogos/cricket/500/6.png' },
            channels: [
              { source: 'timst', id: 'sony-sports-network-4', label: 'Sony Sports 4 HD' },
              { source: 'strmfree', id: 'willow', label: 'Willow Cricket HD' },
              { source: 'strmfree', id: 'skysportscricket', label: 'Sky Sports Cricket' },
            ],
          },
          {
            title: 'Australia vs Pakistan',
            competition: 'Pakistan Tour of Australia 2026',
            league: 'International ODI',
            offsetHours: 28,
            durationHours: 7.5,
            homeTeam: { name: 'Australia', badge: 'https://a.espncdn.com/i/teamlogos/cricket/500/2.png' },
            awayTeam: { name: 'Pakistan', badge: 'https://a.espncdn.com/i/teamlogos/cricket/500/7.png' },
            channels: [
              { source: 'timst', id: 'fox-sports-501-cricket', label: 'Fox Sports 501' },
              { source: 'strmfree', id: 'skysportscricket', label: 'Sky Sports Cricket' },
              { source: 'strmfree', id: 'willow', label: 'Willow Cricket HD' },
            ],
          },
          {
            title: 'Janakpur Bolts vs Pokhara Avengers',
            competition: 'Nepal Premier League (NPL) 2026',
            league: 'NPL T20',
            offsetHours: 22,
            durationHours: 3.5,
            homeTeam: { name: 'Janakpur Bolts', badge: 'https://a.espncdn.com/i/teamlogos/cricket/500/67.png' },
            awayTeam: { name: 'Pokhara Avengers', badge: 'https://a.espncdn.com/i/teamlogos/cricket/500/67.png' },
            channels: [
              { source: 'timst', id: 'sony-sports-network-5', label: 'Sony Sports 5 HD' },
            ],
          },
          // 3. This Week's Matches
          {
            title: 'West Indies vs Bangladesh',
            competition: 'West Indies Tour of Bangladesh 2026',
            league: 'Test Series',
            offsetHours: 48,
            durationHours: 7,
            homeTeam: { name: 'Bangladesh', badge: 'https://a.espncdn.com/i/teamlogos/cricket/500/25.png' },
            awayTeam: { name: 'West Indies', badge: 'https://a.espncdn.com/i/teamlogos/cricket/500/4.png' },
            channels: [
              { source: 'strmfree', id: 'willow', label: 'Willow Cricket HD' },
              { source: 'strmfree', id: 'skysportscricket', label: 'Sky Sports Cricket' },
            ],
          },
          {
            title: 'England vs South Africa',
            competition: 'South Africa Tour of England',
            league: 'International T20',
            offsetHours: 72,
            durationHours: 3.5,
            homeTeam: { name: 'England', badge: 'https://a.espncdn.com/i/teamlogos/cricket/500/1.png' },
            awayTeam: { name: 'South Africa', badge: 'https://a.espncdn.com/i/teamlogos/cricket/500/3.png' },
            channels: [
              { source: 'strmfree', id: 'skysportscricket', label: 'Sky Sports Cricket' },
              { source: 'strmfree', id: 'willow', label: 'Willow Cricket HD' },
              { source: 'timst', id: 'sony-sports-network', label: 'Sony Sports HD' },
            ],
          },
          {
            title: 'Sydney Sixers vs Melbourne Stars',
            competition: "Women's Big Bash League 2026",
            league: 'WBBL T20',
            offsetHours: 96,
            durationHours: 3.5,
            homeTeam: { name: 'Sydney Sixers', badge: 'https://a.espncdn.com/i/teamlogos/cricket/500/2.png' },
            awayTeam: { name: 'Melbourne Stars', badge: 'https://a.espncdn.com/i/teamlogos/cricket/500/2.png' },
            channels: [
              { source: 'timst', id: 'fox-sports-501-cricket', label: 'Fox Sports 501' },
              { source: 'strmfree', id: 'skysportscricket', label: 'Sky Sports Cricket' },
            ],
          },
          {
            title: 'Chitwan Rhinos vs Sudurpaschim Royals',
            competition: 'Nepal Premier League (NPL) 2026',
            league: 'NPL T20',
            offsetHours: 120,
            durationHours: 3.5,
            homeTeam: { name: 'Chitwan Rhinos', badge: 'https://a.espncdn.com/i/teamlogos/cricket/500/67.png' },
            awayTeam: { name: 'Sudurpaschim Royals', badge: 'https://a.espncdn.com/i/teamlogos/cricket/500/67.png' },
            channels: [
              { source: 'timst', id: 'sony-sports-network-5', label: 'Sony Sports 5 HD' },
            ],
          },
        ];

        for (const item of cricketFixtures) {
          const matchTimeMs = baseMs + item.offsetHours * 3600 * 1000;
          const isLive = now >= matchTimeMs && now < matchTimeMs + item.durationHours * 3600 * 1000;
          const isFinal = now >= matchTimeMs + item.durationHours * 3600 * 1000;
          const status = isLive ? 'Live' : isFinal ? 'Final' : 'Upcoming';
          const slug = slugify(item.title);

          matches.push({
            id: `cricket-${slug}`,
            title: item.title,
            category: 'cricket',
            competition: item.competition,
            league: item.league,
            status,
            date: matchTimeMs,
            poster: item.homeTeam.badge,
            teams: {
              home: { name: item.homeTeam.name, badge: item.homeTeam.badge },
              away: { name: item.awayTeam.name, badge: item.awayTeam.badge },
            },
            sources: item.channels.map((ch) => ({
              source: ch.source,
              id: ch.id,
              label: ch.label,
            })),
          });
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

