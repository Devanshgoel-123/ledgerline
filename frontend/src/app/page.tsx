"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LoadingScreen } from "@/components/LoadingScreen";
import { LocalGate } from "@/components/LocalGate";
import { OnboardingWelcome } from "@/components/OnboardingWelcome";
import { createApiClient } from "@/lib/api/client";
import { pathForView } from "@/lib/dashboardViews";

function Home() {
  const router = useRouter();
  const [showWelcome, setShowWelcome] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);
  const [demoError, setDemoError] = useState<string | null>(null);

  async function tryDemo() {
    if (demoLoading) return;
    setDemoLoading(true);
    setDemoError(null);
    try {
      await createApiClient().loadDemoData();
      router.replace(pathForView("overview"));
    } catch (err) {
      setDemoError(err instanceof Error ? err.message : "Could not add sample data. Try again.");
      setDemoLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    void createApiClient()
      .fetchImportStatus()
      .then((status) => {
        if (cancelled) return;
        if (status.hasTransactions) router.replace(pathForView("overview"));
        else setShowWelcome(true);
      })
      .catch(() => {
        if (!cancelled) setShowWelcome(true);
      });
    return () => {
      cancelled = true;
    };
  }, [router]);

  if (!showWelcome) return <LoadingScreen />;

  return (
    <OnboardingWelcome
      onStartImport={() => router.push(`${pathForView("import")}?start=1`)}
      onTryDemo={() => void tryDemo()}
      demoLoading={demoLoading}
      error={demoError}
    />
  );
}

export default function HomePage() {
  return (
    <LocalGate>
      <Home />
    </LocalGate>
  );
}
