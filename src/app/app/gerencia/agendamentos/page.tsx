import {
  listSalonAttendants,
  listSalonBookings,
  listSalonServices,
  narrowToAttendant,
  requireManager,
} from "@/lib/data/salons";
import { AttendantFilter } from "@/components/app/attendant-filter";
import { BOOKING_STATUS_LABELS } from "@/lib/booking-status";
import { formatDateLocal, formatPhoneDisplay, formatTimeLocal } from "@/lib/format";

export const metadata = { title: "Agendamentos do salão — Timely" };

/** Janela padrão: a semana que vem e a que passou. Cobre "o que está por vir"
 *  sem puxar anos de histórico que ninguém olha nesta tela. */
const DAYS_BACK = 7;
const DAYS_AHEAD = 14;

interface PageProps {
  searchParams: Promise<{ atendente?: string }>;
}

export default async function GerenciaAgendamentosPage({ searchParams }: PageProps) {
  const manager = await requireManager();
  const [params, attendants] = await Promise.all([
    searchParams,
    listSalonAttendants(manager.salonId),
  ]);

  const studioIds = narrowToAttendant(
    attendants.map((a) => a.id),
    params.atendente
  );

  const now = new Date();
  const from = new Date(now.getTime() - DAYS_BACK * 86_400_000);
  const to = new Date(now.getTime() + DAYS_AHEAD * 86_400_000);

  const [bookings, services] = await Promise.all([
    listSalonBookings(studioIds, from.toISOString(), to.toISOString()),
    listSalonServices(studioIds),
  ]);

  const nameByStudio = new Map(attendants.map((a) => [a.id, a.name]));
  const serviceById = new Map(services.map((s) => [s.id, s.name]));

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-5">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold text-foreground">Agendamentos do salão</h1>
          <p className="text-sm text-muted-foreground">
            De {formatDateLocal(from)} a {formatDateLocal(to)} — {bookings.length}{" "}
            {bookings.length === 1 ? "atendimento" : "atendimentos"}.
          </p>
        </div>
        <AttendantFilter attendants={attendants.map((a) => ({ id: a.id, name: a.name }))} />
      </header>

      {bookings.length === 0 ? (
        <div className="panel flex flex-col items-center gap-1 border-dashed p-10 text-center">
          <p className="font-medium text-foreground">Nenhum atendimento nessa janela</p>
          <p className="text-sm text-muted-foreground">
            Assim que as atendentes receberem agendamentos, eles aparecem aqui.
          </p>
        </div>
      ) : (
        <div className="panel overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-left">
                  <th className="section-label px-4 py-2.5 text-muted-foreground">Quando</th>
                  <th className="section-label px-4 py-2.5 text-muted-foreground">Cliente</th>
                  <th className="section-label px-4 py-2.5 text-muted-foreground">Serviço</th>
                  <th className="section-label px-4 py-2.5 text-muted-foreground">Atendente</th>
                  <th className="section-label px-4 py-2.5 text-muted-foreground">Situação</th>
                </tr>
              </thead>
              <tbody>
                {bookings.map((booking) => {
                  const startAt = new Date(booking.start_at);
                  return (
                    <tr key={booking.id} className="border-b border-border last:border-0">
                      <td className="whitespace-nowrap px-4 py-3 text-foreground">
                        {formatDateLocal(startAt)}{" "}
                        <span className="text-muted-foreground">{formatTimeLocal(startAt)}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-medium text-foreground">{booking.client_name}</span>
                        <span className="block text-xs text-muted-foreground">
                          {formatPhoneDisplay(booking.client_phone)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {serviceById.get(booking.service_id) ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {nameByStudio.get(booking.studio_id) ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {BOOKING_STATUS_LABELS[booking.status]}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
