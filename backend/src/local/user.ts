import type { NextFunction, Request, Response } from "express";
import { getStore } from "../db/index.js";

export interface LocalUser {
  id: string;
  email: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: LocalUser;
    }
  }
}

/** Placeholder address for the one person using this install; it never leaves the machine. */
export const LOCAL_USER_EMAIL = "you@ledgerline.local";

let cached: LocalUser | null = null;

/**
 * Ledgerline runs for one person on their own machine, so there is no sign-in.
 * Data written before accounts were removed stays with the oldest account.
 */
export async function getLocalUser(): Promise<LocalUser> {
  if (cached) return cached;
  const store = await getStore();
  const user = (await store.findFirstUser()) ?? (await store.createUser({ email: LOCAL_USER_EMAIL }));
  cached = { id: user.id, email: user.email };
  return cached;
}

/** Call after the local data is deleted; the next request starts a fresh profile. */
export function forgetLocalUser(): void {
  cached = null;
}

export async function requireLocalUser(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    req.user = await getLocalUser();
    next();
  } catch (error) {
    next(error);
  }
}

/** Tests act as a chosen profile so one store can hold several. */
export function setLocalUserForTests(user: LocalUser): void {
  cached = user;
}
