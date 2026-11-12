// Scheduled trigger for the match-alerts job. The Astro worker has no scheduled()
// export, so this small worker runs on the cron schedule and calls the existing
// HTTP endpoint on the site (same job that vercel.json used to schedule).
const TARGET = 'https://sportivo.dipeshsapkota7.com.np/api/cron/match-alerts/';

export default {
  async scheduled(_event, _env, ctx) {
    ctx.waitUntil(
      fetch(TARGET, {
        headers: { 'User-Agent': 'sportivo-cron/1.0' },
        redirect: 'follow',
      }).then((res) => {
        if (!res.ok) console.error(`match-alerts returned ${res.status}`);
      })
    );
  },

  async fetch() {
    return new Response('Not found', { status: 404 });
  },
};
