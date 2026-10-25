import { Router } from "express";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { validate } from "../middleware/validate.js";
import {
  connectMailBodySchema,
  enablePoolingBodySchema,
  mailScanBodySchema,
  unlockStatementBodySchema,
  type ConnectMailBody,
  type EnablePoolingBody,
  type MailScanBody,
} from "../validators/mail.js";
import { listLockedStatements, unlockMailStatement } from "./poolingService.js";
import {
  connectMailboxForUser,
  disablePoolingForUser,
  disconnectMailForUser,
  enablePoolingForUser,
  getMailStatusForUser,
  scanMailForUser,
  scanMailNowForUser,
} from "./service.js";

/** Bank mail over IMAP: mounted at /api/mail. */
export const mailRouter = Router();

/** GET /status — the connected mailbox, scan progress, and the latest run. */
mailRouter.get(
  "/status",
  asyncHandler(async (req, res) => {
    res.json(await getMailStatusForUser(req.user!.id));
  }),
);

/** POST /connect — check the app password with the mail server, then save it encrypted. */
mailRouter.post(
  "/connect",
  validate(connectMailBodySchema),
  asyncHandler(async (req, res) => {
    res.json(await connectMailboxForUser(req.user!.id, req.body as ConnectMailBody));
  }),
);

/** DELETE /connect — forget the mailbox and its password. */
mailRouter.delete(
  "/connect",
  asyncHandler(async (req, res) => {
    res.json(await disconnectMailForUser(req.user!.id));
  }),
);

/** POST /scan — scan one month, or from where the last scan stopped. Runs in the background. */
mailRouter.post(
  "/scan",
  validate(mailScanBodySchema),
  asyncHandler(async (req, res) => {
    res.json(await scanMailForUser(req.user!.id, req.body as MailScanBody));
  }),
);

/** POST /scan-now — re-read this month's bank mail. */
mailRouter.post(
  "/scan-now",
  asyncHandler(async (req, res) => {
    res.json(await scanMailNowForUser(req.user!.id));
  }),
);

/** POST /pooling/enable — choose banks, turn on scheduled scans, and start the first one. */
mailRouter.post(
  "/pooling/enable",
  validate(enablePoolingBodySchema),
  asyncHandler(async (req, res) => {
    res.json(await enablePoolingForUser(req.user!.id, req.body as EnablePoolingBody));
  }),
);

/** POST /pooling/disable — stop scheduled scans. */
mailRouter.post(
  "/pooling/disable",
  asyncHandler(async (req, res) => {
    res.json(await disablePoolingForUser(req.user!.id));
  }),
);

/** Statement PDFs from mail that need a password before they can be imported. */
mailRouter.get(
  "/locked-statements",
  asyncHandler(async (req, res) => {
    res.json({ statements: await listLockedStatements(req.user!.id) });
  }),
);

mailRouter.post(
  "/locked-statements/:id/unlock",
  validate(unlockStatementBodySchema),
  asyncHandler(async (req, res) => {
    const body = req.body as { password: string };
    res.json(await unlockMailStatement(req.user!.id, String(req.params.id), body.password));
  }),
);
