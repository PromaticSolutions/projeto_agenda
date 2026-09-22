"use server";

import { revalidatePath } from "next/cache";
import { getMyStudio } from "@/lib/data/studios";
import { listMyClients } from "@/lib/data/clients";
import { markConversationRead } from "@/lib/data/conversations";
import { sendConversationReply } from "@/lib/data/conversationSend";
import {
  importConversationHistory,
  type ImportOutcome,
} from "@/lib/data/conversationImport";
import { chatFromJid } from "@/lib/whatsapp/inbound";

/**
 * Ações da tela de Conversas.
 *
 * Nenhuma aceita estúdio nem telefone: o estúdio sai da sessão e o telefone,
 * da conversa que já existe. O único parâmetro que vem do navegador é o id do
 * chat, e ele só serve para buscar dentro do estúdio da sessão.
 */

export type ConversationSendState =
  /** `token` novo a cada envio aceito remonta o campo já vazio (ver whatsapp-send-form). */
  | { ok: true; token: string }
  | { ok: false; error: string }
  | null;

export async function sendConversationMessageAction(
  chatId: string,
  _prev: ConversationSendState,
  formData: FormData
): Promise<ConversationSendState> {
  const result = await sendConversationReply(chatId, String(formData.get("message") ?? ""));
  if (!result.ok) return { ok: false, error: result.error };

  // A conversa e a lista ganharam uma linha; o histórico de /app/whatsapp também,
  // porque a resposta passa pelo outbox como envio manual.
  revalidatePath("/app/conversations", "layout");
  revalidatePath("/app/whatsapp");
  return { ok: true, token: crypto.randomUUID() };
}

/**
 * Zera as não lidas de uma conversa aberta.
 *
 * Chamada por efeito quando a conversa aparece na tela, e não durante a
 * renderização: marcar como lida é escrita, e a página é renderizada também
 * por prefetch e por refresh automático, quando ninguém está olhando.
 */
export async function markConversationReadAction(chatId: string): Promise<void> {
  const chat = chatFromJid(chatId);
  if (!chat) return;
  const studio = await getMyStudio();
  if (!studio) return;

  try {
    const changed = await markConversationRead(studio.id, chat.chatId);
    if (changed > 0) revalidatePath("/app/conversations", "layout");
  } catch (cause) {
    // Contador de não lidas errado é incômodo, não motivo para quebrar a tela.
    console.error("[conversations/read]", cause);
  }
}

export interface ConversationClientOption {
  id: string;
  name: string;
  phone: string;
}

/**
 * Clientes para "Nova conversa".
 *
 * Carregada quando o diálogo abre, e não junto da página: a página se
 * atualiza sozinha a cada poucos segundos, e reler o cadastro inteiro a cada
 * vez só para um diálogo fechado seria desperdício.
 */
export async function listClientsForConversationAction(): Promise<ConversationClientOption[]> {
  const studio = await getMyStudio();
  if (!studio) return [];
  const clients = await listMyClients(studio.id);
  return clients.map((client) => ({ id: client.id, name: client.name, phone: client.phone }));
}

/**
 * Traz para o banco as conversas que já existem no gateway.
 *
 * Em lotes: devolve quantas conversas ainda faltam para a tela oferecer
 * continuar. Ver `importConversationHistory` para o porquê.
 */
export async function importConversationHistoryAction(): Promise<ImportOutcome> {
  const studio = await getMyStudio();
  if (!studio) return { ok: false, error: "Estúdio não encontrado." };

  const result = await importConversationHistory(studio.id);
  if (result.ok && result.messages > 0) revalidatePath("/app/conversations", "layout");
  return result;
}
