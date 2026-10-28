import { Router } from "express";
import { getStore } from "../db/index.js";
import { AppError } from "../errors/AppError.js";
import { forgetLocalUser } from "./user.js";

export const profileRouter = Router();

function publicProfile(user: {
  id: string;
  displayName: string | null;
  avatarUrl: string | null;
  dailySpendLimit: number | null;
  createdAt: string;
}) {
  return {
    id: user.id,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    dailySpendLimit: user.dailySpendLimit,
    createdAt: user.createdAt,
  };
}

profileRouter.get("/", async (req, res) => {
  const store = await getStore();
  const user = await store.findUserById(req.user!.id);
  if (!user) throw AppError.notFound("Profile not found");
  res.json(publicProfile(user));
});

const AVATAR_RE = /^data:image\/(?:jpeg|png|webp);base64,[a-z0-9+/=\s]+$/i;
const AVATAR_MAX = 180_000;

profileRouter.patch("/", async (req, res) => {
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
  if (!user) throw AppError.notFound("Profile not found");
  res.json(publicProfile(user));
});

/** Erase everything this install holds: transactions, rules, mail, links. Ledgerline starts fresh. */
profileRouter.delete("/", async (req, res) => {
  const store = await getStore();
  await store.deleteUserData(req.user!.id);
  forgetLocalUser();
  res.json({ ok: true });
});
