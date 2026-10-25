import Link from "next/link";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteNav } from "@/components/SiteNav";
import { InstallTabs } from "./InstallTabs";
import { LedgerSpecimen } from "./LedgerSpecimen";
import { SiteFaq } from "./SiteFaq";
import { EVERYDAY_COMMANDS, FIRST_RUN_STEPS, REPO_URL } from "./installContent";

const SOURCES = [
  {
    title: "Statement PDFs",
    body: "HDFC and ICICI. Locked PDFs are fine: the password is used once and never saved. Every line is checked against the running balance before it is added.",
  },
  {
    title: "Bank alert emails, if you want them",
    body: "Connect your mailbox with an app password. Ledgerline reads only mail from your bank’s addresses and never changes your mailbox. HDFC alerts are tested; SBI, ICICI and Axis are early.",
  },
  {
    title: "Payments you add",
    body: "Cash, UPI Lite, a bank Ledgerline does not read yet. Type them in and they count like everything else.",
  },
];

const VIEWS = [
  { title: "Overview", body: "Money out, money in, your daily average, and the days you went over a limit you set." },
  { title: "Lifestyle", body: "Spending by category. Open one to see exactly who or what it went to." },
  { title: "Apps", body: "Every app and shop you paid this month, with its UPI IDs." },
  { title: "People", body: "Money you sent to and got from people, kept apart from shopping." },
  { title: "Transactions", body: "Search, fix a category once and it sticks, split a bill so only your share counts, export to CSV." },
];

const GAPS = [
  { title: "UPI Lite", body: "Your bank shows the top-up, not each small payment." },
  { title: "RuPay credit cards on UPI", body: "These land on your card statement, which Ledgerline does not read yet." },
  { title: "Cash", body: "Nothing records it but you." },
  { title: "Other banks", body: "Statements from banks other than HDFC and ICICI are not read yet." },
];

const PRIVACY = [
  { title: "No account", body: "Nothing to sign up for, no email asked, no password to leak." },
  { title: "Stays on your computer", body: "Your transactions live in a database on your own disk. There is no Ledgerline server." },
  { title: "Answers only you", body: "The Ledgerline service listens only on this computer and refuses requests from other websites." },
  { title: "No tracking", body: "No analytics, no telemetry, on this website or in the app." },
  { title: "Yours to take or erase", body: "Export every transaction to CSV, back up the database, or erase everything in one step." },
];

export function LandingPage() {
  return (
    <div className="site">
      <a className="site-skip" href="#main">
        Skip to content
      </a>
      <div className="site-frame">
        <SiteNav />
      </div>
      <main id="main" className="site-frame">
        <section className="site-hero" aria-labelledby="hero-title">
          <div className="site-hero-copy">
            <h1 id="hero-title" className="site-display">
              Your UPI spending, sorted on your own computer.
            </h1>
            <p className="site-lede">
              Ledgerline reads your bank statements and alert emails, names each payment, and
              shows your month by category, app and person. It runs on your computer. There is
              no account to create, and nothing is sent to us.
            </p>
            <div className="site-actions">
              <a className="cta site-primary" href="#install">
                Install Ledgerline
              </a>
              <Link className="ghost" href="/privacy">
                How your data stays private
              </Link>
            </div>
            <p className="site-small site-muted">
              Free and open source. Works on macOS, Windows (with WSL) and Linux. Needs Docker.
            </p>
          </div>
          <LedgerSpecimen />
        </section>

        <section className="site-section" aria-labelledby="sources-title">
          <h2 id="sources-title" className="site-h2">What it reads</h2>
          <dl className="site-defs">
            {SOURCES.map((item) => (
              <div key={item.title}>
                <dt>{item.title}</dt>
                <dd>{item.body}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="site-section" aria-labelledby="views-title">
          <h2 id="views-title" className="site-h2">What you see</h2>
          <dl className="site-defs">
            {VIEWS.map((item) => (
              <div key={item.title}>
                <dt>{item.title}</dt>
                <dd>{item.body}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="site-section" aria-labelledby="gaps-title">
          <h2 id="gaps-title" className="site-h2">What it cannot see</h2>
          <p className="site-intro">
            A tracker is only useful if you trust the total. These payments never reach a bank
            statement Ledgerline reads, so add them by hand:
          </p>
          <dl className="site-defs site-defs-compact">
            {GAPS.map((item) => (
              <div key={item.title}>
                <dt>{item.title}</dt>
                <dd>{item.body}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="site-section" aria-labelledby="privacy-title">
          <h2 id="privacy-title" className="site-h2">Private because there is nowhere else for it to go</h2>
          <dl className="site-defs">
            {PRIVACY.map((item) => (
              <div key={item.title}>
                <dt>{item.title}</dt>
                <dd>{item.body}</dd>
              </div>
            ))}
          </dl>
          <p className="site-small">
            One exception: the optional Telegram bot sends reminders through Telegram. It is off
            unless you turn it on. <Link href="/privacy">Read the privacy notes</Link>.
          </p>
        </section>

        <section id="install" className="site-section site-install" aria-labelledby="install-title">
          <h2 id="install-title" className="site-h2">Install it</h2>
          <p className="site-intro">
            Every way below ends with the same command, <code>./ledgerline start</code>, which
            sets everything up for you.
          </p>
          <InstallTabs />

          <h3 className="site-subhead">What happens the first time</h3>
          <ol className="site-steps">
            {FIRST_RUN_STEPS.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>

          <h3 className="site-subhead">After that</h3>
          <p className="site-small">
            Run these from the Ledgerline folder. If you used the one-line install, that is the
            ledgerline folder in your home folder (<code>cd ~/ledgerline</code>).
          </p>
          <table className="site-table">
            <caption className="sr-only">Everyday commands</caption>
            <thead>
              <tr>
                <th scope="col">Command</th>
                <th scope="col">What it does</th>
              </tr>
            </thead>
            <tbody>
              {EVERYDAY_COMMANDS.slice(0, 5).map((row) => (
                <tr key={row.command}>
                  <td>
                    <code>{row.command}</code>
                  </td>
                  <td>{row.does}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="site-small">
            Updates, backups, removing it, and fixes for common problems are in the{" "}
            <Link href="/install">full install guide</Link>.
          </p>
        </section>

        <section className="site-section" aria-labelledby="faq-title">
          <h2 id="faq-title" className="site-h2">Questions</h2>
          <SiteFaq />
          <p className="site-small">
            Something else? <a href={`${REPO_URL}/issues`}>Ask on GitHub</a>.
          </p>
        </section>
      </main>
      <div className="site-frame">
        <SiteFooter />
      </div>
    </div>
  );
}
