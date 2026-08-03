# alphaefficiency.com — Astro rebuild

WordPress → Astro on Cloudflare Pages, with content served from D1 so an edit is
a database write rather than a rebuild of 1,269 pages.

Staging: <https://alpha-efficiency-astro.pages.dev> (noindex, canonicals point at production)

## Layout

```
site/                 Astro project (@astrojs/cloudflare)
  src/pages/          index, about, contact (ported) + [...slug] (D1-backed)
  src/components/     Header, Footer, ProjectForm
  src/layouts/        Base.astro — all SEO tags + the staging guard
  src/lib/db.ts       D1 helpers
  src/middleware.ts   noindex + no-store headers on non-production builds
  public/assets/      compiled theme CSS, fonts, images
db/
  migrations/         D1 schema: content, metrics, revisions, audit
  seed.sql            generated — 1,269 pages + 1,269 redirects
scripts/
  extract-wp.mjs      WordPress REST → data/raw/wp/ (read-only against prod)
  build-seed.mjs      data/raw → db/seed.sql
  build-theme.mjs     compiles the Sage SCSS + copies fonts/images
  gen-headers.mjs     writes public/_headers per SITE_URL (prebuild hook)
```

## Running it

```bash
cd site && npm install
npm run d1:migrate:local && npm run d1:seed:local
npm run dev                     # http://localhost:4321
```

`npm run dev` sets `SITE_URL=http://localhost:4321` deliberately — see below.

## SITE_URL is load-bearing

`SITE_URL` decides three things at **build** time, and an unset value means
*production*:

| | unset / production | anything else |
|---|---|---|
| `robots` | `index, follow` | `noindex, nofollow` |
| sitemap | emitted | suppressed |
| HubSpot form | submits live | validated, not sent |

So a staging build that forgets the variable ships indexable **and** wired to
the live CRM. Always pass it explicitly:

```bash
SITE_URL=https://dev.alphaefficiency.com npm run build
npx wrangler pages deploy ./dist --project-name=alpha-efficiency-astro --branch=main
```

## Things that will bite

- **Body classes are load-bearing.** Every page stylesheet in the Sage theme is
  scoped under its WordPress `body_class()` — the entire homepage design lives
  inside `.page-template-template-home { … }`. Ported pages pass their own via
  `Base.astro`'s `bodyClass` prop. Omit it and the page renders unstyled with no
  other symptom. The class follows the *Blade filename*, so `/contact` is
  `template-contact_us` (underscore), not the hyphenated SCSS name.
- **URL parity.** Production serves `/slug` and 301s `/slug/`. That needs both
  `trailingSlash: 'never'` and `build.format: 'file'`; changing either silently
  breaks all 1,269 URLs.
- **D1 caps SQL statements at 100KB.** One page has a 258KB body, so
  `build-seed.mjs` inserts oversized rows empty and appends the body in chunks
  using `COALESCE(body_html,'') || …` — plain `||` on a NULL column silently
  discards the whole body.
- **Remote D1 rejects `BEGIN TRANSACTION`.** Local SQLite accepts it, so this
  only fails against `--remote`.
- **`_headers` only covers static assets.** Every content route is SSR, so the
  staging noindex header comes from `src/middleware.ts`.
- **Post images still load from the WordPress host.** The 11,735 media files
  have not been migrated; uploads stay absolute until they move to R2.

## Migration state

| Track | Count | Status |
|---|---:|---|
| Blog posts | 827 | in D1 |
| Location pages | 402 | in D1 |
| Blade-only templates | 40 | **4 ported** — rest render a "Not yet ported" placeholder |

The `metric_snapshots`, `page_keywords`, `revisions` and `agent_runs` tables
exist and are empty — they are the SEO loop that Ahrefs/GSC/Ubersuggest pulls
will populate. GSC is not yet connected to the Ahrefs project.
