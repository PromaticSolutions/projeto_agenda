"use client";

import { useActionState, useTransition } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  addWorkingHourAction,
  removeWorkingHourAction,
  type HoursActionState,
} from "@/app/app/(dashboard)/hours/actions";
import { WEEKDAY_LABELS } from "@/lib/weekdays";
import type { WorkingHour } from "@/lib/types";

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
    <div className="flex flex-col divide-y divide-border rounded-lg border border-border">
      {WEEKDAY_LABELS.map((label, weekday) => {
        const shifts = workingHours
          .filter((w) => w.weekday === weekday)
          .sort((a, b) => a.start_time.localeCompare(b.start_time));
        return (
          <div key={weekday} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="w-24 shrink-0 text-sm font-medium">{label}</p>
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
  );
}
