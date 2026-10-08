import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/app/dashboard-shell";
import { getMyStudio } from "@/lib/data/studios";
import { getMyLatestSubscription } from "@/lib/data/subscription";
import { bannerFor, describeSubscription } from "@/lib/subscription-state";
import { getStudioPublicUrl } from "@/lib/format";
import { getCurrentActor } from "@/lib/data/salons";
import { homePathFor } from "@/lib/access";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const studio = await getMyStudio();
  /* Quem tem estúdio é atendente e segue pelo caminho de sempre. Sem estúdio,
     antes era onboarding e ponto; agora a gerente também cai aqui — ela não
     tem estúdio por definição — e precisa ir para a área dela em vez de ser
     convidada a criar um. `homePathFor` devolve /app/onboarding para quem não
     é nem uma coisa nem outra, que é o comportamento anterior. */
  if (!studio) {
    const actor = await getCurrentActor();
    redirect(actor ? homePathFor(actor) : "/app/onboarding");
  }

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
