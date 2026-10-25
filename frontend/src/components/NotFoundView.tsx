"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { AppSurfaceBackdrop } from "@/components/effects/AppSurfaceBackdrop";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteNav } from "@/components/SiteNav";
import { easeOut } from "@/lib/motion";

export function NotFoundView() {
  return (
    <main className="shell not-found-page">
      <AppSurfaceBackdrop />
      <SiteNav />
      <div className="landing-content not-found-content">
        <motion.p
          className="badge-pill"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: easeOut }}
        >
          Lost in the ledger
        </motion.p>
        <div className="not-found-digits" aria-hidden>
          {"404".split("").map((digit, i) => (
            <motion.span
              key={`${digit}-${i}`}
              className="not-found-digit"
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.08 * i, duration: 0.6, ease: easeOut }}
            >
              {digit}
            </motion.span>
          ))}
        </div>
        <h1 className="sr-only">Page not found</h1>
        <motion.h2
          className="hero-title not-found-title"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.28, duration: 0.45, ease: easeOut }}
        >
          This page wandered off.
        </motion.h2>
        <motion.p
          className="lede"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.36, duration: 0.45, ease: easeOut }}
        >
          There is no page at this address. Go back to the start, or open the
          install guide.
        </motion.p>
        <motion.div
          className="hero-actions not-found-actions"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.44, duration: 0.45, ease: easeOut }}
        >
          <Link className="cta" href="/">
            Go to the start
          </Link>
          <Link className="ghost" href="/install">
            Install guide
          </Link>
        </motion.div>
      </div>
      <SiteFooter />
    </main>
  );
}
