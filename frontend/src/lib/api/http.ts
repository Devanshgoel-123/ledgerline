import { appConfig } from "../config";

export const API_BASE = appConfig.apiBaseUrl;

/** Sent on every call. The local API refuses requests without it, so other sites cannot use it. */
const CLIENT_HEADERS = { "X-Ledgerline-Client": "web" } as const;

/** Shown when the request never reached the server (offline, DNS, server down). */
export const NETWORK_ERROR_MESSAGE =
  "Could not reach the Ledgerline API on this computer. Make sure Ledgerline is running (./ledgerline status), then try again.";

/** Parse API error JSON into a user-facing message. */
export async function parseError(res: Response): Promise<string> {
  try {
    const data = await res.json();
    const details = data?.error?.details;
    if (Array.isArray(details) && details.length > 0) {
      const first = details[0];
      if (typeof first?.message === "string") {
        // Our own messages are full sentences; only bare library defaults need the field name.
        const generic = /^(required|invalid|expected|string must|number must)/i.test(first.message);
        return generic && first.path ? `${first.path}: ${first.message}` : first.message;
      }
    }
    if (typeof data?.error?.message === "string") return data.error.message;
    if (typeof data?.detail === "string") return data.detail;
  } catch {
    // ignore malformed JSON
  }
  return "Request failed";
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) throw new Error(await parseError(res));
  return (await res.json()) as T;
}

/** JSON request to the local API. */
export async function requestJson<T>(path: string, options: RequestInit = {}): Promise<T> {
  const { headers, ...init } = options;
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      cache: "no-store",
      ...init,
      headers: {
        ...headers,
        ...CLIENT_HEADERS,
      },
    });
    return handleResponse<T>(res);
  } catch (error) {
    // fetch rejects with a TypeError ("Failed to fetch", "Load failed") when the network is down.
    if (error instanceof TypeError) throw new Error(NETWORK_ERROR_MESSAGE);
    if (error instanceof Error) throw error;
    throw new Error(NETWORK_ERROR_MESSAGE);
  }
}

/** Request to the local API that returns no body. */
export async function requestVoid(path: string, options: RequestInit = {}): Promise<void> {
  const { headers, ...init } = options;
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: {
        ...headers,
        ...CLIENT_HEADERS,
      },
    });
    if (!res.ok) throw new Error(await parseError(res));
  } catch (error) {
    // fetch rejects with a TypeError ("Failed to fetch", "Load failed") when the network is down.
    if (error instanceof TypeError) throw new Error(NETWORK_ERROR_MESSAGE);
    if (error instanceof Error) throw error;
    throw new Error(NETWORK_ERROR_MESSAGE);
  }
}

/** File download from the local API. Same network handling as requestJson. */
export async function requestBlob(path: string): Promise<Blob> {
  try {
    const res = await fetch(`${API_BASE}${path}`, { cache: "no-store", headers: CLIENT_HEADERS });
    if (!res.ok) throw new Error(await parseError(res));
    return await res.blob();
  } catch (error) {
    if (error instanceof TypeError) throw new Error(NETWORK_ERROR_MESSAGE);
    throw error;
  }
}
