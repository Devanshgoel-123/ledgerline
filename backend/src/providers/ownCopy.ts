import { getStore } from "../db/index.js";
import type { ProviderRow } from "../db/types.js";

/**
 * Shared apps are the same for every user. A user's change goes on their own
 * copy, and their transactions and rules move to that copy.
 */
export async function ownProviderFor(userId: string, provider: ProviderRow): Promise<ProviderRow> {
  if (!provider.isGlobal) return provider;
  const store = await getStore();
  const name = provider.canonicalName.toLowerCase();
  const existing = (await store.listProviders(userId)).find(
    (item) => !item.isGlobal && item.canonicalName.toLowerCase() === name,
  );
  const { id: _sharedId, ...shared } = provider;
  const own = existing ?? (await store.upsertProvider({ ...shared, userId, isGlobal: false }));
  await store.moveProviderRefs(userId, provider.id, own.id);
  return own;
}
