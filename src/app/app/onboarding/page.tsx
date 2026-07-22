import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { OnboardingForm } from "@/components/app/onboarding-form";
import { getMyStudio } from "@/lib/data/studios";

export const metadata = { title: "Criar estúdio — Agenda Online" };

export default async function OnboardingPage() {
  const studio = await getMyStudio();
  if (studio) redirect("/app");

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 px-4 py-16">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="font-heading text-2xl">Vamos criar seu estúdio</CardTitle>
          <CardDescription>
            Leva menos de um minuto. Você pode ajustar tudo depois nas configurações.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <OnboardingForm />
        </CardContent>
      </Card>
    </div>
  );
}
