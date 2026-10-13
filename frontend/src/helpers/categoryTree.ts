type CategoryNode = { slug: string; meta?: { parent?: string } | null };

/** A category's slug plus every category nested under it, at any depth. */
export function categoryWithDescendants(
  slug: string,
  categories: CategoryNode[],
): Set<string> {
  const slugs = new Set([slug]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const category of categories) {
      const parent = category.meta?.parent;
      if (parent && slugs.has(parent) && !slugs.has(category.slug)) {
        slugs.add(category.slug);
        grew = true;
      }
    }
  }
  return slugs;
}
