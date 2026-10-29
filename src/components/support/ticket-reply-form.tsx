"use client";

import { useState, useTransition } from "react";
import { Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { BODY_MAX, type SupportWriteResult } from "@/lib/support";

/**
 * Caixa de resposta de um chamado. A mesma para o estúdio e para a equipe —
 * muda só a ação que recebe e se oferece "responder e resolver".
 * Ctrl/⌘ + Enter envia.
 */
export function TicketReplyForm({
  ticketId,
  send,
  placeholder,
  hint,
  allowResolve = false,
}: {
  ticketId: string;
  send: (ticketId: string, body: string, resolve: boolean) => Promise<SupportWriteResult>;
  placeholder: string;
  hint?: string;
  allowResolve?: boolean;
}) {
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(resolve: boolean) {
    if (!body.trim() || pending) return;
    setError(null);
    startTransition(async () => {
      const result = await send(ticketId, body, resolve);
      if (result.ok) setBody("");
      else setError(result.error);
    });
  }

  return (
    <form
      className="panel flex flex-col gap-3 p-3"
      onSubmit={(event) => {
        event.preventDefault();
        submit(false);
      }}
    >
      <Textarea
        value={body}
        onChange={(event) => setBody(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
            event.preventDefault();
            submit(false);
          }
        }}
        maxLength={BODY_MAX}
        rows={3}
        placeholder={placeholder}
        aria-label="Mensagem"
        className="min-h-20 resize-none border-0 bg-transparent px-1 shadow-none focus-visible:ring-0 dark:bg-transparent"
        disabled={pending}
      />
      {error && <p className="px-1 text-xs text-destructive">{error}</p>}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
        <p className="px-1 text-xs text-muted-foreground">{hint}</p>
        <div className="flex gap-2">
          {allowResolve && (
            <Button type="button" variant="outline" size="sm" disabled={pending || !body.trim()} onClick={() => submit(true)}>
              Responder e resolver
            </Button>
          )}
          <Button type="submit" size="sm" disabled={pending || !body.trim()}>
            {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Send className="size-4" aria-hidden />}
            Enviar
          </Button>
        </div>
      </div>
    </form>
  );
}
