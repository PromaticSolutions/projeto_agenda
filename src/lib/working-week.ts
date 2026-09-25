import type { WorkingHour } from "@/lib/types";

/**
 * A semana de trabalho como o editor de /app/hours a enxerga.
 *
 * O banco guarda uma linha por período (`working_hours`); a tela edita a
 * semana inteira de uma vez — liga e desliga dias, muda horário, adiciona e
 * copia períodos — e só grava quando a pessoa salva. Este módulo é a ponte
 * entre os dois: converte, valida e calcula o que mudou. Tudo aqui é função
 * pura, e a MESMA validação roda no navegador (para marcar o campo errado na
 * hora) e na server action (que é quem decide de verdade).
 */

export interface DraftPeriod {
  /** Identidade estável na tela, para o React não trocar campos de lugar. */
  key: string;
  /** "HH:MM" */
  start: string;
  /** "HH:MM" */
  end: string;
}

export interface DraftDay {
  enabled: boolean;
  periods: DraftPeriod[];
}

/** Índice = dia da semana, 0 (domingo) a 6 (sábado), como no banco. */
export type DraftWeek = DraftDay[];

export interface Shift {
  weekday: number;
  start_time: string;
  end_time: string;
}

export const DEFAULT_PERIOD = { start: "09:00", end: "18:00" } as const;

let keySeq = 0;
export function newPeriodKey(): string {
  keySeq += 1;
  return `p${keySeq}-${Math.random().toString(36).slice(2, 7)}`;
}

/** "09:00:00" (banco) ou "09:00" (campo) → "09:00". */
export function hhmm(time: string): string {
  return time.slice(0, 5);
}

function toMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

function fromMinutes(minutes: number): string {
  const clamped = Math.max(0, Math.min(minutes, 23 * 60 + 59));
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function weekFromWorkingHours(hours: WorkingHour[]): DraftWeek {
  return Array.from({ length: 7 }, (_, weekday) => {
    const periods = hours
      .filter((h) => h.weekday === weekday)
      .map((h) => ({ key: newPeriodKey(), start: hhmm(h.start_time), end: hhmm(h.end_time) }))
      .sort((a, b) => a.start.localeCompare(b.start));
    return { enabled: periods.length > 0, periods };
  });
}

/**
 * O período sugerido pelo "+": começa uma hora depois do fim do último (a
 * pausa do almoço é o caso mais comum) e dura até três horas, sem passar da
 * meia-noite. Sem período anterior, é o horário padrão.
 */
export function suggestNextPeriod(periods: DraftPeriod[]): DraftPeriod {
  const last = [...periods].sort((a, b) => a.start.localeCompare(b.start)).at(-1);
  if (!last) return { key: newPeriodKey(), ...DEFAULT_PERIOD };
  const lastEnd = toMinutes(last.end);
  const start = Math.min(lastEnd + 60, 23 * 60);
  const end = Math.min(start + 180, 23 * 60 + 59);
  return { key: newPeriodKey(), start: fromMinutes(start), end: fromMinutes(end) };
}

/** Erros por período (chave → mensagem). Vazio quando a semana está válida. */
export type WeekErrors = Record<string, string>;

export function validateWeek(week: DraftWeek): WeekErrors {
  const errors: WeekErrors = {};
  for (const day of week) {
    if (!day.enabled) continue;
    const sorted = [...day.periods].sort((a, b) => a.start.localeCompare(b.start));
    let previousEnd: string | null = null;
    for (const period of sorted) {
      if (!/^\d{2}:\d{2}$/.test(period.start) || !/^\d{2}:\d{2}$/.test(period.end)) {
        errors[period.key] = "Preencha o início e o fim.";
      } else if (period.end <= period.start) {
        errors[period.key] = "O fim precisa ser depois do início.";
      } else if (previousEnd && period.start < previousEnd) {
        errors[period.key] = "Este período se sobrepõe a outro do mesmo dia.";
      }
      if (period.end > (previousEnd ?? "")) previousEnd = period.end;
    }
  }
  return errors;
}

/** Os períodos que devem existir no banco: só os dos dias ligados. */
export function weekToShifts(week: DraftWeek): Shift[] {
  return week.flatMap((day, weekday) =>
    day.enabled
      ? day.periods.map((p) => ({ weekday, start_time: p.start, end_time: p.end }))
      : []
  );
}

/** Mesma validação, a partir da lista que chega na server action. */
export function validateShifts(shifts: Shift[]): string | null {
  const week: DraftWeek = Array.from({ length: 7 }, () => ({ enabled: true, periods: [] }));
  for (const [i, shift] of shifts.entries()) {
    if (!Number.isInteger(shift.weekday) || shift.weekday < 0 || shift.weekday > 6) {
      return "Dia da semana inválido.";
    }
    week[shift.weekday].periods.push({ key: String(i), start: hhmm(shift.start_time), end: hhmm(shift.end_time) });
  }
  const errors = validateWeek(week);
  const first = Object.values(errors)[0];
  return first ?? null;
}

/**
 * O que mudar no banco para chegar em `desired`: apaga o que não existe mais
 * e cria o que é novo. Período com o mesmo dia, início e fim é considerado o
 * mesmo — não é apagado e recriado, então salvar sem mudanças não escreve
 * nada.
 */
export function diffShifts(
  existing: WorkingHour[],
  desired: Shift[]
): { toDelete: string[]; toCreate: Shift[] } {
  const signature = (weekday: number, start: string, end: string) =>
    `${weekday}|${hhmm(start)}|${hhmm(end)}`;

  const remaining = new Map<string, string[]>();
  for (const hour of existing) {
    const sig = signature(hour.weekday, hour.start_time, hour.end_time);
    remaining.set(sig, [...(remaining.get(sig) ?? []), hour.id]);
  }

  const toCreate: Shift[] = [];
  for (const shift of desired) {
    const sig = signature(shift.weekday, shift.start_time, shift.end_time);
    const ids = remaining.get(sig);
    if (ids && ids.length > 0) ids.shift();
    else toCreate.push({ ...shift, start_time: hhmm(shift.start_time), end_time: hhmm(shift.end_time) });
  }

  const toDelete = [...remaining.values()].flat();
  return { toDelete, toCreate };
}
