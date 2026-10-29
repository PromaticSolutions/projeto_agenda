import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getMyStudio } from "@/lib/data/studios";
import { getStudioTicket, markTicketSeen } from "@/lib/data/support";
import { TicketThread } from "@/components/support/ticket-thread";
import { TicketReplyForm } from "@/components/support/ticket-reply-form";
import { ResolveTicketButton } from "@/components/support/resolve-ticket-button";
import { replyTicketAction } from "@/app/app/(dashboard)/suporte/actions";
import { CATEGORY_LABEL, STATUS_CLASS, STATUS_LABEL, turnLabel } from "@/lib/support";
import { formatDateLocal } from "@/lib/format";
import { cn } from "@/lib/utils";

interface TicketPageProps {
  params: Promise<{ id: string }>;
}

export const metadata = { title: "Chamado — Timely" };

export default async function SuporteTicketPage({ params }: TicketPageProps) {
  const { id } = await params;
  const studio = await getMyStudio();
  if (!studio) return null;

  // Chamado de outro estúdio cai aqui como "não existe": a RLS nem devolve.
  const data = await getStudioTicket(studio.id, id);
  if (!data) notFound();
  const { ticket, messages } = data;
  await markTicketSeen(ticket.id, "cliente", studio.id);

  const resolved = ticket.status === "resolvido";
  const turn = turnLabel(ticket, "cliente");

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <Link
        href="/app/suporte"
        className="flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Todos os chamados
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-5">
        <div className="min-w-0 space-y-1">
          <p className="text-xs text-muted-foreground">
            #{ticket.number} · {CATEGORY_LABEL[ticket.category]} · aberto em {formatDateLocal(new Date(ticket.created_at))}
          </p>
          <h1 className="text-xl font-semibold break-words text-foreground">{ticket.subject}</h1>
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-medium", STATUS_CLASS[ticket.status])}>
              {STATUS_LABEL[ticket.status]}
            </span>
            {turn && <span className="text-xs text-muted-foreground">{turn}</span>}
          </div>
        </div>
        {!resolved && <ResolveTicketButton ticketId={ticket.id} />}
      </header>

      <TicketThread messages={messages} viewer="cliente" studioName={studio.name} />

      <TicketReplyForm
        ticketId={ticket.id}
        send={replyTicketAction}
        placeholder={resolved ? "Voltou a acontecer? Escreva aqui para reabrir." : "Escreva uma resposta"}
        hint={resolved ? "Responder reabre o chamado." : "Ctrl + Enter envia"}
      />
    </div>
  );
}
