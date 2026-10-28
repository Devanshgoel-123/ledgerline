import type { Metadata } from "next";
import localFont from "next/font/local";
import { ProfileProvider } from "@/lib/profile";
import { ThemeProvider } from "@/lib/theme";
import "./globals.css";

// Fonts ship in the repo (SIL Open Font License, see ./fonts), so a build never
// needs to reach Google Fonts; a failed download used to fail the build.
const inter = localFont({
  src: "./fonts/inter-latin-wght.woff2",
  weight: "100 900",
  variable: "--font-inter",
  display: "swap",
});

const bricolage = localFont({
  src: "./fonts/bricolage-grotesque-latin-wght.woff2",
  weight: "200 800",
  variable: "--font-bricolage",
  display: "swap",
});

const jetbrains = localFont({
  src: [
    { path: "./fonts/jetbrains-mono-latin-400.woff2", weight: "400" },
    { path: "./fonts/jetbrains-mono-latin-500.woff2", weight: "500" },
  ],
  variable: "--font-jetbrains",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Ledgerline: your UPI spending, sorted on your own computer",
    template: "%s · Ledgerline",
  },
  description:
    "Free, open-source expense tracker for UPI in India. Reads HDFC and ICICI statements and bank alert emails, sorts every payment, and runs entirely on your own computer. No account, no tracking.",
  applicationName: "Ledgerline",
  openGraph: {
    title: "Ledgerline",
    description:
      "See where your UPI money went. Runs on your own computer: no account, and your bank data never leaves it.",
    type: "website",
    locale: "en_IN",
    siteName: "Ledgerline",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      data-theme="light"
      suppressHydrationWarning
      // Font variables live on <html> so the :root tokens (--font-mono etc.) can resolve them.
      className={`${inter.variable} ${bricolage.variable} ${jetbrains.variable}`}
    >
      <body
        className={inter.className}
      >
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('ledgerline_theme');if(t==='light'||t==='dark'){document.documentElement.dataset.theme=t;document.documentElement.style.colorScheme=t;}else if(window.matchMedia('(prefers-color-scheme: dark)').matches){document.documentElement.dataset.theme='dark';document.documentElement.style.colorScheme='dark';}}catch(e){}})();`,
          }}
        />
        <ThemeProvider>
          <ProfileProvider>{children}</ProfileProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
