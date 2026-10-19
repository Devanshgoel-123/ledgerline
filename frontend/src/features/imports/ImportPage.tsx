"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { FileUp } from "lucide-react";
import { LockedStatementsPanel } from "@/components/LockedStatementsPanel";
import { UploadPanel } from "@/components/UploadPanel";
import { ImportReportCard } from "@/components/ImportReportCard";
import { BankPoolingPanel } from "@/components/BankPoolingPanel";
import { OnboardingWelcome } from "@/components/OnboardingWelcome";
import { useDashboard } from "@/lib/dashboard-context";
import { createApiClient } from "@/lib/api/client";
import { useAuth } from "@/lib/auth";
import { LedgerlineFadeContent } from "@/components/animations/LedgerlineFadeContent";
import { Panel, PanelHead } from "@/components/ui/Panel";
import {
  displayScanWindow,
  formatScanWindowLabel,
} from "@/constants/pooling";

/** Drop the one-time ?gmail= and ?detail= params from the address bar. */
function clearGmailParams(): void {
  const url = new URL(window.location.href);
  if (!url.searchParams.has("gmail") && !url.searchParams.has("detail")) return;
  for (const key of ["gmail", "detail", "pending", "email"]) url.searchParams.delete(key);
  const qs = url.searchParams.toString();
  window.history.replaceState({}, "", `${url.pathname}${qs ? `?${qs}` : ""}`);
}

export function ImportPage() {
  const {
    loading,
    parseError,
    hasAnyData,
    parseStatement,
    refresh,
    refreshStatus,
    goToOverview,
    scanning,
    lastImport,
    clearLastImport,
  } = useDashboard();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { token } = useAuth();
  const [banner, setBanner] = useState<string | null>(null);
  const [bannerError, setBannerError] = useState<string | null>(null);
  // Coming from the home welcome screen (?start=1) means the user already chose to import.
  const [showWelcome, setShowWelcome] = useState(() => searchParams.get("start") !== "1");
  const [loadingDemo, setLoadingDemo] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const windowLabel = formatScanWindowLabel(displayScanWindow());
  // A Google account other than the sign-in email waits for this user to confirm it.
  const [pendingGmail, setPendingGmail] = useState<{ pending: string; email: string } | null>(null);
  const [confirmingGmail, setConfirmingGmail] = useState(false);
  const [gmailVersion, setGmailVersion] = useState(0);

  // The Gmail callback lands here with ?gmail=connected|error. Show it once, while
  // rendering (React's "adjust state on prop change"), then tidy the address bar.
  const paramsKey = searchParams.toString();
  const [seenParams, setSeenParams] = useState<string | null>(null);
  if (paramsKey !== seenParams) {
    setSeenParams(paramsKey);
    const gmail = searchParams.get("gmail");
    if (gmail === "connected") {
      setBanner("Gmail connected. Scan bank mail below.");
      setShowWelcome(false);
    } else if (gmail === "confirm" && searchParams.get("pending")) {
      setPendingGmail({
        pending: searchParams.get("pending") ?? "",
        email: searchParams.get("email") ?? "this Google account",
      });
      setShowWelcome(false);
    } else if (gmail === "error") {
      setBannerError(searchParams.get("detail") ?? "Gmail connection failed. Try again.");
    }
  }
  useEffect(() => {
    clearGmailParams();
  }, [paramsKey]);

  const handleTryDemo = async () => {
    if (!token || loadingDemo) return;
    setLoadingDemo(true);
    try {
      const client = createApiClient(token);
      await client.loadDemoData();
      await refreshStatus();
      refresh();
      router.push("/overview");
    } catch (error) {
      setBannerError(
        error instanceof Error ? error.message : "Could not add sample data. Try again.",
      );
    } finally {
      setLoadingDemo(false);
    }
  };

  if (showWelcome && !hasAnyData) {
    return (
      <OnboardingWelcome
        onStartImport={() => setShowWelcome(false)}
        onTryDemo={() => void handleTryDemo()}
        demoLoading={loadingDemo}
        error={bannerError}
      />
    );
  }

  return (
    <div className="view-stack">
      <LedgerlineFadeContent>
        <header>
          <p className="stat-kicker mb-2">Import</p>
          <h2 className="month-label">Bank mail and statements</h2>
          <p className="meta mt-1.5">
            Scan bank alerts for {windowLabel}. Newest mail first. Overview
            uses the same month.
          </p>
        </header>
      </LedgerlineFadeContent>

      {successMessage ? (
        <p className="meta" style={{ color: "var(--success)" }} role="status">
          {successMessage}
        </p>
      ) : null}
      {banner ? (
        <p className="meta" role="status">
          {banner}
        </p>
      ) : null}
      {bannerError ? (
        <p className="form-error" role="alert">
          {bannerError}
        </p>
      ) : null}
      {pendingGmail ? (
        <div className="settings-reveal" role="alertdialog" aria-label="Confirm Gmail connection">
          <p className="meta">
            Connect <strong>{pendingGmail.email}</strong> to this Ledgerline account? Its bank
            mail will be read into your dashboard. If you did not just start this from
            Ledgerline, choose Cancel.
          </p>
          <div className="settings-row-end">
            <button
              type="button"
              className="cta"
              disabled={confirmingGmail || !token}
              onClick={async () => {
                if (!token) return;
                setConfirmingGmail(true);
                setBannerError(null);
                try {
                  const result = await createApiClient(token).confirmGmail(pendingGmail.pending);
                  setBanner(`Gmail connected (${result.email}). Scan bank mail below.`);
                  setGmailVersion((v) => v + 1);
                  refresh();
                } catch (error) {
                  setBannerError(error instanceof Error ? error.message : "Could not connect Gmail.");
                } finally {
                  setPendingGmail(null);
                  setConfirmingGmail(false);
                }
              }}
            >
              Connect
            </button>
            <button type="button" className="ghost" onClick={() => setPendingGmail(null)}>
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      <LedgerlineFadeContent delay={40}>
        <BankPoolingPanel
          key={gmailVersion}
          onChanged={refresh}
          onImported={(count) => {
            void (async () => {
              await refreshStatus();
              refresh();
              if (count > 0) {
                setSuccessMessage(`✅ Successfully imported ${count} transaction${count === 1 ? "" : "s"}. Redirecting to overview…`);
                setTimeout(() => {
                  goToOverview();
                }, 2000);
              }
            })();
          }}
        />
      </LedgerlineFadeContent>

      <LedgerlineFadeContent delay={60}>
        <LockedStatementsPanel
          scanning={scanning}
          onImported={() => {
            void refreshStatus();
            refresh();
          }}
        />
      </LedgerlineFadeContent>

      <LedgerlineFadeContent delay={80}>
        <Panel>
          <PanelHead
            title="Or upload a statement PDF"
            subtitle="Optional. HDFC and ICICI statements, password-protected is fine."
          />
          <p className="badge-pill inline-flex mb-3">
            <FileUp size={13} /> Upload
          </p>
          <UploadPanel
            onParsed={parseStatement}
            loading={loading}
            error={parseError}
          />
          {lastImport ? (
            <div className="mt-4">
              <ImportReportCard
                report={lastImport}
                onView={() => {
                  clearLastImport();
                  goToOverview();
                }}
                onDismiss={clearLastImport}
              />
            </div>
          ) : null}
        </Panel>
      </LedgerlineFadeContent>

      {hasAnyData && !scanning ? (
        <LedgerlineFadeContent delay={120}>
          <button type="button" className="cta" onClick={goToOverview}>
            Back to Overview
          </button>
        </LedgerlineFadeContent>
      ) : null}
    </div>
  );
}
