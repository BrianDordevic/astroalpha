// Rewrite dist/_routes.json into a compact form after each build.
//
// Cloudflare Pages allows at most 100 `exclude` entries. The Astro adapter
// enumerates every file in public/ individually, and this project ships ~1,170
// theme assets — so the budget is spent on images long before it reaches the
// prerendered HTML pages. Those pages then fall through to the SSR worker,
// which finds their D1 row (track='template', empty body) and serves the
// "Not yet ported" placeholder instead of the real page.
//
// The failure is silent: the URL still returns 200, just with the wrong body.
// Status-code checks do not catch it.
//
// Directory globs express the same intent in a handful of entries.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'site', 'dist');
const ROUTES = path.join(DIST, '_routes.json');

if (!fs.existsSync(ROUTES)) {
  console.error('no dist/_routes.json — run the build first');
  process.exit(1);
}

// Every prerendered page must be excluded by its served path, not its filename:
// build.format 'file' emits about.html but the site serves /about.
const pages = fs
  .readdirSync(DIST)
  .filter((f) => f.endsWith('.html'))
  .map((f) => (f === 'index.html' ? '/' : `/${f.replace(/\.html$/, '')}`));

// Static directories collapse to one glob each instead of one entry per file.
const staticDirs = fs
  .readdirSync(DIST, { withFileTypes: true })
  .filter((e) => e.isDirectory() && e.name !== '_worker.js')
  .map((e) => `/${e.name}/*`);

const routes = {
  version: 1,
  include: ['/*'],
  exclude: [...new Set([...staticDirs, ...pages])].sort(),
};

if (routes.exclude.length > 100) {
  console.error(`exclude list is ${routes.exclude.length} entries — Cloudflare's limit is 100.`);
  process.exit(1);
}

const before = JSON.parse(fs.readFileSync(ROUTES, 'utf8')).exclude.length;
fs.writeFileSync(ROUTES, JSON.stringify(routes, null, 2));

console.log(`_routes.json: ${before} excludes -> ${routes.exclude.length}`);
console.log(`  static dirs: ${staticDirs.join(' ')}`);
console.log(`  pages:       ${pages.length} prerendered`);
