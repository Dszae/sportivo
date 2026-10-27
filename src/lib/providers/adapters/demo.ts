import type { Category, NormalizedMatch, PlaybackResolution, ProviderAdapter } from '../types';

export class DemoAdapter implements ProviderAdapter {
  readonly name = 'demo';
  readonly isAuthorized = true;
  readonly statusClassification = 'verified' as const;

  async fetchMatches(category: Category): Promise<NormalizedMatch[]> {
    const now = Date.now();
    return [
      {
        id: `demo-${category}-test-fixture`,
        title: `Test United vs Demo City (${category.toUpperCase()})`,
        category,
        competition: 'Verified Test Cup',
        league: 'Test League',
        status: 'Live',
        date: now,
        teams: {
          home: { name: 'Test United' },
          away: { name: 'Demo City' },
        },
        sources: [{ source: 'demo', id: 'test-fixture', label: 'Authorized Test Stream' }],
      },
    ];
  }

  async resolvePlayback(_id: string): Promise<PlaybackResolution> {
    // Uses Google's official public test video asset
    return {
      status: 'ready',
      streams: [
        {
          embedUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
          hd: true,
          language: 'Test Stream (MP4)',
          isNativeVideo: true,
          isSandboxedIframe: false,
        },
      ],
      provider: this.name,
    };
  }
}

