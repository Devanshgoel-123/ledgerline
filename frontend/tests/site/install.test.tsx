import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CopyCommand } from "@/features/site/CopyCommand";
import { detectOs, InstallTabs } from "@/features/site/InstallTabs";

describe("CopyCommand", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("copies every line of the command and says so", async () => {
    const writeText = vi.fn(async () => undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    render(<CopyCommand commands={["cd ledgerline", "./ledgerline start"]} label="Start" />);
    fireEvent.click(screen.getByRole("button", { name: "Copy: Start" }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith("cd ledgerline\n./ledgerline start"));
    expect(await screen.findByText("Copied")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Copied to clipboard");
  });
});

describe("InstallTabs", () => {
  it("picks the visitor's system", () => {
    expect(detectOs("Mozilla/5.0 (Windows NT 10.0; Win64; x64)")).toBe("windows");
    expect(detectOs("Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5)")).toBe("macos");
    expect(detectOs("Mozilla/5.0 (X11; Linux x86_64)")).toBe("linux");
    expect(detectOs("Mozilla/5.0 (Linux; Android 14)")).toBe("macos");
  });

  it("switches systems with the arrow keys and shows WSL steps for Windows", async () => {
    render(<InstallTabs />);
    const mac = screen.getByRole("tab", { name: "macOS" });
    mac.focus();
    fireEvent.click(mac);
    fireEvent.keyDown(mac, { key: "ArrowRight" });
    const windows = screen.getByRole("tab", { name: "Windows (WSL)" });
    expect(windows).toHaveAttribute("aria-selected", "true");
    expect(windows).toHaveFocus();
    expect(screen.getByRole("tabpanel")).toHaveTextContent("Ubuntu terminal");
  });

  it("ends every install method with ./ledgerline start or the install script", () => {
    render(<InstallTabs />);
    const blocks = screen.getAllByRole("button", { name: /^Copy: / });
    expect(blocks.length).toBeGreaterThanOrEqual(4);
    expect(screen.getByText(/install\.sh \| sh$/)).toBeInTheDocument();
    expect(screen.getAllByText("./ledgerline start").length).toBeGreaterThanOrEqual(2);
  });
});
