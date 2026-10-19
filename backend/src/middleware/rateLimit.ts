import rateLimit, {
  ipKeyGenerator,
  type Options,
  type RateLimitRequestHandler,
} from "express-rate-limit";
import type { Request, Response } from "express";
import { config } from "../config.js";
import type { ErrorResponseBody } from "../errors/AppError.js";

function sendRateLimitResponse(req: Request, res: Response, windowMs: number, message: string) {
  const body: ErrorResponseBody = {
    error: {
      code: "RATE_LIMITED",
      message,
      requestId: req.requestId,
      details: {
        retryAfterSeconds: Math.ceil(windowMs / 1000),
      },
    },
    detail: message,
  };
  res.status(429).json(body);
}

function clientIp(req: Request): string {
  return req.ip || req.socket.remoteAddress || "unknown";
}

function keyByIp(req: Request): string {
  return ipKeyGenerator(clientIp(req));
}

function keyByIpAndUser(req: Request): string {
  const userId = req.user?.id;
  return userId ? `user:${userId}` : `ip:${keyByIp(req)}`;
}

const shared: Partial<Options> = {
  standardHeaders: true,
  legacyHeaders: false,
  windowMs: config.rateLimit.windowMs,
  skip: () => config.isTest,
  validate: { xForwardedForHeader: false },
};

function keyByEmail(req: Request): string {
  const email = (req.body as { email?: unknown } | undefined)?.email;
  return typeof email === "string" ? `email:${email.trim().toLowerCase()}` : `ip:${keyByIp(req)}`;
}

/**
 * Per-address limit on password sign-in and reset mail. The IP limit alone does
 * not stop a guesser that spreads attempts across many addresses.
 */
export const emailRateLimiter: RateLimitRequestHandler = rateLimit({
  ...shared,
  windowMs: 15 * 60_000,
  max: 10,
  keyGenerator: keyByEmail,
  handler: (req, res, _next, optionsUsed) => {
    sendRateLimitResponse(
      req,
      res,
      optionsUsed.windowMs,
      "Too many attempts for this account. Try again in 15 minutes.",
    );
  },
});

/** Global IP-based limiter (burst protection for the whole API). */
export const globalRateLimiter: RateLimitRequestHandler = rateLimit({
  ...shared,
  max: config.rateLimit.max,
  keyGenerator: keyByIp,
  handler: (req, res, _next, optionsUsed) => {
    sendRateLimitResponse(
      req,
      res,
      optionsUsed.windowMs,
      "Too many requests. Please slow down and try again.",
    );
  },
});

/** Stricter limiter for auth endpoints (brute-force protection). */
export const authRateLimiter: RateLimitRequestHandler = rateLimit({
  ...shared,
  max: config.rateLimit.authMax,
  keyGenerator: keyByIp,
  handler: (req, res, _next, optionsUsed) => {
    sendRateLimitResponse(
      req,
      res,
      optionsUsed.windowMs,
      "Too many authentication attempts. Please try again later.",
    );
  },
});

/** Upload / parse limiter — keyed by user when authenticated, else IP. */
export const uploadRateLimiter: RateLimitRequestHandler = rateLimit({
  ...shared,
  max: config.rateLimit.uploadMax,
  keyGenerator: keyByIpAndUser,
  handler: (req, res, _next, optionsUsed) => {
    sendRateLimitResponse(
      req,
      res,
      optionsUsed.windowMs,
      "Upload rate limit exceeded. Please wait before uploading again.",
    );
  },
});

/** Mutation limiter for DELETE/PATCH operations — prevents spam deletion/editing. */
export const mutationRateLimiter: RateLimitRequestHandler = rateLimit({
  ...shared,
  max: 30, // 30 mutations per window
  keyGenerator: keyByIpAndUser,
  windowMs: 60000, // 1 minute window
  handler: (req, res, _next, optionsUsed) => {
    sendRateLimitResponse(
      req,
      res,
      optionsUsed.windowMs,
      "Too many modifications. Please wait before making more changes.",
    );
  },
});
