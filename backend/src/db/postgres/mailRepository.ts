import { and, asc, desc, eq, gte, isNull, lte, sql } from "drizzle-orm";
import type { AppDb } from "../client.js";
import {
  accounts,
  mailConnections,
  mailMessages,
  poolingRuns,
} from "../schema.js";
import type {
  AccountRow,
  MailConnectionRow,
  MailMessageRow,
  PoolingRunRow,
  PoolingRunStatus,
} from "../types.js";
import {
  mapAccount,
  mapMailConnection,
  mapMailMessage,
  mapPoolingRun,
} from "./shared.js";

const date = (value: string | null) => (value ? new Date(value) : null);

export class PostgresMailRepository {
  constructor(private readonly db: AppDb) {}

  async upsertMailConnection(
    input: Omit<MailConnectionRow, "id"> & { id?: string },
  ): Promise<MailConnectionRow> {
    const values = {
      email: input.email,
      provider: input.provider,
      host: input.host,
      port: input.port,
      passwordEncrypted: input.passwordEncrypted,
      lastSyncAt: date(input.lastSyncAt),
      lastScannedOn: input.lastScannedOn,
      disconnectedAt: null,
    };
    const [row] = await this.db
      .insert(mailConnections)
      .values({ ...(input.id ? { id: input.id } : {}), userId: input.userId, ...values })
      .onConflictDoUpdate({ target: mailConnections.userId, set: values })
      .returning();
    return mapMailConnection(row);
  }
  async getMailConnection(userId: string): Promise<MailConnectionRow | null> {
    const [row] = await this.db
      .select()
      .from(mailConnections)
      .where(
        and(
          eq(mailConnections.userId, userId),
          isNull(mailConnections.disconnectedAt),
        ),
      )
      .limit(1);
    return row ? mapMailConnection(row) : null;
  }
  /** Forget the mailbox, and its password with it. */
  async disconnectMail(userId: string): Promise<void> {
    await this.db
      .update(mailConnections)
      .set({ disconnectedAt: new Date(), passwordEncrypted: null })
      .where(eq(mailConnections.userId, userId));
  }
  async listActiveMailConnections(): Promise<MailConnectionRow[]> {
    return (
      await this.db
        .select()
        .from(mailConnections)
        .where(isNull(mailConnections.disconnectedAt))
    ).map(mapMailConnection);
  }
  async listPoolingAccounts(): Promise<AccountRow[]> {
    return (
      await this.db
        .select()
        .from(accounts)
        .where(eq(accounts.poolingEnabled, true))
    ).map(mapAccount);
  }
  async upsertMailMessage(
    input: Omit<MailMessageRow, "id" | "createdAt"> & { id?: string },
  ): Promise<MailMessageRow> {
    const [row] = await this.db
      .insert(mailMessages)
      .values({
        ...(input.id ? { id: input.id } : {}),
        userId: input.userId,
        accountId: input.accountId,
        mailMessageId: input.mailMessageId,
        fromAddress: input.fromAddress,
        subject: input.subject,
        receivedAt: date(input.receivedAt),
        amount: input.amount == null ? null : String(input.amount),
        txType: input.txType,
        currency: input.currency,
        fingerprint: input.fingerprint,
      })
      .onConflictDoUpdate({
        target: [mailMessages.userId, mailMessages.mailMessageId],
        set: {
          fromAddress: input.fromAddress,
          subject: input.subject,
          receivedAt: sql`COALESCE(excluded.received_at, ${mailMessages.receivedAt})`,
          amount: sql`COALESCE(excluded.amount, ${mailMessages.amount})`,
          txType: sql`COALESCE(excluded.tx_type, ${mailMessages.txType})`,
          currency: input.currency,
          fingerprint: input.fingerprint,
        },
      })
      .returning();
    return mapMailMessage(row);
  }
  async findMailMessageById(
    userId: string,
    mailMessageId: string,
  ): Promise<MailMessageRow | null> {
    const [row] = await this.db
      .select()
      .from(mailMessages)
      .where(
        and(
          eq(mailMessages.userId, userId),
          eq(mailMessages.mailMessageId, mailMessageId),
        ),
      )
      .limit(1);
    return row ? mapMailMessage(row) : null;
  }
  async listMailMessages(
    userId: string,
    fromIso: string,
    toIso: string,
  ): Promise<MailMessageRow[]> {
    const rows = await this.db
      .select()
      .from(mailMessages)
      .where(
        and(
          eq(mailMessages.userId, userId),
          gte(mailMessages.receivedAt, new Date(`${fromIso}T00:00:00+05:30`)),
          lte(mailMessages.receivedAt, new Date(`${toIso}T23:59:59+05:30`)),
        ),
      );
    return rows.map(mapMailMessage);
  }
  async oldestMailReceivedAt(userId: string): Promise<string | null> {
    const [row] = await this.db
      .select({ receivedAt: mailMessages.receivedAt })
      .from(mailMessages)
      .where(eq(mailMessages.userId, userId))
      .orderBy(asc(mailMessages.receivedAt))
      .limit(1);
    if (!row?.receivedAt) return null;
    return row.receivedAt instanceof Date
      ? row.receivedAt.toISOString()
      : String(row.receivedAt);
  }
  async createPoolingRun(
    input: Omit<PoolingRunRow, "id" | "startedAt" | "finishedAt" | "status"> & {
      id?: string;
      status?: PoolingRunStatus;
    },
  ): Promise<PoolingRunRow> {
    const [row] = await this.db
      .insert(poolingRuns)
      .values({
        ...(input.id ? { id: input.id } : {}),
        userId: input.userId,
        accountId: input.accountId,
        trigger: input.trigger,
        status: input.status ?? "running",
        mode: input.mode,
        month: input.month,
        scanned: input.scanned,
        imported: input.imported,
        skipped: input.skipped,
        errorMessage: input.errorMessage,
        meta: input.meta ?? {},
      })
      .returning();
    return mapPoolingRun(row);
  }
  async updatePoolingRun(
    id: string,
    patch: Partial<
      Pick<
        PoolingRunRow,
        | "status"
        | "scanned"
        | "imported"
        | "skipped"
        | "errorMessage"
        | "finishedAt"
        | "meta"
      >
    >,
  ): Promise<PoolingRunRow | null> {
    const set: Partial<typeof poolingRuns.$inferInsert> = {};
    for (const key of [
      "status",
      "scanned",
      "imported",
      "skipped",
      "errorMessage",
      "meta",
    ] as const)
      if (patch[key] != null)
        (set as Record<string, unknown>)[key] = patch[key];
    if (patch.finishedAt != null) set.finishedAt = new Date(patch.finishedAt);
    if (!Object.keys(set).length) {
      const [current] = await this.db
        .select()
        .from(poolingRuns)
        .where(eq(poolingRuns.id, id))
        .limit(1);
      return current ? mapPoolingRun(current) : null;
    }
    const [row] = await this.db
      .update(poolingRuns)
      .set(set)
      .where(eq(poolingRuns.id, id))
      .returning();
    return row ? mapPoolingRun(row) : null;
  }
  async getLatestPoolingRun(userId: string): Promise<PoolingRunRow | null> {
    const [row] = await this.db
      .select()
      .from(poolingRuns)
      .where(eq(poolingRuns.userId, userId))
      .orderBy(desc(poolingRuns.startedAt))
      .limit(1);
    return row ? mapPoolingRun(row) : null;
  }
  async listPoolingRuns(userId: string, limit = 10): Promise<PoolingRunRow[]> {
    return (
      await this.db
        .select()
        .from(poolingRuns)
        .where(eq(poolingRuns.userId, userId))
        .orderBy(desc(poolingRuns.startedAt))
        .limit(limit)
    ).map(mapPoolingRun);
  }
  async hasRunningPoolingRun(userId: string): Promise<boolean> {
    const rows = await this.db
      .select({ id: poolingRuns.id })
      .from(poolingRuns)
      .where(
        and(eq(poolingRuns.userId, userId), eq(poolingRuns.status, "running")),
      )
      .limit(1);
    return rows.length > 0;
  }
}
