import type { InvoiceStatus, SubscriptionStatus } from "@/lib/types";

/**
 * Vocabulário dos filtros do /superadmin.
 *
 * Mesmo contrato de `bookings-filter.ts`: o estado vive na URL, a página lê e
 * a barra escreve, e as duas importam ESTAS constantes — assim a barra nunca
 * oferece uma opção que a página não sabe ler (o filtro cairia no padrão em
 * silêncio, que é o pior desfecho possível para um filtro).
 */

// --- Lista de clientes -------------------------------------------------------

export const STUDIO_FILTERS = [
  { value: "todos", label: "Todos os clientes" },
  { value: "ativos", label: "Ativos (30 dias)" },
  { value: "em_risco", label: "Em risco (sem agenda)" },
  { value: "novos", label: "Novos (14 dias)" },
  { value: "trial", label: "Em teste" },
  { value: "inadimplentes", label: "Inadimplentes" },
  { value: "sem_assinatura", label: "Sem assinatura" },
] as const;

export type StudioFilter = (typeof STUDIO_FILTERS)[number]["value"];
export const DEFAULT_STUDIO_FILTER: StudioFilter = "todos";

export function parseStudioFilter(value: string | undefined): StudioFilter {
  return STUDIO_FILTERS.some((f) => f.value === value)
    ? (value as StudioFilter)
    : DEFAULT_STUDIO_FILTER;
}

export const STUDIO_SORTS = [
  { value: "atividade", label: "Mais agendamentos (30d)" },
  { value: "mrr", label: "Maior MRR" },
  { value: "receita", label: "Maior receita paga" },
  { value: "recentes", label: "Entraram por último" },
  { value: "parados", label: "Mais tempo sem agenda" },
  { value: "nome", label: "Nome (A–Z)" },
] as const;

export type StudioSort = (typeof STUDIO_SORTS)[number]["value"];
export const DEFAULT_STUDIO_SORT: StudioSort = "atividade";

export function parseStudioSort(value: string | undefined): StudioSort {
  return STUDIO_SORTS.some((s) => s.value === value) ? (value as StudioSort) : DEFAULT_STUDIO_SORT;
}

/**
 * O mínimo que uma linha precisa expor para ser filtrada e ordenada. A função
 * é genérica sobre isso para a página passar a linha inteira (com tudo que a
 * tabela desenha) sem que este módulo precise conhecer o resto.
 */
export interface StudioFilterInput {
  name: string;
  slug: string;
  ownerName: string | null;
  whatsapp: string;
  createdAt: string;
  bookingsLast30d: number;
  lastBookingAt: string | null;
  isAtRisk: boolean;
  isNew: boolean;
  subscriptionStatus: SubscriptionStatus | null;
  monthlyCents: number;
  lifetimeCents: number;
  overdueCents: number;
}

export function filterAndSortStudios<T extends StudioFilterInput>(
  rows: T[],
  options: { filter: StudioFilter; sort: StudioSort; query: string }
): T[] {
  const query = options.query.trim().toLowerCase();
  const digits = query.replace(/\D/g, "");

  const filtered = rows.filter((row) => {
    switch (options.filter) {
      case "ativos":
        if (row.bookingsLast30d === 0) return false;
        break;
      case "em_risco":
        if (!row.isAtRisk) return false;
        break;
      case "novos":
        if (!row.isNew) return false;
        break;
      case "trial":
        if (row.subscriptionStatus !== "trial") return false;
        break;
      case "inadimplentes":
        // Inadimplente é quem tem fatura vencida OU assinatura marcada como
        // tal: a marcação depende do gateway avisar, a fatura não depende de
        // ninguém. Exigir as duas esconderia caso real.
        if (row.subscriptionStatus !== "inadimplente" && row.overdueCents === 0) return false;
        break;
      case "sem_assinatura":
        if (row.subscriptionStatus !== null) return false;
        break;
      case "todos":
        break;
    }

    if (!query) return true;
    return (
      row.name.toLowerCase().includes(query) ||
      row.slug.includes(query) ||
      (row.ownerName?.toLowerCase().includes(query) ?? false) ||
      (digits.length >= 4 && row.whatsapp.includes(digits))
    );
  });

  const sorted = [...filtered];
  switch (options.sort) {
    case "atividade":
      sorted.sort((a, b) => b.bookingsLast30d - a.bookingsLast30d);
      break;
    case "mrr":
      sorted.sort((a, b) => b.monthlyCents - a.monthlyCents);
      break;
    case "receita":
      sorted.sort((a, b) => b.lifetimeCents - a.lifetimeCents);
      break;
    case "recentes":
      sorted.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      break;
    case "parados":
      // Quem nunca agendou vem primeiro: é o caso mais urgente, e ordenar
      // por data nula no fim o esconderia justamente de quem procura por ele.
      sorted.sort((a, b) => (a.lastBookingAt ?? "").localeCompare(b.lastBookingAt ?? ""));
      break;
    case "nome":
      sorted.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
      break;
  }
  return sorted;
}

// --- Faturas -----------------------------------------------------------------

export const INVOICE_FILTERS = [
  { value: "todas", label: "Todas as faturas" },
  { value: "em_atraso", label: "Em atraso" },
  { value: "aberta", label: "Abertas" },
  { value: "paga", label: "Pagas" },
  { value: "cancelada", label: "Canceladas" },
  { value: "reembolsada", label: "Reembolsadas" },
] as const;

export type InvoiceFilter = (typeof INVOICE_FILTERS)[number]["value"];
export const DEFAULT_INVOICE_FILTER: InvoiceFilter = "todas";

export function parseInvoiceFilter(value: string | undefined): InvoiceFilter {
  return INVOICE_FILTERS.some((f) => f.value === value)
    ? (value as InvoiceFilter)
    : DEFAULT_INVOICE_FILTER;
}

/** O filtro da URL virado no formato que `listInvoices` espera. */
export function invoiceFilterToStatus(
  filter: InvoiceFilter
): InvoiceStatus | "todas" | "em_atraso" {
  return filter === "todas" || filter === "em_atraso" ? filter : (filter as InvoiceStatus);
}

/** "2026-08" só se for realmente um mês; qualquer outra coisa é ignorada. */
export function parseMonthParam(value: string | undefined): string | undefined {
  return value && /^\d{4}-(0[1-9]|1[0-2])$/.test(value) ? value : undefined;
}
