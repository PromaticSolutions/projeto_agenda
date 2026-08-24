import { AlertTriangle, CircleDollarSign, Receipt, TrendingDown } from "lucide-react";
import {
  getBillingOverview,
  getRevenueByMonth,
  isBillingSchemaReady,
  listInvoices,
} from "@/lib/data/billing";
import { KpiTile } from "@/components/superadmin/kpi-tile";
import { ChartCard } from "@/components/superadmin/chart-card";
import { CategoryBars } from "@/components/superadmin/category-bars";
import { RevenueBars } from "@/components/superadmin/revenue-bars";
import { InvoicesTable } from "@/components/superadmin/invoices-table";
import { InvoicesToolbar } from "@/components/superadmin/invoices-toolbar";
import { MigrationNotice } from "@/components/superadmin/migration-notice";
import {
  PAYMENT_METHOD_COLOR,
  PAYMENT_METHOD_LABELS,
  PAYMENT_METHOD_ORDER,
  SUBSCRIPTION_STATUS_LABELS,
  SUBSCRIPTION_STATUS_ORDER,
  formatMonthShort,
  formatPercent,
  lastMonths,
} from "@/lib/billing";
import {
  invoiceFilterToStatus,
  parseInvoiceFilter,
  parseMonthParam,
} from "@/lib/superadmin-filters";
import { formatPriceCents } from "@/lib/format";
import { utcToLocalDate } from "@/lib/availability";

export const metadata = { title: "Faturamento — Timely Admin" };

interface BillingPageProps {
  searchParams: Promise<{ situacao?: string; mes?: string; q?: string }>;
}

/**
 * Faturamento da plataforma.
 *
 * Dois números convivem aqui e a tela precisa manter a diferença explícita:
 * MRR é o contratado (recorrência), receita realizada é o que entrou (fatura
 * paga). Painel de SaaS que mistura os dois consegue mostrar crescimento num
 * mês em que ninguém pagou.
 */
export default async function SuperAdminBillingPage({ searchParams }: BillingPageProps) {
  const ready = await isBillingSchemaReady();
  if (!ready) {
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
        <header className="space-y-1 border-b border-border pb-5">
          <h1 className="text-xl font-semibold text-foreground">Faturamento</h1>
          <p className="text-sm text-muted-foreground">
            Assinaturas, faturas e pagamentos dos estúdios.
          </p>
        </header>
        <MigrationNotice migration="0011_billing.sql" feature="A cobrança da plataforma" />
      </div>
    );
  }

  const params = await searchParams;
  const filter = parseInvoiceFilter(params.situacao);
  const month = parseMonthParam(params.mes);
  const query = params.q?.trim() ?? "";
  const today = utcToLocalDate(new Date());

  const [overview, revenueByMonth, invoices] = await Promise.all([
    getBillingOverview(),
    getRevenueByMonth(12),
    listInvoices({ status: invoiceFilterToStatus(filter), month, query }),
  ]);

  const shownTotalCents = invoices.reduce((total, row) => total + row.invoice.total_cents, 0);

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <header className="space-y-1 border-b border-border pb-5">
        <h1 className="text-xl font-semibold text-foreground">Faturamento</h1>
        <p className="text-sm text-muted-foreground">
          O que os estúdios pagam pela Timely — assinaturas, faturas e pagamentos.
        </p>
      </header>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiTile
          label="MRR"
          value={formatPriceCents(overview.mrrCents)}
          sublabel={`${overview.payingSubscriptions} assinatura${overview.payingSubscriptions === 1 ? "" : "s"} pagante${overview.payingSubscriptions === 1 ? "" : "s"}`}
          hint={`Projeção anual: ${formatPriceCents(overview.projectedArrCents)}`}
          icon={CircleDollarSign}
          tone="primary"
        />
        <KpiTile
          label="Recebido em 12 meses"
          value={formatPriceCents(overview.revenueWindowCents)}
          sublabel={`${overview.paidInvoicesWindow} faturas pagas · ticket ${formatPriceCents(overview.averageTicketCents)}`}
          icon={Receipt}
        />
        <KpiTile
          label="Líquido de taxas"
          value={formatPriceCents(overview.netRevenueWindowCents)}
          sublabel={`${formatPriceCents(overview.feesWindowCents)} retidos pelo gateway`}
        />
        <KpiTile
          label="Em atraso"
          value={formatPriceCents(overview.overdueCents)}
          sublabel={`${overview.overdueInvoices} fatura${overview.overdueInvoices === 1 ? "" : "s"} · ${formatPriceCents(overview.openReceivableCents)} a receber em dia`}
          icon={AlertTriangle}
          tone={overview.overdueCents > 0 ? "warning" : "neutral"}
        />
        <KpiTile
          label="Recebido no mês"
          value={formatPriceCents(overview.revenueThisMonthCents)}
          sublabel={`mês anterior: ${formatPriceCents(overview.revenueLastMonthCents)}`}
        />
        <KpiTile
          label="MRR em risco"
          value={formatPriceCents(overview.mrrAtRiskCents)}
          sublabel="assinaturas marcadas como inadimplentes"
          tone={overview.mrrAtRiskCents > 0 ? "warning" : "neutral"}
        />
        <KpiTile
          label="Churn de receita (30d)"
          value={formatPercent(overview.churnRate30d)}
          sublabel={`${overview.canceled30d} cancelamento${overview.canceled30d === 1 ? "" : "s"} no período`}
          hint="Estimativa: não considera downgrade nem expansão."
          icon={TrendingDown}
        />
        <KpiTile
          label="Em teste"
          value={String(overview.trials)}
          sublabel={`${overview.trialsEndingSoon} vencem nos próximos 7 dias`}
        />
      </section>

      <div className="grid gap-3 lg:grid-cols-2">
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
        >
          <RevenueBars data={revenueByMonth} />
        </ChartCard>

        <ChartCard
          title="Método de pagamento"
          subtitle="Pagamentos aprovados nos últimos 12 meses"
          data={{
            columns: ["Método", "Valor", "Pagamentos"],
            rows: PAYMENT_METHOD_ORDER.map((method) => {
              const row = overview.methodSplit.find((m) => m.method === method);
              return [
                PAYMENT_METHOD_LABELS[method],
                formatPriceCents(row?.cents ?? 0),
                String(row?.count ?? 0),
              ];
            }),
          }}
          footer={
            <p className="text-xs text-muted-foreground">
              {overview.failedPaymentsWindow} tentativa
              {overview.failedPaymentsWindow === 1 ? "" : "s"} recusada ou expirada no período.
            </p>
          }
        >
          <CategoryBars
            bars={PAYMENT_METHOD_ORDER.map((method) => {
              const row = overview.methodSplit.find((m) => m.method === method);
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

        <ChartCard
          title="Inadimplência por faixa de atraso"
          subtitle="Faturas vencidas e não pagas"
          data={{
            columns: ["Faixa", "Valor", "Faturas"],
            rows: overview.aging.map((row) => [
              row.label,
              formatPriceCents(row.cents),
              String(row.count),
            ]),
          }}
        >
          <CategoryBars
            bars={overview.aging.map((row) => ({
              key: row.key,
              label: row.label,
              value: row.cents,
              formatted: formatPriceCents(row.cents),
              // Faixa de atraso é escala ORDENADA, não categoria: um tom só,
              // escurecendo com a gravidade, em vez de cores diferentes.
              color:
                row.key === "1-7"
                  ? "color-mix(in srgb, var(--destructive) 35%, transparent)"
                  : row.key === "8-30"
                    ? "color-mix(in srgb, var(--destructive) 55%, transparent)"
                    : row.key === "31-60"
                      ? "color-mix(in srgb, var(--destructive) 75%, transparent)"
                      : "var(--destructive)",
              meta: `${row.count} fatura${row.count === 1 ? "" : "s"}`,
            }))}
            emptyLabel="Nenhuma fatura em atraso."
          />
        </ChartCard>

        <ChartCard
          title="Assinaturas por situação"
          subtitle="Base inteira, incluindo canceladas"
          data={{
            columns: ["Situação", "Assinaturas"],
            rows: SUBSCRIPTION_STATUS_ORDER.map((status) => [
              SUBSCRIPTION_STATUS_LABELS[status],
              String(overview.subscriptionsByStatus[status]),
            ]),
          }}
        >
          <CategoryBars
            bars={SUBSCRIPTION_STATUS_ORDER.map((status) => ({
              key: status,
              label: SUBSCRIPTION_STATUS_LABELS[status],
              value: overview.subscriptionsByStatus[status],
              formatted: String(overview.subscriptionsByStatus[status]),
              color:
                status === "ativa"
                  ? "var(--wa)"
                  : status === "trial"
                    ? "var(--chart-1)"
                    : status === "inadimplente"
                      ? "var(--destructive)"
                      : status === "pausada"
                        ? "var(--chart-2)"
                        : "var(--muted-foreground)",
            }))}
            emptyLabel="Nenhuma assinatura registrada."
          />
        </ChartCard>
      </div>

      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-sm font-medium text-foreground">Faturas</h2>
          <p className="text-xs text-muted-foreground">
            {invoices.length} fatura{invoices.length === 1 ? "" : "s"} · {formatPriceCents(shownTotalCents)}{" "}
            no recorte
          </p>
        </div>

        <InvoicesToolbar
          filter={filter}
          month={month}
          query={query}
          months={[...lastMonths(12)].reverse()}
        />

        <InvoicesTable rows={invoices} today={today} />
      </section>
    </div>
  );
}
