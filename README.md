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
| Blade-only templates | 40 | **38 ported**, 2 blocked — see below |

Ported means one of two things: a static file in `site/src/pages/` (28 pages,
e.g. `about.astro`, `careers.astro`), or an entry in `site/src/pages/[slug].astro`'s
`getStaticPaths()` — that one route generates the 9 team-bio and job-posting
pages (`/brian`, `/nenad`, `/jovan`, `/bane`, `/alex`, `/developer`, `/designer`,
`/digital-marketer`, `/content-writer`) from `src/data/team.ts` and
`src/data/jobs.ts`. Anything not in either place falls through to
`[...slug].astro`, which renders the "Not yet ported" placeholder for D1 rows
with `track = 'template'` and no `body_html`.

Still blocked — 2 pages:

| Page | Blade template | Why it's blocked |
|---|---|---|
| `/code-4` | `template-services-development.blade.php` | File does not exist in the `alpha-efficiency-2024` theme checkout — not found by name or by content search anywhere under `wp-content`. |
| `/schedule-a-hr-call` | `template-schedule-hr.blade.php` | Same — missing from the checkout entirely. |

Both need either a different/older checkout that still has these files, or a
look at the live WP admin to see what content (if any) those pages carry today.
Neither is fabricatable from the D1 metadata alone.

The `metric_snapshots`, `page_keywords`, `revisions` and `agent_runs` tables
exist and are empty — they are the SEO loop that Ahrefs/GSC/Ubersuggest pulls
will populate. GSC is not yet connected to the Ahrefs project.

## Recent changes (2026-08-03)

- **Ported `/web-design-agency-los-angeles`** (`template-locations-la.blade.php`)
  by hand from the `alpha-efficiency-2024` theme checkout. 12 of its 13
  partials are static markup; the 13th (`locations-la-fourth-section`) branches
  on four WordPress custom fields (`get_post_meta` for Web Design/Development/
  SEO/PPC Agency) that can't be read without a live WP database, so it renders
  the "none of the four set" default branch — the same content the other four
  branches show anyway, just under a different heading/link. Verified in
  browser: correct title, no console errors, all assets 200, theme CSS applied.
- **Recompiled `site/public/assets`** (`scripts/build-theme.mjs` against the
  theme checkout) — the committed `main.css` predated the `locations-la` SCSS
  partial, so that page would have shipped unstyled otherwise.
- **Restored the missing project-inquiry form on `/` and `/about`.** Both
  pages' "Proven Process. Friction-Free UX." section was ported without the
  `<div class="about-form">` + HubSpot form (`components/forms/project.blade.php`
  in the source), even though it's on both original Blade templates
  (`partials/home/home-seventh.blade.php`, `partials/about/project.blade.php`).
  Added the existing `ProjectForm.astro` component to both. Other already-ported
  pages weren't re-audited for the same gap — worth a pass.
