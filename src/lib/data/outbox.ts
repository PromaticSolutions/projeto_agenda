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
 * Tempo que uma mensagem pode ficar em "enviando" antes de ser considerada
 * abandonada.
 *
 * A rota do disparador tem `maxDuration = 60`, então uma execução viva jamais
 * chega perto disto — a folga existe para não competir com um lote que ainda
 * está rodando.
 */
export const STUCK_AFTER_MINUTES = 15;

/**
 * Devolve à fila as mensagens que ficaram penduradas em "enviando".
 *
 * O buraco que isto tapa: `claim_pending_messages` marca o lote como
 * "enviando" ANTES do envio, de propósito (é o que impede dois disparadores de
 * mandarem a mesma mensagem duas vezes). Se o processo morrer entre a
 * reivindicação e o desfecho — timeout da plataforma, deploy no meio da
 * execução, crash —, a linha fica "enviando" para sempre: nenhuma execução
 * futura a reivindica (o claim só olha "pendente") e ela nunca vira "falhou".
 * O lembrete simplesmente não sai, e não aparece em lugar nenhum como
 * problema.
 *
 * A tentativa consumida NÃO é devolvida. A reivindicação já a contou, e
 * devolvê-la faria uma mensagem que derruba o processo toda vez ficar tentando
 * para sempre — o teto de `MAX_SEND_ATTEMPTS` existe justamente para isso.
 */
export async function requeueStuckMessages(now = new Date()): Promise<number> {
  const cutoff = new Date(now.getTime() - STUCK_AFTER_MINUTES * 60_000).toISOString();
  const supabase = createServiceRoleSupabaseClient();
  const { data, error } = await supabase
    .from("message_outbox")
    .update({
      status: "pendente",
      last_error: "O disparador foi interrompido antes de concluir o envio",
      updated_at: now.toISOString(),
    })
    .eq("status", "enviando")
    .lt("updated_at", cutoff)
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

// ---------------------------------------------------------------------------
// Envio manual (0012)
// ---------------------------------------------------------------------------

/**
 * Teto de envios manuais por estúdio. A seção 30 do plano pede proteção contra
 * abuso; o número é generoso para uso legítimo (avisar as clientes do dia) e
 * baixo o bastante para que um script preso em laço não queime a sessão do
 * WhatsApp do salão — banimento por disparo em massa é o risco real aqui, e
 * ele cai sobre o NÚMERO do dono, não sobre a nossa infraestrutura.
 */
export const MANUAL_SEND_LIMIT = 20;
export const MANUAL_SEND_WINDOW_MINUTES = 10;

/**
 * Quantos envios manuais este estúdio fez na janela.
 *
 * A contagem sai da própria fila em vez de um contador em memória de
 * propósito: na Vercel cada requisição pode cair em uma instância diferente, e
 * um limitador em memória contaria do zero em cada uma — ou seja, não
 * limitaria nada justamente quando houvesse volume.
 */
export async function countRecentManualSends(
  studioId: string,
  now = new Date()
): Promise<number> {
  const since = new Date(now.getTime() - MANUAL_SEND_WINDOW_MINUTES * 60_000).toISOString();
  const supabase = createServiceRoleSupabaseClient();
  const { count, error } = await supabase
    .from("message_outbox")
    .select("id", { count: "exact", head: true })
    .eq("studio_id", studioId)
    .eq("kind", "manual")
    .gte("created_at", since);
  if (error) throw error;
  return count ?? 0;
}

export interface ManualMessageRecord {
  studioId: string;
  toPhone: string;
  body: string;
  /** Resultado já conhecido: a mensagem manual é tentada antes de ser gravada. */
  outcome: "enviado" | "falhou";
  providerMessageId?: string | null;
  error?: string | null;
  now?: Date;
}

/**
 * Grava no histórico a mensagem manual JÁ tentada.
 *
 * Não passa por `pendente`: se nascesse pendente e o processo morresse entre a
 * gravação e o envio, o disparador reivindicaria a linha depois e a cliente
 * receberia a mesma mensagem duas vezes. `booking_id` fica nulo, e o índice
 * único de 0010 é parcial (`where booking_id is not null`), então mensagens
 * manuais não colidem entre si nem com lembretes.
 */
export async function recordManualMessage(input: ManualMessageRecord): Promise<MessageOutbox> {
  const now = input.now ?? new Date();
  const iso = now.toISOString();
  const supabase = createServiceRoleSupabaseClient();

  const { data, error } = await supabase
    .from("message_outbox")
    .insert({
      studio_id: input.studioId,
      booking_id: null,
      kind: "manual" as MessageOutboxKind,
      to_phone: input.toPhone,
      body: input.body,
      // Manual não espera a hora: o instante do pedido é o instante do envio.
      scheduled_for: iso,
      status: input.outcome,
      attempts: 1,
      provider_message_id: input.providerMessageId ?? null,
      sent_at: input.outcome === "enviado" ? iso : null,
      last_error: input.error ? input.error.slice(0, 500) : null,
      created_at: iso,
      updated_at: iso,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}
