import type { ParseResult } from "@/types";
import { requestBlob, requestJson, requestVoid } from "./http";
import type {
  AccountSummary,
  LocalProfile,
  MailProviderId,
  MailStatus,
  ParseStatementResult,
  Provider,
  TelegramStatus,
} from "./types";

export type StatementMatchJob = {
  id: string;
  status: "running" | "done";
  total: number;
  completed: number;
  labeled: number;
  doneIds: string[];
  failures: { upiId: string; message: string }[];
  window: { from: string; to: string };
};

/**
 * Client for the Ledgerline API running on this computer.
 * Create with `createApiClient()` or consume via `useApi()`.
 */
export function createApiClient() {
  return {
    /** Load the local profile. */
    fetchMe: (): Promise<LocalProfile> =>
      requestJson<LocalProfile>("/api/me"),

    updateProfile: (body: {
      displayName?: string | null;
      avatarUrl?: string | null;
    }): Promise<LocalProfile> =>
      requestJson<LocalProfile>("/api/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),

    /** Erase everything Ledgerline stores on this computer and start fresh. */
    eraseAllData: (): Promise<void> =>
      requestVoid("/api/me", { method: "DELETE" }),

    /** Wipe imported mail and transactions. Keeps settings and the mailbox connection. */
    clearImportedData: (): Promise<import("./types").ClearedImportedData> =>
      requestJson("/api/imports/data", { method: "DELETE" }),

    /** Parse and import a bank statement PDF. */
    parseStatement: (file: File, password: string): Promise<ParseStatementResult> => {
      const form = new FormData();
      form.append("file", file);
      form.append("password", password);
      return requestJson<ParseStatementResult>("/api/parse", {
        method: "POST",
        body: form,
      });
    },

    /** Load aggregated dashboard analytics for a month range. */
    fetchDashboard: (range?: { from?: string; to?: string }): Promise<ParseResult> => {
      const params = new URLSearchParams();
      if (range?.from) params.set("from", range.from);
      if (range?.to) params.set("to", range.to);
      const qs = params.toString();
      return requestJson<ParseResult>(
        `/api/imports/dashboard${qs ? `?${qs}` : ""}`);
    },

    /** Lightweight bootstrap — whether the account has any transactions. */
    fetchImportStatus: (): Promise<import("./types").ImportStatus> =>
      requestJson<import("./types").ImportStatus>("/api/imports/status"),

    fetchBankPresets: () =>
      requestJson<{ presets: import("./types").BankPreset[]; notice: string }>(
        "/api/accounts/bank-presets"),

    fetchAccounts: () =>
      requestJson<{ accounts: AccountSummary[] }>("/api/accounts"),

    patchAccount: (body: {
      bank?: string;
      label?: string;
      statementSenderEmails?: string[];
      createIfMissing?: boolean;
    }) =>
      requestJson<{ account: AccountSummary; readyForPooling: boolean }>(
        "/api/accounts",
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      ),

    enablePooling: (
      body: { month?: string; password?: string; maxMessages?: number; banks?: string[] } = {},
    ) =>
      requestJson<{ status: "running"; runId: string }>("/api/mail/pooling/enable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),

    listRules: () =>
      requestJson<{ rules: Array<Record<string, unknown>> }>("/api/rules"),

    createRule: (body: Record<string, unknown>) =>
      requestJson<Record<string, unknown>>("/api/rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),

    deleteRule: (id: string) =>
      requestVoid(`/api/rules/${id}`, { method: "DELETE" }),

    attachPersonUpi: (body: { name: string; upiId: string }) =>
      requestJson<{ ok: true; attached: boolean }>("/api/rules/attach-upi", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),

    detachPersonUpi: (body: { name: string; upiId: string }) =>
      requestJson<{ ok: true; cleared: number }>("/api/rules/detach-upi", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),

    untrackPerson: (name: string) =>
      requestJson<{ ok: true; removedRules: number; cleared: number }>("/api/rules/untrack", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      }),

    fetchSuggestions: () =>
      requestJson<{
        suggestions: Array<{ label: string; count: number; sample: string }>;
      }>("/api/rules/suggestions"),

    fetchPreferences: () =>
      requestJson<{ dailySpendLimit: number | null }>("/api/preferences"),

    updatePreferences: (body: { dailySpendLimit: number | null }) =>
      requestJson<{ dailySpendLimit: number | null }>("/api/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),

    mailStatus: () => requestJson<MailStatus>("/api/mail/status"),

    /** The server signs in with the app password before saving it, so a wrong one fails here. */
    connectMailbox: (body: {
      email: string;
      provider: MailProviderId;
      host?: string;
      port?: number;
      password: string;
    }) =>
      requestJson<MailStatus>("/api/mail/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),

    disconnectMailbox: () =>
      requestJson<{ ok: true }>("/api/mail/connect", { method: "DELETE" }),

    /** Re-read this month's bank mail; runs in the background. */
    scanMailNow: () =>
      requestJson<{ status: "running"; runId: string }>("/api/mail/scan-now", { method: "POST" }),

    telegramStatus: () =>
      requestJson<TelegramStatus>("/api/telegram/status"),

    createTelegramLink: () =>
      requestJson<TelegramStatus>("/api/telegram/link", {
        method: "POST",
      }),

    sendTelegramTest: () =>
      requestJson<TelegramStatus & { sent: boolean }>("/api/telegram/test", {
        method: "POST",
      }),

    unlinkTelegram: () =>
      requestJson<TelegramStatus>("/api/telegram/link", {
        method: "DELETE",
      }),

    requestTelegramPhone: (phone: string) =>
      requestJson<TelegramStatus>("/api/telegram/phone", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      }),

    confirmTelegramPhone: (code: string) =>
      requestJson<TelegramStatus>("/api/telegram/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      }),

    listProviders: () =>
      requestJson<{ providers: Provider[] }>("/api/providers"),

    createCategory: (body: { label: string; blurb?: string; accent?: string }) =>
      requestJson<{ category: import("@/types").CategorySummary }>(
        "/api/categories",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      ),

    getUpiCategoryHint: (upiId: string) =>
      requestJson<{ hint: { categorySlug: string; usageCount: number } | null }>(
        `/api/categories/hints/upi/${encodeURIComponent(upiId)}`),

    listUpiCategoryHints: () =>
      requestJson<{
        hints: { upiId: string; categorySlug: string; usageCount: number }[];
      }>("/api/categories/hints"),

    saveUpiCategoryHint: (upiId: string, categorySlug: string) =>
      requestJson<{ success: boolean }>(
        "/api/categories/hints/upi",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ upiId, categorySlug }),
        },
      ),

    deleteUpiCategoryHint: (upiId: string) =>
      requestJson<{ success: boolean }>(
        `/api/categories/hints/upi/${encodeURIComponent(upiId)}`,
        {
          method: "DELETE",
        },
      ),

    previewStatementMatch: (file: File, password: string) => {
      const form = new FormData();
      form.append("file", file);
      form.append("password", password);
      return requestJson<{
        filename: string;
        lineCount: number;
        outsideWindow: number;
        window: { from: string; to: string };
        note: string;
        suggestions: Array<{
          upiId: string;
          providerId: string | null;
          providerName: string | null;
          reason: "name" | "already-linked" | "business";
          lineCount: number;
          sample: string;
          uniqueMatches: number;
          timelineMatches: number;
          ambiguous: number;
          unmatched: number;
        }>;
        gaps: {
          missingCount: number;
          missingCreditCount: number;
          missing: Array<{
            date: string;
            amount: number;
            type: "debit" | "credit";
            description: string;
            upiId: string | null;
          }>;
          noMailCount: number;
          noMail: Array<{
            date: string;
            amount: number;
            type: "debit" | "credit";
            description: string;
            upiId: string | null;
          }>;
        };
        lines: Array<{
          date: string;
          amount: number;
          type: "debit" | "credit";
          description: string;
          upiId: string | null;
        }>;
      }>("/api/statement-match/preview", {
        method: "POST",
        body: form,
      });
    },

    importMissingStatementLines: (
      lines: Array<{
        date: string;
        amount: number;
        type: "debit" | "credit";
        description: string;
        upiId: string | null;
        categorySlug?: string | null;
      }>,
    ) =>
      requestJson<{ inserted: number; skipped: number; previouslyDeleted?: number }>("/api/statement-match/import-missing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lines }),
      }),

    applyStatementMatch: (body: {
      upiId: string;
      providerId: string;
      lines: Array<{
        date: string;
        amount: number;
        type: "debit" | "credit";
        description: string;
        upiId: string | null;
      }>;
    }) =>
      requestJson<{
        providerName: string;
        updated: number;
        timelineUpdated: number;
        ambiguous: number;
        unmatched: number;
        outsideWindow: number;
        window: { from: string; to: string };
      }>("/api/statement-match/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),

    startStatementMatchBatch: (body: {
      lines: Array<{
        date: string;
        amount: number;
        type: "debit" | "credit";
        description: string;
        upiId: string | null;
      }>;
      items: Array<{ upiId: string; providerId: string }>;
    }) =>
      requestJson<StatementMatchJob>("/api/statement-match/apply-batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),

    statementMatchJob: (jobId: string) =>
      requestJson<StatementMatchJob>(`/api/statement-match/apply-batch/${jobId}`),

    patchProvider: (
      id: string,
      body: { categorySlug?: string; addUpiHandle?: string },
    ) =>
      requestJson<{ provider: Provider }>(`/api/providers/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),

    createProvider: (body: {
      canonicalName: string;
      categorySlug?: string | null;
      aliases?: string[];
      upiHandles?: string[];
      websiteDomain?: string | null;
      logoUrl?: string | null;
    }) =>
      requestJson<{ provider: Provider }>("/api/providers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),

    deleteTransaction: (id: string) =>
      requestJson<{ ok: true }>(`/api/imports/transactions/${id}`, {
        method: "DELETE",
      }),

    createManualExpense: (body: {
      date: string;
      amount: number;
      categorySlug: string;
      description: string;
    }) =>
      requestJson<{ transaction: unknown }>("/api/imports/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),

    setBillSplit: (id: string, friends: { name: string; amount: number }[]) =>
      requestJson<{ transaction: unknown }>(`/api/imports/transactions/${id}/splits`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ friends }),
      }),

    correctTransaction: (
      id: string,
      body: {
        categorySlug?: string | null;
        providerId?: string | null;
        payee?: string | null;
        merchant?: string;
        applyFuture?: boolean;
      },
    ) =>
      requestJson<{ transaction: unknown; reclassified: number }>(
        `/api/imports/transactions/${id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      ),

    loadDemoData: () =>
      requestJson<{ created: number; month: string }>("/api/demo/load", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      }),

    listLockedStatements: () =>
      requestJson<{ statements: Array<{ id: string; filename: string | null; foundAt: string }> }>(
        "/api/mail/locked-statements"),

    unlockStatement: (id: string, password: string) =>
      requestJson<{ inserted: number; verified: number }>(
        `/api/mail/locked-statements/${encodeURIComponent(id)}/unlock`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ password }),
        },
      ),

    exportTransactionsCsv: () => requestBlob("/api/imports/export"),

    removeDemoData: () =>
      requestJson<{ removed: number }>("/api/demo", { method: "DELETE" }),
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;
