import Link from "next/link";

const FAQ: { q: string; a: React.ReactNode }[] = [
  {
    q: "Is it really free?",
    a: "Yes. Ledgerline is open source under the MIT licence. There is no paid plan, no account and no ads. It runs on your computer, so there is no server for anyone to pay for.",
  },
  {
    q: "Does my data leave my computer?",
    a: (
      <>
        No. Transactions live in a database on your computer, and the Ledgerline service only
        answers requests from your own browser. The one exception is the optional Telegram bot:
        it is off unless you add a bot token, and when it is on, its messages go through
        Telegram. <Link href="/privacy">Read the privacy notes</Link>.
      </>
    ),
  },
  {
    q: "Do I need to sign up?",
    a: "No. There is no sign-in at all. Whoever uses the computer can open Ledgerline, so use it on a computer only you use, or lock your screen.",
  },
  {
    q: "Which banks work?",
    a: "Statement PDFs from HDFC and ICICI. Bank alert emails from HDFC are tested; SBI, ICICI and Axis alerts are early and may miss some payments. For anything else, add payments by hand.",
  },
  {
    q: "What does it miss?",
    a: "UPI Lite payments (your bank shows only the top-up), UPI payments from a RuPay credit card (they are on the card statement), cash, and banks it does not read yet. Add those by hand in Transactions and they count like any other payment.",
  },
  {
    q: "How do I update, back up or remove it?",
    a: (
      <>
        From the Ledgerline folder: <code>./ledgerline update</code> gets the latest version
        and keeps your data, <code>./ledgerline backup</code> saves a copy of your data, and{" "}
        <code>./ledgerline uninstall</code> removes it and asks before deleting your data.
      </>
    ),
  },
  {
    q: "Can I use it on my phone?",
    a: "Not yet. Ledgerline runs on your computer and opens only there. Opening it from a phone on the same Wi‑Fi is not supported by default, because that would let anyone on the network see it.",
  },
  {
    q: "What do I need to run it?",
    a: "A Mac, a Windows PC with WSL, or a Linux computer, with Docker installed. About 3 GB of disk space. Nothing else.",
  },
];

export function SiteFaq() {
  return (
    <div className="site-faq">
      {FAQ.map((item) => (
        <details key={item.q} className="site-faq-item">
          <summary>{item.q}</summary>
          <div className="site-faq-answer">{item.a}</div>
        </details>
      ))}
    </div>
  );
}
