import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { resolveMode } from "@/lib/config";

describe("resolveMode", () => {
  it("is the local app unless the build asks for the public site", () => {
    expect(resolveMode(undefined)).toBe("app");
    expect(resolveMode("")).toBe("app");
    expect(resolveMode("anything")).toBe("app");
    expect(resolveMode("site")).toBe("site");
    expect(resolveMode(" Site ")).toBe("site");
  });
});

describe("the start page", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("opens the local ledger in app mode", async () => {
    vi.stubEnv("NEXT_PUBLIC_LEDGERLINE_MODE", "app");
    vi.resetModules();
    const { default: HomePage } = await import("@/app/page");
    const { LocalHome } = await import("@/components/LocalHome");
    expect(HomePage().type).toBe(LocalHome);
  });

  it("shows the landing page with install steps on the public site", async () => {
    vi.stubEnv("NEXT_PUBLIC_LEDGERLINE_MODE", "site");
    vi.resetModules();
    const { default: HomePage } = await import("@/app/page");
    const { ThemeProvider: FreshTheme } = await import("@/lib/theme");
    render(<FreshTheme>{HomePage()}</FreshTheme>);
    expect(
      screen.getByRole("heading", { level: 1, name: /your upi spending, sorted on your own computer/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Install it" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Open my ledger" })).not.toBeInTheDocument();
  });

  it("never mounts app pages on the public site", async () => {
    vi.stubEnv("NEXT_PUBLIC_LEDGERLINE_MODE", "site");
    vi.resetModules();
    const { default: DashboardRootLayout } = await import("@/app/(dashboard)/layout");
    const { ThemeProvider: FreshTheme } = await import("@/lib/theme");
    render(
      <FreshTheme>
        {DashboardRootLayout({ children: <p>dashboard content</p> })}
      </FreshTheme>,
    );
    expect(screen.queryByText("dashboard content")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Install Ledgerline" })).toHaveAttribute("href", "/install");
  });
});

describe("the profile on the public site", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it("never calls an API, so visitors' computers are never contacted", async () => {
    vi.stubEnv("NEXT_PUBLIC_LEDGERLINE_MODE", "site");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    vi.resetModules();
    const { ProfileProvider } = await import("@/lib/profile");
    render(
      <ProfileProvider>
        <p>landing</p>
      </ProfileProvider>,
    );
    await screen.findByText("landing");
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
