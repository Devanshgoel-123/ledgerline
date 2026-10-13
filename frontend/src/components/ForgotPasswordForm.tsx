"use client";

import { useState, type FormEvent } from "react";
import { requestPasswordReset } from "@/lib/api";

/** Ask for a password reset link by email. */
export function ForgotPasswordForm({
  initialEmail,
  onBack,
}: {
  initialEmail: string;
  onBack: () => void;
}) {
  const [email, setEmail] = useState(initialEmail);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await requestPasswordReset(email.trim());
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send the link. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-form">
      {sent ? (
        <p className="meta" role="status">
          If an account uses <strong>{email.trim()}</strong>, a reset link is on its way. It works
          once, for 30 minutes. Check your spam folder if it does not arrive.
        </p>
      ) : (
        <form className="login-form" onSubmit={submit}>
          <p className="meta">Enter your email and we will send a link to choose a new password.</p>
          <label className="field">
            <span>Email</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              required
            />
          </label>
          {error ? (
            <p className="form-error" role="alert">
              {error}
            </p>
          ) : null}
          <button type="submit" className={`cta login-email-btn${busy ? " is-loading" : ""}`} disabled={busy}>
            {busy ? "Sending…" : "Send reset link"}
          </button>
        </form>
      )}
      <p className="meta login-switch">
        <button type="button" className="link-button" onClick={onBack}>
          Back to sign in
        </button>
      </p>
    </div>
  );
}
