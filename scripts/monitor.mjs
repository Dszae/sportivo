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
  '/api/matches/football',
  '/api/matches/cricket',
  '/api/matches/basketball',
];

let failures = 0;
for (const path of paths) {
  const started = performance.now();
  try {
    let requestPath = path;
    let response = await fetch(`${baseUrl}${requestPath}`, { redirect: 'follow' });
    if (path === '/api-docs/' && !response.ok && baseUrl.includes('127.0.0.1')) {
      requestPath = '/api-docs.html';
      response = await fetch(`${baseUrl}${requestPath}`, { redirect: 'follow' });
    }
    const body = await response.text();
    const elapsed = Math.round(performance.now() - started);
    const isApi = path.startsWith('/api/');
    let detail = `${body.length} bytes`;
    const contentType = response.headers.get('content-type') || '';
    if (path === '/robots.txt' && (!contentType.includes('text/plain') || !body.includes('OAI-SearchBot'))) failures++;
    if (path === '/sitemap.xml' && (!contentType.includes('xml') || !body.includes('<urlset'))) failures++;
    if (path === '/llms.txt' && (!contentType.includes('text/plain') || !body.startsWith('# Sportivo'))) failures++;
    if (path === '/api-docs/' && (!body.includes('Sportivo Public Fixture API') || !contentType.includes('text/html'))) failures++;
    if (path === '/dashboard/' && (!body.includes('Personal Sports Desk') || !body.includes('<h1'))) failures++;
    if (path === '/' && !body.includes('Sportivo by Dipesh Sapkota')) failures++;
    if (['/football/', '/cricket/', '/basketball/'].includes(path) && (!body.includes('<h1') || !body.includes('fixtures'))) failures++;
    if (isApi) {
      try {
        const data = JSON.parse(body);
        detail = Array.isArray(data) ? `${data.length} fixtures` : 'JSON object';
        if (!Array.isArray(data)) failures++;
      } catch {
        detail = 'invalid JSON';
        failures++;
      }
    }
    if (!response.ok) failures++;
    console.log(`${response.ok ? 'OK ' : 'ERR'} ${response.status} ${elapsed}ms ${path} (${detail})`);
  } catch (error) {
    failures++;
    console.error(`ERR ${path}: ${error.message}`);
  }
}

if (failures > 0) {
  console.error(`Monitor failed with ${failures} issue(s).`);
  process.exitCode = 1;
} else {
  console.log('Monitor passed.');
}
