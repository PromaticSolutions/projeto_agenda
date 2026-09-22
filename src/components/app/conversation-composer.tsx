"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Loader2, SendHorizontal, Unplug } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  sendConversationMessageAction,
  type ConversationSendState,
} from "@/app/app/(dashboard)/conversations/actions";

/**
 * Campo de resposta da conversa.
 *
 * Quando não dá para enviar, o campo dá lugar a UMA linha dizendo por quê, em
 * vez de aparecer desabilitado: um campo cinza no rodapé de um chat parece
 * defeito, e o motivo (número desconectado) tem um lugar certo para resolver.
 */

const MAX_LENGTH = 4096;

export interface ComposerBlock {
  message: string;
  /** Onde resolver, quando existe um lugar para isso. */
  href?: string;
  cta?: string;
}

export function ConversationComposer({
  chatId,
  blocked,
}: {
  chatId: string;
  blocked: ComposerBlock | null;
}) {
  const action = sendConversationMessageAction.bind(null, chatId);
  const [state, formAction, pending] = useActionState<ConversationSendState, FormData>(
    action,
    null
  );

  useEffect(() => {
    if (state && !state.ok) toast.error(state.error);
  }, [state]);

  if (blocked) {
    return (
      <div className="flex flex-wrap items-center gap-3 border-t border-border bg-amber-500/5 px-4 py-3">
        <Unplug className="size-4 shrink-0 text-amber-600" aria-hidden />
        <p className="min-w-0 flex-1 text-sm text-muted-foreground">{blocked.message}</p>
        {blocked.href && (
          <Button variant="outline" size="sm" render={<Link href={blocked.href} />}>
            {blocked.cta ?? "Resolver"}
          </Button>
        )}
      </div>
    );
  }

  // A `key` troca a cada envio aceito e remonta o campo vazio; numa falha ela
  // não muda, e o texto fica lá para tentar de novo.
  return (
    <ComposeForm key={state?.ok ? state.token : "inicial"} action={formAction} pending={pending} />
  );
}

function ComposeForm({
  action,
  pending,
}: {
  action: (formData: FormData) => void;
  pending: boolean;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [value, setValue] = useState("");
  const empty = value.trim().length === 0;

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) return;
    // No celular, Enter é quebra de linha: o teclado virtual não tem Shift à
    // mão, e mandar a mensagem pela metade é pior que tocar no botão.
    if (window.matchMedia("(pointer: coarse)").matches) return;
    event.preventDefault();
    if (!empty && !pending) formRef.current?.requestSubmit();
  }

  return (
    <form
      ref={formRef}
      action={action}
      className="flex items-end gap-2 border-t border-border bg-card px-3 py-3"
    >
      <label htmlFor="conversation-message" className="sr-only">
        Mensagem
      </label>
      <Textarea
        id="conversation-message"
        name="message"
        rows={1}
        required
        maxLength={MAX_LENGTH}
        value={value}
        // `readOnly` e não `disabled`: campo desabilitado fica fora do
        // FormData, e o envio sairia vazio.
        readOnly={pending}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Escreva uma mensagem"
        aria-describedby="conversation-hint"
        className="max-h-40 min-h-10 resize-none"
      />
      <span id="conversation-hint" className="sr-only">
        Enter envia. Shift e Enter quebram a linha.
      </span>
      <Button
        type="submit"
        size="icon-lg"
        disabled={empty || pending}
        aria-label="Enviar mensagem"
        className="bg-cta text-white hover:opacity-90"
      >
        {pending ? <Loader2 className="size-4 animate-spin" /> : <SendHorizontal className="size-4" />}
      </Button>
    </form>
  );
}
