// Pull every post/page (and the taxonomies + media they reference) out of the
// live WordPress install into data/raw/wp/. Read-only against production.
//
// Yoast ships its SEO fields inline as `yoast_head_json`, so unlike the
// briandecoded migration there is no separate Yoast export to reconcile.
//
//   node scripts/extract-wp.mjs [--out data/raw/wp] [--force]
import fs from 'node:fs';
import path from 'node:path';

const SITE = 'https://alphaefficiency.com';
const API = `${SITE}/wp-json/wp/v2`;
const PER_PAGE = 100;
const UA = 'AlphaEfficiencyMigration/1.0';

const argv = process.argv.slice(2);
const outArg = argv.indexOf('--out');
const OUT = path.resolve(outArg > -1 ? argv[outArg + 1] : 'data/raw/wp');
const FORCE = argv.includes('--force');

// The WAF 403s unknown agents on some routes and occasionally rate-limits, so
// every request retries with backoff rather than aborting a 1,269-item crawl.
async function get(url, attempt = 0) {
  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' } });
    if (res.status === 429 || res.status >= 500) throw new Error(`HTTP ${res.status}`);
    if (!res.ok) return { error: `HTTP ${res.status}`, res };
    return { json: await res.json(), res };
  } catch (err) {
    if (attempt >= 4) throw new Error(`${url} failed after 5 attempts: ${err.message}`);
    await new Promise((r) => setTimeout(r, 2 ** attempt * 1000));
    return get(url, attempt + 1);
  }
}

// Walks a paginated collection using X-WP-TotalPages.
async function fetchAll(type, extra = '') {
  const items = [];
  let page = 1;
  let totalPages = 1;
  do {
    const url = `${API}/${type}?per_page=${PER_PAGE}&page=${page}&orderby=id&order=asc${extra}`;
    const { json, res, error } = await get(url);
    if (error) throw new Error(`${type} page ${page}: ${error}`);
    totalPages = Number(res.headers.get('x-wp-totalpages') || 1);
    items.push(...json);
    process.stdout.write(`\r  ${type}: ${items.length} (page ${page}/${totalPages})   `);
    page += 1;
  } while (page <= totalPages);
  process.stdout.write('\n');
  return items;
}

function writeJson(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

// Yoast on this install emits og:image (and some canonicals) pointing at
// staging7.alphaefficiency.com. Flag it here so migration can rewrite rather
// than carry the leak forward.
const STAGING = /staging\d*\.alphaefficiency\.com/i;
function stagingLeaks(item) {
  const hits = new Set();
  const walk = (v) => {
    if (typeof v === 'string') {
      if (STAGING.test(v)) hits.add(v.match(/https?:\/\/[^\s"')]+/)?.[0] ?? v);
    } else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === 'object') Object.values(v).forEach(walk);
  };
  walk(item.yoast_head_json ?? {});
  walk(item.content?.rendered ?? '');
  return [...hits];
}

function summarize(item) {
  const y = item.yoast_head_json ?? {};
  const html = item.content?.rendered ?? '';
  return {
    id: item.id,
    type: item.type,
    slug: item.slug,
    link: item.link,
    // Path is the join key against Ahrefs/GSC, which report full URLs.
    path: new URL(item.link).pathname,
    status: item.status,
    title: item.title?.rendered ?? '',
    date: item.date,
    modified: item.modified,
    author: item.author,
    categories: item.categories ?? [],
    tags: item.tags ?? [],
    featured_media: item.featured_media || null,
    parent: item.parent ?? null,
    meta_title: y.title ?? null,
    meta_description: y.description ?? null,
    canonical: y.canonical ?? null,
    robots: y.robots ?? null,
    og_image: y.og_image?.[0]?.url ?? null,
    // Cheap content-quality signals so triage can rank without re-parsing HTML.
    word_count: html.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length,
    image_count: (html.match(/<img\b/gi) || []).length,
    internal_links: (html.match(/href="https?:\/\/(?:www\.)?alphaefficiency\.com/gi) || []).length,
    external_links: (html.match(/href="https?:\/\//gi) || []).length,
    has_shortcodes: /\[[a-z_]+[\s\]]/i.test(html),
    staging_leaks: stagingLeaks(item),
  };
}

const stamp = new Date().toISOString().slice(0, 10);

async function main() {
  if (fs.existsSync(OUT) && !FORCE) {
    const existing = fs.readdirSync(OUT);
    if (existing.length) {
      console.error(`${OUT} already has ${existing.length} entries. Re-run with --force to overwrite.`);
      process.exit(1);
    }
  }
  console.log(`Extracting ${SITE} -> ${OUT}\n`);

  // Full objects (content + yoast) for posts and pages; taxonomies for labels.
  const posts = await fetchAll('posts');
  const pages = await fetchAll('pages');
  const categories = await fetchAll('categories');
  const tags = await fetchAll('tags');

  writeJson(path.join(OUT, 'posts.json'), posts);
  writeJson(path.join(OUT, 'pages.json'), pages);
  writeJson(path.join(OUT, 'categories.json'), categories);
  writeJson(path.join(OUT, 'tags.json'), tags);

  const all = [...posts, ...pages];
  const index = all.map(summarize);
  writeJson(path.join(OUT, 'index.json'), { extracted_at: stamp, count: index.length, items: index });

  // URL inventory: content URLs plus the taxonomy archives that inflate the
  // "~2,000 pages" figure and are migration deletions, not migration work.
  const inventory = [
    ...index.map((i) => ({ path: i.path, kind: i.type, id: i.id, title: i.title })),
    ...categories.map((c) => ({ path: new URL(c.link).pathname, kind: 'category_archive', id: c.id, title: c.name, count: c.count })),
    ...tags.map((t) => ({ path: new URL(t.link).pathname, kind: 'tag_archive', id: t.id, title: t.name, count: t.count })),
  ];
  writeJson(path.join(OUT, 'url-inventory.json'), { extracted_at: stamp, count: inventory.length, urls: inventory });

  const leaks = index.filter((i) => i.staging_leaks.length);
  const thin = index.filter((i) => i.word_count < 300);
  const noMeta = index.filter((i) => !i.meta_description);

  console.log(`
  posts            ${posts.length}
  pages            ${pages.length}
  categories       ${categories.length}
  tags             ${tags.length}
  ---------------------------------
  content URLs     ${index.length}
  total inventory  ${inventory.length}

  thin (<300 words)      ${thin.length}
  missing meta desc      ${noMeta.length}
  staging URL leaks      ${leaks.length}

  -> ${OUT}`);
}

main().catch((err) => {
  console.error(`\nExtraction failed: ${err.message}`);
  process.exit(1);
});
