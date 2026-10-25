import express from "express";
import multer from "multer";
import { healthRouter } from "./api/health.js";
import { config } from "./config.js";
import { errorHandler, notFoundHandler } from "./errors/errorHandler.js";
import { gmailRouter } from "./gmail/routes.js";
import { uploadImportController } from "./imports/controller.js";
import { importRouter } from "./imports/routes.js";
import { globalRateLimiter, uploadRateLimiter } from "./middleware/rateLimit.js";
import { requestContext } from "./middleware/requestContext.js";
import { requestLogger } from "./middleware/requestLogger.js";
import { corsMiddleware, securityHeaders } from "./middleware/security.js";
import { validate } from "./middleware/validate.js";
import { providersRouter } from "./providers/routes.js";
import { accountsRouter } from "./accounts/routes.js";
import { categoriesRouter } from "./categories/routes.js";
import { rulesRouter } from "./rules/routes.js";
import { parsePasswordBodySchema } from "./validators/imports.js";
import { preferencesRouter } from "./preferences/routes.js";
import { telegramRouter } from "./telegram/routes.js";
import { statementMatchRouter } from "./statementMatch/routes.js";
import { demoRouter } from "./demo/routes.js";
import { localOnly } from "./local/guard.js";
import { profileRouter } from "./local/profileRoutes.js";
import { requireLocalUser } from "./local/user.js";
import { telegramWebhookController } from "./telegram/controller.js";
import { asyncHandler } from "./middleware/asyncHandler.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
});

/**
 * Build the Express application (middleware + routes).
 * Separated from listen() so tests can import the app without binding a port.
 */
export function createApp(): express.Application {
  const app = express();

  app.set("trust proxy", config.trustProxy);
  app.disable("x-powered-by");
  // Live dashboard/status JSON must not 304 — the browser then keeps polling a stale "running" scan.
  app.set("etag", false);

  app.use(requestContext);
  app.use(securityHeaders());
  app.use(corsMiddleware());
  app.use(express.json({ limit: "2mb" }));
  app.use(requestLogger);
  app.use(globalRateLimiter);

  // Observability probes (also mounted under /api for backwards compat)
  app.use(healthRouter);
  app.use("/api", healthRouter);

  // Telegram calls its webhook from outside; it checks its own secret header.
  app.post("/api/v1/telegram/webhook", asyncHandler(telegramWebhookController));

  // Everything else answers only this computer's web app, as the one local user.
  app.use("/api", localOnly, requireLocalUser);
  app.use("/api/me", profileRouter);
  app.use("/api/imports", importRouter);
  app.use("/api/accounts", accountsRouter);
  app.use("/api/categories", categoriesRouter);
  app.use("/api/rules", rulesRouter);
  app.use("/api/providers", providersRouter);
  app.use("/api/preferences", preferencesRouter);
  app.use("/api/gmail", gmailRouter);
  app.use("/api/telegram", telegramRouter);
  app.use("/api/statement-match", statementMatchRouter);
  app.use("/api/demo", demoRouter);

  app.post(
    "/api/parse",
    uploadRateLimiter,
    upload.single("file"),
    validate(parsePasswordBodySchema),
    uploadImportController,
  );

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
