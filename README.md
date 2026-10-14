# Sportivo

Sportivo is a clean, multi-sport match center and stream locator built for football, cricket, and basketball fans. It brings live match status, league navigation, personalized feeds, and streaming channels together in one place without account walls or clutter.

Live site: [sportivo.dipeshsapkota7.com.np](https://sportivo.dipeshsapkota7.com.np/)

---

## Highlights

- **Live Match Center**: Instant separation between games happening right now, upcoming kickoffs, and completed results with live badges.
- **League Breakdown**: Quick filters for Premier League, UEFA Champions League, La Liga, Serie A, Bundesliga, MLS, and international tournaments.
- **Personal Sports Desk (`/dashboard`)**: Follow specific clubs, national teams, leagues, or entire sports. Your curated feed and starred matches save automatically in your browser across sessions.
- **Timezone Scheduling**: Automatically detects your system clock and lets you switch between local time, Kathmandu time, UTC, or other major timezones on the fly.
- **Streaming Companion**: Switch between upstream servers, toggle fullscreen or picture-in-picture, and get clear stream health notices when channels are awaiting pre-match broadcast.
- **Calendar Exports**: One-click Google Calendar links and direct `.ics` file downloads for upcoming matches.
- **PWA & Offline Mode**: Installable as a Progressive Web App on phone or desktop with service worker caching.
- **SEO & AI Discovery**: Clean server-rendered HTML, complete Schema.org `SportsEvent` structured data, automated sitemaps, and full crawler compatibility.

---

## Architecture & Stack

- **Framework**: [Astro 5](https://astro.build/) in SSR mode with `@astrojs/vercel`
- **UI Islands**: React 19 + TypeScript
- **Styling**: Tailwind CSS (dark theme with mint & gold accents)
- **Data Source**: Live match feed aggregator with multi-provider fallback
- **PWA**: Service Worker caching (`sw.js`) with Web App Manifest
- **Validation**: Playwright end-to-end browser audit and automated endpoint monitor

---

## Getting Started

### Prerequisites

- Node.js 18+ (Node 20+ recommended)
- npm

### Installation

```bash
git clone https://github.com/Dszae/sportivo.git
cd sportivo
npm install
```

### Development

```bash
npm run dev
```

Open [http://localhost:4321](http://localhost:4321) in your browser.

### Build & Audit

```bash
# Check TypeScript diagnostics and generate production bundle
npm run build

# Run endpoint health checks
npm run monitor

# Run headless Playwright browser audit
npm run audit
```

---

## Project Structure

```text
├── public/                 # Static assets, PWA manifest, service worker, icons
├── scripts/
│   ├── audit.mjs           # Playwright headless browser & SEO verifier
│   ├── generate-sitemap.mjs# Dynamic sitemap & image metadata generator
│   └── monitor.mjs         # Live endpoint health monitor
├── src/
│   ├── components/
│   │   ├── MatchExplorer.tsx   # Category match browser & league filter
│   │   ├── MatchPlayer.tsx     # Stream player container & controls
│   │   ├── PersonalDashboard.tsx # Custom feed, followed teams & starred games
│   │   ├── SiteFooter.astro    # Site footer with social links & legal notes
│   │   └── SiteHeader.astro    # Global navigation bar
│   ├── layouts/
│   │   └── BaseLayout.astro    # Core HTML shell with meta tags & JSON-LD
│   ├── lib/
│   │   ├── preferences.ts      # User preferences store & event dispatcher
│   │   └── sportivo.ts         # Match types, league detection, API client
│   └── pages/
│       ├── [category]/         # Sport hubs (/football, /cricket, /basketball)
│       ├── dashboard/          # Personal sports dashboard (/dashboard)
│       ├── api/                # Internal proxy endpoints for matches & streams
│       └── index.astro         # Homepage sports desk
```

---

## Deployment

Continuous deployment is configured with Vercel. Every commit to `main` builds serverless functions for dynamic API routing and serves static assets directly from the global edge.

---

## Creator

Built by [Dipesh Sapkota](https://www.dipeshsapkota7.com.np/) &middot; [GitHub](https://github.com/Dszae) &middot; [LinkedIn](https://linkedin.com/in/dszae)
