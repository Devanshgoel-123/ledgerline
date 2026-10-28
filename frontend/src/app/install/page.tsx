import type { Metadata } from "next";
import { InstallGuide } from "@/features/site/InstallGuide";

export const metadata: Metadata = {
  title: "Install",
  description:
    "Install Ledgerline on macOS, Windows (WSL) or Linux with one command, then update, back up, remove it, or fix common problems.",
};

export default function InstallPage() {
  return <InstallGuide />;
}
