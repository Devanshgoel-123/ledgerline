"use client";

import { useState, type FormEvent } from "react";
import { LockKeyhole } from "lucide-react";
import { useApi } from "@/lib/useApi";
import type { MailProviderId, MailStatus } from "@/lib/api/types";

type ProviderGuide = {
  id: MailProviderId;
  label: string;
  /** Shown above the steps when the provider is known to be unreliable. */
  warning?: string;
  steps: React.ReactNode[];
};

const GUIDES: ProviderGuide[] = [
  {
    id: "gmail",
    label: "Gmail",
    steps: [
      <>
        Turn on{" "}
        <a href="https://myaccount.google.com/signinoptions/twosv" target="_blank" rel="noreferrer">
          2-Step Verification
        </a>{" "}
        for your Google account. App passwords only appear once it is on.
      </>,
      <>
        Open{" "}
        <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noreferrer">
          myaccount.google.com/apppasswords
        </a>
        , type <strong>Ledgerline</strong> as the name, and choose Create.
      </>,
      <>Copy the 16-letter password Google shows and paste it below. Spaces do not matter.</>,
    ],
  },
  {
    id: "yahoo",
    label: "Yahoo Mail",
    steps: [
      <>
        Open{" "}
        <a href="https://login.yahoo.com/myaccount/security" target="_blank" rel="noreferrer">
          Yahoo account security
        </a>
        .
      </>,
      <>
        Choose <strong>Generate app password</strong>, name it Ledgerline, and copy the password.
      </>,
      <>Paste it below.</>,
    ],
  },
  {
    id: "icloud",
    label: "iCloud Mail",
    steps: [
      <>Your Apple Account needs two-factor authentication turned on.</>,
      <>
        Sign in at{" "}
        <a href="https://account.apple.com" target="_blank" rel="noreferrer">
          account.apple.com
        </a>
        , open <strong>Sign-In and Security</strong>, then <strong>App-Specific Passwords</strong>.
      </>,
      <>Create one named Ledgerline and paste it below. Use your @icloud.com address as the email.</>,
    ],
  },
  {
    id: "zoho",
    label: "Zoho Mail",
    steps: [
      <>
        In Zoho Mail settings, open <strong>Mail Accounts</strong> and make sure{" "}
        <strong>IMAP access</strong> is on.
      </>,
      <>
        Open{" "}
        <a href="https://accounts.zoho.in/home#security/app_password" target="_blank" rel="noreferrer">
          Zoho account security
        </a>{" "}
        and generate an app password named Ledgerline.
      </>,
      <>Paste it below.</>,
    ],
  },
  {
    id: "outlook",
    label: "Outlook",
    warning:
      "May not work: Microsoft is ending app passwords for IMAP on Outlook and Hotmail accounts. If the check below fails, use another mailbox that gets your bank alerts, or upload statement PDFs instead.",
    steps: [
      <>Turn on two-step verification for your Microsoft account.</>,
      <>
        Open{" "}
        <a href="https://account.microsoft.com/security" target="_blank" rel="noreferrer">
          account.microsoft.com/security
        </a>
        , then <strong>Advanced security options</strong>, then <strong>App passwords</strong>.
      </>,
      <>Create one and paste it below.</>,
    ],
  },
  {
    id: "custom",
    label: "Other",
    steps: [
      <>
        Find your provider&apos;s <strong>IMAP server</strong> in its help pages. It usually starts
        with <code>imap.</code> and uses port 993.
      </>,
      <>If your provider offers app passwords, create one for Ledgerline. Otherwise use your mail password.</>,
      <>Enter the server, port, and password below.</>,
    ],
  },
];

/**
 * Connects the mailbox that receives bank alerts, over IMAP with an app password.
 * The API signs in with it before saving, so a wrong password is caught here.
 */
export function MailboxConnectForm({
  current,
  onConnected,
}: {
  /** A saved mailbox whose app password must be entered again, if any. */
  current: MailStatus | null;
  onConnected: (status: MailStatus) => void;
}) {
  const api = useApi();
  const [provider, setProvider] = useState<MailProviderId>(current?.provider ?? "gmail");
  const [email, setEmail] = useState(current?.email ?? "");
  const [host, setHost] = useState(current?.provider === "custom" ? (current.host ?? "") : "");
  const [port, setPort] = useState(String(current?.port ?? 993));
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const guide = GUIDES.find((item) => item.id === provider) ?? GUIDES[0]!;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const status = await api.connectMailbox({
        email: email.trim(),
        provider,
        password,
        ...(provider === "custom" ? { host: host.trim(), port: Number(port) || 993 } : {}),
      });
      setPassword("");
      onConnected(status);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not connect this mailbox. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="mail-connect" onSubmit={submit} aria-labelledby="mail-connect-title">
      <h3 id="mail-connect-title" className="ui-header">
        Connect the mailbox that gets your bank alerts
      </h3>
      {current?.needsPassword ? (
        <p className="meta mail-connect-notice" role="status">
          Ledgerline no longer signs in with Google. To keep scanning{" "}
          <strong>{current.email}</strong>, create an app password and enter it below. Your
          imported payments stay as they are.
        </p>
      ) : null}

      <fieldset className="mail-connect-providers">
        <legend className="import-bank-label">Mail provider</legend>
        <div className="import-bank-choices">
          {GUIDES.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`import-bank-choice ${provider === item.id ? "selected" : ""}`}
              aria-pressed={provider === item.id}
              disabled={busy}
              onClick={() => setProvider(item.id)}
            >
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      </fieldset>

      {guide.warning ? (
        <p className="form-error mail-connect-warning" role="note">
          {guide.warning}
        </p>
      ) : null}

      <div className="mail-connect-guide">
        <p className="meta">
          <strong>Get an app password.</strong> It lets Ledgerline read mail without your real
          password, and you can revoke it any time.
        </p>
        <ol>
          {guide.steps.map((step, index) => (
            <li key={index} className="meta">
              {step}
            </li>
          ))}
        </ol>
      </div>

      <div className="mail-connect-fields">
        <label className="field">
          <span>Email address</span>
          <input
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
          />
        </label>
        {provider === "custom" ? (
          <>
            <label className="field">
              <span>IMAP server</span>
              <input
                required
                value={host}
                onChange={(event) => setHost(event.target.value)}
                placeholder="imap.example.com"
                autoCapitalize="none"
                spellCheck={false}
              />
            </label>
            <label className="field field-compact">
              <span>Port</span>
              <input
                inputMode="numeric"
                pattern="[0-9]*"
                value={port}
                onChange={(event) => setPort(event.target.value)}
              />
            </label>
          </>
        ) : null}
        <label className="field">
          <span>App password</span>
          <input
            type="password"
            autoComplete="off"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="abcd efgh ijkl mnop"
          />
        </label>
      </div>

      <p className="meta mail-connect-privacy">
        <LockKeyhole size={13} aria-hidden /> Your password is encrypted and stored only on this
        computer. Ledgerline reads only mail from your bank&apos;s addresses and never changes your
        mailbox.
      </p>

      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}

      <button type="submit" className="cta" disabled={busy || !email || !password}>
        {busy ? "Checking with your mail server…" : "Check and connect"}
      </button>
    </form>
  );
}
