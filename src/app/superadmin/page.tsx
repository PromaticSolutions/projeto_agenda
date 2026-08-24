import Link from "next/link";
import {
  AlertTriangle,
  Building2,
  CalendarCheck,
  CircleDollarSign,
  MessageCircle,
  Scissors,
  Users,
  XCircle,
} from "lucide-react";
import {
  getBookingsTrend,
  getPlatformOverview,
  getSignupsTrend,
} from "@/lib/data/platformMetrics";
import { getBillingOverview, getRevenueByMonth } from "@/lib/data/billing";
import { listStudioRows } from "@/lib/data/superadminRows";
import { KpiTile } from "@/components/superadmin/kpi-tile";
import { ChartCard } from "@/components/superadmin/chart-card";
import { CategoryBars } from "@/components/superadmin/category-bars";
import { RevenueBars } from "@/components/superadmin/revenue-bars";
import { TrendChart } from "@/components/superadmin/trend-chart";
import { MigrationNotice } from "@/components/superadmin/migration-notice";
import {
  PAYMENT_METHOD_COLOR,
  PAYMENT_METHOD_LABELS,
  PAYMENT_METHOD_ORDER,
  formatMonthShort,
  formatPercent,
} from "@/lib/billing";
import { formatDateLocal, formatPriceCents } from "@/lib/format";

export const metadata = { title: "Visão geral — Timely Admin" };

export default async function SuperAdminPage() {
  const [overview, { rows: studios, billingReady }, bookingsTrend, signupsTrend] = await Promise.all([
    getPlatformOverview(),
    listStudioRows(),
    getBookingsTrend(30),
    getSignupsTrend(30),
  ]);

  // Cobrança é opcional na composição da tela: se a 0011 não rodou, o painel
  // de uso continua inteiro e só o bloco de dinheiro vira um aviso.
  const [billing, revenueByMonth] = billingReady
    ? await Promise.all([getBillingOverview(), getRevenueByMonth(12)])
    : [null, null];

  const activeStudios30d = studios.filter((s) => s.bookingsLast30d > 0).length;
  const atRisk = studios.filter((s) => s.isAtRisk);
  const overdueStudios = studios.filter((s) => s.overdueCents > 0);

  const revenueDelta =
    billing && billing.revenueLastMonthCents > 0
      ? (billing.revenueThisMonthCents - billing.revenueLastMonthCents) / billing.revenueLastMonthCents
      : undefined;

  const attentionItems = [
    billing && billing.overdueInvoices > 0
      ? {
          key: "atraso",
          label: `${billing.overdueInvoices} fatura${billing.overdueInvoices === 1 ? "" : "s"} em atraso`,
          detail: `${formatPriceCents(billing.overdueCents)} a recuperar em ${overdueStudios.length} cliente${overdueStudios.length === 1 ? "" : "s"}`,
          href: "/superadmin/billing?situacao=em_atraso",
        }
      : null,
    billing && billing.trialsEndingSoon > 0
      ? {
          key: "trial",
          label: `${billing.trialsEndingSoon} teste${billing.trialsEndingSoon === 1 ? "" : "s"} vencendo em 7 dias`,
          detail: "decidem entre virar cliente e sumir nesta semana",
          href: "/superadmin/studios?filtro=trial",
        }
      : null,
    atRisk.length > 0
      ? {
          key: "risco",
          label: `${atRisk.length} cliente${atRisk.length === 1 ? "" : "s"} sem agenda há 14 dias`,
          detail: atRisk
            .slice(0, 3)
            .map((s) => s.name)
            .join(", "),
          href: "/superadmin/studios?filtro=em_risco",
        }
      : null,
    overview.messagesFailed30d > 0
      ? {
          key: "mensagens",
          label: `${overview.messagesFailed30d} mensagem${overview.messagesFailed30d === 1 ? "" : "ns"} falhou nos últimos 30 dias`,
          detail: "lembrete que não chegou à cliente do estúdio",
          href: null,
        }
      : null,
    overview.whatsappWithError > 0
      ? {
          key: "whatsapp",
          label: `${overview.whatsappWithError} conexão de WhatsApp com erro`,
          detail: "o estúdio provavelmente não sabe",
          href: null,
        }
      : null,
  ].filter((item): item is NonNullable<typeof item> => item !== null);

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <header className="space-y-1 border-b border-border pb-5">
        <h1 className="text-xl font-semibold text-foreground">Visão geral</h1>
        <p className="text-sm text-muted-foreground">
          Receita da plataforma e operação de todos os {overview.totalStudios} estúdios.
        </p>
      </header>

      {!billingReady && (
        <MigrationNotice migration="0011_billing.sql" feature="A cobrança da plataforma" />
      )}

      {/* Dinheiro primeiro: é a pergunta que este painel existe para responder. */}
      <section className="grid gap-3 lg:grid-cols-4">
        <div className="panel flex flex-col gap-1 p-5 ring-1 ring-primary/25 lg:col-span-2">
          <p className="section-label">Receita recorrente mensal</p>
          <p className="text-4xl font-semibold text-foreground">
            {billing ? formatPriceCents(billing.mrrCents) : "—"}
          </p>
          {billing ? (
            <>
              <p className="text-sm text-muted-foreground">
                {billing.payingSubscriptions} assinatura
                {billing.payingSubscriptions === 1 ? "" : "s"} pagante
                {billing.payingSubscriptions === 1 ? "" : "s"} · ticket médio de{" "}
                {formatPriceCents(billing.arpuCents)} por cliente
              </p>
              <p className="text-xs text-muted-foreground/80 italic">
                Projeção anual de {formatPriceCents(billing.projectedArrCents)} (MRR × 12) — não é
                receita fechada. Assinaturas em teste ficam fora da conta.
              </p>
              {billing.mrrAtRiskCents > 0 && (
                <p className="mt-1 flex items-center gap-1.5 text-sm font-medium text-destructive">
                  <AlertTriangle className="size-4" />
                  {formatPriceCents(billing.mrrAtRiskCents)} em assinatura inadimplente
                </p>
              )}
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Disponível depois da migração 0011.</p>
          )}
        </div>

        <KpiTile
          label="Recebido no mês"
          value={billing ? formatPriceCents(billing.revenueThisMonthCents) : "—"}
          sublabel={
            billing
              ? `mês anterior: ${formatPriceCents(billing.revenueLastMonthCents)}`
              : undefined
          }
          delta={revenueDelta !== undefined ? { rate: revenueDelta, against: "vs. mês anterior" } : undefined}
          icon={CircleDollarSign}
        />

        <KpiTile
          label="Em atraso"
          value={billing ? formatPriceCents(billing.overdueCents) : "—"}
          sublabel={
            billing
              ? `${billing.overdueInvoices} fatura${billing.overdueInvoices === 1 ? "" : "s"} · a receber em dia: ${formatPriceCents(billing.openReceivableCents)}`
              : undefined
          }
          icon={AlertTriangle}
          tone={billing && billing.overdueCents > 0 ? "warning" : "neutral"}
        />
      </section>

      {/* Uso: o que sustenta a receita. */}
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiTile
          label="Estúdios"
          value={String(overview.totalStudios)}
          sublabel={`+${overview.newStudios7d} em 7 dias · +${overview.newStudios30d} em 30`}
          icon={Building2}
        />
        <KpiTile
          label="Ativos em 30 dias"
          value={String(activeStudios30d)}
          sublabel={
            overview.totalStudios > 0
              ? `${formatPercent(activeStudios30d / overview.totalStudios, 0)} da base · ${atRisk.length} sem agenda 14d+`
              : undefined
          }
          icon={CalendarCheck}
          tone={atRisk.length > 0 ? "warning" : "neutral"}
        />
        <KpiTile
          label="Agendamentos hoje"
          value={String(overview.bookingsToday)}
          sublabel={`${overview.bookings7d} em 7 dias · ${overview.bookingsThisMonth} no mês`}
          icon={CalendarCheck}
        />
        <KpiTile
          label="Cancelamento"
          value={formatPercent(overview.cancellationRate)}
          sublabel={`${overview.bookingsByStatus.cancelado.toLocaleString("pt-BR")} de ${overview.totalBookings.toLocaleString("pt-BR")} agendamentos`}
          icon={XCircle}
        />
        <KpiTile
          label="Clientes finais"
          value={overview.totalClients.toLocaleString("pt-BR")}
          sublabel={`+${overview.newClients30d} em 30 dias`}
          icon={Users}
        />
        <KpiTile
          label="Serviços ativos"
          value={overview.activeServices.toLocaleString("pt-BR")}
          sublabel="catálogo somado dos estúdios"
          icon={Scissors}
        />
        <KpiTile
          label="Volume atendido"
          value={formatPriceCents(overview.attendedVolume30dCents)}
          sublabel={`${overview.attendedBookings30d} atendimentos finalizados em 30 dias`}
          hint="Dinheiro dos estúdios, não da plataforma."
          icon={CircleDollarSign}
        />
        <KpiTile
          label="WhatsApp"
          value={`${overview.whatsappConnected} conectado${overview.whatsappConnected === 1 ? "" : "s"}`}
          sublabel={`${overview.messagesSent30d} enviadas em 30d · ${overview.messagesPending} na fila`}
          icon={MessageCircle}
          tone={overview.whatsappWithError > 0 ? "warning" : "neutral"}
        />
      </section>

      {attentionItems.length > 0 && (
        <section className="panel p-4">
          <p className="section-label mb-3">Precisa de atenção</p>
          <ul className="flex flex-col divide-y divide-border">
            {attentionItems.map((item) => (
              <li key={item.key} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">{item.label}</p>
                  <p className="truncate text-xs text-muted-foreground">{item.detail}</p>
                </div>
                {item.href && (
                  <Link
                    href={item.href}
                    className="shrink-0 text-xs font-medium text-primary hover:underline"
                  >
                    Ver
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="grid gap-3 lg:grid-cols-2">
        {billing && revenueByMonth && (
          <ChartCard
            title="Receita realizada"
            subtitle="Faturas pagas por mês, últimos 12 meses"
            data={{
              columns: ["Mês", "Recebido", "Faturas"],
              rows: revenueByMonth.map((point) => [
                formatMonthShort(point.month),
                formatPriceCents(point.cents),
                String(point.count),
              ]),
            }}
            footer={
              <p className="text-xs text-muted-foreground">
                Líquido de taxas nos 12 meses: {formatPriceCents(billing.netRevenueWindowCents)} (
                {formatPriceCents(billing.feesWindowCents)} retidos pelo gateway).
              </p>
            }
          >
            <RevenueBars data={revenueByMonth} />
          </ChartCard>
        )}

        {billing && (
          <ChartCard
            title="Como os clientes pagam"
            subtitle="Pagamentos aprovados nos últimos 12 meses"
            data={{
              columns: ["Método", "Valor", "Pagamentos"],
              rows: PAYMENT_METHOD_ORDER.map((method) => {
                const row = billing.methodSplit.find((m) => m.method === method);
                return [
                  PAYMENT_METHOD_LABELS[method],
                  formatPriceCents(row?.cents ?? 0),
                  String(row?.count ?? 0),
                ];
              }),
            }}
            footer={
              billing.failedPaymentsWindow > 0 ? (
                <p className="text-xs text-muted-foreground">
                  {billing.failedPaymentsWindow} tentativa
                  {billing.failedPaymentsWindow === 1 ? "" : "s"} recusada ou expirada no período.
                </p>
              ) : undefined
            }
          >
            <CategoryBars
              bars={PAYMENT_METHOD_ORDER.map((method) => {
                const row = billing.methodSplit.find((m) => m.method === method);
                return {
                  key: method,
                  label: PAYMENT_METHOD_LABELS[method],
                  value: row?.cents ?? 0,
                  formatted: formatPriceCents(row?.cents ?? 0),
                  color: PAYMENT_METHOD_COLOR[method],
                  meta: row ? `${row.count} pagamento${row.count === 1 ? "" : "s"}` : undefined,
                };
              })}
              emptyLabel="Nenhum pagamento aprovado ainda — o gateway não está integrado."
            />
          </ChartCard>
        )}

        <ChartCard
          title="Agendamentos por dia"
          subtitle="Últimos 30 dias, todos os estúdios"
          data={{
            columns: ["Dia", "Agendamentos"],
            rows: bookingsTrend.map((point) => [point.date, String(point.count)]),
          }}
        >
          <TrendChart data={bookingsTrend} color="var(--chart-1)" />
        </ChartCard>

        <ChartCard
          title="Novos estúdios por dia"
          subtitle="Últimos 30 dias"
          data={{
            columns: ["Dia", "Estúdios"],
            rows: signupsTrend.map((point) => [point.date, String(point.count)]),
          }}
        >
          <TrendChart data={signupsTrend} color="var(--chart-2)" />
        </ChartCard>
      </div>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-medium text-foreground">Clientes mais ativos</h2>
          <Link href="/superadmin/studios" className="text-xs font-medium text-primary hover:underline">
            Ver todos os clientes
          </Link>
        </div>
        <ul className="panel divide-y divide-border">
          {studios.slice(0, 5).map((studio) => (
            <li key={studio.id}>
              <Link
                href={`/superadmin/studios/${studio.id}`}
                className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-muted/50"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium text-foreground">{studio.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {studio.bookingsLast30d} agendamentos em 30 dias · {studio.clientsCount} clientes
                    {studio.lastBookingAt
                      ? ` · última agenda ${formatDateLocal(new Date(studio.lastBookingAt))}`
                      : " · nunca agendou"}
                  </p>
                </div>
                <span className="shrink-0 text-sm tabular-nums text-muted-foreground">
                  {studio.monthlyCents > 0 ? `${formatPriceCents(studio.monthlyCents)}/mês` : "em teste"}
                </span>
              </Link>
            </li>
          ))}
          {studios.length === 0 && (
            <li className="px-4 py-6 text-center text-sm text-muted-foreground">
              Nenhum estúdio cadastrado ainda.
            </li>
          )}
        </ul>
      </section>
    </div>
  );
}
