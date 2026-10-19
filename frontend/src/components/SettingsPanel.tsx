"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { DailyLimitForm, useSaveDailyLimit } from "@/components/DailyLimitForm";
import { useAuth } from "@/lib/auth";
import { useApi } from "@/lib/useApi";
import { useDashboard } from "@/lib/dashboard-context";
import { pathForView } from "@/lib/dashboardViews";
import { telegramConnectHint, telegramPill, type TelegramStatus } from "@/lib/telegram";
import type { GmailStatus } from "@/lib/api/types";
import { formatInr } from "@/helpers/currency";
import { userInitials } from "@/helpers/userInitials";

function resizeAvatar(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      const size = 256;
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        URL.revokeObjectURL(url);
        reject(new Error("Could not read that image"));
        return;
      }
      const scale = Math.max(size / image.width, size / image.height);
      const width = image.width * scale;
      const height = image.height * scale;
      ctx.drawImage(image, (size - width) / 2, (size - height) / 2, width, height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/jpeg", 0.82));
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read that image"));
    };
    image.src = url;
  });
}

function ruleMatchLabel(rule: Record<string, unknown>): string {
  if (rule.matchUpiId) return `UPI: ${String(rule.matchUpiId)}`;
  if (rule.matchNarrationRe) return `contains: ${String(rule.matchNarrationRe)}`;
  if (rule.matchMerchantAlias) return `merchant: ${String(rule.matchMerchantAlias)}`;
  return "custom match";
}

export function SettingsPanel({ onChanged }: { onChanged?: () => void }) {
  const api = useApi();
  const { data } = useDashboard();
  const { logout, destroyAccount, user, saveProfile } = useAuth();
  const [displayName, setDisplayName] = useState(user?.displayName ?? "");
  const [avatarBusy, setAvatarBusy] = useState(false);
  const saveLimit = useSaveDailyLimit();
  const [rules, setRules] = useState<Array<Record<string, unknown>>>([]);
  const [dailyLimit, setDailyLimit] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [removingRuleId, setRemovingRuleId] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  async function downloadCsv() {
    if (!api || exporting) return;
    setExporting(true);
    setError(null);
    try {
      const blob = await api.exportTransactionsCsv();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `ledgerline-transactions-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.append(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setMessage("Your transactions were downloaded as a CSV file.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not prepare the download. Try again.");
    } finally {
      setExporting(false);
    }
  }
  const [showDanger, setShowDanger] = useState(false);
  const [telegram, setTelegram] = useState<TelegramStatus | null>(null);
  const [gmail, setGmail] = useState<GmailStatus | null>(null);
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [telegramBusy, setTelegramBusy] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [editingLimit, setEditingLimit] = useState(false);
  const [editingPhone, setEditingPhone] = useState(false);

  const refresh = useCallback(async () => {
    if (!api) return;
    try {
      const [rulesRes, prefsRes, telegramRes, gmailRes] = await Promise.all([
        api.listRules(),
        api.fetchPreferences(),
        api.telegramStatus().catch(() => null),
        api.gmailStatus().catch(() => null),
      ]);
      setRules(rulesRes.rules);
      setDailyLimit(prefsRes.dailySpendLimit);
      setTelegram(telegramRes);
      setGmail(gmailRes);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load settings");
    }
  }, [api]);

  // Show the saved name again whenever it changes (React's "adjust state on prop change").
  const [shownName, setShownName] = useState(user?.displayName);
  if (user?.displayName !== shownName) {
    setShownName(user?.displayName);
    setDisplayName(user?.displayName ?? "");
  }

  const waitingForShare = Boolean(
    telegram?.verify && !telegram.verify.codeSent && !telegram.linked,
  );

  const linkedButDown = Boolean(
    telegram?.linked && telegram.connection && telegram.connection !== "connected",
  );

  useEffect(() => {
    if (!api || (!waitingForShare && !linkedButDown)) return;
    const timer = window.setInterval(
      () => {
        void api
          .telegramStatus()
          .then(setTelegram)
          .catch(() => undefined);
      },
      waitingForShare ? 3000 : 10_000,
    );
    return () => window.clearInterval(timer);
  }, [api, waitingForShare, linkedButDown]);

  useEffect(() => {
    let cancelled = false;
    void Promise.resolve().then(async () => {
      if (!api || cancelled) return;
      await refresh();
    });
    return () => {
      cancelled = true;
    };
  }, [api, refresh]);

  if (!api) return null;

  return (
    <div className="settings-sections">
      <header>
        <p className="stat-kicker mb-2">Settings</p>
        <h2 className="month-label">Limits and account</h2>
      </header>

      {(message || error) && (
        <div className="panel" style={{ marginBottom: 0 }}>
          {message ? <p className="meta">{message}</p> : null}
          {error ? <p className="form-error">{error}</p> : null}
        </div>
      )}

      <section className="settings-section">
        <div className="settings-identity">
          <label className="settings-avatar" title="Change photo">
            {user?.avatarUrl ? (
              <img src={user.avatarUrl} alt="" />
            ) : (
              <span>{userInitials(user)}</span>
            )}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              hidden
              disabled={avatarBusy}
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (!file) return;
                setAvatarBusy(true);
                setError(null);
                void resizeAvatar(file)
                  .then((avatarUrl) => saveProfile({ avatarUrl }))
                  .then(() => setMessage("Photo updated"))
                  .catch((err) =>
                    setError(err instanceof Error ? err.message : "Could not save photo"),
                  )
                  .finally(() => setAvatarBusy(false));
              }}
            />
          </label>
          <div className="settings-row">
            <div>
              <h3 className="ui-header">{user?.displayName?.trim() || "Your name"}</h3>
              <p className="meta">{avatarBusy ? "Saving photo…" : user?.email}</p>
            </div>
            <div className="settings-row-end">
              <button
                type="button"
                className="ghost"
                onClick={() => {
                  setDisplayName(user?.displayName ?? "");
                  setEditingName((open) => !open);
                }}
              >
                {editingName ? "Close" : "Edit"}
              </button>
              {user?.avatarUrl ? (
                <button
                  type="button"
                  className="ghost"
                  onClick={() => {
                    setError(null);
                    void saveProfile({ avatarUrl: null })
                      .then(() => setMessage("Photo removed"))
                      .catch((err) =>
                        setError(err instanceof Error ? err.message : "Could not remove photo"),
                      );
                  }}
                >
                  Remove
                </button>
              ) : null}
            </div>
          </div>
        </div>
        {editingName ? (
          <form
            className="settings-reveal"
            onSubmit={(event) => {
              event.preventDefault();
              setError(null);
              setMessage(null);
              void saveProfile({ displayName: displayName.trim() || null })
                .then(() => {
                  setMessage("Profile saved");
                  setEditingName(false);
                })
                .catch((err) =>
                  setError(err instanceof Error ? err.message : "Could not save profile"),
                );
            }}
          >
            <label className="field">
              <span>Name</span>
              <input
                value={displayName}
                maxLength={80}
                onChange={(event) => setDisplayName(event.target.value)}
                placeholder="Your name"
              />
            </label>
            <button
              type="submit"
              className="cta"
              disabled={displayName.trim() === (user?.displayName ?? "").trim()}
            >
              Save
            </button>
          </form>
        ) : null}
      </section>

      <section className="settings-section">
        <div className="settings-row">
          <div>
            <h3 className="ui-header">Spending categories</h3>
            <p className="meta">
              Rent counts in total spent and stays off the daily chart. Investments, salary, banks, family, and passed-on stay out of spending.
            </p>
          </div>
          <div className="settings-row-end">
            <button
              type="button"
              className="ghost"
              onClick={() => {
                setEditingName(false);
                setEditingLimit(false);
                setEditingPhone(false);
              }}
            >
              View
            </button>
          </div>
        </div>
        <div className="settings-reveal" style={{ marginTop: "1rem" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(10rem, 1fr))", gap: "0.6rem" }}>
            {(data?.categories ?? []).map((category) => (
              <label key={category.slug} style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.85rem" }}>
                <input
                  type="checkbox"
                  defaultChecked={!["banks", "salary", "passed-on", "investments", "self-transfer"].includes(category.slug)}
                  style={{ cursor: "pointer" }}
                  title={`Include ${category.label} in spending`}
                />
                <span>{category.label}</span>
              </label>
            ))}
          </div>
          <p className="meta" style={{ marginTop: "0.75rem", fontSize: "0.75rem" }}>
            Rent is included in total spent and shown as a small label on the daily chart. Investments stay out of both.
          </p>
        </div>
      </section>

      <section className="settings-section">
        <div className="settings-row">
          <div>
            <h3 className="ui-header">Daily limit</h3>
            <p className="meta">
              Cap debit spend per day. Overview uses this as a calm health signal.
            </p>
          </div>
          <div className="settings-row-end">
            <span className="settings-value">
              {dailyLimit != null ? formatInr(dailyLimit) : "Not set"}
            </span>
            <button
              type="button"
              className="ghost"
              onClick={() => setEditingLimit((open) => !open)}
            >
              {editingLimit ? "Close" : "Edit"}
            </button>
          </div>
        </div>
        {editingLimit ? (
          <div className="settings-reveal">
            <DailyLimitForm
              limit={dailyLimit}
              onSave={async (next) => {
                const applied = await saveLimit(next);
                setDailyLimit(applied);
                setEditingLimit(false);
                onChanged?.();
              }}
            />
          </div>
        ) : null}
      </section>

      <section className="settings-section">
        <div className="settings-row">
          <div>
            <h3 className="ui-header">Telegram</h3>
            <p className="meta">
              {telegram
                ? telegramConnectHint(telegram)
                : "Link the mobile number on your Telegram account to this login."}
            </p>
          </div>
          <div className="settings-row-end">
            <span className={`status-pill is-${telegramPill(telegram).tone}`}>
              {telegramPill(telegram).label}
            </span>
            {telegram?.linked ? (
              <button
                type="button"
                className="ghost"
                disabled={telegramBusy}
                onClick={async () => {
                  setTelegramBusy(true);
                  try {
                    setError(null);
                    const next = await api.sendTelegramTest();
                    setTelegram(next);
                    if (next.sent) setMessage("Test message sent. Check Telegram.");
                    else setError("Telegram did not accept the message. Open the bot and tap Start.");
                  } catch (err) {
                    setError(err instanceof Error ? err.message : "Could not send a test message");
                  } finally {
                    setTelegramBusy(false);
                  }
                }}
              >
                Send test
              </button>
            ) : null}
            {telegram?.linked ? (
              <button
                type="button"
                className="ghost"
                onClick={async () => {
                  try {
                    setError(null);
                    const next = await api.unlinkTelegram();
                    setTelegram(next);
                    setPhone("");
                    setCode("");
                    setEditingPhone(false);
                    setMessage("Telegram disconnected");
                  } catch (err) {
                    setError(
                      err instanceof Error ? err.message : "Could not disconnect Telegram",
                    );
                  }
                }}
              >
                Disconnect
              </button>
            ) : telegram?.verify?.codeSent ? null : (
              <button
                type="button"
                className="ghost"
                onClick={() => setEditingPhone((open) => !open)}
              >
                {editingPhone ? "Close" : telegram?.verify ? "Edit" : "Link"}
              </button>
            )}
            {!telegram?.linked &&
            telegram?.verify &&
            !telegram.verify.codeSent &&
            telegram.verify.botUrl ? (
              <a className="ghost" href={telegram.verify.botUrl} target="_blank" rel="noreferrer">
                Open Telegram
              </a>
            ) : null}
          </div>
        </div>
        {!telegram?.linked && editingPhone && !telegram?.verify?.codeSent ? (
          <form
            className="settings-reveal"
            onSubmit={(event) => {
              event.preventDefault();
              setError(null);
              setMessage(null);
              setTelegramBusy(true);
              void api
                .requestTelegramPhone(phone)
                .then((next) => {
                  setTelegram(next);
                  setEditingPhone(false);
                  setMessage(
                    next.verify?.codeSent
                      ? "Code sent on Telegram"
                      : "Open Telegram and tap Share my number",
                  );
                })
                .catch((err) =>
                  setError(err instanceof Error ? err.message : "Could not send a code"),
                )
                .finally(() => setTelegramBusy(false));
            }}
          >
            <label className="field">
              <span>Mobile number on Telegram</span>
              <input
                value={phone}
                inputMode="tel"
                autoComplete="tel"
                maxLength={20}
                placeholder="98765 43210"
                disabled={telegram?.configured === false || telegramBusy}
                onChange={(event) => setPhone(event.target.value)}
              />
            </label>
            <button
              type="submit"
              className="cta"
              disabled={telegram?.configured === false || telegramBusy || phone.trim().length < 8}
            >
              {telegramBusy ? "Sending…" : "Send code"}
            </button>
          </form>
        ) : null}
        {!telegram?.linked && telegram?.verify?.codeSent ? (
          <form
            className="settings-reveal"
            onSubmit={(event) => {
              event.preventDefault();
              setError(null);
              setMessage(null);
              setTelegramBusy(true);
              void api
                .confirmTelegramPhone(code)
                .then((next) => {
                  setTelegram(next);
                  setCode("");
                  setEditingPhone(false);
                  setMessage(next.linked ? "Telegram linked" : "Code not accepted");
                })
                .catch((err) =>
                  setError(err instanceof Error ? err.message : "Could not verify that code"),
                )
                .finally(() => setTelegramBusy(false));
            }}
          >
            <label className="field">
              <span>Code from Telegram</span>
              <input
                value={code}
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                placeholder="6-digit code"
                disabled={telegramBusy}
                onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
              />
            </label>
            <button type="submit" className="cta" disabled={telegramBusy || code.length !== 6}>
              Link account
            </button>
          </form>
        ) : null}
      </section>

      <section className="settings-section">
        <div className="settings-row">
          <div>
            <h3 className="ui-header">Gmail</h3>
            <p className="meta">
              {gmail?.connected
                ? gmail.email
                  ? `Reading bank mail for ${gmail.email}.`
                  : "Bank mail is connected."
                : "Connect Gmail on Import to scan bank mail. Turn on email alerts for transactions in your bank app first."}
            </p>
          </div>
          <div className="settings-row-end">
            <span className={`status-pill ${gmail?.connected ? "is-on" : "is-off"}`}>
              {gmail?.connected ? "Connected" : "Not connected"}
            </span>
            <Link href={pathForView("import")} className="ghost">
              {gmail?.connected ? "Manage" : "Connect"}
            </Link>
          </div>
        </div>
      </section>

      {rules.some((rule) => !rule.setPayeeName) ? (
        <section className="settings-section">
          <h3 className="ui-header">Other rules</h3>
          <p className="meta">People are added on the People page.</p>
          <ul className="upi-list" style={{ marginTop: "1rem", maxHeight: 180 }}>
            {rules
              .filter((rule) => !rule.setPayeeName)
              .map((rule) => (
                <li key={String(rule.id)} className="upi-row">
                  <span className="upi-rank">rule</span>
                  <div className="upi-meta">
                    <strong>{String(rule.name)}</strong>
                    <span className="meta">
                      {String(rule.setCategorySlug || "custom")} · {ruleMatchLabel(rule)}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="ghost"
                    disabled={removingRuleId === String(rule.id)}
                    onClick={async () => {
                      const id = String(rule.id);
                      if (
                        !window.confirm(
                          `Remove the rule "${String(rule.name)}"? Transactions it already sorted keep their category.`,
                        )
                      ) {
                        return;
                      }
                      setRemovingRuleId(id);
                      setError(null);
                      try {
                        await api.deleteRule(id);
                        await refresh();
                        setMessage(`Removed "${String(rule.name)}".`);
                      } catch (err) {
                        setError(err instanceof Error ? err.message : "Could not remove that rule. Try again.");
                      } finally {
                        setRemovingRuleId(null);
                      }
                    }}
                  >
                    {removingRuleId === String(rule.id) ? "Removing…" : "Remove"}
                  </button>
                </li>
              ))}
          </ul>
        </section>
      ) : null}

      <section className="settings-section">
        <h3 className="ui-header">Account</h3>
        <p className="meta">Session and privacy controls.</p>
        <div className="settings-actions">
          <button
            type="button"
            className="ghost"
            disabled={exporting}
            onClick={() => void downloadCsv()}
          >
            {exporting ? "Preparing file…" : "Download all transactions (CSV)"}
          </button>
          <button
            type="button"
            className="ghost"
            onClick={async () => {
              if (
                !confirm(
                  "Delete every imported transaction and mail record? Your account and Gmail stay. Download a copy first if you may want it later.",
                )
              ) {
                return;
              }
              try {
                setError(null);
                const result = await api.clearImportedData();
                setMessage(
                  `Removed ${result.deleted.transactions} transactions from this account.`,
                );
                onChanged?.();
              } catch (err) {
                setError(
                  err instanceof Error ? err.message : "Could not clear data",
                );
              }
            }}
          >
            Clear imported data
          </button>
          <button type="button" className="ghost" onClick={logout}>
            Log out
          </button>
          <Link href="/privacy" className="ghost">
            Privacy policy
          </Link>
          <button
            type="button"
            className="ghost"
            onClick={() => setShowDanger((v) => !v)}
          >
            {showDanger ? "Hide delete options" : "Delete account…"}
          </button>
        </div>
        {showDanger ? (
          <div
            className="import-privacy"
            style={{
              marginTop: "0.85rem",
              background: "var(--danger-soft)",
              color: "var(--danger)",
            }}
          >
            <p className="meta" style={{ color: "inherit", marginBottom: "0.65rem" }}>
              This permanently deletes your account and financial data. It cannot be undone.
              Download your transactions first if you want a copy.
            </p>
            <button
              type="button"
              className="ghost"
              onClick={async () => {
                if (!confirm("Delete your account and all financial data? This cannot be undone.")) return;
                try {
                  setError(null);
                  await destroyAccount();
                } catch (err) {
                  setError(
                    err instanceof Error ? err.message : "Could not delete the account. Try again.",
                  );
                }
              }}
            >
              Confirm delete account
            </button>
          </div>
        ) : null}
      </section>
    </div>
  );
}
