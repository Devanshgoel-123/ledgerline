"use client";

import Image from "next/image";
import Link from "next/link";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { appConfig, isSiteMode } from "@/lib/config";

export function SiteNav() {
  return (
    <nav className="site-nav" aria-label="Site">
      <Link href="/" className="nav-brand">
        <Image src="/logo.svg" alt="" width={24} height={24} />
        Ledgerline
      </Link>
      <div className="nav-links">
        {isSiteMode ? null : <Link href="/">Open my ledger</Link>}
        <Link href="/install">Install</Link>
        <Link href="/privacy">Privacy</Link>
        <a href={appConfig.repoUrl}>GitHub</a>
        <ThemeToggle />
      </div>
    </nav>
  );
}
