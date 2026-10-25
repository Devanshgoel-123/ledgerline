import { BACKFILL_DEFAULT_MAX_MESSAGES } from "../constants/index.js";
import { encryptSecret } from "../crypto/secrets.js";
import { getStore } from "../db/index.js";
import type { AccountRow, MailConnectionRow } from "../db/types.js";
import { PoolingRunTrigger } from "../enums/index.js";
import { AppError } from "../errors/AppError.js";
import { mailLog } from "../logger/mail.js";
import type {
  ConnectMailBody,
  EnablePoolingBody,
  MailScanBody,
} from "../validators/mail.js";
import { nextScanWindow, poolingScanWindow, toIstCalendarDate } from "../helpers/index.js";
import { sendersForBank } from "../helpers/mailSenders.js";
import { verifyMailLogin } from "./mailbox.js";
import { mailServerFor } from "./providers.js";
import {
  failStaleRunningRuns,
  runPoolingSync,
  type PoolingSyncResult,
} from "./poolingService.js";

/**
 * Start a query scan and return its run id. The scan keeps running after
 * this resolves; each batch of successful imports is written as it lands.
 */
async function beginPoolingSync(
  input: Parameters<typeof runPoolingSync>[0],
  onDone: (sync: PoolingSyncResult) => Promise<void>,
): Promise<string> {
  let resolveStarted!: (runId: string) => void;
  let rejectStarted!: (error: unknown) => void;
  let announced = false;
  const started = new Promise<string>((resolve, reject) => {
    resolveStarted = resolve;
    rejectStarted = reject;
  });

  const done = runPoolingSync({
    ...input,
    onStarted(runId) {
      announced = true;
      resolveStarted(runId);
    },
  });

  void done.then(
    async (sync) => {
      try {
        if (!sync.superseded) await onDone(sync);
      } catch (error) {
        mailLog.syncFailed(input.userId, error);
      }
    },
    (error: unknown) => {
      if (!announced) rejectStarted(error);
      else mailLog.syncFailed(input.userId, error);
    },
  );

  return started;
}

/** Resolve the user's bank account configured for mail scanning. */
export async function resolveAccountForPooling(
  userId: string,
  accountId?: string,
): Promise<AccountRow> {
  const store = await getStore();
  const accounts = await store.listAccounts(userId);
  const account =
    (accountId
      ? accounts.find((candidate) => candidate.id === accountId)
      : accounts.find((candidate) => candidate.poolingEnabled) ?? accounts[0]) ??
    null;
  if (!account) {
    throw AppError.badRequest(
      "Select a bank and statement sender emails before enabling pooling.",
    );
  }
  if (account.statementSenderEmails.length === 0) {
    throw AppError.badRequest(
      "Add at least one bank statement sender email/domain. Only bank mail is searched.",
    );
  }
  return account;
}

/** What the app needs to show the mailbox and know whether a scan is still running. */
export async function getMailStatusForUser(userId: string) {
  await failStaleRunningRuns(userId);
  const store = await getStore();
  const connection = await store.getMailConnection(userId);
  const accounts = await store.listAccounts(userId);
  const primary = accounts.find((account) => account.poolingEnabled) ?? accounts[0] ?? null;
  const latestRun = await store.getLatestPoolingRun(userId);

  return {
    connected: Boolean(connection?.passwordEncrypted),
    /** A mailbox is saved but its app password has to be entered (again). */
    needsPassword: Boolean(connection && !connection.passwordEncrypted),
    email: connection?.email ?? null,
    provider: connection?.provider ?? null,
    host: connection?.host ?? null,
    port: connection?.port ?? null,
    scanWindow: poolingScanWindow(),
    lastScannedOn: connection?.lastScannedOn ?? null,
    lastSyncAt: connection?.lastSyncAt ?? null,
    poolingEnabled: primary?.poolingEnabled ?? false,
    latestRun: latestRun
      ? {
          status: latestRun.status,
          imported: latestRun.imported,
          scanned: latestRun.scanned,
          skipped: latestRun.skipped,
          errorMessage: latestRun.errorMessage,
        }
      : null,
  };
}

/**
 * Check the app password with the mail server, then save it encrypted. Scan progress
 * carries over when the same mailbox is connected again.
 */
export async function connectMailboxForUser(userId: string, body: ConnectMailBody) {
  const server = mailServerFor(body.provider, { host: body.host, port: body.port });
  if (!server) throw AppError.badRequest("Enter your mail server's IMAP address.");
  const email = body.email.trim().toLowerCase();
  // App passwords are often shown in groups of four ("abcd efgh ..."); the spaces are not part of it.
  const password = body.provider === "custom" ? body.password : body.password.replace(/\s+/g, "");
  await verifyMailLogin({ host: server.host, port: server.port, user: email, pass: password });

  const store = await getStore();
  const existing = await store.getMailConnection(userId);
  const sameMailbox = existing?.email === email && existing.host === server.host;
  const connection: Omit<MailConnectionRow, "id"> = {
    userId,
    email,
    provider: body.provider,
    host: server.host,
    port: server.port,
    passwordEncrypted: encryptSecret(password),
    lastSyncAt: sameMailbox ? existing.lastSyncAt : null,
    lastScannedOn: sameMailbox ? existing.lastScannedOn : null,
    disconnectedAt: null,
  };
  await store.upsertMailConnection(connection);
  await store.audit(userId, "mail.connected", { provider: body.provider, host: server.host });
  return getMailStatusForUser(userId);
}

/** Forget the mailbox and its password, and stop scanning. */
export async function disconnectMailForUser(userId: string) {
  const store = await getStore();
  const accounts = await store.listAccounts(userId);
  for (const account of accounts) {
    if (account.poolingEnabled) {
      await store.setPoolingEnabled(userId, account.id, false);
    }
  }
  await store.disconnectMail(userId);
  await store.audit(userId, "mail.disconnected", {});
  return { ok: true };
}

async function requireScannableMailbox(userId: string): Promise<MailConnectionRow> {
  const store = await getStore();
  const connection = await store.getMailConnection(userId);
  if (!connection) {
    throw AppError.badRequest("Connect your mailbox first.");
  }
  if (!connection.passwordEncrypted) {
    throw AppError.badRequest("Enter your mailbox app password again to keep scanning bank mail.");
  }
  return connection;
}

/** Scan bank mail for alert payments and statement PDFs, for one month or from where the last scan stopped. */
export async function scanMailForUser(userId: string, body: MailScanBody) {
  const store = await getStore();
  const connection = await requireScannableMailbox(userId);
  const account = await resolveAccountForPooling(userId);
  const month = body.month;
  const runId = await beginPoolingSync(
    {
      userId,
      connection,
      account,
      password: body.password ?? "",
      maxMessages: body.maxMessages ?? BACKFILL_DEFAULT_MAX_MESSAGES,
      month,
      trigger: PoolingRunTrigger.Backfill,
    },
    async (sync) => {
      await store.audit(userId, "mail.scan", {
        month: month ?? "from-cutoff",
        statements: sync.statements,
        alerts: sync.alerts,
      });
    },
  );
  return { status: "running" as const, runId };
}

const MAX_POOLING_BANKS = 2;

/** Create or refresh up to two bank accounts and turn pooling on for those only. */
async function preparePoolingBanks(
  userId: string,
  bankIds: string[],
): Promise<AccountRow[]> {
  const store = await getStore();
  const selected = [
    ...new Set(bankIds.map((id) => id.trim().toUpperCase()).filter(Boolean)),
  ].slice(0, MAX_POOLING_BANKS);
  if (selected.length === 0) {
    throw AppError.badRequest("Select a bank first.");
  }
  const existing = await store.listAccounts(userId);
  for (const account of existing) {
    if (
      account.poolingEnabled &&
      !selected.includes(account.bank.toUpperCase())
    ) {
      await store.setPoolingEnabled(userId, account.id, false);
    }
  }
  const ready: AccountRow[] = [];
  for (const bank of selected) {
    const preset = await store.getBankPreset(bank);
    if (!preset) throw AppError.badRequest(`Unknown bank: ${bank}`);
    const created = await store.getOrCreateAccount(userId, bank);
    const updated =
      (await store.updateAccountMailSources(userId, created.id, {
        bank,
        label: preset.label,
        statementSenderEmails: preset.defaultSenderEmails,
      })) ?? created;
    const enabled = await store.setPoolingEnabled(userId, updated.id, true);
    ready.push(enabled ?? updated);
  }
  return ready;
}

function sendersForAccounts(accounts: AccountRow[]): string[] {
  const [first, ...rest] = accounts;
  if (!first) return [];
  return sendersForBank(
    first.bank,
    rest.flatMap((account) =>
      sendersForBank(account.bank, account.statementSenderEmails),
    ),
  );
}

/** Turn on scheduled scans for the chosen banks and run the first alert + PDF scan. */
export async function enablePoolingForUser(
  userId: string,
  body: EnablePoolingBody,
) {
  const store = await getStore();
  const connection = await requireScannableMailbox(userId);
  const selected = body.banks?.length
    ? await preparePoolingBanks(userId, body.banks)
    : null;
  const account = selected?.[0] ?? (await resolveAccountForPooling(userId, body.accountId));
  const updated = selected?.[0] ?? (await store.setPoolingEnabled(userId, account.id, true));
  const senders = selected ? sendersForAccounts(selected) : undefined;
  const scan = poolingScanWindow();
  const oldest = toIstCalendarDate(await store.oldestMailReceivedAt(userId));
  const historyOpen = !oldest || oldest > scan.from;
  // Already caught up: re-check this month. Older mail still missing: walk back.
  // Mail already stored is skipped by fingerprint.
  const month =
    body.month ??
    (historyOpen
      ? undefined
      : nextScanWindow(connection.lastScannedOn).covered
        ? scan.to.slice(0, 7)
        : undefined);
  mailLog.enabled(userId, month ?? "from-cutoff");
  const runId = await beginPoolingSync(
    {
      userId,
      connection,
      account: updated ?? account,
      password: body.password ?? "",
      maxMessages: body.maxMessages ?? BACKFILL_DEFAULT_MAX_MESSAGES,
      month,
      trigger: PoolingRunTrigger.Enable,
      senders,
    },
    async (sync) => {
      await store.audit(userId, "mail.scans_enabled", {
        accountId: account.id,
        bank: account.bank,
        month: month ?? "from-cutoff",
        statements: sync.statements,
        alerts: sync.alerts,
      });
    },
  );
  return { account: updated, status: "running" as const, runId };
}

export async function disablePoolingForUser(userId: string) {
  const store = await getStore();
  const accounts = await store.listAccounts(userId);
  const updated = [];
  for (const account of accounts) {
    if (account.poolingEnabled) {
      updated.push(await store.setPoolingEnabled(userId, account.id, false));
    }
  }
  await store.audit(userId, "mail.scans_disabled", {});
  return { ok: true, accounts: updated };
}

/** "Scan now": re-read this month's bank mail. Mail already stored is skipped. */
export async function scanMailNowForUser(userId: string) {
  const account = await resolveAccountForPooling(userId);
  if (!account.poolingEnabled) {
    throw AppError.badRequest("Choose your bank and start scanning first.");
  }
  return scanMailForUser(userId, {
    month: poolingScanWindow().to.slice(0, 7),
    password: "",
    maxMessages: BACKFILL_DEFAULT_MAX_MESSAGES,
  });
}
