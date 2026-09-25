"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowDownUp,
  CornerUpLeft,
  ListFilter,
  MessagesSquare,
  Search,
  SlidersHorizontal,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MESSAGE_TYPE_ICONS, WhatsAppGlyph } from "@/components/app/conversation-parts";
import { ContactAvatar } from "@/components/app/contact-avatar";
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
     chega no número, e quem quiser a visão só do cadastro liga o filtro. */
  const [onlyClients, setOnlyClients] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const visible = items.filter(
    (item) =>
      (!onlyClients || item.isClient) &&
      matchesConversationQuery(query, item.name, item.phone)
  );
  const hasNonClients = items.some((item) => !item.isClient);
  const unreadTotal = items.filter((item) => item.unread > 0).length;

  return (
    <>
      {/* Cabeçalho da caixa: o nome da visão, o contador e as duas ações —
          nova conversa e filtros — em botões quadrados de contorno. */}
      <div className="flex h-14 shrink-0 items-center gap-2 border-b border-border px-4">
        <ListFilter className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        <h2 className="text-sm font-medium text-foreground">
          {onlyClients ? "Clientes cadastradas" : "Todas as conversas"}
        </h2>
        {unreadTotal > 0 && (
          <span className="rounded-full bg-foreground/80 px-1.5 py-px text-[0.6875rem] font-semibold text-background tabular-nums">
            <span className="sr-only">Com mensagem não lida: </span>
            {unreadTotal}
          </span>
        )}
        <div className="ml-auto flex items-center gap-1.5">
          <NewConversationDialog />
          {items.length > 0 && (
            <Button
              variant="outline"
              size="icon-sm"
              aria-label="Buscar e filtrar"
              aria-expanded={filtersOpen}
              title="Buscar e filtrar"
              onClick={() => setFiltersOpen((open) => !open)}
              className={cn("size-8", (filtersOpen || onlyClients || query) && "border-primary/50 text-primary")}
            >
              <SlidersHorizontal className="size-4" />
            </Button>
          )}
        </div>
      </div>

      {items.length > 0 && filtersOpen && (
        <div className="flex flex-col gap-2.5 border-b border-border bg-muted/40 p-3">
          <div className="relative">
            <Search
              aria-hidden
              className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              type="search"
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar por nome ou telefone"
              aria-label="Buscar conversa"
              className="bg-background pl-8"
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

      {items.length > 0 && (
        <p className="flex shrink-0 items-center gap-1.5 border-b border-border px-4 py-2 text-xs text-muted-foreground">
          <ArrowDownUp className="size-3" aria-hidden />
          Ordenadas pela mais recente
        </p>
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
          <ul className="divide-y divide-border">
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

/**
 * Uma linha da caixa, na anatomia de caixa de atendimento: foto, nome e
 * horário na primeira linha, a última mensagem na segunda e, na terceira, o
 * canal com a etiqueta do contato. A seta no canto diz que a última palavra
 * foi sua — quem está esperando resposta é quem NÃO tem a seta.
 */
function ConversationRow({ item, active }: { item: ConversationListItem; active: boolean }) {
  const Icon = MESSAGE_TYPE_ICONS[item.type];
  const unread = item.unread > 0;
  const tag = item.isGroup ? "Grupo" : item.isClient ? "Cliente cadastrada" : "Não cadastrada";

  return (
    <li>
      <Link
        href={`/app/conversations/${encodeURIComponent(item.chatId)}`}
        aria-current={active ? "page" : undefined}
        className={cn(
          "relative flex items-start gap-3 px-4 py-3.5 transition-colors focus-visible:bg-muted/60 focus-visible:outline-none",
          active
            ? "bg-primary/[0.07] before:absolute before:inset-y-0 before:left-0 before:w-[3px] before:bg-primary dark:bg-primary/15"
            : "hover:bg-muted/50"
        )}
      >
        <ContactAvatar
          name={item.name}
          chatId={item.isGroup ? null : item.chatId}
          isGroup={item.isGroup}
          className="mt-0.5"
        />

        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <p className={cn("min-w-0 truncate text-sm text-foreground", unread ? "font-semibold" : "font-medium")}>
              {item.isGroup && <span className="sr-only">Grupo: </span>}
              {item.name}
            </p>
            <span
              className={cn(
                "shrink-0 text-xs italic tabular-nums",
                unread ? "font-semibold text-primary not-italic dark:text-violet-300" : "text-muted-foreground"
              )}
            >
              {item.timeLabel}
            </span>
          </div>

          <p
            className={cn(
              "mt-1 flex min-w-0 items-center gap-1 text-[0.8125rem]",
              unread ? "font-medium text-foreground" : "text-muted-foreground"
            )}
          >
            {item.fromMe && <span className="shrink-0">Você:</span>}
            {Icon && <Icon className="size-3.5 shrink-0" aria-hidden />}
            <span className="truncate">{item.preview}</span>
          </p>

          <div className="mt-1.5 flex items-center justify-between gap-2">
            <span className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
              <WhatsAppGlyph className="size-3.5 shrink-0 text-[#25d366]" />
              <span className="truncate">{tag}</span>
            </span>
            {unread ? (
              <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-primary px-1.5 text-[0.6875rem] font-semibold text-primary-foreground">
                <span className="sr-only">Não lidas: </span>
                {item.unread > 99 ? "99+" : item.unread}
              </span>
            ) : (
              item.fromMe && (
                <CornerUpLeft className="size-3.5 shrink-0 text-muted-foreground" aria-label="Você respondeu por último" />
              )
            )}
          </div>
        </div>
      </Link>
    </li>
  );
}
