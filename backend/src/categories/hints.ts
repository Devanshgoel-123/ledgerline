import type { Request } from "express";
import { getStore } from "../db/index.js";
import { PostgresStore } from "../db/postgres.js";
import { AppError } from "../errors/AppError.js";

export interface UpiCategoryHint {
  id: string;
  userId: string;
  upiId: string;
  categorySlug: string;
  usageCount: number;
  lastUsedAt: Date;
}

/** Hints live only in Postgres; the in-memory store has no table for them. */
async function hintsDb(): Promise<PostgresStore> {
  const store = await getStore();
  if (!(store instanceof PostgresStore)) {
    throw new AppError("UPI category hints need Postgres", {
      statusCode: 503,
      code: "SERVICE_UNAVAILABLE",
    });
  }
  return store;
}

export async function getUpiCategoryHint(
  req: Request,
  upiId: string,
): Promise<UpiCategoryHint | null> {
  const db = await hintsDb();
  const result = await db.query(
    `SELECT id, user_id, upi_id, category_slug, usage_count, last_used_at
     FROM upi_category_hints
     WHERE user_id = $1 AND upi_id = $2
     LIMIT 1`,
    [req.user!.id, upiId],
  );
  if (result.rows.length === 0) return null;
  const row = result.rows[0]!;
  return {
    id: row.id,
    userId: row.user_id,
    upiId: row.upi_id,
    categorySlug: row.category_slug,
    usageCount: row.usage_count,
    lastUsedAt: row.last_used_at,
  };
}

export async function saveUpiCategoryHint(
  req: Request,
  upiId: string,
  categorySlug: string,
): Promise<void> {
  const db = await hintsDb();
  await db.query(
    `INSERT INTO upi_category_hints (user_id, upi_id, category_slug, usage_count, last_used_at)
     VALUES ($1, $2, $3, 1, NOW())
     ON CONFLICT (user_id, upi_id) DO UPDATE SET
       category_slug = EXCLUDED.category_slug,
       usage_count = upi_category_hints.usage_count + 1,
       last_used_at = NOW(),
       updated_at = NOW()`,
    [req.user!.id, upiId, categorySlug],
  );
}

export async function listUpiCategoryHints(
  req: Request,
): Promise<UpiCategoryHint[]> {
  const db = await hintsDb();
  const result = await db.query(
    `SELECT id, user_id, upi_id, category_slug, usage_count, last_used_at
     FROM upi_category_hints
     WHERE user_id = $1
     ORDER BY last_used_at DESC
     LIMIT 100`,
    [req.user!.id],
  );
  return result.rows.map((row) => ({
    id: row.id,
    userId: row.user_id,
    upiId: row.upi_id,
    categorySlug: row.category_slug,
    usageCount: row.usage_count,
    lastUsedAt: row.last_used_at,
  }));
}

export async function deleteUpiCategoryHint(
  req: Request,
  upiId: string,
): Promise<void> {
  const db = await hintsDb();
  await db.query(
    `DELETE FROM upi_category_hints WHERE user_id = $1 AND upi_id = $2`,
    [req.user!.id, upiId],
  );
}
