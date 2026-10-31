import type { Category, NormalizedMatch, PlaybackResolution, ProviderAdapter } from '../types';
import { sanitizePlaybackUrl } from '../allowlist';
import { logDiagnostic } from '../diagnostics';

const BASE_URL = 'https://thedaddy.pk';

const VERIFIED_CRICKET_CHANNELS: Array<{ id: string; name: string; title: string; poster?: string }> = [
  { id: '346', name: 'willow cricket', title: 'Willow Cricket Live', poster: 'https://static.ppvservices.st/assets/thumb/2e3cba2a94ae6af4b958675e73fe91e9-thumbnail.jpg' },
  { id: '598', name: 'willow 2 cricket', title: 'Willow 2 Cricket Live', poster: 'https://static.ppvservices.st/assets/thumb/2e3cba2a94ae6af4b958675e73fe91e9-thumbnail.jpg' },
  { id: '369', name: 'fox cricket', title: 'Fox Cricket Live', poster: 'https://static.ppvservices.st/assets/thumb/5dfe2fc8e56d59add47afb0f6e996e55-thumbnail.jpg' },
  { id: '65', name: 'sky sports cricket', title: 'Sky Sports Cricket Live' },
  { id: '267', name: 'star sports 1 in', title: 'Star Sports 1 HD' },
  { id: '268', name: 'star sports hindi in', title: 'Star Sports Hindi' },
  { id: '450', name: 'ptv sports', title: 'PTV Sports Live' },
  { id: '741', name: 'ten sports pk', title: 'Ten Sports Live' },
  { id: '368', name: 'supersport cricket', title: 'SuperSport Cricket' },
  { id: '885', name: 'sony ten 1', title: 'Sony Ten 1 HD' },
  { id: '886', name: 'sony ten 2', title: 'Sony Ten 2 HD' },
  { id: '887', name: 'sony ten 3', title: 'Sony Ten 3 HD' },
];

export class DaddyLiveAdapter implements ProviderAdapter {
  readonly name = 'daddylive';
  readonly isAuthorized = false; // Commercial license/authorization unverified
  readonly statusClassification = 'partially-verified' as const;

  private getApiKey(): string | null {
    // Strictly server-side environment variable only
    return process.env.DADDYLIVE_API_KEY || null;
  }

  async fetchMatches(category: Category, _signal?: AbortSignal): Promise<NormalizedMatch[]> {
    if (category === 'cricket') {
      return VERIFIED_CRICKET_CHANNELS.map((ch) => ({
        id: `daddy-${ch.id}`,
        title: ch.title,
        category: 'cricket',
        competition: 'Cricket 24/7 Live Broadcast',
        league: '24/7 Live TV',
        status: 'Live',
        date: 0, // Continuous 24/7 feed
        poster: ch.poster,
        sources: [
          {
            source: this.name,
            id: ch.id,
            label: `${ch.title} (Server 1)`,
          },
        ],
      }));
    }

    const apiKey = this.getApiKey();
    if (!apiKey) {
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

