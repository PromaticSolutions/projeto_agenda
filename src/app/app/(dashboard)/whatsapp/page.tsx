import { getMyStudio } from "@/lib/data/studios";
import { getWhatsAppConnection } from "@/lib/data/whatsapp";
import { listRecentMessages } from "@/lib/data/outbox";
import { WhatsAppConnectionPanel } from "@/components/app/whatsapp-connection-panel";
import { isWhatsAppProviderConfigured } from "@/lib/whatsapp/provider";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { formatPhoneDisplay, formatFullDateLocal, formatTimeLocal } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { MessageOutbox, MessageOutboxStatus } from "@/lib/types";

export const metadata = { title: "WhatsApp — Agenda Online" };

const OUTBOX_STATUS_META: Record<MessageOutboxStatus, { label: string; tone: string }> = {
  pendente: { label: "Na fila", tone: "bg-muted text-muted-foreground" },
  enviando: { label: "Enviando", tone: "bg-amber-500/10 text-amber-700 dark:text-amber-400" },
  enviado: { label: "Enviado", tone: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" },
  falhou: { label: "Falhou", tone: "bg-destructive/10 text-destructive" },
  cancelado: { label: "Cancelado", tone: "bg-muted text-muted-foreground" },
};

export default async function WhatsAppPage() {
  const studio = await getMyStudio();
  if (!studio) return null;

  const connection = await getWhatsAppConnection(studio.id);
  // O histórico lê a fila com service_role; em modo mock a tabela não existe,
  // e a tela simplesmente não mostra a seção.
  const messages = isSupabaseConfigured ? await listRecentMessages(studio.id, 15) : [];

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <header className="space-y-1 border-b border-border pb-5">
        <h1 className="text-xl font-semibold text-foreground">Conectar WhatsApp</h1>
        <p className="text-sm text-muted-foreground">
          Número conectado ao estúdio para o envio dos lembretes.
        </p>
      </header>

      <WhatsAppConnectionPanel
        connection={connection}
        providerConfigured={isWhatsAppProviderConfigured}
      />

      <section className="panel overflow-hidden">
        <header className="flex items-center justify-between gap-4 border-b border-border px-4 py-3">
          <h2 className="font-medium text-foreground">Últimas mensagens</h2>
          <span className="text-sm text-muted-foreground">{messages.length}</span>
        </header>

        {messages.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-muted-foreground">
            Nada enviado ainda. Os lembretes entram nesta lista assim que forem para a fila.
          </p>
        ) : (
          <ol className="divide-y divide-border">
            {messages.map((message) => (
              <MessageRow key={message.id} message={message} />
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}

function MessageRow({ message }: { message: MessageOutbox }) {
  const meta = OUTBOX_STATUS_META[message.status];
  const when = new Date(message.sent_at ?? message.scheduled_for);

  return (
    <li className="flex flex-wrap items-start gap-3 px-4 py-3 transition-colors hover:bg-muted/50">
      <span
        className={cn("shrink-0 rounded-full px-2 py-0.5 text-xs font-medium", meta.tone)}
      >
        {meta.label}
      </span>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm text-foreground">{message.body}</p>
        <p className="text-xs text-muted-foreground">
          {formatPhoneDisplay(message.to_phone)} · {formatFullDateLocal(when)} às{" "}
          {formatTimeLocal(when)}
          {message.attempts > 1 && ` · ${message.attempts} tentativas`}
        </p>
        {message.last_error && message.status !== "enviado" && (
          <p className="truncate text-xs text-destructive">{message.last_error}</p>
        )}
      </div>
    </li>
  );
}
