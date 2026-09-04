import Link from "next/link";
import { ChevronRight, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  PLAN_INTERVAL_LABELS,
  SUBSCRIPTION_STATUS_DOT,
  SUBSCRIPTION_STATUS_LABELS,
  formatPercent,
} from "@/lib/billing";
import { formatDateLocal, formatPriceCents, getStudioPublicUrl } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { PlanInterval, SubscriptionStatus } from "@/lib/types";
import type { StudioListRow } from "@/lib/data/superadminRows";

export function StudiosTable({ studios }: { studios: StudioListRow[] }) {
  if (studios.length === 0) {
    return (
      <p className="panel border-dashed p-8 text-center text-sm text-muted-foreground">
        Nenhum cliente com esses filtros.
      </p>
    );
  }

  return (
    <div className="panel overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[64rem] text-left text-sm">
          <thead>
            <tr className="border-b border-border text-xs text-muted-foreground">
              <th className="px-4 py-2.5 font-medium">Cliente</th>
              <th className="px-4 py-2.5 font-medium">Assinatura</th>
              <th className="px-4 py-2.5 font-medium text-right">MRR</th>
              <th className="px-4 py-2.5 font-medium text-right">Pago</th>
              <th className="px-4 py-2.5 font-medium text-right">Agend. 30d</th>
              <th className="px-4 py-2.5 font-medium text-right">Clientes</th>
              <th className="px-4 py-2.5 font-medium text-right">Volume 30d</th>
              <th className="px-4 py-2.5 font-medium">Última agenda</th>
              <th className="px-4 py-2.5 font-medium">Situação</th>
              <th className="px-4 py-2.5" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {studios.map((studio) => (
              <tr key={studio.id} className="transition-colors hover:bg-muted/50 focus-within:bg-muted/50">
                <td className="px-4 py-2.5">
                  <Link href={`/superadmin/studios/${studio.id}`} className="block outline-none">
                    <p className="font-medium text-foreground">{studio.name}</p>
                    <p className="text-xs text-muted-foreground">
                      /{studio.slug}
                      {studio.ownerName && ` · ${studio.ownerName}`}
                    </p>
                  </Link>
                </td>

                <td className="px-4 py-2.5">
                  <SubscriptionCell
                    status={studio.subscriptionStatus}
                    planName={studio.planName}
                    interval={studio.planInterval}
                  />
                </td>

                <td className="px-4 py-2.5 text-right tabular-nums text-foreground">
                  {studio.monthlyCents > 0 ? formatPriceCents(studio.monthlyCents) : "—"}
                </td>

                <td className="px-4 py-2.5 text-right tabular-nums">
                  <span className="text-foreground">{formatPriceCents(studio.lifetimeCents)}</span>
                  {studio.overdueCents > 0 && (
                    <span className="block text-xs font-medium text-destructive">
                      {formatPriceCents(studio.overdueCents)} em atraso
                    </span>
                  )}
                </td>

                <td className="px-4 py-2.5 text-right tabular-nums">
                  <span className="font-medium text-foreground">{studio.bookingsLast30d}</span>
                  {studio.cancellationRate30d > 0 && (
                    <span className="block text-xs text-muted-foreground">
                      {formatPercent(studio.cancellationRate30d, 0)} cancel.
                    </span>
                  )}
                </td>

                <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">
                  {studio.clientsCount}
                </td>

                <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">
                  {formatPriceCents(studio.attendedVolume30dCents)}
                </td>

                <td className="px-4 py-2.5 text-muted-foreground">
                  {studio.lastBookingAt ? formatDateLocal(new Date(studio.lastBookingAt)) : "nunca"}
                </td>

                <td className="px-4 py-2.5">
                  <SituationBadge studio={studio} />
                </td>

                <td className="px-4 py-2.5">
                  <div className="flex items-center justify-end gap-1">
                    <Link
                      href={getStudioPublicUrl(studio.slug)}
                      target="_blank"
                      rel="noreferrer"
                      title="Abrir página pública"
                      className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    >
                      <ExternalLink className="size-3.5" />
                      <span className="sr-only">Página pública de {studio.name}</span>
                    </Link>
                    <Link
                      href={`/superadmin/studios/${studio.id}`}
                      title="Abrir ficha"
                      className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    >
                      <ChevronRight className="size-4" />
                      <span className="sr-only">Ficha de {studio.name}</span>
                    </Link>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SubscriptionCell({
  status,
  planName,
  interval,
}: {
  status: SubscriptionStatus | null;
  planName: string | null;
  interval: PlanInterval;
}) {
  if (!status) {
    return <span className="text-xs text-muted-foreground">sem assinatura</span>;
  }
  return (
    <div className="flex flex-col gap-0.5">
      <span className="flex items-center gap-1.5 text-foreground">
        <span className={cn("size-2 rounded-full", SUBSCRIPTION_STATUS_DOT[status])} aria-hidden />
        {SUBSCRIPTION_STATUS_LABELS[status]}
      </span>
      {planName && (
        <span className="text-xs text-muted-foreground">
          {planName}
          {interval === "anual" && ` ${PLAN_INTERVAL_LABELS.anual}`}
        </span>
      )}
    </div>
  );
}

/**
 * Uma etiqueta só, na ordem em que o problema importa: atraso de pagamento
 * antes de abandono de uso, abandono antes de "é novo". Empilhar três
 * etiquetas na mesma célula deixaria a coluna ilegível justamente nas linhas
 * que precisam de atenção.
 */
function SituationBadge({ studio }: { studio: StudioListRow }) {
  if (studio.overdueCents > 0) {
    return <Badge variant="destructive">Em atraso</Badge>;
  }
  if (studio.isAtRisk) {
    return <Badge variant="destructive">Sem agenda 14d+</Badge>;
  }
  if (studio.isNew) {
    return <Badge>Novo</Badge>;
  }
  if (studio.bookingsLast7d > 0) {
    return <Badge variant="secondary">Em uso</Badge>;
  }
  return <Badge variant="outline">Ativo</Badge>;
}
