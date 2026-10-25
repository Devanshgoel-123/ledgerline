import Link from "next/link";
import { appConfig } from "@/lib/config";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <p className="meta">Ledgerline is free and open source under the MIT licence.</p>
      <nav className="site-footer-links" aria-label="Footer">
        <Link href="/install">Install</Link>
        <Link href="/privacy">Privacy</Link>
        <a href={appConfig.repoUrl}>Source code</a>
      </nav>
    </footer>
  );
}
