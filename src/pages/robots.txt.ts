export const prerender = true;

const SITE = 'https://sportivo.dipeshsapkota7.com.np';

// Every crawler is allowed by the wildcard group. The named groups below make
// that explicit for agents that only honour a group addressed to them, and
// cover the three kinds of AI traffic: training crawlers, search indexers,
// and user-triggered fetchers (the ones that report "access denied" in chat).
const AGENT_GROUPS: Array<{ label: string; agents: string[] }> = [
  {
    label: 'Search engines',
    agents: ['Googlebot', 'Googlebot-Image', 'Bingbot', 'DuckDuckBot', 'Applebot', 'YandexBot', 'Baiduspider'],
  },
  {
    label: 'OpenAI (ChatGPT, ChatGPT search)',
    agents: ['GPTBot', 'OAI-SearchBot', 'ChatGPT-User'],
  },
  {
    label: 'Anthropic (Claude)',
    agents: ['ClaudeBot', 'Claude-SearchBot', 'Claude-User', 'Claude-Web', 'anthropic-ai'],
  },
  {
    label: 'Perplexity',
    agents: ['PerplexityBot', 'Perplexity-User'],
  },
  {
    label: 'Google AI (Gemini, AI Overviews, Vertex)',
    agents: ['Google-Extended', 'GoogleOther', 'Google-CloudVertexBot'],
  },
  {
    label: 'Other AI assistants and corpora',
    agents: [
      'Applebot-Extended',
      'Amazonbot',
      'Meta-ExternalAgent',
      'Meta-ExternalFetcher',
      'DuckAssistBot',
      'MistralAI-User',
      'cohere-ai',
      'YouBot',
      'Bytespider',
      'CCBot',
    ],
  },
];

// Machine-only endpoints with no value in an index.
const PRIVATE_PATHS = ['/api/cron/', '/api/push/'];

export function GET() {
  const lines: string[] = ['User-agent: *', 'Allow: /', ...PRIVATE_PATHS.map((p) => `Disallow: ${p}`), ''];

  for (const group of AGENT_GROUPS) {
    lines.push(`# ${group.label}`);
    for (const agent of group.agents) lines.push(`User-agent: ${agent}`);
    lines.push('Allow: /', ...PRIVATE_PATHS.map((p) => `Disallow: ${p}`), '');
  }

  lines.push(`Sitemap: ${SITE}/sitemap.xml`, `Sitemap: ${SITE}/sitemap-index.xml`, '');

  return new Response(lines.join('\n'), {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=86400',
    },
  });
}
