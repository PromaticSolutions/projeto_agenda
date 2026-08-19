import { AlertCircle } from "lucide-react";
import { getMyStudio } from "@/lib/data/studios";
import { getReminderSettings } from "@/lib/data/reminders";
import { getWhatsAppConnection } from "@/lib/data/whatsapp";
import { isWhatsAppProviderConfigured } from "@/lib/whatsapp/provider";
import { ReminderSettingsForm } from "@/components/app/reminder-settings-form";

export const metadata = { title: "Lembretes — Timely" };

export default async function RemindersPage() {
  const studio = await getMyStudio();
  if (!studio) return null;

  const [settings, connection] = await Promise.all([
    getReminderSettings(studio.id),
    getWhatsAppConnection(studio.id),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <header className="space-y-1 border-b border-border pb-5">
        <h1 className="text-xl font-semibold text-foreground">Lembretes</h1>
        <p className="text-sm text-muted-foreground">
          Mensagem automática enviada quando o horário do agendamento se aproxima.
        </p>
      </header>

      {/* Dizer na tela por que nada sai ainda evita que o dono ligue os
          lembretes e fique esperando um envio que não vai acontecer. O motivo
          muda: ou a integração ainda está sendo feita, ou ela existe e o
          número é que não foi conectado — e a ação que resolve cada caso é
          diferente. */}
      {!isWhatsAppProviderConfigured ? (
        <div className="panel flex items-start gap-3 border-amber-500/30 bg-amber-500/5 p-4">
          <AlertCircle className="mt-0.5 size-4 shrink-0 text-amber-600" />
          <div className="space-y-0.5 text-sm">
            <p className="font-medium text-foreground">Envio em produção</p>
            <p className="text-muted-foreground">
              A integração com o WhatsApp ainda está sendo construída. Deixe a mensagem
              configurada aqui: quando ela entrar no ar, os envios começam sem você precisar
              mexer em mais nada.
            </p>
          </div>
        </div>
      ) : (
        connection.status !== "conectado" && (
          <div className="panel flex items-start gap-3 border-amber-500/30 bg-amber-500/5 p-4">
            <AlertCircle className="mt-0.5 size-4 shrink-0 text-amber-600" />
            <div className="space-y-0.5 text-sm">
              <p className="font-medium text-foreground">Envio ainda não ativo</p>
              <p className="text-muted-foreground">
                A configuração abaixo já fica salva, mas as mensagens só começam a sair depois
                que o WhatsApp estiver conectado.
              </p>
            </div>
          </div>
        )
      )}

      <ReminderSettingsForm settings={settings} />
    </div>
  );
}
