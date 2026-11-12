const baseUrl = process.env.SPORTIVO_URL || 'https://sportivo.dipeshsapkota7.com.np';
const paths = [
  '/',
  '/football/',
  '/cricket/',
  '/basketball/',
  '/robots.txt',
  '/sitemap.xml',
  '/llms.txt',
  '/api-docs/',
  '/dashboard/',
  '/api/matches/football/',
  '/api/matches/cricket/',
  '/api/matches/basketball/',
  '/api/cron/match-alerts/',
];

async function fetchWithRetry(url, maxRetries = 2) {
  let lastError = null;
  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    try {
      const response = await fetch(url, {
        redirect: 'follow',
        signal: AbortSignal.timeout(10000),
      });
      if (response.ok || attempt === maxRetries + 1) {
        return response;
      }
    } catch (err) {
      lastError = err;
    }
    if (attempt <= maxRetries) {
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }
  }
  throw lastError || new Error(`Failed to fetch ${url} after ${maxRetries + 1} attempts`);
}

let failures = 0;
for (const path of paths) {
  const started = performance.now();
  try {
    let requestPath = path;
    let response = await fetchWithRetry(`${baseUrl}${requestPath}`);
    if (path === '/api-docs/' && !response.ok && baseUrl.includes('127.0.0.1')) {
      requestPath = '/api-docs.html';
      response = await fetchWithRetry(`${baseUrl}${requestPath}`);
    }

    const body = await response.text();
    const elapsed = Math.round(performance.now() - started);
    const isApi = path.startsWith('/api/');
    let detail = `${body.length} bytes`;

    const errors = [];
    if (!response.ok) {
      errors.push(`HTTP status ${response.status}`);
    }

    if (path === '/robots.txt' && (!body.includes('User-agent') && !body.includes('Allow'))) {
      errors.push("Missing robots directives ('User-agent' or 'Allow')");
    }
    if (path === '/sitemap.xml' && !body.includes('<urlset')) {
      errors.push("Missing '<urlset' in XML");
    }
    if (path === '/llms.txt' && !body.includes('Sportivo')) {
      errors.push("Missing 'Sportivo' in llms.txt");
    }
    if (path === '/api-docs/' && !body.includes('Sportivo')) {
      errors.push("Missing 'Sportivo' in api-docs");
    }
    if (path === '/dashboard/' && !body.includes('Sportivo') && !body.includes('Watchlist')) {
      errors.push("Missing 'Sportivo' or 'Watchlist' on dashboard");
    }
    if (path === '/' && !body.includes('Sportivo')) {
      errors.push("Missing 'Sportivo' in root HTML");
    }
    if (['/football/', '/cricket/', '/basketball/'].includes(path) && !body.includes('Sportivo') && !body.includes('fixtures')) {
      errors.push("Missing 'Sportivo' or 'fixtures' on sports page");
    }

    if (isApi) {
      try {
        const data = JSON.parse(body);
        detail = Array.isArray(data) ? `${data.length} fixtures` : 'JSON object';
        if (path !== '/api/cron/match-alerts/' && !Array.isArray(data)) {
          errors.push('Expected JSON array of fixtures');
        }
      } catch {
        detail = 'invalid JSON';
        errors.push('Invalid JSON payload');
      }
    }

    if (errors.length > 0) {
      failures++;
      console.error(`ERR ${response.status} ${elapsed}ms ${path} (${detail}) -> Issues: ${errors.join(', ')}`);
    } else {
      console.log(`OK  ${response.status} ${elapsed}ms ${path} (${detail})`);
    }
  } catch (error) {
    failures++;
    console.error(`ERR ${path}: ${error.message}`);
  }
}

// AI and search crawlers must never be challenged or denied. A CDN bot rule
// (for example Cloudflare "Block AI bots") shows up here as a 403 for the
// crawler user agent while the plain request above still passes.
const crawlerAgents = {
  Googlebot: 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
  Bingbot: 'Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)',
  GPTBot: 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; GPTBot/1.2; +https://openai.com/gptbot)',
  'OAI-SearchBot': 'Mozilla/5.0 (compatible; OAI-SearchBot/1.0; +https://openai.com/searchbot)',
  'ChatGPT-User': 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; ChatGPT-User/1.0; +https://openai.com/bot',
  ClaudeBot: 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; ClaudeBot/1.0; +claudebot@anthropic.com)',
  'Claude-User': 'Mozilla/5.0 (compatible; Claude-User/1.0; +Claude-User@anthropic.com)',
  PerplexityBot: 'Mozilla/5.0 (compatible; PerplexityBot/1.0; +https://perplexity.ai/perplexitybot)',
  'Perplexity-User': 'Mozilla/5.0 (compatible; Perplexity-User/1.0; +https://perplexity.ai/perplexity-user)',
};
const crawlerPaths = ['/', '/npl/', '/robots.txt', '/llms.txt'];

for (const [name, userAgent] of Object.entries(crawlerAgents)) {
  for (const path of crawlerPaths) {
    try {
      const response = await fetch(`${baseUrl}${path}`, {
        headers: { 'User-Agent': userAgent },
        redirect: 'follow',
        signal: AbortSignal.timeout(10000),
      });
      const body = await response.text();
      const challenged = /Just a moment|Attention Required|cf-chl-|Access denied/i.test(body.slice(0, 4000));
      const blockedByHeader = /noindex|none/i.test(response.headers.get('x-robots-tag') || '');
      if (!response.ok || challenged || blockedByHeader) {
        failures++;
        const reason = !response.ok ? `HTTP status ${response.status}` : challenged ? 'bot challenge page' : 'noindex X-Robots-Tag';
        console.error(`ERR crawler ${name} ${path} -> ${reason}`);
      }
    } catch (error) {
      failures++;
      console.error(`ERR crawler ${name} ${path}: ${error.message}`);
    }
  }
  console.log(`OK  crawler ${name} checked on ${crawlerPaths.length} paths`);
}

if (failures > 0) {
  console.error(`Monitor failed with ${failures} issue(s).`);
  process.exitCode = 1;
} else {
  console.log('Monitor passed: all public routes and endpoints are healthy.');
}
