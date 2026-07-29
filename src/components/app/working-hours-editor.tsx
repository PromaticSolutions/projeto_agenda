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
  return <div className="rounded-[2rem] border border-violet-950/6 bg-card shadow-xl shadow-violet-950/5 dark:border-white/8">
    <div className="flex flex-col gap-4 border-b border-border/70 p-5 sm:flex-row sm:items-center sm:justify-between sm:px-6 dark:border-white/8">
      <div><p className="text-xs font-bold tracking-[.13em] text-violet-600 uppercase">Semana de trabalho</p><p className="mt-1 text-sm text-muted-foreground">Ative apenas os dias em que você atende. Cada dia pode ter um ou mais períodos.</p></div>
      <CopyWeekdaysButton workingHours={workingHours} />
    </div>
    <div className="grid divide-y divide-border/70 dark:divide-white/8 lg:grid-cols-2 lg:divide-x lg:divide-y-0">
      {WEEKDAY_LABELS.map((label, weekday) => {
        const shifts = workingHours.filter((hour) => hour.weekday === weekday).sort((a, b) => a.start_time.localeCompare(b.start_time));
        const isOpen = shifts.length > 0;
        return <article key={label} className="p-5 sm:px-6"><div className="flex items-center justify-between gap-4"><div className="flex items-center gap-3"><span className={`flex size-9 items-center justify-center rounded-xl text-xs font-bold ${isOpen ? "bg-violet-600 text-white" : "bg-muted text-muted-foreground"}`}>{label.slice(0, 3)}</span><div><h2 className="font-semibold text-plum-900 dark:text-foreground">{label}</h2><p className="text-xs text-muted-foreground">{isOpen ? `${shifts.length} ${shifts.length === 1 ? "período" : "períodos"} disponível${shifts.length === 1 ? "" : "is"}` : "Fechado"}</p></div></div><DaySwitch weekday={weekday} shifts={shifts} /></div>{isOpen && <div className="mt-4 border-t border-border/60 pt-4 dark:border-white/8"><div className="mb-3 flex flex-wrap gap-2">{shifts.map((shift) => <span key={shift.id} className="inline-flex items-center gap-1.5 rounded-full bg-violet-600/10 px-3 py-1.5 text-xs font-semibold text-violet-700 dark:text-violet-300"><Clock3 className="size-3" />{shift.start_time.slice(0, 5)} — {shift.end_time.slice(0, 5)}<RemoveShiftButton id={shift.id} /></span>)}</div><AddPeriod weekday={weekday} /></div>}{!isOpen && <p className="mt-4 text-xs text-muted-foreground">Ative para disponibilizar o horário padrão de 09:00 às 18:00.</p>}</article>;
      })}
    </div>
    <div className="flex items-center gap-2 rounded-b-[2rem] border-t border-border/70 bg-violet-600/[.035] px-5 py-3 text-xs text-muted-foreground sm:px-6 dark:border-white/8"><Check className="size-3.5 text-wa" />As mudanças ficam disponíveis no seu link de agendamento automaticamente.</div>
  </div>;
}
