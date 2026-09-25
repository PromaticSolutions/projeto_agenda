import "server-only";
import { getMyStudio } from "@/lib/data/studios";
import { getMyClientByPhone } from "@/lib/data/clients";
import { getConversation, recordSentReply } from "@/lib/data/conversations";
import {
  sendManualWhatsAppMessage,
  type ManualMedia,
  type SendResult,
} from "@/lib/data/whatsappSend";
import { downloadServiceImage } from "@/lib/data/storage";
import { chatFromJid } from "@/lib/whatsapp/inbound";

/**
 * Resposta dada pela tela de Conversas.
 *
 * É o envio manual de /app/whatsapp com uma diferença que importa: o DESTINO
 * não sai do formulário. A tela manda o id da CONVERSA, e o número vem da
 * conversa que já existe dentro do estúdio da sessão — não há campo de
 * telefone para alguém trocar no navegador e usar a tela como disparador para
 * qualquer número.
 *
 * Todo o resto (teto de envio, estado real da sessão, número existente no
 * WhatsApp, histórico no outbox) é `sendManualWhatsAppMessage`, e não uma cópia
 * dela.
 */
export async function sendConversationReply(
  chatId: string,
  message: unknown
): Promise<SendResult> {
  const target = await resolveReplyTarget(chatId);
  if (!target.ok) return target;

  const result = await sendManualWhatsAppMessage({ phone: target.phone, message });
  if (!result.ok) return result;

  await recordReply(target, {
    body: String(message).trim(),
    providerMessageId: result.providerMessageId,
  });
  return result;
}

/**
 * Envia na conversa uma das fotos cadastradas nos serviços.
 *
 * O navegador manda só o ID do anexo. O arquivo é lido aqui, pelo servidor, e
 * só se o anexo for do estúdio da sessão E for imagem: sem isso, qualquer
 * caminho do bucket privado viraria algo que dá para mandar para fora.
 */
export async function sendConversationImage(
  chatId: string,
  attachmentId: unknown,
  caption: unknown
): Promise<SendResult> {
  const target = await resolveReplyTarget(chatId);
  if (!target.ok) return target;

  if (typeof attachmentId !== "string" || !UUID_RE.test(attachmentId)) {
    return { ok: false, code: "dados_invalidos", error: "Foto não encontrada." };
  }

  let media: ManualMedia | null;
  try {
    media = await downloadServiceImage(target.studioId, attachmentId);
  } catch (cause) {
    console.error("[conversations/send] downloadServiceImage", cause);
    return { ok: false, code: "erro_interno", error: "Não foi possível ler a foto. Tente de novo." };
  }
  if (!media) {
    return { ok: false, code: "dados_invalidos", error: "Foto não encontrada." };
  }

  const text = typeof caption === "string" ? caption.trim() : "";
  const result = await sendManualWhatsAppMessage({ phone: target.phone, message: text, media });
  if (!result.ok) return result;

  await recordReply(target, {
    body: text || null,
    providerMessageId: result.providerMessageId,
    messageType: "imagem",
  });
  return result;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type ReplyTarget =
  | { ok: true; studioId: string; chatId: string; phone: string; clientId: string | null }
  | { ok: false; code: "dados_invalidos" | "sem_estudio"; error: string };

/**
 * Para quem vai a resposta — sempre a partir da CONVERSA, nunca de um número
 * que o navegador mande.
 */
async function resolveReplyTarget(chatId: string): Promise<ReplyTarget> {
  const chat = chatFromJid(chatId);
  if (!chat) {
    return { ok: false, code: "dados_invalidos", error: "Conversa não encontrada." };
  }

  const studio = await getMyStudio();
  if (!studio) {
    return { ok: false, code: "sem_estudio", error: "Estúdio não encontrado." };
  }

  if (chat.isGroup) {
    // O envio manual grava no outbox, cuja coluna de telefone só aceita
    // dígitos (0010) — um JID de grupo não cabe ali. Responder grupo pelo
    // painel é trabalho próprio, não um remendo nesta função.
    return {
      ok: false,
      code: "dados_invalidos",
      error: "Ainda não dá para responder grupo pelo painel. Responda pelo celular.",
    };
  }

  // O destino precisa ser alguém que JÁ tem conversa no estúdio, ou uma
  // cliente do cadastro (o caso de "Nova conversa", que começa sem histórico).
  // É o que impede alguém de trocar o número na URL e usar a tela para mandar
  // mensagem para quem nunca falou com o estúdio.
  const conversation = await getConversation(studio.id, chat.chatId);
  const client = conversation?.client_id
    ? null
    : chat.phone
      ? await getMyClientByPhone(studio.id, chat.phone)
      : null;

  if (!conversation && !client) {
    return { ok: false, code: "dados_invalidos", error: "Conversa não encontrada." };
  }

  const phone = conversation?.chat_phone ?? client?.phone ?? chat.phone;
  if (!phone) {
    return { ok: false, code: "dados_invalidos", error: "Conversa sem número para responder." };
  }

  return {
    ok: true,
    studioId: studio.id,
    chatId: chat.chatId,
    phone,
    clientId: conversation?.client_id ?? client?.id ?? null,
  };
}

async function recordReply(
  target: Extract<ReplyTarget, { ok: true }>,
  sent: {
    body: string | null;
    providerMessageId: string | null;
    messageType?: "imagem";
  }
): Promise<void> {
  try {
    await recordSentReply({
      studioId: target.studioId,
      chatId: target.chatId,
      chatPhone: target.phone,
      clientId: target.clientId,
      body: sent.body,
      providerMessageId: sent.providerMessageId,
      ...(sent.messageType ? { messageType: sent.messageType } : {}),
    });
  } catch (cause) {
    // A mensagem SAIU. Falhar aqui não pode virar "erro ao enviar" na tela: o
    // dono tentaria de novo e a pessoa receberia duas vezes. O `send.message`
    // do webhook ainda traz a cópia para a conversa.
    console.error("[conversations/send] recordSentReply", cause);
  }
}
