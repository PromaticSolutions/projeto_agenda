import "server-only";
import { getMyStudio } from "@/lib/data/studios";
import { getMyClientByPhone } from "@/lib/data/clients";
import { getConversation, recordSentReply } from "@/lib/data/conversations";
import { sendManualWhatsAppMessage, type SendResult } from "@/lib/data/whatsappSend";
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

  const result = await sendManualWhatsAppMessage({ phone, message });
  if (!result.ok) return result;

  try {
    await recordSentReply({
      studioId: studio.id,
      chatId: chat.chatId,
      chatPhone: phone,
      clientId: conversation?.client_id ?? client?.id ?? null,
      body: String(message).trim(),
      providerMessageId: result.providerMessageId,
    });
  } catch (cause) {
    // A mensagem SAIU. Falhar aqui não pode virar "erro ao enviar" na tela: o
    // dono tentaria de novo e a pessoa receberia duas vezes. O `send.message`
    // do webhook ainda traz a cópia para a conversa.
    console.error("[conversations/send] recordSentReply", cause);
  }
  return result;
}
