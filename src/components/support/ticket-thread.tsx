import { formatDateLocal, formatTimeLocal } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { SupportAuthor, SupportTicketMessage } from "@/lib/types";

/**
 * A conversa de um chamado, igual dos dois lados: a mensagem de quem está
 * olhando fica à direita. Do lado do estúdio a equipe aparece só como
 * "Suporte Timely" — quem da equipe respondeu é assunto interno.
 */
export function TicketThread({
  messages,
  viewer,
  studioName,
}: {
  messages: SupportTicketMessage[];
  viewer: SupportAuthor;
  studioName: string;
}) {
  return (
    <ol className="flex flex-col gap-4">
      {messages.map((message) => {
        const mine = message.author === viewer;
        const who =
          message.author === "suporte"
            ? viewer === "suporte"
              ? "Equipe"
              : "Suporte Timely"
            : viewer === "cliente"
              ? "Você"
              : studioName;
        const at = new Date(message.created_at);
        return (
          <li key={message.id} className={cn("flex flex-col gap-1", mine ? "items-end" : "items-start")}>
            <p className="px-1 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">{who}</span> · {formatDateLocal(at)}, {formatTimeLocal(at)}
            </p>
            <div
              className={cn(
                "max-w-[min(36rem,90%)] whitespace-pre-wrap break-words rounded-2xl px-4 py-2.5 text-sm",
                mine
                  ? "rounded-tr-sm bg-primary text-primary-foreground"
                  : "rounded-tl-sm border border-border bg-card text-foreground"
              )}
            >
              {message.body}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
