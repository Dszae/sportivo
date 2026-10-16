import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import vercel from '@astrojs/vercel';

export default defineConfig({
  site: 'https://sportivo.dipeshsapkota7.com.np',
  output: 'server',
  trailingSlash: 'always',
  adapter: vercel(),
  integrations: [react()],
  security: {
    checkOrigin: true,
  },
});