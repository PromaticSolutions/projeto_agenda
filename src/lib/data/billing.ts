import "server-only";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/service";
import { fetchAllPages } from "@/lib/supabase/paginate";
import { isMissingTableError } from "@/lib/supabase/errors";
import { utcToLocalDate } from "@/lib/availability";
import {
  AGING_BUCKETS,
  agingBucket,
  bucketByMonth,
  churnRate,
  effectiveInvoiceStatus,
  isInvoiceOverdue,
  lastMonths,
  monthlyAmountCents,
  netPaymentCents,
  projectedAnnualCents,
  sumMonthlyRecurringCents,
  type AgingBucketKey,
  type MonthlyPoint,
} from "@/lib/billing";
import type {
  Invoice,
  InvoiceStatus,
  Payment,
  PaymentMethod,
  Plan,
  PlanInterval,
  Subscription,
  SubscriptionStatus,
} from "@/lib/types";

/**
 * Leituras de cobrança para o /superadmin (0011_billing.sql).
 *
 * Sempre com a service_role key: faturamento é dado da PLATAFORMA, atravessa
 * todos os estúdios e nenhuma policy de RLS deve autorizá-lo — a autorização
 * acontece antes, no layout de /superadmin (`checkPlatformAdmin`).
 *
 * Estratégia de query igual à de `platformMetrics.ts`: puxa as linhas da
 * janela e agrega em memória, em vez de uma view/RPC no Postgres. Assinatura é
 * uma linha por estúdio e fatura é uma por mês por estúdio — ou seja, o volume
 * aqui é ordens de magnitude menor que o de `bookings`. Se a base crescer para
 * milhares de estúdios, o caminho é uma view materializada, não paginação
 * dessas funções.
 */

const DAY_MS = 86_400_000;
const REVENUE_WINDOW_MONTHS = 12;

/** Assinatura + o plano dela, que é o que toda tela precisa junto. */
export interface SubscriptionWithPlan {
  subscription: Subscription;
  plan: Plan | null;
  /** Normalizado para o mês (anual dividido por 12) — nunca recalcular na view. */
  monthlyCents: number;
  interval: PlanInterval;
}

/**
 * O schema de cobrança já existe no banco?
 *
 * Serve para a tela mostrar "rode a migração 0011" em vez de cair num error
 * boundary genérico — e para o resto do superadmin continuar de pé.
 *
 * ATENÇÃO ao formato da query: é `select("id").limit(1)`, e NÃO uma contagem
 * com `head: true`. Medido contra o projeto real: numa tabela que não existe,
 * `select("*", { count: "exact", head: true })` responde **204 com `error`
 * nulo e `count` nulo** — o PostgREST não manda corpo em resposta a HEAD, e o
 * cliente não tem como transformar isso em erro. Ou seja, a checagem por
 * contagem dizia "a tabela existe" para uma tabela ausente, e todo o painel
 * de faturamento estourava logo depois. Com um GET de uma linha, o mesmo caso
 * devolve 404 e o código PGRST205, que é o que dá para checar.
 */
export async function isBillingSchemaReady(): Promise<boolean> {
  const supabase = createServiceRoleSupabaseClient();
  const { error } = await supabase.from("plans").select("id").limit(1);
  if (!error) return true;
  if (isMissingTableError(error)) return false;
  throw error;
}

export async function listPlans(): Promise<Plan[]> {
  const supabase = createServiceRoleSupabaseClient();
  const { data, error } = await supabase.from("plans").select("*").order("sort_order");
  if (error) throw error;
  return data ?? [];
}

/**
 * Assinatura VIGENTE de cada estúdio, indexada por studio_id.
 *
 * "Vigente" = qualquer status que não seja `cancelada`; o índice parcial da
 * 0011 garante no máximo uma por estúdio, então o Map não perde linha. As
 * canceladas ficam fora de propósito: elas servem para churn (função
 * própria), não para dizer em que plano o cliente está hoje.
 */
export async function mapCurrentSubscriptions(): Promise<Map<string, SubscriptionWithPlan>> {
  const supabase = createServiceRoleSupabaseClient();
  const [subs, plans] = await Promise.all([
    // Paginado: é uma assinatura por estúdio, e o corte de mil linhas do
    // PostgREST apagaria clientes do painel sem devolver erro nenhum.
    fetchAllPages<Subscription>((from, to) =>
      supabase
        .from("subscriptions")
        .select("*")
        .neq("status", "cancelada")
        .order("id")
        .range(from, to)
    ),
    listPlans(),
  ]);

  const planById = new Map(plans.map((p) => [p.id, p]));
  const result = new Map<string, SubscriptionWithPlan>();
  for (const subscription of subs) {
    const plan = planById.get(subscription.plan_id) ?? null;
    const interval = plan?.billing_interval ?? "mensal";
    result.set(subscription.studio_id, {
      subscription,
      plan,
      interval,
      monthlyCents: monthlyAmountCents(subscription.amount_cents, interval),
    });
  }
  return result;
}

export interface AgingRow {
  key: AgingBucketKey;
  label: string;
  cents: number;
  count: number;
}

export interface MethodSplitRow {
  method: PaymentMethod;
  cents: number;
  count: number;
}

export interface BillingOverview {
  /** Receita recorrente mensal: ativas + inadimplentes, anual já dividido. */
  mrrCents: number;
  /** Pedaço do MRR preso em assinatura inadimplente. */
  mrrAtRiskCents: number;
  /** MRR × 12. É projeção, e a tela precisa dizer isso. */
  projectedArrCents: number;
  arpuCents: number;

  subscriptionsByStatus: Record<SubscriptionStatus, number>;
  payingSubscriptions: number;
  trials: number;
  /** Trials que vencem nos próximos 7 dias — a fila de trabalho comercial. */
  trialsEndingSoon: number;
  canceled30d: number;
  churnRate30d: number;

  /** Caixa de verdade: faturas PAGAS no período. */
  revenueThisMonthCents: number;
  revenueLastMonthCents: number;
  revenueWindowCents: number;
  feesWindowCents: number;
  netRevenueWindowCents: number;
  paidInvoicesWindow: number;
  averageTicketCents: number;

  /** A receber em dia (fatura aberta, dentro do prazo). */
  openReceivableCents: number;
  overdueCents: number;
  overdueInvoices: number;
  aging: AgingRow[];

  methodSplit: MethodSplitRow[];
  /** Pagamentos recusados/expirados na janela — o atrito de cobrança. */
  failedPaymentsWindow: number;
}

export async function getBillingOverview(): Promise<BillingOverview> {
  const supabase = createServiceRoleSupabaseClient();
  const now = new Date();
  const today = utcToLocalDate(now);
  const months = lastMonths(REVENUE_WINDOW_MONTHS, now);
  const windowStart = `${months[0]}-01T00:00:00.000Z`;
  const since30d = new Date(now.getTime() - 30 * DAY_MS).toISOString();
  const in7d = new Date(now.getTime() + 7 * DAY_MS).toISOString();
  const thisMonth = months[months.length - 1];
  const lastMonth = months[months.length - 2] ?? thisMonth;

  /* Tudo paginado: são as três leituras que sustentam MRR, inadimplência e
     receita realizada. Faturas e pagamentos crescem um por mês por cliente, e
     o corte de mil linhas do PostgREST não daria erro — daria dinheiro a
     menos no painel, que é o pior lugar para um número silenciosamente
     errado. */
  const [allSubs, plans, invoices, payments] = await Promise.all([
    fetchAllPages<Subscription>((from, to) =>
      supabase.from("subscriptions").select("*").order("id").range(from, to)
    ),
    listPlans(),
    // Faturas em aberto de qualquer época + as pagas na janela do gráfico.
    fetchAllPages<Invoice>((from, to) =>
      supabase
        .from("invoices")
        .select("*")
        .or(`status.neq.paga,paid_at.gte.${windowStart}`)
        .order("id")
        .range(from, to)
    ),
    fetchAllPages<Payment>((from, to) =>
      supabase
        .from("payments")
        .select("*")
        .gte("created_at", windowStart)
        .order("id")
        .range(from, to)
    ),
  ]);

  const planById = new Map(plans.map((p) => [p.id, p]));
  const intervalOf = (sub: Subscription): PlanInterval =>
    planById.get(sub.plan_id)?.billing_interval ?? "mensal";

  // --- Assinaturas ---
  const subscriptionsByStatus: Record<SubscriptionStatus, number> = {
    trial: 0,
    ativa: 0,
    inadimplente: 0,
    pausada: 0,
    cancelada: 0,
  };
  for (const sub of allSubs) subscriptionsByStatus[sub.status] += 1;

  const mrrInput = allSubs.map((sub) => ({
    status: sub.status,
    amount_cents: sub.amount_cents,
    interval: intervalOf(sub),
  }));
  const mrrCents = sumMonthlyRecurringCents(mrrInput);
  const mrrAtRiskCents = sumMonthlyRecurringCents(mrrInput, ["inadimplente"]);
  const payingSubscriptions = subscriptionsByStatus.ativa + subscriptionsByStatus.inadimplente;

  const canceledRecently = allSubs.filter(
    (sub) => sub.status === "cancelada" && sub.canceled_at && sub.canceled_at >= since30d
  );
  const lostMrrCents = canceledRecently.reduce(
    (total, sub) => total + monthlyAmountCents(sub.amount_cents, intervalOf(sub)),
    0
  );
  const trialsEndingSoon = allSubs.filter(
    (sub) => sub.status === "trial" && sub.trial_ends_at && sub.trial_ends_at <= in7d
  ).length;

  // --- Faturas ---
  const paidInWindow = invoices.filter(
    (inv) => inv.status === "paga" && inv.paid_at && inv.paid_at >= windowStart
  );
  const revenueOfMonth = (month: string) =>
    paidInWindow
      .filter((inv) => utcToLocalDate(new Date(inv.paid_at!)).startsWith(month))
      .reduce((total, inv) => total + inv.total_cents, 0);

  const revenueWindowCents = paidInWindow.reduce((total, inv) => total + inv.total_cents, 0);

  const openInvoices = invoices.filter((inv) => inv.status === "aberta" || inv.status === "vencida");
  const overdue = openInvoices.filter((inv) => isInvoiceOverdue(inv, today));
  const openReceivableCents = openInvoices
    .filter((inv) => !isInvoiceOverdue(inv, today))
    .reduce((total, inv) => total + inv.total_cents, 0);

  const agingTotals = new Map<AgingBucketKey, { cents: number; count: number }>(
    AGING_BUCKETS.map((b) => [b.key, { cents: 0, count: 0 }])
  );
  for (const invoice of overdue) {
    const bucket = agingBucket(invoice.due_date, today);
    if (!bucket) continue;
    const row = agingTotals.get(bucket)!;
    row.cents += invoice.total_cents;
    row.count += 1;
  }

  // --- Pagamentos ---
  const approved = payments.filter((p) => p.status === "aprovado");
  const feesWindowCents = approved.reduce((total, p) => total + p.fee_cents, 0);
  const methodTotals = new Map<PaymentMethod, { cents: number; count: number }>();
  for (const payment of approved) {
    const row = methodTotals.get(payment.method) ?? { cents: 0, count: 0 };
    row.cents += payment.amount_cents;
    row.count += 1;
    methodTotals.set(payment.method, row);
  }
  const failedPaymentsWindow = payments.filter(
    (p) => p.status === "recusado" || p.status === "expirado"
  ).length;

  return {
    mrrCents,
    mrrAtRiskCents,
    projectedArrCents: projectedAnnualCents(mrrCents),
    arpuCents: payingSubscriptions > 0 ? Math.round(mrrCents / payingSubscriptions) : 0,

    subscriptionsByStatus,
    payingSubscriptions,
    trials: subscriptionsByStatus.trial,
    trialsEndingSoon,
    canceled30d: canceledRecently.length,
    churnRate30d: churnRate(lostMrrCents, mrrCents + lostMrrCents),

    revenueThisMonthCents: revenueOfMonth(thisMonth),
    revenueLastMonthCents: revenueOfMonth(lastMonth),
    revenueWindowCents,
    feesWindowCents,
    netRevenueWindowCents: revenueWindowCents - feesWindowCents,
    paidInvoicesWindow: paidInWindow.length,
    averageTicketCents:
      paidInWindow.length > 0 ? Math.round(revenueWindowCents / paidInWindow.length) : 0,

    openReceivableCents,
    overdueCents: overdue.reduce((total, inv) => total + inv.total_cents, 0),
    overdueInvoices: overdue.length,
    aging: AGING_BUCKETS.map((b) => ({
      key: b.key,
      label: b.label,
      ...agingTotals.get(b.key)!,
    })),

    methodSplit: Array.from(methodTotals.entries()).map(([method, row]) => ({ method, ...row })),
    failedPaymentsWindow,
  };
}

/** Série de receita realizada por mês (fatura paga), para o gráfico de barras. */
export async function getRevenueByMonth(monthCount = REVENUE_WINDOW_MONTHS): Promise<MonthlyPoint[]> {
  const supabase = createServiceRoleSupabaseClient();
  const months = lastMonths(monthCount);
  const since = `${months[0]}-01T00:00:00.000Z`;
  const { data, error } = await supabase
    .from("invoices")
    .select("total_cents, paid_at")
    .eq("status", "paga")
    .gte("paid_at", since);
  if (error) throw error;

  return bucketByMonth(
    (data ?? [])
      .filter((row): row is { total_cents: number; paid_at: string } => Boolean(row.paid_at))
      .map((row) => ({ at: row.paid_at, cents: row.total_cents })),
    months
  );
}

/** Fatura + o nome do estúdio, que é como o admin identifica a linha. */
export interface InvoiceRow {
  invoice: Invoice;
  studioName: string;
  studioSlug: string;
  /** Status como deve ser lido hoje (aberta vencida vira "vencida"). */
  effectiveStatus: InvoiceStatus;
  payments: Payment[];
}

export interface InvoiceFilters {
  status?: InvoiceStatus | "todas" | "em_atraso";
  studioId?: string;
  /** Mês "YYYY-MM" pela data de emissão; ausente = janela inteira. */
  month?: string;
  query?: string;
  limit?: number;
}

export async function listInvoices(filters: InvoiceFilters = {}): Promise<InvoiceRow[]> {
  const supabase = createServiceRoleSupabaseClient();
  const today = utcToLocalDate(new Date());
  const limit = filters.limit ?? 200;

  let query = supabase
    .from("invoices")
    .select("*")
    .order("issued_at", { ascending: false })
    .limit(limit);
  if (filters.studioId) query = query.eq("studio_id", filters.studioId);
  if (filters.status && filters.status !== "todas" && filters.status !== "em_atraso") {
    query = query.eq("status", filters.status);
  }
  if (filters.month) {
    // Emissão dentro do mês pedido: [1º do mês, 1º do mês seguinte).
    const [y, m] = filters.month.split("-").map(Number);
    const start = new Date(Date.UTC(y, m - 1, 1)).toISOString();
    const end = new Date(Date.UTC(y, m, 1)).toISOString();
    query = query.gte("issued_at", start).lt("issued_at", end);
  }

  const { data: invoices, error } = await query;
  if (error) throw error;
  const rows = invoices ?? [];
  if (rows.length === 0) return [];

  const studioIds = Array.from(new Set(rows.map((i) => i.studio_id)));
  const [{ data: studios, error: studiosError }, { data: payments, error: paymentsError }] =
    await Promise.all([
      supabase.from("studios").select("id, name, slug").in("id", studioIds),
      supabase
        .from("payments")
        .select("*")
        .in(
          "invoice_id",
          rows.map((i) => i.id)
        )
        .order("created_at", { ascending: false }),
    ]);
  if (studiosError) throw studiosError;
  if (paymentsError) throw paymentsError;

  const studioById = new Map((studios ?? []).map((s) => [s.id, s]));
  const paymentsByInvoice = new Map<string, Payment[]>();
  for (const payment of payments) {
    const list = paymentsByInvoice.get(payment.invoice_id) ?? [];
    list.push(payment);
    paymentsByInvoice.set(payment.invoice_id, list);
  }

  const query_ = filters.query?.trim().toLowerCase() ?? "";
  return rows
    .map((invoice) => {
      const studio = studioById.get(invoice.studio_id);
      return {
        invoice,
        studioName: studio?.name ?? "Estúdio removido",
        studioSlug: studio?.slug ?? "",
        effectiveStatus: effectiveInvoiceStatus(invoice, today),
        payments: paymentsByInvoice.get(invoice.id) ?? [],
      };
    })
    .filter((row) => {
      if (filters.status === "em_atraso" && row.effectiveStatus !== "vencida") return false;
      if (!query_) return true;
      return (
        row.studioName.toLowerCase().includes(query_) ||
        row.studioSlug.includes(query_) ||
        String(row.invoice.seq).includes(query_)
      );
    });
}

/** Faturamento de UM estúdio — o bloco de dinheiro da ficha do cliente. */
export interface StudioBilling {
  current: SubscriptionWithPlan | null;
  /** Assinaturas anteriores, mais recente primeiro. */
  history: Subscription[];
  invoices: InvoiceRow[];
  /** Total já pago pelo estúdio desde sempre. */
  lifetimeCents: number;
  paidInvoices: number;
  overdueCents: number;
  overdueInvoices: number;
  openCents: number;
  netLifetimeCents: number;
  lastPaymentAt: string | null;
  lastPaymentMethod: PaymentMethod | null;
  /** Média de dias entre vencimento e pagamento (negativo = paga adiantado). */
  averageDaysToPay: number | null;
}

export async function getStudioBilling(studioId: string): Promise<StudioBilling> {
  const supabase = createServiceRoleSupabaseClient();
  const today = utcToLocalDate(new Date());

  const [
    { data: subs, error: subsError },
    plans,
    { data: invoices, error: invoicesError },
    { data: payments, error: paymentsError },
  ] = await Promise.all([
    supabase.from("subscriptions").select("*").eq("studio_id", studioId).order("started_at", {
      ascending: false,
    }),
    listPlans(),
    supabase.from("invoices").select("*").eq("studio_id", studioId).order("issued_at", {
      ascending: false,
    }),
    supabase.from("payments").select("*").eq("studio_id", studioId).order("created_at", {
      ascending: false,
    }),
  ]);
  if (subsError) throw subsError;
  if (invoicesError) throw invoicesError;
  if (paymentsError) throw paymentsError;

  const planById = new Map(plans.map((p) => [p.id, p]));
  const currentSub = (subs ?? []).find((s) => s.status !== "cancelada") ?? null;
  const currentPlan = currentSub ? (planById.get(currentSub.plan_id) ?? null) : null;
  const interval = currentPlan?.billing_interval ?? "mensal";

  const paymentsByInvoice = new Map<string, Payment[]>();
  for (const payment of payments) {
    const list = paymentsByInvoice.get(payment.invoice_id) ?? [];
    list.push(payment);
    paymentsByInvoice.set(payment.invoice_id, list);
  }

  const invoiceRows: InvoiceRow[] = invoices.map((invoice) => ({
    invoice,
    studioName: "",
    studioSlug: "",
    effectiveStatus: effectiveInvoiceStatus(invoice, today),
    payments: paymentsByInvoice.get(invoice.id) ?? [],
  }));

  const paid = invoiceRows.filter((row) => row.invoice.status === "paga");
  const overdue = invoiceRows.filter((row) => row.effectiveStatus === "vencida");
  const approvedPayments = payments.filter((p) => p.status === "aprovado");

  // Pontualidade: só faz sentido sobre fatura efetivamente paga.
  const payDelays = paid
    .filter((row) => row.invoice.paid_at)
    .map((row) => {
      const paidDate = Date.parse(`${utcToLocalDate(new Date(row.invoice.paid_at!))}T00:00:00Z`);
      const dueDate = Date.parse(`${row.invoice.due_date}T00:00:00Z`);
      return Math.round((paidDate - dueDate) / DAY_MS);
    });

  return {
    current: currentSub
      ? {
          subscription: currentSub,
          plan: currentPlan,
          interval,
          monthlyCents: monthlyAmountCents(currentSub.amount_cents, interval),
        }
      : null,
    history: (subs ?? []).filter((s) => s.status === "cancelada"),
    invoices: invoiceRows,
    lifetimeCents: paid.reduce((total, row) => total + row.invoice.total_cents, 0),
    paidInvoices: paid.length,
    overdueCents: overdue.reduce((total, row) => total + row.invoice.total_cents, 0),
    overdueInvoices: overdue.length,
    openCents: invoiceRows
      .filter((row) => row.effectiveStatus === "aberta")
      .reduce((total, row) => total + row.invoice.total_cents, 0),
    netLifetimeCents: approvedPayments.reduce((total, p) => total + netPaymentCents(p), 0),
    lastPaymentAt: approvedPayments[0]?.paid_at ?? null,
    lastPaymentMethod: approvedPayments[0]?.method ?? null,
    averageDaysToPay:
      payDelays.length > 0
        ? Math.round(payDelays.reduce((a, b) => a + b, 0) / payDelays.length)
        : null,
  };
}

/** Resumo de dinheiro por estúdio, para enriquecer a lista de clientes. */
export interface StudioRevenueSummary {
  lifetimeCents: number;
  overdueCents: number;
  openCents: number;
  lastPaidAt: string | null;
}

/**
 * Um Map studio_id → resumo financeiro, montado com DUAS queries no total
 * (não uma por estúdio). A lista de clientes do /superadmin precisa de
 * dinheiro em cada linha, e fazer isso por linha seria N+1 na cara.
 */
export async function mapStudioRevenue(): Promise<Map<string, StudioRevenueSummary>> {
  const supabase = createServiceRoleSupabaseClient();
  const today = utcToLocalDate(new Date());
  const { data, error } = await supabase
    .from("invoices")
    .select("studio_id, total_cents, status, due_date, paid_at");
  if (error) throw error;

  const result = new Map<string, StudioRevenueSummary>();
  for (const invoice of data ?? []) {
    const row =
      result.get(invoice.studio_id) ??
      ({ lifetimeCents: 0, overdueCents: 0, openCents: 0, lastPaidAt: null } as StudioRevenueSummary);

    if (invoice.status === "paga") {
      row.lifetimeCents += invoice.total_cents;
      if (invoice.paid_at && (!row.lastPaidAt || invoice.paid_at > row.lastPaidAt)) {
        row.lastPaidAt = invoice.paid_at;
      }
    } else if (isInvoiceOverdue(invoice, today)) {
      row.overdueCents += invoice.total_cents;
    } else if (invoice.status === "aberta") {
      row.openCents += invoice.total_cents;
    }

    result.set(invoice.studio_id, row);
  }
  return result;
}
