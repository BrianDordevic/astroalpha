// Convert a Sage service template into an Astro page.
//
// The 14 service templates are ~11,400 lines across 258 partials, but only 17
// of those partials contain any Blade logic — the rest are static marketing
// HTML with @asset() and get_site_url() interpolation. Converting them by hand
// would mean retyping thousands of lines of copy with no upside and a real risk
// of silent edits, so this does it mechanically and REFUSES to guess when it
// meets anything it does not understand.
//
//   THEME_SRC=... node scripts/port-template.mjs template-service-woocommerce /woocommerce-website-agency-chicago
//   THEME_SRC=... node scripts/port-template.mjs --check-all
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const THEME = process.env.THEME_SRC;
if (!THEME) {
  console.error('Set THEME_SRC to the alpha-efficiency-2024 checkout.');
  process.exit(1);
}
const VIEWS = path.join(THEME, 'resources/views');

/**
 * Blade constructs this script cannot safely translate.
 *
 * @include is on this list because it was NOT, and that was a real bug: the
 * template's own includes are expanded, but partials that include other
 * partials were left untouched, so their raw `@include('x', [...])` source
 * rendered as visible text on /portfolio. Anything unexpanded must fail the
 * build rather than ship as page copy.
 */
const UNSUPPORTED = [
  { re: /@if\b/, name: '@if' },
  { re: /@foreach\b/, name: '@foreach' },
  { re: /@php\b/, name: '@php' },
  { re: /<\?php/, name: '<?php' },
  { re: /@include\(/, name: '@include' },
  { re: /@component\(/, name: '@component' },
  { re: /\{\{\s*\$/, name: '{{ $var }}' },
];

function partialPath(dotted) {
  return path.join(VIEWS, dotted.replace(/\./g, '/') + '.blade.php');
}

/** Ordered list of partials a template pulls in. */
function includesOf(tplFile) {
  const src = fs.readFileSync(tplFile, 'utf8');
  const out = [];
  const re = /@(?:include|component)\(\s*'([^']+)'/g;
  let m;
  while ((m = re.exec(src))) out.push(m[1]);
  return out;
}

/**
 * Expand `@foreach ([ ...literal array... ] as $x) … @endforeach`.
 *
 * The two testimonial partials loop over an array written inline in the
 * template rather than coming from the database, so the data is already static
 * — unrolling it at conversion time is lossless. Loops over a real variable are
 * left alone and still trip the unsupported-construct check.
 */
function expandInlineForeach(src) {
  const open = /@foreach\s*\(\s*\[/g;
  let m;
  while ((m = open.exec(src))) {
    const arrStart = m.index + m[0].length - 1;

    // Walk brackets to find the matching close, so nested arrays survive.
    let depth = 0;
    let i = arrStart;
    for (; i < src.length; i += 1) {
      if (src[i] === '[') depth += 1;
      else if (src[i] === ']') {
        depth -= 1;
        if (depth === 0) break;
      }
    }
    if (depth !== 0) return src;

    const literal = src.slice(arrStart, i + 1);
    const after = src.slice(i + 1);
    // `as $item` or `as $index => $item`
    const asMatch = after.match(/^\s*as\s*\$(\w+)(?:\s*=>\s*\$(\w+))?\s*\)/);
    if (!asMatch) return src;

    const keyName = asMatch[2] ? asMatch[1] : null;
    const varName = asMatch[2] ?? asMatch[1];
    const bodyStart = i + 1 + asMatch[0].length;
    const endIdx = src.indexOf('@endforeach', bodyStart);
    if (endIdx === -1) return src;
    const body = src.slice(bodyStart, endIdx);

    // Two literal shapes occur: an array of associative arrays (testimonials)
    // and a flat array of strings (the hero slider's image filenames).
    const items = [];
    const itemRe = /\[([^[\]]*)\]/g;
    let itm;
    while ((itm = itemRe.exec(literal))) {
      const entry = {};
      const pairRe = /'([^']+)'\s*=>\s*'((?:[^'\\]|\\.)*)'/g;
      let pr;
      while ((pr = pairRe.exec(itm[1]))) entry[pr[1]] = pr[2].replace(/\\'/g, "'");
      if (Object.keys(entry).length) items.push(entry);
    }

    const isFlat = items.length === 0;
    const flat = isFlat
      ? [...literal.matchAll(/'((?:[^'\\]|\\.)*)'/g)].map((x) => x[1].replace(/\\'/g, "'"))
      : [];
    if (isFlat && flat.length === 0) return src;

    const source = isFlat ? flat : items;

    const expanded = source
      .map((entry, index) => {
        let out = body;

        if (isFlat) {
          // @asset('images/x/' . $project) — concatenation inside the helper.
          out = out.replace(
            new RegExp(`@asset\\(\\s*'([^']*)'\\s*\\.\\s*\\$${varName}\\s*\\)`, 'g'),
            (_, prefix) => `/assets/${prefix}${entry}`
          );
          out = out.replace(new RegExp(`\\{\\{\\s*\\$${varName}\\s*\\}\\}`, 'g'), String(entry));
        } else {
          out = out.replace(
            new RegExp(`\\{\\{\\s*\\$${varName}\\['([^']+)'\\]\\s*\\}\\}`, 'g'),
            (_, key) => entry[key] ?? ''
          );
        }

        if (keyName) {
          out = out.replace(new RegExp(`\\{\\{\\s*\\$${keyName}\\s*\\}\\}`, 'g'), String(index));
        }
        return out;
      })
      .join('\n');

    src = src.slice(0, m.index) + expanded + src.slice(endIdx + '@endforeach'.length);
    open.lastIndex = 0;
  }
  return src;
}

/** Parse a PHP associative-array literal of scalars: ['a' => 1, 'b' => 'x']. */
function parsePhpAssoc(literal) {
  const out = {};
  const re = /'([^']+)'\s*=>\s*(?:'((?:[^'\\]|\\.)*)'|(\d+))/g;
  let m;
  while ((m = re.exec(literal))) {
    out[m[1]] = m[3] !== undefined ? Number(m[3]) : m[2].replace(/\\'/g, "'");
  }
  return out;
}

/**
 * Expand `@php $x = [...] @endphp` plus the `@component(..., ['k' => $x])`
 * that consumes it.
 *
 * Each portfolio project declares its stats inline and hands them to a shared
 * details component — static data again, so it can be resolved at conversion
 * time. Anything the substitution does not recognise is left in place, so the
 * unsupported-construct check still catches it.
 */
function expandInlineComponent(src, resolvePartial) {
  // Collect inline scalar-array assignments, then drop the @php block.
  const vars = {};
  src = src.replace(/@php\s*([\s\S]*?)@endphp/g, (block, body) => {
    const assign = body.match(/\$(\w+)\s*=\s*(\[[\s\S]*?\])\s*;/);
    if (!assign) return block;
    vars[assign[1]] = parsePhpAssoc(assign[2]);
    return '';
  });

  return src.replace(
    /@component\('([^']+)',\s*\[\s*'(\w+)'\s*=>\s*\$(\w+)\s*\]\)\s*@endcomponent/g,
    (whole, dotted, propName, varName) => {
      const data = vars[varName];
      const file = resolvePartial(dotted);
      if (!data || !file || !fs.existsSync(file)) return whole;

      let tpl = fs.readFileSync(file, 'utf8');

      // {{ $details['duration'] }}
      tpl = tpl.replace(
        new RegExp(`\\{\\{\\s*\\$${propName}\\['(\\w+)'\\]\\s*\\}\\}`, 'g'),
        (_, key) => String(data[key] ?? '')
      );

      // @php echo $details['duration'] == 1 ? 'month' : 'months' @endphp
      tpl = tpl.replace(
        new RegExp(
          `@php\\s*echo\\s*\\$${propName}\\['(\\w+)'\\]\\s*==\\s*(\\d+)\\s*\\?\\s*'([^']*)'\\s*:\\s*'([^']*)'\\s*@endphp`,
          'g'
        ),
        (_, key, cmp, a, b) => (Number(data[key]) === Number(cmp) ? a : b)
      );

      return tpl;
    }
  );
}

/** Find the matching close bracket for the `[` at `start`, respecting quotes. */
function matchBracket(src, start) {
  let depth = 0;
  let quote = null;
  for (let i = start; i < src.length; i += 1) {
    const c = src[i];
    if (quote) {
      if (c === '\\') i += 1;
      else if (c === quote) quote = null;
      continue;
    }
    if (c === "'" || c === '"') quote = c;
    else if (c === '[') depth += 1;
    else if (c === ']') {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/**
 * Expand `@include('partial', ['key' => 'value', ...])`.
 *
 * Partials that include other partials were previously left as-is, so their
 * literal Blade source rendered as visible copy on /portfolio — nine times.
 * Values are either quoted strings (possibly spanning lines) or
 * \App\asset_path('x'); anything else leaves the call untouched so the
 * unsupported check rejects it.
 */
function expandParamInclude(src, resolvePartial, depth = 0) {
  if (depth > 4) return src;

  const re = /@include\('([^']+)'\s*,\s*\[/g;
  let m;
  while ((m = re.exec(src))) {
    const bracketStart = m.index + m[0].length - 1;
    const end = matchBracket(src, bracketStart);
    if (end === -1) break;

    const argsSrc = src.slice(bracketStart + 1, end);
    const file = resolvePartial(m[1]);
    if (!file || !fs.existsSync(file)) break;

    // 'key' => 'value'  |  'key' => \App\asset_path('path')
    const args = {};
    const pairRe = /'(\w+)'\s*=>\s*(?:\\?App\\asset_path\('([^']+)'\)|'((?:[^'\\]|\\.)*)')/g;
    let p;
    while ((p = pairRe.exec(argsSrc))) {
      args[p[1]] = p[2] !== undefined ? `/assets/${p[2]}` : p[3].replace(/\\'/g, "'");
    }

    let body = fs.readFileSync(file, 'utf8');

    // Drop the partial's own `$x = $x ?? ''` defaults block.
    body = body.replace(/@php[\s\S]*?@endphp/g, '');

    // @if($var) … @endif — truthy means a non-empty passed value.
    body = body.replace(
      /@if\(\s*\$(\w+)\s*\)([\s\S]*?)@endif/g,
      (_, name, inner) => (args[name] ? inner : '')
    );

    body = body.replace(/\{\{\s*\$(\w+)\s*\}\}/g, (_, name) => args[name] ?? '');
    body = expandParamInclude(body, resolvePartial, depth + 1);

    src = src.slice(0, m.index) + body + src.slice(end + 1);
    re.lastIndex = 0;
  }

  // Parameterless nested includes: splice the partial straight in.
  return src.replace(/@include\('([^']+)'\)/g, (whole, dotted) => {
    const f = resolvePartial(dotted);
    if (!f || !fs.existsSync(f)) return whole;
    return expandParamInclude(fs.readFileSync(f, 'utf8'), resolvePartial, depth + 1);
  });
}

function convert(html) {
  return expandInlineForeach(html)
    // {{-- Blade comment --}} -> gone
    .replace(/\{\{--[\s\S]*?--\}\}/g, '')
    // @asset('images/x') -> /assets/images/x
    .replace(/@asset\(\s*'([^']+)'\s*\)/g, (_, p) => `/assets/${p}`)
    // {{ get_site_url() }}/foo -> /foo
    .replace(/\{\{\s*get_site_url\(\)\s*\}\}/g, '')
    .replace(/\{\{\s*esc_url\(home_url\('([^']*)'\)\)\s*\}\}/g, (_, p) => p || '/')
    .trim();
}

function inspect(tpl) {
  const tplFile = path.join(VIEWS, `${tpl}.blade.php`);
  if (!fs.existsSync(tplFile)) return { tpl, error: 'template not found' };

  const parts = includesOf(tplFile);
  const problems = [];
  let body = '';
  let usesProjectForm = false;

  for (const dotted of parts) {
    // schemas.* are @php blocks emitting JSON-LD. The structured data is
    // regenerated per page from real metadata instead of transcribed, so the
    // Blade version is deliberately dropped rather than half-converted.
    if (dotted.startsWith('schemas.')) continue;

    const f = partialPath(dotted);
    if (!fs.existsSync(f)) {
      problems.push(`${dotted}: file missing`);
      continue;
    }

    let raw = fs.readFileSync(f, 'utf8');

    // Fourteen partials embed the shared project form, already ported as
    // components/ProjectForm.astro. They are matched by content rather than by
    // filename — the naming is inconsistent (woocommerce-form, contact-inbound,
    // get-in-touch) — and only the @component call is replaced, because each
    // wraps the form in its own heading and copy that must be kept.
    if (raw.includes("@component('components.forms.project'")) {
      raw = raw.replace(
        /@component\('components\.forms\.project'[^)]*\)\s*@endcomponent/g,
        '__PROJECT_FORM__'
      );
      usesProjectForm = true;
    }

    // Unroll inline-literal loops before the check, so a @foreach over data
    // written in the template does not get reported as unsupported. Loops over
    // a real variable survive expansion untouched and are still caught below.
    // Nested includes first: they can introduce further loops and components.
    raw = expandParamInclude(raw, partialPath);
    raw = expandInlineForeach(raw);
    raw = expandInlineComponent(raw, partialPath);

    for (const u of UNSUPPORTED) {
      if (u.re.test(raw)) problems.push(`${dotted}: contains ${u.name}`);
    }
    body += `\n<!-- ${dotted} -->\n` + convert(raw) + '\n';
  }

  // Assets the converted markup points at must actually exist, or the page
  // ships with broken images that only a human eye would catch.
  //
  // Matched inside the quotes, not by "up to whitespace": several theme
  // filenames contain spaces ("Fully Responsive.svg"), and a whitespace-
  // delimited match reports those as missing when they are present.
  const missing = [...body.matchAll(/["'](\/assets\/images\/[^"']+)["']/g)]
    .map((m) => m[1].replace('/assets/', ''))
    .filter((rel, i, arr) => arr.indexOf(rel) === i)
    .filter((rel) => !fs.existsSync(path.join(ROOT, 'site', 'public', 'assets', rel)));

  return { tpl, parts, problems, missing, body, usesProjectForm };
}

const args = process.argv.slice(2);

if (args[0] === '--check-all') {
  const templates = fs
    .readdirSync(VIEWS)
    .filter((f) => /^template-(service|new-services|other-services)/.test(f))
    .map((f) => f.replace('.blade.php', ''));

  let clean = 0;
  for (const tpl of templates) {
    const r = inspect(tpl);
    const flag = r.problems?.length ? `${r.problems.length} logic` : 'clean';
    const miss = r.missing?.length ? `  ${r.missing.length} missing assets` : '';
    if (!r.problems?.length && !r.missing?.length) clean += 1;
    console.log(`  ${tpl.padEnd(48)} ${String(r.parts?.length ?? 0).padStart(2)} partials  ${flag.padEnd(9)}${miss}`);
    for (const p of r.problems ?? []) console.log(`      ! ${p}`);
    for (const m of (r.missing ?? []).slice(0, 4)) console.log(`      ? missing asset: ${m}`);
  }
  console.log(`\n  ${clean}/${templates.length} templates convert cleanly`);
  process.exit(0);
}

const [tpl, urlPath, ...rest] = args;
if (!tpl || !urlPath) {
  console.error('usage: port-template.mjs <template-name> <url-path> [--force]');
  process.exit(1);
}
const force = rest.includes('--force');

const r = inspect(tpl);
if (r.error) {
  console.error(r.error);
  process.exit(1);
}
if ((r.problems.length || r.missing.length) && !force) {
  console.error(`${tpl} needs manual attention:`);
  for (const p of r.problems) console.error(`  ! ${p}`);
  for (const m of r.missing) console.error(`  ? missing asset: ${m}`);
  console.error('\nRe-run with --force only if you have checked each of these.');
  process.exit(1);
}

const bodyClass = `page-template page-template-${tpl} ${tpl} page`;
const slug = urlPath.replace(/^\//, '');
const out = path.join(ROOT, 'site', 'src', 'pages', `${slug}.astro`);

// Title and description come from the extracted Yoast metadata here rather
// than from a separate pass afterwards. That pass was easy to forget when
// regenerating a page, and /portfolio duly shipped to production with
// <title>TODO</title>. Generating them inline means a regenerated page can
// never lose its metadata.
const decode = (s) =>
  String(s ?? '')
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)))
    .replace(/&#x([0-9a-f]+);/gi, (_, x) => String.fromCharCode(parseInt(x, 16)))
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#039;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim();

let metaTitle = '';
let metaDesc = '';
const indexFile = path.join(ROOT, 'data', 'raw', 'wp', 'index.json');
if (fs.existsSync(indexFile)) {
  const entry = JSON.parse(fs.readFileSync(indexFile, 'utf8')).items.find(
    (i) => i.path.replace(/\/$/, '') === urlPath.replace(/\/$/, '')
  );
  if (entry) {
    metaTitle = decode(entry.meta_title || entry.title);
    metaDesc = decode(entry.meta_description);
  }
}
if (!metaTitle) {
  console.error(`No WordPress metadata for ${urlPath} — refusing to emit a page with no title.`);
  process.exit(1);
}
const attr = (s) => s.replace(/"/g, '&quot;');

// The body is emitted as two halves around the form so ProjectForm can be a
// real component rather than inert markup inside a set:html string.
const [beforeForm, afterForm = ''] = r.body.split('__PROJECT_FORM__');
const esc = (s) => s.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${');

fs.writeFileSync(
  out,
  `---
import Base from '../layouts/Base.astro';
${r.usesProjectForm ? "import ProjectForm from '../components/ProjectForm.astro';\n" : ''}

// Generated by scripts/port-template.mjs from alpha-efficiency-2024
// ${tpl}.blade.php (${r.parts.length} partials).
//
// The marketing copy is transferred verbatim rather than retyped, so the
// published wording cannot drift during migration. Only @asset() paths and
// get_site_url() interpolation were rewritten. Re-running the script
// regenerates this file, so edit the source partials or this comment block —
// not the body below.
const beforeForm = \`${esc(beforeForm)}\`;
const afterForm = \`${esc(afterForm)}\`;
---

<Base
  title="${attr(metaTitle)}"
  description="${attr(metaDesc)}"
  path="${urlPath}"
  type="website"
  fullBleed={true}
  bodyClass="${bodyClass}"
>
  <Fragment set:html={beforeForm} />
${r.usesProjectForm ? '  <ProjectForm />\n' : ''}  <Fragment set:html={afterForm} />
</Base>
`
);

console.log(`  ${tpl} -> ${out}`);
console.log(`     ${r.parts.length} partials, ${r.body.split('\n').length} lines, all assets present`);
