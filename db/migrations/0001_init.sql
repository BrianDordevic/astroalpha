-- alphaefficiency.com D1 schema v1
--
-- Content and metrics are deliberately separate. Content is the thing we
-- serve; metrics are dated observations *about* content that go stale monthly
-- and get re-pulled. They join on `path`, which is what Ahrefs, GSC and
-- Ubersuggest all report against.
--
-- Apply: wrangler d1 migrations apply ae-content [--local|--remote]

-- ---------------------------------------------------------------- content --

CREATE TABLE IF NOT EXISTS pages (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  wp_id            INTEGER UNIQUE,           -- provenance back to WordPress
  path             TEXT UNIQUE NOT NULL,     -- '/geometric-logo-design', no trailing slash
  slug             TEXT NOT NULL,
  type             TEXT NOT NULL,            -- 'post' | 'page'

  -- Which migration track this page belongs to. Drives both the rebuild order
  -- and which agent is allowed to touch it.
  --   'blog'     813 DB-backed posts        -> mechanical
  --   'location' 402 city pages             -> full rewrite planned
  --   'template'  54 Blade-only pages       -> hand-ported, body_html is NULL
  track            TEXT NOT NULL,

  title            TEXT NOT NULL,
  meta_title       TEXT,
  meta_description TEXT,
  canonical        TEXT,
  robots_index     INTEGER NOT NULL DEFAULT 1,   -- 0 => emit noindex
  excerpt          TEXT,
  body_html        TEXT,                         -- NULL for 'template' track
  hero_image       TEXT,
  wp_template      TEXT,                         -- source Blade view, for the port
  tags             TEXT,                         -- JSON array
  categories       TEXT,                         -- JSON array

  status           TEXT NOT NULL DEFAULT 'published',  -- draft|published|archived
  published_at     TEXT,
  updated_at       TEXT NOT NULL,

  -- Cheap quality signals captured at extraction so triage can rank pages
  -- without re-parsing every body.
  word_count       INTEGER NOT NULL DEFAULT 0,
  internal_links   INTEGER NOT NULL DEFAULT 0,
  image_count      INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_pages_status ON pages(status, published_at);
CREATE INDEX IF NOT EXISTS idx_pages_track  ON pages(track);

CREATE TABLE IF NOT EXISTS redirects (
  from_path TEXT PRIMARY KEY,
  to_path   TEXT NOT NULL,
  code      INTEGER NOT NULL DEFAULT 301,
  reason    TEXT
);

-- ---------------------------------------------------------------- metrics --

-- Long format on purpose: Ahrefs, GSC and Ubersuggest expose different fields,
-- and a wide table would be mostly NULL and need migrating every time a source
-- changes. One row per (date, source, path, metric) also makes "what moved
-- after the agent touched it" a plain self-join.
CREATE TABLE IF NOT EXISTS metric_snapshots (
  captured_on TEXT NOT NULL,        -- ISO date of the pull
  source      TEXT NOT NULL,        -- 'ahrefs' | 'gsc' | 'ubersuggest'
  path        TEXT NOT NULL,
  metric      TEXT NOT NULL,        -- 'traffic' | 'clicks' | 'impressions' | 'position' | ...
  value       REAL NOT NULL,
  PRIMARY KEY (captured_on, source, path, metric)
);

CREATE INDEX IF NOT EXISTS idx_metrics_path ON metric_snapshots(path, metric, captured_on);

CREATE TABLE IF NOT EXISTS page_keywords (
  captured_on TEXT NOT NULL,
  source      TEXT NOT NULL,
  path        TEXT NOT NULL,
  keyword     TEXT NOT NULL,
  volume      INTEGER,
  position    REAL,
  clicks      INTEGER,
  impressions INTEGER,
  PRIMARY KEY (captured_on, source, path, keyword)
);

CREATE INDEX IF NOT EXISTS idx_kw_path ON page_keywords(path, captured_on);
CREATE INDEX IF NOT EXISTS idx_kw_term ON page_keywords(keyword);

-- ------------------------------------------------------------ agent audit --

-- Every agent edit writes the prior body here first. Without this an agentic
-- rewrite across 1,269 pages has no undo.
CREATE TABLE IF NOT EXISTS revisions (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  page_id     INTEGER NOT NULL REFERENCES pages(id),
  revised_at  TEXT NOT NULL,
  agent       TEXT,                 -- which agent/run produced this
  reason      TEXT,                 -- why it acted
  before_html TEXT,
  after_html  TEXT,
  reverted_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_revisions_page ON revisions(page_id, revised_at);

CREATE TABLE IF NOT EXISTS agent_runs (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  ran_at     TEXT NOT NULL,
  kind       TEXT NOT NULL,         -- 'triage' | 'rewrite' | 'pull-ahrefs' | ...
  scope      TEXT,                  -- what it was pointed at
  changed    INTEGER NOT NULL DEFAULT 0,
  notes      TEXT,
  error      TEXT
);
