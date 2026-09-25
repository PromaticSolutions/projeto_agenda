import "server-only";
import { MOCK_STUDIO_ID, mockListClients } from "@/lib/mock/store";
import type {
  WhatsAppConversation,
  WhatsAppMessage,
  WhatsAppMessageDirection,
  WhatsAppMessageType,
} from "@/lib/types";

/**
 * Conversas de mentira para o modo sem Supabase (ver `lib/mock/store.ts`).
 *
 * Em arquivo próprio porque dependem das clientes semeadas lá e nasceram
 * depois dele. Mesmo truque de `globalThis` do store: a página e as actions
 * rodam em grafos de módulo diferentes e precisam enxergar a mesma lista.
 */

declare global {
  var __agendaMockConversations: WhatsAppMessage[] | undefined;
}

function seed(): WhatsAppMessage[] {
  const clients = mockListClients(MOCK_STUDIO_ID);
  const ana = clients.find((client) => client.phone === "5511987654321");
  const camila = clients.find((client) => client.phone === "5511976543210");

  const now = Date.now();
  const rows: WhatsAppMessage[] = [];
  /** `chat` é quem está do outro lado: cliente do mock, número solto ou grupo. */
  function add(
    chat: { clientId: string | null; phone: string | null; name: string | null; group?: boolean },
    direction: WhatsAppMessageDirection,
    minutesAgo: number,
    body: string | null,
    type: WhatsAppMessageType = "texto",
    read = true,
    senderName: string | null = null
  ) {
    const at = new Date(now - minutesAgo * 60_000).toISOString();
    rows.push({
      id: crypto.randomUUID(),
      studio_id: MOCK_STUDIO_ID,
      client_id: chat.clientId,
      chat_id: chat.group ? "120363000000000001@g.us" : `${chat.phone}@s.whatsapp.net`,
      chat_phone: chat.group ? null : chat.phone,
      chat_name: chat.name,
      sender_name: senderName,
      is_group: chat.group === true,
      direction,
      message_type: type,
      body,
      provider_message_id: crypto.randomUUID(),
      sent_at: at,
      read_at: direction === "recebida" && read ? at : null,
      created_at: at,
      media_path: null,
      media_mime: null,
      media_status: null,
    });
  }

  if (ana) {
    const chat = { clientId: ana.id, phone: ana.phone, name: ana.name };
    add(chat, "enviada", 60 * 20, "Olá Ana Paula! Passando para confirmar seu horário de amanhã às 09:00. Até logo! — Bella Studio");
    add(chat, "recebida", 60 * 19 + 42, "Confirmado! Obrigada");
    add(chat, "recebida", 14, "Bom dia! Consigo chegar uns 10 minutinhos antes?", "texto", false);
  }
  if (camila) {
    const chat = { clientId: camila.id, phone: camila.phone, name: camila.name };
    add(chat, "recebida", 60 * 50, "Queria esse efeito nos cílios", "imagem");
    add(chat, "enviada", 60 * 49 + 50, "Dá sim! Esse é o volume brasileiro, leva cerca de 1h30.");
    add(chat, "recebida", 60 * 49 + 40, null, "audio");
    add(chat, "enviada", 60 * 49 + 30, "Perfeito, te espero então.");
  }

  // Quem ainda NÃO é cliente (0021): é para ver a diferença com o filtro
  // "só clientes" ligado, que sem isto não mudaria nada na tela.
  const curiosa = { clientId: null, phone: "5511911112222", name: "Juliana" };
  add(curiosa, "recebida", 35, "Oi! Vocês fazem maquiagem para noiva? Qual o valor?", "texto", false);

  const grupo = { clientId: null, phone: null, name: null, group: true };
  add(grupo, "recebida", 120, "Meninas, alguém tem cabine livre sábado?", "texto", true, "Rafa do Salão");
  add(grupo, "enviada", 118, "Tenho sim, pode mandar!");

  return rows;
}

function messages(): WhatsAppMessage[] {
  return (globalThis.__agendaMockConversations ??= seed());
}

export function mockListConversations(studioId: string): WhatsAppConversation[] {
  const clients = mockListClients(studioId);
  const byChat = new Map<string, WhatsAppMessage[]>();
  for (const message of messages()) {
    if (message.studio_id !== studioId) continue;
    byChat.set(message.chat_id, [...(byChat.get(message.chat_id) ?? []), message]);
  }

  return [...byChat.entries()]
    .map(([chatId, rows]) => {
      const last = [...rows].sort((a, b) => a.sent_at.localeCompare(b.sent_at)).at(-1)!;
      // Como na view da 0021, quem é cliente é decidido pelo telefone.
      const client = clients.find((row) => row.phone === last.chat_phone) ?? null;
      return {
        studio_id: studioId,
        chat_id: chatId,
        chat_phone: last.chat_phone,
        is_group: last.is_group,
        client_id: client?.id ?? null,
        display_name: client?.name ?? last.chat_name ?? last.chat_phone ?? chatId,
        last_body: last.body,
        last_type: last.message_type,
        last_direction: last.direction,
        last_at: last.sent_at,
        unread_count: rows.filter((row) => row.direction === "recebida" && !row.read_at).length,
      };
    })
    .sort((a, b) => b.last_at.localeCompare(a.last_at));
}

export function mockListConversationMessages(
  studioId: string,
  chatId: string,
  limit: number
): { messages: WhatsAppMessage[]; truncated: boolean } {
  const rows = messages()
    .filter((message) => message.studio_id === studioId && message.chat_id === chatId)
    .sort((a, b) => a.sent_at.localeCompare(b.sent_at));
  return { messages: rows.slice(-limit), truncated: rows.length > limit };
}

export function mockMarkConversationRead(studioId: string, chatId: string): number {
  let changed = 0;
  const now = new Date().toISOString();
  for (const message of messages()) {
    if (
      message.studio_id === studioId &&
      message.chat_id === chatId &&
      message.direction === "recebida" &&
      !message.read_at
    ) {
      message.read_at = now;
      changed++;
    }
  }
  return changed;
}

export function mockGetConversationMessage(studioId: string, id: string): WhatsAppMessage | null {
  return messages().find((message) => message.studio_id === studioId && message.id === id) ?? null;
}

/**
 * Arquivo de mentira para a mídia do modo sem Supabase: sem gateway não há
 * foto nem áudio de verdade, e sem isto não daria para ver o balão de mídia
 * funcionando localmente. Foto vira um desenho; áudio, um tom curto.
 */
export function mockMessageMedia(type: WhatsAppMessage["message_type"]): {
  mimeType: string;
  bytes: Uint8Array;
} | null {
  if (type === "imagem" || type === "figurinha") {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="360" viewBox="0 0 480 360"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#c4b5fd"/><stop offset="1" stop-color="#f0abfc"/></linearGradient></defs><rect width="480" height="360" fill="url(#g)"/><circle cx="170" cy="150" r="46" fill="#fff" opacity=".7"/><path d="M0 300 L150 190 L260 270 L340 210 L480 300 V360 H0Z" fill="#fff" opacity=".55"/></svg>`;
    return { mimeType: "image/svg+xml", bytes: new TextEncoder().encode(svg) };
  }
  if (type === "audio") {
    // 3 s de um tom de 440 Hz, WAV PCM 8 kHz mono.
    const rate = 8000;
    const samples = rate * 3;
    const buffer = new ArrayBuffer(44 + samples);
    const view = new DataView(buffer);
    const write = (offset: number, text: string) =>
      [...text].forEach((char, i) => view.setUint8(offset + i, char.charCodeAt(0)));
    write(0, "RIFF");
    view.setUint32(4, 36 + samples, true);
    write(8, "WAVEfmt ");
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, rate, true);
    view.setUint32(28, rate, true);
    view.setUint16(32, 1, true);
    view.setUint16(34, 8, true);
    write(36, "data");
    view.setUint32(40, samples, true);
    for (let i = 0; i < samples; i++) {
      view.setUint8(44 + i, 128 + Math.round(40 * Math.sin((2 * Math.PI * 440 * i) / rate)));
    }
    return { mimeType: "audio/wav", bytes: new Uint8Array(buffer) };
  }
  return null;
}
