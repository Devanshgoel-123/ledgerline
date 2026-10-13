"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LoginLoading } from "@/components/LoginLoading";
import { LoginPage } from "@/components/LoginPage";
import { OnboardingWelcome } from "@/components/OnboardingWelcome";
import { useAuth } from "@/lib/auth";
import { createApiClient } from "@/lib/api/client";
import { pathForView } from "@/lib/dashboardViews";

export default function HomePage() {
  const { user, token, loading, authError, clearAuthError } = useAuth();
  const router = useRouter();
  const [showWelcome, setShowWelcome] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(true);
  const [demoLoading, setDemoLoading] = useState(false);
  const [demoError, setDemoError] = useState<string | null>(null);

  async function tryDemo() {
    if (!token || demoLoading) return;
    setDemoLoading(true);
    setDemoError(null);
    try {
      await createApiClient(token).loadDemoData();
      router.replace(pathForView("overview"));
    } catch (err) {
      setDemoError(
        err instanceof Error ? err.message : "Could not add sample data. Try again.",
      );
      setDemoLoading(false);
    }
  }

  useEffect(() => {
    if (loading || !user || !token) return;
    let cancelled = false;
    void Promise.resolve().then(async () => {
      try {
        const status = await createApiClient(token).fetchImportStatus();
        if (cancelled) return;
        if (status.hasTransactions) {
          router.replace(pathForView("overview"));
        } else {
          setShowWelcome(true);
          setCheckingStatus(false);
        }
      } catch {
        if (!cancelled) {
          setShowWelcome(true);
          setCheckingStatus(false);
        }
      }
    });
    return () => {
      cancelled = true;
    };
  }, [loading, user, token, router]);

  if (loading) {
    return <LoginLoading />;
  }

  if (!user) {
    return (
      <LoginPage
        authError={authError}
        onContinue={clearAuthError}
      />
    );
  }

  if (checkingStatus) {
    return <LoginLoading text="Opening your ledger…" />;
  }

  if (showWelcome) {
    return (
      <OnboardingWelcome
        onStartImport={() => router.push(`${pathForView("import")}?start=1`)}
        onTryDemo={() => void tryDemo()}
        demoLoading={demoLoading}
        error={demoError}
      />
    );
  }

  return <LoginLoading text="Opening your ledger…" />;
}
