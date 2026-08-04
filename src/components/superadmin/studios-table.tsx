import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatDateLocal, getStudioPublicUrl } from "@/lib/format";
import type { StudioActivityRow } from "@/lib/data/platformMetrics";

function StatusBadge({ studio }: { studio: StudioActivityRow }) {
  if (studio.isAtRisk) {
    return (
      <Badge variant="destructive" className="shrink-0">
        Inativo 14d+
      </Badge>
    );
  }
  if (studio.isNew) {
    return (
      <Badge className="shrink-0 bg-violet-600 text-white">
        Novo
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" className="shrink-0">
      Ativo
    </Badge>
  );
}

export function StudiosTable({ studios }: { studios: StudioActivityRow[] }) {
  if (studios.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-plum-900/15 p-8 text-center text-muted-foreground">
        Nenhum estúdio cadastrado ainda.
      </p>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl bg-card shadow-sm ring-1 ring-plum-900/5">
      <div className="overflow-x-auto">
        <table className="w-full min-w-180 text-left text-sm">
          <thead>
            <tr className="border-b border-border/70 text-xs text-muted-foreground uppercase">
              <th className="px-4 py-3 font-semibold sm:px-6">Estúdio</th>
              <th className="px-4 py-3 font-semibold">Criado em</th>
              <th className="px-4 py-3 font-semibold">Agend. (30d)</th>
              <th className="px-4 py-3 font-semibold">Total</th>
              <th className="px-4 py-3 font-semibold">Último agendamento</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 font-semibold sm:px-6" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border/70">
            {studios.map((studio) => (
              <tr key={studio.id} className="transition-colors hover:bg-muted/40">
                <td className="px-4 py-3 sm:px-6">
                  <p className="font-medium text-plum-900">{studio.name}</p>
                  <p className="text-xs text-muted-foreground">/{studio.slug}</p>
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {formatDateLocal(new Date(studio.createdAt))}
                </td>
                <td className="px-4 py-3 font-medium tabular-nums text-plum-900">{studio.bookingsLast30d}</td>
                <td className="px-4 py-3 tabular-nums text-muted-foreground">{studio.totalBookings}</td>
                <td className="px-4 py-3 text-muted-foreground">
                  {studio.lastBookingAt ? formatDateLocal(new Date(studio.lastBookingAt)) : "—"}
                </td>
                <td className="px-4 py-3">
                  <StatusBadge studio={studio} />
                </td>
                <td className="px-4 py-3 sm:px-6">
                  <Link
                    href={getStudioPublicUrl(studio.slug)}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1 text-xs font-medium text-violet-600 hover:text-violet-800"
                  >
                    Ver página <ExternalLink className="size-3" />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
