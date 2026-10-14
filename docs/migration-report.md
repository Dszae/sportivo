# Astro Migration Report

## Migrated routes

- `/` renders the live category overview and fixture links from Astro server HTML.
- `/football/`, `/cricket/`, and `/basketball/` render category-specific fixture HTML and hydrate only the search island.
- `/:category/match/:slug/` renders match metadata server-side and hydrates only stream playback/server selection.
- `/about-dipesh-sapkota/` and `/api-docs/` are Astro content pages.
- `/robots.txt` is an Astro endpoint; `/sitemap.xml` is generated from the real upstream payload during `npm run build`.
- `/api/matches/:category` and `/api/stream/:source/:id` are same-origin Astro API routes.
- Unknown category and match pages return HTTP 404 with an actual not-found body.

## Preserved behavior

- Football, cricket, and basketball data still comes from the public `streamed.pk` API.
- Fixture titles, statuses, provider timestamps, Nepal time formatting, team/poster fallbacks, match slugs, source validation, HLS video, external iframe playback, and alternate server selection remain supported.
- Existing visual tokens, dark Sportivo palette, responsive layout, keyboard-visible focus states, creator page, API docs, robots directives, canonical metadata, Open Graph tags, and security headers remain in the migrated structure.
- Original Vite files remain in the repository as a recoverable reference until the Astro deployment is verified.

## Verification

Verified locally:

- `npx astro check`: 0 errors, 0 warnings, 0 hints.
- `npm run build`: successful Astro Vercel server build; sitemap generation produced 170 URLs from the current upstream response.
- `npm run audit` exercised the development server and verified raw HTML, metadata, internal links, robots, sitemap, crawler user agent, 404 body behavior, mobile layout, fixture cards, and search empty-state interaction with Playwright/Chromium.
- Generated `public/sitemap.xml`: valid XML with 170 real URLs.

Not yet verified:

- A production preview command is unavailable because `@astrojs/vercel` does not support `astro preview`; use `vercel dev` or a deployed Vercel preview for runtime verification.
- The live production domain is still serving the previous Vite deployment. Its audit currently reports a soft 200 for an unknown route, so deployment migration and post-deploy audit are still pending.
- Stream playback against a real provider source was not exercised because source availability changes with the upstream data.

## Deployment

1. Commit and push the Astro source, `package-lock.json`, and `astro.config.mjs`.
2. Deploy the project through Vercel with the repository root as the project root.
3. Vercel should run `npm run build`; the Astro Vercel adapter emits the server function and static assets.
4. Run `SPORTIVO_URL=https://sportivo.dipeshsapkota7.com.np npm run audit` after deployment.
5. Test a category page, a current match URL, `/api/matches/football`, `/robots.txt`, `/sitemap.xml`, and a nonexistent URL before treating the migration as complete.