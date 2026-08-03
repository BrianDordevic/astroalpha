// Turn data/raw/wp/*.json into db/seed.sql (D1 rows for the `pages` table).
//
// Content is cleaned on the way through rather than after import: staging URLs
// rewritten, srcset dropped, internal links made relative, empty WP spacer
// paragraphs collapsed. Anything still carrying a shortcode is flagged, not
// silently shipped.
//
//   node scripts/build-seed.mjs
import fs from 'node:fs';
import path from 'node:path';

const RAW = path.resolve('data/raw/wp');
const OUT = path.resolve('db/seed.sql');
const SITE = 'alphaefficiency.com';

const posts = JSON.parse(fs.readFileSync(path.join(RAW, 'posts.json'), 'utf8'));
const pages = JSON.parse(fs.readFileSync(path.join(RAW, 'pages.json'), 'utf8'));
const all = [...posts, ...pages];

const q = (v) =>
  v === null || v === undefined || v === '' ? 'NULL' : `'${String(v).replace(/'/g, "''")}'`;

const LOCATION_TPL = 'views/template-locations-single.blade.php';

function trackFor(item) {
  const tpl = item.template || '';
  if (tpl === LOCATION_TPL) return 'location';
  // Blade-only pages hold their markup in the theme, not the DB — they come
  // through with an empty body and must be hand-ported.
  if (tpl && !item.content?.rendered?.trim()) return 'template';
  return 'blog';
}

const stats = { shortcodes: [], staging: [], emptyBody: [] };

function cleanBody(html, item) {
  if (!html) return null;
  let s = html;

  s = s.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '');

  // Yoast and some bodies leak staging7.alphaefficiency.com; rewrite to prod
  // so the new site never ships a staging hostname.
  s = s.replace(/https?:\/\/staging\d*\.alphaefficiency\.com/gi, `https://${SITE}`);

  // We host one size per image, so srcset/sizes would point at WP-generated
  // derivatives that will not exist after the migration.
  s = s.replace(/<img\b[^>]*>/gi, (tag) => {
    const src = tag.match(/\bsrc="([^"]+)"/i)?.[1] ?? '';
    const alt = tag.match(/\balt="([^"]*)"/i)?.[1] ?? '';
    const w = tag.match(/\bwidth="(\d+)"/i)?.[1];
    const h = tag.match(/\bheight="(\d+)"/i)?.[1];
    const dim = w && h ? ` width="${w}" height="${h}"` : '';
    return `<img src="${src}" alt="${alt}"${dim} loading="lazy" decoding="async" />`;
  });

  // Internal absolute links -> relative, so staging doesn't link back to prod.
  s = s.replace(new RegExp(`https?://(?:www\\.)?${SITE.replace('.', '\\.')}/`, 'gi'), '/');

  // ...except uploads. The 11,735 media files still live on the WordPress host
  // and have not been migrated, so a relative /wp-content/uploads/ path 404s
  // and every image on the site breaks. Point those back at production until
  // media moves to R2.
  s = s.replace(/(["'(])\/wp-content\//gi, `$1https://${SITE}/wp-content/`);

  s = s.replace(/<p>(?:\s|&nbsp;|&#160;)*<\/p>/gi, '');

  if (/\[[a-z_]+[\s\]]/i.test(s)) stats.shortcodes.push(item.slug);

  return s.trim() || null;
}

const rows = all.map((item) => {
  const y = item.yoast_head_json ?? {};
  const url = new URL(item.link);
  const track = trackFor(item);
  const body = cleanBody(item.content?.rendered ?? '', item);

  if (!body && track !== 'template') stats.emptyBody.push(item.slug);

  let hero = y.og_image?.[0]?.url ?? null;
  if (hero && /staging\d*\.alphaefficiency\.com/i.test(hero)) {
    stats.staging.push(item.slug);
    hero = hero.replace(/https?:\/\/staging\d*\.alphaefficiency\.com/i, `https://${SITE}`);
  }

  const text = (item.content?.rendered ?? '').replace(/<[^>]+>/g, ' ');

  return {
    wp_id: item.id,
    // Strip any trailing slash: the site canonicalises to the bare path.
    path: url.pathname.replace(/\/$/, '') || '/',
    slug: item.slug,
    type: item.type,
    track,
    title: item.title?.rendered ?? '',
    meta_title: y.title ?? null,
    meta_description: y.description ?? null,
    canonical: (y.canonical ?? null)?.replace(/\/$/, '') ?? null,
    robots_index: String(y.robots?.index ?? 'index').includes('noindex') ? 0 : 1,
    excerpt: (item.excerpt?.rendered ?? '').replace(/<[^>]+>/g, '').trim() || null,
    body_html: body,
    hero_image: hero,
    wp_template: item.template || null,
    tags: JSON.stringify(item.tags ?? []),
    categories: JSON.stringify(item.categories ?? []),
    published_at: item.date,
    updated_at: item.modified,
    word_count: text.split(/\s+/).filter(Boolean).length,
    internal_links: (item.content?.rendered?.match(new RegExp(`href="https?://(?:www\\.)?${SITE.replace('.', '\\.')}`, 'gi')) || []).length,
    image_count: (item.content?.rendered?.match(/<img\b/gi) || []).length,
  };
});

const cols = [
  'wp_id', 'path', 'slug', 'type', 'track', 'title', 'meta_title', 'meta_description',
  'canonical', 'robots_index', 'excerpt', 'body_html', 'hero_image', 'wp_template',
  'tags', 'categories', 'published_at', 'updated_at', 'word_count', 'internal_links',
  'image_count',
];

// No BEGIN TRANSACTION/COMMIT: remote D1 is Durable Object backed and rejects
// explicit SQL transactions ("use state.storage.transaction() instead"), while
// wrapping the file in its own. Local SQLite accepts them, so this only shows
// up against --remote. Every statement is INSERT OR REPLACE, so a partial
// apply is safely re-runnable anyway.
const lines = [
  '-- Generated by scripts/build-seed.mjs. Do not edit by hand.',
  `-- ${rows.length} pages from alphaefficiency.com`,
];

// D1 rejects oversized statements (SQLITE_TOOBIG), and row count is a poor
// proxy for statement size when bodies range from 0 to ~30KB. Batch by encoded
// byte length instead so one long post can't overflow a chunk.
const MAX_STMT_BYTES = 90_000;

function batchInsert(table, columns, tuples) {
  let batch = [];
  let bytes = 0;
  const flush = () => {
    if (!batch.length) return;
    lines.push(`INSERT OR REPLACE INTO ${table} (${columns.join(',')}) VALUES\n  ${batch.join(',\n  ')};`);
    batch = [];
    bytes = 0;
  };
  for (const t of tuples) {
    const size = Buffer.byteLength(t, 'utf8');
    // A single tuple over the cap still has to go out on its own statement.
    if (bytes + size > MAX_STMT_BYTES) flush();
    batch.push(t);
    bytes += size;
  }
  flush();
}

// D1's hard limit is 100KB per SQL statement, so a page whose body alone
// exceeds that can never be inserted in one go (small-business-tools is 258KB;
// the next largest is 79KB). Those rows go in with an empty body, then the
// body is appended in chunks — lossless, and every statement stays small.
const tupleFor = (r, overrides = {}) =>
  `(${cols.map((c) => {
    const v = c in overrides ? overrides[c] : r[c];
    return typeof v === 'number' ? v : q(v);
  }).join(',')})`;

const normal = [];
const oversized = [];
for (const r of rows) {
  (Buffer.byteLength(tupleFor(r), 'utf8') > MAX_STMT_BYTES ? oversized : normal).push(r);
}

batchInsert('pages', cols, normal.map((r) => tupleFor(r)));

const CHUNK = 60_000;
for (const r of oversized) {
  lines.push(`INSERT OR REPLACE INTO pages (${cols.join(',')}) VALUES\n  ${tupleFor(r, { body_html: '' })};`);
  const body = r.body_html ?? '';
  for (let i = 0; i < body.length; i += CHUNK) {
    // COALESCE is load-bearing: the seed row starts with body_html NULL (q()
    // maps '' to NULL), and NULL || 'chunk' is NULL, which would silently
    // discard the entire body.
    lines.push(
      `UPDATE pages SET body_html = COALESCE(body_html,'') || ${q(body.slice(i, i + CHUNK))} WHERE path = ${q(r.path)};`
    );
  }
}
if (oversized.length) {
  console.log(`  oversized bodies chunked: ${oversized.map((r) => r.path).join(', ')}`);
}

// Every /slug/ variant 301s to /slug on the live site; preserve that.
batchInsert(
  'redirects',
  ['from_path', 'to_path', 'code', 'reason'],
  rows.map((r) => `('${r.path}/','${r.path}',301,'trailing-slash parity')`)
);

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, lines.join('\n') + '\n');

const byTrack = rows.reduce((a, r) => ((a[r.track] = (a[r.track] || 0) + 1), a), {});
console.log(`
  wrote ${OUT}
  ${rows.length} pages  ->  ${Object.entries(byTrack).map(([k, v]) => `${k} ${v}`).join('  ')}

  staging URLs rewritten   ${stats.staging.length}
  shortcodes still present  ${stats.shortcodes.length}${stats.shortcodes.length ? `  (${stats.shortcodes.slice(0, 5).join(', ')}${stats.shortcodes.length > 5 ? ', …' : ''})` : ''}
  unexpected empty bodies   ${stats.emptyBody.length}
`);
