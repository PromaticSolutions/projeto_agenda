"use client";

import { useEffect, useState } from "react";
import { CalendarCheck2, CalendarSearch, ChevronLeft, ChevronRight, Send } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useConversationTools } from "@/components/app/conversation-workspace";
import {
  FieldLabel,
  ServiceSelect,
  ToolButton,
  WithTools,
  dayOfMonth,
  formatDayLabel,
  formatWeekdayShort,
} from "@/components/app/conversation-tools/shared";
import {
  EMPTY_BOOKING_DRAFT,
  type BookingDraft,
} from "@/components/app/conversation-tools/booking-tool";
import type { ToolsData } from "@/components/app/conversation-tools/use-tools-data";
import {
  listWeekSlotsAction,
  sendConversationTextAction,
  type ConversationTools,
  type WeekSlotsResult,
} from "@/app/app/(dashboard)/conversations/actions";
import { addLocalDays, utcToLocalDate } from "@/lib/availability";
import { buildSlotsMessage } from "@/lib/conversation-messages";
import { useChatDraft } from "@/lib/chat-drafts";
import { formatDurationMin, formatTimeLocal } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Consultar a agenda pela conversa.
 *
 * A seção do painel escolhe o serviço (a duração muda os horários livres) e
 * abre o modal com a semana: um dia por coluna, os horários livres do dia
 * escolhido embaixo. Dali dá para:
 *  - marcar alguns horários e mandá-los à cliente como opções, ou
 *  - escolher um e ir direto para o agendamento, já preenchido.
 *
 * Os horários são os mesmos da página pública (`listWeekSlotsAction` usa a
 * mesma grade), então o que se oferece aqui é o que ela conseguiria marcar.
 */

const DAYS_PER_PAGE = 7;

export function AvailabilityTool({ data }: { data: ToolsData }) {
  return <WithTools data={data}>{(tools) => <AvailabilityLauncher tools={tools} />}</WithTools>;
}

function AvailabilityLauncher({ tools }: { tools: ConversationTools }) {
  const { contact } = useConversationTools()!;
  const [serviceId, setServiceId] = useChatDraft<string | null>(contact.chatId, "disponibilidade-servico", null);
  const [open, setOpen] = useState(false);
  const service = tools.services.find((item) => item.id === serviceId) ?? tools.services[0]!;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <FieldLabel htmlFor="disponibilidade-servico">Para qual atendimento?</FieldLabel>
        <ServiceSelect
          id="disponibilidade-servico"
          services={tools.services}
          value={service.id}
          onChange={setServiceId}
        />
        <p className="text-xs text-muted-foreground">
          Duração de {formatDurationMin(service.durationMin)}: só aparecem horários em que cabe.
        </p>
      </div>
      <ToolButton onClick={() => setOpen(true)}>
        <CalendarSearch className="size-4" aria-hidden />
        Ver dias e horários
      </ToolButton>

      <AvailabilityDialog
        open={open}
        onOpenChange={setOpen}
        tools={tools}
        serviceId={service.id}
        onServiceChange={setServiceId}
      />
    </div>
  );
}

function AvailabilityDialog({
  open,
  onOpenChange,
  tools,
  serviceId,
  onServiceChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tools: ConversationTools;
  serviceId: string;
  onServiceChange: (serviceId: string) => void;
}) {
  const context = useConversationTools()!;
  const { contact, openTool, sendBlockedReason } = context;
  const [, setBookingDraft] = useChatDraft<BookingDraft>(contact.chatId, "agendamento", EMPTY_BOOKING_DRAFT);
  const [today] = useState(() => utcToLocalDate(new Date()));
  const [page, setPage] = useState(0);
  const [activeDate, setActiveDate] = useState<string | null>(null);
  /** Horários marcados, por início ISO — valem entre dias e semanas. */
  const [picked, setPicked] = useState<string[]>([]);
  const [sending, setSending] = useState(false);

  const service = tools.services.find((item) => item.id === serviceId)!;
  const start = addLocalDays(today, page * DAYS_PER_PAGE);
  const key = `${serviceId}|${start}`;

  const [week, setWeek] = useState<{ key: string; result: WeekSlotsResult } | null>(null);
  useEffect(() => {
    if (!open) return;
    let alive = true;
    const [id, from] = key.split("|");
    void listWeekSlotsAction(id!, from!, DAYS_PER_PAGE).then((result) => {
      if (alive) setWeek({ key, result });
    });
    return () => {
      alive = false;
    };
  }, [key, open]);

  const loading = week?.key !== key;
  const days = !loading && week.result.ok ? week.result.days : [];
  // Dia aberto: o escolhido, se for desta semana; senão o primeiro com vaga.
  const currentDay =
    days.find((day) => day.date === activeDate) ??
    days.find((day) => day.slots.length > 0) ??
    days[0] ??
    null;

  function toggle(slotStart: string) {
    setPicked((current) =>
      current.includes(slotStart) ? current.filter((item) => item !== slotStart) : [...current, slotStart]
    );
  }

  function changeService(next: string) {
    onServiceChange(next);
    setPicked([]);
  }

  async function sendOptions() {
    const byDay = new Map<string, string[]>();
    for (const iso of [...picked].sort()) {
      const day = utcToLocalDate(new Date(iso));
      byDay.set(day, [...(byDay.get(day) ?? []), formatTimeLocal(new Date(iso))]);
    }
    const text = buildSlotsMessage(
      service.name,
      [...byDay.entries()].map(([day, times]) => ({ label: formatDayLabel(day), times }))
    );
    setSending(true);
    const result = await sendConversationTextAction(contact.chatId, text);
    setSending(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Horários enviados na conversa.");
    setPicked([]);
    onOpenChange(false);
  }

  function scheduleThis() {
    const iso = picked[0]!;
    setBookingDraft((draft) => ({
      ...draft,
      serviceId,
      date: utcToLocalDate(new Date(iso)),
      start: iso,
      done: null,
    }));
    setPicked([]);
    onOpenChange(false);
    openTool("agendar");
  }

  const rangeLabel = `${formatDayLabel(start)} a ${formatDayLabel(addLocalDays(start, DAYS_PER_PAGE - 1))}`.replace(
    /^./,
    (first) => first.toUpperCase()
  );

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) setPicked([]);
      }}
    >
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Disponibilidade</DialogTitle>
          <DialogDescription>
            Dias e horários livres para {contact.name.split(/\s+/)[0]}. Marque os horários para enviar
            como opções, ou escolha um para agendar.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex min-w-48 flex-1 flex-col gap-1.5">
              <FieldLabel htmlFor="modal-servico">Atendimento</FieldLabel>
              <ServiceSelect id="modal-servico" services={tools.services} value={serviceId} onChange={changeService} />
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon-lg"
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                aria-label="Semana anterior"
              >
                <ChevronLeft className="size-4" />
              </Button>
              <span className="min-w-40 text-center text-sm font-medium text-foreground tabular-nums">
                {rangeLabel}
              </span>
              <Button
                variant="outline"
                size="icon-lg"
                onClick={() => setPage((p) => p + 1)}
                disabled={page >= 7}
                aria-label="Próxima semana"
              >
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>

          {loading ? (
            <>
              <div className="grid grid-cols-7 gap-1.5">
                {Array.from({ length: DAYS_PER_PAGE }).map((_, i) => (
                  <Skeleton key={i} className="h-[4.5rem] rounded-xl" />
                ))}
              </div>
              <Skeleton className="h-28 rounded-xl" />
            </>
          ) : !week.result.ok ? (
            <p className="text-sm text-destructive">{week.result.error}</p>
          ) : (
            <>
              <div className="grid grid-cols-7 gap-1.5" role="tablist" aria-label="Dias">
                {days.map((day) => {
                  const active = day.date === currentDay?.date;
                  const count = day.slots.length;
                  const pickedHere = picked.filter((iso) => utcToLocalDate(new Date(iso)) === day.date).length;
                  return (
                    <button
                      key={day.date}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      onClick={() => setActiveDate(day.date)}
                      className={cn(
                        "relative flex flex-col items-center gap-0.5 rounded-xl border px-1 py-2 outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50",
                        active
                          ? "border-primary bg-primary text-primary-foreground shadow-float"
                          : count > 0
                            ? "border-border bg-card text-foreground hover:border-primary/50"
                            : "border-dashed border-border bg-muted/40 text-muted-foreground"
                      )}
                    >
                      <span className={cn("text-[0.625rem] font-semibold uppercase", !active && "text-muted-foreground")}>
                        {day.date === today ? "Hoje" : formatWeekdayShort(day.date)}
                      </span>
                      <span className="text-lg leading-6 font-semibold tabular-nums">{dayOfMonth(day.date)}</span>
                      <span
                        className={cn(
                          "text-[0.625rem] tabular-nums",
                          active ? "text-primary-foreground/85" : "text-muted-foreground"
                        )}
                      >
                        {count > 0 ? `${count} livre${count > 1 ? "s" : ""}` : "—"}
                      </span>
                      {pickedHere > 0 && (
                        <span className="absolute -top-1.5 -right-1.5 flex size-5 items-center justify-center rounded-full bg-cta text-[0.625rem] font-bold text-primary-foreground ring-2 ring-popover">
                          {pickedHere}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              <div className="rounded-xl border border-border bg-muted/30 p-3" role="tabpanel">
                {currentDay && (
                  <p className="mb-2.5 text-sm font-semibold text-foreground capitalize">
                    {formatDayLabel(currentDay.date)}
                  </p>
                )}
                {!currentDay || currentDay.slots.length === 0 ? (
                  <p className="py-4 text-center text-sm text-muted-foreground">
                    Sem horário livre neste dia.
                  </p>
                ) : (
                  <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-6">
                    {currentDay.slots.map((slot) => {
                      const active = picked.includes(slot.start);
                      return (
                        <button
                          key={slot.start}
                          type="button"
                          aria-pressed={active}
                          onClick={() => toggle(slot.start)}
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
            </>
          )}
        </div>

        <DialogFooter className="sm:items-center">
          <p className="text-sm text-muted-foreground sm:mr-auto">
            {picked.length === 0
              ? "Toque nos horários para marcar."
              : `${picked.length} horário${picked.length > 1 ? "s" : ""} marcado${picked.length > 1 ? "s" : ""}`}
          </p>
          <Button variant="outline" onClick={scheduleThis} disabled={picked.length !== 1} className="h-9">
            <CalendarCheck2 className="size-4" />
            Agendar este horário
          </Button>
          <Button
            onClick={sendOptions}
            disabled={picked.length === 0 || sending || Boolean(sendBlockedReason)}
            title={sendBlockedReason ?? undefined}
            className="h-9 bg-cta text-primary-foreground hover:opacity-90"
          >
            <Send className="size-4" />
            {sending ? "Enviando..." : "Enviar na conversa"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
