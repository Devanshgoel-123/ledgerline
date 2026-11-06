import { PROVIDERS, toCategoryRows, type Category } from "./catalog";
import type { Rule, TxType } from "./model";
import { classifyTransaction, ClassificationSource, type UserRuleRow } from "./shared";
import { matchRule } from "@shared/rules/engine.js";

export interface Classified {
  merchant: string | null;
  payee: string | null;
  providerId: string | null;
  categorySlug: string;
  classificationSource: string;
}

export function toUserRuleRow(rule: Rule): UserRuleRow {
  return {
    id: rule.id,
    userId: "",
    name: rule.name,
    priority: 0,
    enabled: true,
    matchNarrationRe: rule.matchNarrationRe,
    matchUpiId: rule.matchUpiId,
    matchMerchantAlias: null,
    matchAmountMin: null,
    matchAmountMax: null,
    matchType: null,
    setProviderId: null,
    setPayeeName: rule.setPayeeName,
    setCategorySlug: rule.setCategorySlug,
    setTags: [],
  };
}

/**
 * Category, shop and person for a payment. A rule the user made wins (they
 * chose it); then the shop catalog; then Other. The catalog and rule
 * matching are the backend's.
 */
export function classify(
  tx: { description: string; upiId: string | null; merchant: string | null; payee: string | null; amount: number; type: TxType },
  rules: Rule[],
  categories: Category[],
): Classified {
  // Newest rule first: the latest choice is the one the user means.
  const userRules = [...rules].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(toUserRuleRow);
  const own = userRules.find((rule) => matchRule(rule, tx));
  const base = classifyTransaction(tx, { providers: PROVIDERS, rules: [], categories: toCategoryRows(categories) });
  if (!own) return { ...base, categorySlug: base.categorySlug ?? "other" };
  return {
    merchant: base.merchant,
    payee: own.setPayeeName ?? base.payee,
    providerId: base.providerId,
    categorySlug: own.setCategorySlug ?? base.categorySlug ?? "other",
    classificationSource: `rule:${own.id}`,
  };
}

/** A rule that files future payments like this one, or null if nothing identifies it. */
export function ruleFor(
  tx: { upiId: string | null; merchant: string | null },
  set: { categorySlug: string | null; payee?: string | null },
): Omit<Rule, "id" | "createdAt"> | null {
  const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  if (tx.upiId) {
    return {
      name: tx.merchant ?? tx.upiId,
      matchUpiId: tx.upiId.toLowerCase(),
      matchNarrationRe: null,
      setCategorySlug: set.categorySlug,
      setPayeeName: set.payee ?? null,
    };
  }
  const merchant = tx.merchant?.trim();
  if (merchant && merchant.length >= 3) {
    return {
      name: merchant,
      matchUpiId: null,
      matchNarrationRe: `(?:^|\\W)${escape(merchant)}(?:\\W|$)`,
      setCategorySlug: set.categorySlug,
      setPayeeName: set.payee ?? null,
    };
  }
  return null;
}

export { ClassificationSource };
