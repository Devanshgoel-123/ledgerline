"use client";

import { createApiClient, type ApiClient } from "@/lib/api/client";

const api = createApiClient();

/** Client for the Ledgerline API on this computer. */
export function useApi(): ApiClient {
  return api;
}
