import "server-only";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/service";
import type { MessageOutbox, MessageOutboxKind } from "@/lib/types";
import type { PlannedMessage } from "@/lib/reminders";

/**
 * Acesso à fila de mensagens (0010_message_outbox.sql).
 *
 * Tudo aqui usa a service_role: quem chama é o disparador, que roda sem
 * sessão de usuário. A RLS da tabela só concede SELECT ao dono — nenhuma
 * dessas escritas tem caminho a partir do navegador, e é essa a intenção.
 */

/** Depois de tantas falhas seguidas, a mensagem para de tentar. */
export const MAX_SEND_ATTEMPTS = 4;

/**
 * Mensagem cuja hora passou há mais que isso não sai mais.
 *
 * O caso real: o estúdio ficou uma semana com o WhatsApp desconectado, a fila
 * acumulou, e alguém reconecta numa terça de manhã. Sem esta regra, todas as
 * clientes da semana passada receberiam de uma vez um lembrete de um horário
 * que já aconteceu.
 */
export const STALE_AFTER_MINUTES = 120;

/**
 * Enfileira lembretes ignorando os que já existem.
 *
 * `ignoreDuplicates` traduz para `ON CONFLICT DO NOTHING`, e quem define o
 * conflito é o índice único (booking_id, kind). É esta linha que torna o
 * planejador seguro de rodar de novo — inclusive em paralelo consigo mesmo.
 */
export async function enqueueReminders(messages: PlannedMessage[]): Promise<number> {
  if (messages.length === 0) return 0;

  const supabase = createServiceRoleSupabaseClient();
  const { data, error } = await supabase
    .from("message_outbox")
    .upsert(
      messages.map((message) => ({ ...message, kind: "lembrete" as MessageOutboxKind })),
      { onConflict: "booking_id,kind", ignoreDuplicates: true }
    )
    .select("id");
  if (error) throw error;
  return data?.length ?? 0;
}

/**
 * Reivindica o próximo lote pronto para sair, marcando-o como "enviando".
 * A atomicidade vem da função SQL — ver o comentário em 0010.
 */
export async function claimDueMessages(limit: number): Promise<MessageOutbox[]> {
  const supabase = createServiceRoleSupabaseClient();
  const { data, error } = await supabase.rpc("claim_pending_messages", { p_limit: limit });
  if (error) throw error;
  return data ?? [];
}

export async function markMessageSent(
  id: string,
  providerMessageId: string | null
): Promise<void> {
  const supabase = createServiceRoleSupabaseClient();
  const { error } = await supabase
    .from("message_outbox")
    .update({
      status: "enviado",
      provider_message_id: providerMessageId,
      sent_at: new Date().toISOString(),
      last_error: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) throw error;
}

/**
 * Devolve a mensagem para a fila (ou desiste dela).
 *
 * `attempts` já foi incrementado na reivindicação, então a decisão de desistir
 * usa o valor que veio do banco — não há um segundo contador aqui que pudesse
 * divergir daquele.
 */
export async function markMessageAttemptFailed(
  message: Pick<MessageOutbox, "id" | "attempts">,
  error: string,
  options: { retryable: boolean }
): Promise<"pendente" | "falhou"> {
  const giveUp = !options.retryable || message.attempts >= MAX_SEND_ATTEMPTS;
  const supabase = createServiceRoleSupabaseClient();
  const { error: updateError } = await supabase
    .from("message_outbox")
    .update({
      status: giveUp ? "falhou" : "pendente",
      last_error: error.slice(0, 500),
      updated_at: new Date().toISOString(),
    })
    .eq("id", message.id);
  if (updateError) throw updateError;
  return giveUp ? "falhou" : "pendente";
}

/**
 * Devolve a mensagem à fila sem gastar a tentativa que a reivindicação
 * consumiu — usado quando o impedimento não é da mensagem (o estúdio está com
 * o WhatsApp desconectado), e insistir não a aproxima de ser entregue.
 */
export async function releaseMessage(
  message: Pick<MessageOutbox, "id" | "attempts">,
  reason: string
): Promise<void> {
  const supabase = createServiceRoleSupabaseClient();
  const { error } = await supabase
    .from("message_outbox")
    .update({
      status: "pendente",
      attempts: Math.max(0, message.attempts - 1),
      last_error: reason.slice(0, 500),
      updated_at: new Date().toISOString(),
    })
    .eq("id", message.id);
  if (error) throw error;
}

export async function cancelMessage(id: string, reason: string): Promise<void> {
  const supabase = createServiceRoleSupabaseClient();
  const { error } = await supabase
    .from("message_outbox")
    .update({
      status: "cancelado",
      last_error: reason.slice(0, 500),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) throw error;
}

/**
 * Cancela na origem os lembretes de agendamentos que foram cancelados depois
 * de entrar na fila. Sem isto, a cliente que desmarcou receberia lembrete do
 * horário que ela mesma cancelou — o pior erro possível deste recurso.
 */
export async function cancelRemindersForCanceledBookings(
  studioIds: string[],
  fromIso: string,
  toIso: string
): Promise<number> {
  if (studioIds.length === 0) return 0;
  const supabase = createServiceRoleSupabaseClient();

  // A janela é a mesma que o planejador usou: procurar cancelamentos no
  // histórico inteiro do estúdio custaria caro para achar linhas que não estão
  // mais na fila de qualquer jeito.
  const { data: canceled, error: bookingsError } = await supabase
    .from("bookings")
    .select("id")
    .in("studio_id", studioIds)
    .eq("status", "cancelado")
    .gte("start_at", fromIso)
    .lte("start_at", toIso);
  if (bookingsError) throw bookingsError;
  if (!canceled || canceled.length === 0) return 0;

  const { data, error } = await supabase
    .from("message_outbox")
    .update({
      status: "cancelado",
      last_error: "Agendamento cancelado",
      updated_at: new Date().toISOString(),
    })
    .eq("status", "pendente")
    .in(
      "booking_id",
      canceled.map((b) => b.id)
    )
    .select("id");
  if (error) throw error;
  return data?.length ?? 0;
}

/** Histórico recente do estúdio — alimenta o log da tela de WhatsApp. */
export async function listRecentMessages(
  studioId: string,
  limit = 20
): Promise<MessageOutbox[]> {
  const supabase = createServiceRoleSupabaseClient();
  const { data, error } = await supabase
    .from("message_outbox")
    .select("*")
    .eq("studio_id", studioId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}
