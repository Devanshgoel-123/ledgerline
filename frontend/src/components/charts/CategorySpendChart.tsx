"use client";

import type { CategorySpendRow } from "@/helpers/finance";
import { logoForCategory } from "@/helpers/apps";
import { GenericSpendChart, type SpendRow } from "@/components/charts/GenericSpendChart";

export interface CategorySpendChartProps {
  rows: CategorySpendRow[];
  title?: string;
  subtitle?: string;
  /** Denominator for share. Defaults to the sum of the rows shown. */
  spentTotal?: number;
}

export function CategorySpendChart({
  rows,
  title = "Category spending",
  subtitle = "Ranked by total spend",
  spentTotal,
}: CategorySpendChartProps) {
  const spendRows: SpendRow[] = rows.map((row) => ({
    id: row.id,
    label: row.label,
    total: row.total,
    children: row.children.map((child) => ({
      id: child.id,
      label: child.label,
      total: child.total,
      count: child.count,
      logoUrl: child.logoUrl ?? logoForCategory(child.id),
    })),
  }));

  return (
    <GenericSpendChart
      rows={spendRows}
      title={title}
      subtitle={subtitle}
      spentTotal={spentTotal}
      expandable={true}
    />
  );
}
