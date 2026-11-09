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

if (failures > 0) {
  console.error(`Monitor failed with ${failures} issue(s).`);
  process.exitCode = 1;
} else {
  console.log('Monitor passed: all public routes and endpoints are healthy.');
}
