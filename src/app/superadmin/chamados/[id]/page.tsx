import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getTicketAdmin, markTicketSeen } from "@/lib/data/support";
import { getOwnerAccount } from "@/lib/data/platformAccounts";
import { TicketThread } from "@/components/support/ticket-thread";
import { TicketReplyForm } from "@/components/support/ticket-reply-form";
import { TicketStatusControl } from "@/components/support/ticket-status-control";
import { replyAsSupportAction } from "@/app/superadmin/chamados/actions";
import { CATEGORY_LABEL } from "@/lib/support";
import { formatDateLocal, formatTimeLocal } from "@/lib/format";

interface TicketAdminPageProps {
  params: Promise<{ id: string }>;
}

export const metadata = { title: "Chamado — Timely Admin" };

export default async function SuperAdminTicketPage({ params }: TicketAdminPageProps) {
  const { id } = await params;
  const data = await getTicketAdmin(id);
  if (!data) notFound();
  const { ticket, messages, studio } = data;

  const [account] = await Promise.all([
    ticket.opened_by ? getOwnerAccount(ticket.opened_by) : null,
    markTicketSeen(ticket.id, "suporte"),
  ]);
  const opened = new Date(ticket.created_at);

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <Link
        href="/superadmin/chamados"
        className="flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Todos os chamados
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-5">
        <div className="min-w-0 space-y-1">
          <p className="text-xs text-muted-foreground">
            #{ticket.number} · {CATEGORY_LABEL[ticket.category]} · aberto em {formatDateLocal(opened)},{" "}
            {formatTimeLocal(opened)}
          </p>
          <h1 className="text-xl font-semibold break-words text-foreground">{ticket.subject}</h1>
          {studio && (
            <p className="text-sm text-muted-foreground">
              <Link href={`/superadmin/studios/${studio.id}`} className="font-medium text-foreground hover:underline">
                {studio.name}
              </Link>{" "}
              · /{studio.slug}
              {account?.email && ` · ${account.email}`}
            </p>
          )}
        </div>
        <TicketStatusControl ticketId={ticket.id} status={ticket.status} />
      </header>

      <TicketThread messages={messages} viewer="suporte" studioName={studio?.name ?? "Cliente"} />

      <TicketReplyForm
        ticketId={ticket.id}
        send={replyAsSupportAction}
        allowResolve
        placeholder="Responder ao cliente"
        hint="O cliente vê a resposta em Suporte, no painel dele."
      />
    </div>
  );
}
