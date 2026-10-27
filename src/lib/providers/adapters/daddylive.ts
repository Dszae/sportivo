import type { Category, NormalizedMatch, PlaybackResolution, ProviderAdapter } from '../types';
import { sanitizePlaybackUrl } from '../allowlist';
import { logDiagnostic } from '../diagnostics';

const BASE_URL = 'https://thedaddy.pk';

export class DaddyLiveAdapter implements ProviderAdapter {
  readonly name = 'daddylive';
  readonly isAuthorized = false; // Commercial license/authorization unverified
  readonly statusClassification = 'restricted' as const;

  private getApiKey(): string | null {
    // Strictly server-side environment variable only
    return process.env.DADDYLIVE_API_KEY || null;
  }

  async fetchMatches(_category: Category, _signal?: AbortSignal): Promise<NormalizedMatch[]> {
    const apiKey = this.getApiKey();

    // If no verified server-side key is provided, do NOT ingest unverified or stale public schedules
    if (!apiKey) {
      logDiagnostic({
        provider: this.name,
        operation: 'fetchMatches',
        durationMs: 0,
        status: 'restricted_no_key',
        error: 'DaddyLive integration requires a verified API key. Unauthenticated schedule ingestion disabled to avoid stale data.',
      });
      return [];
    }

    const startTime = Date.now();
    try {
      const res = await fetch(`${BASE_URL}/daddyapi.php?key=${encodeURIComponent(apiKey)}&endpoint=schedule`, {
        headers: { accept: 'application/json' },
        signal: AbortSignal.timeout(3500),
      });

      if (!res.ok) {
        logDiagnostic({
          provider: this.name,
          operation: 'fetchMatches:protected',
          durationMs: Date.now() - startTime,
          status: res.status,
        });
        return [];
      }

      // If authorized response succeeds, parse normalized items
      return [];
    } catch (err: any) {
      logDiagnostic({
        provider: this.name,
        operation: 'fetchMatches:protected',
        durationMs: Date.now() - startTime,
        status: 'error',
        error: err.message,
      });
      return [];
    }
  }

  async resolvePlayback(id: string): Promise<PlaybackResolution> {
    const streamId = encodeURIComponent(id);
    const candidateUrls = [
      `${BASE_URL}/stream/stream-${streamId}.php`,
      `${BASE_URL}/cast/stream-${streamId}.php`,
      `${BASE_URL}/player/stream-${streamId}.php`,
    ];

    const validatedStreams = candidateUrls
      .map((url) => sanitizePlaybackUrl(url))
      .filter((url): url is string => Boolean(url))
      .map((url, idx) => ({
        embedUrl: url,
        hd: true,
        language: idx === 0 ? 'Server 1 (DaddyLive)' : `Server ${idx + 1}`,
        isSandboxedIframe: true,
      }));

    if (validatedStreams.length === 0) {
      return {
        status: 'unsupported',
        streams: [],
        error: 'DaddyLive playback URL could not be validated.',
        provider: this.name,
      };
    }

    return {
      status: 'ready',
      streams: validatedStreams,
      provider: this.name,
    };
  }
}

