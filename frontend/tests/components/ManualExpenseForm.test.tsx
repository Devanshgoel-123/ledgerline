import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ManualExpenseForm } from "@/components/LedgerMoneyForms";
import type { CategorySummary } from "@/types";

const categories = [{ slug: "food", label: "Food" }] as unknown as CategorySummary[];

describe("ManualExpenseForm", () => {
  it("says which field is missing instead of disabling Save", () => {
    render(<ManualExpenseForm categories={categories} onSaved={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Add expense" }));
    const save = screen.getByRole("button", { name: "Save" });
    expect(save).toBeEnabled();
    fireEvent.click(save);
    expect(screen.getByRole("alert")).toHaveTextContent("Add what it was for");
  });
});
