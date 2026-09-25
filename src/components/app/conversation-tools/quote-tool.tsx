"use client";

import { useState } from "react";
import { Minus, Pencil, Plus, RotateCcw, Send } from "lucide-react";
import { toast } from "sonner";
import { useConversationTools } from "@/components/app/conversation-workspace";
import {
  FIELD_CLASS,
  FieldLabel,
  ToolButton,
  WithTools,
} from "@/components/app/conversation-tools/shared";
import type { ToolsData } from "@/components/app/conversation-tools/use-tools-data";
import {
  sendConversationTextAction,
  type ConversationTools,
} from "@/app/app/(dashboard)/conversations/actions";
import { buildQuoteMessage, quoteTotals } from "@/lib/conversation-messages";
import { useChatDraft } from "@/lib/chat-drafts";
import { formatPriceCents } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Orçamento montado com os serviços e preços cadastrados.
 *
 * O dono escolhe quantidades, põe um desconto e uma observação se quiser, e
 * vê a mensagem exatamente como a cliente vai receber. Dá para editar o texto
 * antes de enviar; enquanto não edita, a mensagem acompanha as escolhas.
 *
 * Não é um documento guardado: é uma mensagem na conversa. O rascunho é desta
 * conversa e some depois de enviado.
 */

interface QuoteDraft {
  quantities: Record<string, number>;
  /** Como o dono digitou, em reais ("10,00"). */
  discount: string;
  note: string;
  /** Texto editado à mão; nulo = automático. */
  customText: string | null;
}

const EMPTY_QUOTE: QuoteDraft = { quantities: {}, discount: "", note: "", customText: null };

export function QuoteTool({ data }: { data: ToolsData }) {
  return <WithTools data={data}>{(tools) => <QuoteBuilder tools={tools} />}</WithTools>;
}

function QuoteBuilder({ tools }: { tools: ConversationTools }) {
  const { contact, sendBlockedReason } = useConversationTools()!;
  const [draft, setDraft, resetDraft] = useChatDraft<QuoteDraft>(contact.chatId, "orcamento", EMPTY_QUOTE);
  const [sending, setSending] = useState(false);

  const lines = tools.services
    .map((service) => ({
      id: service.id,
      name: service.name,
      priceCents: service.priceCents,
      quantity: draft.quantities[service.id] ?? 0,
    }))
    .filter((line) => line.quantity > 0);
  const discountCents = parseReais(draft.discount);
  const totals = quoteTotals(lines, discountCents);
  const clientName = contact.name.replace(/\D/g, "") === contact.phone ? "" : contact.name;
  const autoText = buildQuoteMessage({
    studioName: tools.studioName,
    clientName,
    lines,
    discountCents,
    note: draft.note,
  });
  const text = draft.customText ?? autoText;

  function setQuantity(serviceId: string, quantity: number) {
    setDraft((d) => ({
      ...d,
      quantities: { ...d.quantities, [serviceId]: Math.max(0, Math.min(20, quantity)) },
    }));
  }

  async function send() {
    setSending(true);
    const result = await sendConversationTextAction(contact.chatId, text);
    setSending(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Orçamento enviado na conversa.");
    resetDraft();
  }

  return (
    <div className="flex flex-col gap-3.5">
      <ul className="flex flex-col divide-y divide-border rounded-lg border border-border bg-card">
        {tools.services.map((service) => {
          const quantity = draft.quantities[service.id] ?? 0;
          return (
            <li key={service.id} className="flex items-center gap-2 px-2.5 py-2">
              <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: service.color }} aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-foreground">{service.name}</span>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {formatPriceCents(service.priceCents)}
                </span>
              </span>
              <div className="flex items-center gap-0.5" role="group" aria-label={`Quantidade de ${service.name}`}>
                {quantity > 0 && (
                  <>
                    <StepButton label="Diminuir" onClick={() => setQuantity(service.id, quantity - 1)}>
                      <Minus className="size-3.5" aria-hidden />
                    </StepButton>
                    <span className="w-5 text-center text-sm font-semibold tabular-nums" aria-live="polite">
                      {quantity}
                    </span>
                  </>
                )}
                <StepButton
                  label={quantity > 0 ? "Aumentar" : `Adicionar ${service.name}`}
                  onClick={() => setQuantity(service.id, quantity + 1)}
                  primary={quantity === 0}
                >
                  <Plus className="size-3.5" aria-hidden />
                </StepButton>
              </div>
            </li>
          );
        })}
      </ul>

      <div className="grid grid-cols-[minmax(0,7rem)_1fr] gap-2">
        <div className="flex flex-col gap-1.5">
          <FieldLabel htmlFor="orcamento-desconto">Desconto</FieldLabel>
          <div className="relative">
            <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-muted-foreground">
              R$
            </span>
            <input
              id="orcamento-desconto"
              inputMode="decimal"
              value={draft.discount}
              onChange={(event) =>
                setDraft((d) => ({ ...d, discount: event.target.value.replace(/[^\d,.]/g, "").slice(0, 10) }))
              }
              placeholder="0,00"
              className={cn(FIELD_CLASS, "pl-9 tabular-nums")}
            />
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <FieldLabel htmlFor="orcamento-obs">Observação</FieldLabel>
          <input
            id="orcamento-obs"
            value={draft.note}
            maxLength={300}
            onChange={(event) => setDraft((d) => ({ ...d, note: event.target.value }))}
            placeholder="Ex.: Pix ou cartão"
            className={FIELD_CLASS}
          />
        </div>
      </div>

      {lines.length > 0 && (
        <dl className="flex flex-col gap-1 rounded-lg bg-muted/50 px-3 py-2.5 text-sm tabular-nums">
          {totals.discountCents > 0 && (
            <>
              <div className="flex justify-between text-muted-foreground">
                <dt>Subtotal</dt>
                <dd>{formatPriceCents(totals.subtotalCents)}</dd>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <dt>Desconto</dt>
                <dd>− {formatPriceCents(totals.discountCents)}</dd>
              </div>
            </>
          )}
          <div className="flex justify-between font-semibold text-foreground">
            <dt>Total</dt>
            <dd>{formatPriceCents(totals.totalCents)}</dd>
          </div>
        </dl>
      )}

      {lines.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between gap-2">
            <FieldLabel htmlFor="orcamento-texto">Mensagem</FieldLabel>
            {draft.customText === null ? (
              <button
                type="button"
                onClick={() => setDraft((d) => ({ ...d, customText: autoText }))}
                className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium text-primary outline-none hover:bg-primary/8 focus-visible:ring-3 focus-visible:ring-ring/50 dark:text-violet-300"
              >
                <Pencil className="size-3" aria-hidden />
                Editar texto
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setDraft((d) => ({ ...d, customText: null }))}
                className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium text-primary outline-none hover:bg-primary/8 focus-visible:ring-3 focus-visible:ring-ring/50 dark:text-violet-300"
              >
                <RotateCcw className="size-3" aria-hidden />
                Voltar ao automático
              </button>
            )}
          </div>
          {draft.customText === null ? (
            // Prévia no formato do balão enviado: é o que a cliente vai ver.
            <p
              id="orcamento-texto"
              className="rounded-xl rounded-br-sm bg-primary/8 px-3 py-2.5 text-[0.8125rem] leading-5 whitespace-pre-wrap text-foreground"
            >
              {renderWhatsAppBold(autoText)}
            </p>
          ) : (
            <textarea
              id="orcamento-texto"
              rows={8}
              maxLength={4096}
              value={draft.customText}
              onChange={(event) => setDraft((d) => ({ ...d, customText: event.target.value }))}
              className={cn(FIELD_CLASS, "h-auto resize-y py-2 text-[0.8125rem] leading-5")}
            />
          )}
        </div>
      )}

      <ToolButton
        onClick={send}
        pending={sending}
        pendingLabel="Enviando..."
        disabled={lines.length === 0 || text.trim().length === 0 || Boolean(sendBlockedReason)}
        title={sendBlockedReason ?? undefined}
      >
        <Send className="size-4" aria-hidden />
        {lines.length === 0 ? "Adicione um serviço" : "Enviar orçamento"}
      </ToolButton>
    </div>
  );
}

function StepButton({
  label,
  onClick,
  primary = false,
  children,
}: {
  label: string;
  onClick: () => void;
  primary?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={cn(
        "flex size-7 items-center justify-center rounded-md outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50",
        primary
          ? "bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground dark:text-violet-300"
          : "text-muted-foreground hover:bg-muted hover:text-foreground"
      )}
    >
      {children}
    </button>
  );
}

/** "10,50" / "10.50" / "1.000,50" / "10" -> centavos. Vazio ou inválido = 0. */
function parseReais(value: string): number {
  const trimmed = value.trim();
  // Com vírgula, o ponto é milhar ("1.000,50"); sem vírgula, o ponto é a casa decimal.
  const normalized = trimmed.includes(",") ? trimmed.replace(/\./g, "") : trimmed.replace(".", ",");
  if (!normalized) return 0;
  const [whole, fraction = ""] = normalized.split(",");
  const reais = Number(whole || "0");
  const cents = Number((fraction + "00").slice(0, 2));
  return Number.isFinite(reais) && Number.isFinite(cents) ? reais * 100 + cents : 0;
}

/** Mostra o `*negrito*` do WhatsApp como negrito na prévia. */
function renderWhatsAppBold(text: string): React.ReactNode[] {
  return text.split(/(\*[^*\n]+\*)/g).map((part, i) =>
    part.startsWith("*") && part.endsWith("*") && part.length > 2 ? (
      <strong key={i} className="font-semibold">
        {part.slice(1, -1)}
      </strong>
    ) : (
      part
    )
  );
}
