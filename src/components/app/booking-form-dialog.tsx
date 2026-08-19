"use client";

import { useActionState, useState } from "react";
import { Pencil } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  updateBookingScheduleAction,
  type BookingFormState,
} from "@/app/app/(dashboard)/actions";
import { formatTimeLocal } from "@/lib/format";
import { utcToLocalDate } from "@/lib/availability";
import type { Booking, Service } from "@/lib/types";

interface BookingFormDialogProps {
  services: Service[];
  /** Agendamento existente a reagendar. */
  booking: Booking;
  clientName?: string;
}

/**
 * Reagendamento de um atendimento já existente: troca serviço, data e horário.
 * A criação de agendamentos pelo painel fica no `ManualBookingDialog`, que traz
 * a grade de horários livres e o modo encaixe.
 */
export function BookingFormDialog({ services, booking, clientName }: BookingFormDialogProps) {
  const action = updateBookingScheduleAction.bind(null, booking.id);
  const [state, formAction, pending] = useActionState<BookingFormState, FormData>(action, null);
  const [open, setOpen] = useState(false);

  const [lastState, setLastState] = useState(state);
  if (state !== lastState) {
    setLastState(state);
    if (state?.ok) setOpen(false);
  }

  const bookingStart = new Date(booking.start_at);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="ghost" size="icon-sm" />}>
        <Pencil className="size-4" />
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reagendar</DialogTitle>
          <DialogDescription>
            Altere o serviço, a data ou o horário. O sistema revalida o horário automaticamente.
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="flex flex-col gap-4">
          <div className="rounded-xl bg-muted/40 px-3.5 py-2.5 text-sm">
            <p className="font-medium text-plum-900 dark:text-foreground">{clientName}</p>
            <p className="text-muted-foreground">{booking.client_phone}</p>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="serviceId">Serviço</Label>
            <Select name="serviceId" defaultValue={booking.service_id}>
              <SelectTrigger id="serviceId" className="w-full">
                <SelectValue placeholder="Selecione um serviço" />
              </SelectTrigger>
              <SelectContent>
                {services.map((service) => (
                  <SelectItem key={service.id} value={service.id}>
                    {service.name}
                    {!service.active ? " (pausado)" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="date">Data</Label>
              <Input
                id="date"
                name="date"
                type="date"
                required
                defaultValue={utcToLocalDate(bookingStart)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="time">Horário</Label>
              <Input
                id="time"
                name="time"
                type="time"
                required
                defaultValue={formatTimeLocal(bookingStart)}
              />
            </div>
          </div>

          {state && !state.ok && <p className="text-sm text-destructive">{state.error}</p>}

          <DialogFooter>
            <Button type="submit" className="bg-cta text-white hover:opacity-90" disabled={pending}>
              {pending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
