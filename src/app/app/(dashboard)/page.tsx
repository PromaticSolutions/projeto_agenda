import Link from "next/link";
import { Search, X } from "lucide-react";
import { getMyStudio } from "@/lib/data/studios";
import { listMyServices } from "@/lib/data/services";
import { listBookingsForDay, searchBookings } from "@/lib/data/bookings";
import { DateNav } from "@/components/app/date-nav";
import { BookingStatusSelect } from "@/components/app/booking-status-select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { formatDateLocal, formatTimeLocal } from "@/lib/format";
import { nextLocalDate, prevLocalDate, utcToLocalDate } from "@/lib/availability";

export const metadata = { title: "Painel do dia — Agenda Online" };

interface DashboardHomeProps {
  searchParams: Promise<{ date?: string; q?: string }>;
}

export default async function DashboardHomePage({ searchParams }: DashboardHomeProps) {
  const studio = await getMyStudio();
  if (!studio) return null;

  const { date: dateParam, q } = await searchParams;
  const today = utcToLocalDate(new Date());
  const date = dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? dateParam : today;
  const query = q?.trim() ?? "";

  const services = await listMyServices(studio.id);
  const serviceById = new Map(services.map((s) => [s.id, s]));

  const bookings = query
    ? await searchBookings(studio.id, query)
    : await listBookingsForDay(studio.id, date);

  const counters = {
    total: bookings.length,
    agendado: bookings.filter((b) => b.status === "agendado").length,
    em_atendimento: bookings.filter((b) => b.status === "em_atendimento").length,
    finalizado: bookings.filter((b) => b.status === "finalizado").length,
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-semibold text-plum-900 dark:text-blush-50">
            {query ? "Busca" : "Painel do dia"}
          </h1>
          <p className="text-muted-foreground">
            {query ? `Resultados para "${query}"` : formatDateLocal(new Date(`${date}T12:00:00`))}
          </p>
        </div>
        {!query && (
          <DateNav
            date={date}
            prevDate={prevLocalDate(date)}
            nextDate={nextLocalDate(date)}
            todayDate={today}
          />
        )}
      </div>

      <form action="/app" method="GET" className="flex items-center gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input name="q" defaultValue={query} placeholder="Buscar por nome ou telefone" className="pl-8" />
        </div>
        <Button type="submit" variant="outline" size="sm">
          Buscar
        </Button>
        {query && (
          <Button variant="ghost" size="sm" render={<Link href="/app" />}>
            <X className="size-4" /> Limpar
          </Button>
        )}
      </form>

      {!query && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatTile label="Total" value={counters.total} />
          <StatTile label="Agendados" value={counters.agendado} />
          <StatTile label="Em atendimento" value={counters.em_atendimento} />
          <StatTile label="Finalizados" value={counters.finalizado} />
        </div>
      )}

      {bookings.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-8 text-center text-muted-foreground">
          {query ? "Nenhum agendamento encontrado." : "Nenhum agendamento para este dia."}
        </p>
      ) : (
        <div className="flex flex-col divide-y divide-border rounded-lg border border-border">
          {bookings.map((booking) => {
            const service = serviceById.get(booking.service_id);
            const start = new Date(booking.start_at);
            const end = new Date(booking.end_at);
            return (
              <div key={booking.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="w-20 shrink-0 text-sm font-medium tabular-nums">
                    {formatTimeLocal(start)}–{formatTimeLocal(end)}
                    {query && (
                      <p className="text-xs font-normal text-muted-foreground">
                        {formatDateLocal(start)}
                      </p>
                    )}
                  </div>
                  <span
                    className="size-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: service?.color ?? "#7C3AED" }}
                  />
                  <div>
                    <p className="font-medium">{booking.client_name}</p>
                    <p className="text-sm text-muted-foreground">
                      {service?.name ?? "Serviço removido"} · {booking.client_phone}
                    </p>
                  </div>
                </div>
                <BookingStatusSelect bookingId={booking.id} status={booking.status} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function StatTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-border p-4">
      <p className="text-2xl font-semibold text-plum-900 dark:text-blush-50">{value}</p>
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  );
}
