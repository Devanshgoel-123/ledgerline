export { createApiClient, type ApiClient } from "./client";
export type {
  AccountSummary,
  AuthUser,
  BankPreset,
  GmailStatus,
  ImportStatus,
  ParseStatementResult,
} from "./types";

import { API_BASE, NETWORK_ERROR_MESSAGE, parseError } from "./http";

/** Google OAuth login redirect URL (unauthenticated). */
export function googleLoginUrl(): string {
  return `${API_BASE}/api/auth/google`;
}

export type PasswordAuthMode = "login" | "register";

/**
 * Email and password sign-in or sign-up. Returns a session token.
 * Uses fetch directly: a wrong password is a 401 here, not an expired session.
 */
export async function passwordAuth(
  mode: PasswordAuthMode,
  body: { email: string; password: string; displayName?: string },
): Promise<string> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}/api/auth/${mode}`, {
      method: "POST",
      cache: "no-store",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error(NETWORK_ERROR_MESSAGE);
  }
  if (!res.ok) {
    if (res.status === 401) throw new Error("Incorrect email or password.");
    if (res.status === 429) throw new Error("Too many attempts. Wait a minute and try again.");
    throw new Error(await parseError(res));
  }
  const data = (await res.json()) as { token: string };
  return data.token;
}

async function postPublic(path: string, body: unknown): Promise<Response> {
  try {
    return await fetch(`${API_BASE}${path}`, {
      method: "POST",
      cache: "no-store",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error(NETWORK_ERROR_MESSAGE);
  }
}

/** Ask for a reset link. The answer is the same whether or not the account exists. */
export async function requestPasswordReset(email: string): Promise<void> {
  const res = await postPublic("/api/auth/forgot", { email });
  if (res.status === 429) throw new Error("Too many attempts. Wait a minute and try again.");
  if (!res.ok) throw new Error(await parseError(res));
}

/** Set a new password from a reset link. Returns a session token. */
export async function resetPassword(token: string, password: string): Promise<string> {
  const res = await postPublic("/api/auth/reset", { token, password });
  if (!res.ok) throw new Error(await parseError(res));
  return ((await res.json()) as { token: string }).token;
}
