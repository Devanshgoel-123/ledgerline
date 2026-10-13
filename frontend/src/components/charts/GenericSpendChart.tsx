"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { formatInr } from "@/helpers/currency";
import { LedgerlineCountUp } from "@/components/animations/LedgerlineCountUp";
import { Panel, PanelHead } from "@/components/ui/Panel";
import { BrandMark } from "@/components/BrandMark";
import { ShareBar } from "@/components/charts/ShareBar";
import { shareTone, shareToneLabel, type ChartTone } from "@/components/charts/chartTone";

export interface SpendRow {
  id: string;
  label: string;
  total: number;
  /** Number of payments, shown on expanded children. */
  count?: number;
  logoUrl?: string | null;
  children?: SpendRow[];
  metadata?: Array<{ text: string; tone?: ChartTone }>;
}

export interface GenericSpendChartProps {
  rows: SpendRow[];
  title?: string;
  subtitle?: string;
  spentTotal?: number;
  expandable?: boolean;
}

function percent(part: number, whole: number): number {
  return whole > 0 ? Math.round((part / whole) * 100) : 0;
}

function initials(label: string): string {
  const words = label.trim().split(/\s+/).filter(Boolean);
  const letters = words.length > 1 ? words[0]![0]! + words[1]![0]! : (words[0] ?? "?").slice(0, 2);
  return letters.toUpperCase();
}

export function GenericSpendChart({
  rows,
  title = "Spending breakdown",
  subtitle = "Ranked by total spend",
  spentTotal,
  expandable = false,
}: GenericSpendChartProps) {
  const max = Math.max(...rows.map((row) => row.total), 1);
  const shown = rows.reduce((sum, row) => sum + row.total, 0);
  const total = spentTotal != null && spentTotal > 0 ? spentTotal : shown;
  const [open, setOpen] = useState<Set<string>>(() => new Set());

  if (rows.length === 0) {
    return (
      <Panel>
        <PanelHead title={title} subtitle={subtitle} />
        <p className="meta">No data in this period yet.</p>
      </Panel>
    );
  }

  const toggle = (id: string) =>
    setOpen((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <Panel aria-label={title}>
      <PanelHead title={title} subtitle={subtitle} />
      <ul className="spend-list">
        {rows.map((row, index) => {
          const share = total > 0 ? row.total / total : 0;
          const tone = rows.length < 2 ? "calm" : shareTone(share);
          const toneLabel = shareToneLabel(tone);
          const shareLabel = `${percent(row.total, total)}%`;
          const details = (row.metadata ?? []).map((item) => item.text).join(" · ");
          const hasChildren = expandable && row.children && row.children.length > 0;
          const isExpanded = open.has(row.id);
          const childrenId = `spend-children-${row.id}`;

          return (
            <motion.li
              key={row.id}
              className={`spend-item${isExpanded ? " is-open" : ""}`}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.03 }}
            >
              <button
                type="button"
                className={`category-row${hasChildren ? "" : " is-static"}`}
                aria-expanded={hasChildren ? isExpanded : undefined}
                aria-controls={hasChildren ? childrenId : undefined}
                aria-label={`${row.label}: ${formatInr(row.total)}, ${shareLabel} of total, ${toneLabel}`}
                onClick={() => hasChildren && toggle(row.id)}
              >
                <span className="category-row-label">
                  {hasChildren ? (
                    <span className={`category-chevron${isExpanded ? " open" : ""}`} aria-hidden />
                  ) : row.logoUrl ? (
                    <BrandMark name={row.label} logoUrl={row.logoUrl} size={24} />
                  ) : null}
                  <span className="category-row-copy">
                    <span className="category-row-name">{row.label}</span>
                    {details ? <span className="category-row-detail">{details}</span> : null}
                  </span>
                </span>
                <span className="category-row-bar">
                  <ShareBar widthRatio={row.total / max} tone={tone} />
                </span>
                <span className="category-row-figures">
                  <span className="category-row-amount">
                    <LedgerlineCountUp value={row.total} format={(n) => formatInr(n)} once />
                  </span>
                  <span className={`category-row-share tone-${tone}`}>
                    {shareLabel}
                    {tone !== "calm" ? <span className="sr-only">, {toneLabel}</span> : null}
                  </span>
                </span>
              </button>
              {isExpanded && hasChildren ? (
                <ul className="category-children" id={childrenId}>
                  {row.children!.map((child) => (
                    <li key={child.id} className="category-child">
                      {child.logoUrl ? (
                        <BrandMark name={child.label} logoUrl={child.logoUrl} size={28} />
                      ) : (
                        <span className="category-child-avatar" aria-hidden>
                          {initials(child.label)}
                        </span>
                      )}
                      <span className="category-child-copy">
                        <span>{child.label}</span>
                        {child.count ? (
                          <small>
                            {child.count} payment{child.count === 1 ? "" : "s"}
                          </small>
                        ) : null}
                      </span>
                      <span className="category-child-bar" aria-hidden>
                        <span style={{ width: `${Math.max(3, percent(child.total, row.total))}%` }} />
                      </span>
                      <span className="category-child-amount">
                        {formatInr(child.total)}
                        <small>{percent(child.total, row.total)}% of {row.label}</small>
                      </span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </motion.li>
          );
        })}
      </ul>

      <table className="sr-only" role="table" aria-label={`${title} data`}>
        <thead>
          <tr>
            <th>Item</th>
            <th>Amount</th>
            <th>Share of total</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td>{row.label}</td>
              <td>{formatInr(row.total)}</td>
              <td>{percent(row.total, total)}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Panel>
  );
}
