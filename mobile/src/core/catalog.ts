import { BRAND_OVERRIDES, EXTRA_BRANDS } from "./brands";
import catalog from "./catalog.generated.json";
import type { CategoryRow, ProviderRow } from "./shared";
import { TAXONOMY, type CategoryKind } from "./taxonomy";

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

export const BUILT_IN_CATEGORIES: Category[] = TAXONOMY.flatMap((root, index) => [
  { slug: root.slug, label: root.label, blurb: root.blurb, parent: null, sortOrder: (index + 1) * 100, custom: false },
  ...(root.children ?? []).map((child, childIndex) => ({
    slug: child.slug,
    label: child.label,
    blurb: child.blurb,
    parent: root.slug,
    sortOrder: (index + 1) * 100 + childIndex + 1,
    custom: false,
  })),
]);

const KIND_OF_ROOT = new Map(TAXONOMY.map((root) => [root.slug, root.kind]));

/** Money out, money in, or a move between your own accounts. Custom categories take their parent's. */
export function categoryKind(slug: string | null | undefined, categories: Category[]): CategoryKind {
  if (!slug) return "expense";
  return KIND_OF_ROOT.get(rootCategory(slug, categories)) ?? "expense";
}

/** Whether a category fits a debit or a credit. Transfers fit both. */
export function fitsType(slug: string, type: "debit" | "credit", categories: Category[]): boolean {
  const kind = categoryKind(slug, categories);
  if (kind === "transfer" || slug === "other") return true;
  return type === "credit" ? kind === "income" || rootCategory(slug, categories) === "family" : kind !== "income";
}

/** Shops and apps Ledgerline recognises in a statement narration or UPI id. */
export const PROVIDERS: ProviderRow[] = [
  ...catalog.providers.map((provider) => {
    const override = BRAND_OVERRIDES[provider.canonicalName];
    return {
      id: provider.id,
      userId: null,
      canonicalName: provider.canonicalName,
      aliases: [...provider.aliases, ...(override?.aliases ?? [])],
      upiHandles: [...provider.upiHandles, ...(override?.upi ?? [])],
      senderDomains: [],
      websiteDomain: override?.domain ?? null,
      // Logos are bundled with the app (src/ui/brandLogos.generated.ts), never fetched.
      logoUrl: null,
      categorySlug: override?.category ?? provider.categorySlug,
      isGlobal: true,
    };
  }),
  ...EXTRA_BRANDS.map((brand) => ({
    id: `catalog:${brand.name.toLowerCase()}`,
    userId: null,
    canonicalName: brand.name,
    aliases: brand.aliases ?? [],
    upiHandles: brand.upi ?? [],
    senderDomains: [],
    websiteDomain: brand.domain,
    logoUrl: null,
    categorySlug: brand.category,
    isGlobal: true,
  })),
];

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
