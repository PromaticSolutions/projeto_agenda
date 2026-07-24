import { redirect } from "next/navigation";
import { OnboardingForm } from "@/components/app/onboarding-form";
import { BrandMark, AuthBackdrop } from "@/components/auth/brand-mark";
import { getMyStudio } from "@/lib/data/studios";

export const metadata = { title: "Criar estúdio — Agenda Online" };

export default async function OnboardingPage() {
  const studio = await getMyStudio();
  if (studio) redirect("/app");

  return (
    <div className="relative flex flex-1 flex-col items-center gap-6 px-4 py-12 sm:py-16">
      <AuthBackdrop />
      <BrandMark />
      <div className="w-full max-w-2xl text-center">
        <h1 className="font-heading text-2xl font-semibold text-plum-900">Vamos criar seu estúdio</h1>
        <p className="mt-1 text-muted-foreground">
          Leva menos de um minuto. Você pode ajustar tudo depois nas configurações.
        </p>
      </div>
      <div className="w-full max-w-2xl">
        <OnboardingForm />
      </div>
    </div>
  );
}
