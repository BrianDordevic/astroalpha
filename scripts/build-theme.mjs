// Compile the alpha-efficiency-2024 Sage theme's SCSS into the Astro site and
// copy its fonts/images across, so the rebuild reuses the real design source
// instead of a scraped stylesheet.
//
// Sage 9 built this with node-sass + sass-loader + import-glob-loader. Dart
// Sass understands neither `~pkg` (node_modules) nor `@import "dir/**/*"`, so
// both are handled by the custom importer below.
//
//   THEME_SRC=/path/to/alpha-efficiency-2024 node scripts/build-theme.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// sass lives in site/node_modules (the only install in this repo). ESM resolves
// from this file's location and would never look there, so resolve explicitly
// rather than adding a second node_modules tree at the root.
const sass = createRequire(path.join(ROOT, 'site', 'package.json'))('sass');
const THEME = process.env.THEME_SRC;
if (!THEME) {
  console.error('Set THEME_SRC to the alpha-efficiency-2024 checkout.');
  process.exit(1);
}

const STYLES = path.join(THEME, 'resources/assets/styles');
const NODE_MODULES = path.join(ROOT, 'site', 'node_modules');
const OUT_DIR = path.join(ROOT, 'site', 'public', 'assets');

/** Resolve a partial the way Sass does: _name.scss, name.scss, name. */
function resolveFile(base) {
  const dir = path.dirname(base);
  const name = path.basename(base);
  const candidates = [
    `${name}.scss`, `_${name}.scss`, `${name}.css`, name,
  ].map((f) => path.join(dir, f));
  return candidates.find((f) => fs.existsSync(f) && fs.statSync(f).isFile());
}

const importer = {
  findFileUrl(url, context) {
    // `~bootstrap/scss/functions` -> node_modules/bootstrap/scss/functions
    if (url.startsWith('~')) {
      const hit = resolveFile(path.join(NODE_MODULES, url.slice(1)));
      return hit ? new URL(`file://${hit}`) : null;
    }

    // Glob imports such as `./autoload/**/*`. Sass has no glob support, so
    // expand it into a temp partial that imports each match explicitly.
    if (url.includes('*')) {
      const fromDir = context.containingUrl
        ? path.dirname(fileURLToPath(context.containingUrl))
        : STYLES;
      const globDir = path.join(fromDir, url.slice(0, url.indexOf('**')).replace(/\/$/, ''));
      if (!fs.existsSync(globDir)) return null;

      const matches = [];
      const walk = (d) => {
        for (const e of fs.readdirSync(d, { withFileTypes: true })) {
          const p = path.join(d, e.name);
          if (e.isDirectory()) walk(p);
          else if (e.name.endsWith('.scss')) matches.push(p);
        }
      };
      walk(globDir);
      matches.sort();

      const shim = path.join(globDir, `__glob_${path.basename(globDir)}.scss`);
      fs.writeFileSync(shim, matches.map((m) => `@import "${m.replace(/\\/g, '/')}";`).join('\n'));
      cleanup.push(shim);
      return new URL(`file://${shim}`);
    }

    const hit = resolveFile(path.join(path.dirname(fileURLToPath(context.containingUrl ?? `file://${STYLES}/`)), url))
      ?? resolveFile(path.join(STYLES, url));
    return hit ? new URL(`file://${hit}`) : null;
  },
};

const cleanup = [];

function copyDir(from, to) {
  if (!fs.existsSync(from)) return 0;
  fs.mkdirSync(to, { recursive: true });
  let n = 0;
  for (const e of fs.readdirSync(from, { withFileTypes: true })) {
    const s = path.join(from, e.name);
    const d = path.join(to, e.name);
    if (e.isDirectory()) n += copyDir(s, d);
    else { fs.copyFileSync(s, d); n += 1; }
  }
  return n;
}

try {
  const result = sass.compile(path.join(STYLES, 'main.scss'), {
    importers: [importer],
    loadPaths: [STYLES, NODE_MODULES],
    style: 'compressed',
    // The theme predates the Sass division deprecation and emits thousands of
    // warnings that drown real errors.
    silenceDeprecations: ['slash-div', 'import', 'global-builtin', 'mixed-decls', 'color-functions'],
    quietDeps: true,
  });

  fs.mkdirSync(path.join(OUT_DIR, 'styles'), { recursive: true });
  fs.writeFileSync(path.join(OUT_DIR, 'styles', 'main.css'), result.css);

  const fonts = copyDir(path.join(THEME, 'resources/assets/fonts'), path.join(OUT_DIR, 'fonts'));
  const images = copyDir(path.join(THEME, 'resources/assets/images'), path.join(OUT_DIR, 'images'));

  console.log(`
  main.css  ${(result.css.length / 1024).toFixed(1)} KB
  fonts     ${fonts}
  images    ${images}
  -> ${OUT_DIR}
`);
} finally {
  for (const f of cleanup) fs.rmSync(f, { force: true });
}
