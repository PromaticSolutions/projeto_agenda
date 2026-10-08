import { redirect } from "next/navigation";
import { OnboardingChoice } from "@/components/app/onboarding-choice";
import { BrandMark } from "@/components/auth/brand-mark";
import { getMyStudio } from "@/lib/data/studios";
import { getCurrentActor } from "@/lib/data/salons";

export const metadata = { title: "Criar estúdio — Timely" };

export default async function OnboardingPage() {
  const studio = await getMyStudio();
  if (studio) redirect("/app");

  /* A gerente não tem estúdio e chegaria aqui por link direto. Criar um a
     transformaria em atendente de si mesma, com página pública e agenda —
     não é o papel dela. A ação `createStudioAction` recusa pelo mesmo motivo. */
  const actor = await getCurrentActor();
  if (actor?.role === "gerente") redirect("/app/gerencia");

  return (
    <div className="relative flex flex-1 flex-col items-center gap-6 px-4 py-12 sm:py-16">
      <BrandMark />
      <div className="w-full max-w-2xl text-center">
        <h1 className="text-2xl font-semibold text-foreground">Como você trabalha?</h1>
        <p className="mt-1 text-muted-foreground">
          Leva menos de um minuto. Você pode ajustar tudo depois nas configurações.
        </p>
      </div>
      <div className="w-full max-w-2xl">
        <OnboardingChoice />
      </div>
    </div>
  );
}
