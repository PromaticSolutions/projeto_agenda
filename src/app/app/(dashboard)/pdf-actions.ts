"use server";

import { listBookingsForMonth } from "@/lib/data/bookings";
import { listMyServices } from "@/lib/data/services";
import { getMyStudio } from "@/lib/data/studios";
import type { BookingStatus } from "@/lib/types";

export interface AgendaExportRow {
  startAt: string;
  endAt: string;
  clientName: string;
  clientPhone: string;
  serviceName: string;
  status: BookingStatus;
}

export async function getMonthAgendaAction(
  year: number,
  month: number
): Promise<{ studioName: string; rows: AgendaExportRow[] }> {
  const studio = await getMyStudio();
  if (!studio) throw new Error("Não autenticado");

  const [bookings, services] = await Promise.all([
    listBookingsForMonth(studio.id, year, month),
    listMyServices(studio.id),
  ]);
  const serviceById = new Map(services.map((s) => [s.id, s]));

  return {
    studioName: studio.name,
    rows: bookings
      .sort((a, b) => a.start_at.localeCompare(b.start_at))
      .map((b) => ({
        startAt: b.start_at,
        endAt: b.end_at,
        clientName: b.client_name,
        clientPhone: b.client_phone,
        serviceName: serviceById.get(b.service_id)?.name ?? "Serviço removido",
        status: b.status,
      })),
  };
}
