import { MessagesSquare } from "lucide-react";
import { ConversationsShell } from "@/app/app/(dashboard)/conversations/conversations-shell";
import { ConversationsHeader } from "@/app/app/(dashboard)/conversations/conversations-header";
import { getMyStudio } from "@/lib/data/studios";
import { listConversations } from "@/lib/data/conversations";

export const metadata = { title: "Conversas — Timely" };

export default async function ConversationsPage() {
  const studio = await getMyStudio();
  const conversations = studio ? await listConversations(studio.id) : [];

  return (
    <div className="flex flex-col gap-6">
      <ConversationsHeader hasConversations={conversations.length > 0} />

      <ConversationsShell activeChatId={null}>
        {/* Só aparece no desktop: no celular a lista ocupa a tela inteira. */}
        <div className="flex flex-1 flex-col items-center justify-center gap-3 bg-muted/30 px-6 text-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-background text-muted-foreground shadow-sm">
            <MessagesSquare className="size-5" aria-hidden />
          </span>
          <p className="text-sm text-muted-foreground">
            {conversations.length === 0
              ? "Nada aqui ainda. O painel mostra as mensagens que chegam depois que o número foi conectado — para trazer as antigas, use \u201cImportar conversas\u201d."
              : "Escolha uma conversa à esquerda para ler e responder."}
          </p>
        </div>
      </ConversationsShell>
    </div>
  );
}
