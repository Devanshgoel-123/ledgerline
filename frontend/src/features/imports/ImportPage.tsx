"use client";

import { useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { LockedStatementsPanel } from "@/components/LockedStatementsPanel";
import { UploadPanel } from "@/components/UploadPanel";
import { ImportReportCard } from "@/components/ImportReportCard";
import { BankPoolingPanel } from "@/components/BankPoolingPanel";
import { OnboardingWelcome } from "@/components/OnboardingWelcome";
import { useDashboard } from "@/lib/dashboard-context";
import { createApiClient } from "@/lib/api/client";
import { LedgerlineFadeContent } from "@/components/animations/LedgerlineFadeContent";
import { Panel, PanelHead } from "@/components/ui/Panel";
import {
  displayScanWindow,
  formatScanWindowLabel,
} from "@/constants/pooling";

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
  const [bannerError, setBannerError] = useState<string | null>(null);
  // Coming from the home welcome screen (?start=1) means the user already chose to import.
  const [showWelcome, setShowWelcome] = useState(() => searchParams.get("start") !== "1");
  const [loadingDemo, setLoadingDemo] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const windowLabel = formatScanWindowLabel(displayScanWindow());
  const handleTryDemo = async () => {
    if (loadingDemo) return;
    setLoadingDemo(true);
    try {
      const client = createApiClient();
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
          <h2 className="month-label">Statements and bank mail</h2>
          <p className="meta mt-1.5">
            Start with a statement PDF. Connecting your bank&apos;s alert emails is
            optional; it adds new payments for {windowLabel}.
          </p>
        </header>
      </LedgerlineFadeContent>

      {successMessage ? (
        <p className="meta" style={{ color: "var(--success)" }} role="status">
          {successMessage}
        </p>
      ) : null}
      {bannerError ? (
        <p className="form-error" role="alert">
          {bannerError}
        </p>
      ) : null}
      <LedgerlineFadeContent delay={40}>
        <Panel>
          <PanelHead
            title="Upload a statement PDF"
            subtitle="HDFC and ICICI statements from net banking. Password-protected is fine; the password is used once and never saved."
          />
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

      <LedgerlineFadeContent delay={80}>
        <BankPoolingPanel
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

      <LedgerlineFadeContent delay={100}>
        <LockedStatementsPanel
          scanning={scanning}
          onImported={() => {
            void refreshStatus();
            refresh();
          }}
        />
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
