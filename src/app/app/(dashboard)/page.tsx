import Link from "next/link";
import { CheckCircle2, ChevronRight, Clock3, Search, Sparkles, X } from "lucide-react";
import { getMyStudio } from "@/lib/data/studios";
import { listMyServices } from "@/lib/data/services";
import { listBookingsForDay, searchBookings } from "@/lib/data/bookings";
import { DateNav } from "@/components/app/date-nav";
import { WeekStrip } from "@/components/app/week-strip";
import { BookingStatusSelect } from "@/components/app/booking-status-select";
import { ExportPdfButton } from "@/components/app/export-pdf-button";
import { ManualBookingDialog } from "@/components/app/manual-booking-dialog";
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
    <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-7">
      <div className="relative overflow-hidden rounded-[2rem] border border-violet-950/6 bg-white text-plum-900 shadow-2xl shadow-violet-950/5 sm:px-9 sm:py-9 dark:bg-plum-900 dark:text-white dark:shadow-violet-950/15">
        <div aria-hidden className="absolute -top-20 right-0 size-56 rounded-full bg-violet-500/20 blur-3xl dark:bg-violet-500/45" />
        <div aria-hidden className="absolute -bottom-28 left-1/3 size-52 rounded-full bg-magenta/10 blur-3xl dark:bg-magenta/25" />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold tracking-[.14em] text-violet-600 uppercase dark:text-white/60"><Sparkles className="size-3.5 text-magenta" /> central de atendimento</p>
          <h1 className="font-heading text-3xl font-semibold tracking-tight text-plum-900 sm:text-4xl dark:text-white">
            {query ? "Busca" : "Painel do dia"}
          </h1>
          <p className="mt-1 text-slate-500 dark:text-white/65">
            {query ? `Resultados para "${query}"` : formatDateLocal(new Date(`${date}T12:00:00`))}
          </p>
          {!query && <p className="mt-3 inline-flex rounded-full border border-violet-950/10 bg-violet-50/70 px-2.5 py-1 text-xs font-medium text-plum-900/75 dark:border-white/10 dark:bg-white/10 dark:text-white/75">{counters.total === 0 ? "Sua agenda está livre por enquanto" : `${counters.total} ${counters.total === 1 ? "reserva prevista" : "reservas previstas"} para este dia`}</p>}
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
            <ManualBookingDialog services={services} defaultDate={date} />
          </div>
        )}
        </div>
      </div>

      {!query && <WeekStrip date={date} todayDate={today} />}

      <form action="/app" method="GET" className="flex items-center gap-2 rounded-2xl border border-violet-950/5 bg-white/70 p-2 shadow-sm backdrop-blur dark:border-white/8 dark:bg-white/5">
        <div className="relative flex-1 max-w-xl">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            name="q"
            defaultValue={query}
            placeholder="Buscar por nome ou telefone"
            className="rounded-full border-violet-950/8 bg-white/80 pl-9 dark:border-white/10 dark:bg-white/5"
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

      {!query && (
        <section className="grid gap-3 lg:grid-cols-[1.35fr_.65fr]" aria-label="Resumo operacional">
          <div className="overflow-hidden rounded-3xl border border-violet-950/6 bg-white p-6 shadow-sm dark:border-white/8 dark:bg-card">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold tracking-[.13em] text-violet-600 uppercase">Pulso da agenda</p>
                <h2 className="mt-1 font-heading text-xl font-semibold text-plum-900 dark:text-foreground">
                  {counters.total === 0 ? "Um dia livre para novas oportunidades" : "Tudo sob controle para hoje"}
                </h2>
              </div>
              <span className="flex size-10 items-center justify-center rounded-2xl bg-violet-600/10 text-violet-600"><CheckCircle2 className="size-5" /></span>
            </div>
            <div className="mt-5 h-2 overflow-hidden rounded-full bg-violet-950/6">
              <div className="h-full rounded-full bg-cta transition-all" style={{ width: `${counters.total ? Math.round((counters.finalizado / counters.total) * 100) : 0}%` }} />
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              {counters.total ? `${counters.finalizado} de ${counters.total} atendimentos concluídos.` : "Compartilhe seu link público para começar a receber reservas."}
            </p>
          </div>
          <div className="rounded-3xl bg-violet-50 p-5 text-plum-900 shadow-lg shadow-violet-950/10 dark:bg-[linear-gradient(135deg,#7c3aed,#a93cc9_58%,#e23fa0)] dark:text-white dark:shadow-violet-600/15">
            <div className="flex items-center gap-2 text-violet-700/70 dark:text-white/70"><Clock3 className="size-4" /><p className="text-xs font-bold tracking-[.13em] uppercase">Próximo passo</p></div>
            <p className="mt-3 font-heading text-xl font-semibold">
              {counters.agendado ? `${counters.agendado} ${counters.agendado === 1 ? "cliente aguardando" : "clientes aguardando"}` : "Agenda em dia"}
            </p>
            <p className="mt-1 text-sm text-violet-700/75 dark:text-white/75">{counters.agendado ? "Atualize o status assim que iniciar cada atendimento." : "Use este tempo para ajustar serviços e disponibilidade."}</p>
          </div>
        </section>
      )}

      {bookings.length === 0 ? (
        <div className="flex flex-col items-center gap-4 rounded-3xl border border-dashed border-plum-900/15 bg-white/35 p-12 text-center dark:border-white/12 dark:bg-white/3">
          <p className="text-muted-foreground">
            {query ? "Nenhum agendamento encontrado." : "Nenhum agendamento para este dia."}
          </p>
          {!query && (
            <div className="flex flex-wrap items-center justify-center gap-2">
              <ManualBookingDialog services={services} defaultDate={date} />
              <CopyLinkButton url={getStudioPublicUrl(studio.slug)} />
              <Button variant="outline" size="sm" render={<Link href="/app/services" />}>
                Cadastrar serviços
              </Button>
            </div>
          )}
        </div>
      ) : (
        <section className="rounded-[2rem] bg-card p-5 shadow-xl shadow-violet-950/5 ring-1 ring-plum-900/5 dark:ring-white/8 sm:p-7">
          <div className="mb-5 flex items-end justify-between gap-4 border-b border-border/70 pb-5 dark:border-white/8">
            <div><p className="text-xs font-bold tracking-[.13em] text-violet-600 uppercase">Linha do tempo</p><h2 className="mt-1 font-heading text-2xl font-semibold text-plum-900 dark:text-foreground">{query ? "Resultados encontrados" : "Agenda do dia"}</h2></div>
            <span className="rounded-full bg-violet-600/10 px-3 py-1 text-xs font-semibold text-violet-700 dark:text-violet-300">{bookings.length} {bookings.length === 1 ? "atendimento" : "atendimentos"}</span>
          </div>
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
                    <div key={booking.id} className="group flex items-center gap-3 rounded-xl py-3.5 transition-colors hover:bg-violet-600/[.035] first:pt-0 last:pb-0">
                      <div className="w-14 shrink-0 text-right">
                        <p className="text-sm font-semibold tabular-nums text-plum-900 dark:text-foreground">
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
                          <p className="truncate font-medium text-plum-900 dark:text-foreground">{booking.client_name}</p>
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
        </section>
      )}
    </div>
  );
}

function StatTile({ label, value, accent }: { label: string; value: number; accent: string }) {
  return (
    <div className="group overflow-hidden rounded-2xl bg-card shadow-sm ring-1 ring-plum-900/5 transition-all duration-200 hover:-translate-y-1 hover:shadow-lg hover:shadow-violet-950/10 dark:ring-white/8">
      <div className={cn("h-1", accent)} />
      <div className="flex items-end justify-between p-4">
        <div><p className="font-heading text-2xl font-semibold text-plum-900 dark:text-foreground">{value}</p><p className="text-sm text-muted-foreground">{label}</p></div>
        <ChevronRight className="size-4 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5" />
      </div>
    </div>
  );
}
