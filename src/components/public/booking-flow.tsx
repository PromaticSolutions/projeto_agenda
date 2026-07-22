"use client";

import { useState } from "react";
import { CalendarIcon, Check, Copy, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { PhoneInput } from "@/components/ui/phone-input";
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
      <div className="mx-auto flex max-w-md flex-col items-center gap-4 rounded-xl border border-border bg-card p-6 text-center">
        <span className="flex size-12 items-center justify-center rounded-full bg-wa/15 text-wa">
          <Check className="size-6" />
        </span>
        <div>
          <h2 className="font-heading text-xl font-semibold">Agendamento confirmado!</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {service.name} · {formatDateLocal(new Date(selectedSlot.start))} às{" "}
            {formatTimeLocal(new Date(selectedSlot.start))}
          </p>
        </div>
        <p className="text-sm text-muted-foreground">
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
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        {services.map((svc) => {
          const selected = service?.id === svc.id;
          return (
            <button
              key={svc.id}
              type="button"
              onClick={() => handleSelectService(svc)}
              className={cn(
                "flex items-center justify-between gap-3 rounded-xl border p-4 text-left transition-colors",
                selected
                  ? "border-violet-600 bg-violet-600/5 ring-1 ring-violet-600"
                  : "border-border hover:border-violet-500/50"
              )}
            >
              <div className="flex items-center gap-3">
                <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: svc.color }} />
                <div>
                  <p className="font-medium">{svc.name}</p>
                  <p className="text-sm text-muted-foreground">{formatDurationMin(svc.duration_min)}</p>
                </div>
              </div>
              <p className="shrink-0 font-heading font-semibold text-violet-600">
                {formatPriceCents(svc.price_cents)}
              </p>
            </button>
          );
        })}
      </div>

      {service && (
        <div className="flex flex-col gap-4 rounded-xl border border-border p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-medium">Escolha o dia</p>
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
            <p className="mb-2 text-sm font-medium">Horários disponíveis</p>
            {loadingSlots && (
              <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" /> Buscando horários...
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
                      "rounded-lg border px-2 py-2 text-sm font-medium transition-colors",
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
      )}

      {step === "details" && service && selectedSlot && (
        <form
          onSubmit={handleSubmit}
          className="flex flex-col gap-4 rounded-xl border border-border p-4"
        >
          <p className="text-sm font-medium">
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
          <Button type="submit" disabled={submitting} className="bg-cta text-white hover:opacity-90">
            {submitting ? "Confirmando..." : "Confirmar agendamento"}
          </Button>
        </form>
      )}
    </div>
  );
}
