import type { Metadata } from "next";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteNav } from "@/components/SiteNav";

export const metadata: Metadata = {
  title: "Privacy",
  description:
    "Ledgerline runs on your own computer. What it stores there, what it reads, the one feature that sends data out, and how to take or erase your data.",
};

const SECTIONS: { title: string; body: React.ReactNode }[] = [
  {
    title: "The short version",
    body: "Ledgerline runs on your computer. There is no Ledgerline server, no account and no tracking. Your transactions never reach us, because there is nowhere for them to go.",
  },
  {
    title: "Where your data lives",
    body: "In a PostgreSQL database inside Docker on your own disk. It holds the payments Ledgerline reads (date, amount, description, UPI ID, merchant, category), the rules, people and bill splits you add, your daily limit, and an optional name and photo. Backups are files in the backups folder, which you control.",
  },
  {
    title: "Who can open it",
    body: "The Ledgerline service listens only on this computer (localhost). It refuses requests addressed to any other name and requests from other websites, so a page you visit cannot read or change your data. There is no sign-in, so anyone using your computer can open Ledgerline: lock your screen when you step away.",
  },
  {
    title: "Statement PDFs",
    body: "Read on your computer and then discarded. Ledgerline keeps a fingerprint of each file so the same statement is not imported twice. Statement passwords are used once and never saved.",
  },
  {
    title: "Bank mail (optional)",
    body: "If you connect your mailbox, Ledgerline signs in to it over IMAP with an app password you create. The app password is stored encrypted on your computer. Ledgerline searches only mail from your bank’s addresses, reads it, and never sends, moves, deletes or marks mail. Disconnect it in Settings at any time; revoke the app password in your email account to be sure.",
  },
  {
    title: "Telegram (optional, the one exception)",
    body: "The Telegram bot is off unless you add a bot token. If you turn it on and link it, reminders and the payments they mention travel through Telegram’s servers, and Ledgerline stores your chat ID and, if you verify it, your mobile number. Unlink it in Settings to remove both.",
  },
  {
    title: "This website",
    body: "The website you are reading only explains Ledgerline and how to install it. It has no analytics, cookies for tracking, forms or sign-up, and it never sees your data.",
  },
  {
    title: "Taking your data with you",
    body: "Settings › Download all transactions gives you every transaction as a CSV file for Excel or Google Sheets. ./ledgerline backup saves the whole database to a file.",
  },
  {
    title: "Erasing your data",
    body: "Settings › Erase everything removes every transaction, rule, mailbox connection and Telegram link, and starts fresh. ./ledgerline uninstall removes Ledgerline and asks before deleting the database.",
  },
  {
    title: "Security notes",
    body: "Ledgerline is not a bank and cannot move money. Your statements and backups are sensitive: keep your computer’s disk encrypted (FileVault, BitLocker or LUKS) and store backups somewhere safe.",
  },
  {
    title: "Questions",
    body: (
      <>
        Ledgerline is open source, so you can check all of this in the code. Ask questions or
        report a problem on <a href="https://github.com/Devanshgoel-123/ledgerline/issues">GitHub</a>.
        Last updated 25 October 2026.
      </>
    ),
  },
];

export default function PrivacyPage() {
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
          <h1 className="site-display site-display-sm">Privacy</h1>
          <p className="site-lede">
            What Ledgerline keeps on your computer, what it reads, the one optional feature that
            sends data out, and how to take your data with you or erase it.
          </p>
        </header>
        <div className="site-doc-sections">
          {SECTIONS.map((section) => (
            <section key={section.title} className="site-doc-section">
              <h2 className="site-def-title">{section.title}</h2>
              <p>{section.body}</p>
            </section>
          ))}
        </div>
      </main>
      <div className="site-frame">
        <SiteFooter />
      </div>
    </div>
  );
}
