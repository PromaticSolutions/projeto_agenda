import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/app/dashboard-shell";
import { getMyStudio } from "@/lib/data/studios";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const studio = await getMyStudio();
  if (!studio) redirect("/app/onboarding");

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const publicUrl = `${siteUrl}/${studio.slug}`;

  return (
    <DashboardShell studio={studio} publicUrl={publicUrl}>
      {children}
    </DashboardShell>
  );
}
