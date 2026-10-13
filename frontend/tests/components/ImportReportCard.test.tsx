import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ImportReportCard } from "@/components/ImportReportCard";
import type { ImportReport } from "@/lib/api/types";

const base: ImportReport = {
  duplicate: false,
  previousImportDate: null,
  lines: 42,
  alreadyRecorded: 30,
  added: 10,
  directionCorrected: 0,
  needsReview: 2,
  previouslyDeleted: 0,
  outsideWindow: 0,
  statementFrom: "2026-09-01",
  statementTo: "2026-09-30",
};

describe("ImportReportCard", () => {
  afterEach(cleanup);

  it("shows what the upload changed, with counts that add up to the lines read", () => {
    render(<ImportReportCard report={base} onView={() => {}} onDismiss={() => {}} />);
    expect(screen.getByText("Statement imported")).toBeInTheDocument();
    expect(screen.getByText("Lines read").nextSibling).toHaveTextContent("42");
    expect(screen.getByText("Already recorded").nextSibling).toHaveTextContent("30");
    expect(screen.getByText("New payments added").nextSibling).toHaveTextContent("10");
    expect(screen.getByText("Not added, needs a look").nextSibling).toHaveTextContent("2");
    expect(screen.queryByText("Outside the tracked dates")).toBeNull();
    expect(screen.getByText(/2 lines did not add up/)).toBeInTheDocument();
  });

  it("says plainly when the same file was uploaded again", () => {
    render(
      <ImportReportCard
        report={{ ...base, duplicate: true, previousImportDate: "2026-10-01T09:00:00Z", statementTo: null }}
        onView={() => {}}
        onDismiss={() => {}}
      />,
    );
    expect(screen.getByText("Already imported")).toBeInTheDocument();
    expect(screen.getByText(/Nothing changed/)).toHaveTextContent("1 Oct 2026");
    expect(screen.queryByText("Lines read")).toBeNull();
  });

  it("links to the statement's own month", () => {
    const onView = vi.fn();
    render(<ImportReportCard report={base} onView={onView} onDismiss={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "View September 2026" }));
    expect(onView).toHaveBeenCalled();
  });
});
