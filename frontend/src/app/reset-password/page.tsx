"use client";

import { Suspense, useState, type FormEvent } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { resetPassword } from "@/lib/api";

function ResetPasswordForm() {
  // "code", not "token": the auth provider consumes ?token= as a session token.
  const token = useSearchParams().get("code") ?? "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    if (password !== confirm) {
      setError("The two passwords do not match.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const session = await resetPassword(token, password);
      // The fragment never reaches a server; the app picks the session up from it on load.
      window.location.replace(`/#token=${encodeURIComponent(session)}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reset the password. Try again.");
      setBusy(false);
    }
  }

  if (!token) {
    return (
      <p className="meta">
        This link is missing its code. Open the link from the email again, or{" "}
        <Link href="/" className="text-link">
          ask for a new one
        </Link>
        .
      </p>
    );
  }

  return (
    <form className="login-form" onSubmit={submit}>
      <label className="field">
        <span>New password</span>
        <input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="new-password"
          minLength={8}
          aria-describedby="reset-hint"
          required
        />
      </label>
      <small id="reset-hint" className="meta login-hint">
        At least 8 characters. You will be signed out everywhere else.
      </small>
      <label className="field">
        <span>Type it again</span>
        <input
          type="password"
          value={confirm}
          onChange={(event) => setConfirm(event.target.value)}
          autoComplete="new-password"
          minLength={8}
          required
        />
      </label>
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
      <button type="submit" className={`cta login-email-btn${busy ? " is-loading" : ""}`} disabled={busy}>
        {busy ? "Saving…" : "Save new password"}
      </button>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <main className="welcome-screen">
      <section className="login-card" style={{ width: "100%", maxWidth: "26rem" }}>
        <p className="brand compact login-card-brand">Ledgerline</p>
        <h1 className="login-card-title">Choose a new password</h1>
        <Suspense fallback={<p className="meta">Loading…</p>}>
          <ResetPasswordForm />
        </Suspense>
      </section>
    </main>
  );
}
