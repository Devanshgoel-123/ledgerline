import { getStore } from "../db/index.js";
import { buildDemoTransactions, DEMO_FINGERPRINT_PREFIX } from "./sample.js";

export { buildDemoTransactions, demoMonth, DEMO_FINGERPRINT_PREFIX } from "./sample.js";

/** Adds a month of clearly-labelled sample transactions. Loading twice adds nothing new. */
export async function loadDemoData(userId: string): Promise<{ created: number; month: string }> {
  const store = await getStore();
  const { month, rows } = buildDemoTransactions();
  const result = await store.insertTransactions(userId, rows);
  await store.audit(userId, "demo.loaded", { created: result.inserted, month });
  return { created: result.inserted, month };
}

/** Removes every sample transaction and leaves real data alone. */
export async function removeDemoData(userId: string): Promise<{ removed: number }> {
  const store = await getStore();
  const removed = await store.deleteTransactionsByFingerprintPrefix(userId, DEMO_FINGERPRINT_PREFIX);
  await store.audit(userId, "demo.removed", { removed });
  return { removed };
}
