import { Router } from "express";
import { requireAuth } from "../auth/service.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { tenantContext } from "../middleware/tenantContext.js";
import { validate } from "../middleware/validate.js";
import { telegramCodeBodySchema, telegramPhoneBodySchema } from "../validators/telegram.js";
import {
  confirmTelegramPhoneController,
  createTelegramLinkController,
  getTelegramStatusController,
  requestTelegramPhoneController,
  sendTelegramTestController,
  telegramWebhookController,
  unlinkTelegramController,
} from "./controller.js";

export const telegramRouter = Router();

const PUBLIC_PATHS = new Set(["/webhook"]);

telegramRouter.use((req, res, next) => {
  if (PUBLIC_PATHS.has(req.path)) {
    next();
    return;
  }
  requireAuth(req, res, (err?: unknown) => (err ? next(err) : tenantContext(req, res, next)));
});

telegramRouter.get("/status", asyncHandler(getTelegramStatusController));
telegramRouter.post("/link", asyncHandler(createTelegramLinkController));
telegramRouter.delete("/link", asyncHandler(unlinkTelegramController));
telegramRouter.post(
  "/phone",
  validate(telegramPhoneBodySchema),
  asyncHandler(requestTelegramPhoneController),
);
telegramRouter.post(
  "/verify",
  validate(telegramCodeBodySchema),
  asyncHandler(confirmTelegramPhoneController),
);
telegramRouter.post("/test", asyncHandler(sendTelegramTestController));
telegramRouter.post("/webhook", asyncHandler(telegramWebhookController));
