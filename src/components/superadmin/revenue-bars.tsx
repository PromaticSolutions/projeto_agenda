"use client";

import { useState } from "react";
import { formatMonthShort, type MonthlyPoint } from "@/lib/billing";
import { formatPriceCents } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Receita realizada por mês.
 *
 * Colunas, não linha: cada mês é um total fechado e independente, e linha
 * sugere continuidade entre dois pontos que não existe (não há receita "no
 * meio" de julho e agosto). Uma série só, então sem legenda — o título do
 * card já diz o que está plotado.
 *
 * Construído em HTML/CSS em vez de SVG porque as colunas são poucas e o
 * layout precisa reagir à largura do card; barra é um `<button>` para o valor
 * também chegar por teclado e por leitor de tela, não só no hover.
 */
export function RevenueBars({ data }: { data: MonthlyPoint[] }) {
  const [hovered, setHovered] = useState<number | null>(null);

  const max = Math.max(...data.map((d) => d.cents), 0);
  // Teto arredondado para um número redondo: o eixo tem que ser legível, não
  // exato no pico (R$ 1.000 e não R$ 987,43).
  const ceiling = niceCeiling(max);
  const lastIndex = data.length - 1;

  return (
    <div className="flex gap-3">
      <div className="flex w-16 shrink-0 flex-col justify-between py-0.5 text-right text-[0.6875rem] tabular-nums text-muted-foreground">
        <span>{compact(ceiling)}</span>
        <span>{compact(ceiling / 2)}</span>
        <span>0</span>
      </div>

      <div className="min-w-0 flex-1">
        <div className="relative h-40">
          {/* Grade: três hairlines sólidas, um passo abaixo da superfície. */}
          {[0, 0.5, 1].map((position) => (
            <span
              key={position}
              aria-hidden
              className="absolute inset-x-0 h-px bg-border"
              style={{ top: `${position * 100}%` }}
            />
          ))}

          <ul className="absolute inset-0 flex items-end justify-between gap-1">
            {data.map((point, index) => {
              const height = ceiling > 0 ? (point.cents / ceiling) * 100 : 0;
              const isLast = index === lastIndex;
              return (
                <li key={point.month} className="flex h-full min-w-0 flex-1 items-end justify-center">
                  <button
                    type="button"
                    // A área de toque é a coluna inteira, não só a barra
                    // pintada: mês zerado também precisa ser alcançável.
                    className="group relative flex h-full w-full max-w-6 cursor-default items-end justify-center rounded-t-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    onPointerEnter={() => setHovered(index)}
                    onPointerLeave={() => setHovered(null)}
                    onFocus={() => setHovered(index)}
                    onBlur={() => setHovered(null)}
                    aria-label={`${formatMonthShort(point.month)}: ${formatPriceCents(point.cents)} em ${point.count} fatura${point.count === 1 ? "" : "s"}`}
                  >
                    <span
                      aria-hidden
                      className={cn(
                        "w-full rounded-t-[4px] transition-opacity",
                        hovered !== null && hovered !== index && "opacity-60"
                      )}
                      style={{
                        height: `${Math.max(height, point.cents > 0 ? 1.5 : 0)}%`,
                        backgroundColor: "var(--chart-1)",
                      }}
                    />
                  </button>

                  {/* Rótulo direto só no mês corrente: número em toda coluna
                      vira ruído e ninguém lê (o resto está no eixo, no hover
                      e na tabela). */}
                  {isLast && point.cents > 0 && (
                    <span className="pointer-events-none absolute -translate-y-[calc(100%+0.5rem)] text-[0.6875rem] font-medium tabular-nums text-foreground">
                      {compact(point.cents)}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>

          {hovered !== null && (
            <div
              className="pointer-events-none absolute -top-2 z-10 -translate-x-1/2 -translate-y-full rounded-md bg-foreground px-2 py-1 text-xs whitespace-nowrap text-background shadow-md"
              style={{ left: `${((hovered + 0.5) / data.length) * 100}%` }}
            >
              <p className="font-semibold tabular-nums">{formatPriceCents(data[hovered].cents)}</p>
              <p className="opacity-70">
                {formatMonthShort(data[hovered].month)} · {data[hovered].count} fatura
                {data[hovered].count === 1 ? "" : "s"}
              </p>
            </div>
          )}
        </div>

        <div className="mt-1.5 flex justify-between gap-1">
          {data.map((point, index) => (
            <span
              key={point.month}
              className={cn(
                "min-w-0 flex-1 truncate text-center text-[0.625rem]",
                index === lastIndex ? "font-medium text-foreground" : "text-muted-foreground"
              )}
            >
              {formatMonthShort(point.month)}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Teto "redondo" logo acima do maior valor, para o eixo ter tique legível. */
function niceCeiling(cents: number): number {
  if (cents <= 0) return 100_00;
  const magnitude = 10 ** Math.floor(Math.log10(cents));
  return Math.ceil(cents / magnitude) * magnitude;
}

function compact(cents: number): string {
  return new Intl.NumberFormat("pt-BR", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(cents / 100);
}
