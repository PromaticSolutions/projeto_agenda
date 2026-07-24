import Link from "next/link";
import { Search, X } from "lucide-react";
import { getMyStudio } from "@/lib/data/studios";
import { listMyServices } from "@/lib/data/services";
import { listBookingsForDay, searchBookings } from "@/lib/data/bookings";
import { DateNav } from "@/components/app/date-nav";
import { WeekStrip } from "@/components/app/week-strip";
import { BookingStatusSelect } from "@/components/app/booking-status-select";
import { ExportPdfButton } from "@/components/app/export-pdf-button";
import { CopyLinkButton } from "@/components/app/copy-link-button";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { formatDateLocal, formatTimeLocal, getStudioPublicUrl } from "@/lib/format";
import { nextLocalDate, prevLocalDate, utcToLocalDate } from "@/lib/availability";
import { cn } from "@/lib/utils";

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
          <h1 className="font-heading text-2xl font-semibold text-plum-900">
            {query ? "Busca" : "Painel do dia"}
          </h1>
          <p className="text-muted-foreground">
            {query ? `Resultados para "${query}"` : formatDateLocal(new Date(`${date}T12:00:00`))}
          </p>
        </div>
        {!query && (
          <div className="flex flex-wrap items-center gap-2">
            <DateNav
              date={date}
              prevDate={prevLocalDate(date)}
              nextDate={nextLocalDate(date)}
              todayDate={today}
            />
            <ExportPdfButton
              studioName={studio.name}
              date={date}
              bookings={bookings}
              serviceById={serviceById}
            />
          </div>
        )}
      </div>

      {!query && <WeekStrip date={date} todayDate={today} />}

      <form action="/app" method="GET" className="flex items-center gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            name="q"
            defaultValue={query}
            placeholder="Buscar por nome ou telefone"
            className="rounded-full pl-9"
          />
        </div>
        <Button type="submit" variant="outline" size="sm" className="rounded-full">
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
          <StatTile label="Total" value={counters.total} accent="bg-plum-900" />
          <StatTile label="Agendados" value={counters.agendado} accent="bg-violet-600" />
          <StatTile label="Em atendimento" value={counters.em_atendimento} accent="bg-magenta" />
          <StatTile label="Finalizados" value={counters.finalizado} accent="bg-wa" />
        </div>
      )}

      {bookings.length === 0 ? (
        <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-plum-900/15 p-10 text-center">
          <p className="text-muted-foreground">
            {query ? "Nenhum agendamento encontrado." : "Nenhum agendamento para este dia."}
          </p>
          {!query && (
            <div className="flex flex-wrap items-center justify-center gap-2">
              <CopyLinkButton url={getStudioPublicUrl(studio.slug)} />
              <Button variant="outline" size="sm" render={<Link href="/app/services" />}>
                Cadastrar serviços
              </Button>
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-2xl bg-card p-4 shadow-sm ring-1 ring-plum-900/5 sm:p-5">
          <div className="relative">
            <div className="day-rail-line absolute top-1 bottom-1 left-19 w-px" />
            <div className="flex flex-col divide-y divide-border/70">
              {(() => {
                const now = new Date();
                const showNowMarker = !query && date === today;
                let markerInserted = false;
                return bookings.flatMap((booking) => {
                  const service = serviceById.get(booking.service_id);
                  const start = new Date(booking.start_at);
                  const rows = [];
                  if (showNowMarker && !markerInserted && start.getTime() > now.getTime()) {
                    markerInserted = true;
                    rows.push(
                      <div key="now-marker" className="flex items-center gap-3 py-1">
                        <div className="w-14 shrink-0 text-right text-[11px] font-semibold text-magenta">
                          agora
                        </div>
                        <div className="relative flex w-6 shrink-0 justify-center">
                          <span className="relative z-10 size-2 rounded-full bg-magenta ring-4 ring-card" />
                        </div>
                        <div className="h-px flex-1 bg-magenta/25" />
                      </div>
                    );
                  }
                  rows.push(
                    <div key={booking.id} className="flex items-center gap-3 py-3.5 first:pt-0 last:pb-0">
                      <div className="w-14 shrink-0 text-right">
                        <p className="text-sm font-semibold tabular-nums text-plum-900">
                          {formatTimeLocal(start)}
                        </p>
                        {query && (
                          <p className="text-[11px] text-muted-foreground">{formatDateLocal(start)}</p>
                        )}
                      </div>
                      <div className="relative flex w-6 shrink-0 justify-center">
                        <span
                          className="relative z-10 size-3 rounded-full ring-4 ring-card"
                          style={{ backgroundColor: service?.color ?? "#7C3AED" }}
                        />
                      </div>
                      <div className="flex min-w-0 flex-1 flex-wrap items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate font-medium text-plum-900">{booking.client_name}</p>
                          <p className="truncate text-sm text-muted-foreground">
                            {service?.name ?? "Serviço removido"} · {booking.client_phone}
                          </p>
                        </div>
                        <BookingStatusSelect bookingId={booking.id} status={booking.status} />
                      </div>
                    </div>
                  );
                  return rows;
                });
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatTile({ label, value, accent }: { label: string; value: number; accent: string }) {
  return (
    <div className="overflow-hidden rounded-2xl bg-card shadow-sm ring-1 ring-plum-900/5">
      <div className={cn("h-1", accent)} />
      <div className="p-4">
        <p className="font-heading text-2xl font-semibold text-plum-900">{value}</p>
        <p className="text-sm text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}
