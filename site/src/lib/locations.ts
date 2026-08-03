// Turns a location page slug into a readable label, and buckets it by service.
//
// The Blade template built this index from WordPress custom fields ("Web Design
// Agency", "SEO Agency", ...), each a hand-maintained "Name:slug;" string. The
// REST API does not expose those fields, and a hand-maintained list can drift
// out of sync with the pages that actually exist — so the index is derived from
// the 402 location pages in D1 instead. Add or remove a location page and this
// updates itself.
//
// Slugs are not consistently formed: /web-design-lake-forest-il,
// /clarksville-web-design and /web-designers-in-brooklyn-ny are all live, so
// both the service and the place have to be recovered by keyword.

const STATES = new Set([
  'il','ca','ny','tn','tx','fl','ga','nc','sc','va','md','nj','pa','oh','mi','wi','in','mo',
  'az','co','wa','or','nv','ma','ct','mn','al','ky','la','ok','ar','ms','ia','ks','ne','ut',
  'nm','id','mt','wy','nd','sd','wv','de','ri','nh','vt','me','ak','hi','dc',
]);

// Words describing the service rather than the place. 'in' doubles as Indiana's
// code, but it is far more often the preposition ("designers-in-brooklyn"), so
// it is treated as noise.
const NOISE = new Set([
  'web','design','designers','designer','development','developers','company','companies',
  'agency','agencies','seo','ppc','services','service','in','near','marketing','digital',
  'website','websites','best','top',
]);

export type Service = 'Web Design' | 'Web Development' | 'SEO' | 'PPC' | 'Other';

export function serviceFor(path: string): Service {
  const s = path.toLowerCase();
  if (s.includes('web-development') || s.includes('developer')) return 'Web Development';
  if (s.includes('web-design') || s.includes('website-design') || s.includes('designer')) return 'Web Design';
  if (s.includes('seo')) return 'SEO';
  if (s.includes('ppc')) return 'PPC';
  return 'Other';
}

export function placeFor(path: string): string {
  const parts = path.replace(/^\/|\/$/g, '').split('-');
  const keep = parts.filter((p) => p && !NOISE.has(p));
  if (keep.length === 0) return path.replace(/^\//, '');

  const words = keep.map((p) => (STATES.has(p) ? p.toUpperCase() : p.charAt(0).toUpperCase() + p.slice(1)));
  const last = words[words.length - 1];
  if (words.length > 1 && last.length === 2 && last === last.toUpperCase()) {
    return `${words.slice(0, -1).join(' ')}, ${last}`;
  }
  return words.join(' ');
}

export const SERVICE_ORDER: Service[] = ['Web Design', 'Web Development', 'SEO', 'PPC', 'Other'];
