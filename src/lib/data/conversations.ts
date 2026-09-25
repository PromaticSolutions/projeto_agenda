import "server-only";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/service";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { isMissingTableError } from "@/lib/supabase/errors";
import { fetchAllPages } from "@/lib/supabase/paginate";
import { phoneVariants, type InboundWhatsAppMessage } from "@/lib/whatsapp/inbound";
import {
  mockListConversationMessages,
  mockListConversations,
  mockMarkConversationRead,
} from "@/lib/mock/conversations";
import type { WhatsAppConversation, WhatsAppMessage } from "@/lib/types";

/**
 * Conversas de WhatsApp do número do estúdio (0019 + 0021).
 *
 * Leitura pelo client da SESSÃO, com a RLS de `whatsapp_messages` valendo (a
 * view é `security_invoker`): o filtro por estúdio abaixo é conveniência de
 * consulta, não a barreira. Escrita pela service_role, porque quem mais grava é
 * o webhook, que não tem sessão, e a leitura marcada como lida não tem policy
 * de update para o dono.
 */

/** Quantas mensagens a conversa aberta carrega. */
export const THREAD_MESSAGE_LIMIT = 300;

export async function listConversations(studioId: string): Promise<WhatsAppConversation[]> {
  if (!isSupabaseConfigured) return mockListConversations(studioId);

  const supabase = await createServerSupabaseClient();
  // Paginado pelo mesmo motivo de `listMyClients`: o PostgREST corta em mil
  // linhas sem erro, e a conversa mil-e-uma sumiria da lista em silêncio.
  return fetchAllPages<WhatsAppConversation>((from, to) =>
    supabase
      .from("whatsapp_conversations")
      .select("*")
      .eq("studio_id", studioId)
      .order("last_at", { ascending: false })
      .order("client_id")
      .range(from, to)
  );
}

/** Uma conversa da lista — o cabeçalho da tela aberta sai daqui. */
export async function getConversation(
  studioId: string,
  chatId: string
): Promise<WhatsAppConversation | null> {
  if (!isSupabaseConfigured) {
    return mockListConversations(studioId).find((row) => row.chat_id === chatId) ?? null;
  }

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("whatsapp_conversations")
    .select("*")
    .eq("studio_id", studioId)
    .eq("chat_id", chatId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export interface ConversationThread {
  /** Da mais antiga para a mais nova — a ordem em que a tela desenha. */
  messages: WhatsAppMessage[];
  /** Existem mensagens mais antigas que as carregadas. */
  truncated: boolean;
}

export async function listConversationMessages(
  studioId: string,
  chatId: string
): Promise<ConversationThread> {
  if (!isSupabaseConfigured) {
    return mockListConversationMessages(studioId, chatId, THREAD_MESSAGE_LIMIT);
  }

  const supabase = await createServerSupabaseClient();
  // Uma linha a mais que o teto só para saber se há histórico além do que a
  // tela mostra, sem uma segunda consulta de contagem.
  const { data, error } = await supabase
    .from("whatsapp_messages")
    .select("*")
    .eq("studio_id", studioId)
    .eq("chat_id", chatId)
    .order("sent_at", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(THREAD_MESSAGE_LIMIT + 1);
  if (error) throw error;

  const rows = data ?? [];
  return {
    messages: rows.slice(0, THREAD_MESSAGE_LIMIT).reverse(),
    truncated: rows.length > THREAD_MESSAGE_LIMIT,
  };
}

/**
 * Grava uma mensagem vinda do webhook.
 *
 * Desde a 0021 grava TODA conversa do número, e não só a de quem está no
 * cadastro: era a restrição que fazia a pergunta de quem ainda não é cliente
 * nunca chegar à tela. Quando o número bate com uma cliente, `client_id` é
 * preenchido — é ele que faz o pedido de exclusão do titular (0016) levar a
 * conversa junto.
 *
 * Idempotente pelo índice único (studio_id, provider_message_id): a Evolution
 * repete entrega, e a resposta enviada pelo painel é gravada na hora e depois
 * volta pelo `send.message`.
 */
export async function recordInboundMessage(
  studioId: string,
  message: InboundWhatsAppMessage
): Promise<boolean> {
  return recordInboundMessages(studioId, [message]);
}

/**
 * O mesmo, em lote — é o caminho da importação de histórico.
 *
 * As clientes são resolvidas de uma vez só: uma consulta por MENSAGEM
 * transformaria a importação de uma conversa de 300 mensagens em 300 idas ao
 * banco, e o gateway entrega justamente em lote.
 */
export async function recordInboundMessages(
  studioId: string,
  messages: InboundWhatsAppMessage[]
): Promise<boolean> {
  if (messages.length === 0) return false;
  const supabase = createServiceRoleSupabaseClient();

  const phones = [...new Set(messages.map((m) => m.chatPhone).filter((p): p is string => !!p))];
  const clientByPhone = await mapClientsByPhone(supabase, studioId, phones);

  const rows = messages.map((message) => {
    const client = message.chatPhone ? clientByPhone.get(message.chatPhone) : undefined;

    // Conta antiga fala pelo JID sem o nono dígito enquanto o cadastro tem o 9
    // (ver `phoneVariants`). Quando a cliente é conhecida, o chat passa a ser o
    // número DELA, para as duas formas caírem numa conversa só.
    return {
      studio_id: studioId,
      client_id: client?.id ?? null,
      chat_id: client ? `${client.phone}@s.whatsapp.net` : message.chatId,
      chat_phone: client ? client.phone : message.chatPhone,
      chat_name: message.chatName,
      sender_name: message.senderName,
      is_group: message.isGroup,
      direction: message.fromMe ? ("enviada" as const) : ("recebida" as const),
      message_type: message.type,
      body: message.body,
      provider_message_id: message.providerMessageId,
      sent_at: message.sentAt,
    };
  });

  const { error } = await supabase
    .from("whatsapp_messages")
    .upsert(rows, { onConflict: "studio_id,provider_message_id", ignoreDuplicates: true });

  if (error) {
    // Código no ar antes da migração: 500 aqui faria a Evolution repetir a
    // entrega para sempre, por algo que só um humano rodando o SQL resolve.
    if (isMissingTableError(error)) {
      console.warn("[conversations] whatsapp_messages não existe — rode as migrações 0019 e 0021");
      return false;
    }
    throw error;
  }
  return true;
}

type ServiceClient = ReturnType<typeof createServiceRoleSupabaseClient>;

/**
 * Para cada telefone pedido, a cliente correspondente — nas duas formas
 * possíveis do celular (com e sem o nono dígito).
 */
async function mapClientsByPhone(
  supabase: ServiceClient,
  studioId: string,
  phones: string[]
): Promise<Map<string, { id: string; phone: string }>> {
  const result = new Map<string, { id: string; phone: string }>();
  if (phones.length === 0) return result;

  const { data, error } = await supabase
    .from("clients")
    .select("id, phone")
    .eq("studio_id", studioId)
    .in("phone", [...new Set(phones.flatMap(phoneVariants))]);
  if (error) throw error;

  const byPhone = new Map((data ?? []).map((row) => [row.phone, row]));
  for (const phone of phones) {
    // Se o cadastro tiver as duas formas do mesmo celular, vale a que bate
    // exatamente com o que o WhatsApp mandou.
    const match = phoneVariants(phone)
      .map((variant) => byPhone.get(variant))
      .find((row) => row !== undefined);
    if (match) result.set(phone, match);
  }
  return result;
}

export interface SentReplyRecord {
  studioId: string;
  chatId: string;
  chatPhone: string | null;
  clientId: string | null;
  /** Texto, ou a legenda da foto (nula quando não houver). */
  body: string | null;
  providerMessageId: string | null;
  /** Padrão "texto". */
  messageType?: "texto" | "imagem";
  now?: Date;
}

/**
 * Grava na conversa a resposta que ACABOU de sair pelo painel.
 *
 * Não espera o `send.message` do webhook: em desenvolvimento ele não chega, e
 * em produção pode demorar o bastante para o dono achar que a mensagem não
 * saiu e mandar de novo. Quando o webhook chega, o índice único descarta a
 * cópia.
 */
export async function recordSentReply(input: SentReplyRecord): Promise<void> {
  const now = input.now ?? new Date();
  const supabase = createServiceRoleSupabaseClient();
  const { error } = await supabase.from("whatsapp_messages").upsert(
    {
      studio_id: input.studioId,
      client_id: input.clientId,
      chat_id: input.chatId,
      chat_phone: input.chatPhone,
      is_group: false,
      direction: "enviada",
      message_type: input.messageType ?? "texto",
      body: input.body,
      // Sem id do gateway não há como deduplicar com o webhook; um id local
      // ao menos mantém a linha única. Na 2.3.7 o `sendText` sempre devolve
      // `key.id`, então isto é reserva.
      provider_message_id: input.providerMessageId ?? `local:${crypto.randomUUID()}`,
      sent_at: now.toISOString(),
    },
    { onConflict: "studio_id,provider_message_id", ignoreDuplicates: true }
  );
  if (error) throw error;
}

/** Marca como lidas as recebidas de uma conversa. Devolve quantas mudaram. */
export async function markConversationRead(studioId: string, chatId: string): Promise<number> {
  if (!isSupabaseConfigured) return mockMarkConversationRead(studioId, chatId);

  const supabase = createServiceRoleSupabaseClient();
  const { data, error } = await supabase
    .from("whatsapp_messages")
    .update({ read_at: new Date().toISOString() })
    .eq("studio_id", studioId)
    .eq("chat_id", chatId)
    .eq("direction", "recebida")
    .is("read_at", null)
    .select("id");
  if (error) throw error;
  return data?.length ?? 0;
}
