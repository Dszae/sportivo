import type { Category, NormalizedMatch, PlaybackResolution, ProviderAdapter } from '../types';
import { sanitizePlaybackUrl } from '../allowlist';
import { logDiagnostic } from '../diagnostics';

const UPSTREAM = 'https://timst.top';

export class TimstAdapter implements ProviderAdapter {
  readonly name = 'timst';
  readonly isAuthorized = false; // Unverified SLA
  readonly statusClassification = 'partially-verified' as const;

  async fetchMatches(_category: Category, signal?: AbortSignal): Promise<NormalizedMatch[]> {
    const startTime = Date.now();
    const timeoutSignal = AbortSignal.timeout(3500);
    const effectiveSignal = signal ? AbortSignal.any([signal, timeoutSignal]) : timeoutSignal;
    const matches: NormalizedMatch[] = [];

    try {
      const res = await fetch(`${UPSTREAM}/api/channels`, { signal: effectiveSignal });
      if (res.ok) {
        const data = (await res.json()) as any;
        const channels: any[] = Array.isArray(data?.channels) ? data.channels : [];
        for (const ch of channels.slice(0, 5)) {
          if (!ch?.name) continue;
          matches.push({
            id: ch.id || ch.name,
            title: ch.name,
            category: 'football',
            competition: '24/7 Sports TV',
            status: 'Live',
            date: 0, // 24/7 live feed
            poster: ch.logo || undefined,
            sources: [{ source: 'timst', id: ch.id || ch.name, label: 'Timst 24/7' }],
          });
        }
      }

      logDiagnostic({
        provider: this.name,
        operation: 'fetchMatches:channels',
        durationMs: Date.now() - startTime,
        status: res.status,
      });
    } catch (err: any) {
      logDiagnostic({
        provider: this.name,
        operation: 'fetchMatches:channels',
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
