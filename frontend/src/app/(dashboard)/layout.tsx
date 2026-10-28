import { SiteOnlyNotice } from "@/components/SiteOnlyNotice";
import { DashboardLayout } from "@/features/dashboard/DashboardLayout";
import { isSiteMode } from "@/lib/config";

export default function DashboardRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // The public website has no API behind it; never mount pages that would call one.
  if (isSiteMode) return <SiteOnlyNotice />;
  return <DashboardLayout>{children}</DashboardLayout>;
}
