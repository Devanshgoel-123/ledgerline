import type { NextFunction, Request, Response } from "express";
import { config } from "../config.js";
import { AppError } from "../errors/AppError.js";
import { requireAuth } from "../auth/service.js";
import { getStore } from "../db/index.js";

export function isAdminEmail(email: string): boolean {
  if (config.adminEmails.length === 0) return false;
  return config.adminEmails.includes(email.trim().toLowerCase());
}

export function requireAdmin(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  requireAuth(req, res, (err?: unknown) => {
    if (err) {
      next(err);
      return;
    }
    // The address must be the account's current, verified one. A password sign-up
    // with an admin's address, never confirmed, gets nothing.
    void getStore()
      .then((store) => store.findUserById(req.user!.id))
      .then((user) => {
        if (!user?.emailVerifiedAt || !isAdminEmail(user.email)) {
          next(AppError.forbidden("Admin access required"));
          return;
        }
        next();
      }, next);
  });
}
