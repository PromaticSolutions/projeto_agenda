"use client";

import { useActionState, useTransition } from "react";
import { Copy, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  addWorkingHourAction,
  removeWorkingHourAction,
  type HoursActionState,
} from "@/app/app/(dashboard)/hours/actions";
import { WEEKDAY_LABELS } from "@/lib/weekdays";
import type { WorkingHour } from "@/lib/types";

const WEEKDAYS_TUE_TO_FRI = [2, 3, 4, 5];

function buildShiftFormData(weekday: number, shift: WorkingHour): FormData {
  const fd = new FormData();
  fd.set("weekday", String(weekday));
  fd.set("start_time", shift.start_time);
  fd.set("end_time", shift.end_time);
  return fd;
}

function CopyMondayButton({ workingHours }: { workingHours: WorkingHour[] }) {
  const [pending, startTransition] = useTransition();
  const mondayShifts = workingHours.filter((w) => w.weekday === 1);

  function handleCopy() {
    if (mondayShifts.length === 0) {
      toast.info("Cadastre um turno de segunda-feira primeiro.");
      return;
    }
    startTransition(async () => {
      for (const weekday of WEEKDAYS_TUE_TO_FRI) {
        const existing = workingHours.filter((w) => w.weekday === weekday);
        for (const shift of existing) {
          await removeWorkingHourAction(shift.id);
        }
        for (const shift of mondayShifts) {
          await addWorkingHourAction(null, buildShiftFormData(weekday, shift));
        }
      }
      toast.success("Horário de segunda copiado para terça a sexta.");
    });
  }

  return (
    <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={handleCopy} disabled={pending}>
      <Copy className="size-3.5" />
      {pending ? "Copiando..." : "Copiar segunda p/ dias úteis"}
    </Button>
  );
}

function ShiftBadge({ shift }: { shift: WorkingHour }) {
  const [, startTransition] = useTransition();
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-2.5 py-1 text-xs font-medium text-secondary-foreground">
      {shift.start_time.slice(0, 5)}–{shift.end_time.slice(0, 5)}
      <button
        type="button"
        aria-label="Remover turno"
        className="text-muted-foreground hover:text-destructive"
        onClick={() => startTransition(() => removeWorkingHourAction(shift.id))}
      >
        <X className="size-3" />
      </button>
    </span>
  );
}

function AddShiftForm({ weekday }: { weekday: number }) {
  const [state, formAction, pending] = useActionState<HoursActionState, FormData>(
    addWorkingHourAction,
    null
  );

  return (
    <form action={formAction} className="flex flex-wrap items-center gap-1.5">
      <input type="hidden" name="weekday" value={weekday} />
      <Input type="time" name="start_time" required className="h-7 w-24 px-2 text-xs" />
      <span className="text-xs text-muted-foreground">até</span>
      <Input type="time" name="end_time" required className="h-7 w-24 px-2 text-xs" />
      <Button type="submit" size="xs" variant="outline" disabled={pending}>
        {pending ? "..." : "+ turno"}
      </Button>
      {state && !state.ok && <p className="w-full text-xs text-destructive">{state.error}</p>}
    </form>
  );
}

export function WorkingHoursEditor({ workingHours }: { workingHours: WorkingHour[] }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-end">
        <CopyMondayButton workingHours={workingHours} />
      </div>
      <div className="flex flex-col divide-y divide-border/70 rounded-2xl bg-card px-4 shadow-sm ring-1 ring-plum-900/5 sm:px-5">
        {WEEKDAY_LABELS.map((label, weekday) => {
        const shifts = workingHours
          .filter((w) => w.weekday === weekday)
          .sort((a, b) => a.start_time.localeCompare(b.start_time));
        return (
          <div key={weekday} className="flex flex-col gap-2 py-3.5 sm:flex-row sm:items-center sm:justify-between">
            <p className="w-24 shrink-0 text-sm font-medium text-plum-900">{label}</p>
            <div className="flex flex-1 flex-wrap items-center gap-2">
              {shifts.length === 0 && (
                <span className="text-xs text-muted-foreground">Fechado</span>
              )}
              {shifts.map((shift) => (
                <ShiftBadge key={shift.id} shift={shift} />
              ))}
            </div>
            <AddShiftForm weekday={weekday} />
          </div>
          );
        })}
      </div>
    </div>
  );
}
