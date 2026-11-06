import catalog from "./catalog.generated.json";
import type { CategoryRow, ProviderRow } from "./shared";

/** A category as the app shows it. Built-in ones come from the backend migrations. */
export interface Category {
  slug: string;
  label: string;
  blurb: string;
  /** Shown under this category in pickers and the breakdown. */
  parent: string | null;
  sortOrder: number;
  custom: boolean;
}

export const BUILT_IN_CATEGORIES: Category[] = catalog.categories.map((category) => ({
  ...category,
  custom: false,
}));

/** Shops and apps Ledgerline recognises in a statement narration or UPI id. */
export const PROVIDERS: ProviderRow[] = catalog.providers.map((provider) => ({
  id: provider.id,
  userId: null,
  canonicalName: provider.canonicalName,
  aliases: provider.aliases,
  upiHandles: provider.upiHandles,
  senderDomains: [],
  websiteDomain: null,
  logoUrl: null,
  categorySlug: provider.categorySlug,
  isGlobal: true,
}));

/** Categories in the shape the shared backend code expects. */
export function toCategoryRows(categories: Category[]): CategoryRow[] {
  return categories.map((category) => ({
    id: category.slug,
    userId: null,
    slug: category.slug,
    label: category.label,
    blurb: category.blurb,
    accent: "",
    sortOrder: category.sortOrder,
    meta: category.parent ? { parent: category.parent } : {},
    isGlobal: !category.custom,
  }));
}

export function categoryLabel(slug: string | null | undefined, categories: Category[]): string {
  if (!slug) return "Other";
  return categories.find((category) => category.slug === slug)?.label ?? "Other";
}

/** Top-level categories, each followed by its children, in catalog order. */
export function categoryTree(categories: Category[]): { parent: Category; children: Category[] }[] {
  const bySort = [...categories].sort(
    (a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label),
  );
  const known = new Set(bySort.map((category) => category.slug));
  return bySort
    .filter((category) => !category.parent || !known.has(category.parent))
    .map((parent) => ({
      parent,
      children: bySort.filter((category) => category.parent === parent.slug),
    }));
}

/** The top-level category a slug rolls up to. */
export function rootCategory(slug: string, categories: Category[]): string {
  let current = categories.find((category) => category.slug === slug);
  const seen = new Set<string>();
  while (current?.parent && !seen.has(current.slug)) {
    seen.add(current.slug);
    const parent = categories.find((category) => category.slug === current!.parent);
    if (!parent) break;
    current = parent;
  }
  return current?.slug ?? slug;
}

/** A slug for a new category name, unique among the ones that exist. */
export function slugForLabel(label: string, categories: Category[]): string {
  const base =
    label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "category";
  const taken = new Set(categories.map((category) => category.slug));
  if (!taken.has(base)) return base;
  let n = 2;
  while (taken.has(`${base}-${n}`)) n += 1;
  return `${base}-${n}`;
}
