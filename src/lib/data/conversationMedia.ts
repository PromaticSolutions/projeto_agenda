import "server-only";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { getMyStudio } from "@/lib/data/studios";
import { getMyClientByPhone } from "@/lib/data/clients";
import { getConversation } from "@/lib/data/conversations";
import { getWhatsAppConnection } from "@/lib/data/whatsapp";
import { getWhatsAppProvider } from "@/lib/whatsapp/provider";
import { chatFromJid, type InboundWhatsAppMessage } from "@/lib/whatsapp/inbound";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/service";
import { mockGetConversationMessage, mockMessageMedia } from "@/lib/mock/conversations";

/**
 * Fotos, áudios e fotos de perfil da tela de Conversas.
 *
 * Desde a 0022 o arquivo de cada mensagem é baixado UMA vez e guardado no
 * bucket privado `conversation-media`. Antes ele era pedido à Evolution a cada
 * exibição, só pelo id — o que dependia de o gateway ter guardado a mensagem,
 * e a instalação roda sem guardar (DATABASE_SAVE_DATA_NEW_MESSAGE=false): foto
 * e áudio apareciam como indisponíveis.
 *
 * Três caminhos chegam ao mesmo `saveMessageMedia`:
 *  - o webhook (`captureInboundMedia`), com a mensagem INTEIRA na mão — é o que
 *    garante que mensagem nova nunca se perde;
 *  - o balão da tela (`getMessageMedia`), que guarda o que conseguir baixar na
 *    primeira exibição;
 *  - a recuperação em lote (`backfillConversationMedia`), para as antigas.
 *
 * Nada aqui recebe estúdio nem instância do navegador: o estúdio sai da
 * sessão, a mensagem é procurada DENTRO dele (com a RLS valendo) e só então o
 * bucket ou o gateway são tocados.
 */

export const CONVERSATION_MEDIA_BUCKET = "conversation-media";

/** Mesmo teto do bucket (0022). Acima disso o arquivo é servido, não guardado. */
const MAX_STORED_BYTES = 25 * 1024 * 1024;

export interface MediaFile {
  mimeType: string;
  bytes: Uint8Array;
  fileName: string | null;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Coluna que não existe: código no ar antes de a 0022 rodar. */
function isMissingColumn(error: { code?: string } | null): boolean {
  return error?.code === "42703";
}

/** O arquivo de uma mensagem do estúdio da sessão, ou `null`. */
export async function getMessageMedia(messageId: string): Promise<MediaFile | null> {
  if (!UUID_RE.test(messageId)) return null;
  const studio = await getMyStudio();
  if (!studio) return null;

  if (!isSupabaseConfigured) {
    const message = mockGetConversationMessage(studio.id, messageId);
    const media = message ? mockMessageMedia(message.message_type) : null;
    return media ? { ...media, fileName: null } : null;
  }

  // Cliente da SESSÃO: é a RLS que confirma que a mensagem é deste estúdio.
  const supabase = await createServerSupabaseClient();
  const stored = await supabase
    .from("whatsapp_messages")
    .select("provider_message_id, message_type, body, media_path, media_mime, media_status")
    .eq("studio_id", studio.id)
    .eq("id", messageId)
    .maybeSingle();

  let message: {
    provider_message_id: string;
    message_type: string;
    body: string | null;
    media_path?: string | null;
    media_mime?: string | null;
    media_status?: string | null;
  } | null;
  let canStore = true;

  if (isMissingColumn(stored.error)) {
    canStore = false;
    const legacy = await supabase
      .from("whatsapp_messages")
      .select("provider_message_id, message_type, body")
      .eq("studio_id", studio.id)
      .eq("id", messageId)
      .maybeSingle();
    if (legacy.error) throw legacy.error;
    message = legacy.data;
  } else {
    if (stored.error) throw stored.error;
    message = stored.data;
  }

  if (!message || message.message_type === "texto") return null;
  const fileName = message.message_type === "documento" ? message.body : null;

  if (message.media_status === "indisponivel") return null;

  if (message.media_path) {
    const file = await downloadStored(message.media_path);
    if (file) return { mimeType: message.media_mime ?? file.type ?? "application/octet-stream", bytes: file.bytes, fileName };
    // O objeto sumiu do bucket (apagado à mão): cai para o gateway abaixo.
  }

  // Id local = a resposta saiu sem id do gateway; não há o que buscar lá.
  if (message.provider_message_id.startsWith("local:")) {
    if (canStore) await markMediaUnavailable(studio.id, messageId);
    return null;
  }

  const instanceName = await connectedInstance(studio.id);
  const provider = instanceName ? await getWhatsAppProvider() : null;
  if (!provider || !instanceName) return null;

  const media = await provider.fetchMedia(instanceName, message.provider_message_id);
  if (!media) {
    // O gateway respondeu que não tem o arquivo — não adianta pedir de novo a
    // cada vez que a conversa abre.
    if (canStore) await markMediaUnavailable(studio.id, messageId);
    return null;
  }

  const bytes = new Uint8Array(Buffer.from(media.base64, "base64"));
  if (canStore) await saveMessageMedia(studio.id, messageId, bytes, media.mimeType);
  return { mimeType: media.mimeType, fileName: media.fileName ?? fileName, bytes };
}

/**
 * Guarda o arquivo no bucket e marca a mensagem como salva. Falha aqui só
 * loga: o arquivo continua sendo servido nesta resposta, e a próxima exibição
 * tenta guardar de novo.
 */
export async function saveMessageMedia(
  studioId: string,
  messageId: string,
  bytes: Uint8Array,
  mimeType: string
): Promise<boolean> {
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_STORED_BYTES) return false;
  const supabase = createServiceRoleSupabaseClient();
  const path = `${studioId}/${messageId}`;

  const upload = await supabase.storage
    .from(CONVERSATION_MEDIA_BUCKET)
    // O WhatsApp manda "audio/ogg; codecs=opus"; o Storage guarda o tipo base.
    .upload(path, bytes, { contentType: mimeType.split(";")[0].trim() || "application/octet-stream", upsert: true });
  if (upload.error) {
    console.error("[conversation-media] upload", upload.error.message);
    return false;
  }

  const { error } = await supabase
    .from("whatsapp_messages")
    .update({ media_path: path, media_mime: mimeType, media_status: "salva" })
    .eq("studio_id", studioId)
    .eq("id", messageId);
  if (error) {
    console.error("[conversation-media] update", error.message);
    return false;
  }
  return true;
}

async function markMediaUnavailable(studioId: string, messageId: string): Promise<void> {
  const supabase = createServiceRoleSupabaseClient();
  const { error } = await supabase
    .from("whatsapp_messages")
    .update({ media_status: "indisponivel" })
    .eq("studio_id", studioId)
    .eq("id", messageId)
    .is("media_path", null);
  if (error && !isMissingColumn(error)) console.error("[conversation-media] mark", error.message);
}

async function downloadStored(path: string): Promise<{ bytes: Uint8Array; type: string | null } | null> {
  const supabase = createServiceRoleSupabaseClient();
  const { data, error } = await supabase.storage.from(CONVERSATION_MEDIA_BUCKET).download(path);
  if (error || !data) return null;
  return { bytes: new Uint8Array(await data.arrayBuffer()), type: data.type || null };
}

/**
 * Webhook: guarda na hora a mídia das mensagens que acabaram de chegar.
 *
 * Roda depois da resposta (`after`, na rota), então a Evolution não espera o
 * download. Com a mensagem inteira em mãos o gateway baixa direto do WhatsApp
 * — é o único momento em que isso é garantido: depois, só o id sobra.
 */
export async function captureInboundMedia(
  studioId: string,
  instanceName: string,
  messages: InboundWhatsAppMessage[]
): Promise<void> {
  const withMedia = messages.filter((m) => m.mediaContent);
  if (withMedia.length === 0) return;

  const provider = await getWhatsAppProvider();
  if (!provider) return;
  const supabase = createServiceRoleSupabaseClient();

  for (const message of withMedia) {
    try {
      const { data: row, error } = await supabase
        .from("whatsapp_messages")
        .select("id, media_status")
        .eq("studio_id", studioId)
        .eq("provider_message_id", message.providerMessageId)
        .maybeSingle();
      if (error) {
        if (!isMissingColumn(error)) console.error("[conversation-media] webhook", error.message);
        return;
      }
      // Sem linha = conversa descartada pelo filtro; já salva = entrega repetida.
      if (!row || row.media_status === "salva") continue;

      const media = await provider.fetchMedia(instanceName, message.providerMessageId, message.mediaContent);
      if (!media) {
        await markMediaUnavailable(studioId, row.id);
        continue;
      }
      await saveMessageMedia(studioId, row.id, new Uint8Array(Buffer.from(media.base64, "base64")), media.mimeType);
    } catch (cause) {
      // Uma mídia que falha não pode derrubar as outras do mesmo evento; ela
      // fica pendente e a tela ou o lote tentam de novo.
      console.error("[conversation-media] webhook", cause instanceof Error ? cause.message : cause);
    }
  }
}

export interface BackfillResult {
  /** Salvas nesta rodada. */
  saved: number;
  /** O WhatsApp não tem mais o arquivo. */
  unavailable: number;
  /** Erro transitório (gateway fora): continuam pendentes. */
  failed: number;
  /** Quantas ainda faltam tentar, depois desta rodada. */
  remaining: number;
  /** Por que não deu para rodar, quando não deu. */
  blocked: "sem_conexao" | "sem_migracao" | null;
  /**
   * Onde a próxima rodada continua (o `sent_at` da última mensagem vista), ou
   * nulo quando não há mais nada depois dela. É o que impede um arquivo que
   * falhou de voltar no topo de todo lote e travar a fila: ele fica para a
   * próxima visita.
   */
  nextCursor: string | null;
}

/**
 * Recupera a mídia antiga do estúdio da sessão, um lote por chamada.
 *
 * Lote pequeno e sequencial de propósito: cada arquivo é uma ida ao gateway e
 * outra ao Storage, e a server action tem o tempo da plataforma para
 * terminar. A tela chama de novo até `remaining` chegar a zero.
 */
export async function backfillConversationMedia(
  cursor: string | null,
  batchSize = 12
): Promise<BackfillResult> {
  const empty: BackfillResult = {
    saved: 0,
    unavailable: 0,
    failed: 0,
    remaining: 0,
    blocked: null,
    nextCursor: null,
  };
  const studio = await getMyStudio();
  if (!studio || !isSupabaseConfigured) return empty;

  const supabase = createServiceRoleSupabaseClient();
  const pendingQuery = () =>
    supabase
      .from("whatsapp_messages")
      .select("id, provider_message_id, sent_at", { count: "exact" })
      .eq("studio_id", studio.id)
      .is("media_status", null)
      .neq("message_type", "texto");

  let page = pendingQuery().order("sent_at", { ascending: false }).limit(batchSize);
  if (cursor) page = page.lt("sent_at", cursor);
  const { data: rows, error, count } = await page;
  if (error) {
    if (isMissingColumn(error)) return { ...empty, blocked: "sem_migracao" };
    throw error;
  }
  if (!rows || rows.length === 0) return empty;

  const instanceName = await connectedInstance(studio.id);
  const provider = instanceName ? await getWhatsAppProvider() : null;
  if (!provider || !instanceName) return { ...empty, remaining: count ?? rows.length, blocked: "sem_conexao" };

  const result = { ...empty };
  for (const row of rows) {
    if (row.provider_message_id.startsWith("local:")) {
      await markMediaUnavailable(studio.id, row.id);
      result.unavailable++;
      continue;
    }
    try {
      const media = await provider.fetchMedia(instanceName, row.provider_message_id);
      if (!media) {
        await markMediaUnavailable(studio.id, row.id);
        result.unavailable++;
        continue;
      }
      const ok = await saveMessageMedia(
        studio.id,
        row.id,
        new Uint8Array(Buffer.from(media.base64, "base64")),
        media.mimeType
      );
      // Não guardou (grande demais para o bucket, ou o Storage falhou): fica
      // pendente e continua sendo servido sob demanda pelo balão.
      if (ok) result.saved++;
      else result.failed++;
    } catch (cause) {
      console.error("[conversation-media] backfill", cause instanceof Error ? cause.message : cause);
      result.failed++;
    }
  }

  const after = await pendingQuery().limit(1);
  result.remaining = after.count ?? 0;
  result.nextCursor = rows.length === batchSize ? rows[rows.length - 1].sent_at : null;
  return result;
}

/**
 * A foto de perfil de quem está do outro lado da conversa.
 *
 * Só para conversa que existe no estúdio (ou cliente do cadastro): sem isso,
 * a rota viraria um jeito de consultar a foto de qualquer número pelo
 * WhatsApp do salão.
 */
export async function getContactPicture(chatId: string): Promise<MediaFile | null> {
  const chat = chatFromJid(chatId);
  if (!chat?.phone || !isSupabaseConfigured) return null;
  const studio = await getMyStudio();
  if (!studio) return null;

  const conversation = await getConversation(studio.id, chat.chatId);
  if (!conversation && !(await getMyClientByPhone(studio.id, chat.phone))) return null;

  const instanceName = await connectedInstance(studio.id);
  const provider = instanceName ? await getWhatsAppProvider() : null;
  if (!provider || !instanceName) return null;

  const url = await provider.fetchProfilePictureUrl(instanceName, chat.phone);
  if (!url || !isWhatsAppCdn(url)) return null;

  const response = await fetch(url, { signal: AbortSignal.timeout(10_000), cache: "no-store" });
  const mimeType = response.headers.get("content-type") ?? "";
  if (!response.ok || !mimeType.startsWith("image/")) return null;
  return { mimeType, bytes: new Uint8Array(await response.arrayBuffer()), fileName: null };
}

/**
 * A URL vem do gateway, mas é o servidor que a busca: só o CDN do WhatsApp
 * passa, para a rota não virar um proxy para qualquer endereço.
 */
function isWhatsAppCdn(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && /(^|\.)whatsapp\.net$/.test(url.hostname);
  } catch {
    return false;
  }
}

async function connectedInstance(studioId: string): Promise<string | null> {
  const connection = await getWhatsAppConnection(studioId);
  return connection.status === "conectado" ? connection.instance_name : null;
}

/** Os arquivos guardados das mensagens de uma cliente (para apagar junto). */
export async function listClientMediaPaths(studioId: string, clientId: string): Promise<string[]> {
  const supabase = createServiceRoleSupabaseClient();
  const { data, error } = await supabase
    .from("whatsapp_messages")
    .select("media_path")
    .eq("studio_id", studioId)
    .eq("client_id", clientId)
    .not("media_path", "is", null);
  if (error) {
    if (!isMissingColumn(error)) console.error("[conversation-media] list", error.message);
    return [];
  }
  return (data ?? []).map((row) => row.media_path).filter((path): path is string => Boolean(path));
}

/**
 * Remove objetos do bucket. Falha aqui só loga: a linha (o que o dono vê) já
 * saiu, e um objeto órfão num bucket privado não é lido por ninguém.
 */
export async function deleteConversationMediaObjects(paths: string[]): Promise<void> {
  if (paths.length === 0) return;
  const supabase = createServiceRoleSupabaseClient();
  // O Storage aceita até mil caminhos por chamada.
  for (let i = 0; i < paths.length; i += 1000) {
    const { error } = await supabase.storage.from(CONVERSATION_MEDIA_BUCKET).remove(paths.slice(i, i + 1000));
    if (error) console.error("[conversation-media] remove", error.message);
  }
}
