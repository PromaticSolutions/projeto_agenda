import Link from "next/link";
import { AlertCircle, MessageCircle } from "lucide-react";
import { getMyStudio } from "@/lib/data/studios";
import { getReminderSettings } from "@/lib/data/reminders";
import { getWhatsAppConnection } from "@/lib/data/whatsapp";
import { isWhatsAppProviderConfigured } from "@/lib/whatsapp/provider";
import { ReminderSettingsForm } from "@/components/app/reminder-settings-form";
import { Button } from "@/components/ui/button";
import { formatPhoneDisplay } from "@/lib/format";

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
      ) : connection.status === "conectado" ? (
        /* Dizer POR QUAL número o lembrete sai importa quando o dono tem mais
           de um chip: sem isso, a única forma de descobrir é uma cliente
           responder no número errado. */
        <div className="panel flex flex-wrap items-center justify-between gap-3 p-4">
          <div className="flex items-start gap-3 text-sm">
            <MessageCircle className="mt-0.5 size-4 shrink-0 text-emerald-600" />
            <div className="space-y-0.5">
              <p className="font-medium text-foreground">Envio ativo pelo WhatsApp</p>
              <p className="text-muted-foreground">
                Os lembretes saem
                {connection.connected_phone
                  ? ` do número ${formatPhoneDisplay(connection.connected_phone)}`
                  : " do número conectado"}
                , com os marcadores já substituídos.
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" render={<Link href="/app/whatsapp" />}>
            Ver conexão
          </Button>
        </div>
      ) : (
        <div className="panel flex flex-wrap items-center justify-between gap-3 border-amber-500/30 bg-amber-500/5 p-4">
          <div className="flex items-start gap-3 text-sm">
            <AlertCircle className="mt-0.5 size-4 shrink-0 text-amber-600" />
            <div className="space-y-0.5">
              <p className="font-medium text-foreground">Envio ainda não ativo</p>
              <p className="text-muted-foreground">
                A configuração abaixo já fica salva, mas as mensagens só começam a sair depois
                que o WhatsApp estiver conectado.
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" render={<Link href="/app/whatsapp" />}>
            Conectar WhatsApp
          </Button>
        </div>
      )}

      <ReminderSettingsForm settings={settings} />
    </div>
  );
}
