import Link from "next/link";
import { getMyStudio } from "@/lib/data/studios";
import { listMyServices } from "@/lib/data/services";
import { listMyClients } from "@/lib/data/clients";
import { listBookingsForRange } from "@/lib/data/bookings";
import { BookingsToolbar } from "@/components/app/bookings-toolbar";
import { BookingCard } from "@/components/app/booking-card";
import { BookingFormDialog } from "@/components/app/booking-form-dialog";
import { BookingStatusSelect } from "@/components/app/booking-status-select";
import { ManualBookingDialog } from "@/components/app/manual-booking-dialog";
import { Button } from "@/components/ui/button";
import {
  bookingPeriodRange,
  filterBookings,
  groupBookingsByDay,
  isDescendingPeriod,
  parseBookingPeriod,
  parseBookingStatusFilter,
  parseBookingView,
  type BookingDayGroup,
} from "@/lib/bookings-filter";
import { BOOKING_STATUS_DOT, BOOKING_STATUS_LABELS, BOOKING_STATUS_ORDER } from "@/lib/booking-status";
import { formatDateLocal, formatPhoneDisplay, formatTimeLocal } from "@/lib/format";
import { nextLocalDate, utcToLocalDate } from "@/lib/availability";
import { cn } from "@/lib/utils";
import type { Booking, Service } from "@/lib/types";

export const metadata = { title: "Agendamentos — Timely" };

/**
 * Módulo de agendamentos: a agenda inteira, em oposição ao "Painel do dia".
 *
 * O painel responde "o que acontece hoje" e é otimizado para isso — um dia por
 * vez, régua do agora, contadores. Esta tela responde "onde está o
 * atendimento da fulana", que é outra pergunta: atravessa dias, filtra por
 * status e serviço, e deixa escolher entre grade e lista conforme a densidade
 * que a dona quer na tela. Manter as duas separadas evita transformar o painel
 * num formulário de busca com um dia dentro.
 */

interface BookingsPageProps {
  searchParams: Promise<{
    periodo?: string;
    status?: string;
    servico?: string;
    q?: string;
    view?: string;
  }>;
}

export default async function BookingsPage({ searchParams }: BookingsPageProps) {
  const studio = await getMyStudio();
  if (!studio) return null;

  const params = await searchParams;
  const period = parseBookingPeriod(params.periodo);
  const status = parseBookingStatusFilter(params.status);
  const serviceId = params.servico ?? "todos";
  const query = params.q?.trim() ?? "";
  const view = parseBookingView(params.view);

  const today = utcToLocalDate(new Date());
  const range = bookingPeriodRange(period, today);

  const [services, clients, bookingsInRange] = await Promise.all([
    listMyServices(studio.id),
    listMyClients(studio.id),
    listBookingsForRange(studio.id, range.from, range.to),
  ]);
  const serviceById = new Map(services.map((s) => [s.id, s]));

  const filtered = filterBookings(bookingsInRange, { status, serviceId, query });
  // A consulta já devolve em ordem crescente de horário; o histórico lê ao
  // contrário, do mais recente para o mais antigo.
  const ordered = isDescendingPeriod(period) ? [...filtered].reverse() : filtered;
  const groups = groupBookingsByDay(ordered);

  const counters = BOOKING_STATUS_ORDER.map((s) => ({
    status: s,
    count: filtered.filter((b) => b.status === s).length,
  })).filter((c) => c.count > 0);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-5">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold text-foreground">Agendamentos</h1>
          <p className="text-sm text-muted-foreground">
            Todos os atendimentos do estúdio, em grade ou em lista.
          </p>
        </div>
        {services.length > 0 && (
          <ManualBookingDialog services={services} defaultDate={today} clients={clients} />
        )}
      </header>

      <BookingsToolbar
        period={period}
        status={status}
        serviceId={serviceId}
        query={query}
        view={view}
        services={services}
      />

      {filtered.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="font-medium text-foreground">
            {filtered.length} {filtered.length === 1 ? "atendimento" : "atendimentos"}
          </span>
          {counters.map((counter) => (
            <span
              key={counter.status}
              className="flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-0.5 text-xs text-muted-foreground"
            >
              <span className={cn("size-1.5 rounded-full", BOOKING_STATUS_DOT[counter.status])} />
              {counter.count} {BOOKING_STATUS_LABELS[counter.status].toLowerCase()}
            </span>
          ))}
        </div>
      )}

      {groups.length === 0 ? (
        <EmptyState hasBookingsInRange={bookingsInRange.length > 0} />
      ) : (
        <div className="flex flex-col gap-6">
          {groups.map((group) => (
            <DayGroup
              key={group.date}
              group={group}
              today={today}
              view={view}
              services={services}
              serviceById={serviceById}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function DayGroup({
  group,
  today,
  view,
  services,
  serviceById,
}: {
  group: BookingDayGroup;
  today: string;
  view: "cards" | "lista";
  services: Service[];
  serviceById: Map<string, Service>;
}) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <h2 className="text-sm font-medium text-foreground">{dayLabel(group.date, today)}</h2>
        <span className="h-px flex-1 bg-border" aria-hidden />
        <span className="text-xs text-muted-foreground">
          {group.bookings.length} {group.bookings.length === 1 ? "atendimento" : "atendimentos"}
        </span>
      </div>

      {view === "cards" ? (
        <ul className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
          {group.bookings.map((booking) => (
            <BookingCard
              key={booking.id}
              booking={booking}
              service={serviceById.get(booking.service_id)}
              services={services}
            />
          ))}
        </ul>
      ) : (
        <ol className="panel divide-y divide-border overflow-hidden">
          {group.bookings.map((booking) => (
            <BookingRow
              key={booking.id}
              booking={booking}
              service={serviceById.get(booking.service_id)}
              services={services}
            />
          ))}
        </ol>
      )}
    </section>
  );
}

function BookingRow({
  booking,
  service,
  services,
}: {
  booking: Booking;
  service: Service | undefined;
  services: Service[];
}) {
  const start = new Date(booking.start_at);
  const end = new Date(booking.end_at);

  return (
    <li
      className={cn(
        "group flex flex-wrap items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/50 focus-within:bg-muted/50",
        booking.status === "cancelado" && "opacity-65"
      )}
    >
      <div className="w-24 shrink-0">
        <time className="text-sm font-medium text-foreground">{formatTimeLocal(start)}</time>
        <p className="text-xs text-muted-foreground">até {formatTimeLocal(end)}</p>
      </div>

      <span
        className="size-2.5 shrink-0 rounded-full"
        style={{ backgroundColor: service?.color ?? "var(--primary)" }}
        aria-hidden
      />

      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-foreground">{booking.client_name}</p>
        <p className="truncate text-sm text-muted-foreground">
          {service?.name ?? "Serviço removido"} · {formatPhoneDisplay(booking.client_phone)}
        </p>
      </div>

      <div className="flex items-center gap-1">
        <BookingStatusSelect bookingId={booking.id} status={booking.status} />
        <div className="opacity-100 transition-opacity duration-200 md:opacity-60 md:group-hover:opacity-100 md:group-focus-within:opacity-100">
          <BookingFormDialog
            services={services}
            booking={booking}
            clientName={booking.client_name}
          />
        </div>
      </div>
    </li>
  );
}

function EmptyState({ hasBookingsInRange }: { hasBookingsInRange: boolean }) {
  return (
    <div className="panel flex flex-col items-center gap-3 border-dashed p-10 text-center">
      <p className="font-medium text-foreground">
        {hasBookingsInRange
          ? "Nenhum agendamento com esses filtros"
          : "Nenhum agendamento neste período"}
      </p>
      <p className="max-w-sm text-sm text-muted-foreground">
        {hasBookingsInRange
          ? "Existem atendimentos no período, mas nenhum passa pelos filtros escolhidos."
          : "Marque um atendimento pelo botão acima ou divulgue o link público do estúdio."}
      </p>
      {!hasBookingsInRange && (
        <Button variant="outline" size="sm" render={<Link href="/app" />}>
          Ir para o painel do dia
        </Button>
      )}
    </div>
  );
}

/** "Hoje", "Amanhã" ou a data por extenso — o rótulo do cabeçalho de cada dia. */
function dayLabel(date: string, today: string): string {
  // Meio-dia evita que a conversão para o fuso do estúdio caia no dia anterior.
  const formatted = formatDateLocal(new Date(`${date}T12:00:00Z`));
  if (date === today) return `Hoje · ${formatted}`;
  if (date === nextLocalDate(today)) return `Amanhã · ${formatted}`;
  return formatted;
}
