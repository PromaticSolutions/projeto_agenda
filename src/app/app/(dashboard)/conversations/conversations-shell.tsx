import "server-only";
import { getMyStudio } from "@/lib/data/studios";
import { listConversations } from "@/lib/data/conversations";
import { ConversationsAutoRefresh } from "@/components/app/conversation-live";
import {
  ConversationList,
  type ConversationListItem,
} from "@/components/app/conversation-list";
import {
  conversationPreview,
  conversationTitle,
  formatConversationListTime,
} from "@/lib/conversations";
import { cn } from "@/lib/utils";

/**
 * As duas colunas de /app/conversations: a lista e a conversa aberta.
 *
 * É um componente e não um `layout.tsx` porque a lista precisa saber QUAL
 * conversa está aberta para destacá-la — e um layout não é renderizado de novo
 * ao navegar entre os filhos, então o destaque ficaria preso na primeira que
 * fosse aberta.
 *
 * No celular não cabem as duas colunas: a lista é a tela, e abrir uma conversa
 * a substitui (com um voltar no cabeçalho da conversa).
 */
export async function ConversationsShell({
  activeChatId,
  children,
}: {
  activeChatId: string | null;
  children: React.ReactNode;
}) {
  const studio = await getMyStudio();
  if (!studio) return null;

  const conversations = await listConversations(studio.id);
  // Um "agora" só para a página inteira: os rótulos saem do servidor prontos,
  // e dois relógios diferentes dariam "Ontem" numa linha e "18/09" na outra.
  const now = new Date();

  const items: ConversationListItem[] = conversations.map((row) => ({
    chatId: row.chat_id,
    name: conversationTitle(row),
    phone: row.chat_phone ?? "",
    isGroup: row.is_group,
    isClient: row.client_id !== null,
    preview: conversationPreview(row.last_type, row.last_body),
    type: row.last_type,
    fromMe: row.last_direction === "enviada",
    timeLabel: formatConversationListTime(new Date(row.last_at), now),
    unread: row.unread_count,
  }));

  return (
    <div className="panel shadow-float flex h-[calc(100dvh-10rem)] min-h-[34rem] overflow-hidden rounded-2xl bg-muted/50 dark:bg-background">
      <ConversationsAutoRefresh />

      <div
        className={cn(
          "w-full min-w-0 flex-col border-border bg-card md:flex md:w-80 md:shrink-0 md:border-r xl:w-72 2xl:w-80",
          activeChatId ? "hidden" : "flex"
        )}
      >
        <ConversationList items={items} activeChatId={activeChatId} />
      </div>

      <div
        className={cn(
          "min-w-0 flex-1 flex-col md:flex",
          activeChatId ? "flex" : "hidden"
        )}
      >
        {children}
      </div>
    </div>
  );
}
