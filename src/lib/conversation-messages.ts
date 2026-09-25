import { formatPriceCents } from "@/lib/format";

/**
 * Os textos que a tela de Conversas monta para mandar à cliente: orçamento,
 * horários livres e confirmação de agendamento.
 *
 * Funções puras (sem data "de agora", sem rede), para dar para testar e para
 * a pré-visualização na tela ser exatamente o que sai no WhatsApp. O dono
 * sempre pode editar o texto antes de enviar — isto é o rascunho.
 *
 * O negrito usa a marcação do próprio WhatsApp (`*texto*`).
 */

export interface QuoteLine {
  name: string;
  priceCents: number;
  quantity: number;
}

export interface QuoteTotals {
  subtotalCents: number;
  /** Já limitado ao subtotal: desconto maior que a conta não gera total negativo. */
  discountCents: number;
  totalCents: number;
}

export function quoteTotals(lines: QuoteLine[], discountCents: number): QuoteTotals {
  const subtotalCents = lines.reduce(
    (sum, line) => sum + line.priceCents * Math.max(0, Math.floor(line.quantity)),
    0
  );
  const discount = Math.min(Math.max(0, Math.round(discountCents)), subtotalCents);
  return { subtotalCents, discountCents: discount, totalCents: subtotalCents - discount };
}

export interface QuoteMessageInput {
  studioName: string;
  /** Primeiro nome já basta; vazio omite a saudação personalizada. */
  clientName: string;
  lines: QuoteLine[];
  discountCents: number;
  note: string;
}

export function buildQuoteMessage(input: QuoteMessageInput): string {
  const lines = input.lines.filter((line) => line.quantity > 0);
  const totals = quoteTotals(lines, input.discountCents);
  const firstName = firstNameOf(input.clientName);

  const out: string[] = [];
  out.push(firstName ? `Olá, ${firstName}! Segue o seu orçamento:` : "Olá! Segue o seu orçamento:");
  out.push("");
  out.push(`*Orçamento — ${input.studioName.trim() || "Estúdio"}*`);
  for (const line of lines) {
    const quantity = line.quantity > 1 ? `${line.quantity}x ` : "";
    out.push(`• ${quantity}${line.name} — ${money(line.priceCents * line.quantity)}`);
  }
  out.push("");
  if (totals.discountCents > 0) {
    out.push(`Subtotal: ${money(totals.subtotalCents)}`);
    out.push(`Desconto: − ${money(totals.discountCents)}`);
  }
  out.push(`*Total: ${money(totals.totalCents)}*`);

  const note = input.note.trim();
  if (note) {
    out.push("");
    out.push(note);
  }
  out.push("");
  out.push("Quer que eu reserve um horário para você?");
  return out.join("\n");
}

export interface SlotsDay {
  /** Rótulo do dia já pronto, ex.: "qua., 24/09". */
  label: string;
  /** "09:00", "10:30"... */
  times: string[];
}

/** "Tenho estes horários para Design de sobrancelha: ..." */
export function buildSlotsMessage(serviceName: string, days: SlotsDay[]): string {
  const withTimes = days.filter((day) => day.times.length > 0);
  const out = [`Tenho estes horários livres para *${serviceName}*:`, ""];
  for (const day of withTimes) {
    out.push(`• ${capitalize(day.label)}: ${day.times.join(", ")}`);
  }
  out.push("");
  out.push("Qual fica melhor para você?");
  return out.join("\n");
}

export interface BookingConfirmationInput {
  clientName: string;
  serviceName: string;
  /** Ex.: "qua., 24/09". */
  dayLabel: string;
  time: string;
  studioName: string;
}

export function buildBookingConfirmation(input: BookingConfirmationInput): string {
  const firstName = firstNameOf(input.clientName);
  return [
    firstName ? `Prontinho, ${firstName}! Seu horário está reservado:` : "Prontinho! Seu horário está reservado:",
    "",
    `*${input.serviceName}*`,
    `${capitalize(input.dayLabel)} às ${input.time}`,
    "",
    `Até lá! — ${input.studioName.trim() || "Estúdio"}`,
  ].join("\n");
}

function firstNameOf(name: string): string {
  return name.trim().split(/\s+/)[0] ?? "";
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

/** O `Intl` separa "R$" do número com espaço não quebrável; no WhatsApp, espaço comum. */
function money(cents: number): string {
  return formatPriceCents(cents).replace(/ /g, " ");
}
