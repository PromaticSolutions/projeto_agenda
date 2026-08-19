import { addLocalDays, utcToLocalDate } from "@/lib/availability";
import type { Booking, BookingStatus } from "@/lib/types";

/**
 * Vocabulário dos filtros do módulo /app/bookings.
 *
 * Tudo aqui é função pura sobre valores de URL: a página serve como leitora
 * dos `searchParams` e a barra de filtros como escritora, e as duas importam
 * as MESMAS constantes. Se o vocabulário morasse em cada lado, um dia a barra
 * ofereceria uma opção que a página não sabe ler — e o filtro cairia
 * silenciosamente no padrão.
 */

// --- Período -----------------------------------------------------------------

export const BOOKING_PERIODS = [
  { value: "hoje", label: "Hoje" },
  { value: "7d", label: "Próximos 7 dias" },
  { value: "30d", label: "Próximos 30 dias" },
  { value: "passados", label: "Últimos 30 dias" },
] as const;

export type BookingPeriod = (typeof BOOKING_PERIODS)[number]["value"];

export const DEFAULT_BOOKING_PERIOD: BookingPeriod = "7d";

export function parseBookingPeriod(value: string | undefined): BookingPeriod {
  return BOOKING_PERIODS.some((p) => p.value === value)
    ? (value as BookingPeriod)
    : DEFAULT_BOOKING_PERIOD;
}

/**
 * Intervalo de datas locais (inclusivo nas duas pontas) de um período.
 *
 * "passados" inclui o próprio dia de propósito: um atendimento das 9h já é
 * passado às 15h, e escondê-lo do histórico só porque a data é hoje faria a
 * dona procurar por ele em dois lugares.
 */
export function bookingPeriodRange(
  period: BookingPeriod,
  today: string
): { from: string; to: string } {
  switch (period) {
    case "hoje":
      return { from: today, to: today };
    case "7d":
      return { from: today, to: addLocalDays(today, 6) };
    case "30d":
      return { from: today, to: addLocalDays(today, 29) };
    case "passados":
      return { from: addLocalDays(today, -29), to: today };
  }
}

/** Histórico lê do mais recente para o mais antigo; agenda futura, o contrário. */
export function isDescendingPeriod(period: BookingPeriod): boolean {
  return period === "passados";
}

// --- Status ------------------------------------------------------------------

export type BookingStatusFilter = BookingStatus | "todos";

const STATUS_FILTER_VALUES: BookingStatusFilter[] = [
  "todos",
  "agendado",
  "em_atendimento",
  "finalizado",
  "cancelado",
];

export function parseBookingStatusFilter(value: string | undefined): BookingStatusFilter {
  return STATUS_FILTER_VALUES.includes(value as BookingStatusFilter)
    ? (value as BookingStatusFilter)
    : "todos";
}

// --- Modo de visualização ----------------------------------------------------

export const BOOKING_VIEWS = ["cards", "lista"] as const;
export type BookingView = (typeof BOOKING_VIEWS)[number];
export const DEFAULT_BOOKING_VIEW: BookingView = "cards";

export function parseBookingView(value: string | undefined): BookingView {
  return BOOKING_VIEWS.includes(value as BookingView)
    ? (value as BookingView)
    : DEFAULT_BOOKING_VIEW;
}

// --- Aplicação ---------------------------------------------------------------

/**
 * Dobra acentos e caixa: "Mônica" tem que ser encontrada digitando "monica".
 * A busca do painel (`searchBookings`) roda no Postgres com `ilike` e não faz
 * isso; aqui o filtro é em memória sobre um intervalo já carregado, então dá
 * para ser mais generoso sem custo.
 */
function fold(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

export interface BookingFilters {
  status: BookingStatusFilter;
  /** ID do serviço, ou "todos". */
  serviceId: string;
  /** Nome ou telefone; string vazia desliga o filtro. */
  query: string;
}

export function filterBookings(bookings: Booking[], filters: BookingFilters): Booking[] {
  const q = fold(filters.query.trim());
  const qDigits = filters.query.replace(/\D/g, "");

  return bookings.filter((booking) => {
    if (filters.status !== "todos" && booking.status !== filters.status) return false;
    if (filters.serviceId !== "todos" && booking.service_id !== filters.serviceId) return false;
    if (!q) return true;
    if (fold(booking.client_name).includes(q)) return true;
    return qDigits.length > 0 && booking.client_phone.includes(qDigits);
  });
}

export interface BookingDayGroup {
  /** Data local do estúdio, "YYYY-MM-DD". */
  date: string;
  bookings: Booking[];
}

/**
 * Agrupa por dia PRESERVANDO a ordem recebida — quem decide se o dia mais
 * recente vem primeiro é o chamador, via `isDescendingPeriod`.
 */
export function groupBookingsByDay(bookings: Booking[]): BookingDayGroup[] {
  const groups: BookingDayGroup[] = [];
  for (const booking of bookings) {
    const date = utcToLocalDate(new Date(booking.start_at));
    const last = groups.at(-1);
    if (last && last.date === date) last.bookings.push(booking);
    else groups.push({ date, bookings: [booking] });
  }
  return groups;
}
