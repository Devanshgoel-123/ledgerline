"use client";

import { CheckCircle2, X } from "lucide-react";
import { useDashboard } from "@/lib/dashboard-context";

/** Says what the last statement upload did, so a repeat upload never looks like nothing happened. */
export function ImportNotice() {
  const { importNotice, clearImportNotice } = useDashboard();
  if (!importNotice) return null;
  return (
    <div className="import-notice" role="status">
      <CheckCircle2 size={16} aria-hidden />
      <p>{importNotice}</p>
      <button type="button" className="ghost" onClick={clearImportNotice} aria-label="Dismiss">
        <X size={14} aria-hidden />
      </button>
    </div>
  );
}
