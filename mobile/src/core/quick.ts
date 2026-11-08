import { categoryLabel, categoryTree, fitsType, rootCategory, type Category } from "./catalog";
import { fromIsoDate, isoDate } from "./dates";
import type { Entry, TxType } from "./model";

/**
 * Categories for Quick add, most useful first: the one asked for, then those
 * used most in the last 60 days (as chosen, sub-category or not), then the
 * remaining top-level categories in catalog order. No duplicates.
 */
export function quickCategories(
  entries: Entry[],
  categories: Category[],
  options: { type: TxType; preferred?: string | null; today: string; limit?: number },
): string[] {
  const known = new Set(categories.map((category) => category.slug));
  const since = fromIsoDate(options.today);
  since.setDate(since.getDate() - 60);
  const cutoff = isoDate(since);

  const counts = new Map<string, number>();
  const lastUsed = new Map<string, string>();
  for (const entry of entries) {
    if (entry.type !== options.type || entry.origin === "sample" || entry.date < cutoff) continue;
    const slug = entry.categorySlug;
    if (!slug || slug === "other" || !known.has(slug) || !fitsType(slug, options.type, categories)) continue;
    counts.set(slug, (counts.get(slug) ?? 0) + 1);
    if ((lastUsed.get(slug) ?? "") < entry.date) lastUsed.set(slug, entry.date);
  }
  const used = [...counts.keys()].sort(
    (a, b) => counts.get(b)! - counts.get(a)! || (lastUsed.get(b) ?? "").localeCompare(lastUsed.get(a) ?? ""),
  );

  const roots = categoryTree(categories)
    .map((node) => node.parent.slug)
    .filter((slug) => fitsType(slug, options.type, categories) && (options.type === "credit" || slug !== "transfers"));

  const order: string[] = [];
  const push = (slug: string | null | undefined) => {
    if (slug && known.has(slug) && !order.includes(slug)) order.push(slug);
  };
  push(options.preferred);
  used.forEach(push);
  // A root already covered by a used child still appears: people pick both.
  roots.forEach(push);
  return options.limit ? order.slice(0, options.limit) : order;
}

/**
 * What the iOS payment popup offers, money out and money in: your most used
 * categories first, then the rest of the top-level ones, and Other last.
 */
export function popupCategories(
  entries: Entry[],
  categories: Category[],
  today: string,
): Record<TxType, { slug: string; label: string; root: string }[]> {
  const list = (type: TxType) => {
    const last = type === "credit" ? "other-income" : "other";
    const known = new Set(categories.map((category) => category.slug));
    let slugs = quickCategories(entries, categories, { type, today, limit: 14 });
    if (type === "credit") {
      // Money in is mostly sorted by its sub-categories (Salary, Refunds), so offer those, not "Income".
      const usual = ["salary", "refunds", "from-home", "interest", "transfers", "investments"];
      const used = slugs.filter((slug) => !TOP_LEVEL_FALLBACK.has(slug));
      slugs = [...new Set([...used, ...usual])].filter((slug) => known.has(slug));
    }
    slugs = slugs.filter((slug) => slug !== last && slug !== "other");
    return [...slugs, last].map((slug) => ({ slug, label: categoryLabel(slug, categories), root: rootCategory(slug, categories) }));
  };
  return { debit: list("debit"), credit: list("credit") };
}

// Top-level categories quickCategories adds after the used ones; for money in they're too broad to offer.
const TOP_LEVEL_FALLBACK = new Set(["income", "family", "investments", "transfers", "other"]);

/** The four categories a widget shows as shortcuts. */
export function widgetShortcuts(entries: Entry[], categories: Category[], today: string): string[] {
  const order = quickCategories(entries, categories, { type: "debit", today });
  const fallback = ["food", "grocery", "transport", "shopping"];
  // Prefer distinct roots so the four tiles differ in colour.
  const picked: string[] = [];
  const roots = new Set<string>();
  for (const slug of [...order, ...fallback]) {
    const root = rootCategory(slug, categories);
    if (roots.has(root) || picked.includes(slug)) continue;
    roots.add(root);
    picked.push(slug);
    if (picked.length === 4) break;
  }
  return picked;
}

/**
 * The next amount string after a keypad press. Keeps at most two decimals and
 * eight whole digits, and no leading zeros.
 */
export function pressKey(current: string, key: string): string {
  if (key === "back") return current.slice(0, -1);
  if (key === "clear") return "";
  if (key === ".") {
    if (current.includes(".")) return current;
    return current === "" ? "0." : `${current}.`;
  }
  if (!/^\d$/.test(key)) return current;
  const [whole, fraction] = current.split(".");
  if (fraction !== undefined) return fraction.length >= 2 ? current : `${current}${key}`;
  if (whole === "0") return key;
  if ((whole ?? "").length >= 8) return current;
  return `${current}${key}`;
}
