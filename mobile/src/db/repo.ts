import type { Category } from "@/core/catalog";
import type { Entry, Origin, PaymentMethod, Rule, SplitShare, TxType } from "@/core/model";
import { assertSharesFit, normalizeFriends } from "@/core/shared";
import type { Db, SqlValue } from "./schema";

export function newId(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

const now = () => new Date().toISOString();

type EntryRecord = {
  id: string;
  date: string;
  amount: number;
  type: TxType;
  description: string;
  merchant: string | null;
  payee: string | null;
  upi_id: string | null;
  provider_id: string | null;
  category_slug: string | null;
  classification_source: string;
  method: PaymentMethod;
  origin: Origin;
  statement_ref: string | null;
  note: string | null;
  message_ref: string | null;
  needs_review: number;
  created_at: string;
  updated_at: string;
};

type SplitRecord = { entry_id: string; name: string; amount: number; settled_at: string | null };

function toEntry(row: EntryRecord, splits: SplitShare[]): Entry {
  return {
    id: row.id,
    date: row.date,
    amount: row.amount,
    type: row.type,
    description: row.description,
    merchant: row.merchant,
    payee: row.payee,
    upiId: row.upi_id,
    providerId: row.provider_id,
    categorySlug: row.category_slug,
    classificationSource: row.classification_source,
    method: row.method,
    origin: row.origin,
    statementRef: row.statement_ref,
    note: row.note,
    messageRef: row.message_ref ?? null,
    needsReview: Boolean(row.needs_review),
    splits,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Every entry, newest first. */
export async function listEntries(db: Db): Promise<Entry[]> {
  const rows = await db.getAllAsync<EntryRecord>(
    "SELECT * FROM entries ORDER BY date DESC, created_at DESC",
  );
  const splits = await db.getAllAsync<SplitRecord>("SELECT * FROM splits ORDER BY rowid");
  const byEntry = new Map<string, SplitShare[]>();
  for (const split of splits) {
    const list = byEntry.get(split.entry_id) ?? [];
    list.push({ name: split.name, amount: split.amount, settledAt: split.settled_at });
    byEntry.set(split.entry_id, list);
  }
  return rows.map((row) => toEntry(row, byEntry.get(row.id) ?? []));
}

export type EntryInput = {
  date: string;
  amount: number;
  type: TxType;
  description: string;
  merchant?: string | null;
  payee?: string | null;
  upiId?: string | null;
  providerId?: string | null;
  categorySlug: string | null;
  classificationSource?: string;
  method: PaymentMethod;
  origin?: Origin;
  statementRef?: string | null;
  note?: string | null;
  messageRef?: string | null;
  needsReview?: boolean;
  splits?: { name: string; amount: number }[];
};

function validate(input: EntryInput): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) throw new Error("Pick a date.");
  if (!Number.isFinite(input.amount) || input.amount <= 0) throw new Error("Add the amount in rupees.");
  if (!input.description.trim() && !input.merchant?.trim()) {
    throw new Error("Add what it was for, for example Chai or Auto.");
  }
}

/** Friend shares, merged and checked against the bill. Throws SplitInputError. */
function cleanSplits(input: EntryInput): { name: string; amount: number }[] {
  if (!input.splits?.length) return [];
  if (input.type !== "debit") throw new Error("Only money you spent can be split.");
  const friends = normalizeFriends(input.splits);
  assertSharesFit(input.amount, friends);
  return friends;
}

async function writeSplits(
  db: Db,
  entryId: string,
  friends: { name: string; amount: number }[],
): Promise<void> {
  // Keep "paid back" for a friend whose share is unchanged.
  const before = await db.getAllAsync<SplitRecord>("SELECT * FROM splits WHERE entry_id = ?", entryId);
  await db.runAsync("DELETE FROM splits WHERE entry_id = ?", entryId);
  for (const friend of friends) {
    const old = before.find((row) => row.name.toLowerCase() === friend.name.toLowerCase());
    const settledAt = old && Math.abs(old.amount - friend.amount) < 0.005 ? old.settled_at : null;
    await db.runAsync(
      "INSERT INTO splits (entry_id, name, amount, settled_at) VALUES (?, ?, ?, ?)",
      entryId,
      friend.name,
      friend.amount,
      settledAt,
    );
  }
}

async function insertRow(db: Db, id: string, input: EntryInput, stamp: string): Promise<void> {
  const values: SqlValue[] = [
    id,
    input.date,
    Math.round(input.amount * 100) / 100,
    input.type,
    input.description.trim(),
    input.merchant?.trim() || null,
    input.payee?.trim() || null,
    input.upiId?.trim().toLowerCase() || null,
    input.providerId ?? null,
    input.categorySlug,
    input.classificationSource ?? "user_override",
    input.method,
    input.origin ?? "manual",
    input.statementRef ?? null,
    input.note?.trim() || null,
    input.messageRef ?? null,
    input.needsReview ? 1 : 0,
    stamp,
    stamp,
  ];
  await db.runAsync(
    `INSERT INTO entries (id, date, amount, type, description, merchant, payee, upi_id, provider_id,
       category_slug, classification_source, method, origin, statement_ref, note, message_ref, needs_review,
       created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ...values,
  );
}

export async function addEntry(db: Db, input: EntryInput): Promise<string> {
  validate(input);
  const friends = cleanSplits(input);
  const id = newId();
  await db.withTransactionAsync(async () => {
    await insertRow(db, id, input, now());
    await writeSplits(db, id, friends);
  });
  return id;
}

/** Many entries at once (statement lines, sample data). Skips none; validates each. */
export async function addEntries(db: Db, inputs: EntryInput[]): Promise<number> {
  inputs.forEach(validate);
  const stamp = now();
  await db.withTransactionAsync(async () => {
    for (const input of inputs) await insertRow(db, newId(), input, stamp);
  });
  return inputs.length;
}

export async function updateEntry(db: Db, id: string, input: EntryInput): Promise<void> {
  validate(input);
  const friends = cleanSplits(input);
  await db.withTransactionAsync(async () => {
    const result = await db.runAsync(
      `UPDATE entries SET date = ?, amount = ?, type = ?, description = ?, merchant = ?, payee = ?,
         upi_id = ?, category_slug = ?, classification_source = ?, method = ?, note = ?, needs_review = 0,
         updated_at = ?
       WHERE id = ?`,
      input.date,
      Math.round(input.amount * 100) / 100,
      input.type,
      input.description.trim(),
      input.merchant?.trim() || null,
      input.payee?.trim() || null,
      input.upiId?.trim().toLowerCase() || null,
      input.categorySlug,
      input.classificationSource ?? "user_override",
      input.method,
      input.note?.trim() || null,
      now(),
      id,
    );
    if (!result.changes) throw new Error("This entry was deleted.");
    await writeSplits(db, id, friends);
  });
}

export async function setCategory(db: Db, ids: string[], categorySlug: string): Promise<void> {
  await db.withTransactionAsync(async () => {
    for (const id of ids) {
      await db.runAsync(
        "UPDATE entries SET category_slug = ?, classification_source = 'user_override', updated_at = ? WHERE id = ?",
        categorySlug,
        now(),
        id,
      );
    }
  });
}

// ── Captured from bank messages ──

/** Mark captured entries as looked at. */
export async function markReviewed(db: Db, ids: string[]): Promise<void> {
  await db.withTransactionAsync(async () => {
    for (const id of ids) await db.runAsync("UPDATE entries SET needs_review = 0 WHERE id = ?", id);
  });
}

/** Link an entry the user already added to the bank message for the same payment. */
export async function linkMessage(db: Db, id: string, messageRef: string): Promise<void> {
  await db.runAsync("UPDATE entries SET message_ref = ? WHERE id = ? AND message_ref IS NULL", messageRef, id);
}

/** Whether a message was seen before: captured into an entry, or dismissed by the user. */
export async function messageSeen(db: Db, messageRef: string): Promise<boolean> {
  const entry = await db.getFirstAsync<{ id: string }>("SELECT id FROM entries WHERE message_ref = ? LIMIT 1", messageRef);
  if (entry) return true;
  const ignored = await db.getFirstAsync<{ line_key: string }>(
    "SELECT line_key FROM statement_ignores WHERE line_key = ?",
    `msg:${messageRef}`,
  );
  return Boolean(ignored);
}

/**
 * The popup's answer for a payment the app already added from the same
 * message, unanswered: set the category, unless you have already reviewed or
 * recategorised the entry yourself. Returns whether it changed anything.
 */
export async function answerCaptured(db: Db, messageRef: string, categorySlug: string): Promise<boolean> {
  const result = await db.runAsync(
    "UPDATE entries SET category_slug = ?, classification_source = 'user_override', needs_review = 0, updated_at = ? WHERE message_ref = ? AND needs_review = 1 AND classification_source != 'user_override'",
    categorySlug,
    now(),
    messageRef,
  );
  return result.changes > 0;
}

/** Delete a captured entry and remember its message, so it isn't captured again. */
export async function dismissCaptured(db: Db, id: string): Promise<void> {
  await db.withTransactionAsync(async () => {
    const row = await db.getFirstAsync<{ message_ref: string | null }>("SELECT message_ref FROM entries WHERE id = ?", id);
    if (row?.message_ref) {
      await db.runAsync(
        "INSERT OR IGNORE INTO statement_ignores (line_key, created_at) VALUES (?, ?)",
        `msg:${row.message_ref}`,
        now(),
      );
    }
    await db.runAsync("DELETE FROM entries WHERE id = ?", id);
  });
}

export async function deleteEntry(db: Db, id: string): Promise<void> {
  await db.runAsync("DELETE FROM entries WHERE id = ?", id);
}

export async function setShareSettled(db: Db, entryId: string, name: string, settled: boolean): Promise<void> {
  await db.runAsync(
    "UPDATE splits SET settled_at = ? WHERE entry_id = ? AND name = ? COLLATE NOCASE",
    settled ? now() : null,
    entryId,
    name,
  );
}

/** Mark everything a friend owes as paid back. */
export async function settleFriend(db: Db, name: string): Promise<void> {
  await db.runAsync(
    "UPDATE splits SET settled_at = ? WHERE name = ? COLLATE NOCASE AND settled_at IS NULL",
    now(),
    name,
  );
}

export async function removeSamples(db: Db): Promise<number> {
  const result = await db.runAsync("DELETE FROM entries WHERE origin = 'sample'");
  return result.changes;
}

// ── Categories ──

export async function listCustomCategories(db: Db): Promise<Category[]> {
  const rows = await db.getAllAsync<{ slug: string; label: string; parent: string | null }>(
    "SELECT slug, label, parent FROM custom_categories ORDER BY created_at",
  );
  return rows.map((row, index) => ({
    slug: row.slug,
    label: row.label,
    blurb: "Your category",
    parent: row.parent,
    sortOrder: 1000 + index,
    custom: true,
  }));
}

export async function addCustomCategory(db: Db, category: { slug: string; label: string; parent: string | null }): Promise<void> {
  const label = category.label.trim();
  if (!label) throw new Error("Give the category a name.");
  if (label.length > 40) throw new Error("Keep the name under 40 letters.");
  await db.runAsync(
    "INSERT INTO custom_categories (slug, label, parent, created_at) VALUES (?, ?, ?, ?)",
    category.slug,
    label,
    category.parent,
    now(),
  );
}

/** Removes a category you made. Its entries move to Other. */
export async function deleteCustomCategory(db: Db, slug: string): Promise<void> {
  await db.withTransactionAsync(async () => {
    await db.runAsync("UPDATE entries SET category_slug = 'other' WHERE category_slug = ?", slug);
    await db.runAsync("UPDATE rules SET set_category_slug = 'other' WHERE set_category_slug = ?", slug);
    await db.runAsync("UPDATE custom_categories SET parent = NULL WHERE parent = ?", slug);
    await db.runAsync("DELETE FROM custom_categories WHERE slug = ?", slug);
  });
}

// ── Rules ──

export async function listRules(db: Db): Promise<Rule[]> {
  const rows = await db.getAllAsync<{
    id: string;
    name: string;
    match_upi_id: string | null;
    match_narration_re: string | null;
    set_category_slug: string | null;
    set_payee_name: string | null;
    created_at: string;
  }>("SELECT * FROM rules ORDER BY created_at DESC");
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    matchUpiId: row.match_upi_id,
    matchNarrationRe: row.match_narration_re,
    setCategorySlug: row.set_category_slug,
    setPayeeName: row.set_payee_name,
    createdAt: row.created_at,
  }));
}

/** Saves a rule, replacing an older one that matches the same thing. */
export async function saveRule(db: Db, rule: Omit<Rule, "id" | "createdAt">): Promise<void> {
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      "DELETE FROM rules WHERE COALESCE(match_upi_id, '') = ? AND COALESCE(match_narration_re, '') = ?",
      rule.matchUpiId ?? "",
      rule.matchNarrationRe ?? "",
    );
    await db.runAsync(
      `INSERT INTO rules (id, name, match_upi_id, match_narration_re, set_category_slug, set_payee_name, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      newId(),
      rule.name,
      rule.matchUpiId,
      rule.matchNarrationRe,
      rule.setCategorySlug,
      rule.setPayeeName,
      now(),
    );
  });
}

export async function deleteRule(db: Db, id: string): Promise<void> {
  await db.runAsync("DELETE FROM rules WHERE id = ?", id);
}

// ── Settings ──

export async function getSetting<T>(db: Db, key: string, fallback: T): Promise<T> {
  const row = await db.getFirstAsync<{ value: string }>("SELECT value FROM settings WHERE key = ?", key);
  if (!row) return fallback;
  try {
    return JSON.parse(row.value) as T;
  } catch {
    return fallback;
  }
}

export async function setSetting(db: Db, key: string, value: unknown): Promise<void> {
  await db.runAsync(
    "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value",
    key,
    JSON.stringify(value),
  );
}

// ── Statement checks ──

export async function listIgnoredLines(db: Db): Promise<Set<string>> {
  const rows = await db.getAllAsync<{ line_key: string }>("SELECT line_key FROM statement_ignores WHERE line_key NOT LIKE 'msg:%'");
  return new Set(rows.map((row) => row.line_key));
}

export async function ignoreLines(db: Db, keys: string[]): Promise<void> {
  await db.withTransactionAsync(async () => {
    for (const key of keys) {
      await db.runAsync(
        "INSERT OR IGNORE INTO statement_ignores (line_key, created_at) VALUES (?, ?)",
        key,
        now(),
      );
    }
  });
}

export async function clearIgnoredLines(db: Db): Promise<void> {
  // Messages you dismissed (msg:…) stay dismissed.
  await db.runAsync("DELETE FROM statement_ignores WHERE line_key NOT LIKE 'msg:%'");
}

export type StatementCheckRecord = {
  id: string;
  bank: string;
  dateFrom: string;
  dateTo: string;
  lineCount: number;
  missingCount: number;
  checkedAt: string;
};

export async function recordStatementCheck(
  db: Db,
  check: Omit<StatementCheckRecord, "id" | "checkedAt">,
): Promise<void> {
  await db.runAsync(
    `INSERT INTO statement_checks (id, bank, date_from, date_to, line_count, missing_count, checked_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    newId(),
    check.bank,
    check.dateFrom,
    check.dateTo,
    check.lineCount,
    check.missingCount,
    now(),
  );
}

export async function lastStatementCheck(db: Db): Promise<StatementCheckRecord | null> {
  const row = await db.getFirstAsync<{
    id: string;
    bank: string;
    date_from: string;
    date_to: string;
    line_count: number;
    missing_count: number;
    checked_at: string;
  }>("SELECT * FROM statement_checks ORDER BY checked_at DESC LIMIT 1");
  return row
    ? {
        id: row.id,
        bank: row.bank,
        dateFrom: row.date_from,
        dateTo: row.date_to,
        lineCount: row.line_count,
        missingCount: row.missing_count,
        checkedAt: row.checked_at,
      }
    : null;
}

/** Deletes every entry, split, category, rule and setting on this phone. */
export async function eraseEverything(db: Db): Promise<void> {
  await db.withTransactionAsync(async () => {
    for (const table of ["splits", "entries", "custom_categories", "rules", "settings", "statement_ignores", "statement_checks"]) {
      await db.runAsync(`DELETE FROM ${table}`);
    }
  });
}
