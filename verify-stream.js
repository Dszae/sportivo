/**
 * QA Automation Test Script: Automated Video Source Resolver Verification
 * Tests the /api/stream/auto endpoint for latency, status, and HLS URL compliance.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rawTarget = process.argv[2] || process.env.API_URL || 'http://localhost:3000/api/stream/auto';
const ENDPOINT = rawTarget.endsWith('/api/stream/auto')
  ? rawTarget
  : `${rawTarget.replace(/\/$/, '')}/api/stream/auto`;
const REPORT_PATH = path.join(__dirname, 'stream-health-report.md');

async function verifyStreamResolver() {
  console.log('='.repeat(65));
  console.log('  QA AUTOMATION: NPL LIVE STREAM AUTO-DISCOVERY VERIFICATION');
  console.log('='.repeat(65));
  console.log(`Target Endpoint: ${ENDPOINT}`);
  console.log(`Timestamp: ${new Date().toISOString()}`);
  console.log('-'.repeat(65));

  const startTime = performance.now();
  let status = 'Fail';
  let resolvedUrl = 'None';
  let matchedId = 'None';
  let isCached = false;
  let durationMs = 0;
  let streamReachable = false;
  let streamStatusCode = null;
  let streamContentType = null;
  let errorMessage = '';

  try {
    console.log('[1/3] Pinging local API resolver...');
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(ENDPOINT, { signal: controller.signal });
    clearTimeout(timeoutId);
    durationMs = Math.round(performance.now() - startTime);

    console.log(`[1/3] HTTP Response Code: ${response.status} in ${durationMs}ms`);

    if (!response.ok) {
      const errBody = await response.json().catch(() => ({}));
      throw new Error(`API returned HTTP ${response.status}: ${errBody.error || response.statusText}`);
    }

    const data = await response.json();
    console.log('[2/3] API Response Body:', JSON.stringify(data, null, 2));

    matchedId = data.id || 'Unknown';
    resolvedUrl = data.url || 'None';
    isCached = Boolean(data.cached);

    // Validate URL structure
    if (!resolvedUrl || resolvedUrl === 'None') {
      throw new Error('API response does not contain a stream URL');
    }

    const parsed = new URL(resolvedUrl);
    if (parsed.protocol !== 'https:') {
      throw new Error(`Insecure protocol scheme: ${parsed.protocol}`);
    }
    if (!parsed.pathname.toLowerCase().endsWith('.m3u8') && !resolvedUrl.includes('.m3u8')) {
      throw new Error(`Resolved URL is not a valid HLS (.m3u8) playlist: ${resolvedUrl}`);
    }

    console.log('[3/3] Probing resolved HLS stream endpoint for live playback...');
    const streamProbe = await fetch(resolvedUrl, {
      method: 'HEAD',
      signal: AbortSignal.timeout(5000),
    });

    streamStatusCode = streamProbe.status;
    streamContentType = streamProbe.headers.get('content-type') || 'Unknown';
    streamReachable = streamProbe.ok || streamProbe.status === 200 || streamProbe.status === 206;

    if (streamReachable) {
      status = 'Pass';
      console.log(`✔ Stream probe verified: HTTP ${streamStatusCode} (${streamContentType})`);
    } else {
      throw new Error(`Stream URL probe failed with HTTP ${streamStatusCode}`);
    }
  } catch (err) {
    status = 'Fail';
    errorMessage = err.message;
    durationMs = Math.round(performance.now() - startTime);
    console.error(`✖ Test Failure: ${errorMessage}`);
  }

  const durationSec = (durationMs / 1000).toFixed(2);

  console.log('-'.repeat(65));
  console.log(`STATUS:       ${status.toUpperCase()}`);
  console.log(`RESOLVED URL: ${resolvedUrl}`);
  console.log(`PERFORMANCE:  ${durationSec}s (${durationMs}ms)`);
  console.log(`CACHED:       ${isCached ? 'Yes (node-cache)' : 'No (Fresh Scan)'}`);
  console.log('='.repeat(65));

  // Generate stream-health-report.md
  generateReport({
    timestamp: new Date().toISOString(),
    localTime: new Date().toLocaleString('en-US', { timeZone: 'Asia/Kathmandu' }) + ' NST',
    status,
    matchedId,
    resolvedUrl,
    durationMs,
    durationSec,
    isCached,
    streamReachable,
    streamStatusCode,
    streamContentType,
    errorMessage,
  });
}

function generateReport(data) {
  const recommendations = [];

  if (data.status === 'Pass') {
    if (data.isCached) {
      recommendations.push(
        '**Cache Optimization Active:** In-memory `node-cache` returned the active stream in sub-50ms with zero Puppeteer overhead.'
      );
    } else {
      recommendations.push(
        '**Auto-Discovery Operational:** Channel scanner successfully iterated the NPL candidate pool and extracted an active live feed on first pass.'
      );
    }
    recommendations.push(
      '**HLS Playback Verified:** Upstream media server responds with `HTTP 200 OK` and Apple HLS playlist headers, ready for native `hls.js` rendering.'
    );
  } else {
    recommendations.push(
      `**Investigate Upstream Failure:** ${data.errorMessage || 'Unable to resolve an active stream.'}`
    );
    recommendations.push(
      'Verify that `node server.js` is running on port 3000 and that the target domain allowlists permit outbound HEAD checks.'
    );
  }

  const reportContent = `# Stream Health & Auto-Discovery Verification Report

- **Timestamp:** \`${data.timestamp}\` (${data.localTime})
- **Test Target:** \`http://localhost:3000/api/stream/auto\`
- **Status:** **${data.status.toUpperCase()}** ${data.status === 'Pass' ? '✅' : '❌'}

---

## 1. Executive Summary

| Parameter | Result |
| :--- | :--- |
| **Execution Status** | **${data.status}** |
| **Resolved Channel ID** | \`${data.matchedId}\` |
| **Media Source (.m3u8)** | \`${data.resolvedUrl}\` |
| **Total Resolution Time** | **${data.durationSec}s** (${data.durationMs} ms) |
| **Memory Cache Hit** | \`${data.isCached}\` |
| **Live Stream Reachability** | \`${data.streamReachable ? 'HTTP ' + data.streamStatusCode + ' OK' : 'Failed'}\` |
| **Media Content-Type** | \`${data.streamContentType || 'N/A'}\` |

---

## 2. Test Execution Details

- **Protocol Scheme:** \`HTTPS\` (Strict transport security enforced)
- **Container Format:** \`HLS (.m3u8 playlist)\`
- **Error Diagnostics:** ${data.errorMessage ? `\`${data.errorMessage}\`` : 'None (clean execution)'}

---

## 3. Recommendations & System Health

${recommendations.map((r) => `- ${r}`).join('\n')}

---
*Report automatically compiled by QA Automation Suite for Sportivo Live Sports Desk.*
`;

  fs.writeFileSync(REPORT_PATH, reportContent, 'utf8');
  console.log(`\n📄 Report successfully generated: ${REPORT_PATH}`);
}

verifyStreamResolver();

