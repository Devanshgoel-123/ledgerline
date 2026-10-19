import { timingSafeEqual } from "node:crypto";
import type { IncomingMessage } from "node:http";
import { config } from "../config.js";

/** The worker's control routes need its bearer token, or a loopback caller when none is set. */
export function controlAllowed(req: IncomingMessage, token = config.poolingWorker.token): boolean {
  if (!token) {
    const from = req.socket.remoteAddress ?? "";
    return from === "127.0.0.1" || from === "::1" || from === "::ffff:127.0.0.1";
  }
  const given = Buffer.from(req.headers.authorization ?? "");
  const expected = Buffer.from(`Bearer ${token}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}
