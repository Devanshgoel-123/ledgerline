import type { ProviderRow } from "./types.js";

/** A user's own copy of a shared app replaces the shared one in their list. */
export function withoutShadowedGlobals(providers: ProviderRow[]): ProviderRow[] {
  const owned = new Set(
    providers.filter((p) => !p.isGlobal).map((p) => p.canonicalName.toLowerCase()),
  );
  return providers.filter((p) => !p.isGlobal || !owned.has(p.canonicalName.toLowerCase()));
}
