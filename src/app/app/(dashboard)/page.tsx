import Link from "next/link";
import { Search, X } from "lucide-react";
import { getMyStudio } from "@/lib/data/studios";
import { listMyServices } from "@/lib/data/services";
import { listMyClients } from "@/lib/data/clients";
import { listBookingsForDay, searchBookings } from "@/lib/data/bookings";
import { DateNav } from "@/components/app/date-nav";
import { WeekStrip } from "@/components/app/week-strip";
import { BookingStatusSelect } from "@/components/app/booking-status-select";
import { BookingFormDialog } from "@/components/app/booking-form-dialog";
import { ExportPdfButton } from "@/components/app/export-pdf-button";
import { ManualBookingDialog } from "@/components/app/manual-booking-dialog";
import { CopyLinkButton } from "@/components/app/copy-link-button";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { formatDateLocal, formatTimeLocal, getStudioPublicUrl } from "@/lib/format";
import { nextLocalDate, prevLocalDate, utcToLocalDate } from "@/lib/availability";
import { cn } from "@/lib/utils";

export const metadata = { title: "Painel do dia — Timely" };

/**
 * Índice da primeira reserva ainda no futuro — é antes dela que entra a régua
 * do "agora". Fica fora do componente porque lê o relógio, e leitura de tempo
 * dentro do render é impura para o React Compiler.
 */
function findNowMarkerIndex(
  bookings: { start_at: string }[],
  enabled: boolean
): number {
  if (!enabled) return -1;
  const nowMs = Date.now();
  return bookings.findIndex((booking) => new Date(booking.start_at).getTime() > nowMs);
}

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

  const [services, clients] = await Promise.all([
    listMyServices(studio.id),
    listMyClients(studio.id),
  ]);
  const serviceById = new Map(services.map((s) => [s.id, s]));

  const bookings = query
    ? await searchBookings(studio.id, query)
    : await listBookingsForDay(studio.id, date);

  const nowMarkerIndex = findNowMarkerIndex(bookings, !query && date === today);

  const counters = {
    total: bookings.length,
    agendado: bookings.filter((b) => b.status === "agendado").length,
    em_atendimento: bookings.filter((b) => b.status === "em_atendimento").length,
    finalizado: bookings.filter((b) => b.status === "finalizado").length,
  };

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-5">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold text-foreground">
            {query ? "Busca" : "Painel do dia"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {query
              ? `Resultados para "${query}"`
              : formatDateLocal(new Date(`${date}T12:00:00`))}
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
            {services.length > 0 && (
              <ManualBookingDialog services={services} defaultDate={date} clients={clients} />
            )}
          </div>
        )}
      </header>

      {!query && <WeekStrip date={date} todayDate={today} />}

      <form action="/app" method="GET" className="flex items-center gap-2">
        <div className="relative max-w-md flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            name="q"
            defaultValue={query}
            placeholder="Buscar por nome ou telefone"
            className="pl-9"
          />
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
        <section aria-label="Resumo do dia" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatTile label="Total" value={counters.total} accent="bg-foreground" />
          <StatTile label="Agendados" value={counters.agendado} accent="bg-primary" />
          <StatTile label="Em atendimento" value={counters.em_atendimento} accent="bg-amber-500" />
          <StatTile label="Finalizados" value={counters.finalizado} accent="bg-emerald-500" />
        </section>
      )}

      {bookings.length === 0 ? (
        <div className="panel flex flex-col items-center gap-3 border-dashed p-10 text-center">
          <p className="font-medium text-foreground">
            {query ? "Nenhum agendamento encontrado" : "Nenhum agendamento para este dia"}
          </p>
          {!query && (
            <div className="flex flex-wrap items-center justify-center gap-2">
              <ManualBookingDialog services={services} defaultDate={date} clients={clients} />
              <CopyLinkButton url={getStudioPublicUrl(studio.slug)} />
              <Button variant="outline" size="sm" render={<Link href="/app/services" />}>
                Cadastrar serviços
              </Button>
            </div>
          )}
        </div>
      ) : (
        <section className="panel overflow-hidden">
          <header className="flex items-center justify-between gap-4 border-b border-border px-4 py-3">
            <h2 className="font-medium text-foreground">
              {query ? "Resultados" : "Agenda do dia"}
            </h2>
            <span className="text-sm text-muted-foreground">
              {bookings.length} {bookings.length === 1 ? "atendimento" : "atendimentos"}
            </span>
          </header>

          <ol className="divide-y divide-border">
            <BookingRows
              bookings={bookings}
              serviceById={serviceById}
              services={services}
              nowMarkerIndex={nowMarkerIndex}
              showDate={Boolean(query)}
            />
          </ol>
        </section>
      )}
    </div>
  );
}

type BookingRowsProps = {
  bookings: Awaited<ReturnType<typeof listBookingsForDay>>;
  serviceById: Map<string, Awaited<ReturnType<typeof listMyServices>>[number]>;
  services: Awaited<ReturnType<typeof listMyServices>>;
  /** Índice da linha antes da qual entra a régua do "agora"; -1 desliga. */
  nowMarkerIndex: number;
  showDate: boolean;
};

function BookingRows({
  bookings,
  serviceById,
  services,
  nowMarkerIndex,
  showDate,
}: BookingRowsProps) {
  return (
    <>
      {bookings.flatMap((booking, index) => {
        const service = serviceById.get(booking.service_id);
        const start = new Date(booking.start_at);

        const row = (
          <li key={booking.id} className="flex items-center gap-3 px-4 py-3">
            <div className="w-12 shrink-0 text-right">
              <time className="text-sm font-medium text-foreground">{formatTimeLocal(start)}</time>
              {showDate && (
                <p className="text-xs text-muted-foreground">{formatDateLocal(start)}</p>
              )}
            </div>

            <span
              className="size-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: service?.color ?? "var(--primary)" }}
              aria-hidden
            />

            <div className="flex min-w-0 flex-1 flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-medium text-foreground">{booking.client_name}</p>
                <p className="truncate text-sm text-muted-foreground">
                  {service?.name ?? "Serviço removido"} · {booking.client_phone}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <BookingFormDialog
                  services={services}
                  booking={booking}
                  clientName={booking.client_name}
                />
                <BookingStatusSelect bookingId={booking.id} status={booking.status} />
              </div>
            </div>
          </li>
        );

        if (index !== nowMarkerIndex) return [row];

        return [
          <li key="now-marker" className="flex items-center gap-3 px-4 py-1.5">
            <span className="w-12 shrink-0 text-right text-xs font-medium text-primary">agora</span>
            <span className="h-px flex-1 bg-primary/30" />
          </li>,
          row,
        ];
      })}
    </>
  );
}

function StatTile({ label, value, accent }: { label: string; value: number; accent: string }) {
  return (
    <div className="panel card-lift overflow-hidden">
      <div className={cn("h-1", accent)} />
      <div className="p-3">
        <output className="block text-2xl font-semibold text-foreground">{value}</output>
        <p className="text-sm text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}
