import { getMyStudio } from "@/lib/data/studios";
import { AccountSettings } from "@/components/app/account-settings";

export const metadata = { title: "Conta — Timely" };

export default async function AccountPage() {
  const studio = await getMyStudio();
  if (!studio) return null;

  return (
    <div className="flex flex-col gap-6">
      <header className="space-y-1 border-b border-border pb-5">
        <h1 className="text-xl font-semibold text-foreground">Conta e identidade</h1>
        <p className="text-sm text-muted-foreground">
          Como o estúdio aparece para os clientes, e o acesso à sua conta.
        </p>
      </header>

      <AccountSettings studio={studio} />
    </div>
  );
}
