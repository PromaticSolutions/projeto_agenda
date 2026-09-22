import "server-only";
import { ImportConversationsButton } from "@/components/app/import-conversations-button";

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
      <ImportConversationsButton hasConversations={hasConversations} />
    </header>
  );
}
