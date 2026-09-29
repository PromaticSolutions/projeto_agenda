import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/app/dashboard-shell";
import { getMyStudio } from "@/lib/data/studios";
import { getMyLatestSubscription } from "@/lib/data/subscription";
import { bannerFor, describeSubscription } from "@/lib/subscription-state";
import { getStudioPublicUrl } from "@/lib/format";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const studio = await getMyStudio();
  if (!studio) redirect("/app/onboarding");

  const publicUrl = getStudioPublicUrl(studio.slug);

  // Sem leitura possível (modo demonstração, migração pendente): sem aviso.
  const latest = await getMyLatestSubscription(studio.id);
  const billingBanner = latest === undefined ? null : bannerFor(describeSubscription(latest));

  return (
    <DashboardShell studio={studio} publicUrl={publicUrl} billingBanner={billingBanner}>
      {children}
    </DashboardShell>
  );
}
