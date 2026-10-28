// Builds src/core/catalog.generated.json: the built-in categories and shops.
// The app has no server to ask, so it ships the same reference data the
// backend migrations create. This replays every backend migration in an
// in-memory Postgres (PGlite) and reads the result, so nothing is copied by hand.
//
//   npm run catalog
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const migrations = join(here, "../../backend/src/db/migrations");
const out = join(here, "../src/core/catalog.generated.json");

const db = new PGlite({ extensions: { pgcrypto } });
const files = readdirSync(migrations)
  .filter((name) => /^\d+_.*\.up\.sql$/.test(name))
  .sort();
for (const name of files) {
  await db.exec(readFileSync(join(migrations, name), "utf8"));
}

const categories = await db.query(
  `SELECT slug, label, blurb, sort_order AS "sortOrder", meta->>'parent' AS parent
     FROM categories WHERE is_global ORDER BY sort_order, label`,
);
const providers = await db.query(
  `SELECT canonical_name AS "canonicalName", aliases, upi_handles AS "upiHandles",
          category_slug AS "categorySlug"
     FROM providers WHERE is_global ORDER BY canonical_name`,
);

const catalog = {
  categories: categories.rows,
  providers: providers.rows.map((row) => ({
    id: `catalog:${row.canonicalName.toLowerCase()}`,
    ...row,
  })),
};
writeFileSync(out, `${JSON.stringify(catalog, null, 1)}\n`);
console.log(
  `${files.length} migrations → ${catalog.categories.length} categories, ${catalog.providers.length} shops`,
);
