import { getMyStudio } from "@/lib/data/studios";
import { getMyEmail } from "@/lib/data/account";
import { StudioProfileForm } from "@/components/app/studio-profile-form";

export const metadata = { title: "Configurações — Agenda Online" };

export default async function SettingsPage() {
  const studio = await getMyStudio();
  if (!studio) return null;

  const email = await getMyEmail();

  return (
    <div className="flex flex-col gap-6">
      <header className="space-y-1 border-b border-border pb-5">
        <h1 className="text-xl font-semibold text-foreground">Configurações</h1>
        <p className="text-sm text-muted-foreground">
          Dados do responsável e do estabelecimento.
        </p>
      </header>

      <StudioProfileForm studio={studio} email={email} />
    </div>
  );
}
