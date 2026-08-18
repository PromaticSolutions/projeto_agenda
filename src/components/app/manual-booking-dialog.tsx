"use client";

import { useState } from "react";
import { CalendarPlus, Loader2, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PhoneInput } from "@/components/ui/phone-input";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  createManualBookingAction,
  listOwnerSlotsAction,
} from "@/app/app/(dashboard)/actions";
import { clientNameSchema, clientPhoneSchema } from "@/lib/validation";
import { formatDurationMin, formatPriceCents, formatTimeLocal } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Service } from "@/lib/types";

interface Slot {
  start: string;
  end: string;
}

/** "HH:MM" no fuso do estúdio para um instante ISO — o formato aceito pela action. */
function isoToStudioTime(iso: string): string {
  return formatTimeLocal(new Date(iso));
}

export function ManualBookingDialog({
  services,
  defaultDate,
}: {
  services: Service[];
  defaultDate: string;
}) {
  const activeServices = services.filter((s) => s.active);

  const [open, setOpen] = useState(false);
  const [serviceId, setServiceId] = useState(activeServices[0]?.id ?? "");
  const [date, setDate] = useState(defaultDate);

  const [slots, setSlots] = useState<Slot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [slotsError, setSlotsError] = useState<string | null>(null);
  const [selectedStart, setSelectedStart] = useState<string | null>(null);

  const [encaixe, setEncaixe] = useState(false);
  const [time, setTime] = useState("09:00");
  const [durationMin, setDurationMin] = useState(activeServices[0]?.duration_min ?? 30);

  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const service = services.find((s) => s.id === serviceId) ?? null;

  // Grade de horários livres: mesma fonte de verdade da página pública, só que
  // resolvida pelo estúdio do dono logado (nenhum slug envolvido). Buscada a
  // partir dos handlers — e não de um useEffect — porque só muda em resposta a
  // uma ação do dono (abrir o diálogo, trocar serviço, data ou modo).
  async function fetchSlots(nextServiceId: string, day: string) {
    if (!nextServiceId) return;
    setLoadingSlots(true);
    setSlotsError(null);
    setSelectedStart(null);
    const result = await listOwnerSlotsAction(nextServiceId, day);
    if (result.ok) {
      setSlots(result.slots);
    } else {
      setSlots([]);
      setSlotsError(result.error);
    }
    setLoadingSlots(false);
  }

  function handleSelectService(next: Service) {
    setServiceId(next.id);
    setDurationMin(next.duration_min);
    setSelectedStart(null);
    if (!encaixe) void fetchSlots(next.id, date);
  }

  function handleSelectDate(next: string) {
    setDate(next);
    setSelectedStart(null);
    if (!encaixe) void fetchSlots(serviceId, next);
  }

  function handleToggleEncaixe(next: boolean) {
    setEncaixe(next);
    setFormError(null);
    // Ao abrir o encaixe, parte do horário já escolhido na grade — evita
    // recomeçar do zero quando o dono só quer deslocar alguns minutos.
    if (next && selectedStart) setTime(isoToStudioTime(selectedStart));
    if (!next) {
      setSelectedStart(null);
      void fetchSlots(serviceId, date);
    }
  }

  function resetForm() {
    setClientName("");
    setClientPhone("");
    setSelectedStart(null);
    setFormError(null);
    setEncaixe(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    if (!service) {
      setFormError("Selecione um serviço");
      return;
    }
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
    if (!encaixe && !selectedStart) {
      setFormError("Escolha um horário na grade");
      return;
    }

    setSubmitting(true);
    try {
      const result = await createManualBookingAction({
        serviceId: service.id,
        clientName,
        clientPhone,
        date,
        time: encaixe ? time : isoToStudioTime(selectedStart!),
        durationMin: encaixe ? durationMin : service.duration_min,
        encaixe,
      });

      if (!result.ok) {
        setFormError(result.error);
        return;
      }

      toast.success(
        `Agendamento de ${clientName} criado para ${formatTimeLocal(new Date(result.startAt))}.`
      );
      setOpen(false);
      resetForm();
    } catch {
      setFormError("Erro de conexão. Tente novamente.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          void fetchSlots(serviceId, date);
        } else {
          resetForm();
        }
      }}
    >
      <DialogTrigger
        render={<Button size="sm" className="gap-1.5 bg-cta text-white hover:opacity-90" />}
      >
        <CalendarPlus className="size-4" /> Novo agendamento
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg max-h-[calc(100dvh-2rem)] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Novo agendamento</DialogTitle>
          <DialogDescription>
            Para quando o cliente marca por telefone, WhatsApp ou no balcão.
          </DialogDescription>
        </DialogHeader>

        {activeServices.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Cadastre pelo menos um serviço ativo antes de criar agendamentos.
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label>Serviço</Label>
              <div className="flex flex-col gap-2">
                {activeServices.map((svc) => {
                  const selected = svc.id === serviceId;
                  return (
                    <button
                      key={svc.id}
                      type="button"
                      onClick={() => handleSelectService(svc)}
                      className={cn(
                        "flex items-center justify-between gap-3 rounded-xl border p-2.5 text-left transition-colors",
                        selected
                          ? "border-violet-600 bg-violet-600/5 ring-1 ring-violet-600"
                          : "border-border hover:border-violet-500/50"
                      )}
                    >
                      <span className="flex min-w-0 items-center gap-2.5">
                        <span
                          className="size-2.5 shrink-0 rounded-full"
                          style={{ backgroundColor: svc.color }}
                        />
                        <span className="min-w-0">
                          <span className="block truncate font-medium text-plum-900 dark:text-foreground">
                            {svc.name}
                          </span>
                          <span className="block text-xs text-muted-foreground">
                            {formatDurationMin(svc.duration_min)} · {formatPriceCents(svc.price_cents)}
                          </span>
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="manual_date">Data</Label>
              <Input
                id="manual_date"
                type="date"
                required
                value={date}
                onChange={(e) => handleSelectDate(e.target.value)}
              />
            </div>

            <div className="flex items-center justify-between rounded-xl bg-muted/40 px-3.5 py-2.5">
              <Label htmlFor="manual_encaixe" className="cursor-pointer">
                Encaixe (horário fora da grade)
              </Label>
              <Switch id="manual_encaixe" checked={encaixe} onCheckedChange={handleToggleEncaixe} />
            </div>

            {encaixe ? (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="manual_time">Horário</Label>
                    <Input
                      id="manual_time"
                      type="time"
                      required
                      value={time}
                      onChange={(e) => setTime(e.target.value)}
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="manual_duration">Duração (min)</Label>
                    <Input
                      id="manual_duration"
                      type="number"
                      min={5}
                      max={600}
                      step={5}
                      required
                      value={durationMin}
                      onChange={(e) => setDurationMin(Number(e.target.value))}
                    />
                  </div>
                </div>
                <p className="flex items-start gap-2 rounded-xl bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
                  <TriangleAlert className="mt-px size-3.5 shrink-0" />
                  O encaixe ignora expediente e bloqueios. A única regra mantida é não sobrepor
                  outro atendimento.
                </p>
              </>
            ) : (
              <div className="flex flex-col gap-2">
                <Label>Horário</Label>
                {loadingSlots && (
                  <div className="grid grid-cols-4 gap-2">
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
                    Nenhum horário livre neste dia. Escolha outra data ou use o encaixe.
                  </p>
                )}
                {!loadingSlots && slots.length > 0 && (
                  <div className="grid max-h-44 grid-cols-4 gap-2 overflow-y-auto pr-1">
                    {slots.map((slot) => (
                      <button
                        key={slot.start}
                        type="button"
                        onClick={() => setSelectedStart(slot.start)}
                        className={cn(
                          "rounded-xl border px-2 py-2 text-sm font-semibold tabular-nums transition-colors",
                          selectedStart === slot.start
                            ? "border-violet-600 bg-violet-600 text-white"
                            : "border-border hover:border-violet-500/50"
                        )}
                      >
                        {isoToStudioTime(slot.start)}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="flex flex-col gap-2">
              <Label htmlFor="manual_client_name">Nome do cliente</Label>
              <Input
                id="manual_client_name"
                required
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="Maria Silva"
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="manual_client_phone">WhatsApp</Label>
              <PhoneInput
                id="manual_client_phone"
                required
                value={clientPhone}
                onValueChange={setClientPhone}
              />
            </div>

            {formError && <p className="text-sm text-destructive">{formError}</p>}

            <DialogFooter>
              <Button
                type="submit"
                className="bg-cta text-white hover:opacity-90"
                disabled={submitting}
              >
                {submitting && <Loader2 className="size-4 animate-spin" />}
                {submitting ? "Salvando..." : "Criar agendamento"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
