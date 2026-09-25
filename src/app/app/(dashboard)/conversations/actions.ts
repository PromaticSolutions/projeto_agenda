"use server";

import { revalidatePath } from "next/cache";
import { getMyStudio } from "@/lib/data/studios";
import { listMyClients } from "@/lib/data/clients";
import { markConversationRead } from "@/lib/data/conversations";
import { sendConversationImage, sendConversationReply } from "@/lib/data/conversationSend";
import { listMyServicesWithAttachments } from "@/lib/data/services";
import { listOwnerAvailableSlots } from "@/lib/data/bookings";
import { addLocalDays } from "@/lib/availability";
import { isImageMime } from "@/lib/validation";
import {
  importConversationHistory,
  type ImportOutcome,
} from "@/lib/data/conversationImport";
import { chatFromJid } from "@/lib/whatsapp/inbound";
import {
  backfillConversationMedia,
  type BackfillResult,
} from "@/lib/data/conversationMedia";

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

export type ConversationToolResult = { ok: true } | { ok: false; error: string };

/**
 * Envia um texto pronto na conversa — o orçamento, os horários livres ou a
 * confirmação do agendamento, montados pelo painel lateral.
 */
export async function sendConversationTextAction(
  chatId: string,
  message: string
): Promise<ConversationToolResult> {
  const result = await sendConversationReply(chatId, message);
  if (!result.ok) return { ok: false, error: result.error };
  revalidatePath("/app/conversations", "layout");
  revalidatePath("/app/whatsapp");
  return { ok: true };
}

/** Envia na conversa uma foto cadastrada num serviço. */
export async function sendConversationImageAction(
  chatId: string,
  attachmentId: string,
  caption: string
): Promise<ConversationToolResult> {
  const result = await sendConversationImage(chatId, attachmentId, caption);
  if (!result.ok) return { ok: false, error: result.error };
  revalidatePath("/app/conversations", "layout");
  revalidatePath("/app/whatsapp");
  return { ok: true };
}

export interface ConversationToolService {
  id: string;
  name: string;
  color: string;
  durationMin: number;
  priceCents: number;
  photos: { id: string; url: string; fileName: string }[];
}

export interface ConversationTools {
  studioName: string;
  services: ConversationToolService[];
}

/**
 * O que o painel lateral precisa: os serviços ativos e as fotos deles.
 *
 * Buscado quando o painel abre, e não junto da página: a conversa se relê a
 * cada 10 segundos, e gerar URL assinada de todas as fotos a cada vez faria o
 * navegador baixar as mesmas imagens de novo sem parar.
 */
export async function loadConversationToolsAction(): Promise<ConversationTools | null> {
  const studio = await getMyStudio();
  if (!studio) return null;

  const services = await listMyServicesWithAttachments(studio.id);
  return {
    studioName: studio.name,
    services: services
      .filter((service) => service.active)
      .map((service) => ({
        id: service.id,
        name: service.name,
        color: service.color,
        durationMin: service.duration_min,
        priceCents: service.price_cents,
        photos: service.attachments
          .filter((attachment) => isImageMime(attachment.mime_type) && attachment.url)
          .map((attachment) => ({
            id: attachment.id,
            url: attachment.url!,
            fileName: attachment.file_name,
          })),
      })),
  };
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
/** Teto de dias por consulta: o modal mostra uma semana de cada vez. */
const MAX_DAYS = 14;

export type WeekSlotsResult =
  | { ok: true; days: { date: string; slots: { start: string; end: string }[] }[] }
  | { ok: false; error: string };

/**
 * Horários livres de vários dias seguidos, para o modal de disponibilidade.
 *
 * É a mesma grade da página pública e do agendamento manual
 * (`listOwnerAvailableSlots`), dia a dia — nenhuma regra de disponibilidade
 * nova mora aqui.
 */
export async function listWeekSlotsAction(
  serviceId: string,
  startDate: string,
  days: number
): Promise<WeekSlotsResult> {
  if (!DATE_RE.test(startDate)) return { ok: false, error: "Data inválida" };
  const count = Math.min(Math.max(1, Math.floor(days)), MAX_DAYS);

  const studio = await getMyStudio();
  if (!studio) return { ok: false, error: "Estúdio não encontrado" };

  try {
    const dates = Array.from({ length: count }, (_, i) => addLocalDays(startDate, i));
    const results = await Promise.all(
      dates.map((date) => listOwnerAvailableSlots(studio.id, serviceId, date))
    );
    if (results.some((slots) => slots === null)) {
      return { ok: false, error: "Serviço não encontrado" };
    }
    return { ok: true, days: dates.map((date, i) => ({ date, slots: results[i]! })) };
  } catch (cause) {
    console.error("[conversations/slots]", cause);
    return { ok: false, error: "Não foi possível buscar os horários. Tente novamente." };
  }
}

/**
 * Recupera um lote das fotos e áudios antigos do estúdio da sessão (0022).
 *
 * O cursor vem do navegador, mas é só uma DATA de onde continuar dentro do
 * estúdio da sessão — não dá acesso a nada de outro estúdio. Qualquer coisa
 * que não seja uma data ISO é tratada como "do começo".
 */
export async function backfillConversationMediaAction(
  cursor: string | null
): Promise<BackfillResult> {
  const safeCursor =
    typeof cursor === "string" && !Number.isNaN(Date.parse(cursor)) ? new Date(cursor).toISOString() : null;
  return backfillConversationMedia(safeCursor);
}
