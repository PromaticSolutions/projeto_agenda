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
