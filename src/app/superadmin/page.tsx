import { Building2, CalendarCheck, TrendingUp, XCircle } from "lucide-react";
import {
  getBookingsTrend,
  getPlatformOverview,
  getSignupsTrend,
  listStudiosWithActivity,
} from "@/lib/data/platformMetrics";
import { KpiTile } from "@/components/superadmin/kpi-tile";
import { TrendChart } from "@/components/superadmin/trend-chart";
import { StudiosTable } from "@/components/superadmin/studios-table";

export const metadata = { title: "Painel Promatic — visão geral" };

function formatPercent(rate: number): string {
  return `${(rate * 100).toFixed(1)}%`;
}

export default async function SuperAdminPage() {
  const [overview, studios, bookingsTrend, signupsTrend] = await Promise.all([
    getPlatformOverview(),
    listStudiosWithActivity(),
    getBookingsTrend(30),
    getSignupsTrend(30),
  ]);

  const atRiskCount = studios.filter((s) => s.isAtRisk).length;

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="font-heading text-2xl font-semibold text-plum-900">Visão geral</h1>
        <p className="mt-1 text-muted-foreground">
          Métricas em tempo real de todos os estúdios na plataforma.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiTile
          label="Estúdios"
          value={String(overview.totalStudios)}
          sublabel={`+${overview.newStudios7d} nos últimos 7 dias`}
          icon={Building2}
          accent="bg-violet-600"
        />
        <KpiTile
          label="Agendamentos hoje"
          value={String(overview.bookingsToday)}
          sublabel={`${overview.bookingsThisMonth} no mês`}
          icon={CalendarCheck}
          accent="bg-magenta"
        />
        <KpiTile
          label="Total de agendamentos"
          value={overview.totalBookings.toLocaleString("pt-BR")}
          sublabel="desde o início"
          icon={TrendingUp}
          accent="bg-plum-900"
        />
        <KpiTile
          label="Cancelamento"
          value={formatPercent(overview.cancellationRate)}
          sublabel={`${atRiskCount} estúdio${atRiskCount === 1 ? "" : "s"} inativo${atRiskCount === 1 ? "" : "s"} 14d+`}
          icon={XCircle}
          accent="bg-wa"
        />
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <div className="rounded-2xl bg-card p-4 shadow-sm ring-1 ring-plum-900/5 sm:p-5">
          <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            Agendamentos por dia
          </p>
          <p className="mt-1 text-sm text-plum-900">Últimos 30 dias, todos os estúdios</p>
          <div className="mt-4">
            <TrendChart data={bookingsTrend} color="var(--violet-600)" />
          </div>
        </div>
        <div className="rounded-2xl bg-card p-4 shadow-sm ring-1 ring-plum-900/5 sm:p-5">
          <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            Novos estúdios por dia
          </p>
          <p className="mt-1 text-sm text-plum-900">Últimos 30 dias</p>
          <div className="mt-4">
            <TrendChart data={signupsTrend} color="var(--magenta)" />
          </div>
        </div>
      </div>

      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-heading text-lg font-semibold text-plum-900">Estúdios</h2>
          <p className="text-sm text-muted-foreground">{studios.length} no total</p>
        </div>
        <StudiosTable studios={studios} />
      </div>
    </div>
  );
}
