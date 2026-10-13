"use client";

import type { CategorySummary, MerchantSpend } from "@/types";
import { formatShortDate } from "@/helpers/dates";
import { CategorySlug } from "@/enums/category";
import { isInvestmentCategory } from "@/helpers/finance";
import { Panel, PanelHead } from "@/components/ui/Panel";
import { GenericSpendChart, type SpendRow } from "@/components/charts/GenericSpendChart";

export interface MerchantSpendChartProps {
  items: MerchantSpend[];
  categories: CategorySummary[];
  title?: string;
  subtitle?: string;
  limit?: number;
  spentTotal?: number;
}

export function MerchantSpendChart({
  items,
  categories,
  title = "Top merchants",
  subtitle = "Ranked by spend",
  limit = 10,
  spentTotal,
}: MerchantSpendChartProps) {
  const categoryBySlug = new Map(categories.map((c) => [c.slug, c]));
  const ranked = items
    .filter(
      (m) =>
        m.count > 0 &&
        m.categorySlug !== CategorySlug.Rent &&
        m.categorySlug !== CategorySlug.Family &&
        !isInvestmentCategory(m.categorySlug, categories),
    )
    .sort((a, b) => b.total - a.total)
    .slice(0, limit);

  if (ranked.length === 0) {
    return (
      <Panel>
        <PanelHead title={title} subtitle={subtitle} />
        <p className="meta">No merchant spend recorded yet.</p>
      </Panel>
    );
  }

  const spendRows: SpendRow[] = ranked.map((merchant) => ({
    id: `${merchant.merchant}|${merchant.categorySlug ?? ""}`,
    label: merchant.merchant,
    total: merchant.total,
    logoUrl: merchant.logoUrl,
    metadata: [
      {
        text: `${categoryBySlug.get(merchant.categorySlug ?? "other")?.label ?? "Other"} · ${merchant.count} transaction${merchant.count === 1 ? "" : "s"}`,
      },
      ...(merchant.lastDate ? [{ text: `Last paid ${formatShortDate(merchant.lastDate)}` }] : []),
    ],
  }));

  return (
    <GenericSpendChart
      rows={spendRows}
      title={title}
      subtitle={subtitle}
      spentTotal={spentTotal}
      expandable={false}
    />
  );
}
