"use client";

import { useMemo } from "react";
import type { Transaction } from "@/types";
import { formatInr } from "@/helpers/currency";
import { CategorySlug } from "@/enums/category";
import { isInvestmentCategory } from "@/helpers/finance";
import { DailySpendChart, type DailySpendChartProps } from "./DailySpendChart";

export interface DailySpendWithInvestmentsProps extends Omit<DailySpendChartProps, "data" | "transactions" | "corner"> {
  transactions?: Transaction[];
}

function shareOf(txn: Transaction): number {
  return Math.abs(txn.myShare ?? txn.amount);
}

export function DailySpendWithInvestments({
  transactions,
  categories = [],
  ...props
}: DailySpendWithInvestmentsProps) {
  const investedTotal = useMemo(() => {
    if (!transactions) return 0;
    return transactions
      .filter((txn) => txn.type === "debit" && isInvestmentCategory(txn.category, categories))
      .reduce((sum, txn) => sum + shareOf(txn), 0);
  }, [transactions, categories]);

  const rentTotal = useMemo(() => {
    if (!transactions) return 0;
    return transactions
      .filter((txn) => txn.type === "debit" && txn.category === CategorySlug.Rent)
      .reduce((sum, txn) => sum + shareOf(txn), 0);
  }, [transactions]);

  const corner =
    investedTotal > 0 || rentTotal > 0 ? (
      <div className="chart-stickers">
        {investedTotal > 0 ? (
          <div
            className="chart-sticker invested-sticker investment-badge"
            data-testid="investment-badge"
            aria-label={`Invested ${formatInr(investedTotal)}`}
          >
            <span className="chart-sticker-mark" aria-hidden>
              📈
            </span>
            <span className="chart-sticker-copy">
              <span className="chart-sticker-kicker">invested</span>
              <strong className="badge-amount">{formatInr(investedTotal)}</strong>
            </span>
          </div>
        ) : null}
        {rentTotal > 0 ? (
          <div
            className="chart-sticker rent-sticker rent-badge"
            data-testid="rent-badge"
            aria-label={`Rent ${formatInr(rentTotal)}`}
          >
            <span className="chart-sticker-mark" aria-hidden>
              🏡
            </span>
            <span className="chart-sticker-copy">
              <span className="chart-sticker-kicker">rent</span>
              <strong className="badge-amount">{formatInr(rentTotal)}</strong>
            </span>
          </div>
        ) : null}
      </div>
    ) : null;

  return (
    <DailySpendChart transactions={transactions} categories={categories} corner={corner} {...props} />
  );
}
