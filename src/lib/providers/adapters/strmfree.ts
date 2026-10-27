import type { Category, NormalizedMatch, PlaybackResolution, ProviderAdapter } from '../types';
import { sanitizePlaybackUrl } from '../allowlist';
import { logDiagnostic } from '../diagnostics';

const UPSTREAM = 'https://strmfree.st';

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export class StrmFreeAdapter implements ProviderAdapter {
  readonly name = 'strmfree';
  readonly isAuthorized = false; // Third-party provider, unverified commercial SLA
  readonly statusClassification = 'partially-verified' as const;

  async fetchMatches(category: Category, signal?: AbortSignal): Promise<NormalizedMatch[]> {
    const startTime = Date.now();
    const timeoutSignal = AbortSignal.timeout(3500);
    const effectiveSignal = signal ? AbortSignal.any([signal, timeoutSignal]) : timeoutSignal;
    const matches: NormalizedMatch[] = [];
    const seenSlugs = new Set<string>();

    const fixCat = category === 'football' ? 'soccer' : category;

    // 1. Ingest live streams
    try {
      const res = await fetch(`${UPSTREAM}/streams`, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', accept: 'application/json' },
        signal: effectiveSignal,
      });

      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        const data = (await res.json()) as any;
        const items = data?.streams?.[fixCat] || [];

        if (Array.isArray(items)) {
          for (const item of items) {
            const title = typeof item.name === 'string' ? item.name.trim() : '';
            if (!title) continue;

            const slug = slugify(title);
            if (seenSlugs.has(slug)) continue;
            seenSlugs.add(slug);

            const team1 = item.team1;
            const team2 = item.team2;
            const rawThumb = typeof item.thumbnail_url === 'string' ? item.thumbnail_url : '';
            const poster = rawThumb.startsWith('https://')
              ? rawThumb
              : rawThumb.startsWith('/')
              ? `${UPSTREAM}${rawThumb}`
              : (team1?.logo && typeof team1.logo === 'string' && team1.logo.startsWith('https://'))
              ? team1.logo
              : (team2?.logo && typeof team2.logo === 'string' && team2.logo.startsWith('https://'))
              ? team2.logo
              : undefined;

            matches.push({
              id: item.stream_key || slug,
              title,
              category,
              competition: item.league || undefined,
              league: item.league || undefined,
              status: 'Live',
              date: typeof item.match_timestamp === 'number' ? item.match_timestamp * 1000 : Date.now(),
              poster,
              teams:
                team1?.name && team2?.name
                  ? {
                      home: { name: team1.name, badge: team1.logo },
                      away: { name: team2.name, badge: team2.logo },
                    }
                  : undefined,
              sources: [{ source: 'strmfree', id: item.stream_key || slug, label: 'StrmFree HD' }],
            });
          }
        }
      }

      logDiagnostic({
        provider: this.name,
        operation: `fetchMatches:streams:${category}`,
        durationMs: Date.now() - startTime,
        status: res.status,
        contentType,
      });
    } catch (err: any) {
      logDiagnostic({
        provider: this.name,
        operation: `fetchMatches:streams:${category}`,
        durationMs: Date.now() - startTime,
        status: 'error',
        error: err.message,
      });
    }

    // 2. Ingest scheduled fixtures
    try {
      const res = await fetch(`${UPSTREAM}/fixtures/${fixCat}`, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', accept: 'application/json' },
        signal: effectiveSignal,
      });

      if (res.ok) {
        const data = (await res.json()) as any;
        const fixturesObj = data?.fixtures || {};
        const dateKeys = Object.keys(fixturesObj).slice(0, 8);
        const now = Date.now();

        for (const dateKey of dateKeys) {
          const list = fixturesObj[dateKey]?.fixtures || [];
          if (!Array.isArray(list)) continue;

          for (const item of list) {
            const rawName = typeof item.event_name === 'string' ? item.event_name : '';
            if (!rawName) continue;
            const title = rawName.includes(' at ') ? rawName.replace(' at ', ' vs ') : rawName;
            const slug = slugify(title);
            if (seenSlugs.has(slug)) continue;
            seenSlugs.add(slug);

            const matchTimeMs = typeof item.date_unix === 'number'
              ? item.date_unix * 1000
              : new Date(dateKey).getTime();
            const isLiveNow = matchTimeMs > 0 && now >= matchTimeMs && now <= matchTimeMs + 3.5 * 3600 * 1000;
            const isPast = matchTimeMs > 0 && now > matchTimeMs + 3.5 * 3600 * 1000;
            const status = isLiveNow ? 'Live' : isPast ? 'Final' : 'Upcoming';

            const team1 = item.team1;
            const team2 = item.team2;

            matches.push({
              id: slug,
              title,
              category,
              competition: item.competition || undefined,
              league: item.competition || undefined,
              status,
              date: matchTimeMs > 0 ? matchTimeMs : undefined,
              poster: (team1?.logo && team1.logo.startsWith('https://'))
                ? team1.logo
                : (team2?.logo && team2.logo.startsWith('https://'))
                ? team2.logo
                : undefined,
              teams:
                team1?.name && team2?.name
                  ? {
                      home: { name: team2.name, badge: team2.logo },
                      away: { name: team1.name, badge: team1.logo },
                    }
                  : undefined,
              sources: [{ source: 'strmfree', id: slug, label: 'StrmFree Fixture' }],
            });
          }
        }
      }
    } catch {}

    return matches;
  }

  async resolvePlayback(id: string, signal?: AbortSignal): Promise<PlaybackResolution> {
    const startTime = Date.now();
    const timeoutSignal = AbortSignal.timeout(3500);
    const effectiveSignal = signal ? AbortSignal.any([signal, timeoutSignal]) : timeoutSignal;

    try {
      const res = await fetch(`${UPSTREAM}/api/v1/sources/${encodeURIComponent(id)}`, {
        headers: { 'User-Agent': 'Mozilla/5.0', accept: 'application/json' },
        signal: effectiveSignal,
      });

      if (res.ok) {
        const data = (await res.json()) as any;
        const sources: string[] = Array.isArray(data?.sources) ? data.sources : [];
        const validatedStreams = sources
          .map((rawUrl) => sanitizePlaybackUrl(rawUrl))
          .filter((url): url is string => Boolean(url))
          .map((url, idx) => ({
            embedUrl: url,
            hd: url.includes('1080p') || url.includes('720p'),
            language: `Server ${idx + 1}`,
            isSandboxedIframe: true,
          }));

        if (validatedStreams.length > 0) {
          logDiagnostic({
            provider: this.name,
            operation: `resolvePlayback:${id}`,
            durationMs: Date.now() - startTime,
            status: 200,
          });
          return {
            status: 'ready',
            streams: validatedStreams,
            provider: this.name,
          };
        }
      }
    } catch (err: any) {
      logDiagnostic({
        provider: this.name,
        operation: `resolvePlayback:${id}`,
        durationMs: Date.now() - startTime,
        status: 'error',
        error: err.message,
      });
    }

    // Default validated fallback embed for strmfree
    const fallbackUrl = sanitizePlaybackUrl(`${UPSTREAM}/embed/soccer/${encodeURIComponent(id)}1080p`);
    if (fallbackUrl) {
      return {
        status: 'ready',
        streams: [
          {
            embedUrl: fallbackUrl,
            hd: true,
            language: 'Server 1 (Primary)',
            isSandboxedIframe: true,
          },
        ],
        provider: this.name,
      };
    }

    return {
      status: 'unavailable',
      streams: [],
      error: 'Broadcast feed is currently offline or waiting for pre-match signal.',
      provider: this.name,
    };
  }
}

