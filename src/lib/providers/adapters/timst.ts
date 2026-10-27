import type { Category, NormalizedMatch, PlaybackResolution, ProviderAdapter } from '../types';
import { sanitizePlaybackUrl } from '../allowlist';
import { logDiagnostic } from '../diagnostics';

const UPSTREAM = 'https://timst.top';

const CATEGORY_FILTERS: Record<Category, RegExp> = {
  cricket: /cricket|willow|star sports|sky sports cricket|sony|ptv|ten sports|a sports|supersport.*cricket/i,
  basketball: /nba|basketball/i,
  football: /football|premier|sky sports football|bein|tnt|laliga|bundesliga|serie a|soccer|espn|match tv|dazn/i,
};

export class TimstAdapter implements ProviderAdapter {
  readonly name = 'timst';
  readonly isAuthorized = false; // Unverified SLA
  readonly statusClassification = 'partially-verified' as const;

  async fetchMatches(category: Category, signal?: AbortSignal): Promise<NormalizedMatch[]> {
    const startTime = Date.now();
    const timeoutSignal = AbortSignal.timeout(3500);
    const effectiveSignal = signal ? AbortSignal.any([signal, timeoutSignal]) : timeoutSignal;
    const matches: NormalizedMatch[] = [];

    const pattern = CATEGORY_FILTERS[category];

    try {
      const res = await fetch(`${UPSTREAM}/api/channels`, { signal: effectiveSignal });
      if (res.ok) {
        const data = (await res.json()) as any;
        const allChannels: any[] = Array.isArray(data?.channels) ? data.channels : [];
        const filtered = allChannels.filter((c: any) => pattern.test(c?.name || ''));

        for (const ch of filtered) {
          if (!ch?.name) continue;
          matches.push({
            id: ch.id || ch.name,
            title: ch.name,
            category,
            competition: `${category[0].toUpperCase() + category.slice(1)} 24/7 Live TV`,
            league: '24/7 Broadcast',
            status: 'Live',
            date: 0, // 24/7 continuous stream
            poster: ch.logo && ch.logo.startsWith('http') ? ch.logo : undefined,
            sources: [{ source: 'timst', id: ch.id || ch.name, label: 'Timst 24/7 HD' }],
          });
        }
      }

      logDiagnostic({
        provider: this.name,
        operation: `fetchMatches:${category}`,
        durationMs: Date.now() - startTime,
        status: res.status,
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

  async resolvePlayback(id: string): Promise<PlaybackResolution> {
    const url = id.startsWith('https://') ? id : `${UPSTREAM}/${encodeURIComponent(id)}`;
    const validated = sanitizePlaybackUrl(url);

    if (!validated) {
      return {
        status: 'unsupported',
        streams: [],
        error: 'Stream URL is not from an approved domain.',
        provider: this.name,
      };
    }

    const isNative = validated.endsWith('.m3u8') || validated.endsWith('.mp4');

    return {
      status: 'ready',
      streams: [
        {
          embedUrl: validated,
          hd: true,
          language: 'English 24/7',
          isNativeVideo: isNative,
          isSandboxedIframe: !isNative,
        },
      ],
      provider: this.name,
    };
  }
}
