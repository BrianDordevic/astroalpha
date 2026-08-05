// The /locations hub page in alpha-efficiency-2024 doesn't list every location
// page that exists — 402 of them are live standalone landing pages, but the
// Blade template only ever rendered a fixed set of custom fields ("Web Design
// Agency", "SEO Agency", ...), each a hand-maintained list of ~18 Chicago-area
// suburbs. The REST API doesn't expose those fields, so this list was recovered
// by reading the rendered links off the live site instead — including its own
// naming inconsistencies (a Web Design row pointing at a /web-development-...
// path, and three PPC/SEO links that drop "agency"/"company" from the slug).
// It only changes if the client asks to add or remove a featured location.

export type Service = 'Web Design' | 'Web Development' | 'SEO' | 'PPC';

export interface Location {
  service: Service;
  path: string;
  place: string;
}

export const CURATED_LOCATIONS: Location[] = [
  { service: 'Web Design', path: '/web-design-dune-acres-il', place: 'Dune Acres, IL' },
  { service: 'Web Design', path: '/web-design-glencoe-il', place: 'Glencoe, IL' },
  { service: 'Web Design', path: '/web-design-golf-il', place: 'Golf, IL' },
  { service: 'Web Design', path: '/web-design-green-oaks-il', place: 'Green Oaks, IL' },
  { service: 'Web Design', path: '/web-design-hinsdale-il', place: 'Hinsdale, IL' },
  { service: 'Web Design', path: '/web-design-inverness-il', place: 'Inverness, IL' },
  { service: 'Web Design', path: '/web-design-kildeer-il', place: 'Kildeer, IL' },
  { service: 'Web Design', path: '/web-development-lake-forest-il', place: 'Lake Forest, IL' },
  { service: 'Web Design', path: '/web-design-long-grove-il', place: 'Long Grove, IL' },
  { service: 'Web Design', path: '/web-design-mettawa-il', place: 'Mettawa, IL' },
  { service: 'Web Design', path: '/web-design-riverwoods-il', place: 'Riverwoods, IL' },
  { service: 'Web Design', path: '/web-design-s-barrington-il', place: 'S Barrington, IL' },
  { service: 'Web Design', path: '/web-design-tower-lakes-il', place: 'Tower Lakes, IL' },
  { service: 'Web Design', path: '/web-design-winnetka-il', place: 'Winnetka, IL' },
  { service: 'Web Design', path: '/web-design-evanston-il', place: 'Evanston, IL' },
  { service: 'Web Design', path: '/web-design-highland-park-il', place: 'Highland Park, IL' },
  { service: 'Web Design', path: '/web-design-kenilworth-il', place: 'Kenilworth, IL' },
  { service: 'Web Design', path: '/web-design-pilsen-il', place: 'Pilsen, IL' },

  { service: 'Web Development', path: '/web-development-dune-acres-il', place: 'Dune Acres, IL' },
  { service: 'Web Development', path: '/web-development-glencoe-il', place: 'Glencoe, IL' },
  { service: 'Web Development', path: '/web-development-golf-il', place: 'Golf, IL' },
  { service: 'Web Development', path: '/web-development-green-oaks-il', place: 'Green Oaks, IL' },
  { service: 'Web Development', path: '/web-development-hinsdale-il', place: 'Hinsdale, IL' },
  { service: 'Web Development', path: '/web-development-inverness-il', place: 'Inverness, IL' },
  { service: 'Web Development', path: '/web-development-kildeer-il', place: 'Kildeer, IL' },
  { service: 'Web Development', path: '/web-development-lake-forest-il', place: 'Lake Forest, IL' },
  { service: 'Web Development', path: '/web-development-long-grove-il', place: 'Long Grove, IL' },
  { service: 'Web Development', path: '/web-development-mettawa-il', place: 'Mettawa, IL' },
  { service: 'Web Development', path: '/web-development-riverwoods-il', place: 'Riverwoods, IL' },
  { service: 'Web Development', path: '/web-development-s-barrington-il', place: 'S Barrington, IL' },
  { service: 'Web Development', path: '/web-development-tower-lakes-il', place: 'Tower Lakes, IL' },
  { service: 'Web Development', path: '/web-development-winnetka-il', place: 'Winnetka, IL' },
  { service: 'Web Development', path: '/web-development-evanston-il', place: 'Evanston, IL' },
  { service: 'Web Development', path: '/web-development-highland-park-il', place: 'Highland Park, IL' },
  { service: 'Web Development', path: '/web-development-kenilworth-il', place: 'Kenilworth, IL' },
  { service: 'Web Development', path: '/web-development-pilsen-il', place: 'Pilsen, IL' },

  { service: 'SEO', path: '/seo-agency-dune-acres-il', place: 'Dune Acres, IL' },
  { service: 'SEO', path: '/seo-agency-glencoe-il', place: 'Glencoe, IL' },
  { service: 'SEO', path: '/seo-agency-golf-il', place: 'Golf, IL' },
  { service: 'SEO', path: '/seo-agency-green-oaks-il', place: 'Green Oaks, IL' },
  { service: 'SEO', path: '/seo-agency-hinsdale-il', place: 'Hinsdale, IL' },
  { service: 'SEO', path: '/seo-agency-inverness-il', place: 'Inverness, IL' },
  { service: 'SEO', path: '/seo-agency-kildeer-il', place: 'Kildeer, IL' },
  { service: 'SEO', path: '/seo-agency-lake-forest-il', place: 'Lake Forest, IL' },
  { service: 'SEO', path: '/seo-agency-long-grove-il', place: 'Long Grove, IL' },
  { service: 'SEO', path: '/seo-agency-mettawa-il', place: 'Mettawa, IL' },
  { service: 'SEO', path: '/seo-agency-riverwoods-il', place: 'Riverwoods, IL' },
  { service: 'SEO', path: '/seo-agency-s-barrington-il', place: 'S Barrington, IL' },
  { service: 'SEO', path: '/seo-agency-tower-lakes-il', place: 'Tower Lakes, IL' },
  { service: 'SEO', path: '/seo-agency-winnetka-il', place: 'Winnetka, IL' },
  { service: 'SEO', path: '/seo-agency-evanston-il', place: 'Evanston, IL' },
  { service: 'SEO', path: '/seo-highland-park-il', place: 'Highland Park, IL' },
  { service: 'SEO', path: '/seo-agency-kenilworth-il', place: 'Kenilworth, IL' },
  { service: 'SEO', path: '/seo-agency-pilsen-il', place: 'Pilsen, IL' },

  { service: 'PPC', path: '/ppc-company-dune-acres-il', place: 'Dune Acres, IL' },
  { service: 'PPC', path: '/ppc-company-glencoe-il', place: 'Glencoe, IL' },
  { service: 'PPC', path: '/ppc-company-golf-il', place: 'Golf, IL' },
  { service: 'PPC', path: '/ppc-company-green-oaks-il', place: 'Green Oaks, IL' },
  { service: 'PPC', path: '/ppc-company-hinsdale-il', place: 'Hinsdale, IL' },
  { service: 'PPC', path: '/ppc-company-inverness-il', place: 'Inverness, IL' },
  { service: 'PPC', path: '/ppc-company-kildeer-il', place: 'Kildeer, IL' },
  { service: 'PPC', path: '/ppc-company-lake-forest-il', place: 'Lake Forest, IL' },
  { service: 'PPC', path: '/ppc-company-long-grove-il', place: 'Long Grove, IL' },
  { service: 'PPC', path: '/ppc-company-mettawa-il', place: 'Mettawa, IL' },
  { service: 'PPC', path: '/ppc-company-riverwoods-il', place: 'Riverwoods, IL' },
  { service: 'PPC', path: '/ppc-company-s-barrington-il', place: 'S Barrington, IL' },
  { service: 'PPC', path: '/ppc-company-tower-lakes-il', place: 'Tower Lakes, IL' },
  { service: 'PPC', path: '/ppc-company-winnetka-il', place: 'Winnetka, IL' },
  { service: 'PPC', path: '/ppc-agency-evanston-il', place: 'Evanston, IL' },
  { service: 'PPC', path: '/ppc-highland-park-il', place: 'Highland Park, IL' },
  { service: 'PPC', path: '/ppc-company-kenilworth-il', place: 'Kenilworth, IL' },
  { service: 'PPC', path: '/ppc-agency-pilsen-il', place: 'Pilsen, IL' },
];

export const SERVICE_ORDER: Service[] = ['Web Design', 'Web Development', 'SEO', 'PPC'];
