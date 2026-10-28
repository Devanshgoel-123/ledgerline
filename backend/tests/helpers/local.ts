import { CLIENT_HEADER } from "../../src/local/guard.js";
import { setLocalUserForTests } from "../../src/local/user.js";

/** Headers the web app sends; the API then acts as this profile. */
export function localHeaders(user: string | { id: string; email?: string }): Record<string, string> {
  const id = typeof user === "string" ? user : user.id;
  const email = typeof user === "string" ? "" : (user.email ?? "");
  setLocalUserForTests({ id, email });
  return { [CLIENT_HEADER]: "web" };
}
