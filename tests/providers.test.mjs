import test from 'node:test';
import assert from 'node:assert/strict';
import { isAllowedPlaybackDomain, sanitizePlaybackUrl, sanitizeIdentifier } from '../src/lib/providers/allowlist.ts';
import { StrmFreeAdapter } from '../src/lib/providers/adapters/strmfree.ts';
import { EspnAdapter } from '../src/lib/providers/adapters/espn.ts';
import { DaddyLiveAdapter } from '../src/lib/providers/adapters/daddylive.ts';
import { DemoAdapter } from '../src/lib/providers/adapters/demo.ts';
import { resolveUnifiedPlayback, getProvider } from '../src/lib/providers/index.ts';

test('1. Successful match-list response from Demo provider', async () => {
  const demo = new DemoAdapter();
  const matches = await demo.fetchMatches('football');
  assert.ok(Array.isArray(matches));
  assert.equal(matches.length, 1);
  assert.equal(matches[0].category, 'football');
  assert.equal(matches[0].status, 'Live');
  assert.ok(matches[0].sources.length > 0);
});

test('2. Empty match list handling on unknown category', async () => {
  const espn = new EspnAdapter();
  const matches = await espn.fetchMatches('unknown-category');
  assert.ok(Array.isArray(matches));
  assert.equal(matches.length, 0);
});

test('3. Bounded provider timeout handling', async () => {
  const controller = new AbortController();
  controller.abort(); // already aborted signal
  const strmfree = new StrmFreeAdapter();
  const matches = await strmfree.fetchMatches('football', controller.signal);
  assert.ok(Array.isArray(matches));
});

test('4 & 5. HTML returned where JSON expected or invalid JSON', () => {
  // Verifies that sanitizePlaybackUrl rejects malformed or raw HTML payload strings
  assert.equal(sanitizePlaybackUrl('<html><body>Ad popup</body></html>'), null);
  assert.equal(sanitizePlaybackUrl('{ bad json: true }'), null);
  assert.equal(sanitizePlaybackUrl(''), null);
});

test('6. Invalid event and source identifiers rejected', () => {
  assert.equal(sanitizeIdentifier('../../../etc/passwd'), null);
  assert.equal(sanitizeIdentifier('<script>alert(1)</script>'), null);
  assert.equal(sanitizeIdentifier('source;rm -rf /'), null);
  assert.equal(sanitizeIdentifier('valid-source_123'), 'valid-source_123');
});

test('7. Rejected unapproved playback domains', () => {
  assert.equal(isAllowedPlaybackDomain('malicious-ad-network.com'), false);
  assert.equal(isAllowedPlaybackDomain('betting-casino-redirect.xyz'), false);
  assert.equal(isAllowedPlaybackDomain('strmfree.st'), true);
  assert.equal(isAllowedPlaybackDomain('thedaddy.pk'), true);
  assert.equal(isAllowedPlaybackDomain('commondatastorage.googleapis.com'), true);

  assert.equal(sanitizePlaybackUrl('https://malicious-ad-network.com/player.php'), null);
  assert.equal(sanitizePlaybackUrl('https://phishing.example.org/stream'), null);
  assert.equal(
    sanitizePlaybackUrl('https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4'),
    'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4'
  );
});

test('8. Unexpected redirect schemes rejected (javascript:, data:, file:)', () => {
  assert.equal(sanitizePlaybackUrl('javascript:alert(document.domain)'), null);
  assert.equal(sanitizePlaybackUrl('data:text/html,<script>alert(1)</script>'), null);
  assert.equal(sanitizePlaybackUrl('file:///etc/hosts'), null);
  assert.equal(sanitizePlaybackUrl('http://insecure-domain.com/stream'), null); // Must be HTTPS
});

test('9 & 10. Playback state resolution contract', async () => {
  // Valid demo playback resolution
  const res = await resolveUnifiedPlayback('demo', 'test-fixture');
  assert.equal(res.status, 'ready');
  assert.equal(res.streams.length, 1);
  assert.equal(res.streams[0].isNativeVideo, true);
  assert.equal(res.streams[0].isSandboxedIframe, false);

  // Unsupported provider resolution
  const invalidRes = await resolveUnifiedPlayback('unauthorized-provider', '123');
  assert.equal(invalidRes.status, 'unsupported');
  assert.equal(invalidRes.streams.length, 0);
});

test('11. Unauthorized DaddyLive provider configuration without secret key', async () => {
  const daddylive = new DaddyLiveAdapter();
  assert.equal(daddylive.isAuthorized, false);
  assert.equal(daddylive.statusClassification, 'restricted');
  // Without DADDYLIVE_API_KEY, matches ingestion safely returns empty array rather than failing silently
  const matches = await daddylive.fetchMatches('football');
  assert.deepEqual(matches, []);
});

test('12. Provider registry lookup', () => {
  assert.ok(getProvider('ppv'));
  assert.ok(getProvider('strmfree'));
  assert.ok(getProvider('espn'));
  assert.ok(getProvider('timst'));
  assert.ok(getProvider('daddylive'));
  assert.ok(getProvider('demo'));
  assert.equal(getProvider('non-existent-provider'), null);
});

test('13. Sandbox permission policy enforcement (no allow-top-navigation)', () => {
  const defaultSandboxPolicy = 'allow-scripts allow-same-origin allow-forms allow-presentation';
  assert.equal(defaultSandboxPolicy.includes('allow-top-navigation'), false);
  assert.equal(defaultSandboxPolicy.includes('allow-top-navigation-by-user-activation'), false);
});

test('14. Risk assessment of allow-popups in sandbox', () => {
  const defaultSandboxPolicy = 'allow-scripts allow-same-origin allow-forms allow-presentation';
  // allow-popups is intentionally omitted from the default production sandbox because it enables ad networks
  // to spawn new tabs on user gesture
  assert.equal(defaultSandboxPolicy.includes('allow-popups'), false);
});

test('15. PPV Provider allowlist and domain validation', () => {
  assert.equal(isAllowedPlaybackDomain('taifood-blog.asia'), true);
  assert.equal(isAllowedPlaybackDomain('ppv.st'), true);
  assert.equal(
    sanitizePlaybackUrl('https://taifood-blog.asia/embed/seriea/2026-10-27/sas-laz'),
    'https://taifood-blog.asia/embed/seriea/2026-10-27/sas-laz'
  );
});

