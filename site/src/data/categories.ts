// WordPress categories, extracted from data/raw/wp/categories.json.
//
// D1 stores each page's categories as a JSON array of WordPress term ids, so
// rendering a category name on a post card needs this lookup. Regenerate by
// re-running scripts/extract-wp.mjs if the taxonomy changes.

export interface Category { id: number; slug: string; name: string; count: number }

export const categories: Category[] = [
  { id: 353, slug: 'web-design', name: "Web Design", count: 235 },
  { id: 318, slug: 'digital-marketing', name: "Digital Marketing", count: 233 },
  { id: 198, slug: 'personal', name: "Personal", count: 189 },
  { id: 166, slug: 'app', name: "B2B App Reviews", count: 170 },
  { id: 354, slug: 'web-development', name: "Web Development", count: 85 },
  { id: 308, slug: 'workflows', name: "Workflows", count: 75 },
  { id: 85, slug: 'time-management', name: "Time Management", count: 71 },
  { id: 357, slug: 'user-experience', name: "User Experience", count: 71 },
  { id: 344, slug: 'seo', name: "Search Engine Optimization", count: 68 },
  { id: 345, slug: 'ppc', name: "Pay Per Click", count: 34 },
  { id: 347, slug: 'social-media', name: "Social Media", count: 22 },
  { id: 305, slug: 'magazine-2', name: "Magazine", count: 14 },
  { id: 349, slug: 'email-marketing', name: "Email Marketing", count: 13 },
];

export const categoryById = new Map(categories.map((c) => [c.id, c]));

/** First category of a page, used for the card label and its colour class. */
export function primaryCategory(json: string | null): Category | undefined {
  if (!json) return undefined;
  try {
    const ids = JSON.parse(json) as number[];
    for (const id of ids) {
      const hit = categoryById.get(id);
      if (hit) return hit;
    }
  } catch {}
  return undefined;
}
