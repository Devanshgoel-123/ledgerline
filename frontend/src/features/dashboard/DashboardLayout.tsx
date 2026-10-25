"use client";

import { useCallback, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { LocalGate } from "@/components/LocalGate";
import { AppShell } from "@/components/layout/AppShell";
import { SampleDataBanner } from "@/components/SampleDataBanner";
import { ImportNotice } from "@/components/ImportNotice";
import { DashboardProvider, useDashboard } from "@/lib/dashboard-context";
import { currentMonth } from "@/helpers/month";
import { monthsInPoolingWindow } from "@/constants/pooling";
import {
  DATA_OPTIONAL_VIEWS,
  pathForView,
  viewFromPath,
  type DashboardView,
} from "@/lib/dashboardViews";
import { useProfile } from "@/lib/profile";

function DashboardLayoutInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { profile } = useProfile();
  const {
    month,
    setMonth,
    hasAnyData,
    fetchError,
    importStatus,
    fetching,
    scanWindow,
  } = useDashboard();
  const windowMonths = monthsInPoolingWindow();
  const monthMin = windowMonths[0] ?? scanWindow.from.slice(0, 7);
  const monthMax =
    windowMonths[windowMonths.length - 1] ?? scanWindow.to.slice(0, 7);

  const view = viewFromPath(pathname) ?? "overview";

  // First-run: keep empty accounts on Import (and Settings / Daily Limit).
  useEffect(() => {
    if (fetching && importStatus === null) return;
    if (hasAnyData) return;
    if (DATA_OPTIONAL_VIEWS.includes(view)) return;
    router.replace(pathForView("import"));
  }, [fetching, importStatus, hasAnyData, view, router]);

  const navigate = useCallback(
    (next: DashboardView) => {
      if (!hasAnyData && !DATA_OPTIONAL_VIEWS.includes(next)) {
        router.push(pathForView("import"));
        return;
      }
      router.push(pathForView(next));
    },
    [router, hasAnyData],
  );

  const monthControl = (
    <label className="field field-inline month-control">
      <span className="sr-only">Month</span>
      <input
        type="month"
        aria-label="Month"
        min={monthMin}
        max={monthMax}
        value={month}
        onChange={(e) => setMonth(e.target.value || currentMonth())}
      />
    </label>
  );

  return (
    <AppShell
      view={view}
      onNavigate={navigate}
      monthControl={monthControl}
      hasAnyData={hasAnyData}
      displayName={profile?.displayName}
      avatarUrl={profile?.avatarUrl}
      fetchError={DATA_OPTIONAL_VIEWS.includes(view) ? fetchError : null}
    >
      <SampleDataBanner />
      <ImportNotice />
      {children}
    </AppShell>
  );
}

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <LocalGate>
      <DashboardProvider>
        <DashboardLayoutInner>{children}</DashboardLayoutInner>
      </DashboardProvider>
    </LocalGate>
  );
}
