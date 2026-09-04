import { utcToLocalDate } from "@/lib/availability";
import type {
  Invoice,
  InvoiceStatus,
  Payment,
  PaymentMethod,
  PaymentStatus,
  PlanInterval,
  Subscription,
  SubscriptionStatus,
} from "@/lib/types";

/**
 * Vocabulário e aritmética da cobrança da plataforma (0011_billing.sql).
 *
 * Tudo aqui é função PURA e livre de Supabase, pelos mesmos dois motivos de
 * `bookings-filter.ts`: os rótulos precisam ser idênticos no servidor (páginas
 * do /superadmin) e no cliente (barras de filtro), e a aritmética de dinheiro
 * é o tipo de código que merece teste unitário em vez de conferência a olho —
 * ver `billing.test.ts`.
 *
 * Convenção do projeto mantida: dinheiro é SEMPRE inteiro em centavos. Nenhuma
 * divisão por 100 acontece fora de `formatPriceCents`.
 */

// --- Rótulos -----------------------------------------------------------------

export const SUBSCRIPTION_STATUS_LABELS: Record<SubscriptionStatus, string> = {
  trial: "Em teste",
  ativa: "Ativa",
  inadimplente: "Inadimplente",
  pausada: "Pausada",
  cancelada: "Cancelada",
};

export const SUBSCRIPTION_STATUS_ORDER: SubscriptionStatus[] = [
  "ativa",
  "trial",
  "inadimplente",
  "pausada",
  "cancelada",
];

/** Ponto de status. Segue o mesmo vocabulário visual de BOOKING_STATUS_DOT. */
export const SUBSCRIPTION_STATUS_DOT: Record<SubscriptionStatus, string> = {
  ativa: "bg-wa",
  trial: "bg-violet-500",
  inadimplente: "bg-destructive",
  pausada: "bg-magenta",
  cancelada: "bg-muted-foreground",
};

export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  aberta: "Aberta",
  paga: "Paga",
  vencida: "Vencida",
  cancelada: "Cancelada",
  reembolsada: "Reembolsada",
};

export const INVOICE_STATUS_ORDER: InvoiceStatus[] = [
  "aberta",
  "paga",
  "vencida",
  "cancelada",
  "reembolsada",
];

export const INVOICE_STATUS_DOT: Record<InvoiceStatus, string> = {
  aberta: "bg-violet-500",
  paga: "bg-wa",
  vencida: "bg-destructive",
  cancelada: "bg-muted-foreground",
  reembolsada: "bg-magenta",
};

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  pix: "Pix",
  cartao_credito: "Cartão de crédito",
  boleto: "Boleto",
};

/**
 * Ordem FIXA dos métodos, e a cor de cada um.
 *
 * A cor acompanha o método, nunca a posição no ranking: se o Pix passar o
 * cartão em volume, os dois trocam de lugar no gráfico mas não de cor — quem
 * aprendeu "Pix é violeta" continua lendo certo. Os tokens são os
 * `--chart-N` do design system, validados para daltonismo nos dois temas
 * (ver comentário em globals.css).
 */
export const PAYMENT_METHOD_ORDER: PaymentMethod[] = ["pix", "cartao_credito", "boleto"];

export const PAYMENT_METHOD_COLOR: Record<PaymentMethod, string> = {
  pix: "var(--chart-1)",
  cartao_credito: "var(--chart-2)",
  boleto: "var(--chart-3)",
};

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  pendente: "Pendente",
  aprovado: "Aprovado",
  recusado: "Recusado",
  estornado: "Estornado",
  expirado: "Expirado",
};

export const PAYMENT_STATUS_DOT: Record<PaymentStatus, string> = {
  pendente: "bg-violet-500",
  aprovado: "bg-wa",
  recusado: "bg-destructive",
  estornado: "bg-magenta",
  expirado: "bg-muted-foreground",
};

export const PLAN_INTERVAL_LABELS: Record<PlanInterval, string> = {
  mensal: "/mês",
  anual: "/ano",
};

// --- Receita recorrente ------------------------------------------------------

/**
 * Assinaturas que contam como receita recorrente.
 *
 * `trial` fica FORA: ninguém pagou ainda, e somar teste em MRR é a forma mais
 * comum de um painel de SaaS mentir para o próprio dono.
 * `inadimplente` fica DENTRO porque o contrato existe e a cobrança ainda pode
 * ser recuperada — mas o painel mostra esse pedaço separado, como "em risco".
 */
export const MRR_STATUSES: SubscriptionStatus[] = ["ativa", "inadimplente"];

/** Valor da assinatura normalizado para um mês. Anual entra dividido por 12. */
export function monthlyAmountCents(amountCents: number, interval: PlanInterval): number {
  if (interval === "anual") return Math.round(amountCents / 12);
  return amountCents;
}

export interface MrrInput {
  status: SubscriptionStatus;
  amount_cents: number;
  interval: PlanInterval;
}

/** MRR em centavos: soma normalizada das assinaturas nos status informados. */
export function sumMonthlyRecurringCents(
  subscriptions: MrrInput[],
  statuses: SubscriptionStatus[] = MRR_STATUSES
): number {
  return subscriptions
    .filter((s) => statuses.includes(s.status))
    .reduce((total, s) => total + monthlyAmountCents(s.amount_cents, s.interval), 0);
}

/** Projeção anual simples do MRR. É projeção, não receita realizada. */
export function projectedAnnualCents(mrrCents: number): number {
  return mrrCents * 12;
}

/**
 * Churn de receita no período: quanto do MRR saiu, sobre o que havia no
 * começo. Estimativa — desconsidera downgrade e expansão dentro do período.
 */
export function churnRate(lostCents: number, baseCents: number): number {
  if (baseCents <= 0) return 0;
  return lostCents / baseCents;
}

export function conversionRate(converted: number, total: number): number {
  if (total <= 0) return 0;
  return converted / total;
}

// --- Faturas -----------------------------------------------------------------

/**
 * Status como o admin deve LER a fatura, não necessariamente como está no
 * banco: uma fatura `aberta` cujo vencimento já passou é, na prática, vencida.
 * A coluna só muda quando alguma rotina a atualiza, e o painel não pode
 * depender disso para dizer a verdade sobre inadimplência.
 */
export function effectiveInvoiceStatus(
  invoice: Pick<Invoice, "status" | "due_date">,
  today: string
): InvoiceStatus {
  if (invoice.status === "aberta" && invoice.due_date < today) return "vencida";
  return invoice.status;
}

export function isInvoiceOverdue(
  invoice: Pick<Invoice, "status" | "due_date">,
  today: string
): boolean {
  return effectiveInvoiceStatus(invoice, today) === "vencida";
}

export function daysOverdue(dueDate: string, today: string): number {
  const due = Date.parse(`${dueDate}T00:00:00Z`);
  const ref = Date.parse(`${today}T00:00:00Z`);
  if (Number.isNaN(due) || Number.isNaN(ref) || ref <= due) return 0;
  return Math.floor((ref - due) / 86_400_000);
}

export const AGING_BUCKETS = [
  { key: "1-7", label: "1 a 7 dias", max: 7 },
  { key: "8-30", label: "8 a 30 dias", max: 30 },
  { key: "31-60", label: "31 a 60 dias", max: 60 },
  { key: "60+", label: "mais de 60 dias", max: Infinity },
] as const;

export type AgingBucketKey = (typeof AGING_BUCKETS)[number]["key"];

/** Em que faixa de atraso uma fatura vencida cai. */
export function agingBucket(dueDate: string, today: string): AgingBucketKey | null {
  const days = daysOverdue(dueDate, today);
  if (days <= 0) return null;
  return (AGING_BUCKETS.find((b) => days <= b.max) ?? AGING_BUCKETS[AGING_BUCKETS.length - 1]).key;
}

// --- Pagamentos --------------------------------------------------------------

/** O que de fato entrou: valor aprovado menos taxa do gateway e estorno. */
export function netPaymentCents(
  payment: Pick<Payment, "amount_cents" | "fee_cents" | "refunded_cents">
): number {
  return payment.amount_cents - payment.fee_cents - payment.refunded_cents;
}

// --- Séries temporais --------------------------------------------------------

export interface MonthlyPoint {
  /** "2026-08" — mês no fuso do estúdio. */
  month: string;
  cents: number;
  count: number;
}

/** "2026-08" a partir de um instante ISO, no fuso do negócio (São Paulo). */
export function monthKeyOf(iso: string): string {
  return utcToLocalDate(new Date(iso)).slice(0, 7);
}

/** Rótulo curto do mês ("ago/26"), para eixo de gráfico. */
export function formatMonthShort(month: string): string {
  const [y, m] = month.split("-").map(Number);
  // `timeZone: "UTC"` é obrigatório: sem isso o dia 1º às 00:00 UTC é
  // formatado no fuso do processo e, a oeste de Greenwich, cai no mês
  // anterior — o eixo do gráfico ficaria um mês defasado.
  const label = new Intl.DateTimeFormat("pt-BR", { month: "short", timeZone: "UTC" }).format(
    new Date(Date.UTC(y, m - 1, 1))
  );
  return `${label.replace(".", "")}/${String(y).slice(2)}`;
}

/** Os N meses até `reference` (inclusive), do mais antigo para o mais novo. */
export function lastMonths(count: number, reference: Date = new Date()): string[] {
  const today = utcToLocalDate(reference);
  const [year, month] = today.split("-").map(Number);
  const months: string[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(year, month - 1 - i, 1));
    months.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`);
  }
  return months;
}

/**
 * Soma valores por mês devolvendo TODOS os meses da janela, inclusive os
 * zerados: um gráfico que omite o mês sem receita desenha uma linha
 * otimista, porque a queda simplesmente não aparece.
 */
export function bucketByMonth(
  rows: { at: string; cents: number }[],
  months: string[]
): MonthlyPoint[] {
  const totals = new Map<string, { cents: number; count: number }>(
    months.map((m) => [m, { cents: 0, count: 0 }])
  );
  for (const row of rows) {
    const bucket = totals.get(monthKeyOf(row.at));
    if (!bucket) continue;
    bucket.cents += row.cents;
    bucket.count += 1;
  }
  return months.map((month) => ({ month, ...totals.get(month)! }));
}

// --- Formatação --------------------------------------------------------------

const compactBrl = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  notation: "compact",
  maximumFractionDigits: 1,
});

/**
 * "R$ 12,4 mil" — para KPI e eixo, onde o centavo é ruído. O valor exato
 * continua disponível na tabela e no tooltip; nada fica só no compacto.
 */
export function formatCentsCompact(cents: number): string {
  return compactBrl.format(cents / 100);
}

export function formatPercent(rate: number, digits = 1): string {
  return `${(rate * 100).toFixed(digits).replace(".", ",")}%`;
}

/** Assinatura vigente (a que o índice parcial da 0011 garante ser única). */
export function isCurrentSubscription(status: SubscriptionStatus): boolean {
  return status !== "cancelada";
}

export function subscriptionStatusOf(
  subscription: Pick<Subscription, "status"> | null | undefined
): SubscriptionStatus | "sem_assinatura" {
  return subscription?.status ?? "sem_assinatura";
}
