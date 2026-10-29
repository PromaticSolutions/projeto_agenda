import Link from "next/link";
import { ArrowLeft, ChevronRight, Search } from "lucide-react";
import { getStudioBilling } from "@/lib/data/billing";
import { listStudioRows } from "@/lib/data/superadminRows";
import { getStudioAdmin } from "@/lib/data/platformMetrics";
import { getOwnerAccount } from "@/lib/data/platformAccounts";
import { KpiTile } from "@/components/charts/kpi-tile";
import { ChartCard } from "@/components/charts/chart-card";
import { ValueBars } from "@/components/charts/value-bars";
import { InvoicesTable } from "@/components/superadmin/invoices-table";
import { EnterAccountButton } from "@/components/superadmin/enter-account-button";
import { Input } from "@/components/ui/input";
import {
  PAYMENT_METHOD_LABELS,
  PLAN_INTERVAL_LABELS,
  SUBSCRIPTION_STATUS_DOT,
  SUBSCRIPTION_STATUS_LABELS,
  bucketByMonth,
  formatMonthShort,
  lastMonths,
} from "@/lib/billing";
import { filterAndSortStudios } from "@/lib/superadmin-filters";
import { formatFullDateLocal, formatPriceCents } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Base dos links desta visão: o seletor de cliente vive na URL. */
const CLIENTS_HREF = "/superadmin/billing?visao=clientes";

/**
 * Visão "Por cliente", passo 1: a lista para escolher de quem ver o dinheiro.
 *
 * Ordenada por quanto já pagou, que é a pergunta que traz alguém até aqui. A
 * busca é um formulário GET comum: a página segue Server Component e o
 * resultado fica favoritável, sem JavaScript.
 */
export async function ClientBillingList({ query }: { query: string }) {
  const { rows } = await listStudioRows();
  const visible = filterAndSortStudios(rows, { filter: "todos", sort: "receita", query });

  return (
    <section className="flex flex-col gap-3">
      <form action="/superadmin/billing" className="relative max-w-md">
        <input type="hidden" name="visao" value="clientes" />
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          name="q"
          defaultValue={query}
          placeholder="Buscar por estúdio, login ou dona"
          aria-label="Buscar cliente"
          className="pl-9"
        />
      </form>

      <p className="text-xs text-muted-foreground">
        {visible.length === rows.length
          ? `${rows.length} ${rows.length === 1 ? "cliente" : "clientes"}`
          : `${visible.length} de ${rows.length} clientes`}{" "}
        · escolha um para ver quanto já faturou
      </p>

      {visible.length === 0 ? (
        <p className="panel border-dashed p-8 text-center text-sm text-muted-foreground">
          Nenhum cliente encontrado.
        </p>
      ) : (
        <div className="panel overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[52rem] text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-muted-foreground">
                  <th className="px-4 py-2.5 font-medium">Cliente</th>
                  <th className="px-4 py-2.5 font-medium">Assinatura</th>
                  <th className="px-4 py-2.5 font-medium text-right">MRR</th>
                  <th className="px-4 py-2.5 font-medium text-right">Já pagou</th>
                  <th className="px-4 py-2.5 font-medium text-right">Em atraso</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {visible.map((studio) => {
                  const href = `${CLIENTS_HREF}&cliente=${studio.id}`;
                  return (
                    <tr key={studio.id} className="transition-colors hover:bg-muted/50 focus-within:bg-muted/50">
                      <td className="px-4 py-2.5">
                        <Link href={href} className="block outline-none">
                          <p className="font-medium text-foreground">{studio.name}</p>
                          <p className="text-xs text-muted-foreground">{studio.ownerEmail ?? `/${studio.slug}`}</p>
                        </Link>
                      </td>
                      <td className="px-4 py-2.5">
                        {studio.subscriptionStatus ? (
                          <span className="flex items-center gap-1.5 text-foreground">
                            <span
                              className={cn("size-2 rounded-full", SUBSCRIPTION_STATUS_DOT[studio.subscriptionStatus])}
                              aria-hidden
                            />
                            {SUBSCRIPTION_STATUS_LABELS[studio.subscriptionStatus]}
                            {studio.planName && (
                              <span className="text-xs text-muted-foreground">· {studio.planName}</span>
                            )}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">sem assinatura</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-foreground">
                        {studio.monthlyCents > 0 ? formatPriceCents(studio.monthlyCents) : "—"}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums font-medium text-foreground">
                        {formatPriceCents(studio.lifetimeCents)}
                      </td>
                      <td
                        className={cn(
                          "px-4 py-2.5 text-right tabular-nums",
                          studio.overdueCents > 0 ? "font-medium text-destructive" : "text-muted-foreground"
                        )}
                      >
                        {studio.overdueCents > 0 ? formatPriceCents(studio.overdueCents) : "—"}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <Link
                          href={href}
                          title="Ver faturamento"
                          className="inline-flex rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                        >
                          <ChevronRight className="size-4" />
                          <span className="sr-only">Faturamento de {studio.name}</span>
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}

/**
 * Visão "Por cliente", passo 2: o dinheiro de UM estúdio.
 *
 * Mesmos números do bloco de cobrança da ficha, com o gráfico mês a mês que a
 * ficha não tem — aqui a pergunta é só financeira, e a ficha continua sendo o
 * lugar do uso do produto.
 */
export async function ClientBillingDetail({ studioId, today }: { studioId: string; today: string }) {
  const studio = await getStudioAdmin(studioId);
  if (!studio) {
    return (
      <section className="flex flex-col gap-3">
        <BackToList />
        <p className="panel border-dashed p-8 text-center text-sm text-muted-foreground">
          Cliente não encontrado.
        </p>
      </section>
    );
  }

  const [billing, account] = await Promise.all([
    getStudioBilling(studioId),
    getOwnerAccount(studio.owner_id),
  ]);
  const subscription = billing.current;
  const status = subscription?.subscription.status;

  const months = lastMonths(12);
  const revenueByMonth = bucketByMonth(
    billing.invoices
      .filter((row) => row.invoice.status === "paga" && row.invoice.paid_at)
      .map((row) => ({ at: row.invoice.paid_at!, cents: row.invoice.total_cents })),
    months
  );
  const revenueWindowCents = revenueByMonth.reduce((total, point) => total + point.cents, 0);

  return (
    <section className="flex flex-col gap-5">
      <BackToList />

      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-4">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold text-foreground">{studio.name}</h2>
          <p className="text-sm text-muted-foreground">
            {account?.email ?? "sem login"} · cliente desde{" "}
            {formatFullDateLocal(new Date(studio.created_at))}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href={`/superadmin/studios/${studio.id}`}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            Abrir ficha completa
          </Link>
          <EnterAccountButton studioId={studio.id} studioName={studio.name} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiTile
          label="Já pagou"
          value={formatPriceCents(billing.lifetimeCents)}
          sublabel={`${billing.paidInvoices} fatura${billing.paidInvoices === 1 ? "" : "s"} paga${billing.paidInvoices === 1 ? "" : "s"}`}
          tone="primary"
        />
        <KpiTile
          label="Líquido de taxas"
          value={formatPriceCents(billing.netLifetimeCents)}
          sublabel={`${formatPriceCents(Math.max(0, billing.lifetimeCents - billing.netLifetimeCents))} retidos pelo gateway`}
        />
        <KpiTile
          label="Recebido em 12 meses"
          value={formatPriceCents(revenueWindowCents)}
          sublabel={`mês atual: ${formatPriceCents(revenueByMonth.at(-1)?.cents ?? 0)}`}
        />
        <KpiTile
          label="Em atraso"
          value={formatPriceCents(billing.overdueCents)}
          sublabel={`${billing.overdueInvoices} fatura${billing.overdueInvoices === 1 ? "" : "s"} · ${formatPriceCents(billing.openCents)} a receber em dia`}
          tone={billing.overdueCents > 0 ? "warning" : "neutral"}
        />
        <KpiTile
          label="Plano"
          value={subscription?.plan?.name ?? "sem assinatura"}
          sublabel={
            subscription
              ? `${formatPriceCents(subscription.subscription.amount_cents)}${PLAN_INTERVAL_LABELS[subscription.interval]}`
              : "nunca contratou"
          }
        />
        <KpiTile
          label="Situação"
          value={status ? SUBSCRIPTION_STATUS_LABELS[status] : "—"}
          sublabel={
            status === "trial" && subscription?.subscription.trial_ends_at
              ? `teste até ${formatFullDateLocal(new Date(subscription.subscription.trial_ends_at))}`
              : subscription
                ? `ciclo até ${formatFullDateLocal(new Date(subscription.subscription.current_period_end))}`
                : undefined
          }
        />
        <KpiTile
          label="Último pagamento"
          value={billing.lastPaymentAt ? formatFullDateLocal(new Date(billing.lastPaymentAt)) : "nenhum"}
          sublabel={billing.lastPaymentMethod ? PAYMENT_METHOD_LABELS[billing.lastPaymentMethod] : undefined}
        />
        <KpiTile
          label="Pontualidade"
          value={
            billing.averageDaysToPay === null
              ? "—"
              : billing.averageDaysToPay <= 0
                ? "em dia"
                : `${billing.averageDaysToPay} dia(s) de atraso`
          }
          sublabel={
            billing.averageDaysToPay === null
              ? "sem histórico de pagamento"
              : "média entre vencimento e pagamento"
          }
        />
      </div>

      <ChartCard
        title="Pagamentos por mês"
        subtitle="Faturas pagas por este cliente, últimos 12 meses"
        data={{
          columns: ["Mês", "Recebido", "Faturas"],
          rows: revenueByMonth.map((point) => [
            formatMonthShort(point.month),
            formatPriceCents(point.cents),
            String(point.count),
          ]),
        }}
      >
        <ValueBars
          data={revenueByMonth.map((point) => ({
            key: point.month,
            label: formatMonthShort(point.month),
            cents: point.cents,
            count: point.count,
          }))}
          countNoun={["fatura", "faturas"]}
          highlightKey={revenueByMonth.at(-1)?.month}
        />
      </ChartCard>

      <InvoicesTable
        rows={billing.invoices}
        showStudio={false}
        today={today}
        emptyLabel="Nenhuma fatura emitida para este cliente ainda."
      />
    </section>
  );
}

function BackToList() {
  return (
    <Link
      href={CLIENTS_HREF}
      className="flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
    >
      <ArrowLeft className="size-4" /> Todos os clientes
    </Link>
  );
}
