"use client";

import { BookOpen, FileUp, Sparkles } from "lucide-react";
import { SpotlightCard } from "@/components/SpotlightCard";
import { appConfig } from "@/lib/config";

interface OnboardingWelcomeProps {
  onStartImport: () => void;
  onTryDemo: () => void;
  /** True while sample data is being added. */
  demoLoading?: boolean;
  error?: string | null;
}

const WHAT_IT_DOES = [
  "Reads UPI transactions from HDFC statement PDFs, or from bank alert emails if you connect Gmail",
  "Sorts spending into categories like food, travel, and shopping",
  "Splits bills with friends so only your share counts",
  "Flags days that go over a daily limit you set",
];

export function OnboardingWelcome({
  onStartImport,
  onTryDemo,
  demoLoading = false,
  error,
}: OnboardingWelcomeProps) {
  return (
    <div className="welcome-screen">
      <div className="welcome-inner">
        <header className="welcome-head">
          <h1 className="login-headline">Welcome to Ledgerline</h1>
          <p className="meta">
            See where your money goes each month. Start with your own statement, or look
            around with sample data first.
          </p>
        </header>

        {error ? (
          <p className="form-error" role="alert">
            {error}
          </p>
        ) : null}

        <div className="welcome-options">
          <button type="button" onClick={onStartImport} className="welcome-option">
            <SpotlightCard className="panel">
              <span className="welcome-icon" aria-hidden>
                <FileUp size={20} />
              </span>
              <span className="welcome-copy">
                <strong>Import your transactions</strong>
                <span className="meta">
                  Upload an HDFC statement PDF, or scan bank alert emails. Takes about a minute.
                </span>
                <span className="welcome-cta">Start here →</span>
              </span>
            </SpotlightCard>
          </button>

          <button
            type="button"
            onClick={onTryDemo}
            className="welcome-option"
            disabled={demoLoading}
            aria-busy={demoLoading}
          >
            <SpotlightCard className="panel">
              <span className="welcome-icon" aria-hidden>
                <Sparkles size={20} />
              </span>
              <span className="welcome-copy">
                <strong>Explore with sample data</strong>
                <span className="meta">
                  Adds a month of made-up transactions, clearly labelled. Remove them in one
                  click whenever you are ready.
                </span>
                <span className="welcome-cta">
                  {demoLoading ? "Adding sample data…" : "Try it →"}
                </span>
              </span>
            </SpotlightCard>
          </button>

          <a
            href={`${appConfig.repoUrl}#readme`}
            target="_blank"
            rel="noreferrer"
            className="welcome-option"
          >
            <SpotlightCard className="panel">
              <span className="welcome-icon" aria-hidden>
                <BookOpen size={20} />
              </span>
              <span className="welcome-copy">
                <strong>Read how it works</strong>
                <span className="meta">
                  The guide covers supported banks, what data is stored, and how to delete it.
                </span>
                <span className="welcome-cta">Open the guide ↗</span>
              </span>
            </SpotlightCard>
          </a>
        </div>

        <section className="welcome-about panel">
          <h2 className="ui-header">What Ledgerline does</h2>
          <ul>
            {WHAT_IT_DOES.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <p className="meta">
            Free and open source. Only you can see your data, and you can delete it any time
            from Settings.
          </p>
        </section>
      </div>
    </div>
  );
}
