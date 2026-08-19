import { getMyStudio } from "@/lib/data/studios";
import { getWhatsAppConnection } from "@/lib/data/whatsapp";
import { WhatsAppConnectionPanel } from "@/components/app/whatsapp-connection-panel";

export const metadata = { title: "WhatsApp — Agenda Online" };

export default async function WhatsAppPage() {
  const studio = await getMyStudio();
  if (!studio) return null;

  const connection = await getWhatsAppConnection(studio.id);

  return (
    <div className="flex flex-col gap-6">
      <header className="space-y-1 border-b border-border pb-5">
        <h1 className="text-xl font-semibold text-foreground">Conectar WhatsApp</h1>
        <p className="text-sm text-muted-foreground">
          Número conectado ao estúdio para o envio dos lembretes.
        </p>
      </header>

      <WhatsAppConnectionPanel connection={connection} />
    </div>
  );
}
