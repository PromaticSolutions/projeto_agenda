import { addLocalDays, utcToLocalDate, weekdayOfDate } from "@/lib/availability";
import type { BookingStatus } from "@/lib/types";

/**
 * Indicadores do painel, em funções puras.
 *
 * Nada aqui toca banco nem relógio por conta própria — o `now` sempre chega
 * por parâmetro, como em src/lib/reminders.ts. É o que permite testar "quanto
 * entrou na terça" sem subir nada, e é também o que faz as mesmas contas
 * servirem para a atendente (um estúdio) e para a gerente (vários): a origem
 * dos agendamentos muda, a agregação não.
 *
 * ## O que "realizado" significa aqui, e por quê
 *
 * Realizado é **o que já passou e não foi cancelado** — não apenas o que está
 * marcado como `finalizado`. Marcar o status é um gesto que a dona do salão
 * faz no fim do atendimento, e quem está com a mão na cliente esquece. Contar
 * só o `finalizado` mostraria faturamento perto de zero num salão cheio, e o
 * painel inteiro pareceria quebrado.
 *
 * A escolha tem o erro oposto: a cliente que faltou e nunca foi cancelada
 * entra na conta. Por isso `confirmedCount` sai separado — é com ele que a
 * tela diz quanta confiança o número merece — e por isso todo valor desta
 * camada é ESTIMATIVA, rotulada como tal na interface.
 *
 * ## Por que o valor é estimado mesmo quando o preço existe
 *
 * `bookings` guarda `service_id`, não o preço cobrado. O valor sai da tabela
 * de preços ATUAL, então mudar o preço de um serviço reescreve o passado, e
 * serviço apagado não tem preço nenhum (vira `unpricedCount`). Resolver isso
 * de verdade exige gravar o preço na linha do agendamento — mudança de schema,
 * fora do alcance de uma tela.
 */

/** O mínimo que o painel precisa de um agendamento. */
export interface MetricBooking {
  studio_id: string;
  service_id: string;
  client_name: string;
  client_phone: string;
  start_at: string;
  status: BookingStatus;
}

/** Preço em centavos por `service_id`. Ausente = serviço sem preço conhecido. */
export type PriceTable = ReadonlyMap<string, number>;

/** Intervalo de datas locais do estúdio, inclusive nas duas pontas. */
export interface DateRange {
  from: string;
  to: string;
}

export const DASHBOARD_PERIODS = [
  { days: 7, label: "7 dias" },
  { days: 30, label: "30 dias" },
  { days: 90, label: "90 dias" },
] as const;

export const DEFAULT_PERIOD_DAYS = 30;

/** Aceita só os períodos que a tela oferece; qualquer outra coisa vira o padrão. */
export function parsePeriodDays(raw: string | undefined): number {
  const parsed = Number(raw);
  return DASHBOARD_PERIODS.some((p) => p.days === parsed) ? parsed : DEFAULT_PERIOD_DAYS;
}

/** Janela de `days` dias terminando HOJE, com hoje dentro dela. */
export function periodEndingAt(todayDate: string, days: number): DateRange {
  return { from: addLocalDays(todayDate, -(days - 1)), to: todayDate };
}

/** A janela imediatamente anterior, do mesmo tamanho — a base da comparação. */
export function periodBefore(range: DateRange, days: number): DateRange {
  const to = addLocalDays(range.from, -1);
  return { from: addLocalDays(to, -(days - 1)), to };
}

/**
 * Recorta pelos agendamentos cuja data LOCAL cai no intervalo.
 *
 * Existe porque o painel busca as duas janelas — a atual e a anterior — numa
 * consulta só, e depois separa em memória. Duas consultas custariam uma ida a
 * mais ao banco para comparar dois totais.
 */
export function inRange(bookings: readonly MetricBooking[], range: DateRange): MetricBooking[] {
  return bookings.filter((booking) => {
    const date = utcToLocalDate(new Date(booking.start_at));
    return date >= range.from && date <= range.to;
  });
}

export interface PeriodTotals {
  /** Tudo que caiu no período, inclusive cancelado. */
  totalCount: number;
  /** Já passou e não foi cancelado. */
  realizedCount: number;
  /** Dos realizados, quantos a dona marcou como `finalizado` de fato. */
  confirmedCount: number;
  /** Realizados cujo serviço não tem preço na tabela atual. */
  unpricedCount: number;
  canceledCount: number;
  /** Ainda vai acontecer e não foi cancelado. */
  upcomingCount: number;
  realizedCents: number;
  expectedCents: number;
  averageTicketCents: number;
  cancelRate: number;
}

function isRealized(booking: MetricBooking, now: Date): boolean {
  return booking.status !== "cancelado" && new Date(booking.start_at) <= now;
}

export function summarizePeriod(
  bookings: readonly MetricBooking[],
  prices: PriceTable,
  now: Date
): PeriodTotals {
  const totals: PeriodTotals = {
    totalCount: bookings.length,
    realizedCount: 0,
    confirmedCount: 0,
    unpricedCount: 0,
    canceledCount: 0,
    upcomingCount: 0,
    realizedCents: 0,
    expectedCents: 0,
    averageTicketCents: 0,
    cancelRate: 0,
  };

  let pricedRealized = 0;

  for (const booking of bookings) {
    if (booking.status === "cancelado") {
      totals.canceledCount += 1;
      continue;
    }

    const cents = prices.get(booking.service_id);

    if (isRealized(booking, now)) {
      totals.realizedCount += 1;
      if (booking.status === "finalizado") totals.confirmedCount += 1;
      if (cents === undefined) {
        totals.unpricedCount += 1;
      } else {
        totals.realizedCents += cents;
        pricedRealized += 1;
      }
      continue;
    }

    totals.upcomingCount += 1;
    totals.expectedCents += cents ?? 0;
  }

  // O sem-preço fica FORA do divisor: incluí-lo faria cada serviço apagado
  // derrubar o ticket médio como se tivesse sido cobrado R$ 0.
  totals.averageTicketCents =
    pricedRealized > 0 ? Math.round(totals.realizedCents / pricedRealized) : 0;
  totals.cancelRate = bookings.length > 0 ? totals.canceledCount / bookings.length : 0;

  return totals;
}

/**
 * Variação relativa entre dois períodos, ou `null` quando não havia base.
 *
 * Sair de zero não é "+∞%" nem "+100%": é a primeira medição, e qualquer
 * número ali seria invenção. `null` diz à tela para não desenhar a seta.
 */
export function changeRate(current: number, previous: number): number | null {
  if (previous <= 0) return null;
  return (current - previous) / previous;
}

export interface DayPoint {
  /** Data local do estúdio, "YYYY-MM-DD". */
  date: string;
  cents: number;
  count: number;
}

/**
 * Uma entrada por dia do intervalo — inclusive os dias sem nada.
 *
 * O dia vazio precisa ocupar espaço no eixo: comprimir a série só nos dias com
 * movimento faria uma semana de três atendimentos parecer uma semana cheia.
 */
export function revenueByLocalDay(
  bookings: readonly MetricBooking[],
  prices: PriceTable,
  range: DateRange,
  now: Date
): DayPoint[] {
  const byDate = new Map<string, DayPoint>();
  for (let date = range.from; date <= range.to; date = addLocalDays(date, 1)) {
    byDate.set(date, { date, cents: 0, count: 0 });
  }

  for (const booking of bookings) {
    if (!isRealized(booking, now)) continue;
    // O balde é o dia NO FUSO DO ESTÚDIO: agrupar pela string ISO jogaria todo
    // atendimento depois das 21h para o dia seguinte.
    const point = byDate.get(utcToLocalDate(new Date(booking.start_at)));
    if (!point) continue;
    point.cents += prices.get(booking.service_id) ?? 0;
    point.count += 1;
  }

  return [...byDate.values()];
}

export interface WeekdayPoint {
  /** 0 = domingo … 6 = sábado. */
  weekday: number;
  cents: number;
  count: number;
}

/** Soma por dia da semana — a resposta de "qual é o meu melhor dia". */
export function revenueByWeekday(
  bookings: readonly MetricBooking[],
  prices: PriceTable,
  now: Date
): WeekdayPoint[] {
  const points: WeekdayPoint[] = Array.from({ length: 7 }, (_, weekday) => ({
    weekday,
    cents: 0,
    count: 0,
  }));

  for (const booking of bookings) {
    if (!isRealized(booking, now)) continue;
    const point = points[weekdayOfDate(utcToLocalDate(new Date(booking.start_at)))];
    point.cents += prices.get(booking.service_id) ?? 0;
    point.count += 1;
  }

  return points;
}

/**
 * O dia da semana que mais rendeu, ou `null` quando não há o que comparar.
 *
 * `null` em vez do domingo zerado: num período sem nenhum atendimento, eleger
 * um "melhor dia" seria apontar o primeiro índice do array como se fosse
 * resultado. A tela precisa saber a diferença para não dar conselho vazio.
 */
export function bestWeekday(points: readonly WeekdayPoint[]): WeekdayPoint | null {
  const best = [...points].sort((a, b) => b.cents - a.cents || b.count - a.count)[0];
  if (!best || (best.cents === 0 && best.count === 0)) return null;
  return best;
}

export interface RankedRow {
  key: string;
  label: string;
  cents: number;
  count: number;
}

/**
 * Ranking de realizados por uma chave qualquer — serviço, cliente, atendente.
 *
 * Quem decide a chave é o chamador (`resolve`), porque as três telas rankeiam
 * coisas diferentes com a mesma conta. Devolver `null` em `resolve` tira a
 * linha do ranking: é como a tela de serviços descarta o que não reconhece.
 */
export function rankBookings(
  bookings: readonly MetricBooking[],
  prices: PriceTable,
  now: Date,
  resolve: (booking: MetricBooking) => { key: string; label: string } | null
): RankedRow[] {
  const rows = new Map<string, RankedRow>();

  for (const booking of bookings) {
    if (!isRealized(booking, now)) continue;
    const identity = resolve(booking);
    if (!identity) continue;

    const row = rows.get(identity.key) ?? { ...identity, cents: 0, count: 0 };
    row.cents += prices.get(booking.service_id) ?? 0;
    row.count += 1;
    rows.set(identity.key, row);
  }

  // Desempate por quantidade: sem ele, tudo que não tem preço empata em R$ 0 e
  // a ordem passaria a depender da ordem de chegada do banco.
  return [...rows.values()].sort((a, b) => b.cents - a.cents || b.count - a.count);
}
