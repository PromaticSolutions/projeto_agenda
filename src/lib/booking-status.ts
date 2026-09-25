import type { BookingStatus } from "@/lib/types";

export const BOOKING_STATUS_LABELS: Record<BookingStatus, string> = {
  agendado: "Agendado",
  em_atendimento: "Em atendimento",
  finalizado: "Finalizado",
  cancelado: "Cancelado",
};

export const BOOKING_STATUS_ORDER: BookingStatus[] = [
  "agendado",
  "em_atendimento",
  "finalizado",
  "cancelado",
];

export const BOOKING_STATUS_DOT: Record<BookingStatus, string> = {
  agendado: "bg-violet-500",
  em_atendimento: "bg-magenta",
  finalizado: "bg-wa",
  cancelado: "bg-muted-foreground",
};

/**
 * Fundo SÓLIDO do status, para pílula com texto branco (o seletor rápido do
 * card). Não reaproveita `BOOKING_STATUS_DOT`: os tons do ponto são claros
 * de propósito — são marcadores de 6px — e com texto branco em cima ficavam
 * abaixo de 4,5:1 (medido). Aqui cada tom é um passo mais escuro.
 */
export const BOOKING_STATUS_SOLID: Record<BookingStatus, string> = {
  agendado: "bg-violet-600",
  em_atendimento: "bg-magenta",
  finalizado: "bg-[#0b6b37]",
  cancelado: "bg-muted-foreground",
};
