// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import vue from '@astrojs/vue';
import { SITE } from './src/data/site.js';

export default defineConfig({
  site: SITE.url,
  trailingSlash: 'always',
  integrations: [vue(), sitemap()],
});
