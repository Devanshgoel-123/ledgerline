import { Router } from "express";
import jwt from "jsonwebtoken";
import { config } from "../config.js";
import { getStore } from "../db/index.js";
import { AppError } from "../errors/AppError.js";
import {
  buildGoogleLoginAuthUrl,
  gmailConfigured,
} from "../gmail/client.js";
import { verifyAppleIdentityToken } from "./apple.js";
import { emailRateLimiter } from "../middleware/rateLimit.js";
import { validate } from "../middleware/validate.js";
import {
  forgotPasswordBodySchema,
  loginBodySchema,
  registerBodySchema,
  resetPasswordBodySchema,
} from "../validators/auth.js";
import {
  forgetSessionCache,
  loginOrRegisterWithApple,
  loginUser,
  registerUser,
  requestPasswordReset,
  requireAuth,
  resetPasswordWithToken,
} from "./service.js";
import type { z } from "zod";

type LoginBody = z.infer<typeof loginBodySchema>;
type RegisterBody = z.infer<typeof registerBodySchema>;

export const authRouter = Router();

authRouter.post("/apple", async (req, res) => {
  // Without the app's bundle id there is no audience to check tokens against.
  if (!config.appleBundleId) {
    throw AppError.serviceUnavailable("Sign in with Apple is not set up on this server.");
  }
  const body = req.body as { identityToken?: unknown; displayName?: unknown };
  const identityToken = typeof body.identityToken === "string" ? body.identityToken : "";
  if (!identityToken) {
    throw AppError.badRequest("Missing Apple identity token");
  }
  const displayName =
    typeof body.displayName === "string" ? body.displayName.trim().slice(0, 80) : null;
  const claims = await verifyAppleIdentityToken(identityToken, config.appleBundleId);
  const result = await loginOrRegisterWithApple({
    appleSub: claims.sub,
    email: claims.email ?? null,
    emailVerified: claims.emailVerified,
    displayName,
  });
  const store = await getStore();
  const user = await store.findUserById(result.user.id);
  res.json({
    token: result.token,
    user: user ? publicUser(user) : result.user,
  });
});

authRouter.get("/google", (req, res) => {
  if (!gmailConfigured()) {
    throw AppError.serviceUnavailable(
      "Google sign-in is not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.",
    );
  }
  // The browser that started sign-in keeps this nonce and accepts only a token that
  // comes back with it, so a link carrying someone else's session is ignored.
  const nonce = typeof req.query.nonce === "string" && /^[\w-]{16,64}$/.test(req.query.nonce)
    ? req.query.nonce
    : undefined;
  const state = jwt.sign(
    { purpose: "google_login", ...(nonce ? { nonce } : {}) },
    config.jwtSecret,
    { expiresIn: "10m" },
  );
  res.redirect(buildGoogleLoginAuthUrl(state));
});

/** Email and password sign-up, for people who do not want to connect Gmail. */
authRouter.post("/register", validate(registerBodySchema), async (req, res) => {
  const body = req.body as RegisterBody;
  const result = await registerUser(body);
  res.status(201).json({ token: result.token });
});

authRouter.post("/login", emailRateLimiter, validate(loginBodySchema), async (req, res) => {
  const body = req.body as LoginBody;
  const result = await loginUser(body);
  res.json({ token: result.token });
});

/** Email a reset link. Always the same answer, so it never reveals whether an account exists. */
authRouter.post("/forgot", emailRateLimiter, validate(forgotPasswordBodySchema), async (req, res) => {
  await requestPasswordReset((req.body as { email: string }).email);
  res.json({ ok: true });
});

authRouter.post("/reset", validate(resetPasswordBodySchema), async (req, res) => {
  const result = await resetPasswordWithToken(req.body as { token: string; password: string });
  res.json({ token: result.token });
});

/** Lightweight session probe for clients expecting /api/auth/session. */
authRouter.get("/session", (_req, res) => {
  res.json({ user: null, authenticated: false });
});

authRouter.get("/me", requireAuth, async (req, res) => {
  const store = await getStore();
  const user = await store.findUserById(req.user!.id);
  if (!user) {
    throw AppError.notFound("User not found");
  }
  res.json(publicUser(user));
});

const AVATAR_RE = /^data:image\/(?:jpeg|png|webp);base64,[a-z0-9+/=\s]+$/i;
const AVATAR_MAX = 180_000;

authRouter.patch("/me", requireAuth, async (req, res) => {
  const body = req.body as { displayName?: unknown; avatarUrl?: unknown };
  const patch: { displayName?: string | null; avatarUrl?: string | null } = {};
  if ("displayName" in body) {
    if (body.displayName == null || body.displayName === "") {
      patch.displayName = null;
    } else if (typeof body.displayName === "string" && body.displayName.trim().length <= 80) {
      patch.displayName = body.displayName.trim();
    } else {
      throw AppError.badRequest("Name must be 80 characters or fewer");
    }
  }
  if ("avatarUrl" in body) {
    if (body.avatarUrl == null || body.avatarUrl === "") {
      patch.avatarUrl = null;
    } else if (
      typeof body.avatarUrl === "string" &&
      body.avatarUrl.length <= AVATAR_MAX &&
      AVATAR_RE.test(body.avatarUrl)
    ) {
      patch.avatarUrl = body.avatarUrl;
    } else {
      throw AppError.badRequest("Profile photo must be a small JPEG, PNG, or WebP");
    }
  }
  const store = await getStore();
  const user = await store.updateUserProfile(req.user!.id, patch);
  if (!user) throw AppError.notFound("User not found");
  await store.audit(req.user!.id, "auth.profile_updated", {
    displayName: "displayName" in patch,
    avatar: "avatarUrl" in patch,
  });
  res.json(publicUser(user));
});

function publicUser(user: {
  id: string;
  email: string;
  displayName: string | null;
  avatarUrl: string | null;
  dailySpendLimit: number | null;
  createdAt: string;
}) {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    dailySpendLimit: user.dailySpendLimit,
    createdAt: user.createdAt,
  };
}

authRouter.delete("/me", requireAuth, async (req, res) => {
  const store = await getStore();
  await store.deleteUserData(req.user!.id);
  forgetSessionCache(req.user!.id);
  await store.audit(req.user!.id, "auth.delete_account", {});
  res.json({ ok: true });
});
