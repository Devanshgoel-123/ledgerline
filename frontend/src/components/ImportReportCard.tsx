"use client";

import type { ImportReport } from "@/lib/api/types";
import { formatMonthTitle } from "@/helpers/finance";
import { formatIsoDateLabel } from "@/constants/pooling";

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;

/** What the last statement upload changed, so it can be checked against the PDF. */
export function ImportReportCard({
  report,
  onView,
  onDismiss,
}: {
  report: ImportReport;
  onView: () => void;
  onDismiss: () => void;
}) {
  const month = report.statementTo?.slice(0, 7) ?? null;
  const rows: Array<[string, number]> = report.duplicate
    ? []
    : [
        ["Lines read", report.lines],
        ["Already recorded", report.alreadyRecorded],
        ["New payments added", report.added],
        ["Switched between paid and received", report.directionCorrected],
        ["Not added, needs a look", report.needsReview],
        ["Deleted by you before, not added back", report.previouslyDeleted],
        ["Outside the tracked dates", report.outsideWindow],
      ];

  return (
    <section className="panel" role="status" aria-label="Statement import result">
      <h3 className="stat-kicker mb-2">
        {report.duplicate ? "Already imported" : "Statement imported"}
      </h3>
      {report.duplicate ? (
        <p className="meta">
          Nothing changed. This exact file was imported
          {report.previousImportDate ? ` on ${formatIsoDateLabel(report.previousImportDate.slice(0, 10))}` : " before"}.
        </p>
      ) : (
        <>
          {report.statementFrom && report.statementTo ? (
            <p className="meta mb-2">
              {formatIsoDateLabel(report.statementFrom)} – {formatIsoDateLabel(report.statementTo)}
            </p>
          ) : null}
          <dl className="import-report">
            {rows
              .filter(([label, count]) => count > 0 || label === "New payments added" || label === "Lines read")
              .map(([label, count]) => (
                <div key={label} className="flex justify-between gap-4">
                  <dt className="meta">{label}</dt>
                  <dd className="tabular-nums">{count}</dd>
                </div>
              ))}
          </dl>
          {report.needsReview > 0 ? (
            <p className="meta mt-2">
              {plural(report.needsReview, "line")} did not add up against the closing balance, or a
              similar payment is already there. They were not added so nothing is counted twice.
            </p>
          ) : null}
        </>
      )}
      <div className="mt-3 flex gap-2">
        {month ? (
          <button type="button" className="cta" onClick={onView}>
            View {formatMonthTitle(month)}
          </button>
        ) : null}
        <button type="button" className="ghost" onClick={onDismiss}>
          Dismiss
        </button>
      </div>
    </section>
  );
}
