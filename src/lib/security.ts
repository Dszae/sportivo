/**
 * Security and CORS Enforcement Utilities
 * Prevents unauthorized third-party origins from scraping or abusing Sportivo APIs,
 * while allowing legitimate first-party web clients and native mobile apps.
 */

const ALLOWED_ORIGINS = new Set([
  'https://sportivo.dipeshsapkota7.com.np',
  'https://www.sportivo.dipeshsapkota7.com.np',
  'http://localhost:4321',
  'http://localhost:3000',
  'http://localhost:5173',
  'http://127.0.0.1:4321',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:5173',
]);

export function getSafeCorsHeaders(request?: Request): Record<string, string> {
  let allowOrigin = 'https://sportivo.dipeshsapkota7.com.np';

  if (request) {
    const origin = request.headers.get('origin');
    if (origin) {
      const lower = origin.toLowerCase().trim();
      if (ALLOWED_ORIGINS.has(lower) || lower.endsWith('.dipeshsapkota7.com.np')) {
        allowOrigin = origin;
      } else {
        // Disallow arbitrary third-party web origins
        allowOrigin = 'null';
      }
    }
  }

  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
    'Vary': 'Origin',
    'X-Content-Type-Options': 'nosniff',
  };
}

export function isAllowedOrigin(origin: string | null | undefined): boolean {
  if (!origin) return true; // Native apps or direct same-origin requests don't send Origin
  const lower = origin.toLowerCase().trim();
  return ALLOWED_ORIGINS.has(lower) || lower.endsWith('.dipeshsapkota7.com.np');
}
