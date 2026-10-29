import "server-only";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/service";
import { isSupabaseServiceConfigured } from "@/lib/supabase/env";
import { isMissingTableError } from "@/lib/supabase/errors";
import { statusAfterMessage, type SupportWriteResult } from "@/lib/support";
import type {
  SupportAuthor,
  SupportTicket,
  SupportTicketCategory,
  SupportTicketMessage,
  SupportTicketStatus,
} from "@/lib/types";

/**
 * Chamados de suporte (0028_support_tickets.sql).
 *
 * Dois caminhos de leitura, de propósito:
 * - painel do estúdio: client da SESSÃO, então quem filtra o tenant é a RLS
 *   do banco — um bug aqui não mostra chamado de outro estúdio;
 * - /superadmin: service role, que vê todos.
 *
 * Toda escrita é pela service role, com o estúdio resolvido pela sessão em
 * quem chama. Quando a escrita vem do estúdio, o `studioId` entra no filtro
 * da própria consulta: um id de chamado vindo do formulário não alcança
 * chamado de outra conta.
 */

export interface TicketWithMessages {
  ticket: SupportTicket;
  messages: SupportTicketMessage[];
}

export interface AdminTicketRow extends SupportTicket {
  studio: { id: string; name: string; slug: string } | null;
}

export type { SupportWriteResult };

const SEM_BANCO = "Banco não configurado.";
// Id de chamado vem da URL e do formulário: lixo vira "não encontrado" aqui,
// em vez de erro de sintaxe de uuid no Postgres.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function isSupportSchemaReady(): Promise<boolean> {
  if (!isSupabaseServiceConfigured) return false;
  const supabase = createServiceRoleSupabaseClient();
  const { error } = await supabase.from("support_tickets").select("id").limit(1);
  if (error && isMissingTableError(error)) return false;
  if (error) throw error;
  return true;
}

// ---------------------------------------------------------------------------
// Painel do estúdio
// ---------------------------------------------------------------------------

/** Chamados do estúdio logado, o mais movimentado primeiro. */
export async function listStudioTickets(studioId: string): Promise<SupportTicket[]> {
  if (!isSupabaseServiceConfigured) return [];
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("support_tickets")
    .select("*")
    .eq("studio_id", studioId)
    .order("last_message_at", { ascending: false })
    .limit(200);
  if (error) throw error;
  return data ?? [];
}

export async function getStudioTicket(studioId: string, ticketId: string): Promise<TicketWithMessages | null> {
  if (!isSupabaseServiceConfigured || !UUID_RE.test(ticketId)) return null;
  const supabase = await createServerSupabaseClient();
  const { data: ticket, error } = await supabase
    .from("support_tickets")
    .select("*")
    .eq("id", ticketId)
    .eq("studio_id", studioId)
    .maybeSingle();
  if (error) throw error;
  if (!ticket) return null;
  return { ticket, messages: await listMessages(supabase, ticket.id) };
}

export async function createTicket(input: {
  studioId: string;
  userId: string;
  subject: string;
  category: SupportTicketCategory;
  body: string;
}): Promise<SupportWriteResult> {
  if (!isSupabaseServiceConfigured) return { ok: false, error: SEM_BANCO };

  const supabase = createServiceRoleSupabaseClient();
  const now = new Date().toISOString();
  const { data: ticket, error } = await supabase
    .from("support_tickets")
    .insert({
      studio_id: input.studioId,
      opened_by: input.userId,
      subject: input.subject,
      category: input.category,
      last_message_at: now,
      last_message_by: "cliente",
      client_seen_at: now,
    })
    .select("id")
    .single();
  if (error) {
    console.error("[support/create]", error);
    return { ok: false, error: "Não deu para abrir o chamado. Tente de novo." };
  }

  const { error: messageError } = await supabase.from("support_ticket_messages").insert({
    ticket_id: ticket.id,
    studio_id: input.studioId,
    author: "cliente",
    author_id: input.userId,
    body: input.body,
    created_at: now,
  });
  if (messageError) {
    // Chamado sem a descrição não serve para ninguém: desfaz.
    await supabase.from("support_tickets").delete().eq("id", ticket.id);
    console.error("[support/create-message]", messageError);
    return { ok: false, error: "Não deu para abrir o chamado. Tente de novo." };
  }
  return { ok: true, id: ticket.id };
}

// ---------------------------------------------------------------------------
// Escrita comum aos dois lados
// ---------------------------------------------------------------------------

/**
 * Nova mensagem num chamado. `studioId` é obrigatório quando quem escreve é o
 * estúdio — é ele que amarra o chamado à conta logada.
 */
export async function addTicketMessage(input: {
  ticketId: string;
  author: SupportAuthor;
  authorId: string;
  body: string;
  studioId?: string;
  /** Só o suporte: responde e já marca como resolvido. */
  resolve?: boolean;
}): Promise<SupportWriteResult> {
  if (!isSupabaseServiceConfigured) return { ok: false, error: SEM_BANCO };
  if (!UUID_RE.test(input.ticketId) || (input.author === "cliente" && !input.studioId)) {
    return { ok: false, error: "Chamado não encontrado." };
  }

  const supabase = createServiceRoleSupabaseClient();
  let query = supabase.from("support_tickets").select("id, studio_id, status").eq("id", input.ticketId);
  if (input.studioId) query = query.eq("studio_id", input.studioId);
  const { data: ticket, error } = await query.maybeSingle();
  if (error) throw error;
  if (!ticket) return { ok: false, error: "Chamado não encontrado." };

  const now = new Date().toISOString();
  const { error: messageError } = await supabase.from("support_ticket_messages").insert({
    ticket_id: ticket.id,
    studio_id: ticket.studio_id,
    author: input.author,
    author_id: input.authorId,
    body: input.body,
    created_at: now,
  });
  if (messageError) {
    console.error("[support/message]", messageError);
    return { ok: false, error: "A mensagem não foi enviada. Tente de novo." };
  }

  const status = input.resolve ? "resolvido" : statusAfterMessage(ticket.status, input.author);
  const { error: updateError } = await supabase
    .from("support_tickets")
    .update({
      status,
      resolved_at: status === "resolvido" ? now : null,
      last_message_at: now,
      last_message_by: input.author,
      ...(input.author === "cliente" ? { client_seen_at: now } : { support_seen_at: now }),
    })
    .eq("id", ticket.id);
  if (updateError) console.error("[support/message-touch]", updateError);
  return { ok: true, id: ticket.id };
}

export async function setTicketStatus(input: {
  ticketId: string;
  status: SupportTicketStatus;
  studioId?: string;
}): Promise<boolean> {
  if (!isSupabaseServiceConfigured || !UUID_RE.test(input.ticketId)) return false;
  const supabase = createServiceRoleSupabaseClient();
  let query = supabase
    .from("support_tickets")
    .update({
      status: input.status,
      resolved_at: input.status === "resolvido" ? new Date().toISOString() : null,
    })
    .eq("id", input.ticketId);
  if (input.studioId) query = query.eq("studio_id", input.studioId);
  const { error } = await query;
  if (error) {
    console.error("[support/status]", error);
    return false;
  }
  return true;
}

/** Abriu o chamado: apaga o "nova resposta" de quem abriu. */
export async function markTicketSeen(ticketId: string, viewer: SupportAuthor, studioId?: string): Promise<void> {
  if (!isSupabaseServiceConfigured || !UUID_RE.test(ticketId)) return;
  const supabase = createServiceRoleSupabaseClient();
  let query = supabase
    .from("support_tickets")
    .update(viewer === "cliente" ? { client_seen_at: new Date().toISOString() } : { support_seen_at: new Date().toISOString() })
    .eq("id", ticketId);
  if (studioId) query = query.eq("studio_id", studioId);
  const { error } = await query;
  if (error) console.error("[support/seen]", error);
}

// ---------------------------------------------------------------------------
// /superadmin
// ---------------------------------------------------------------------------

export type AdminTicketFilter = "pendentes" | "resolvidos" | "todos";

/**
 * Todos os chamados da plataforma. "Pendentes" é tudo que não foi resolvido;
 * dentro dele, quem espera resposta da equipe vem antes.
 */
export async function listAllTickets(filter: AdminTicketFilter): Promise<AdminTicketRow[]> {
  if (!isSupabaseServiceConfigured) return [];
  const supabase = createServiceRoleSupabaseClient();
  let query = supabase.from("support_tickets").select("*").order("last_message_at", { ascending: false }).limit(500);
  if (filter === "pendentes") query = query.neq("status", "resolvido");
  if (filter === "resolvidos") query = query.eq("status", "resolvido");
  const { data, error } = await query;
  if (error) throw error;

  const tickets = data ?? [];
  const studios = await studiosById(tickets.map((t) => t.studio_id));
  const rows = tickets.map((t) => ({ ...t, studio: studios.get(t.studio_id) ?? null }));
  if (filter !== "pendentes") return rows;
  // Estável: dentro de cada grupo continua a ordem por última mensagem.
  return rows.sort((a, b) => Number(b.last_message_by === "cliente") - Number(a.last_message_by === "cliente"));
}

export async function countTicketsByStatus(): Promise<Record<SupportTicketStatus, number> & { aguardando: number }> {
  const counts = { aberto: 0, em_andamento: 0, resolvido: 0, aguardando: 0 };
  if (!isSupabaseServiceConfigured) return counts;
  const supabase = createServiceRoleSupabaseClient();
  const { data, error } = await supabase.from("support_tickets").select("status, last_message_by");
  if (error) throw error;
  for (const row of data ?? []) {
    counts[row.status] += 1;
    if (row.status !== "resolvido" && row.last_message_by === "cliente") counts.aguardando += 1;
  }
  return counts;
}

export async function getTicketAdmin(
  ticketId: string
): Promise<(TicketWithMessages & { studio: AdminTicketRow["studio"] }) | null> {
  if (!isSupabaseServiceConfigured || !UUID_RE.test(ticketId)) return null;
  const supabase = createServiceRoleSupabaseClient();
  const { data: ticket, error } = await supabase.from("support_tickets").select("*").eq("id", ticketId).maybeSingle();
  if (error) throw error;
  if (!ticket) return null;
  const [messages, studios] = await Promise.all([listMessages(supabase, ticket.id), studiosById([ticket.studio_id])]);
  return { ticket, messages, studio: studios.get(ticket.studio_id) ?? null };
}

// ---------------------------------------------------------------------------

type AnyClient =
  | Awaited<ReturnType<typeof createServerSupabaseClient>>
  | ReturnType<typeof createServiceRoleSupabaseClient>;

async function listMessages(supabase: AnyClient, ticketId: string): Promise<SupportTicketMessage[]> {
  const { data, error } = await supabase
    .from("support_ticket_messages")
    .select("*")
    .eq("ticket_id", ticketId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

async function studiosById(ids: string[]): Promise<Map<string, NonNullable<AdminTicketRow["studio"]>>> {
  const unique = [...new Set(ids)];
  if (unique.length === 0) return new Map();
  const supabase = createServiceRoleSupabaseClient();
  const { data, error } = await supabase.from("studios").select("id, name, slug").in("id", unique);
  if (error) throw error;
  return new Map((data ?? []).map((s) => [s.id, s]));
}
