"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { CalendarIcon, Check, CheckCircle2, Copy, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { PhoneInput } from "@/components/ui/phone-input";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { formatDateLocal, formatDurationMin, formatPriceCents, formatTimeLocal } from "@/lib/format";
import { buildWhatsAppUrl } from "@/lib/whatsapp";
import { clientNameSchema, clientPhoneSchema } from "@/lib/validation";
import type { Service, Studio } from "@/lib/types";

interface Slot {
  start: string;
  end: string;
}

type Step = "service" | "datetime" | "details" | "success";

function dateToLocalYMD(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function todayStartOfDay(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Divisor picotado entre as seções do "ticket" — mordida circular que revela o
 * fundo da página, como o rasgo entre a via principal e o canhoto. */
function TicketDivider() {
  return (
    <div className="ticket-seam relative -mx-5 h-6" style={{ "--seam-bg": "var(--blush-50)" } as CSSProperties}>
      <span className="absolute inset-x-7 top-1/2 border-t border-dashed border-plum-900/15" />
    </div>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[0.7rem] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
      {children}
    </p>
  );
}

const FLOW_STEPS = ["Escolha", "Horário", "Seus dados"];

export function BookingFlow({ studio, services }: { studio: Studio; services: Service[] }) {
  const [step, setStep] = useState<Step>("service");
  const [service, setService] = useState<Service | null>(null);
  const [date, setDate] = useState<Date>(() => todayStartOfDay());
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [slotsError, setSlotsError] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);

  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [whatsappUrl, setWhatsappUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const [nextSlotByService, setNextSlotByService] = useState<Record<string, string | null>>({});
  const [scrolled, setScrolled] = useState(false);

  // Prévia de "próximo horário livre" por serviço, pra reduzir a incerteza antes
  // do clique. Usa o mesmo endpoint público de disponibilidade do restante do
  // fluxo — nenhuma rota nova, só mais chamadas em paralelo no primeiro load.
  useEffect(() => {
    let cancelled = false;
    async function loadNextSlots() {
      const todayYMD = dateToLocalYMD(todayStartOfDay());
      const entries = await Promise.all(
        services.map(async (svc) => {
          try {
            const params = new URLSearchParams({ slug: studio.slug, serviceId: svc.id, date: todayYMD });
            const res = await fetch(`/api/availability?${params.toString()}`);
            if (!res.ok) return [svc.id, null] as const;
            const data = await res.json();
            const first = Array.isArray(data.slots) && data.slots.length > 0 ? data.slots[0].start : null;
            return [svc.id, first] as const;
          } catch {
            return [svc.id, null] as const;
          }
        })
      );
      if (!cancelled) setNextSlotByService(Object.fromEntries(entries));
    }
    void loadNextSlots();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studio.slug]);

  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > 200);
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  async function fetchSlots(svc: Service, day: Date) {
    setLoadingSlots(true);
    setSlotsError(null);
    setSelectedSlot(null);
    try {
      const params = new URLSearchParams({
        slug: studio.slug,
        serviceId: svc.id,
        date: dateToLocalYMD(day),
      });
      const res = await fetch(`/api/availability?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao buscar horários");
      setSlots(data.slots);
    } catch (err) {
      setSlotsError(err instanceof Error ? err.message : "Erro ao buscar horários");
      setSlots([]);
    } finally {
      setLoadingSlots(false);
    }
  }

  function handleSelectService(svc: Service) {
    setService(svc);
    setStep("datetime");
    void fetchSlots(svc, date);
  }

  function backToServices() {
    setStep("service");
    setSelectedSlot(null);
  }

  function handleSelectDate(newDate: Date | undefined) {
    if (!newDate) return;
    setDate(newDate);
    setCalendarOpen(false);
    if (service) void fetchSlots(service, newDate);
  }

  function handleSelectSlot(slot: Slot) {
    setSelectedSlot(slot);
    setStep("details");
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
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        if (data.code === "conflict") {
          setFormError(data.error);
          setStep("datetime");
          void fetchSlots(service, date);
          return;
        }
        setFormError(data.error ?? "Não foi possível confirmar. Tente novamente.");
        return;
      }

      const url = buildWhatsAppUrl({
        whatsapp: data.whatsapp,
        serviceName: service.name,
        clientName: nameResult.data,
        startAt: new Date(data.booking.startAt),
      });
      setWhatsappUrl(url);
      setStep("success");
      window.open(url, "_blank", "noopener,noreferrer");
    } catch {
      setFormError("Erro de conexão. Verifique sua internet e tente novamente.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCopyMessage() {
    if (!whatsappUrl) return;
    try {
      await navigator.clipboard.writeText(whatsappUrl);
      setCopied(true);
      toast.success("Link copiado!");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Não foi possível copiar.");
    }
  }

  if (step === "success" && selectedSlot && service) {
    return (
      <div className="ticket-card relative overflow-hidden rounded-3xl bg-card shadow-xl shadow-plum-900/10 ring-1 ring-plum-900/5 animate-in fade-in-0 zoom-in-95 duration-300">
        <div className="flex flex-col items-center gap-3 p-6 text-center">
          <span className="flex size-14 animate-in zoom-in-50 items-center justify-center rounded-full bg-wa/15 text-wa duration-500 delay-150 fill-mode-backwards">
            <Check className="size-7" />
          </span>
          <div>
            <h2 className="font-heading text-2xl font-semibold text-plum-900">
              Agendamento confirmado!
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Guarde o comprovante abaixo
            </p>
          </div>
        </div>

        <TicketDivider />

        <div className="flex flex-col gap-4 p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <FieldLabel>Serviço</FieldLabel>
              <p className="font-heading text-lg font-semibold text-plum-900">{service.name}</p>
            </div>
            <p className="shrink-0 font-heading text-lg font-semibold text-violet-600">
              {formatPriceCents(service.price_cents)}
            </p>
          </div>
          <div className="flex items-center justify-between gap-3 border-t border-dashed border-border pt-4">
            <div>
              <FieldLabel>Data</FieldLabel>
              <p className="font-medium text-plum-900">{formatDateLocal(new Date(selectedSlot.start))}</p>
            </div>
            <div className="text-right">
              <FieldLabel>Horário</FieldLabel>
              <p className="font-medium text-plum-900">{formatTimeLocal(new Date(selectedSlot.start))}</p>
            </div>
          </div>

          <p className="mt-1 text-sm text-muted-foreground">
            Abrimos o WhatsApp em outra aba para você avisar {studio.name}. Se não abriu, use o
            link abaixo.
          </p>
          <div className="flex w-full flex-col gap-2 sm:flex-row">
            <Button
              render={<a href={whatsappUrl ?? "#"} target="_blank" rel="noopener noreferrer" />}
              className="flex-1 bg-wa text-white hover:opacity-90"
            >
              Abrir WhatsApp
            </Button>
            <Button variant="outline" onClick={handleCopyMessage} className="gap-2">
              {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
              Copiar link
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div
        className={cn(
          "fixed inset-x-0 top-0 z-40 flex items-center gap-2.5 border-b border-border bg-card/95 px-4 py-2.5 backdrop-blur transition-transform duration-200 supports-backdrop-filter:bg-card/85",
          scrolled ? "translate-y-0" : "-translate-y-full"
        )}
      >
        <span
          className="flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
          style={{ backgroundColor: studio.brand_color }}
        >
          {studio.name.slice(0, 1).toUpperCase()}
        </span>
        <p className="truncate text-sm font-medium text-plum-900">{studio.name}</p>
        {service && (
          <p className="ml-auto shrink-0 truncate text-xs text-muted-foreground">
            {service.name}
            {selectedSlot ? ` · ${formatTimeLocal(new Date(selectedSlot.start))}` : ""}
          </p>
        )}
      </div>

      <div className="ticket-card relative overflow-hidden rounded-[1.75rem] bg-card shadow-2xl shadow-violet-950/10 ring-1 ring-violet-950/5">
      <div className="border-b border-violet-950/6 bg-[linear-gradient(120deg,#fff_0%,#fbf8ff_52%,#f7f0ff_100%)] px-5 py-4 sm:px-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold tracking-[0.14em] text-violet-600 uppercase">Reserva inteligente</p>
            <p className="mt-0.5 text-sm text-muted-foreground">Leva menos de um minuto.</p>
          </div>
          <Sparkles className="size-5 text-magenta" />
        </div>
        <ol className="mt-4 grid grid-cols-3 gap-2" aria-label="Progresso da reserva">
          {FLOW_STEPS.map((label, index) => {
            const isActive = (step === "service" && index === 0) || (step === "datetime" && index === 1) || (step === "details" && index === 2);
            const isDone = (step === "datetime" && index === 0) || (step === "details" && index < 2);
            return <li key={label} className="min-w-0">
              <div className={cn("h-1 rounded-full transition-colors duration-500", isActive || isDone ? "bg-violet-600" : "bg-violet-950/8")} />
              <p className={cn("mt-1.5 truncate text-[10px] font-bold tracking-wide uppercase", isActive ? "text-violet-700" : isDone ? "text-violet-500" : "text-muted-foreground/60")}>{label}</p>
            </li>;
          })}
        </ol>
      </div>
      <div className="flex flex-col gap-3 p-5 sm:p-6">
        <div className="flex items-center justify-between">
          <FieldLabel>Escolha seu serviço</FieldLabel>
          {service && <button type="button" onClick={backToServices} className="text-xs font-semibold text-violet-600 hover:text-violet-800">Alterar</button>}
        </div>
        <div className="flex flex-col gap-2.5">
          {services.map((svc) => {
            const selected = service?.id === svc.id;
            const nextSlot = nextSlotByService[svc.id];
            return (
              <button
                key={svc.id}
                type="button"
                onClick={() => handleSelectService(svc)}
                className={cn(
                  "group flex items-center justify-between gap-3 rounded-2xl border p-3.5 text-left transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-violet-950/5",
                  selected
                    ? "border-violet-600 bg-violet-600/5 ring-1 ring-violet-600 shadow-md shadow-violet-950/5"
                    : "border-border hover:border-violet-500/50"
                )}
              >
                <div className="flex items-center gap-3">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-violet-950/[.04]" style={{ color: svc.color }}><span className="size-2.5 rounded-full shadow-[0_0_0_4px_currentColor]" style={{ backgroundColor: "currentColor" }} /></span>
                  <div>
                    <p className="font-medium text-plum-900">{svc.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {formatDurationMin(svc.duration_min)}
                      {nextSlot && (
                        <span className="text-violet-600"> · hoje às {formatTimeLocal(new Date(nextSlot))}</span>
                      )}
                    </p>
                  </div>
                </div>
                <p className="shrink-0 font-heading font-semibold text-violet-600 transition-transform group-hover:scale-105">
                  {formatPriceCents(svc.price_cents)}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {service && (
        <>
          <TicketDivider />
          <div className="flex flex-col gap-4 p-5 sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <div><FieldLabel>Data e horário</FieldLabel><p className="mt-1 text-sm text-muted-foreground">Escolha o melhor momento para você.</p></div>
              <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                <PopoverTrigger
                  render={<Button variant="outline" size="sm" className="gap-2" />}
                >
                  <CalendarIcon className="size-4" />
                  {formatDateLocal(date)}
                </PopoverTrigger>
                <PopoverContent align="end" className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={date}
                    onSelect={handleSelectDate}
                    disabled={{ before: todayStartOfDay() }}
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div>
              {loadingSlots && (
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <Skeleton key={i} className="h-9 rounded-xl" />
                  ))}
                </div>
              )}
              {!loadingSlots && slotsError && (
                <p className="text-sm text-destructive">{slotsError}</p>
              )}
              {!loadingSlots && !slotsError && slots.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  Nenhum horário livre neste dia. Escolha outra data.
                </p>
              )}
              {!loadingSlots && slots.length > 0 && (
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {slots.map((slot) => (
                    <button
                      key={slot.start}
                      type="button"
                      onClick={() => handleSelectSlot(slot)}
                      className={cn(
                        "rounded-xl border px-2 py-2 text-sm font-semibold tabular-nums transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md",
                        selectedSlot?.start === slot.start
                          ? "border-violet-600 bg-violet-600 text-white"
                          : "border-border hover:border-violet-500/50"
                      )}
                    >
                      {formatTimeLocal(new Date(slot.start))}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {step === "details" && service && selectedSlot && (
        <>
          <TicketDivider />
          <form
            id="booking-details-form"
            onSubmit={handleSubmit}
            className="flex flex-col gap-4 p-5 pb-2 sm:p-6 sm:pb-2"
          >
            <div className="flex items-center justify-between"><FieldLabel>Quase pronto</FieldLabel><span className="flex items-center gap-1 text-xs font-semibold text-wa"><CheckCircle2 className="size-3.5" /> horário reservado para você</span></div>
            <p className="-mt-2 text-sm text-muted-foreground">
              {service.name} · {formatDateLocal(date)} às {formatTimeLocal(new Date(selectedSlot.start))}
            </p>
            <div className="flex flex-col gap-2">
              <Label htmlFor="client_name">Seu nome</Label>
              <Input
                id="client_name"
                required
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="Maria Silva"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="client_phone">WhatsApp</Label>
              <PhoneInput
                id="client_phone"
                required
                value={clientPhone}
                onValueChange={setClientPhone}
              />
            </div>
            {formError && <p className="text-sm text-destructive">{formError}</p>}
          </form>
          {/* Espaçador pra o conteúdo não ficar escondido atrás da barra fixa abaixo. */}
          <div className="h-20" aria-hidden />
        </>
      )}
      </div>

      {step === "details" && service && selectedSlot && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur supports-backdrop-filter:bg-card/85">
          <div className="mx-auto flex max-w-lg items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-plum-900">{service.name}</p>
              <p className="truncate text-xs text-muted-foreground">
                {formatDateLocal(date)} às {formatTimeLocal(new Date(selectedSlot.start))}
              </p>
            </div>
            <Button
              type="submit"
              form="booking-details-form"
              disabled={submitting}
              className="shrink-0 bg-cta text-white hover:opacity-90"
            >
              {submitting ? "Confirmando..." : "Confirmar agendamento"}
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
