import { Router } from "express";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { validate } from "../middleware/validate.js";
import { telegramCodeBodySchema, telegramPhoneBodySchema } from "../validators/telegram.js";
import {
  confirmTelegramPhoneController,
  createTelegramLinkController,
  getTelegramStatusController,
  requestTelegramPhoneController,
  sendTelegramTestController,
  unlinkTelegramController,
} from "./controller.js";

export const telegramRouter = Router();

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
