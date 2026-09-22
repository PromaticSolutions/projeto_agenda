"use client";

import { useState, useTransition } from "react";
import { DownloadCloud, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { importConversationHistoryAction } from "@/app/app/(dashboard)/conversations/actions";

/**
 * "Importar conversas": traz o que já existe no WhatsApp para dentro do painel.
 *
 * O diálogo antes do primeiro clique não é cerimônia: a importação copia TODAS
 * as conversas daquele número para o nosso banco, inclusive as pessoais, e
 * quem aperta precisa saber disso antes — não depois.
 *
 * A importação vem em lotes (ver `importConversationHistory`), então o botão
 * vira "Importar mais" enquanto sobrar conversa.
 */
export function ImportConversationsButton({ hasConversations }: { hasConversations: boolean }) {
  const [open, setOpen] = useState(false);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [pending, startTransition] = useTransition();

  function runImport() {
    startTransition(async () => {
      const result = await importConversationHistoryAction();

      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      setRemaining(result.remaining);
      if (result.chats === 0) {
        toast.info(
          remaining === null
            ? "Nenhuma conversa nova para importar."
            : "Tudo que havia no WhatsApp já está aqui."
        );
        setOpen(false);
        return;
      }

      toast.success(
        `${result.chats} ${result.chats === 1 ? "conversa importada" : "conversas importadas"}` +
          ` (${result.messages} ${result.messages === 1 ? "mensagem" : "mensagens"}).`,
        result.remaining > 0
          ? { description: `Ainda faltam ${result.remaining}. Use "Importar mais" para continuar.` }
          : undefined
      );
      if (result.remaining === 0) setOpen(false);
    });
  }

  // Depois da primeira rodada o botão continua de onde parou, sem repetir o
  // aviso: quem já leu e aceitou não precisa confirmar a cada lote.
  if (remaining !== null && remaining > 0) {
    return (
      <Button variant="outline" size="sm" onClick={runImport} disabled={pending}>
        {pending ? <Loader2 className="size-4 animate-spin" /> : <DownloadCloud className="size-4" />}
        {pending ? "Importando..." : `Importar mais (${remaining})`}
      </Button>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant={hasConversations ? "outline" : "default"} size="sm" />}>
        <DownloadCloud className="size-4" />
        Importar conversas
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Importar as conversas que já existem</DialogTitle>
          <DialogDescription>
            O painel mostra as mensagens que chegam depois que o número foi conectado. A importação
            busca no servidor do WhatsApp o que já estava lá.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 rounded-xl bg-muted/40 p-3.5 text-sm text-muted-foreground">
          <p>
            <span className="font-medium text-foreground">Vem tudo daquele número:</span> conversa de
            cliente, de quem nunca agendou, de grupo e também a pessoal. Depois dá para filtrar por
            clientes na lista, mas o conteúdo fica guardado aqui.
          </p>
          <p>
            Só o texto e o tipo da mídia são guardados — foto, áudio e documento continuam apenas no
            celular.
          </p>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
            Agora não
          </Button>
          <Button onClick={runImport} disabled={pending} className="bg-cta text-white hover:opacity-90">
            {pending ? <Loader2 className="size-4 animate-spin" /> : null}
            {pending ? "Importando..." : "Importar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
