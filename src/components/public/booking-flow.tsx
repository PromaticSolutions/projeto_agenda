"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CalendarDays,
  CalendarPlus,
  CheckCircle2,
  ChevronRight,
  Clock,
  Loader2,
  MessageCircle,
  Search,
} from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { PhoneInput } from "@/components/ui/phone-input";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { formatDurationMin, formatPriceCents, formatTimeLocal } from "@/lib/format";
import { utcToLocalDate } from "@/lib/availability";
import {
  DAY_PERIOD_LABELS,
  dayParts,
  dayPeriodOf,
  formatLongDate,
  googleCalendarUrl,
  icsContent,
  relativeSlotLabel,
  type DayPeriod,
} from "@/lib/public-booking";
import { buildWhatsAppUrl } from "@/lib/whatsapp/link";
import { clientNameSchema, clientPhoneSchema } from "@/lib/validation";
import type { Service, Studio } from "@/lib/types";

interface Slot {
  start: string;
  end: string;
}

interface DayAvailability {
  date: string;
  slots: Slot[];
}

interface ConfirmedBooking {
  id: string;
  start: string;
  end: string;
  whatsappUrl: string;
}

type Step = "service" | "datetime" | "details" | "success";

const STEP_NUMBER: Record<Exclude<Step, "success">, number> = {
  service: 1,
  datetime: 2,
  details: 3,
};

/** Dias da faixa de datas. Três semanas cobrem quase toda marcação de salão. */
const WINDOW_DAYS = 21;

/** A partir de quantos serviços a lista ganha busca. */
const SEARCH_FROM = 7;

const PERIODS: DayPeriod[] = ["manha", "tarde", "noite"];

/** Classe do botão principal: a cor do estúdio, com o texto que contrasta nela. */
const BRAND_BUTTON =
  "inline-flex items-center justify-center gap-2 rounded-lg bg-[var(--brand)] px-5 py-3 text-sm font-semibold text-[var(--brand-fg)] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50";

const OUTLINE_BUTTON =
  "inline-flex items-center justify-center gap-2 rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted";

function todayLocal(): string {
  return utcToLocalDate(new Date());
}

/** Date do calendário (meia-noite local do navegador) → "YYYY-MM-DD". */
function pickerDateToYmd(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function ymdToPickerDate(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function BookingFlow({
  studio,
  services,
  nextSlots,
}: {
  studio: Studio;
  services: Service[];
  /** Primeiro horário livre de cada serviço, calculado no servidor. */
  nextSlots: Record<string, string | null>;
}) {
  const [step, setStep] = useState<Step>("service");
  const [service, setService] = useState<Service | null>(null);
  const [query, setQuery] = useState("");

  const [days, setDays] = useState<DayAvailability[]>([]);
  const [loadingDays, setLoadingDays] = useState(false);
  const [daysError, setDaysError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [calendarOpen, setCalendarOpen] = useState(false);

  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  /* Nasce DESMARCADO e assim tem que ficar. Caixa pré-marcada não é
     consentimento livre — é o exemplo clássico do que a LGPD não aceita. */
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [booking, setBooking] = useState<ConfirmedBooking | null>(null);

  const topRef = useRef<HTMLDivElement>(null);
  const firstRender = useRef(true);
  // Só a resposta da ÚLTIMA busca vale: trocar de serviço ou de data rápido
  // demais faria uma resposta antiga sobrescrever a nova.
  const requestId = useRef(0);

  // A cada troca de passo, volta ao topo do fluxo — no celular o passo novo
  // nasceria fora da tela, lá embaixo de onde a pessoa tocou.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [step]);

  const visibleServices = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? services.filter((s) => s.name.toLowerCase().includes(q)) : services;
  }, [query, services]);

  const selectedDay = days.find((d) => d.date === selectedDate) ?? null;

  async function loadWindow(svc: Service, from: string, prefer?: string | null) {
    const id = ++requestId.current;
    setLoadingDays(true);
    setDaysError(null);
    setSelectedSlot(null);
    try {
      const params = new URLSearchParams({
        slug: studio.slug,
        serviceId: svc.id,
        date: from,
        days: String(WINDOW_DAYS),
      });
      const res = await fetch(`/api/availability?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao buscar horários");
      if (id !== requestId.current) return;
      const loaded: DayAvailability[] = data.days ?? [];
      setDays(loaded);
      // Abre no dia pedido se ele tiver horário; senão, no primeiro dia livre.
      const preferred = loaded.find((d) => d.date === prefer && d.slots.length > 0);
      const firstFree = loaded.find((d) => d.slots.length > 0);
      setSelectedDate(preferred?.date ?? firstFree?.date ?? prefer ?? from);
    } catch (err) {
      if (id !== requestId.current) return;
      setDays([]);
      setDaysError(err instanceof Error ? err.message : "Erro ao buscar horários");
    } finally {
      if (id === requestId.current) setLoadingDays(false);
    }
  }

  function chooseService(svc: Service) {
    setService(svc);
    setFormError(null);
    setStep("datetime");
    void loadWindow(svc, todayLocal());
  }

  function chooseSlot(slot: Slot) {
    setSelectedSlot(slot);
    setFormError(null);
    setStep("details");
  }

  function pickOtherDate(date: Date | undefined) {
    if (!date || !service) return;
    setCalendarOpen(false);
    const ymd = pickerDateToYmd(date);
    void loadWindow(service, ymd, ymd);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    const nameResult = clientNameSchema.safeParse(clientName);
    if (!nameResult.success) {
      setFormError(nameResult.error.issues[0]?.message ?? "Nome inválido");
      return;
    }
    const phoneResult = clientPhoneSchema.safeParse(clientPhone);
    if (!phoneResult.success) {
      setFormError(phoneResult.error.issues[0]?.message ?? "Telefone inválido");
      return;
    }
    /* Checagem no cliente só para a mensagem sair na hora. Quem manda é o
       `createBookingSchema` no servidor: sem `privacyAccepted: true` a API
       responde 400 e nenhum agendamento é criado. */
    if (!privacyAccepted) {
      setFormError("Para agendar, é preciso aceitar a Política de Privacidade.");
      return;
    }
    if (!service || !selectedSlot) return;

    setSubmitting(true);
    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: studio.slug,
          serviceId: service.id,
          clientName: nameResult.data,
          clientPhone: phoneResult.data,
          startAt: selectedSlot.start,
          privacyAccepted,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        if (data.code === "conflict") {
          // Alguém pegou o horário entre a escolha e a confirmação: volta para
          // a grade, já atualizada, com o motivo visível.
          setFormError(data.error);
          setStep("datetime");
          void loadWindow(service, days[0]?.date ?? todayLocal(), selectedDate);
          return;
        }
        setFormError(data.error ?? "Não foi possível confirmar. Tente novamente.");
        return;
      }

      setBooking({
        id: data.booking.id,
        start: data.booking.startAt,
        end: data.booking.endAt,
        whatsappUrl: buildWhatsAppUrl({
          whatsapp: data.whatsapp,
          serviceName: service.name,
          clientName: nameResult.data,
          startAt: new Date(data.booking.startAt),
        }),
      });
      setStep("success");
    } catch {
      setFormError("Erro de conexão. Verifique sua internet e tente novamente.");
    } finally {
      setSubmitting(false);
    }
  }

  function startOver() {
    setStep("service");
    setService(null);
    setSelectedSlot(null);
    setSelectedDate(null);
    setDays([]);
    setBooking(null);
    setFormError(null);
  }

  if (step === "success" && booking && service) {
    return (
      <div ref={topRef} className="scroll-mt-4 px-4">
        <SuccessView studio={studio} service={service} booking={booking} onStartOver={startOver} />
      </div>
    );
  }

  return (
    <div
      ref={topRef}
      className="mx-auto grid w-full max-w-5xl scroll-mt-4 gap-8 px-4 lg:grid-cols-[minmax(0,1fr)_300px]"
    >
      <section className="min-w-0">
        <StepHeader
          step={step as Exclude<Step, "success">}
          onBack={
            step === "datetime"
              ? () => setStep("service")
              : step === "details"
                ? () => setStep("datetime")
                : undefined
          }
        />

        {step === "service" && (
          <div className="flex flex-col gap-3">
            {services.length >= SEARCH_FROM && (
              <div className="relative">
                <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Buscar serviço"
                  aria-label="Buscar serviço"
                  className="h-11 pl-9"
                />
              </div>
            )}

            {visibleServices.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Nenhum serviço com esse nome.
              </p>
            ) : (
              <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border">
                {visibleServices.map((svc) => {
                  const next = nextSlots[svc.id];
                  return (
                    <li key={svc.id}>
                      <button
                        type="button"
                        onClick={() => chooseService(svc)}
                        className="flex w-full items-center gap-4 px-4 py-4 text-left transition-colors hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:outline-none"
                      >
                        <span
                          className="size-2.5 shrink-0 rounded-full"
                          style={{ backgroundColor: svc.color }}
                          aria-hidden
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block font-medium text-foreground">{svc.name}</span>
                          <span className="mt-0.5 flex flex-col gap-0.5 text-sm text-muted-foreground sm:flex-row sm:items-center sm:gap-2">
                            <span className="inline-flex items-center gap-1">
                              <Clock className="size-3.5" aria-hidden />
                              {formatDurationMin(svc.duration_min)}
                            </span>
                            <span aria-hidden className="hidden sm:inline">
                              ·
                            </span>
                            {next ? (
                              <span className="text-foreground/80">Próximo: {relativeSlotLabel(next)}</span>
                            ) : (
                              <span>sem horário nos próximos dias</span>
                            )}
                          </span>
                        </span>
                        <span className="shrink-0 font-semibold tabular-nums text-foreground">
                          {formatPriceCents(svc.price_cents)}
                        </span>
                        <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}

        {step === "datetime" && service && (
          <div className="flex flex-col gap-6">
            <ServiceRecap service={service} onChange={() => setStep("service")} className="lg:hidden" />

            {formError && (
              <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                {formError}
              </p>
            )}

            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-medium text-foreground">Dia</p>
                <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                  <PopoverTrigger
                    render={
                      <button
                        type="button"
                        className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground underline-offset-4 hover:underline"
                      />
                    }
                  >
                    <CalendarDays className="size-4" aria-hidden />
                    Outra data
                  </PopoverTrigger>
                  <PopoverContent align="end" className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={selectedDate ? ymdToPickerDate(selectedDate) : undefined}
                      onSelect={pickOtherDate}
                      disabled={{ before: ymdToPickerDate(todayLocal()) }}
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <DateStrip
                days={days}
                loading={loadingDays}
                selected={selectedDate}
                onSelect={(date) => {
                  setSelectedDate(date);
                  setSelectedSlot(null);
                }}
              />
            </div>

            <div className="flex flex-col gap-4">
              {loadingDays ? (
                <SlotsSkeleton />
              ) : daysError ? (
                <div className="flex flex-col items-start gap-3 rounded-xl border border-border p-5">
                  <p className="text-sm text-destructive">{daysError}</p>
                  <button
                    type="button"
                    onClick={() => void loadWindow(service, days[0]?.date ?? todayLocal(), selectedDate)}
                    className={OUTLINE_BUTTON}
                  >
                    Tentar de novo
                  </button>
                </div>
              ) : selectedDay && selectedDay.slots.length > 0 ? (
                <>
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="text-sm font-medium text-foreground first-letter:uppercase">
                      {formatLongDate(selectedDay.date)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {selectedDay.slots.length} horário{selectedDay.slots.length === 1 ? "" : "s"} livre
                      {selectedDay.slots.length === 1 ? "" : "s"}
                    </p>
                  </div>
                  <SlotGroups
                    slots={selectedDay.slots}
                    selected={selectedSlot?.start ?? null}
                    onSelect={chooseSlot}
                  />
                </>
              ) : (
                <EmptyDay
                  hasAnyDay={days.some((d) => d.slots.length > 0)}
                  whatsapp={studio.whatsapp}
                  onNextFree={() => {
                    const next = days.find((d) => d.slots.length > 0 && d.date > (selectedDate ?? ""));
                    const first = days.find((d) => d.slots.length > 0);
                    setSelectedDate((next ?? first)?.date ?? null);
                  }}
                />
              )}
            </div>
          </div>
        )}

        {step === "details" && service && selectedSlot && (
          <form onSubmit={handleSubmit} className="flex flex-col gap-6" noValidate>
            <dl className="divide-y divide-border rounded-xl border border-border lg:hidden">
              <RecapRow label="Serviço" value={service.name} onChange={() => setStep("service")} />
              <RecapRow
                label="Quando"
                value={`${formatLongDate(utcToLocalDate(new Date(selectedSlot.start)))} às ${formatTimeLocal(new Date(selectedSlot.start))}`}
                onChange={() => setStep("datetime")}
              />
              <RecapRow
                label="Valor"
                value={`${formatPriceCents(service.price_cents)} · ${formatDurationMin(service.duration_min)}`}
              />
            </dl>

            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="client_name">Seu nome</Label>
                <Input
                  id="client_name"
                  autoComplete="name"
                  required
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  placeholder="Como você quer ser chamada"
                  className="h-11"
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="client_phone">WhatsApp</Label>
                <PhoneInput
                  id="client_phone"
                  autoComplete="tel-national"
                  required
                  value={clientPhone}
                  onValueChange={setClientPhone}
                  placeholder="(11) 91234-5678"
                  className="h-11"
                />
                <p className="text-xs text-muted-foreground">
                  É por ele que {studio.name} confirma e lembra você do horário.
                </p>
              </div>
            </div>

            {/* Mesma anatomia do aceite em `landing/contact-form.tsx`: input
                nativo dentro de um label, com `accent-[var(--primary)]`. */}
            <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border p-4 text-sm leading-5 text-muted-foreground">
              <input
                type="checkbox"
                checked={privacyAccepted}
                onChange={(e) => setPrivacyAccepted(e.target.checked)}
                className="mt-0.5 size-4 shrink-0 accent-[var(--brand)]"
              />
              <span>
                Li e concordo com a{" "}
                {/* Nova aba de propósito: navegar para fora aqui jogaria fora
                    a escolha de serviço e de horário. */}
                <Link
                  href="/politica-de-privacidade"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-foreground underline underline-offset-2"
                >
                  Política de Privacidade
                </Link>
                . Seus dados são usados por {studio.name} para o atendimento e para a confirmação no
                WhatsApp.
              </span>
            </label>

            {formError && (
              <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                {formError}
              </p>
            )}

            <button
              type="submit"
              /* Desabilitado enquanto falta o aceite: o motivo está logo
                 acima, na própria caixa, então o botão inerte não vira
                 mistério. */
              disabled={submitting || !privacyAccepted}
              className={cn(BRAND_BUTTON, "w-full py-3.5 text-base")}
            >
              {submitting && <Loader2 className="size-4 animate-spin" />}
              {submitting ? "Confirmando..." : "Confirmar agendamento"}
            </button>
          </form>
        )}
      </section>

      <aside className="hidden lg:block">
        <div className="sticky top-6 flex flex-col gap-4 rounded-xl border border-border p-5">
          <p className="text-sm font-semibold text-foreground">Seu agendamento</p>
          <dl className="flex flex-col gap-3 text-sm">
            <SummaryItem label="Serviço" value={service?.name ?? null} />
            <SummaryItem
              label="Dia"
              value={
                selectedSlot
                  ? formatLongDate(utcToLocalDate(new Date(selectedSlot.start)))
                  : step === "datetime" && selectedDate
                    ? formatLongDate(selectedDate)
                    : null
              }
            />
            <SummaryItem
              label="Horário"
              value={selectedSlot ? formatTimeLocal(new Date(selectedSlot.start)) : null}
            />
            <SummaryItem
              label="Duração"
              value={service ? formatDurationMin(service.duration_min) : null}
            />
          </dl>
          <div className="flex items-baseline justify-between border-t border-border pt-4">
            <span className="text-sm text-muted-foreground">Total</span>
            <span className="text-lg font-semibold tabular-nums text-foreground">
              {service ? formatPriceCents(service.price_cents) : "—"}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">O pagamento é feito no estúdio.</p>
        </div>
      </aside>
    </div>
  );
}

// --- Peças -------------------------------------------------------------------

const STEP_TITLES: Record<Exclude<Step, "success">, string> = {
  service: "Escolha o serviço",
  datetime: "Escolha o dia e o horário",
  details: "Seus dados",
};

function StepHeader({ step, onBack }: { step: Exclude<Step, "success">; onBack?: () => void }) {
  const current = STEP_NUMBER[step];
  return (
    <div className="mb-6 flex flex-col gap-4">
      <div className="flex items-center gap-3">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            aria-label="Voltar"
            className="flex size-9 shrink-0 items-center justify-center rounded-full border border-border text-foreground transition-colors hover:bg-muted"
          >
            <ArrowLeft className="size-4" />
          </button>
        )}
        <div>
          <p className="text-xs font-medium text-muted-foreground">Passo {current} de 3</p>
          <h2 className="text-lg font-semibold text-foreground sm:text-xl">{STEP_TITLES[step]}</h2>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-1.5" aria-hidden>
        {[1, 2, 3].map((n) => (
          <span
            key={n}
            className={cn(
              "h-1 rounded-full transition-colors duration-300",
              n <= current ? "bg-[var(--brand)]" : "bg-border"
            )}
          />
        ))}
      </div>
    </div>
  );
}

function ServiceRecap({
  service,
  onChange,
  className,
}: {
  service: Service;
  onChange: () => void;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-3 rounded-xl border border-border px-4 py-3", className)}>
      <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: service.color }} aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">{service.name}</p>
        <p className="text-xs text-muted-foreground">
          {formatDurationMin(service.duration_min)} · {formatPriceCents(service.price_cents)}
        </p>
      </div>
      <button type="button" onClick={onChange} className="text-sm font-medium text-foreground underline underline-offset-4">
        Trocar
      </button>
    </div>
  );
}

function DateStrip({
  days,
  loading,
  selected,
  onSelect,
}: {
  days: DayAvailability[];
  loading: boolean;
  selected: string | null;
  onSelect: (date: string) => void;
}) {
  const stripRef = useRef<HTMLDivElement>(null);
  const today = todayLocal();

  // Mantém o dia escolhido à vista quando ele cai fora da faixa visível (por
  // exemplo, quando o primeiro dia livre é daqui a duas semanas).
  useEffect(() => {
    if (!selected) return;
    const el = stripRef.current?.querySelector<HTMLElement>(`[data-date="${selected}"]`);
    el?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
  }, [selected, days]);

  if (loading && days.length === 0) {
    return (
      <div className="flex gap-2 overflow-hidden">
        {Array.from({ length: 7 }).map((_, i) => (
          <Skeleton key={i} className="h-[4.5rem] w-14 shrink-0 rounded-lg" />
        ))}
      </div>
    );
  }

  return (
    <div
      ref={stripRef}
      role="listbox"
      aria-label="Dias disponíveis"
      className={cn(
        "-mx-4 flex snap-x scroll-px-4 gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        loading && "opacity-60"
      )}
    >
      {days.map((day) => {
        const parts = dayParts(day.date);
        const free = day.slots.length > 0;
        const isSelected = day.date === selected;
        return (
          <button
            key={day.date}
            type="button"
            role="option"
            aria-selected={isSelected}
            data-date={day.date}
            disabled={!free}
            onClick={() => onSelect(day.date)}
            title={free ? undefined : "Sem horário livre"}
            className={cn(
              "flex w-14 shrink-0 snap-start flex-col items-center rounded-lg border py-2 transition-colors",
              isSelected
                ? "border-[var(--brand)] bg-[var(--brand)] text-[var(--brand-fg)]"
                : free
                  ? "border-border text-foreground hover:border-foreground/40"
                  : "cursor-not-allowed border-transparent text-muted-foreground/50"
            )}
          >
            <span className="text-[11px] font-medium uppercase">
              {day.date === today ? "hoje" : parts.weekday}
            </span>
            <span className={cn("text-lg font-semibold leading-tight tabular-nums", !free && "line-through")}>
              {parts.day}
            </span>
            <span className="text-[11px]">{parts.month}</span>
          </button>
        );
      })}
    </div>
  );
}

function SlotGroups({
  slots,
  selected,
  onSelect,
}: {
  slots: Slot[];
  selected: string | null;
  onSelect: (slot: Slot) => void;
}) {
  const grouped = PERIODS.map((period) => ({
    period,
    slots: slots.filter((slot) => dayPeriodOf(slot.start) === period),
  })).filter((group) => group.slots.length > 0);

  return (
    <div className="flex flex-col gap-5">
      {grouped.map((group) => (
        <div key={group.period} className="flex flex-col gap-2">
          <p className="text-xs font-medium text-muted-foreground">{DAY_PERIOD_LABELS[group.period]}</p>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
            {group.slots.map((slot) => {
              const isSelected = selected === slot.start;
              return (
                <button
                  key={slot.start}
                  type="button"
                  onClick={() => onSelect(slot)}
                  className={cn(
                    "rounded-lg border py-2.5 text-sm font-semibold tabular-nums transition-colors",
                    isSelected
                      ? "border-[var(--brand)] bg-[var(--brand)] text-[var(--brand-fg)]"
                      : "border-border text-foreground hover:border-[var(--brand)]"
                  )}
                >
                  {formatTimeLocal(new Date(slot.start))}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function SlotsSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      <Skeleton className="h-4 w-40" />
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
        {Array.from({ length: 10 }).map((_, i) => (
          <Skeleton key={i} className="h-10 rounded-lg" />
        ))}
      </div>
    </div>
  );
}

function EmptyDay({
  hasAnyDay,
  whatsapp,
  onNextFree,
}: {
  hasAnyDay: boolean;
  whatsapp: string;
  onNextFree: () => void;
}) {
  return (
    <div className="flex flex-col items-start gap-3 rounded-xl border border-dashed border-border p-5">
      <p className="text-sm text-foreground">
        {hasAnyDay
          ? "Nenhum horário livre neste dia."
          : `Nenhum horário livre nos próximos ${WINDOW_DAYS} dias.`}
      </p>
      <p className="text-sm text-muted-foreground">
        {hasAnyDay
          ? "Veja o próximo dia com vaga ou escolha outra data."
          : "Tente “Outra data” mais à frente, ou fale direto com o estúdio."}
      </p>
      <div className="flex flex-wrap gap-2">
        {hasAnyDay && (
          <button type="button" onClick={onNextFree} className={OUTLINE_BUTTON}>
            Próximo dia livre
          </button>
        )}
        <a
          href={`https://wa.me/${whatsapp}`}
          target="_blank"
          rel="noopener noreferrer"
          className={OUTLINE_BUTTON}
        >
          <MessageCircle className="size-4 text-wa" aria-hidden />
          Falar no WhatsApp
        </a>
      </div>
    </div>
  );
}

function RecapRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange?: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3">
      <div className="min-w-0">
        <dt className="text-xs text-muted-foreground">{label}</dt>
        <dd className="text-sm font-medium text-foreground first-letter:uppercase">{value}</dd>
      </div>
      {onChange && (
        <button
          type="button"
          onClick={onChange}
          className="shrink-0 text-sm font-medium text-foreground underline underline-offset-4"
        >
          Alterar
        </button>
      )}
    </div>
  );
}

function SummaryItem({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={cn("first-letter:uppercase", value ? "text-foreground" : "text-muted-foreground/60")}>
        {value ?? "—"}
      </dd>
    </div>
  );
}

function SuccessView({
  studio,
  service,
  booking,
  onStartOver,
}: {
  studio: Studio;
  service: Service;
  booking: ConfirmedBooking;
  onStartOver: () => void;
}) {
  const start = new Date(booking.start);
  const event = {
    title: `${service.name} — ${studio.name}`,
    details: `Agendado pelo link de ${studio.name}. Para remarcar, fale com o estúdio no WhatsApp.`,
    start,
    end: new Date(booking.end),
  };

  function downloadIcs() {
    const blob = new Blob([icsContent(event, `${booking.id}@timely`)], {
      type: "text/calendar;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "agendamento.ics";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-6 py-4 animate-in fade-in-0 duration-300">
      <div className="flex flex-col items-center gap-3 text-center">
        <CheckCircle2 className="size-12 text-wa" aria-hidden />
        <div>
          <h2 className="text-2xl font-semibold text-foreground">Agendamento confirmado</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Seu horário em {studio.name} está reservado.
          </p>
        </div>
      </div>

      <dl className="divide-y divide-border rounded-xl border border-border">
        <RecapRow label="Serviço" value={service.name} />
        <RecapRow label="Dia" value={formatLongDate(utcToLocalDate(start))} />
        <RecapRow
          label="Horário"
          value={`${formatTimeLocal(start)} · ${formatDurationMin(service.duration_min)}`}
        />
        <RecapRow label="Valor" value={`${formatPriceCents(service.price_cents)} · pago no estúdio`} />
      </dl>

      <div className="flex flex-col gap-3">
        <a
          href={booking.whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-wa px-5 py-3.5 text-base font-semibold text-white transition-opacity hover:opacity-90"
        >
          <MessageCircle className="size-5" aria-hidden />
          Avisar {studio.name} no WhatsApp
        </a>
        <div className="grid grid-cols-2 gap-2">
          <a
            href={googleCalendarUrl(event)}
            target="_blank"
            rel="noopener noreferrer"
            className={OUTLINE_BUTTON}
          >
            <CalendarPlus className="size-4" aria-hidden />
            Google Agenda
          </a>
          <button type="button" onClick={downloadIcs} className={OUTLINE_BUTTON}>
            <CalendarPlus className="size-4" aria-hidden />
            iPhone / Outlook
          </button>
        </div>
      </div>

      <button
        type="button"
        onClick={onStartOver}
        className="self-center text-sm font-medium text-muted-foreground underline underline-offset-4 hover:text-foreground"
      >
        Fazer outro agendamento
      </button>
    </div>
  );
}
