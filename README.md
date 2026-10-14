# Sportivo

Sportivo is a focused sports fixture desk for discovering football, cricket, and basketball matches, checking local kickoff times, and opening available stream sources from one responsive interface.

<p align="center">
	<a href="https://sportivo.dipeshsapkota7.com.np/"><strong>Visit Sportivo</strong></a>
	&nbsp;&middot;&nbsp;
	<a href="https://sportivo.dipeshsapkota7.com.np/football/">Browse football</a>
	&nbsp;&middot;&nbsp;
	<a href="https://sportivo.dipeshsapkota7.com.np/cricket/">Browse cricket</a>
</p>

## Product Demo

![Sportivo launch demo](public/sportivo-demo.gif)

## Features

- **Smart Live Match Center**: Clear separation of Live (with pulsing badges), Upcoming, and Final fixtures with automatic sync and manual refresh.
- **League-Wise Competitions**: Dedicated tabs and filter pills for Champions League, Premier League, La Liga, Bundesliga, Serie A, MLS, and other competitions.
- **Adaptive Timezone Engine**: One-click toggle between Nepal Standard Time (NST) and visitor's detected local timezone (persisted in local storage).
- **Match Calendar & Date Navigation**: Filter fixtures by Today, Tomorrow, or Next 7 Days.
- **Personalized Watchlist (Favorites)**: Star fixtures to build a custom schedule feed stored locally with zero mandatory account sign-up.
- **Match Companion & Calendar Integration**: Matchrooms include live countdowns, Add to Google Calendar, and one-click `.ics` iCalendar download.
- **Reliable Streaming Player**: Responsive player supporting fullscreen, server switching, PiP, and clear pre-match signal notices.
- **Low-Data Mode**: Lightweight text-first mode that disables heavy media posters to preserve bandwidth on mobile networks.
- **PWA & Offline Fallback**: Installable Progressive Web App with service worker caching and dedicated offline fallback route.
- **Full Search Engine & AI Accessibility**: Indexable SSR HTML, Schema.org SportsEvent & BreadcrumbList JSON-LD, crawlable sitemaps, and robots.txt.

## Tech Stack

- **Framework**: Astro 5 (Server Output via `@astrojs/vercel`)
- **UI Components**: React 19 + TypeScript
- **Styling**: Tailwind CSS
- **PWA**: Web App Manifest & Service Worker (`sw.js`)
- **SEO & Structured Data**: Schema.org, Open Graph, Twitter Cards, Sitemap Index
- **Testing & Auditing**: Playwright browser tests, automated endpoint monitoring (`scripts/monitor.mjs` and `scripts/audit.mjs`)

## Local Development

```bash
npm install
npm run dev
```

For building and auditing:

```bash
npm run build
npm run monitor
npm run audit
```

## Production Deployment

Sportivo is hosted on Vercel with high-availability edge routing:

**https://sportivo.dipeshsapkota7.com.np/**

## Author

Built by [Dipesh Sapkota](https://www.dipeshsapkota7.com.np/).

