import type { RequestHandler } from "express";
import { config } from "../config.js";
import { AppError } from "../errors/AppError.js";

/** The web app sends this on every API call. Other sites cannot without passing CORS first. */
export const CLIENT_HEADER = "x-ledgerline-client";

function hostname(hostHeader: string | undefined): string {
  if (!hostHeader) return "";
  const host = hostHeader.trim().toLowerCase();
  if (host.startsWith("[")) return host.slice(0, host.indexOf("]") + 1);
  return host.split(":")[0] ?? "";
}

/**
 * There is no sign-in, so the API must only answer this computer's own web app:
 * - the Host header must be an allowed name, which defeats DNS rebinding;
 * - API calls must carry CLIENT_HEADER, which forces a CORS preflight that only
 *   the allowed origins pass, so a web page cannot post forms or files to it.
 */
export const localOnly: RequestHandler = (req, _res, next) => {
  if (!config.local.allowedHosts.includes(hostname(req.headers.host))) {
    next(AppError.forbidden("Ledgerline only answers requests addressed to this computer."));
    return;
  }
  if (req.method !== "OPTIONS" && req.get(CLIENT_HEADER) !== "web") {
    next(AppError.forbidden("Open Ledgerline from its web app."));
    return;
  }
  next();
};
