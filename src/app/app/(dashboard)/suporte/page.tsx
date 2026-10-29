import Link from "next/link";
import { ChevronRight, LifeBuoy } from "lucide-react";
import { getMyStudio } from "@/lib/data/studios";
import { isSupportSchemaReady, listStudioTickets } from "@/lib/data/support";
import { NewTicketDialog } from "@/components/support/new-ticket-dialog";
import { MigrationNotice } from "@/components/superadmin/migration-notice";
import { CATEGORY_LABEL, STATUS_CLASS, STATUS_LABEL, hasUnread, relativeTime, turnLabel } from "@/lib/support";
import { cn } from "@/lib/utils";

export const metadata = { title: "Suporte — Timely" };

/**
 * Chamados do estúdio. Só os dele: a leitura passa pela RLS (ver
 * `listStudioTickets`). Abertos em cima, resolvidos embaixo.
 */
export default async function SuportePage() {
  const studio = await getMyStudio();
  if (!studio) return null;

  const ready = await isSupportSchemaReady();
  const tickets = ready ? await listStudioTickets(studio.id) : [];
  const pendentes = tickets.filter((t) => t.status !== "resolvido");
  const resolvidos = tickets.filter((t) => t.status === "resolvido");

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-5">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold text-foreground">Suporte</h1>
          <p className="text-sm text-muted-foreground">
            Algo deu errado ou ficou com dúvida? Abra um chamado e acompanhe a resposta por aqui.
          </p>
        </div>
        {ready && <NewTicketDialog />}
      </header>

      {!ready ? (
        <MigrationNotice migration="0028_support_tickets.sql" feature="Os chamados" />
      ) : tickets.length === 0 ? (
        <div className="panel flex flex-col items-center gap-3 border-dashed p-10 text-center">
          <LifeBuoy className="size-6 text-muted-foreground" aria-hidden />
          <div className="space-y-1">
            <p className="font-medium text-foreground">Nenhum chamado por enquanto</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              Quando abrir um, ele aparece aqui com a situação e as respostas da equipe.
            </p>
          </div>
        </div>
      ) : (
        <>
          <TicketList title="Em aberto" tickets={pendentes} empty="Nada em aberto." />
          {resolvidos.length > 0 && <TicketList title="Resolvidos" tickets={resolvidos} />}
        </>
      )}
    </div>
  );
}

function TicketList({
  title,
  tickets,
  empty,
}: {
  title: string;
  tickets: Awaited<ReturnType<typeof listStudioTickets>>;
  empty?: string;
}) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="section-label text-muted-foreground">
        {title} · {tickets.length}
      </h2>
      {tickets.length === 0 ? (
        <p className="text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul className="panel divide-y divide-border overflow-hidden">
          {tickets.map((ticket) => {
            const unread = hasUnread(ticket, "cliente");
            const turn = turnLabel(ticket, "cliente");
            return (
              <li key={ticket.id}>
                <Link
                  href={`/app/suporte/${ticket.id}`}
                  className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/50"
                >
                  <span
                    aria-hidden
                    className={cn("size-2 shrink-0 rounded-full", unread ? "bg-primary" : "bg-transparent")}
                  />
                  <div className="min-w-0 flex-1">
                    <p className={cn("truncate text-sm text-foreground", unread && "font-semibold")}>
                      {ticket.subject}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      #{ticket.number} · {CATEGORY_LABEL[ticket.category]} · {relativeTime(ticket.last_message_at)}
                      {turn && ` · ${turn}`}
                      {unread && <span className="sr-only"> · nova resposta</span>}
                    </p>
                  </div>
                  <span
                    className={cn(
                      "shrink-0 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium",
                      STATUS_CLASS[ticket.status]
                    )}
                  >
                    {STATUS_LABEL[ticket.status]}
                  </span>
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
