import type { APIRoute } from 'astro';

// @astrojs/sitemap only sees prerendered routes, and every page here is served
// from D1 — so it would emit an empty sitemap. This builds the real one from
// the database instead, which also means new pages appear without a rebuild.
export const prerender = false;

const SITE = 'https://alphaefficiency.com';

export const GET: APIRoute = async ({ locals }) => {
  const db = locals.runtime?.env?.DB;
  if (!db) return new Response('D1 binding missing', { status: 500 });

  // noindex pages are excluded: listing a page we tell Google not to index is
  // a contradictory signal.
  const { results } = await db
    .prepare(
      `SELECT path, updated_at
         FROM pages
        WHERE status = 'published' AND robots_index = 1
        ORDER BY path`
    )
    .all<{ path: string; updated_at: string }>();

  const urls = (results ?? [])
    .map((r) => {
      const loc = `${SITE}${r.path === '/' ? '' : r.path}`;
      const lastmod = (r.updated_at ?? '').slice(0, 10);
      return `  <url><loc>${loc}</loc>${lastmod ? `<lastmod>${lastmod}</lastmod>` : ''}</url>`;
    })
    .join('\n');

  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`,
    { headers: { 'Content-Type': 'application/xml; charset=utf-8' } }
  );
};
