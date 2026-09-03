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

export const onRequest = defineMiddleware(async (context, next) => {
  const shouldCache = !IS_PROD && context.request.method === 'GET'
    && !context.request.headers.has('Authorization')
    && !context.request.headers.has('Cookie');
  const edgeCache = shouldCache && typeof caches !== 'undefined' ? caches.default : null;

  if (edgeCache) {
    const cached = await edgeCache.match(context.request).catch(() => undefined);
    if (cached) {
      const response = new Response(cached.body, cached);
      response.headers.set('X-AE-Edge-Cache', 'HIT');
      return response;
    }
  }

  const response = await next();

  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

  if (!IS_PROD) {
    response.headers.set('X-Robots-Tag', 'noindex, nofollow');

    // Keep the stable staging URL fresh without sending every repeat request
    // back through Astro and D1. A one-minute shared cache bounds deployment
    // staleness while stale-while-revalidate prevents crawler bursts from
    // stampeding the database.
    response.headers.set(
      'Cache-Control',
      'public, max-age=0, s-maxage=60, stale-while-revalidate=300'
    );

    if (edgeCache && response.status === 200 && !response.headers.has('Set-Cookie')) {
      response.headers.set('X-AE-Edge-Cache', 'MISS');
      // Cache failure must never turn a successful page response into an error.
      await edgeCache.put(context.request, response.clone()).catch(() => {});
    }
  }

  return response;
});
