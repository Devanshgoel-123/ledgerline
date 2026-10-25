import { LocalHome } from "@/components/LocalHome";
import { LandingPage } from "@/features/site/LandingPage";
import { isSiteMode } from "@/lib/config";

/** The public website shows the landing page; a local install opens the ledger. */
export default function HomePage() {
  return isSiteMode ? <LandingPage /> : <LocalHome />;
}
