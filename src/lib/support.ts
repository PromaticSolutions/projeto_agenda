import type {
  SupportAuthor,
  SupportTicket,
  SupportTicketCategory,
  SupportTicketStatus,
} from "@/lib/types";

/**
 * Regras dos chamados que valem dos dois lados — painel do estúdio e
 * /superadmin. Sem acesso a banco: roda no servidor e no navegador.
 */

export type SupportWriteResult = { ok: true; id: string } | { ok: false; error: string };

export const SUBJECT_MIN = 3;
export const SUBJECT_MAX = 120;
export const BODY_MAX = 5000;

export const CATEGORY_ORDER: SupportTicketCategory[] = ["problema", "duvida", "financeiro", "sugestao"];

export const CATEGORY_LABEL: Record<SupportTicketCategory, string> = {
  problema: "Algo não funciona",
  duvida: "Dúvida",
  financeiro: "Pagamento ou assinatura",
  sugestao: "Sugestão",
};

export const STATUS_LABEL: Record<SupportTicketStatus, string> = {
  aberto: "Aberto",
  em_andamento: "Em andamento",
  resolvido: "Resolvido",
};

export const STATUS_CLASS: Record<SupportTicketStatus, string> = {
  aberto: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  em_andamento: "bg-primary/10 text-primary",
  resolvido: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
};

type UnreadFields = Pick<SupportTicket, "last_message_at" | "last_message_by" | "client_seen_at" | "support_seen_at">;

/**
 * Tem mensagem do outro lado que `viewer` ainda não abriu? Quem escreve marca
 * o próprio `seen_at` com o mesmo instante da mensagem, então a própria
 * resposta nunca acende o aviso.
 */
export function hasUnread(ticket: UnreadFields, viewer: SupportAuthor): boolean {
  if (ticket.last_message_by === viewer) return false;
  const seen = viewer === "cliente" ? ticket.client_seen_at : ticket.support_seen_at;
  return !seen || new Date(ticket.last_message_at) > new Date(seen);
}

/** "Com quem está a vez" — a frase curta que acompanha o status na lista. */
export function turnLabel(
  ticket: Pick<SupportTicket, "status" | "last_message_by">,
  viewer: SupportAuthor
): string | null {
  if (ticket.status === "resolvido") return null;
  if (ticket.last_message_by === "cliente") {
    return viewer === "cliente" ? "Aguardando o suporte" : "Aguardando resposta";
  }
  return viewer === "cliente" ? "Respondido — sua vez" : "Aguardando o cliente";
}

/**
 * Status depois de uma nova mensagem. Cliente escrevendo num chamado
 * resolvido reabre; o suporte respondendo tira do "aberto" — alguém pegou.
 */
export function statusAfterMessage(current: SupportTicketStatus, author: SupportAuthor): SupportTicketStatus {
  if (author === "cliente") return current === "resolvido" ? "aberto" : current;
  return current === "aberto" ? "em_andamento" : current;
}

/** "agora", "há 5 min", "há 3 h", "há 2 dias". */
export function relativeTime(iso: string, now: Date = new Date()): string {
  const minutes = Math.floor((now.getTime() - new Date(iso).getTime()) / 60_000);
  if (minutes < 1) return "agora";
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `há ${hours} h`;
  const days = Math.floor(hours / 24);
  return `há ${days} ${days === 1 ? "dia" : "dias"}`;
}
