import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import cloudflare from '@astrojs/cloudflare';

export default defineConfig({
  site: 'https://sportivo.dipeshsapkota7.com.np',
  output: 'server',
  trailingSlash: 'always',
  adapter: cloudflare(),
  integrations: [react()],
  security: {
    checkOrigin: true,
  },
});