"use client";

import { useActionState, useState } from "react";
import { CalendarPlus, Pencil } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  createManualBookingAction,
  updateBookingScheduleAction,
  type BookingFormState,
} from "@/app/app/(dashboard)/actions";
import { formatTimeLocal } from "@/lib/format";
import { utcToLocalDate } from "@/lib/availability";
import type { Booking, Service } from "@/lib/types";

interface BookingFormDialogProps {
  services: Service[];
  /** Data pré-selecionada ao criar (o dia que o dono está vendo no painel). */
  defaultDate?: string;
  /** Presente = modo edição de um agendamento existente. */
  booking?: Booking;
  clientName?: string;
}

export function BookingFormDialog({ services, defaultDate, booking, clientName }: BookingFormDialogProps) {
  const isEdit = Boolean(booking);
  const action = isEdit ? updateBookingScheduleAction.bind(null, booking!.id) : createManualBookingAction;
  const [state, formAction, pending] = useActionState<BookingFormState, FormData>(action, null);
  const [open, setOpen] = useState(false);

  const [lastState, setLastState] = useState(state);
  if (state !== lastState) {
    setLastState(state);
    if (state?.ok) setOpen(false);
  }

  const bookingStart = booking ? new Date(booking.start_at) : null;
  const initialDate = bookingStart ? utcToLocalDate(bookingStart) : (defaultDate ?? "");
  const initialTime = bookingStart ? formatTimeLocal(bookingStart) : "";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button
            variant={isEdit ? "ghost" : "default"}
            size={isEdit ? "icon-sm" : "default"}
            className={isEdit ? "" : "gap-1.5 bg-cta text-white hover:opacity-90"}
          />
        }
      >
        {isEdit ? (
          <Pencil className="size-4" />
        ) : (
          <>
            <CalendarPlus className="size-4" /> Novo agendamento
          </>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Reagendar" : "Novo agendamento"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Altere o serviço, a data ou o horário. O sistema revalida o horário automaticamente."
              : "Registre um agendamento feito por telefone ou presencialmente."}
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="flex flex-col gap-4">
          {isEdit ? (
            <div className="rounded-xl bg-muted/40 px-3.5 py-2.5 text-sm">
              <p className="font-medium text-plum-900 dark:text-foreground">{clientName}</p>
              <p className="text-muted-foreground">{booking!.client_phone}</p>
            </div>
          ) : (
            <>
              <div className="flex flex-col gap-2">
                <Label htmlFor="clientName">Cliente</Label>
                <Input id="clientName" name="clientName" required placeholder="Nome completo" />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="clientPhone">Telefone (WhatsApp)</Label>
                <PhoneInput id="clientPhone" name="clientPhone" required />
              </div>
            </>
          )}

          <div className="flex flex-col gap-2">
            <Label htmlFor="serviceId">Serviço</Label>
            <Select name="serviceId" defaultValue={booking?.service_id}>
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
              <Input id="date" name="date" type="date" required defaultValue={initialDate} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="time">Horário</Label>
              <Input id="time" name="time" type="time" required defaultValue={initialTime} />
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
