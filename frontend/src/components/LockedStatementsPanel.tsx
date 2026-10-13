"use client";

import { useEffect, useState, type FormEvent } from "react";
import { KeyRound } from "lucide-react";
import { Panel, PanelHead } from "@/components/ui/Panel";
import { formatShortDate } from "@/helpers/dates";
import { useApi } from "@/lib/useApi";

interface LockedStatement {
  id: string;
  filename: string | null;
  foundAt: string;
}

/**
 * Bank statements found in Gmail are usually password-protected. Scans cannot open them on
 * their own, so they wait here until the user types the password once.
 */
export function LockedStatementsPanel({
  scanning,
  onImported,
}: {
  scanning: boolean;
  onImported: () => void;
}) {
  const api = useApi();
  const [statements, setStatements] = useState<LockedStatement[]>([]);

  // Reload after each scan finishes, since a scan is what finds locked statements.
  useEffect(() => {
    if (!api || scanning) return;
    let cancelled = false;
    void Promise.resolve().then(async () => {
      try {
        const res = await api.listLockedStatements();
        if (!cancelled) setStatements(res.statements);
      } catch {
        // Optional panel: if the list cannot load, the rest of Import still works.
      }
    });
    return () => {
      cancelled = true;
    };
  }, [api, scanning]);

  if (statements.length === 0) return null;

  return (
    <Panel>
      <PanelHead
        title="Statements waiting for a password"
        subtitle="We found these in your bank mail but they are locked. Enter each password once to import it. We do not save the password."
      />
      <ul className="locked-statements">
        {statements.map((statement) => (
          <LockedStatementRow
            key={statement.id}
            statement={statement}
            onDone={() => {
              setStatements((rows) => rows.filter((row) => row.id !== statement.id));
              onImported();
            }}
          />
        ))}
      </ul>
    </Panel>
  );
}

function LockedStatementRow({
  statement,
  onDone,
}: {
  statement: LockedStatement;
  onDone: () => void;
}) {
  const api = useApi();
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const inputId = `unlock-${statement.id}`;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!api || busy || !password) return;
    setBusy(true);
    setError(null);
    try {
      const res = await api.unlockStatement(statement.id, password);
      setResult(
        res.inserted > 0
          ? `Imported ${res.inserted} new transaction${res.inserted === 1 ? "" : "s"}.`
          : "Imported. Everything in it was already in your ledger.",
      );
      setPassword("");
      window.setTimeout(onDone, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not open this statement. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="locked-statement">
      <div className="locked-statement-name">
        <KeyRound size={14} aria-hidden />
        <span>
          <strong>{statement.filename ?? "Bank statement"}</strong>
          <small className="meta">Found {formatShortDate(statement.foundAt.slice(0, 10))}</small>
        </span>
      </div>
      {result ? (
        <p className="meta" role="status">
          {result}
        </p>
      ) : (
        <form className="locked-statement-form" onSubmit={submit}>
          <label className="sr-only" htmlFor={inputId}>
            Password for {statement.filename ?? "this statement"}
          </label>
          <input
            id={inputId}
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Statement password (HDFC: customer ID)"
            autoComplete="off"
            disabled={busy}
          />
          <button type="submit" className="cta" disabled={busy || !password}>
            {busy ? "Opening…" : "Unlock"}
          </button>
        </form>
      )}
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
    </li>
  );
}
