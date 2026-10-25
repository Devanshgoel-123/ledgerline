"use client";

import { LoadingScreen } from "@/components/LoadingScreen";
import { useProfile } from "@/lib/profile";

/** Shows the app once the Ledgerline API on this computer answers; otherwise says how to start it. */
export function LocalGate({ children }: { children: React.ReactNode }) {
  const { profile, loading, error, retry } = useProfile();

  if (profile) return <>{children}</>;
  if (loading) return <LoadingScreen />;

  return (
    <main className="login-screen">
      <div className="login-screen-bg" aria-hidden />
      <section className="login-loading-card api-down" aria-labelledby="api-down-title">
        <p className="brand compact">Ledgerline</p>
        <h1 id="api-down-title" className="ui-header">Ledgerline is not running</h1>
        <p className="meta">
          This page talks to the Ledgerline service on your own computer, and it did not answer.
          In the folder where you installed Ledgerline, run:
        </p>
        <pre className="api-down-command">
          <code>./ledgerline start</code>
        </pre>
        <p className="meta">
          Already running? <code>./ledgerline status</code> shows what is wrong, and{" "}
          <code>./ledgerline logs</code> shows the details.
        </p>
        {error ? <p className="meta api-down-detail">{error}</p> : null}
        <button type="button" className="cta" onClick={retry}>
          Try again
        </button>
      </section>
    </main>
  );
}
