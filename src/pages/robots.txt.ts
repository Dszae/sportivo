export const prerender = true;

export function GET() {
  const content = [
    'User-agent: *',
    'Allow: /',
    '',
    'User-agent: Googlebot',
    'Allow: /',
    '',
    'User-agent: Bingbot',
    'Allow: /',
    '',
    'User-agent: OAI-SearchBot',
    'Allow: /',
    '',
    'User-agent: GPTBot',
    'Disallow: /api/',
    '',
    'Sitemap: https://sportivo.dipeshsapkota7.com.np/sitemap.xml',
    'Sitemap: https://sportivo.dipeshsapkota7.com.np/sitemap-index.xml',
    '',
  ].join('\n');

  return new Response(content, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}