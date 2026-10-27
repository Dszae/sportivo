/**
 * Approved domain allowlist and URL validation for video playback.
 * Enforces strict HTTPS, rejects unapproved origins, prevents SSRF and open redirects.
 */

export const APPROVED_PLAYBACK_DOMAINS = [
  'strmfree.st',
  'thedaddy.pk',
  'timst.top',
  'wigilive.top',
  'commondatastorage.googleapis.com',
  'stream.mux.com',
] as const;

export function isAllowedPlaybackDomain(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return APPROVED_PLAYBACK_DOMAINS.some((allowed) => {
    return host === allowed || host.endsWith(`.${allowed}`);
  });
}

/**
 * Validates and normalizes a playback URL.
 * Only returns a URL string if it is valid HTTPS, has no credentials, and matches the approved allowlist.
 */
export function sanitizePlaybackUrl(rawUrl: string | undefined | null): string | null {
  if (!rawUrl || typeof rawUrl !== 'string') return null;
  const trimmed = rawUrl.trim();
  if (!trimmed) return null;

  // Reject obvious dangerous schemes before URL parsing
  if (/^(javascript|data|vbscript|file|about):/i.test(trimmed)) {
    return null;
  }

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'https:') return null;
    if (parsed.username || parsed.password) return null;
    if (!isAllowedPlaybackDomain(parsed.hostname)) return null;

    return parsed.toString();
  } catch {
    return null;
  }
}

/**
 * Validates identifier inputs for source and ID parameters to prevent path traversal or injection.
 */
export function sanitizeIdentifier(value: string | undefined | null): string | null {
  if (!value || typeof value !== 'string') return null;
  const trimmed = value.trim();
  // Allow alphanumeric, dashes, underscores, and dots, up to 120 chars
  if (!/^[a-zA-Z0-9_\-.]{1,120}$/.test(trimmed)) {
    return null;
  }
  return trimmed;
}

