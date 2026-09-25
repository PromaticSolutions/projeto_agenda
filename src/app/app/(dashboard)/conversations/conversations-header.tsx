import "server-only";
import { ImportConversationsButton } from "@/components/app/import-conversations-button";
import { ConversationMediaBackfill } from "@/components/app/conversation-media-backfill";

/** Cabeçalho comum às duas rotas de Conversas (a lista e a conversa aberta). */
export function ConversationsHeader({ hasConversations }: { hasConversations: boolean }) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-3">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold text-foreground">Conversas</h1>
        <p className="text-sm text-muted-foreground">
          As mensagens do WhatsApp do estúdio, de clientes cadastradas ou não.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {hasConversations && <ConversationMediaBackfill />}
        <ImportConversationsButton hasConversations={hasConversations} />
      </div>
    </header>
  );
}
