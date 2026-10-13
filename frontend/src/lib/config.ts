export const appConfig = {
  apiBaseUrl:
    process.env.NEXT_PUBLIC_API_URL?.trim() || "http://localhost:4000",
  /** Public source and docs, linked from onboarding. */
  repoUrl: "https://github.com/Devanshgoel-123/ledgerline",
} as const;
