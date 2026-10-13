import type { Metadata } from "next";
import { AppSurfaceBackdrop } from "@/components/effects/AppSurfaceBackdrop";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteNav } from "@/components/SiteNav";

export const metadata: Metadata = {
  title: "Privacy policy — Ledgerline",
  description:
    "What Ledgerline stores, what Gmail access it asks for, and how to download or delete your data.",
};

const SECTIONS = [
  {
    title: "What Ledgerline is",
    body: "Ledgerline is a free, open-source dashboard for your UPI spending. You import bank statements or bank alert emails, and it shows where your money went each month. Only you can see your data.",
  },
  {
    title: "Signing in",
    body: "You can sign in with an email and password, or with Google. With an email and password we store your email and a scrambled (hashed) copy of the password, never the password itself. With Google we store the email and name Google returns. Either way you stay signed in for up to 7 days on that device.",
  },
  {
    title: "Gmail access",
    body: "Signing in with Google also asks for read-only Gmail access, so Ledgerline can find bank alert and statement emails. It only searches mail from the bank addresses you choose, and it never sends, deletes, or changes mail. If you do not want this, sign in with an email and password instead and upload statement PDFs yourself. You can disconnect Gmail at any time in Settings.",
  },
  {
    title: "What we store",
    body: "The transactions we read (date, amount, description, UPI ID, merchant, category), your bank setup and chosen sender addresses, rules and people you add, bill splits, an optional daily limit, and an optional profile photo. For Gmail we keep a refresh token, encrypted, and when it last synced. Statement PDFs are read and then discarded: we keep only a fingerprint of each file so the same statement is not imported twice. Statement passwords are used once and never saved.",
  },
  {
    title: "Telegram (optional)",
    body: "If you link the Telegram bot, we store your Telegram chat ID and, if you verify it, your mobile number, so the bot can send reminders and receive PDFs you forward. Unlinking in Settings removes both the chat link and the number.",
  },
  {
    title: "Who else handles your data",
    body: "Google, if you connect Gmail; Telegram, if you link the bot; and the hosting and database providers that run Ledgerline. We do not sell your data, show ads, or share it with anyone for marketing.",
  },
  {
    title: "Taking your data with you",
    body: "Settings → Download all transactions gives you every transaction as a CSV file you can open in Excel or Google Sheets.",
  },
  {
    title: "Deleting your data",
    body: "Settings lets you clear imported transactions, or delete your account. Deleting the account removes your transactions, imports, rules, Gmail and Telegram links, profile, and phone number, and signs you out everywhere. Server logs keep short records of security events such as sign-ins, which can include your email address.",
  },
  {
    title: "Security",
    body: "Traffic is encrypted, every request checks your session, and Gmail tokens are encrypted at rest. Ledgerline is not a bank and cannot move money. Treat statement PDFs as sensitive.",
  },
  {
    title: "Questions",
    body: "Ledgerline is open source. Ask questions or report a problem by opening an issue on the project's GitHub page. Last updated 11 October 2026.",
  },
];

export default function PrivacyPage() {
  return (
    <main className="shell privacy-page">
      <AppSurfaceBackdrop />
      <SiteNav />
      <article className="legal-doc">
        <header className="arch-hero">
          <p className="brand compact">Ledgerline</p>
          <h1>Privacy policy</h1>
          <p className="lede">
            What Ledgerline stores, what it asks Google for, and how to take your
            data with you or delete it.
          </p>
        </header>
        {SECTIONS.map((section) => (
          <section key={section.title} className="panel legal-section">
            <h2 className="ui-header">{section.title}</h2>
            <p className="legal-copy">{section.body}</p>
          </section>
        ))}
      </article>
      <SiteFooter />
    </main>
  );
}
