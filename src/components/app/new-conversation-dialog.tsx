"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, Search, SquarePen } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ConversationAvatar } from "@/components/app/conversation-parts";
import {
  listClientsForConversationAction,
  type ConversationClientOption,
} from "@/app/app/(dashboard)/conversations/actions";
import { matchesConversationQuery } from "@/lib/conversations";
import { formatPhoneDisplay } from "@/lib/format";

/**
 * "Nova conversa": escolher uma cliente cadastrada e abrir a conversa com ela.
 *
 * Só cadastradas, pela mesma regra do webhook: a tela não oferece falar com
 * um número solto. Para isso existe o envio manual em /app/whatsapp.
 */
export function NewConversationDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [clients, setClients] = useState<ConversationClientOption[] | null>(null);
  const [query, setQuery] = useState("");
  const [loading, startLoading] = useTransition();

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      setQuery("");
      return;
    }
    // Relido a cada abertura: uma cliente cadastrada em outra aba precisa
    // aparecer sem recarregar a página.
    startLoading(async () => {
      const options = await listClientsForConversationAction();
      startLoading(() => setClients(options));
    });
  }

  function openConversation(phone: string) {
    setOpen(false);
    setQuery("");
    // A conversa é identificada pelo chat do WhatsApp, não pela cliente (0021).
    router.push(`/app/conversations/${encodeURIComponent(`${phone}@s.whatsapp.net`)}`);
  }

  const filtered = (clients ?? []).filter((client) =>
    matchesConversationQuery(query, client.name, client.phone)
  );

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={<Button variant="outline" size="icon-sm" className="size-8" aria-label="Nova conversa" title="Nova conversa" />}
      >
        <SquarePen className="size-4" />
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nova conversa</DialogTitle>
          <DialogDescription>
            Escolha uma cliente cadastrada. A mensagem sai pelo WhatsApp do estúdio.
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Nome ou telefone"
            aria-label="Buscar cliente"
            className="pl-8"
            autoFocus
          />
        </div>

        <div className="-mx-2 max-h-80 overflow-y-auto">
          {clients === null ? (
            <p className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" aria-hidden /> Carregando clientes…
            </p>
          ) : clients.length === 0 ? (
            <p className="px-2 py-8 text-center text-sm text-muted-foreground">
              Nenhuma cliente cadastrada ainda.{" "}
              <Link
                href="/app/clients"
                onClick={() => setOpen(false)}
                className="font-medium text-foreground underline-offset-4 hover:underline"
              >
                Cadastrar em Clientes
              </Link>
            </p>
          ) : filtered.length === 0 ? (
            <p className="px-2 py-8 text-center text-sm text-muted-foreground">
              Nenhuma cliente encontrada.
            </p>
          ) : (
            <ul className="flex flex-col" aria-busy={loading}>
              {filtered.map((client) => (
                <li key={client.id}>
                  <button
                    type="button"
                    onClick={() => openConversation(client.phone)}
                    className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
                  >
                    <ConversationAvatar name={client.name} size="sm" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-foreground">
                        {client.name}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {formatPhoneDisplay(client.phone)}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
