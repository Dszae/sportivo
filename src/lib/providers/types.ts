export type Category = 'football' | 'cricket' | 'basketball';

export type PlayerState =
  | 'idle'
  | 'resolving'
  | 'ready'
  | 'playing'
  | 'failed'
  | 'unavailable'
  | 'unsupported';

export interface TeamInfo {
  name: string;
  badge?: string;
}

export interface NormalizedStreamSource {
  source: string;
  id: string;
  label?: string;
}

export interface NormalizedMatch {
  id: string;
  title: string;
  category: Category;
  competition?: string;
  league?: string;
  status?: 'Live' | 'Upcoming' | 'Final' | string;
  date?: number; // Unix timestamp in milliseconds
  teams?: {
    home?: TeamInfo;
    away?: TeamInfo;
  };
  poster?: string;
  sources: NormalizedStreamSource[];
}

export interface PlaybackStream {
  embedUrl: string;
  hd?: boolean;
  language?: string;
  isNativeVideo?: boolean;
  isSandboxedIframe?: boolean;
}

export interface PlaybackResolution {
  status: 'ready' | 'unavailable' | 'unsupported' | 'failed';
  streams: PlaybackStream[];
  error?: string;
  provider: string;
}

export interface ProviderAdapter {
  readonly name: string;
  readonly isAuthorized: boolean;
  readonly statusClassification: 'verified' | 'partially-verified' | 'restricted' | 'confirmed-unavailable';
  fetchMatches(category: Category, signal?: AbortSignal): Promise<NormalizedMatch[]>;
  resolvePlayback(id: string, signal?: AbortSignal): Promise<PlaybackResolution>;
}

