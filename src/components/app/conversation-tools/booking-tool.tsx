"use client";

import { useEffect, useState } from "react";
import { CalendarCheck2, Send } from "lucide-react";
import { toast } from "sonner";
import { PhoneInput } from "@/components/ui/phone-input";
import { Skeleton } from "@/components/ui/skeleton";
import { useConversationTools } from "@/components/app/conversation-workspace";
import {
  FIELD_CLASS,
  FieldLabel,
  ServiceSelect,
  ToolButton,
  WithTools,
  dayOfMonth,
  formatDayLabel,
  formatWeekdayShort,
} from "@/components/app/conversation-tools/shared";
import type { ToolsData } from "@/components/app/conversation-tools/use-tools-data";
import {
  createManualBookingAction,
  listOwnerSlotsAction,
  type OwnerSlotsResult,
} from "@/app/app/(dashboard)/actions";
import {
  sendConversationTextAction,
  type ConversationTools,
} from "@/app/app/(dashboard)/conversations/actions";
import { addLocalDays, utcToLocalDate } from "@/lib/availability";
import { buildBookingConfirmation } from "@/lib/conversation-messages";
import { useChatDraft } from "@/lib/chat-drafts";
import { formatDurationMin, formatPriceCents, formatTimeLocal } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Criar agendamento sem sair da conversa.
 *
 * É o mesmo agendamento manual da Agenda (`createManualBookingAction`, com a
 * grade de horários livres de `listOwnerSlotsAction`), com nome e telefone já
 * preenchidos pela conversa. Depois de criar, oferece mandar a confirmação na
 * própria conversa — que é o passo seguinte natural de quem acabou de marcar.
 *
 * O rascunho é da conversa (`useChatDraft`): o modal de disponibilidade
 * escreve nele quando o dono escolhe "Agendar este horário".
 */

export interface BookingDraft {
  serviceId: string | null;
  date: string | null;
  /** Início escolhido na grade (ISO). */
  start: string | null;
  name: string | null;
  phone: string | null;
  done: {
    serviceName: string;
    dayLabel: string;
    time: string;
    clientName: string;
    confirmationSent: boolean;
  } | null;
}

export const EMPTY_BOOKING_DRAFT: BookingDraft = {
  serviceId: null,
  date: null,
  start: null,
  name: null,
  phone: null,
  done: null,
};

/** Quantos dias aparecem como atalho acima da data. */
const QUICK_DAYS = 7;

export function BookingTool({ data }: { data: ToolsData }) {
  return <WithTools data={data}>{(tools) => <BookingForm tools={tools} />}</WithTools>;
}

function BookingForm({ tools }: { tools: ConversationTools }) {
  const context = useConversationTools()!;
  const { contact } = context;
  const [draft, setDraft, resetDraft] = useChatDraft<BookingDraft>(
    contact.chatId,
    "agendamento",
    EMPTY_BOOKING_DRAFT
  );
  const [today] = useState(() => utcToLocalDate(new Date()));
  const [submitting, setSubmitting] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Muda depois de agendar, para a grade reler e o horário usado sumir. */
  const [version, setVersion] = useState(0);

  const service =
    tools.services.find((item) => item.id === draft.serviceId) ?? tools.services[0]!;
  const date = draft.date && draft.date >= today ? draft.date : today;
  // Quem não é cliente aparece na conversa pelo nome do WhatsApp (ou pelo
  // número); o nome fica editável de qualquer jeito.
  const name = draft.name ?? (contact.name.replace(/\D/g, "") === contact.phone ? "" : contact.name);
  const phone = draft.phone ?? (contact.phone ?? "").replace(/^55/, "");

  const slotsKey = `${service.id}|${date}|${version}`;
  const [slots, setSlots] = useState<{ key: string; result: OwnerSlotsResult } | null>(null);
  useEffect(() => {
    let alive = true;
    const [serviceId, day] = slotsKey.split("|");
    void listOwnerSlotsAction(serviceId!, day!).then((result) => {
      if (alive) setSlots({ key: slotsKey, result });
    });
    return () => {
      alive = false;
    };
  }, [slotsKey]);
  const loadingSlots = slots?.key !== slotsKey;
  const slotList = !loadingSlots && slots.result.ok ? slots.result.slots : [];
  const selected = slotList.some((slot) => slot.start === draft.start) ? draft.start : null;

  if (draft.done) {
    const done = draft.done;
    async function sendConfirmation() {
      setSending(true);
      const result = await sendConversationTextAction(
        contact.chatId,
        buildBookingConfirmation({
          clientName: done.clientName,
          serviceName: done.serviceName,
          dayLabel: done.dayLabel,
          time: done.time,
          studioName: tools.studioName,
        })
      );
      setSending(false);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Confirmação enviada na conversa.");
      setDraft((current) =>
        current.done ? { ...current, done: { ...current.done, confirmationSent: true } } : current
      );
    }

    return (
      <div className="flex flex-col gap-3">
        <div className="flex items-start gap-3 rounded-lg bg-emerald-500/10 px-3 py-3">
          <CalendarCheck2 className="mt-0.5 size-5 shrink-0 text-[#0b6b37] dark:text-emerald-300" aria-hidden />
          <div className="min-w-0 text-sm">
            <p className="font-semibold text-foreground">Agendamento criado</p>
            <p className="text-muted-foreground">
              {done.serviceName} · <span className="capitalize">{done.dayLabel}</span> às {done.time}
            </p>
          </div>
        </div>
        {!done.confirmationSent && (
          <ToolButton
            onClick={sendConfirmation}
            pending={sending}
            pendingLabel="Enviando..."
            disabled={Boolean(context.sendBlockedReason)}
            title={context.sendBlockedReason ?? undefined}
          >
            <Send className="size-4" aria-hidden />
            Enviar confirmação na conversa
          </ToolButton>
        )}
        <ToolButton variant="outline" onClick={resetDraft}>
          Novo agendamento
        </ToolButton>
      </div>
    );
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (!selected) {
      setError("Escolha um horário livre.");
      return;
    }
    setSubmitting(true);
    try {
      const time = formatTimeLocal(new Date(selected));
      const result = await createManualBookingAction({
        serviceId: service.id,
        clientName: name,
        clientPhone: phone,
        date,
        time,
        durationMin: service.durationMin,
        encaixe: false,
      });
      if (!result.ok) {
        setError(result.error);
        setVersion((v) => v + 1);
        return;
      }
      toast.success(`Agendamento de ${name.trim().split(/\s+/)[0]} criado.`);
      setVersion((v) => v + 1);
      setDraft({
        ...EMPTY_BOOKING_DRAFT,
        done: {
          serviceName: service.name,
          dayLabel: formatDayLabel(date),
          time,
          clientName: name,
          confirmationSent: false,
        },
      });
    } catch {
      setError("Erro de conexão. Tente novamente.");
    } finally {
      setSubmitting(false);
    }
  }

  const quickDays = Array.from({ length: QUICK_DAYS }, (_, i) => addLocalDays(today, i));

  return (
    <form onSubmit={submit} className="flex flex-col gap-3.5">
      <div className="flex flex-col gap-1.5">
        <FieldLabel htmlFor="agendar-servico">Serviço</FieldLabel>
        <ServiceSelect
          id="agendar-servico"
          services={tools.services}
          value={service.id}
          onChange={(serviceId) => setDraft((d) => ({ ...d, serviceId, start: null }))}
        />
        <p className="text-xs text-muted-foreground">
          {formatDurationMin(service.durationMin)} · {formatPriceCents(service.priceCents)}
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <FieldLabel>Dia</FieldLabel>
        <div
          className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          role="radiogroup"
          aria-label="Dia"
        >
          {quickDays.map((day, i) => {
            const active = day === date;
            return (
              <button
                key={day}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setDraft((d) => ({ ...d, date: day, start: null }))}
                className={cn(
                  "flex w-12 shrink-0 flex-col items-center rounded-lg border py-1.5 outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50",
                  active
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card text-foreground hover:border-primary/50"
                )}
              >
                <span className={cn("text-[0.625rem] font-medium uppercase", !active && "text-muted-foreground")}>
                  {i === 0 ? "Hoje" : formatWeekdayShort(day)}
                </span>
                <span className="text-base leading-5 font-semibold tabular-nums">{dayOfMonth(day)}</span>
              </button>
            );
          })}
        </div>
        <input
          type="date"
          aria-label="Outra data"
          min={today}
          value={date}
          onChange={(event) =>
            event.target.value && setDraft((d) => ({ ...d, date: event.target.value, start: null }))
          }
          className={cn(FIELD_CLASS, "tabular-nums")}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <FieldLabel>Horário</FieldLabel>
        {loadingSlots ? (
          <div className="grid grid-cols-3 gap-1.5">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-9 rounded-lg" />
            ))}
          </div>
        ) : !slots.result.ok ? (
          <p className="text-sm text-destructive">{slots.result.error}</p>
        ) : slotList.length === 0 ? (
          <p className="rounded-lg bg-muted/60 px-3 py-2.5 text-sm text-muted-foreground">
            Nenhum horário livre neste dia. Escolha outro dia.
          </p>
        ) : (
          <div className="grid max-h-40 grid-cols-3 gap-1.5 overflow-y-auto pr-0.5" role="radiogroup" aria-label="Horário">
            {slotList.map((slot) => {
              const active = slot.start === selected;
              return (
                <button
                  key={slot.start}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => setDraft((d) => ({ ...d, start: slot.start }))}
                  className={cn(
                    "h-9 rounded-lg border text-sm font-semibold tabular-nums outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50",
                    active
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-card text-foreground hover:border-primary/50"
                  )}
                >
                  {formatTimeLocal(new Date(slot.start))}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <FieldLabel htmlFor="agendar-nome">Nome da cliente</FieldLabel>
        <input
          id="agendar-nome"
          required
          value={name}
          onChange={(event) => setDraft((d) => ({ ...d, name: event.target.value }))}
          placeholder="Nome e sobrenome"
          className={FIELD_CLASS}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <FieldLabel htmlFor="agendar-telefone">WhatsApp</FieldLabel>
        <PhoneInput
          id="agendar-telefone"
          required
          value={phone}
          onValueChange={(value) => setDraft((d) => ({ ...d, phone: value }))}
        />
      </div>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      <ToolButton type="submit" pending={submitting} pendingLabel="Agendando..." disabled={!selected}>
        <CalendarCheck2 className="size-4" aria-hidden />
        {selected
          ? `Agendar ${formatTimeLocal(new Date(selected))}`
          : "Escolha um horário"}
      </ToolButton>
    </form>
  );
}
