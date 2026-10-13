import { afterEach, describe, expect, it, vi } from "vitest";
import { requestJson, SESSION_EXPIRED_EVENT } from "@/lib/api/http";

function respond(status: number, body: unknown) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(JSON.stringify(body), { status })),
  );
}

describe("requestJson session handling", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("keeps the user signed in when a statement password is wrong", async () => {
    const expired = vi.fn();
    window.addEventListener(SESSION_EXPIRED_EVENT, expired);
    respond(422, {
      error: { code: "PDF_PASSWORD_INCORRECT", message: "That password did not open the statement." },
    });
    await expect(requestJson("/api/parse", { token: "t" })).rejects.toThrow(/did not open/);
    expect(expired).not.toHaveBeenCalled();
    window.removeEventListener(SESSION_EXPIRED_EVENT, expired);
  });

  it("signs out when the server rejects the session", async () => {
    const expired = vi.fn();
    window.addEventListener(SESSION_EXPIRED_EVENT, expired);
    respond(401, { error: { code: "UNAUTHORIZED", message: "Invalid or expired token" } });
    await expect(requestJson("/api/accounts", { token: "t" })).rejects.toThrow();
    expect(expired).toHaveBeenCalledOnce();
    window.removeEventListener(SESSION_EXPIRED_EVENT, expired);
  });
});

describe("requestJson error messages", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("explains a dropped connection instead of 'Failed to fetch'", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    }));
    await expect(requestJson("/api/accounts", { token: "t" })).rejects.toThrow(/internet connection/);
  });

  it("shows a form message once, without a field-name prefix", async () => {
    respond(400, {
      error: {
        code: "VALIDATION_ERROR",
        message: "Request validation failed",
        details: [{ path: "date", message: "The date cannot be in the future" }],
      },
    });
    await expect(requestJson("/api/imports/transactions", { token: "t" })).rejects.toThrow(
      /^The date cannot be in the future$/,
    );
  });
});
