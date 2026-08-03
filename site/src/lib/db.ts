/// <reference types="@cloudflare/workers-types" />

// Content lives in D1 rather than in Astro content collections on purpose:
// an agent editing a page is a DB write, not a commit + rebuild of 1,269 pages.

export interface Page {
  id: number;
  wp_id: number | null;
  path: string;
  slug: string;
  type: 'post' | 'page';
  track: 'blog' | 'location' | 'template';
  title: string;
  meta_title: string | null;
  meta_description: string | null;
  canonical: string | null;
  robots_index: number;
  excerpt: string | null;
  body_html: string | null;
  hero_image: string | null;
  wp_template: string | null;
  status: string;
  published_at: string | null;
  updated_at: string;
  word_count: number;
}

function db(locals: App.Locals): D1Database {
  const binding = locals.runtime?.env?.DB;
  if (!binding) throw new Error('D1 binding "DB" missing — check wrangler.toml and platformProxy.');
  return binding;
}

/** Look up one published page by path. Paths are stored without a trailing slash. */
export async function getPage(locals: App.Locals, path: string): Promise<Page | null> {
  const clean = path.replace(/\/+$/, '') || '/';
  return db(locals)
    .prepare(`SELECT * FROM pages WHERE path = ? AND status = 'published' LIMIT 1`)
    .bind(clean)
    .first<Page>();
}

/** Resolve a 301 target for a path, or null if none is registered. */
export async function getRedirect(
  locals: App.Locals,
  path: string
): Promise<{ to_path: string; code: number } | null> {
  return db(locals)
    .prepare(`SELECT to_path, code FROM redirects WHERE from_path = ? LIMIT 1`)
    .bind(path)
    .first<{ to_path: string; code: number }>();
}

/** Newest posts for the blog index. */
export async function listPosts(locals: App.Locals, limit = 20, offset = 0): Promise<Page[]> {
  const { results } = await db(locals)
    .prepare(
      `SELECT id, path, slug, title, excerpt, hero_image, published_at, word_count
         FROM pages
        WHERE status = 'published' AND track = 'blog' AND type = 'post'
        ORDER BY published_at DESC
        LIMIT ? OFFSET ?`
    )
    .bind(limit, offset)
    .all<Page>();
  return results ?? [];
}

export interface PostPage {
  posts: Page[];
  total: number;
  page: number;
  totalPages: number;
}

/**
 * Paginated blog listing with optional search and category filter.
 *
 * Categories live in D1 as a JSON array of WordPress term ids, so filtering
 * uses a LIKE against that text. It is not elegant, but the alternative is a
 * join table the migration does not have, and 827 rows makes the cost
 * irrelevant. The `[id]`/`,id,` bracketing prevents 30 from matching 305.
 */
export async function listPostsPaged(
  locals: App.Locals,
  opts: { page?: number; perPage?: number; search?: string; categoryId?: number } = {}
): Promise<PostPage> {
  const perPage = opts.perPage ?? 12;
  const page = Math.max(1, opts.page ?? 1);

  const where = [`status = 'published'`, `track = 'blog'`, `type = 'post'`];
  const params: (string | number)[] = [];

  if (opts.search) {
    where.push(`(title LIKE ? OR excerpt LIKE ?)`);
    const like = `%${opts.search}%`;
    params.push(like, like);
  }

  if (opts.categoryId) {
    where.push(`(categories LIKE ? OR categories LIKE ? OR categories LIKE ? OR categories = ?)`);
    const id = opts.categoryId;
    params.push(`[${id},%`, `%,${id},%`, `%,${id}]`, `[${id}]`);
  }

  const clause = where.join(' AND ');
  const conn = db(locals);

  const countRow = await conn
    .prepare(`SELECT COUNT(*) AS n FROM pages WHERE ${clause}`)
    .bind(...params)
    .first<{ n: number }>();
  const total = countRow?.n ?? 0;

  const { results } = await conn
    .prepare(
      `SELECT id, path, slug, title, excerpt, hero_image, published_at, categories
         FROM pages
        WHERE ${clause}
        ORDER BY published_at DESC
        LIMIT ? OFFSET ?`
    )
    .bind(...params, perPage, (page - 1) * perPage)
    .all<Page>();

  return {
    posts: results ?? [],
    total,
    page,
    totalPages: Math.max(1, Math.ceil(total / perPage)),
  };
}
