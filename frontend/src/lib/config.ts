/**
 * "app": the copy running on someone's own computer, talking to its local API.
 * "site": the public website, which explains Ledgerline and how to install it. It never calls an API.
 */
export type LedgerlineMode = "app" | "site";

export function resolveMode(raw: string | undefined): LedgerlineMode {
  return raw?.trim().toLowerCase() === "site" ? "site" : "app";
}

export const appConfig = {
  apiBaseUrl:
    process.env.NEXT_PUBLIC_API_URL?.trim() || "http://localhost:4000",
  mode: resolveMode(process.env.NEXT_PUBLIC_LEDGERLINE_MODE),
  /** Public source and docs. */
  repoUrl: "https://github.com/Devanshgoel-123/ledgerline",
} as const;

export const isSiteMode = appConfig.mode === "site";
