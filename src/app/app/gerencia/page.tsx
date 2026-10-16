import Link from "next/link";
import { UserCog } from "lucide-react";
import {
  getSalon,
  getSalonAttendantStats,
  listSalonAttendants,
  listSalonBookings,
  requireManager,
} from "@/lib/data/salons";
import { listServiceCatalog } from "@/lib/data/services";
import { attendantStatus } from "@/lib/access";
import { formatPhoneDisplay } from "@/lib/format";
import { localDayRangeUtc, utcToLocalDate } from "@/lib/availability";
import {
  inRange,
  parsePeriodDays,
  periodBefore,
  periodEndingAt,
  rankBookings,
  revenueByLocalDay,
  revenueByWeekday,
  summarizePeriod,
} from "@/lib/metrics";
import { DashboardOverview } from "@/components/app/dashboard-overview";

export const metadata = { title: "Visão geral do salão — Timely" };

/**
 * Os mesmos indicadores da atendente, somados sobre TODAS as atendentes.
 *
 * A agregação é literalmente a mesma (src/lib/metrics.ts) — o que muda é só a
 * origem das linhas. Por isso a gerente ganha um ranking a mais, por
 * atendente: é a única pergunta que existe no salão e não existe no estúdio.
 */
async function loadSalonOverview(studioIds: string[], today: string, periodDays: number) {
  const range = periodEndingAt(today, periodDays);
  const previousRange = periodBefore(range, periodDays);

  const [rows, catalog] = await Promise.all([
    listSalonBookings(
      studioIds,
      localDayRangeUtc(previousRange.from).start.toISOString(),
      localDayRangeUtc(range.to).end.toISOString()
    ),
    listServiceCatalog(studioIds),
  ]);

  const prices = new Map([...catalog].map(([id, service]) => [id, service.priceCents]));
  const now = new Date();
  const current = inRange(rows, range);

  return {
    range,
    rows: current,
    totals: summarizePeriod(current, prices, now),
    previous: summarizePeriod(inRange(rows, previousRange), prices, now),
    daily: revenueByLocalDay(current, prices, range, now),
    weekday: revenueByWeekday(current, prices, now),
    prices,
    catalog,
    now,
  };
}

interface GerenciaPageProps {
  searchParams: Promise<{ periodo?: string }>;
}

export default async function GerenciaPage({ searchParams }: GerenciaPageProps) {
  const manager = await requireManager();
  const [{ periodo }, salon, attendants] = await Promise.all([
    searchParams,
    getSalon(manager.salonId),
    listSalonAttendants(manager.salonId),
  ]);

  const periodDays = parsePeriodDays(periodo);
  const studioIds = attendants.map((a) => a.id);

  const [stats, overview] = await Promise.all([
    getSalonAttendantStats(studioIds),
    loadSalonOverview(studioIds, utcToLocalDate(new Date()), periodDays),
  ]);

  const nameByStudio = new Map(attendants.map((a) => [a.id, a.name]));
  const byAttendant = rankBookings(overview.rows, overview.prices, overview.now, (booking) => {
    const name = nameByStudio.get(booking.studio_id);
    return name ? { key: booking.studio_id, label: name } : null;
  });
  const byService = rankBookings(overview.rows, overview.prices, overview.now, (booking) => {
    const service = overview.catalog.get(booking.service_id);
    return service ? { key: booking.service_id, label: service.name } : null;
  });

  const active = attendants.filter((a) => attendantStatus(a) === "ativa");

  const totals = attendants.reduce(
    (acc, a) => {
      const s = stats.get(a.id);
      return {
        clients: acc.clients + (s?.clients ?? 0),
        upcoming: acc.upcoming + (s?.upcomingBookings ?? 0),
        unread: acc.unread + (s?.unreadMessages ?? 0),
      };
    },
    { clients: 0, upcoming: 0, unread: 0 }
  );

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-5">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold text-foreground">{salon?.name ?? "Salão"}</h1>
          <p className="text-sm text-muted-foreground">
            {active.length} de {attendants.length}{" "}
            {attendants.length === 1 ? "atendente ativa" : "atendentes ativas"}.
          </p>
        </div>
        <Link
          href="/app/gerencia/atendentes"
          className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition-colors hover:opacity-90"
        >
          <UserCog className="size-4" aria-hidden />
          Gerenciar atendentes
        </Link>
      </header>

      <DashboardOverview
        periodDays={periodDays}
        range={overview.range}
        totals={overview.totals}
        previous={overview.previous}
        daily={overview.daily}
        weekday={overview.weekday}
        rankings={[
          {
            title: "Atendentes que mais renderam",
            rows: byAttendant,
            emptyLabel: "Nenhum atendimento concluído no período.",
          },
          {
            title: "Serviços que mais renderam",
            rows: byService,
            emptyLabel: "Nenhum atendimento concluído no período.",
          },
        ]}
        hrefForPeriod={(days) => `/app/gerencia?periodo=${days}`}
      />

      {/* Fica depois dos indicadores, e não junto deles: são números de
          ESTADO (quantas clientes existem, o que está na caixa agora), não de
          período — misturá-los na mesma faixa faria parecer que também
          respondem ao seletor de 7/30/90 dias. */}
      <div className="grid gap-4 sm:grid-cols-3">
        <SummaryCard label="Clientes no salão" value={totals.clients} />
        <SummaryCard label="Agendamentos à frente" value={totals.upcoming} />
        <SummaryCard label="Mensagens não lidas" value={totals.unread} />
      </div>

      {attendants.length === 0 ? (
        <div className="panel flex flex-col items-center gap-1 border-dashed p-10 text-center">
          <p className="font-medium text-foreground">Nenhuma atendente ainda</p>
          <p className="text-sm text-muted-foreground">
            Cadastre a primeira em{" "}
            <Link href="/app/gerencia/atendentes" className="underline">
              Atendentes
            </Link>
            .
          </p>
        </div>
      ) : (
        <div className="panel overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-left">
                  <th className="section-label px-4 py-2.5 text-muted-foreground">Atendente</th>
                  <th className="section-label px-4 py-2.5 text-muted-foreground">WhatsApp</th>
                  <th className="section-label px-4 py-2.5 text-right text-muted-foreground">
                    Clientes
                  </th>
                  <th className="section-label px-4 py-2.5 text-right text-muted-foreground">
                    À frente
                  </th>
                  <th className="section-label px-4 py-2.5 text-right text-muted-foreground">
                    Não lidas
                  </th>
                </tr>
              </thead>
              <tbody>
                {attendants.map((attendant) => {
                  const s = stats.get(attendant.id);
                  const inactive = attendantStatus(attendant) === "inativa";
                  return (
                    <tr key={attendant.id} className="border-b border-border last:border-0">
                      <td className="px-4 py-3">
                        <span className="font-medium text-foreground">{attendant.name}</span>
                        {inactive ? (
                          <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                            inativa
                          </span>
                        ) : null}
                        <span className="block text-xs text-muted-foreground">
                          /{attendant.slug}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {formatPhoneDisplay(attendant.whatsapp)}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">{s?.clients ?? 0}</td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {s?.upcomingBookings ?? 0}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {s?.unreadMessages ?? 0}
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

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="panel p-4">
      <p className="section-label text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">{value}</p>
    </div>
  );
}
