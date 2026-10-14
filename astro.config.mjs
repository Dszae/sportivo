import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';
import vercel from '@astrojs/vercel';

export default defineConfig({
  site: 'https://sportivo.dipeshsapkota7.com.np',
  output: 'server',
  adapter: vercel(),
  integrations: [react(), sitemap()],
  security: {
    checkOrigin: true,
  },
});