import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/** False during server render, true in the browser. Use before portals to document.body. */
export function useIsClient(): boolean {
  return useSyncExternalStore(subscribe, () => true, () => false);
}
