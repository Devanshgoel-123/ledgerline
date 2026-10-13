import bcrypt from "bcryptjs";
import { createHash, randomBytes } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { config } from "../config.js";
import { SESSION_TTL } from "../constants/index.js";
import { getStore } from "../db/index.js";
import { AppError } from "../errors/AppError.js";
import { mailConfigured, sendMail } from "../mail/send.js";

export interface AuthUser {
  id: string;
  email: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export function signToken(user: AuthUser): string {
  // iatMs: millisecond issue time, so a session cut-off can fall inside the same second.
  return jwt.sign({ sub: user.id, email: user.email, iatMs: Date.now() }, config.jwtSecret, {
    expiresIn: SESSION_TTL,
  });
}

/**
 * Env allowlist and the allowed_emails table are combined.
 * When both are empty, sign-in stays open so a fresh install is not locked.
 */
export function emailAllowedByLists(
  email: string,
  envEmails: readonly string[],
  approvedEmails: readonly string[],
): boolean {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return false;
  if (envEmails.length === 0 && approvedEmails.length === 0) return true;
  return envEmails.includes(normalized) || approvedEmails.includes(normalized);
}

export async function isEmailAllowed(email: string): Promise<boolean> {
  const store = await getStore();
  const approved = await store.listAllowedEmails();
  return emailAllowedByLists(email, config.google.allowedEmails, approved);
}

/** Short cache of each user's session cut-off so every request does not hit the database. */
const SESSION_CACHE_MS = 30_000;
const sessionCache = new Map<string, { validAfterMs: number | null; exists: boolean; at: number }>();

/** Drop the cached cut-off after an account is claimed, deleted, or its sessions revoked. */
export function forgetSessionCache(userId: string): void {
  sessionCache.delete(userId);
}

async function sessionCutoff(userId: string): Promise<{ validAfterMs: number | null; exists: boolean }> {
  const cached = sessionCache.get(userId);
  if (cached && Date.now() - cached.at < SESSION_CACHE_MS) return cached;
  const store = await getStore();
  const user = await store.findUserById(userId);
  const entry = {
    exists: Boolean(user),
    validAfterMs: user?.sessionsValidAfter ? new Date(user.sessionsValidAfter).getTime() : null,
    at: Date.now(),
  };
  sessionCache.set(userId, entry);
  return entry;
}

/**
 * Verifies the bearer token, then checks the account still exists and the token was issued
 * after the account's session cut-off. Deleted or claimed accounts lose old sessions at once.
 */
export async function requireAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    next(AppError.unauthorized());
    return;
  }
  let payload: { sub: string; email: string; iat?: number; iatMs?: number };
  try {
    payload = jwt.verify(header.slice(7), config.jwtSecret) as typeof payload;
  } catch {
    next(AppError.unauthorized("Invalid or expired token"));
    return;
  }
  try {
    const cutoff = await sessionCutoff(payload.sub);
    if (!cutoff.exists) {
      next(AppError.unauthorized("This account no longer exists"));
      return;
    }
    const issuedMs = payload.iatMs ?? (payload.iat ?? 0) * 1000;
    if (cutoff.validAfterMs != null && issuedMs < cutoff.validAfterMs) {
      next(AppError.unauthorized("Session ended. Sign in again."));
      return;
    }
  } catch (error) {
    next(error);
    return;
  }
  req.user = { id: payload.sub, email: payload.email };
  next();
}

export async function registerUser(input: {
  email: string;
  password: string;
  /** Without an invite, the email must pass the same allowlist as Google sign-in. */
  inviteCode?: string;
  displayName?: string;
}): Promise<{ token: string; user: AuthUser }> {
  const store = await getStore();
  if (input.password.length < 8) {
    throw AppError.badRequest("Password must be at least 8 characters");
  }
  const existing = await store.findUserByEmail(input.email);
  if (existing) {
    throw AppError.conflict("This email already has an account. Sign in instead.");
  }
  const invite = input.inviteCode?.trim();
  if (invite) {
    if (!(await store.consumeInvite(invite))) {
      throw AppError.forbidden("Invalid or exhausted invite code");
    }
  } else if (!(await isEmailAllowed(input.email))) {
    throw AppError.forbidden("This email is not allowed to sign up");
  }
  const passwordHash = await bcrypt.hash(input.password, 12);
  const user = await store.createUser({
    email: input.email,
    passwordHash,
    displayName: input.displayName ?? null,
  });
  await store.audit(user.id, "auth.register", { email: user.email });
  const authUser = { id: user.id, email: user.email };
  return { token: signToken(authUser), user: authUser };
}

const DUMMY_HASH = bcrypt.hashSync("ledgerline-no-such-user", 12);

export async function loginUser(input: {
  email: string;
  password: string;
}): Promise<{ token: string; user: AuthUser }> {
  const store = await getStore();
  const user = await store.findUserByEmail(input.email);
  // Compare against a dummy hash when the user is missing so response time does not reveal accounts.
  const match = await bcrypt.compare(input.password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !match) {
    throw AppError.unauthorized("Invalid email or password");
  }
  await store.audit(user.id, "auth.login", {});
  const authUser = { id: user.id, email: user.email };
  return { token: signToken(authUser), user: authUser };
}

export async function loginOrRegisterWithGoogle(input: {
  email: string;
  displayName?: string | null;
}): Promise<{ token: string; user: AuthUser }> {
  const email = input.email.trim().toLowerCase();
  if (!email) {
    throw AppError.unauthorized("Google did not return an email");
  }
  if (!(await isEmailAllowed(email))) {
    throw AppError.forbidden("This Google account is not allowed to sign in");
  }

  const store = await getStore();
  let user = await store.findUserByEmail(email);
  if (!user) {
    const passwordHash = await bcrypt.hash(randomBytes(32).toString("hex"), 10);
    user = await store.createUser({
      email,
      passwordHash,
      displayName: input.displayName ?? null,
      emailVerified: true,
    });
    await store.audit(user.id, "auth.register.google", { email: user.email });
  } else if (!user.emailVerifiedAt) {
    // Someone signed up with this address and a password, but never proved they own it.
    // Google just did prove it: lock out that password and every session made with it.
    const passwordHash = await bcrypt.hash(randomBytes(32).toString("hex"), 10);
    user = (await store.claimAccountWithGoogle(user.id, passwordHash)) ?? user;
    forgetSessionCache(user.id);
    await store.audit(user.id, "auth.account_claimed.google", {});
  } else {
    await store.audit(user.id, "auth.login.google", {});
  }

  const authUser = { id: user.id, email: user.email };
  return { token: signToken(authUser), user: authUser };
}

const RESET_TTL_MS = 30 * 60 * 1000;

function hashResetToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Email a single-use reset link. Answers the same whether or not the account exists,
 * so the form cannot be used to find out who has an account.
 */
export async function requestPasswordReset(email: string): Promise<void> {
  if (!mailConfigured()) {
    throw AppError.serviceUnavailable(
      "Password reset by email is not set up on this server. If you use a Gmail address, choose Continue with Google instead.",
    );
  }
  const store = await getStore();
  const user = await store.findUserByEmail(email.trim().toLowerCase());
  if (!user) return;
  const token = randomBytes(32).toString("base64url");
  await store.createPasswordReset(user.id, hashResetToken(token), new Date(Date.now() + RESET_TTL_MS));
  // "code", not "token": the app treats ?token= as a session token and strips it.
  const link = `${config.frontendUrl.replace(/\/$/, "")}/reset-password?code=${token}`;
  await sendMail({
    to: user.email,
    subject: "Reset your Ledgerline password",
    text: [
      "Someone asked to reset the password for this Ledgerline account.",
      "",
      `Choose a new password here (the link works once, for 30 minutes): ${link}`,
      "",
      "If this was not you, ignore this email. Your password stays the same.",
    ].join("\n"),
  });
  await store.audit(user.id, "auth.password_reset_requested", {});
}

/** Set a new password from a reset link; signs out every other session. */
export async function resetPasswordWithToken(input: {
  token: string;
  password: string;
}): Promise<{ token: string; user: AuthUser }> {
  if (input.password.length < 8) {
    throw AppError.badRequest("Password must be at least 8 characters");
  }
  const store = await getStore();
  const userId = await store.consumePasswordReset(hashResetToken(input.token));
  if (!userId) {
    throw AppError.badRequest("This reset link has expired or was already used. Ask for a new one.");
  }
  const user = await store.resetPassword(userId, await bcrypt.hash(input.password, 12));
  if (!user) throw AppError.badRequest("This account no longer exists.");
  forgetSessionCache(user.id);
  await store.audit(user.id, "auth.password_reset", {});
  const authUser = { id: user.id, email: user.email };
  return { token: signToken(authUser), user: authUser };
}

/**
 * Sign in with Apple, on the same terms as Google. The identity token is verified
 * before this runs. Apple proves the email only when it says so; a proven email
 * claims an unproven password account (its password and sessions end, links made
 * with it are dropped). New accounts pass the same allowlist as every sign-up.
 */
export async function loginOrRegisterWithApple(input: {
  appleSub: string;
  email?: string | null;
  emailVerified: boolean;
  displayName?: string | null;
}): Promise<{ token: string; user: AuthUser }> {
  const appleSub = input.appleSub.trim();
  if (!appleSub) {
    throw AppError.unauthorized("Apple did not return an account id");
  }
  // An email Apple has not proven is never used to find or create an account.
  const email = input.emailVerified ? input.email?.trim().toLowerCase() || null : null;
  const displayName = input.displayName?.trim() || null;
  const store = await getStore();

  let user = await store.findUserByAppleSub(appleSub);
  if (!user && email) {
    const existing = await store.findUserByEmail(email);
    if (existing?.appleSub && existing.appleSub !== appleSub) {
      throw AppError.conflict("That email is already linked to another Apple ID");
    }
    if (existing && !existing.emailVerifiedAt) {
      // Someone signed up with this address and a password, but never proved they own it.
      const passwordHash = await bcrypt.hash(randomBytes(32).toString("hex"), 10);
      await store.claimAccountWithGoogle(existing.id, passwordHash);
      forgetSessionCache(existing.id);
      await store.audit(existing.id, "auth.account_claimed.apple", {});
    }
    if (existing) user = await store.setAppleSub(existing.id, appleSub);
  }

  if (!user) {
    if (!email) {
      throw AppError.badRequest(
        "Apple did not share a verified email. Remove Ledgerline from Sign in with Apple settings and try again.",
      );
    }
    if (!(await isEmailAllowed(email))) {
      throw AppError.forbidden("This Apple ID is not allowed to sign in");
    }
    const passwordHash = await bcrypt.hash(randomBytes(32).toString("hex"), 10);
    const created = await store.createUser({ email, passwordHash, displayName, emailVerified: true });
    user = await store.setAppleSub(created.id, appleSub);
    await store.audit(created.id, "auth.register.apple", {});
  } else {
    if (displayName && !user.displayName) {
      user = (await store.updateUserProfile(user.id, { displayName })) ?? user;
    }
    await store.audit(user.id, "auth.login.apple", {});
  }

  if (!user) {
    throw AppError.unauthorized("Could not sign in with Apple");
  }
  const authUser = { id: user.id, email: user.email };
  return { token: signToken(authUser), user: authUser };
}
