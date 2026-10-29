import Link from "next/link";
import { ChevronRight, LifeBuoy } from "lucide-react";
import {
  countTicketsByStatus,
  isSupportSchemaReady,
  listAllTickets,
  type AdminTicketFilter,
} from "@/lib/data/support";
import { MigrationNotice } from "@/components/superadmin/migration-notice";
import { CATEGORY_LABEL, STATUS_CLASS, STATUS_LABEL, hasUnread, relativeTime, turnLabel } from "@/lib/support";
import { cn } from "@/lib/utils";

export const metadata = { title: "Chamados — Timely Admin" };

interface ChamadosPageProps {
  searchParams: Promise<{ ver?: string }>;
}

const FILTERS: { value: AdminTicketFilter; label: string }[] = [
  { value: "pendentes", label: "Pendentes" },
  { value: "resolvidos", label: "Resolvidos" },
  { value: "todos", label: "Todos" },
];

/**
 * Todos os chamados da plataforma, de todos os estúdios. Abre em
 * "Pendentes", com quem espera resposta da equipe no topo.
 */
export default async function SuperAdminTicketsPage({ searchParams }: ChamadosPageProps) {
  const { ver } = await searchParams;
  const filter: AdminTicketFilter = FILTERS.some((f) => f.value === ver) ? (ver as AdminTicketFilter) : "pendentes";

  const ready = await isSupportSchemaReady();
  const [tickets, counts] = ready
    ? await Promise.all([listAllTickets(filter), countTicketsByStatus()])
    : [[], null];

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5">
      <header className="space-y-1 border-b border-border pb-5">
        <h1 className="flex items-center gap-2 text-xl font-semibold text-foreground">
          <LifeBuoy className="size-5 text-primary" aria-hidden /> Chamados
        </h1>
        <p className="text-sm text-muted-foreground">
          O que os clientes abriram em Suporte, de todos os estúdios. Responda por aqui — a
          resposta aparece no painel do cliente.
        </p>
      </header>

      {!ready ? (
        <MigrationNotice migration="0028_support_tickets.sql" feature="Os chamados" />
      ) : (
        <>
          {counts && (
            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { label: "Esperando a equipe", value: counts.aguardando, strong: counts.aguardando > 0 },
                { label: "Abertos", value: counts.aberto },
                { label: "Em andamento", value: counts.em_andamento },
                { label: "Resolvidos", value: counts.resolvido },
              ].map((item) => (
                <div key={item.label} className="panel px-4 py-3">
                  <dt className="text-xs text-muted-foreground">{item.label}</dt>
                  <dd
                    className={cn(
                      "text-2xl font-semibold tabular-nums",
                      item.strong ? "text-amber-700 dark:text-amber-400" : "text-foreground"
                    )}
                  >
                    {item.value}
                  </dd>
                </div>
              ))}
            </dl>
          )}

          <nav aria-label="Filtrar chamados" className="flex gap-1">
            {FILTERS.map((f) => (
              <Link
                key={f.value}
                href={f.value === "pendentes" ? "/superadmin/chamados" : `/superadmin/chamados?ver=${f.value}`}
                aria-current={filter === f.value ? "page" : undefined}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm transition-colors",
                  filter === f.value
                    ? "bg-primary font-medium text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                {f.label}
              </Link>
            ))}
          </nav>

          {tickets.length === 0 ? (
            <p className="panel border-dashed p-10 text-center text-sm text-muted-foreground">
              {filter === "pendentes" ? "Nenhum chamado pendente. Tudo em dia." : "Nenhum chamado aqui."}
            </p>
          ) : (
            <div className="panel overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[52rem] text-left text-sm">
                  <thead>
                    <tr className="border-b border-border text-xs text-muted-foreground">
                      <th className="px-4 py-2.5 font-medium">Chamado</th>
                      <th className="px-4 py-2.5 font-medium">Cliente</th>
                      <th className="px-4 py-2.5 font-medium">Tipo</th>
                      <th className="px-4 py-2.5 font-medium">Situação</th>
                      <th className="px-4 py-2.5 font-medium">Última mensagem</th>
                      <th className="px-4 py-2.5" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {tickets.map((ticket) => {
                      const href = `/superadmin/chamados/${ticket.id}`;
                      const unread = hasUnread(ticket, "suporte");
                      const turn = turnLabel(ticket, "suporte");
                      return (
                        <tr key={ticket.id} className="transition-colors hover:bg-muted/50">
                          <td className="max-w-80 px-4 py-2.5">
                            <Link href={href} className="flex items-center gap-2">
                              <span
                                aria-hidden
                                className={cn("size-2 shrink-0 rounded-full", unread ? "bg-primary" : "bg-transparent")}
                              />
                              <span className="min-w-0">
                                <span className={cn("block truncate text-foreground", unread && "font-semibold")}>
                                  {ticket.subject}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  #{ticket.number}
                                  {unread && " · nova mensagem"}
                                </span>
                              </span>
                            </Link>
                          </td>
                          <td className="px-4 py-2.5">
                            {ticket.studio ? (
                              <Link href={`/superadmin/studios/${ticket.studio.id}`} className="hover:underline">
                                <span className="block text-foreground">{ticket.studio.name}</span>
                                <span className="text-xs text-muted-foreground">/{ticket.studio.slug}</span>
                              </Link>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="px-4 py-2.5 text-muted-foreground">{CATEGORY_LABEL[ticket.category]}</td>
                          <td className="px-4 py-2.5">
                            <span
                              className={cn(
                                "whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium",
                                STATUS_CLASS[ticket.status]
                              )}
                            >
                              {STATUS_LABEL[ticket.status]}
                            </span>
                            {turn && <span className="mt-1 block text-[11px] text-muted-foreground">{turn}</span>}
                          </td>
                          <td className="whitespace-nowrap px-4 py-2.5 text-muted-foreground">
                            {relativeTime(ticket.last_message_at)}
                          </td>
                          <td className="px-4 py-2.5 text-right">
                            <Link
                              href={href}
                              title="Abrir"
                              className="inline-flex rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                            >
                              <ChevronRight className="size-4" />
                              <span className="sr-only">Abrir o chamado #{ticket.number}</span>
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
