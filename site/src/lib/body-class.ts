// Rebuild WordPress's body_class() for D1-backed pages.
//
// Every page stylesheet in the Sage theme is scoped under the body classes
// WordPress emitted — .template-locations-single alone is 885 lines of SCSS
// compiling to 145 rules. Serving these pages without those classes means the
// CSS is present but cannot match, so the page renders with only the global
// styles and looks plausible while being wrong.
//
// This affects all 1,229 database-backed pages, not just the 402 location
// ones: blog posts are styled under .single-post, plain pages under
// .page-template-default.
//
// Only the classes stylesheets actually key off are emitted. WordPress also
// outputs ids (page-id-16454, postid-23959) and bookkeeping classes
// (wp-singular, *-data) that nothing in the theme selects on.

export interface BodyClassInput {
  type: 'post' | 'page' | string;
  slug: string;
  /** e.g. 'views/template-locations-single.blade.php', or null for the default. */
  wp_template: string | null;
}

export function bodyClassFor({ type, slug, wp_template }: BodyClassInput): string {
  const out: string[] = ['wp-singular'];

  if (type === 'post') {
    // Matches production: post-template-default single single-post …
    out.push('post-template-default', 'single', 'single-post', 'single-format-standard');
  } else {
    const tpl = wp_template
      ? wp_template.split('/').pop()!.replace(/\.blade\.php$/, '')
      : null;

    if (tpl) {
      out.push('page-template', `page-template-${tpl}`, tpl, 'page');
    } else {
      out.push('page-template-default', 'page');
    }
  }

  // WordPress appends the slug as a class; a few theme rules target it.
  if (slug) out.push(slug);

  return out.join(' ');
}
