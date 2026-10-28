import Link from "next/link";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteNav } from "@/components/SiteNav";

/** On the public website, app pages explain that the app runs on your own computer. */
export function SiteOnlyNotice() {
  return (
    <div className="site">
      <div className="site-frame">
        <SiteNav />
      </div>
      <main id="main" className="site-frame site-doc">
        <header className="site-doc-head">
          <h1 className="site-display site-display-sm">This page opens on your own computer</h1>
          <p className="site-lede">
            You are on the Ledgerline website. Your ledger is not here: Ledgerline runs on your
            computer and keeps your data there. Install it, then open this page at
            http://localhost:3000.
          </p>
          <div className="site-actions">
            <Link className="cta site-primary" href="/install">
              Install Ledgerline
            </Link>
            <Link className="ghost" href="/">
              What is Ledgerline?
            </Link>
          </div>
        </header>
      </main>
      <div className="site-frame">
        <SiteFooter />
      </div>
    </div>
  );
}
