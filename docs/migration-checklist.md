# Sportivo Next.js Migration Baseline

## Current behavior

- The repository is a React 19 + Vite application deployed to Vercel.
- The client reads `/api/matches/:category`, where the current production rewrite proxies to `https://streamed.pk/api/matches/:category`.
- Supported categories are `football`, `cricket`, and `basketball`.
- Fixture payloads are JSON arrays. The UI tolerates `title` or `name`, status fields, timestamps, team logos, poster/image fields, and `sources`.
- Selecting a fixture updates the URL with `?match=<slug>` and requests the first source from `/api/stream/:source/:id`.
- Stream responses may be arrays, objects, or objects whose `contents` field contains JSON. Only HTTP(S) URLs without credentials are rendered.
- HLS URLs containing `.m3u8` use a video element; other validated URLs use a sandboxless external iframe with fullscreen and media permissions.
- The app formats valid event timestamps as `en-NP` in `Asia/Kathmandu` and reports missing, offline, or invalid stream data instead of inventing a source.
- Existing public routes are `/`, `/football/`, `/cricket/`, `/basketball/`, `/about-dipesh-sapkota/`, `/api-docs/`, and generated `/category/match/slug/` fixture pages.
- Existing public machine-readable routes are `/robots.txt`, `/sitemap.xml`, `/llms.txt`, and `/api/matches/:category`.

## Current rendering and deployment

- The Vite HTML shell contains a large static SEO section, while the interactive fixture list is rendered by the browser after React starts.
- `scripts/prerender.mjs` fetches the upstream API during `npm run build`, injects fixture links and metadata into `dist`, and writes generated category and match pages.
- `api/match.js` serves a small HTML fallback for generated match URLs and looks up the current fixture from the upstream category response.
- `api/matches/[category].js` is a serverless same-origin proxy with category validation, a 10-second timeout, upstream JSON validation, and a 60-second stale-while-revalidate cache.
- Other `/api/*` paths are currently handled by the Vercel rewrite to `streamed.pk`.
- No application environment variables or private API credentials were found in the source inventory.

## Features to preserve

- Category navigation and normal HTML discovery links.
- Server-visible fixture titles, statuses, local times, and match links.
- Search by fixture title/category.
- Keyboard-accessible fixture cards.
- Shareable query-string fixture selection and existing category match URL shape.
- Stream loading, HLS playback, iframe playback, server selection, and graceful error states.
- Responsive dark Sportivo visual language and existing security headers.
- Creator page, API documentation, robots, sitemap, llms, canonical metadata, Open Graph metadata, and structured data where it describes visible content.

## Known limitations to verify during migration

- Live fixture data can change or disappear upstream; generated pages must not imply freshness beyond their generation time.
- The upstream service is public and has no documented application-level SLA in this repository.
- Stream availability is supplied by the upstream provider and is not guaranteed.
- The current cricket payload observed in generated output contains provider channels with epoch-like timestamps; this must remain visibly honest rather than being treated as a real kickoff time.
- The Vite source, generated `dist`, and static public pages have overlapping SEO content. The Next app must become the single production entry point without deleting the original files until verification is complete.

## Migration checklist

- [ ] Keep the Vite implementation recoverable while Next routes are built.
- [ ] Add Next App Router, TypeScript, and Tailwind configuration.
- [ ] Fetch fixtures in Server Components with explicit revalidation and honest fallback states.
- [ ] Add client-only search and stream controls without wrapping the whole page in a client component.
- [ ] Add server-rendered category and match pages with correct 404 behavior.
- [ ] Preserve API contracts and same-origin stream proxy behavior.
- [ ] Add Next metadata, robots, sitemap, Open Graph, breadcrumbs, and accurate structured data.
- [ ] Add security headers and image/iframe policy compatible with validated provider URLs.
- [ ] Add a raw-HTML crawler audit and browser interaction audit.
- [ ] Build and audit the local production server before switching deployment configuration.
- [ ] Audit the deployed site separately; do not claim deployment or indexing success without observed results.