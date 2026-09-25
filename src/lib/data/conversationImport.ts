import "server-only";
import { getWhatsAppConnection } from "@/lib/data/whatsapp";
import { after } from "next/server";
import { listConversations, recordInboundMessages } from "@/lib/data/conversations";
import { captureInboundMedia } from "@/lib/data/conversationMedia";
import { getWhatsAppProvider, WhatsAppProviderError } from "@/lib/whatsapp/provider";
import { parseEvolutionMessage, phoneVariants } from "@/lib/whatsapp/inbound";

/**
 * Importação do histórico que já existe no gateway.
 *
 * Existe porque conectar o número e encontrar a tela vazia é a experiência de
 * quem acabou de ligar o produto: o webhook só traz o que chega DEPOIS, e a
 * conversa de ontem não volta sozinha.
 *
 * Três decisões que moldam o resto do arquivo:
 *
 *  - roda em LOTES, e não de uma vez. Uma Server Action tem orçamento de tempo
 *    na hospedagem, e um número com centenas de conversas estouraria ele no
 *    meio, sem deixar nada gravado. Cada chamada pega algumas conversas e diz
 *    quantas faltam; a tela chama de novo.
 *  - pula conversa que JÁ tem mensagem no banco, o que torna a operação
 *    repetível e retomável: rodar duas vezes não duplica nem regrava.
 *  - o que o gateway devolve é interpretado pelo MESMO leitor do webhook
 *    (`parseEvolutionMessage`), porque é o mesmo formato. Um segundo leitor
 *    seria outra oportunidade de divergir.
 */

/** Conversas por chamada. Cada uma é uma ida ao gateway; o teto é o tempo. */
const CHATS_PER_RUN = 15;

/** Mensagens por conversa. Bate com o que a tela carrega (THREAD_MESSAGE_LIMIT). */
const MESSAGES_PER_CHAT = 300;

export interface ImportResult {
  chats: number;
  messages: number;
  /** Conversas que ainda não foram importadas — a tela oferece continuar. */
  remaining: number;
}

export type ImportOutcome =
  | ({ ok: true } & ImportResult)
  | { ok: false; error: string };

export async function importConversationHistory(studioId: string): Promise<ImportOutcome> {
  const connection = await getWhatsAppConnection(studioId);
  if (connection.status !== "conectado" || !connection.instance_name) {
    return {
      ok: false,
      error: "Conecte o WhatsApp do estúdio antes de importar as conversas.",
    };
  }
  const instanceName = connection.instance_name;
  const provider = await getWhatsAppProvider();
  if (!provider) {
    return { ok: false, error: "O WhatsApp não está configurado neste ambiente." };
  }

  try {
    const chats = await provider.fetchChats(instanceName);

    // O que já está no banco não é buscado de novo. É o que faz "Importar
    // mais" continuar de onde parou em vez de recomeçar.
    const known = new Set<string>();
    for (const row of await listConversations(studioId)) {
      known.add(row.chat_id);
      // O gateway pode listar o contato pela forma SEM o nono dígito enquanto
      // o banco guardou a do cadastro, COM o 9. Sem as duas, a mesma conversa
      // seria reimportada a cada rodada.
      if (row.chat_phone) {
        for (const variant of phoneVariants(row.chat_phone)) {
          known.add(`${variant}@s.whatsapp.net`);
        }
      }
    }
    const pending = chats.filter((chat) => !known.has(normalizeChatId(chat.remoteJid)));

    let messages = 0;
    let chatsImported = 0;

    for (const chat of pending.slice(0, CHATS_PER_RUN)) {
      const records = await provider.fetchMessages({
        instanceName,
        remoteJid: chat.remoteJid,
        limit: MESSAGES_PER_CHAT,
      });

      const parsed = records
        .map((record) => parseEvolutionMessage(record))
        .filter((message) => message !== null);
      if (parsed.length === 0) continue;

      // O nome vem da LISTA de conversas; as mensagens guardadas nem sempre
      // trazem `pushName`, e sem isto a conversa importada apareceria só com o
      // número enquanto a que chega pelo webhook aparece com o nome.
      for (const message of parsed) {
        if (!message.chatName && !message.isGroup) message.chatName = chat.name;
      }

      await recordInboundMessages(studioId, parsed);
      // O registro do gateway traz a mensagem inteira, com a chave de mídia:
      // é a hora de guardar foto e áudio (0022). Depois da resposta, para a
      // importação não esperar os downloads.
      if (parsed.some((message) => message.mediaContent)) {
        after(() => captureInboundMedia(studioId, instanceName, parsed));
      }
      messages += parsed.length;
      chatsImported += 1;
    }

    return {
      ok: true,
      chats: chatsImported,
      messages,
      remaining: Math.max(pending.length - chatsImported, 0),
    };
  } catch (cause) {
    console.error("[conversations/import]", cause);
    if (cause instanceof WhatsAppProviderError) {
      return { ok: false, error: cause.userMessage };
    }
    return { ok: false, error: "Não foi possível importar as conversas. Tente de novo." };
  }
}

/**
 * O gateway pode listar o mesmo contato por LID ou com sufixo de aparelho; o
 * banco guarda a forma canônica. Comparar sem normalizar reimportaria
 * conversa já importada a cada rodada.
 */
function normalizeChatId(remoteJid: string): string {
  const [user, server] = remoteJid.split("@");
  if (server === "g.us") return remoteJid;
  const digits = (user ?? "").split(":")[0]!.replace(/\D/g, "");
  return digits ? `${digits}@s.whatsapp.net` : remoteJid;
}
