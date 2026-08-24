import Link from "next/link";
import {
  INVOICE_STATUS_DOT,
  INVOICE_STATUS_LABELS,
  PAYMENT_METHOD_LABELS,
  PAYMENT_STATUS_LABELS,
  daysOverdue,
} from "@/lib/billing";
import { formatFullDateLocal, formatPriceCents } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { InvoiceRow } from "@/lib/data/billing";

/**
 * Tabela de faturas, usada nas duas telas que mostram fatura: o faturamento
 * (todos os clientes) e a ficha de um cliente (`showStudio={false}`, porque
 * repetir o nome do estúdio em toda linha da própria ficha dele é ruído).
 *
 * A coluna de situação mostra o status EFETIVO, não o que está gravado: fatura
 * aberta que passou do vencimento aparece como vencida com os dias de atraso.
 * O contrário — confiar na coluna do banco — faria o painel dizer "em dia"
 * porque nenhuma rotina passou para atualizar a linha.
 */
export function InvoicesTable({
  rows,
  showStudio = true,
  emptyLabel = "Nenhuma fatura encontrada.",
  today,
}: {
  rows: InvoiceRow[];
  showStudio?: boolean;
  emptyLabel?: string;
  /** "YYYY-MM-DD" no fuso do negócio, vindo do servidor. */
  today: string;
}) {
  if (rows.length === 0) {
    return (
      <p className="panel border-dashed p-8 text-center text-sm text-muted-foreground">{emptyLabel}</p>
    );
  }

  return (
    <div className="panel overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[52rem] text-left text-sm">
          <thead>
            <tr className="border-b border-border text-xs text-muted-foreground">
              <th className="px-4 py-2.5 font-medium">Fatura</th>
              {showStudio && <th className="px-4 py-2.5 font-medium">Cliente</th>}
              <th className="px-4 py-2.5 font-medium">Competência</th>
              <th className="px-4 py-2.5 font-medium">Vencimento</th>
              <th className="px-4 py-2.5 font-medium text-right">Valor</th>
              <th className="px-4 py-2.5 font-medium">Situação</th>
              <th className="px-4 py-2.5 font-medium">Pagamento</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map(({ invoice, studioName, studioSlug, effectiveStatus, payments }) => {
              const late = effectiveStatus === "vencida" ? daysOverdue(invoice.due_date, today) : 0;
              const lastPayment = payments[0];
              return (
                <tr key={invoice.id} className="transition-colors hover:bg-muted/50">
                  <td className="px-4 py-2.5">
                    <p className="font-medium tabular-nums text-foreground">#{invoice.seq}</p>
                    <p className="text-xs text-muted-foreground">
                      emitida {formatFullDateLocal(new Date(invoice.issued_at))}
                    </p>
                  </td>

                  {showStudio && (
                    <td className="px-4 py-2.5">
                      {studioSlug ? (
                        <Link
                          href={`/superadmin/studios?q=${encodeURIComponent(studioSlug)}`}
                          className="text-foreground hover:text-primary"
                        >
                          {studioName}
                        </Link>
                      ) : (
                        <span className="text-muted-foreground">{studioName}</span>
                      )}
                    </td>
                  )}

                  <td className="px-4 py-2.5 text-muted-foreground">
                    {invoice.period_start && invoice.period_end
                      ? `${formatFullDateLocal(new Date(`${invoice.period_start}T12:00:00Z`))} a ${formatFullDateLocal(new Date(`${invoice.period_end}T12:00:00Z`))}`
                      : (invoice.description ?? "—")}
                  </td>

                  <td className="px-4 py-2.5 text-muted-foreground">
                    {formatFullDateLocal(new Date(`${invoice.due_date}T12:00:00Z`))}
                  </td>

                  <td className="px-4 py-2.5 text-right tabular-nums">
                    <span className="text-foreground">{formatPriceCents(invoice.total_cents)}</span>
                    {invoice.discount_cents > 0 && (
                      <span className="block text-xs text-muted-foreground">
                        {formatPriceCents(invoice.discount_cents)} de desconto
                      </span>
                    )}
                  </td>

                  <td className="px-4 py-2.5">
                    <span className="flex items-center gap-1.5 text-foreground">
                      <span
                        className={cn("size-2 rounded-full", INVOICE_STATUS_DOT[effectiveStatus])}
                        aria-hidden
                      />
                      {INVOICE_STATUS_LABELS[effectiveStatus]}
                    </span>
                    {late > 0 && (
                      <span className="text-xs font-medium text-destructive">
                        {late} {late === 1 ? "dia" : "dias"} de atraso
                      </span>
                    )}
                  </td>

                  <td className="px-4 py-2.5">
                    {lastPayment ? (
                      <>
                        <p className="text-foreground">{PAYMENT_METHOD_LABELS[lastPayment.method]}</p>
                        <p className="text-xs text-muted-foreground">
                          {PAYMENT_STATUS_LABELS[lastPayment.status]}
                          {lastPayment.installments > 1 && ` · ${lastPayment.installments}x`}
                          {lastPayment.card_last4 && ` · ••••${lastPayment.card_last4}`}
                        </p>
                        {lastPayment.failure_reason && (
                          <p className="text-xs text-destructive">{lastPayment.failure_reason}</p>
                        )}
                      </>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        {payments.length === 0 ? "sem tentativa" : "—"}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
