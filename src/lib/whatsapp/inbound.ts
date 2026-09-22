import type { WhatsAppMessageType } from "@/lib/types";

/**
 * Leitura dos eventos de MENSAGEM da Evolution 2.3.7 (`messages.upsert` e
 * `send.message`), para as conversas de /app/conversations.
 *
 * Conferido no código-fonte da tag (whatsapp.baileys.service.ts):
 *  - os dois eventos entregam o mesmo formato, montado por `prepareMessage`:
 *    `{ key: { id, remoteJid, fromMe, remoteJidAlt? }, message, messageType,
 *    messageTimestamp, pushName, ... }`, uma mensagem por entrega;
 *  - `messages.upsert` traz o que a cliente mandou E o que o dono digitou no
 *    próprio celular (`key.fromMe`). O que sai pela API (lembrete, envio
 *    manual, resposta pela tela) NÃO passa por ali, porque a instância roda
 *    com `emitOwnEvents: false`: isso chega como `send.message`;
 *  - `extendedTextMessage` já vem convertido em `conversation`, e
 *    `documentWithCaptionMessage` em `documentMessage`. O código abaixo aceita
 *    as duas formas mesmo assim, porque `send.message` e versões vizinhas nem
 *    sempre passam pela mesma conversão;
 *  - contato endereçado por LID (`...@lid`) chega com `remoteJid` trocado pelo
 *    `remoteJidAlt`, que é o número. Quando não há alternativo, o número não é
 *    conhecido e a mensagem não tem como ser casada com uma cliente;
 *  - em grupo, `key.remoteJid` é o grupo ("...@g.us") e `key.participant` é
 *    quem falou. A conversa é o GRUPO (0021).
 *
 * Nada aqui fala com banco ou rede: é a parte do webhook que dá para testar
 * com o corpo do evento na mão.
 */

export interface InboundWhatsAppMessage {
  /** `key.id` do WhatsApp. Chave de idempotência: a Evolution repete entrega. */
  providerMessageId: string;
  /** true = saiu do número do estúdio (celular do dono ou API). */
  fromMe: boolean;
  /** JID que identifica a conversa: `<numero>@s.whatsapp.net` ou `<id>@g.us`. */
  chatId: string;
  /** Número do outro lado, só dígitos. Nulo em grupo. */
  chatPhone: string | null;
  isGroup: boolean;
  /** Nome que o WhatsApp mostra para o contato, quando o evento traz. */
  chatName: string | null;
  /** Em grupo, quem falou. */
  senderName: string | null;
  type: WhatsAppMessageType;
  /** Texto, legenda ou nome do arquivo. Nulo quando a mídia não tem nenhum. */
  body: string | null;
  sentAt: string;
}

/** Mesmo teto da coluna `body` em 0019. */
export const MAX_MESSAGE_BODY = 8192;

/**
 * Chaves que não são uma mensagem na conversa: reação, apagar/editar
 * (`protocolMessage`), voto de enquete, troca de chave de criptografia.
 * Gravá-las encheria a tela de balões vazios.
 */
const NOT_A_MESSAGE = new Set([
  "reactionMessage",
  "encReactionMessage",
  "protocolMessage",
  "pollUpdateMessage",
  "senderKeyDistributionMessage",
  "editedMessage",
  "keepInChatMessage",
  "pinInChatMessage",
]);

/** Metadados que andam junto do conteúdo e não dizem o tipo da mensagem. */
const METADATA_KEYS = new Set(["messageContextInfo", "base64", "mediaUrl"]);

/** Envelopes que carregam a mensagem de verdade em `.message`. */
const WRAPPERS = [
  "ephemeralMessage",
  "viewOnceMessage",
  "viewOnceMessageV2",
  "viewOnceMessageV2Extension",
  "deviceSentMessage",
  "documentWithCaptionMessage",
] as const;

export function parseEvolutionMessage(
  data: unknown,
  now = new Date()
): InboundWhatsAppMessage | null {
  if (!isRecord(data) || !isRecord(data.key)) return null;
  const key = data.key;

  const id = key.id;
  if (typeof id !== "string" || id.length === 0 || id.length > 128) return null;

  const chat = chatFromJid(key.remoteJid, key.remoteJidAlt);
  // Lista de transmissão, status e canal não são conversa: `chatFromJid` recusa.
  if (!chat) return null;

  const message = unwrap(data.message);
  if (!message) return null;

  const content = describeContent(message);
  if (!content) return null;

  const fromMe = key.fromMe === true;
  // `pushName` é de quem ENVIOU. No que o dono mandou, é o nome dele — usá-lo
  // como nome da conversa batizaria todo chat com o nome do próprio estúdio.
  const pushName = fromMe ? null : text_(data.pushName);

  return {
    providerMessageId: id,
    fromMe,
    chatId: chat.chatId,
    chatPhone: chat.phone,
    isGroup: chat.isGroup,
    // O evento não traz o nome do grupo (só o JID e quem falou). A tela mostra
    // "Grupo" e o nome de quem escreveu; buscar o assunto exigiria uma chamada
    // à API da Evolution por grupo, que ninguém pediu ainda.
    chatName: chat.isGroup ? null : pushName,
    senderName: chat.isGroup ? pushName : null,
    type: content.type,
    body: content.body,
    sentAt: timestampToIso(data.messageTimestamp, now),
  };
}

export interface ChatIdentity {
  /** Forma canônica: o JID do grupo, ou `<numero>@s.whatsapp.net`. */
  chatId: string;
  /** Só dígitos; nulo em grupo. */
  phone: string | null;
  isGroup: boolean;
}

/**
 * De qual CONVERSA é a mensagem.
 *
 * Grupo vale como conversa desde a 0021. O que continua fora é o que não é
 * conversa: status ("status@broadcast"), lista de transmissão e canal
 * ("@newsletter"), que chegariam como mensagem sem ninguém para responder.
 *
 * O chat de uma pessoa é normalizado para `<numero>@s.whatsapp.net` mesmo
 * quando chegou por LID: o mesmo contato precisa cair numa conversa só.
 */
export function chatFromJid(remoteJid: unknown, remoteJidAlt?: unknown): ChatIdentity | null {
  const group = groupJid(remoteJid);
  if (group) return { chatId: group, phone: null, isGroup: true };

  const phone = phoneFromPersonalJid(remoteJid) ?? phoneFromPersonalJid(remoteJidAlt);
  if (!phone) return null;
  return { chatId: `${phone}@s.whatsapp.net`, phone, isGroup: false };
}

function groupJid(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const [user, server] = value.split("@");
  if (server !== "g.us") return null;
  const id = (user ?? "").trim();
  return /^[\w.-]{1,100}$/.test(id) ? `${id}@g.us` : null;
}

/**
 * "5511987654321@s.whatsapp.net" -> "5511987654321".
 *
 * Só conversa individual. O sufixo de aparelho ("5511...:12@s.whatsapp.net")
 * aparece em alguns eventos e é descartado.
 */
export function phoneFromPersonalJid(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const [user, server] = value.split("@");
  if (server !== "s.whatsapp.net" && server !== "c.us") return null;
  const digits = (user ?? "").split(":")[0]!.replace(/\D/g, "");
  // Mesmo formato que `clients.phone` aceita (0004).
  return /^\d{10,15}$/.test(digits) ? digits : null;
}

/**
 * As formas que o MESMO celular brasileiro pode ter.
 *
 * Contas antigas continuam com o JID sem o nono dígito
 * ("551187654321@s.whatsapp.net"), enquanto o cadastro guarda o número como a
 * cliente digitou, com o 9 ("5511987654321"). Sem as duas formas, a conversa
 * de parte das clientes simplesmente não apareceria, e nada acusaria.
 *
 * Só celular: número de 8 dígitos começando em 2–5 é fixo, e acrescentar 9 a
 * ele fabricaria o número de outra pessoa.
 */
export function phoneVariants(phone: string): string[] {
  const variants = [phone];
  if (!phone.startsWith("55")) return variants;

  const ddd = phone.slice(2, 4);
  const local = phone.slice(4);
  if (local.length === 8 && /^[6-9]/.test(local)) {
    variants.push(`55${ddd}9${local}`);
  } else if (local.length === 9 && /^9[6-9]/.test(local)) {
    variants.push(`55${ddd}${local.slice(1)}`);
  }
  return variants;
}

function describeContent(
  message: Record<string, unknown>
): { type: WhatsAppMessageType; body: string | null } | null {
  const text =
    text_(message.conversation) ??
    text_(pick(message, "extendedTextMessage", "text")) ??
    // Resposta a botão e a lista: para quem lê a conversa, é o que a cliente
    // escolheu, e isso é texto.
    text_(pick(message, "buttonsResponseMessage", "selectedDisplayText")) ??
    text_(pick(message, "templateButtonReplyMessage", "selectedDisplayText")) ??
    text_(pick(message, "listResponseMessage", "title"));
  if (text !== null) return { type: "texto", body: text };

  if (isRecord(message.imageMessage)) {
    return { type: "imagem", body: text_(message.imageMessage.caption) };
  }
  const video = message.videoMessage ?? message.ptvMessage;
  if (isRecord(video)) return { type: "video", body: text_(video.caption) };
  if (isRecord(message.audioMessage)) return { type: "audio", body: null };
  if (isRecord(message.documentMessage)) {
    const doc = message.documentMessage;
    return { type: "documento", body: text_(doc.caption) ?? text_(doc.fileName) };
  }
  if (isRecord(message.stickerMessage)) return { type: "figurinha", body: null };

  const location = message.locationMessage ?? message.liveLocationMessage;
  if (isRecord(location)) {
    return { type: "localizacao", body: text_(location.name) ?? text_(location.address) };
  }
  if (isRecord(message.contactMessage)) {
    return { type: "contato", body: text_(message.contactMessage.displayName) };
  }
  if (isRecord(message.contactsArrayMessage)) {
    const first = Array.isArray(message.contactsArrayMessage.contacts)
      ? message.contactsArrayMessage.contacts[0]
      : null;
    return { type: "contato", body: isRecord(first) ? text_(first.displayName) : null };
  }

  const keys = Object.keys(message).filter(
    (key) => !METADATA_KEYS.has(key) && message[key] !== null && message[key] !== undefined
  );
  if (keys.length === 0 || keys.every((key) => NOT_A_MESSAGE.has(key))) return null;

  // Enquete, pedido de pagamento, catálogo... Existe na conversa do celular, e
  // sumir com ela deixaria a resposta da cliente sem contexto na tela.
  return { type: "outro", body: null };
}

function unwrap(message: unknown, depth = 0): Record<string, unknown> | null {
  if (!isRecord(message)) return null;
  if (depth >= 4) return message;
  for (const wrapper of WRAPPERS) {
    const inner = message[wrapper];
    if (isRecord(inner) && isRecord(inner.message)) return unwrap(inner.message, depth + 1);
  }
  return message;
}

/**
 * Segundos desde a época (formato do WhatsApp) para ISO.
 *
 * Um relógio de aparelho muito errado não pode prender a mensagem no topo ou
 * no fim da conversa para sempre: fora de uma janela plausível, vale a hora da
 * chegada.
 */
function timestampToIso(value: unknown, now: Date): string {
  let seconds = Number.NaN;
  if (typeof value === "number") seconds = value;
  else if (typeof value === "string" && /^\d+$/.test(value)) seconds = Number(value);
  // `Long` do protobuf que escapou da conversão: { low, high }.
  else if (isRecord(value) && typeof value.low === "number" && typeof value.high === "number") {
    seconds = (value.low >>> 0) + value.high * 2 ** 32;
  }

  if (!Number.isFinite(seconds) || seconds <= 0) return now.toISOString();
  const ms = seconds > 1e12 ? seconds : seconds * 1000;
  const tooOld = ms < Date.UTC(2009, 0, 1);
  const tooNew = ms > now.getTime() + 24 * 60 * 60 * 1000;
  return tooOld || tooNew ? now.toISOString() : new Date(ms).toISOString();
}

function text_(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, MAX_MESSAGE_BODY) : null;
}

function pick(data: Record<string, unknown>, ...path: string[]): unknown {
  let current: unknown = data;
  for (const segment of path) {
    if (!isRecord(current)) return undefined;
    current = current[segment];
  }
  return current;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
