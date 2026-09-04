import type { LucideIcon } from "lucide-react";
import { ArrowDownRight, ArrowRight, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";

export interface KpiDelta {
  /** Variação relativa já calculada (0.12 = +12%). */
  rate: number;
  /** Com o que está comparando ("vs. mês anterior"). */
  against: string;
  /** Subir é bom? Em cancelamento e inadimplência, não é. */
  upIsGood?: boolean;
}

/**
 * Bloco de número do painel.
 *
 * Três decisões que vêm da skill de dataviz e valem para todos os tiles:
 * - o valor usa os dígitos proporcionais da fonte, não `tabular-nums`: número
 *   grande com dígito de largura fixa fica frouxo (só a coluna de tabela
 *   ganha com alinhamento vertical);
 * - a variação carrega seta + sinal além da cor, então quem não distingue
 *   verde de vermelho continua lendo a direção;
 * - `hint` existe para o número que é ESTIMATIVA ou PROJEÇÃO dizer isso na
 *   própria tela, em vez de passar por medição.
 */
export function KpiTile({
  label,
  value,
  sublabel,
  hint,
  delta,
  icon: Icon,
  tone = "neutral",
  className,
}: {
  label: string;
  value: string;
  sublabel?: string;
  hint?: string;
  delta?: KpiDelta;
  icon?: LucideIcon;
  tone?: "neutral" | "primary" | "positive" | "warning";
  className?: string;
}) {
  const toneRing = {
    neutral: "",
    primary: "ring-primary/25",
    positive: "ring-wa/30",
    warning: "ring-destructive/30",
  }[tone];

  return (
    <div className={cn("panel flex flex-col gap-2 p-4", toneRing && `ring-1 ${toneRing}`, className)}>
      <div className="flex items-start justify-between gap-2">
        <p className="section-label">{label}</p>
        {Icon && <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />}
      </div>

      <p className="text-2xl font-semibold text-foreground [font-variant-numeric:normal]">{value}</p>

      <div className="flex flex-col gap-1">
        {delta && <DeltaLine {...delta} />}
        {sublabel && <p className="text-xs text-muted-foreground">{sublabel}</p>}
        {hint && <p className="text-xs text-muted-foreground/80 italic">{hint}</p>}
      </div>
    </div>
  );
}

function DeltaLine({ rate, against, upIsGood = true }: KpiDelta) {
  const flat = Math.abs(rate) < 0.005;
  const up = rate > 0;
  const good = flat ? null : up === upIsGood;
  const Icon = flat ? ArrowRight : up ? ArrowUpRight : ArrowDownRight;

  return (
    <p
      className={cn(
        "flex items-center gap-1 text-xs font-medium",
        good === null && "text-muted-foreground",
        good === true && "text-wa",
        good === false && "text-destructive"
      )}
    >
      <Icon className="size-3.5" aria-hidden />
      <span>
        {flat ? "estável" : `${up ? "+" : "−"}${(Math.abs(rate) * 100).toFixed(1).replace(".", ",")}%`}
      </span>
      <span className="font-normal text-muted-foreground">{against}</span>
    </p>
  );
}
