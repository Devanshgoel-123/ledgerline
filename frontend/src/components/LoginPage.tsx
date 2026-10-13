"use client";

import { useState, type FormEvent } from "react";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Mail,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import { googleLoginUrl, type PasswordAuthMode } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { ForgotPasswordForm } from "@/components/ForgotPasswordForm";

const FEATURES = [
  {
    icon: Wallet,
    title: "Lifestyle categories",
    detail: "Food, travel, outing, investments — automatically understood from your UPI trail.",
  },
  {
    icon: TrendingUp,
    title: "Daily budget health",
    detail: "Track spending against a daily limit. Stay calm and in control.",
  },
  {
    icon: Mail,
    title: "Bank mail with Google, if you want it",
    detail: "Optional read-only Gmail access for bank alerts you choose. Or import statements yourself.",
  },
];

function GoogleMark() {
  return (
    <svg className="google-mark" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#4285F4"
        d="M23.49 12.27c0-.79-.07-1.54-.2-2.27H12v4.3h6.46a5.52 5.52 0 0 1-2.4 3.62v3h3.88c2.27-2.09 3.55-5.17 3.55-8.65Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.96-1.07 7.95-2.9l-3.88-3c-1.08.72-2.47 1.15-4.07 1.15-3.13 0-5.78-2.11-6.73-4.96H1.27v3.09A12 12 0 0 0 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.27 14.29A7.21 7.21 0 0 1 4.89 12c0-.8.14-1.57.38-2.29V6.62H1.27A12 12 0 0 0 0 12c0 1.94.46 3.77 1.27 5.38l4-3.09Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.76 0 3.33.6 4.58 1.8l3.43-3.43C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.69 1.27 6.62l4 3.09C6.22 6.86 8.87 4.75 12 4.75Z"
      />
    </svg>
  );
}

function PreviewCard() {
  return (
    <div className="login-preview" aria-hidden>
      <div className="login-preview-head">
        <span className="login-preview-label">August snapshot</span>
        <span className="login-preview-pill">Insight</span>
      </div>
      <p className="login-preview-amount">₹42,840</p>
      <p className="meta login-preview-sub">spent this month · ₹1,380/day avg</p>
      <div className="login-preview-chips">
        <span>Swiggy ₹4.2k</span>
        <span>Rapido ₹890</span>
        <span>Zepto ₹1.1k</span>
      </div>
      <div className="login-preview-bars">
        <span style={{ height: "72%" }} />
        <span className="peak" style={{ height: "100%" }} />
        <span style={{ height: "45%" }} />
        <span style={{ height: "88%" }} className="over" />
        <span style={{ height: "60%" }} />
        <span style={{ height: "38%" }} />
      </div>
      <p className="login-preview-alert">3 days over your daily limit</p>
    </div>
  );
}

interface LoginPageProps {
  authError?: string | null;
  /** Called when the user starts Google login (clears stale errors). */
  onContinue?: () => void;
}

export function LoginPage({ authError, onContinue }: LoginPageProps) {
  const { signInWithPassword } = useAuth();
  const [mode, setMode] = useState<PasswordAuthMode>("login");
  const [forgot, setForgot] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function switchMode() {
    setMode((current) => (current === "login" ? "register" : "login"));
    setError(null);
    onContinue?.();
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    onContinue?.();
    try {
      await signInWithPassword(mode, {
        email: email.trim(),
        password,
        ...(mode === "register" && displayName.trim()
          ? { displayName: displayName.trim() }
          : {}),
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Sign-in failed. Try again.");
      setBusy(false);
    }
  }

  return (
    <main className="login-screen">
      <div className="login-screen-bg" aria-hidden />

      <div className="login-frame">
        <motion.section
          className="login-hero"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <div className="login-hero-copy">
            <p className="login-eyebrow">
              <Sparkles size={14} /> Your finances, finally clear
            </p>
            <h1 className="login-headline">
              See where every <em>rupee</em> actually went.
            </h1>
            <p className="login-tagline">
              Ledgerline turns UPI statements into lifestyle insight — not another
              accounting spreadsheet.
            </p>

            <ul className="login-features">
              {FEATURES.map((feature, index) => {
                const Icon = feature.icon;
                return (
                  <motion.li
                    key={feature.title}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.06 * index, duration: 0.3 }}
                  >
                    <span className="login-feature-icon">
                      <Icon size={18} />
                    </span>
                    <div>
                      <strong>{feature.title}</strong>
                      <p className="meta">{feature.detail}</p>
                    </div>
                  </motion.li>
                );
              })}
            </ul>
          </div>

          <PreviewCard />
        </motion.section>

        <motion.section
          className="login-card"
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08, duration: 0.4 }}
        >
          <p className="brand compact login-card-brand">Ledgerline</p>
          <h2 className="login-card-title">
            {mode === "login" ? "Welcome back" : "Create your account"}
          </h2>
          <p className="meta login-card-lede">
            Continue with Google to scan bank mail automatically, or use an email and
            password and import bank PDFs yourself. You can connect Gmail later.
          </p>

          {error ?? authError ? <p className="form-error">{error ?? authError}</p> : null}

          <a
            className="cta google-cta login-google-btn"
            href={googleLoginUrl()}
            onClick={() => onContinue?.()}
          >
            <GoogleMark />
            Continue with Google
            <ArrowRight size={18} className="login-google-arrow" />
          </a>

          <p className="login-divider">
            <span>or with email</span>
          </p>

          {forgot ? (
            <ForgotPasswordForm initialEmail={email} onBack={() => setForgot(false)} />
          ) : (
          <>
          <form className="login-form" onSubmit={submit}>
            {mode === "register" ? (
              <label className="field">
                <span>Name (optional)</span>
                <input
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  autoComplete="name"
                  maxLength={80}
                />
              </label>
            ) : null}
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
            <label className="field">
              <span>Password</span>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                minLength={mode === "register" ? 8 : undefined}
                aria-describedby={mode === "register" ? "password-hint" : undefined}
                required
              />
            </label>
            {mode === "register" ? (
              <small id="password-hint" className="meta login-hint">
                At least 8 characters.
              </small>
            ) : (
              <p className="meta login-hint">
                <button type="button" className="link-button" onClick={() => setForgot(true)}>
                  Forgot password?
                </button>
              </p>
            )}
            <button
              type="submit"
              className={`cta login-email-btn${busy ? " is-loading" : ""}`}
              disabled={busy}
            >
              {busy
                ? mode === "login"
                  ? "Signing in…"
                  : "Creating account…"
                : mode === "login"
                  ? "Sign in"
                  : "Create account"}
            </button>
          </form>

          <p className="meta login-switch">
            {mode === "login" ? "New to Ledgerline?" : "Already have an account?"}{" "}
            <button type="button" className="link-button" onClick={() => switchMode()}>
              {mode === "login" ? "Create an account" : "Sign in"}
            </button>
          </p>
          </>
          )}

          <ul className="login-trust">
            <li>
              <ShieldCheck size={16} />
              Google sign-in includes Gmail read-only for bank senders you allow
            </li>
            <li>
              <ShieldCheck size={16} />
              Email sign-in never touches your inbox
            </li>
            <li>
              <ShieldCheck size={16} />
              7-day session · revoke anytime
            </li>
          </ul>

          <p className="login-fine-print">
            Continuing with Google shows email &amp; Gmail read-only scopes. Read
            the <Link href="/privacy">privacy policy</Link>.
          </p>
        </motion.section>
      </div>
    </main>
  );
}
