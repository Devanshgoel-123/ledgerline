import { AsyncLocalStorage } from "node:async_hooks";
import { config } from "../config.js";
import { logger } from "../logger/index.js";
import { MemoryStore } from "./memory.js";
import { PostgresStore } from "./postgres.js";
import type { Store } from "./types.js";

let store: Store | null = null;
const transactionStore = new AsyncLocalStorage<Store>();

export async function getStore(): Promise<Store> {
  const inTransaction = transactionStore.getStore();
  if (inTransaction) return inTransaction;
  if (store) return store;

  // backend/.env usually points at the real database. A test run must never open it:
  // opening the store runs pending migrations, and tests write data.
  if (
    process.env.NODE_ENV === "test" &&
    !config.useMemoryStore &&
    config.databaseUrl !== process.env.TEST_DATABASE_URL
  ) {
    throw new Error(
      "Tests may only use DATABASE_URL=memory or the database in TEST_DATABASE_URL, never the one in .env.",
    );
  }

  if (config.useMemoryStore) {
    store = new MemoryStore();
    await store.migrate();
    logger.warn(
      "Using in-memory store — data is ephemeral. Set DATABASE_URL to a Postgres connection string for persistence.",
    );
  } else {
    store = new PostgresStore(config.databaseUrl);
    await store.migrate();
    logger.info("Connected to Postgres and applied migrations");
  }

  return store;
}

export function resetStoreForTests(next: Store): void {
  store = next;
}

export async function closeStore(): Promise<void> {
  if (!store) return;
  await store.close();
  store = null;
}

/** Every getStore() call inside `fn` shares one transaction; a throw rolls all of it back. */
export async function withStoreTransaction<T>(fn: () => Promise<T>): Promise<T> {
  const base = await getStore();
  return base.inTransaction((tx) => transactionStore.run(tx, fn));
}
