import { cn } from "@/lib/utils";

export interface CategoryBar {
  key: string;
  label: string;
  /** Valor bruto, usado para o comprimento da barra. */
  value: number;
  /** Valor já formatado (moeda, contagem) — é ele que vira rótulo direto. */
  formatted: string;
  /** Cor da barra. Segue a categoria, nunca a posição no ranking. */
  color?: string;
  meta?: string;
}

/**
 * Barras horizontais para poucas categorias (método de pagamento, faixa de
 * atraso, status de assinatura).
 *
 * Por que barra e não rosca: rosca só funciona para "parte do todo à primeira
 * vista" e falha justamente quando dois pedaços são parecidos — que é o caso
 * interessante (Pix empatando com cartão). Barra ordenada resolve os dois.
 *
 * Cada barra carrega o valor no final, então o dado não depende de hover nem
 * de legenda: o rótulo da categoria fica à esquerda, o número à direita, e a
 * cor é só reforço de identidade.
 */
export function CategoryBars({
  bars,
  emptyLabel = "Sem dados no período.",
  className,
}: {
  bars: CategoryBar[];
  emptyLabel?: string;
  className?: string;
}) {
  const max = Math.max(...bars.map((b) => b.value), 0);
  const total = bars.reduce((sum, b) => sum + b.value, 0);

  if (total <= 0) {
    return <p className="text-sm text-muted-foreground">{emptyLabel}</p>;
  }

  return (
    <ul className={cn("flex flex-col gap-2.5", className)}>
      {bars.map((bar) => {
        const share = total > 0 ? bar.value / total : 0;
        return (
          <li key={bar.key} className="flex flex-col gap-1">
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="flex min-w-0 items-center gap-2">
                <span
                  className="size-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: bar.color ?? "var(--chart-1)" }}
                  aria-hidden
                />
                <span className="truncate text-foreground">{bar.label}</span>
              </span>
              <span className="shrink-0 tabular-nums text-foreground">
                {bar.formatted}
                <span className="ml-1.5 text-xs text-muted-foreground">
                  {(share * 100).toFixed(0)}%
                </span>
              </span>
            </div>
            {/* Trilha em `muted` e barra fina: a barra é a única tinta forte. */}
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${max > 0 ? Math.max((bar.value / max) * 100, 1) : 0}%`,
                  backgroundColor: bar.color ?? "var(--chart-1)",
                }}
              />
            </div>
            {bar.meta && <p className="text-xs text-muted-foreground">{bar.meta}</p>}
          </li>
        );
      })}
    </ul>
  );
}
