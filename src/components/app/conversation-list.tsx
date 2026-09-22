"use client";

import { useState } from "react";
import Link from "next/link";
import { MessagesSquare, Search, Users, UsersRound } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ConversationAvatar, MESSAGE_TYPE_ICONS } from "@/components/app/conversation-parts";
import { NewConversationDialog } from "@/components/app/new-conversation-dialog";
import { matchesConversationQuery } from "@/lib/conversations";
import { cn } from "@/lib/utils";
import type { WhatsAppMessageType } from "@/lib/types";

/**
 * Coluna da esquerda de /app/conversations.
 *
 * Os rótulos de data chegam prontos do servidor: calculá-los aqui daria um
 * texto no HTML e outro depois da hidratação sempre que a página fosse
 * renderizada perto da virada de um minuto.
 */

export interface ConversationListItem {
  /** JID da conversa — o id na URL. */
  chatId: string;
  name: string;
  /** Vazio em grupo: não há um número do outro lado. */
  phone: string;
  isGroup: boolean;
  /** O número é de uma cliente cadastrada (0021). */
  isClient: boolean;
  preview: string;
  type: WhatsAppMessageType;
  fromMe: boolean;
  timeLabel: string;
  unread: number;
}

export function ConversationList({
  items,
  activeChatId,
}: {
  items: ConversationListItem[];
  activeChatId: string | null;
}) {
  const [query, setQuery] = useState("");
  /* Começa desligado por decisão do dono do produto: a caixa mostra tudo que
     chega no número, e quem quiser a visão só do cadastro marca aqui. */
  const [onlyClients, setOnlyClients] = useState(false);

  const visible = items.filter(
    (item) =>
      (!onlyClients || item.isClient) &&
      matchesConversationQuery(query, item.name, item.phone)
  );
  const hasNonClients = items.some((item) => !item.isClient);

  return (
    <>
      <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
        <h2 className="font-medium text-foreground">Mensagens</h2>
        <NewConversationDialog />
      </div>

      {items.length > 0 && (
        <div className="flex flex-col gap-2.5 border-b border-border p-3">
          <div className="relative">
            <Search
              aria-hidden
              className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar por nome ou telefone"
              aria-label="Buscar conversa"
              className="pl-8"
            />
          </div>

          {/* Só aparece quando há o que filtrar: com tudo de cliente, a
              caixinha não mudaria nada e seria só mais um controle na tela. */}
          {hasNonClients && (
            <div className="flex items-center gap-2">
              <Checkbox
                id="only-clients"
                checked={onlyClients}
                onCheckedChange={(checked) => setOnlyClients(checked === true)}
              />
              <Label
                htmlFor="only-clients"
                className="flex cursor-pointer items-center gap-1.5 text-sm font-normal text-muted-foreground"
              >
                <Users className="size-3.5" aria-hidden />
                Só clientes cadastradas
              </Label>
            </div>
          )}
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto">
        {items.length === 0 ? (
          <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <MessagesSquare className="size-5" aria-hidden />
            </span>
            <div className="space-y-1">
              <p className="font-medium text-foreground">Nenhuma conversa ainda</p>
              <p className="text-sm text-muted-foreground">
                Quando alguém mandar mensagem no WhatsApp do estúdio, a conversa aparece aqui.
                Para puxar assunto, use o botão de nova conversa.
              </p>
            </div>
          </div>
        ) : visible.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-muted-foreground">
            {onlyClients && query === ""
              ? "Nenhuma conversa com cliente cadastrada."
              : "Nenhuma conversa encontrada."}
          </p>
        ) : (
          <ul className="divide-y divide-border/60">
            {visible.map((item) => (
              <ConversationRow
                key={item.chatId}
                item={item}
                active={item.chatId === activeChatId}
              />
            ))}
          </ul>
        )}
      </div>
    </>
  );
}

function ConversationRow({ item, active }: { item: ConversationListItem; active: boolean }) {
  const Icon = MESSAGE_TYPE_ICONS[item.type];
  const unread = item.unread > 0;

  return (
    <li>
      <Link
        href={`/app/conversations/${encodeURIComponent(item.chatId)}`}
        aria-current={active ? "page" : undefined}
        className={cn(
          "flex items-center gap-3 px-4 py-3 transition-colors focus-visible:bg-muted/60 focus-visible:outline-none",
          active ? "bg-muted" : "hover:bg-muted/60"
        )}
      >
        <ConversationAvatar name={item.name} />

        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <p className={cn("flex min-w-0 items-center gap-1.5 text-sm text-foreground", unread ? "font-semibold" : "font-medium")}>
              {item.isGroup && (
                <UsersRound className="size-3.5 shrink-0 text-muted-foreground" aria-label="Grupo" />
              )}
              <span className="truncate">{item.name}</span>
            </p>
            <span
              className={cn(
                "shrink-0 text-xs tabular-nums",
                unread ? "font-medium text-primary" : "text-muted-foreground"
              )}
            >
              {item.timeLabel}
            </span>
          </div>

          <div className="mt-0.5 flex items-center justify-between gap-2">
            <p
              className={cn(
                "flex min-w-0 items-center gap-1 text-sm",
                unread ? "text-foreground" : "text-muted-foreground"
              )}
            >
              {item.fromMe && <span className="shrink-0 text-muted-foreground">Você:</span>}
              {Icon && <Icon className="size-3.5 shrink-0" aria-hidden />}
              <span className="truncate">{item.preview}</span>
            </p>
            {unread && (
              <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-primary px-1.5 text-[0.6875rem] font-semibold text-primary-foreground">
                <span className="sr-only">Não lidas: </span>
                {item.unread > 99 ? "99+" : item.unread}
              </span>
            )}
          </div>
        </div>
      </Link>
    </li>
  );
}
