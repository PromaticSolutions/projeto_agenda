"use client";

import { useActionState, useTransition } from "react";
import { Check, Clock3, Copy, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  addWorkingHourAction,
  removeWorkingHourAction,
  type HoursActionState,
} from "@/app/app/(dashboard)/hours/actions";
import { WEEKDAY_LABELS } from "@/lib/weekdays";
import type { WorkingHour } from "@/lib/types";

const WEEKDAYS_TUE_TO_FRI = [2, 3, 4, 5];
const DEFAULT_START = "09:00";
const DEFAULT_END = "18:00";

function shiftData(weekday: number, shift: Pick<WorkingHour, "start_time" | "end_time">) {
  const data = new FormData();
  data.set("weekday", String(weekday));
  data.set("start_time", shift.start_time);
  data.set("end_time", shift.end_time);
  return data;
}

function DaySwitch({ weekday, shifts }: { weekday: number; shifts: WorkingHour[] }) {
  const [pending, startTransition] = useTransition();
  const isOpen = shifts.length > 0;
  function onChange(open: boolean) {
    startTransition(async () => {
      if (open) {
        const result = await addWorkingHourAction(null, shiftData(weekday, { start_time: DEFAULT_START, end_time: DEFAULT_END }));
        if (!result?.ok) toast.error(result?.error ?? "Não foi possível abrir o dia.");
      } else {
        await Promise.all(shifts.map((shift) => removeWorkingHourAction(shift.id)));
        toast.success(`${WEEKDAY_LABELS[weekday]} marcado como fechado.`);
      }
    });
  }
  return <Switch checked={isOpen} onCheckedChange={onChange} disabled={pending} aria-label={`${isOpen ? "Fechar" : "Abrir"} ${WEEKDAY_LABELS[weekday]}`} />;
}

function RemoveShiftButton({ id }: { id: string }) {
  const [pending, startTransition] = useTransition();
  return <button type="button" disabled={pending} onClick={() => startTransition(() => removeWorkingHourAction(id))} aria-label="Remover período" className="rounded-full p-0.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"><X className="size-3.5" /></button>;
}

function AddPeriod({ weekday }: { weekday: number }) {
  const [state, action, pending] = useActionState<HoursActionState, FormData>(addWorkingHourAction, null);
  return <form action={action} className="flex flex-wrap items-center gap-2"><input type="hidden" name="weekday" value={weekday} /><Input type="time" name="start_time" defaultValue={DEFAULT_START} required className="h-9 w-[7.1rem] bg-background text-sm" /><span className="text-xs text-muted-foreground">até</span><Input type="time" name="end_time" defaultValue={DEFAULT_END} required className="h-9 w-[7.1rem] bg-background text-sm" /><Button type="submit" variant="outline" size="sm" disabled={pending} className="h-9 rounded-xl"><Plus className="size-3.5" /> {pending ? "Salvando" : "Adicionar período"}</Button>{state && !state.ok && <p className="w-full text-xs text-destructive">{state.error}</p>}</form>;
}

function CopyWeekdaysButton({ workingHours }: { workingHours: WorkingHour[] }) {
  const [pending, startTransition] = useTransition();
  const monday = workingHours.filter((hour) => hour.weekday === 1);
  function copyMonday() {
    if (!monday.length) return toast.info("Defina os horários de segunda antes de copiá-los.");
    startTransition(async () => {
      for (const weekday of WEEKDAYS_TUE_TO_FRI) {
        const current = workingHours.filter((hour) => hour.weekday === weekday);
        await Promise.all(current.map((hour) => removeWorkingHourAction(hour.id)));
        for (const shift of monday) await addWorkingHourAction(null, shiftData(weekday, shift));
      }
      toast.success("Horários de segunda aplicados de terça a sexta.");
    });
  }
  return <Button type="button" variant="outline" size="sm" onClick={copyMonday} disabled={pending} className="rounded-xl"><Copy className="size-3.5" /> {pending ? "Aplicando..." : "Aplicar segunda aos dias úteis"}</Button>;
}

export function WorkingHoursEditor({ workingHours }: { workingHours: WorkingHour[] }) {
  return (
    <div className="panel overflow-hidden">
      <header className="flex flex-col gap-3 border-b border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-medium text-foreground">Semana de trabalho</h2>
          <p className="text-sm text-muted-foreground">
            Ative os dias em que atende. Cada dia aceita mais de um período.
          </p>
        </div>
        <CopyWeekdaysButton workingHours={workingHours} />
      </header>

      {/* Um dia por linha: a leitura vertical deixa claro o que está aberto e
          o que está fechado, coisa que a grade de duas colunas embaralhava. */}
      <ul className="divide-y divide-border">
        {WEEKDAY_LABELS.map((label, weekday) => {
          const shifts = workingHours
            .filter((hour) => hour.weekday === weekday)
            .sort((a, b) => a.start_time.localeCompare(b.start_time));
          const isOpen = shifts.length > 0;

          return (
            <li key={label} className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-start">
              <div className="flex w-full items-center justify-between gap-3 sm:w-52 sm:shrink-0">
                <div className="min-w-0">
                  <p className="font-medium text-foreground">{label}</p>
                  <p className="text-xs text-muted-foreground">
                    {isOpen
                      ? `${shifts.length} ${shifts.length === 1 ? "período" : "períodos"}`
                      : "Fechado"}
                  </p>
                </div>
                <DaySwitch weekday={weekday} shifts={shifts} />
              </div>

              <div className="min-w-0 flex-1">
                {isOpen ? (
                  <div className="flex flex-col gap-2.5">
                    <div className="flex flex-wrap gap-1.5">
                      {shifts.map((shift) => (
                        <span
                          key={shift.id}
                          className="inline-flex items-center gap-1.5 rounded-md border border-border px-2 py-1 text-xs"
                        >
                          <Clock3 className="size-3 text-muted-foreground" />
                          <time className="font-medium">
                            {shift.start_time.slice(0, 5)} — {shift.end_time.slice(0, 5)}
                          </time>
                          <RemoveShiftButton id={shift.id} />
                        </span>
                      ))}
                    </div>
                    <AddPeriod weekday={weekday} />
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Ative para abrir das {DEFAULT_START} às {DEFAULT_END}.
                  </p>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      <footer className="flex items-center gap-2 border-t border-border bg-muted/30 px-4 py-2.5 text-xs text-muted-foreground">
        <Check className="size-3.5" />
        As mudanças valem no link de agendamento imediatamente.
      </footer>
    </div>
  );
}
