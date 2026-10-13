import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { StatsRow } from "@/components/StatsRow";
import { sampleSummary } from "@test/fixtures";

describe("StatsRow", () => {
  it("renders summary stat labels", () => {
    render(<StatsRow summary={sampleSummary} />);
    expect(screen.getByText("Total spent")).toBeInTheDocument();
    expect(screen.getByText("Avg / day")).toBeInTheDocument();
    expect(screen.getByText("Money in")).toBeInTheDocument();
    expect(screen.getByText(/refunds lower spend instead/)).toBeInTheDocument();
    expect(screen.getByText("UPI payees")).toBeInTheDocument();
    expect(screen.getByText("Daily limit")).toBeInTheDocument();
  });

  it("counts payments, not every debit", () => {
    render(<StatsRow summary={{ ...sampleSummary, transactionCount: 1 }} />);
    expect(screen.getByText("1 payment")).toBeInTheDocument();
  });
});
