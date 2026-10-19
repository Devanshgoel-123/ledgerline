import { afterEach, describe, expect, it } from "vitest";
import { LOGIN_NONCE_KEY, newLoginNonce } from "@/lib/api";
import { takeAuthParams } from "@/lib/auth";

function visit(path: string) {
  window.history.replaceState({}, "", path);
}

describe("takeAuthParams", () => {
  afterEach(() => {
    sessionStorage.clear();
    visit("/");
  });

  it("accepts a session token that returns with this tab's nonce", () => {
    const nonce = newLoginNonce();
    visit(`/#token=session-abc&nonce=${nonce}`);
    expect(takeAuthParams().token).toBe("session-abc");
    expect(window.location.hash).toBe("");
    expect(sessionStorage.getItem(LOGIN_NONCE_KEY)).toBeNull();
  });

  it("ignores a token in a link someone else made", () => {
    visit("/?token=attacker-session");
    expect(takeAuthParams().token).toBeNull();
    expect(window.location.search).toBe("");

    newLoginNonce();
    visit("/#token=attacker-session&nonce=guessed");
    expect(takeAuthParams().token).toBeNull();
  });

  it("still shows a sign-in error from the redirect", () => {
    visit("/?auth_error=Google%20sign-in%20was%20cancelled");
    expect(takeAuthParams()).toEqual({ token: null, authError: "Google sign-in was cancelled" });
  });
});
