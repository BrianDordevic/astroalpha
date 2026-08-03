// @ts-check
import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';
import sitemap from '@astrojs/sitemap';

// SITE_URL lets the staging build brand itself as dev.alphaefficiency.com while
// production builds emit production canonicals. Getting this wrong is how a
// staging deploy ends up canonicalising to itself and competing in the index.
const SITE = process.env.SITE_URL ?? 'https://alphaefficiency.com';
const IS_PROD = SITE === 'https://alphaefficiency.com';

export default defineConfig({
  site: SITE,

  // The live WordPress site serves /slug with NO trailing slash and 301s
  // /slug/ -> /slug. Both settings below are required to match that exactly;
  // changing either silently forfeits URL parity on all 1,269 pages.
  trailingSlash: 'never',
  build: { format: 'file' },

  output: 'static',

  // Only production gets a sitemap. A crawlable staging sitemap is the fastest
  // way to duplicate the entire site into Google's index.
  integrations: IS_PROD ? [sitemap({ filter: (page) => !page.includes('/thank-you') })] : [],

  session: { driver: 'memory' },

  adapter: cloudflare({
    platformProxy: { enabled: true }, // D1 binding available in `astro dev`
    imageService: 'compile',
  }),
});
