import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/app/dashboard-shell";
import { getMyStudio } from "@/lib/data/studios";
import { getStudioPublicUrl } from "@/lib/format";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const studio = await getMyStudio();
  if (!studio) redirect("/app/onboarding");

  const publicUrl = getStudioPublicUrl(studio.slug);

  return (
    <DashboardShell studio={studio} publicUrl={publicUrl}>
      {children}
    </DashboardShell>
  );
}
