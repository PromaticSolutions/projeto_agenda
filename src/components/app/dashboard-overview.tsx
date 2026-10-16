import Link from "next/link";
import { CalendarCheck, CircleSlash, Receipt, Wallet } from "lucide-react";
import { CategoryBars } from "@/components/charts/category-bars";
import { ChartCard } from "@/components/charts/chart-card";
import { KpiTile, type KpiDelta } from "@/components/charts/kpi-tile";
import { TrendChart } from "@/components/charts/trend-chart";
import { ValueBars } from "@/components/charts/value-bars";
import { formatPercent } from "@/lib/billing";
import { formatPriceCents } from "@/lib/format";
import { WEEKDAY_LABELS, WEEKDAY_LABELS_SHORT } from "@/lib/weekdays";
import {
  DASHBOARD_PERIODS,
  bestWeekday,
  changeRate,
  type DateRange,
  type DayPoint,
  type PeriodTotals,
  type RankedRow,
  type WeekdayPoint,
} from "@/lib/metrics";
import { cn } from "@/lib/utils";

export interface DashboardRanking {
  title: string;
  subtitle?: string;
  rows: RankedRow[];
  /** O comprimento da barra segue o valor (padrão) ou a quantidade. */
  by?: "cents" | "count";
  emptyLabel?: string;
}

/**
 * Bloco de indicadores do painel — o mesmo para a atendente e para a gerente.
 *
 * Recebe tudo já agregado (src/lib/metrics.ts) em vez de buscar: quem sabe de
 * onde vêm os agendamentos é a página, porque a atendente lê um estúdio e a
 * gerente lê o salão inteiro. A conta e o desenho são idênticos nos dois
 * casos, e é por isso que este componente existe em vez de duas telas quase
 * iguais.
 *
 * Server Component de propósito: nada aqui tem estado. A única interação — a
 * troca de período — é navegação, então são links, não botões com `useState`.
 * O que é interativo mesmo (hover dos gráficos) já vem isolado nas ilhas
 * `TrendChart` e `ValueBars`.
 */
export function DashboardOverview({
  periodDays,
  range,
  totals,
  previous,
  daily,
  weekday,
  rankings,
  hrefForPeriod,
}: {
  periodDays: number;
  range: DateRange;
  totals: PeriodTotals;
  previous: PeriodTotals;
  daily: DayPoint[];
  weekday: WeekdayPoint[];
  rankings: DashboardRanking[];
  hrefForPeriod: (days: number) => string;
}) {
  const best = bestWeekday(weekday);
  const nothingYet = totals.totalCount === 0;

  /* A estimativa é rotulada como estimativa em TODO tile de dinheiro. O valor
     sai da tabela de preços atual, não do que foi cobrado — e um número de
     faturamento sem essa ressalva é lido como contabilidade. */
  const moneyHint =
    totals.unpricedCount > 0
      ? `Estimativa pelo preço atual dos serviços. ${totals.unpricedCount} ${
          totals.unpricedCount === 1 ? "atendimento ficou" : "atendimentos ficaram"
        } de fora por não ter preço cadastrado.`
      : "Estimativa pelo preço atual dos serviços, não pelo valor cobrado.";

  const against = `vs. ${periodDays} dias anteriores`;
  const revenueDelta = toDelta(changeRate(totals.realizedCents, previous.realizedCents), against);
  const countDelta = toDelta(changeRate(totals.realizedCount, previous.realizedCount), against);
  const ticketDelta = toDelta(
    changeRate(totals.averageTicketCents, previous.averageTicketCents),
    against
  );
  const cancelDelta = toDelta(changeRate(totals.cancelRate, previous.cancelRate), against, false);

  return (
    <section aria-label="Visão geral" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold text-foreground">Visão geral</h2>
          <p className="text-sm text-muted-foreground">
            {formatRange(range)} · {totals.realizedCount}{" "}
            {totals.realizedCount === 1 ? "atendimento" : "atendimentos"}
          </p>
        </div>
        <PeriodPicker current={periodDays} hrefForPeriod={hrefForPeriod} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiTile
          label="Faturamento no período"
          value={formatPriceCents(totals.realizedCents)}
          icon={Wallet}
          tone="primary"
          delta={revenueDelta}
          sublabel={
            totals.expectedCents > 0
              ? `+ ${formatPriceCents(totals.expectedCents)} já agendado à frente`
              : undefined
          }
          hint={moneyHint}
        />
        <KpiTile
          label="Ticket médio"
          value={formatPriceCents(totals.averageTicketCents)}
          icon={Receipt}
          delta={ticketDelta}
          hint={moneyHint}
        />
        <KpiTile
          label="Atendimentos realizados"
          value={String(totals.realizedCount)}
          icon={CalendarCheck}
          delta={countDelta}
          sublabel={
            /* A diferença entre "aconteceu" e "foi marcado como finalizado" é
               o que diz se dá para confiar no faturamento acima. */
            totals.realizedCount > 0
              ? `${totals.confirmedCount} de ${totals.realizedCount} marcados como finalizados`
              : undefined
          }
        />
        <KpiTile
          label="Cancelamentos"
          value={formatPercent(totals.cancelRate)}
          icon={CircleSlash}
          tone={totals.cancelRate >= 0.2 ? "warning" : "neutral"}
          delta={cancelDelta}
          sublabel={`${totals.canceledCount} de ${totals.totalCount} no período`}
        />
      </div>

      {nothingYet ? (
        <div className="panel flex flex-col items-center gap-1 border-dashed p-8 text-center">
          <p className="font-medium text-foreground">Sem agendamentos neste período</p>
          <p className="text-sm text-muted-foreground">
            Os números aparecem assim que houver atendimento na agenda.
          </p>
        </div>
      ) : (
        <>
          <div className="grid gap-3 lg:grid-cols-2">
            <ChartCard
              title="Faturamento por dia"
              subtitle={formatPriceCents(totals.realizedCents)}
              data={{
                columns: ["Dia", "Valor", "Atendimentos"],
                rows: daily.map((point) => [
                  formatDayLabel(point.date),
                  formatPriceCents(point.cents),
                  String(point.count),
                ]),
              }}
            >
              <TrendChart
                data={daily.map((point) => ({ date: point.date, value: point.cents }))}
                color="var(--chart-1)"
                format="currency"
                ariaLabel={`Faturamento por dia, ${daily.length} dias`}
              />
            </ChartCard>

            <ChartCard
              title="Melhores dias da semana"
              subtitle={
                best
                  ? `${WEEKDAY_LABELS[best.weekday]} rende mais: ${formatPriceCents(best.cents)}`
                  : "Ainda sem atendimento concluído no período"
              }
              data={{
                columns: ["Dia", "Valor", "Atendimentos"],
                rows: weekday.map((point) => [
                  WEEKDAY_LABELS[point.weekday],
                  formatPriceCents(point.cents),
                  String(point.count),
                ]),
              }}
              footer={
                best ? (
                  <p className="text-xs text-muted-foreground">
                    Foram {best.count} {best.count === 1 ? "atendimento" : "atendimentos"} nas{" "}
                    {WEEKDAY_LABELS[best.weekday].toLowerCase()}s do período.
                  </p>
                ) : undefined
              }
            >
              <ValueBars
                data={weekday.map((point) => ({
                  key: String(point.weekday),
                  label: WEEKDAY_LABELS_SHORT[point.weekday],
                  cents: point.cents,
                  count: point.count,
                }))}
                highlightKey={best ? String(best.weekday) : undefined}
              />
            </ChartCard>
          </div>

          <div
            className={cn(
              "grid gap-3",
              rankings.length > 1 ? "lg:grid-cols-2" : "lg:grid-cols-1"
            )}
          >
            {rankings.map((ranking) => (
              <ChartCard
                key={ranking.title}
                title={ranking.title}
                subtitle={ranking.subtitle}
                data={{
                  columns: ["Nome", "Valor", "Atendimentos"],
                  rows: ranking.rows.map((row) => [
                    row.label,
                    formatPriceCents(row.cents),
                    String(row.count),
                  ]),
                }}
              >
                <CategoryBars
                  bars={ranking.rows.slice(0, 6).map((row) => ({
                    key: row.key,
                    label: row.label,
                    value: ranking.by === "count" ? row.count : row.cents,
                    formatted:
                      ranking.by === "count"
                        ? `${row.count} ${row.count === 1 ? "vez" : "vezes"}`
                        : formatPriceCents(row.cents),
                    meta:
                      ranking.by === "count"
                        ? formatPriceCents(row.cents)
                        : `${row.count} ${row.count === 1 ? "atendimento" : "atendimentos"}`,
                  }))}
                  emptyLabel={ranking.emptyLabel ?? "Sem dados no período."}
                />
              </ChartCard>
            ))}
          </div>
        </>
      )}
    </section>
  );
}

/** `null` em `rate` significa "não havia base": o tile não desenha seta. */
function toDelta(rate: number | null, against: string, upIsGood = true): KpiDelta | undefined {
  return rate === null ? undefined : { rate, against, upIsGood };
}

function PeriodPicker({
  current,
  hrefForPeriod,
}: {
  current: number;
  hrefForPeriod: (days: number) => string;
}) {
  return (
    <nav aria-label="Período" className="flex items-center gap-1 rounded-lg border border-border p-0.5">
      {DASHBOARD_PERIODS.map((period) => {
        const active = period.days === current;
        return (
          <Link
            key={period.days}
            href={hrefForPeriod(period.days)}
            aria-current={active ? "page" : undefined}
            className={cn(
              "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
              active
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            {period.label}
          </Link>
        );
      })}
    </nav>
  );
}

function formatDayLabel(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  // `timeZone: "UTC"` porque a string já É a data local do estúdio: formatá-la
  // no fuso do processo jogaria o dia 1º para o mês anterior.
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(y, m - 1, d)));
}

function formatRange(range: DateRange): string {
  return `${formatDayLabel(range.from)} a ${formatDayLabel(range.to)}`;
}
