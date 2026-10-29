import "server-only";
import { listPublicWorkingHours } from "@/lib/data/workingHours";
import { listPublicBlocksInRange } from "@/lib/data/blocks";
import { listPublicBookingsInRange } from "@/lib/data/bookings";
import {
  addLocalDays,
  getAvailableSlots,
  localDayRangeUtc,
  type Interval,
  type WorkingHourShift,
} from "@/lib/availability";

/**
 * Disponibilidade de VÁRIOS dias de uma vez, para a página pública.
 *
 * A página mostra uma faixa com os próximos dias e já marca quais têm horário
 * livre — a cliente não precisa abrir dia por dia para descobrir que estava
 * tudo cheio. Buscar dia a dia seriam três consultas por dia; aqui são três
 * no total, e o cálculo de cada dia é a mesma `getAvailableSlots` que o
 * servidor usa para revalidar o agendamento.
 */

/** Teto de dias por consulta: o suficiente para a faixa e para "mais datas". */
export const MAX_AVAILABILITY_DAYS = 31;

export interface AvailabilityWindow {
  workingHours: WorkingHourShift[];
  busy: Interval[];
}

export interface DayAvailability {
  /** "YYYY-MM-DD" no fuso do estúdio. */
  date: string;
  slots: { start: string; end: string }[];
}

export async function loadAvailabilityWindow(
  studioId: string,
  fromDate: string,
  days: number
): Promise<AvailabilityWindow> {
  const start = localDayRangeUtc(fromDate).start.toISOString();
  const end = localDayRangeUtc(addLocalDays(fromDate, days - 1)).end.toISOString();

  const [workingHours, blocks, bookings] = await Promise.all([
    listPublicWorkingHours(studioId),
    listPublicBlocksInRange(studioId, start, end),
    listPublicBookingsInRange(studioId, start, end),
  ]);

  return {
    workingHours,
    busy: [
      ...blocks.map((b) => ({ start: new Date(b.start_at), end: new Date(b.end_at) })),
      ...bookings
        .filter((b) => b.status !== "cancelado")
        .map((b) => ({ start: new Date(b.start_at), end: new Date(b.end_at) })),
    ],
  };
}

export function slotsByDay(
  window: AvailabilityWindow,
  durationMin: number,
  fromDate: string,
  days: number,
  now = new Date()
): DayAvailability[] {
  return Array.from({ length: days }, (_, offset) => {
    const date = addLocalDays(fromDate, offset);
    const slots = getAvailableSlots({
      date,
      durationMin,
      workingHours: window.workingHours,
      // Os intervalos ocupados cobrem a janela inteira; o que não toca o dia
      // simplesmente não colide com nenhum candidato.
      blocks: window.busy,
      bookings: [],
      now,
    });
    return {
      date,
      slots: slots.map((slot) => ({ start: slot.start.toISOString(), end: slot.end.toISOString() })),
    };
  });
}

/**
 * Primeiro horário livre de cada serviço nos próximos `days` dias — a prévia
 * "próximo horário" da lista de serviços, calculada no servidor junto com a
 * página em vez de uma requisição por serviço no navegador.
 */
export async function nextSlotByService(
  studioId: string,
  services: { id: string; duration_min: number }[],
  fromDate: string,
  days = 14
): Promise<Record<string, string | null>> {
  if (services.length === 0) return {};
  const window = await loadAvailabilityWindow(studioId, fromDate, days);
  const now = new Date();
  return Object.fromEntries(
    services.map((service) => {
      const first = slotsByDay(window, service.duration_min, fromDate, days, now).find(
        (day) => day.slots.length > 0
      );
      return [service.id, first?.slots[0]?.start ?? null];
    })
  );
}
