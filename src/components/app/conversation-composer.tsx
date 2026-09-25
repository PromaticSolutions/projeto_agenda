"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { CalendarPlus, CalendarSearch, Images, Loader2, Receipt, SendHorizontal, Unplug } from "lucide-react";
import { WhatsAppGlyph } from "@/components/app/conversation-parts";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useConversationTools, type ToolId } from "@/components/app/conversation-workspace";
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
  recipientLabel,
}: {
  chatId: string;
  blocked: ComposerBlock | null;
  /** O número de quem recebe, como aparece na linha "Para". */
  recipientLabel: string;
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
      <div className="flex shrink-0 flex-wrap items-center gap-3 border-t border-border bg-amber-500/5 px-4 py-3.5">
        <Unplug className="size-4 shrink-0 text-amber-600" aria-hidden />
        <p className="min-w-0 flex-1 text-sm text-muted-foreground">{blocked.message}</p>
        {blocked.href && (
          <Button variant="outline" size="sm" nativeButton={false} render={<Link href={blocked.href} />}>
            {blocked.cta ?? "Resolver"}
          </Button>
        )}
      </div>
    );
  }

  // A `key` troca a cada envio aceito e remonta o campo vazio; numa falha ela
  // não muda, e o texto fica lá para tentar de novo.
  return (
    <ComposeForm
      key={state?.ok ? state.token : "inicial"}
      action={formAction}
      pending={pending}
      recipientLabel={recipientLabel}
    />
  );
}

/**
 * O campo, no desenho de caixa de atendimento: a aba do canal em cima
 * ("Responder" pelo WhatsApp), a linha "Para" com o número, a área de texto
 * sem moldura e, embaixo, a barra de ferramentas com o Enviar à direita.
 */
function ComposeForm({
  action,
  pending,
  recipientLabel,
}: {
  action: (formData: FormData) => void;
  pending: boolean;
  recipientLabel: string;
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
    <form ref={formRef} action={action} className="shrink-0 border-t border-border bg-card">
      <div className="flex items-end gap-5 border-b border-border px-4">
        <span className="-mb-px flex items-center gap-1.5 border-b-2 border-primary py-2.5 text-sm font-semibold text-primary dark:text-violet-300">
          <WhatsAppGlyph className="size-4 text-[#25d366]" />
          Responder
        </span>
      </div>

      <p className="flex items-center gap-2 border-b border-border px-4 py-2.5 text-sm">
        <span className="text-muted-foreground">Para:</span>
        <span className="font-medium text-foreground tabular-nums">{recipientLabel}</span>
      </p>

      <label htmlFor="conversation-message" className="sr-only">
        Mensagem
      </label>
      <Textarea
        id="conversation-message"
        name="message"
        rows={2}
        required
        maxLength={MAX_LENGTH}
        value={value}
        // `readOnly` e não `disabled`: campo desabilitado fica fora do
        // FormData, e o envio sairia vazio.
        readOnly={pending}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Escreva sua resposta…"
        aria-describedby="conversation-hint"
        className="max-h-40 min-h-16 resize-none rounded-none border-0 bg-transparent px-4 py-3 text-[0.9375rem] shadow-none focus-visible:border-0 focus-visible:ring-0 dark:bg-transparent"
      />

      <div className="flex items-center gap-1 px-3 pb-3">
        <QuickTools />
        <span id="conversation-hint" className="mr-3 ml-auto hidden text-xs text-muted-foreground 2xl:inline">
          Enter envia · Shift + Enter quebra a linha
        </span>
        <Button
          type="submit"
          disabled={empty || pending}
          className="ml-auto h-9 gap-2 bg-[var(--plum-900)] px-4 text-white hover:bg-[var(--plum-900)]/90 2xl:ml-0 dark:bg-primary dark:text-primary-foreground"
        >
          {pending ? <Loader2 className="size-4 animate-spin" /> : <SendHorizontal className="size-4" />}
          Enviar
        </Button>
      </div>
    </form>
  );
}

const QUICK_TOOLS: { id: ToolId; icon: typeof Images; label: string }[] = [
  { id: "agendar", icon: CalendarPlus, label: "Criar agendamento" },
  { id: "disponibilidade", icon: CalendarSearch, label: "Ver horários livres" },
  { id: "fotos", icon: Images, label: "Enviar fotos dos procedimentos" },
  { id: "orcamento", icon: Receipt, label: "Enviar orçamento" },
];

/**
 * Atalhos para o painel de atendimento, à mão de quem está digitando: a
 * cliente pergunta "tem foto?" ou "quanto fica?" e a resposta está a um
 * toque, sem procurar a seção no painel.
 */
function QuickTools() {
  const tools = useConversationTools();
  if (!tools || tools.contact.isGroup) return null;
  return (
    <div className="flex shrink-0 items-center">
      {QUICK_TOOLS.map((tool) => (
        <button
          key={tool.id}
          type="button"
          onClick={() => tools.openTool(tool.id)}
          title={tool.label}
          aria-label={tool.label}
          className="flex size-9 items-center justify-center rounded-lg text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <tool.icon className="size-[1.125rem]" aria-hidden />
        </button>
      ))}
    </div>
  );
}
