import { afterEach, describe, expect, it, vi } from "vitest";
import { requestJson } from "@/lib/api/http";

function respond(status: number, body: unknown) {
  const fetchMock = vi.fn(async () => new Response(JSON.stringify(body), { status }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("requestJson", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("identifies itself as the web app, which the local API requires", async () => {
    const fetchMock = respond(200, { ok: true });
    await requestJson("/api/me");
    const init = (fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1];
    expect((init.headers as Record<string, string>)["X-Ledgerline-Client"]).toBe("web");
  });

  it("says how to start Ledgerline when the API does not answer", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    }));
    await expect(requestJson("/api/accounts")).rejects.toThrow(/Make sure Ledgerline is running/);
  });

  it("shows a statement password error as is", async () => {
    respond(422, {
      error: { code: "PDF_PASSWORD_INCORRECT", message: "That password did not open the statement." },
    });
    await expect(requestJson("/api/parse")).rejects.toThrow(/did not open/);
  });

  it("shows a form message once, without a field-name prefix", async () => {
    respond(400, {
      error: {
        code: "VALIDATION_ERROR",
        message: "Request validation failed",
        details: [{ path: "date", message: "The date cannot be in the future" }],
      },
    });
    await expect(requestJson("/api/imports/transactions")).rejects.toThrow(
      /^The date cannot be in the future$/,
    );
  });
});
