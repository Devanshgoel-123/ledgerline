import { SiteFooter } from "@/components/SiteFooter";
import { SiteNav } from "@/components/SiteNav";
import { CopyCommand } from "./CopyCommand";
import { InstallTabs } from "./InstallTabs";
import { EVERYDAY_COMMANDS, FIRST_RUN_STEPS, LOCAL_URL, REPO_URL } from "./installContent";

const TROUBLE: { title: string; body: React.ReactNode; commands?: string[] }[] = [
  {
    title: "“Docker is not running”",
    body: "Open Docker Desktop and wait until it says it is running, then run ./ledgerline start again. On Linux, start the service:",
    commands: ["sudo systemctl start docker"],
  },
  {
    title: "“permission denied” when running ./ledgerline",
    body: "The file lost its run permission, usually after unzipping. Give it back, then start again:",
    commands: ["chmod +x ledgerline", "./ledgerline start"],
  },
  {
    title: "Port 3000 or 4000 is already in use",
    body: "Another program is using a port Ledgerline needs. Either quit that program, or give Ledgerline other ports: open the .env file in the Ledgerline folder, set WEB_PORT (and API_PORT) to free numbers, then start again. Ledgerline then opens at the new port.",
    commands: ["lsof -nP -iTCP:3000 -sTCP:LISTEN", "echo WEB_PORT=3001 >> .env", "./ledgerline start"],
  },
  {
    title: "The page says “Ledgerline is not running”",
    body: "The web page loaded but the service behind it did not answer. Check each part, then start it again:",
    commands: ["./ledgerline status", "./ledgerline start"],
  },
  {
    title: "Something else went wrong",
    body: (
      <>
        Look at what Ledgerline is doing. When you ask for help, copy the last lines, and check
        them first for anything personal. <a href={`${REPO_URL}/issues`}>Open an issue on GitHub</a>.
      </>
    ),
    commands: ["./ledgerline logs"],
  },
];

export function InstallGuide() {
  return (
    <div className="site">
      <a className="site-skip" href="#main">
        Skip to content
      </a>
      <div className="site-frame">
        <SiteNav />
      </div>
      <main id="main" className="site-frame site-doc">
        <header className="site-doc-head">
          <h1 className="site-display site-display-sm">Install Ledgerline</h1>
          <p className="site-lede">
            Ledgerline runs on your own computer inside Docker. One command sets it up: it makes
            its own keys, starts its database, and opens in your browser. Nothing to sign up for.
          </p>
        </header>

        <nav className="site-toc" aria-label="On this page">
          <a href="#get">Get it</a>
          <a href="#first-run">First run</a>
          <a href="#everyday">Everyday commands</a>
          <a href="#data">Updates and backups</a>
          <a href="#remove">Removing it</a>
          <a href="#trouble">Troubleshooting</a>
        </nav>

        <section id="get" className="site-section" aria-labelledby="get-title">
          <h2 id="get-title" className="site-h2">Get it</h2>
          <InstallTabs />
        </section>

        <section id="first-run" className="site-section" aria-labelledby="first-run-title">
          <h2 id="first-run-title" className="site-h2">What happens the first time</h2>
          <ol className="site-steps">
            {FIRST_RUN_STEPS.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
          <p className="site-small">
            Then Ledgerline welcomes you. Import a statement PDF, connect bank mail, or look
            around with sample data first. You can come back any time at{" "}
            <a href={LOCAL_URL}>{LOCAL_URL}</a> while it is running.
          </p>
        </section>

        <section id="everyday" className="site-section" aria-labelledby="everyday-title">
          <h2 id="everyday-title" className="site-h2">Everyday commands</h2>
          <p className="site-small">
            Run these in a terminal from the Ledgerline folder (<code>cd ~/ledgerline</code> if
            you used the one-line install). Ledgerline keeps running in the background until you
            stop it or restart your computer; after a restart, run <code>./ledgerline start</code>.
          </p>
          <table className="site-table">
            <caption className="sr-only">Ledgerline commands</caption>
            <thead>
              <tr>
                <th scope="col">Command</th>
                <th scope="col">What it does</th>
              </tr>
            </thead>
            <tbody>
              {EVERYDAY_COMMANDS.map((row) => (
                <tr key={row.command}>
                  <td>
                    <code>{row.command}</code>
                  </td>
                  <td>{row.does}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section id="data" className="site-section" aria-labelledby="data-title">
          <h2 id="data-title" className="site-h2">Updates and backups</h2>
          <p className="site-intro">
            Updating downloads the latest version, rebuilds it and restarts. Your transactions,
            rules and settings stay.
          </p>
          <CopyCommand commands={["./ledgerline update"]} label="Update Ledgerline" />
          <p className="site-intro">
            A backup is a single file in the backups folder. Keep a copy somewhere safe, such as
            an encrypted drive; it holds your financial history.
          </p>
          <CopyCommand commands={["./ledgerline backup"]} label="Back up your data" />
          <p className="site-small">
            To put a backup back, run <code>./ledgerline restore backups/</code> followed by the
            file name.
          </p>
        </section>

        <section id="remove" className="site-section" aria-labelledby="remove-title">
          <h2 id="remove-title" className="site-h2">Removing it</h2>
          <p className="site-intro">
            This stops Ledgerline and removes what it installed in Docker. It asks before deleting
            your data, so you can keep it for later. Delete the Ledgerline folder afterwards if you
            want it gone completely.
          </p>
          <CopyCommand commands={["./ledgerline uninstall"]} label="Remove Ledgerline" />
        </section>

        <section id="trouble" className="site-section" aria-labelledby="trouble-title">
          <h2 id="trouble-title" className="site-h2">Troubleshooting</h2>
          <div className="site-trouble">
            {TROUBLE.map((item) => (
              <section key={item.title} className="site-trouble-item" aria-label={item.title}>
                <h3 className="site-subhead">{item.title}</h3>
                <p className="site-small">{item.body}</p>
                {item.commands ? <CopyCommand commands={item.commands} label={item.title} /> : null}
              </section>
            ))}
          </div>
        </section>
      </main>
      <div className="site-frame">
        <SiteFooter />
      </div>
    </div>
  );
}
