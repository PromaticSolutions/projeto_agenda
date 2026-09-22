import type { WhatsAppMessageType } from "@/lib/types";

/**
 * Vocabulário e datas da tela de Conversas.
 *
 * Sem `server-only`: a lista e a busca rodam no navegador. As datas usam o
 * fuso do produto (America/Sao_Paulo, o mesmo de `lib/format.ts`) e recebem o
 * "agora" por parâmetro, então servidor e navegador chegam ao mesmo rótulo.
 */

const TIME_ZONE = "America/Sao_Paulo";
const DAY_MS = 86_400_000;

/** Rótulo da mídia, que o app não guarda: a tela diz o que era. */
export const MESSAGE_TYPE_LABELS: Record<WhatsAppMessageType, string> = {
  texto: "Mensagem",
  imagem: "Foto",
  video: "Vídeo",
  audio: "Áudio",
  documento: "Documento",
  figurinha: "Figurinha",
  localizacao: "Localização",
  contato: "Contato",
  outro: "Mensagem que só abre no celular",
};

/** Prévia da última mensagem na lista: o texto, ou o tipo quando não há texto. */
export function conversationPreview(type: WhatsAppMessageType, body: string | null): string {
  if (body) return body;
  return type === "texto" ? "" : MESSAGE_TYPE_LABELS[type];
}

const dayKeyFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
const hourFormatter = new Intl.DateTimeFormat("pt-BR", {
  timeZone: TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
});
const weekdayFormatter = new Intl.DateTimeFormat("pt-BR", { timeZone: TIME_ZONE, weekday: "long" });
const shortDateFormatter = new Intl.DateTimeFormat("pt-BR", {
  timeZone: TIME_ZONE,
  day: "2-digit",
  month: "2-digit",
  year: "2-digit",
});
const longDateFormatter = new Intl.DateTimeFormat("pt-BR", {
  timeZone: TIME_ZONE,
  day: "numeric",
  month: "long",
});
const longDateWithYearFormatter = new Intl.DateTimeFormat("pt-BR", {
  timeZone: TIME_ZONE,
  day: "numeric",
  month: "long",
  year: "numeric",
});

/** "2026-09-15" no fuso do produto — agrupa as mensagens por dia. */
export function localDayKey(date: Date): string {
  return dayKeyFormatter.format(date);
}

/**
 * Dias de CALENDÁRIO entre `date` e `now`, no fuso do produto. 0 = hoje.
 *
 * Diferença de horas não serve: 23h de ontem e 1h de hoje estão a duas horas
 * de distância e são "ontem".
 */
export function calendarDaysAgo(date: Date, now: Date): number {
  return Math.round((dayStamp(now) - dayStamp(date)) / DAY_MS);
}

function dayStamp(date: Date): number {
  const [year, month, day] = localDayKey(date).split("-").map(Number);
  return Date.UTC(year!, month! - 1, day!);
}

/** Canto da lista: "14:05", "Ontem", "sábado", "03/09/26". */
export function formatConversationListTime(date: Date, now: Date): string {
  const days = calendarDaysAgo(date, now);
  if (days <= 0) return hourFormatter.format(date);
  if (days === 1) return "Ontem";
  if (days < 7) return weekdayFormatter.format(date).replace("-feira", "");
  return shortDateFormatter.format(date);
}

/** Separador dentro da conversa: "Hoje", "Ontem", "3 de setembro". */
export function formatConversationDay(date: Date, now: Date): string {
  const days = calendarDaysAgo(date, now);
  if (days <= 0) return "Hoje";
  if (days === 1) return "Ontem";
  const sameYear = localDayKey(date).slice(0, 4) === localDayKey(now).slice(0, 4);
  return (sameYear ? longDateFormatter : longDateWithYearFormatter).format(date);
}

export function formatMessageTime(date: Date): string {
  return hourFormatter.format(date);
}

/**
 * O nome que a conversa mostra.
 *
 * Em grupo o evento da Evolution não traz o assunto (só o JID), então o rótulo
 * usa o fim do id: "Grupo 4417". Feio, mas estável e diferente para cada
 * grupo — melhor que todos aparecerem como "Grupo". Buscar o nome de verdade
 * exigiria uma chamada à API por grupo.
 */
export function conversationTitle(input: {
  is_group: boolean;
  display_name: string;
  chat_id: string;
}): string {
  if (!input.is_group) return input.display_name;
  const id = input.chat_id.split("@")[0] ?? "";
  return id ? `Grupo ${id.slice(-4)}` : "Grupo";
}

export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "";
  return (first + last).toUpperCase() || "?";
}

/**
 * Busca da lista: nome sem acento e sem caixa, ou trecho do telefone.
 *
 * O telefone só entra a partir de 2 dígitos. Com 1, "9" casaria praticamente
 * toda cliente, e a busca pareceria quebrada.
 */
export function matchesConversationQuery(query: string, name: string, phone: string): boolean {
  const normalized = normalize(query);
  if (!normalized) return true;
  if (normalize(name).includes(normalized)) return true;
  const digits = query.replace(/\D/g, "");
  return digits.length >= 2 && phone.includes(digits);
}

function normalize(value: string): string {
  return value.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().trim();
}
