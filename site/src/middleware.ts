import { defineMiddleware } from 'astro:middleware';

// Cloudflare's _headers file only applies to *static assets*. Every route on
// this site is server-rendered from D1, so _headers never runs — which left
// sitemap.xml (an SSR route with no meta robots tag) indexable on staging even
// though the HTML pages were correctly marked noindex.
//
// Middleware is the only layer that sees every SSR response, so the staging
// guard belongs here.
const SITE = import.meta.env.SITE ?? 'https://alphaefficiency.com';
const IS_PROD = SITE === 'https://alphaefficiency.com';

export const onRequest = defineMiddleware(async (_context, next) => {
  const response = await next();

  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

  if (!IS_PROD) {
    response.headers.set('X-Robots-Tag', 'noindex, nofollow');

    // Staging must always show the newest deploy on the one stable URL.
    // Without this Cloudflare edge-caches the HTML and the project URL keeps
    // serving an older build, which forces everyone onto per-deployment hash
    // URLs to see their own changes. Assets stay cached — this only covers
    // documents, which is what goes stale visibly.
    response.headers.set('Cache-Control', 'no-store, must-revalidate');
  }

  return response;
});
