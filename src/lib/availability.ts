import { fromZonedTime } from "date-fns-tz";

export const STUDIO_TIMEZONE = "America/Sao_Paulo";

export interface Interval {
  start: Date;
  end: Date;
}

export interface WorkingHourShift {
  weekday: number;
  start_time: string;
  end_time: string;
}

export interface AvailabilityInput {
  /** Data local do estúdio, formato "YYYY-MM-DD". */
  date: string;
  durationMin: number;
  workingHours: WorkingHourShift[];
  blocks: Interval[];
  /** Bookings com status != "cancelado". */
  bookings: Interval[];
  /** Passo entre slots candidatos, em minutos. Padrão: durationMin. */
  slotStepMin?: number;
  /** Antecedência mínima para agendar, em minutos. Padrão: 0. */
  minLeadMin?: number;
  now?: Date;
}

/** "YYYY-MM-DD" + "HH:MM[:SS]" (hora local do estúdio) -> instante UTC. */
export function localDateTimeToUtc(dateStr: string, timeStr: string): Date {
  return fromZonedTime(`${dateStr}T${timeStr}`, STUDIO_TIMEZONE);
}

/** Dia da semana (0=domingo..6=sábado) de uma data de calendário pura. */
export function weekdayOfDate(dateStr: string): number {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/** Próxima data de calendário (string "YYYY-MM-DD"), sem depender de timezone. */
export function nextLocalDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
}

/** Intervalo [00:00, 24:00) de uma data local do estúdio, em instantes UTC — usado para consultar bookings/blocks do dia. */
export function localDayRangeUtc(dateStr: string): Interval {
  return {
    start: localDateTimeToUtc(dateStr, "00:00:00"),
    end: localDateTimeToUtc(nextLocalDate(dateStr), "00:00:00"),
  };
}

/** Data de calendário local do estúdio para um instante UTC qualquer. */
export function utcToLocalDate(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: STUDIO_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function intervalsOverlap(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date) {
  return aStart < bEnd && bStart < aEnd;
}

/**
 * Gera os horários livres de um estúdio para um serviço/data, seguindo o
 * algoritmo da seção 8 do spec: turnos -> slots candidatos em passos de
 * `slotStepMin` -> descarta o que ultrapassa o turno, colide com booking
 * ativo, colide com bloqueio, ou já passou (respeitando antecedência mínima).
 *
 * É a MESMA função usada no cliente (sugestão de UI) e no servidor
 * (revalidação ao criar o booking) — nunca reimplemente essa lógica em dois
 * lugares (ver RISKS.md, "validação server-side").
 */
export function getAvailableSlots(input: AvailabilityInput): Interval[] {
  const {
    date,
    durationMin,
    workingHours,
    blocks,
    bookings,
    slotStepMin,
    minLeadMin = 0,
    now = new Date(),
  } = input;

  const step = slotStepMin && slotStepMin > 0 ? slotStepMin : durationMin;
  const weekday = weekdayOfDate(date);
  const shifts = workingHours.filter((w) => w.weekday === weekday);
  const earliestStart = new Date(now.getTime() + minLeadMin * 60_000);
  const busy = [...blocks, ...bookings];

  const slots: Interval[] = [];

  for (const shift of shifts) {
    const shiftStart = localDateTimeToUtc(date, shift.start_time);
    const shiftEnd = localDateTimeToUtc(date, shift.end_time);

    let candidateStart = shiftStart;
    while (true) {
      const candidateEnd = new Date(candidateStart.getTime() + durationMin * 60_000);
      if (candidateEnd > shiftEnd) break;

      const hasConflict = busy.some((b) =>
        intervalsOverlap(candidateStart, candidateEnd, b.start, b.end)
      );

      if (!hasConflict && candidateStart >= earliestStart) {
        slots.push({ start: candidateStart, end: candidateEnd });
      }

      candidateStart = new Date(candidateStart.getTime() + step * 60_000);
    }
  }

  return slots.sort((a, b) => a.start.getTime() - b.start.getTime());
}

/** Verifica se um intervalo [start, end) específico ainda está livre — usado na revalidação server-side do POST de booking. */
export function isSlotStillAvailable(
  candidate: Interval,
  input: Omit<AvailabilityInput, "date"> & { date: string }
): boolean {
  return getAvailableSlots(input).some(
    (slot) =>
      slot.start.getTime() === candidate.start.getTime() &&
      slot.end.getTime() === candidate.end.getTime()
  );
}
