"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";
import { useDashboard } from "@/lib/dashboard-context";
import { useApi } from "@/lib/useApi";

/** Shown while demo rows are in the ledger, so samples are never mistaken for real spending. */
export function SampleDataBanner() {
  const api = useApi();
  const { importStatus, refresh, refreshStatus } = useDashboard();
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const samples = importStatus?.sampleCount ?? 0;
  if (!api || samples === 0) return null;

  async function remove() {
    if (!api || removing) return;
    setRemoving(true);
    setError(null);
    try {
      await api.removeDemoData();
      await refreshStatus();
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not remove sample data. Try again.");
    } finally {
      setRemoving(false);
    }
  }

  return (
    <div className="sample-banner" role="status">
      <Sparkles size={16} aria-hidden />
      <p>
        <strong>You are looking at sample data.</strong> These {samples} transactions are
        made up so you can explore. Your real imports are kept separate.
      </p>
      <button type="button" className="ghost" onClick={() => void remove()} disabled={removing}>
        {removing ? "Removing…" : "Remove sample data"}
      </button>
      {error ? <p className="form-error">{error}</p> : null}
    </div>
  );
}
