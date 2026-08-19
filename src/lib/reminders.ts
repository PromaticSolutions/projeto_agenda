import { formatFullDateLocal, formatTimeLocal } from "@/lib/format";
import type { BookingStatus, ReminderSettings } from "@/lib/types";

/**
 * Regras do lembrete, em funções puras.
 *
 * Nada aqui toca banco, rede ou relógio por conta própria (o `now` sempre
 * chega por parâmetro) — é o que permite testar "quem deveria receber lembrete
 * às 14h03 de terça" sem subir nada. A camada que fala com o Postgres e com o
 * gateway fica em src/lib/data/outbox.ts e src/lib/data/dispatch.ts.
 *
 * A lista canônica de marcadores é REMINDER_PLACEHOLDERS, em
 * src/lib/validation.ts — a interface a usa para montar os botões de inserir
 * marcador, e a substituição abaixo tem que cobrir exatamente a mesma lista.
 */

export interface ReminderTemplateData {
  clientName: string;
  serviceName: string;
  studioName: string;
  startAt: Date;
}

/** Substitui os marcadores do template. Marcador desconhecido fica como está. */
export function renderReminderMessage(
  settings: Pick<ReminderSettings, "message_template" | "include_link" | "link_url">,
  data: ReminderTemplateData
): string {
  const values: Record<string, string> = {
    "{cliente}": data.clientName,
    "{servico}": data.serviceName,
    "{data}": formatFullDateLocal(data.startAt),
    "{hora}": formatTimeLocal(data.startAt),
    "{salao}": data.studioName,
  };

  const body = settings.message_template.replace(
    /\{cliente\}|\{servico\}|\{data\}|\{hora\}|\{salao\}/g,
    (marker) => values[marker] ?? marker
  );

  // O link entra em linha própria: colado no fim do parágrafo, o WhatsApp às
  // vezes engole a pontuação anterior dentro da URL.
  if (settings.include_link && settings.link_url) {
    return `${body}\n\n${settings.link_url}`;
  }
  return body;
}

/** Instante em que o lembrete de um agendamento deve sair. */
export function reminderScheduledFor(startAt: Date, leadTimeMinutes: number): Date {
  return new Date(startAt.getTime() - leadTimeMinutes * 60_000);
}

/**
 * Status que ainda merecem lembrete. Cancelado é óbvio; finalizado significa
 * que a cliente já foi atendida — lembrá-la depois seria constrangedor.
 */
const REMINDABLE_STATUSES: BookingStatus[] = ["agendado", "em_atendimento"];

/**
 * Quanto tempo à frente o planejador enfileira. Precisa ser maior que o
 * intervalo do cron (senão um lembrete "vence" entre duas execuções e sai
 * atrasado) e curto o suficiente para o dono ainda conseguir editar o template
 * e ver o efeito no lembrete de amanhã — o texto é congelado na hora em que a
 * mensagem entra na fila.
 */
export const REMINDER_PLAN_HORIZON_MINUTES = 60;

export interface PlannableBooking {
  id: string;
  studio_id: string;
  service_id: string;
  client_name: string;
  client_phone: string;
  start_at: string;
  status: BookingStatus;
}

export interface PlannedMessage {
  studio_id: string;
  booking_id: string;
  to_phone: string;
  body: string;
  scheduled_for: string;
}

export interface PlanRemindersInput {
  now: Date;
  studioName: string;
  settings: ReminderSettings;
  bookings: PlannableBooking[];
  serviceNameById: Map<string, string>;
  horizonMinutes?: number;
}

/**
 * Decide quais lembretes entram na fila agora.
 *
 * Roda a cada execução do disparador e devolve tudo que está dentro do
 * horizonte — inclusive o que já foi enfileirado antes. Quem elimina a
 * repetição é o índice único (booking_id, kind) no banco, não uma memória
 * aqui: filtrar em memória exigiria consultar a fila inteira, e ainda deixaria
 * janela de corrida entre duas execuções simultâneas.
 */
export function planReminders(input: PlanRemindersInput): PlannedMessage[] {
  const { now, settings, bookings, serviceNameById, studioName } = input;
  if (!settings.enabled) return [];

  const horizonMs = (input.horizonMinutes ?? REMINDER_PLAN_HORIZON_MINUTES) * 60_000;
  const horizonLimit = new Date(now.getTime() + horizonMs);

  const planned: PlannedMessage[] = [];
  for (const booking of bookings) {
    if (!REMINDABLE_STATUSES.includes(booking.status)) continue;

    const startAt = new Date(booking.start_at);
    // Agendamento que já começou não recebe lembrete. Sem esta linha, ligar os
    // lembretes hoje dispararia mensagem para a agenda da semana passada.
    if (startAt <= now) continue;

    const scheduledFor = reminderScheduledFor(startAt, settings.lead_time_minutes);
    if (scheduledFor > horizonLimit) continue;

    planned.push({
      studio_id: booking.studio_id,
      booking_id: booking.id,
      to_phone: booking.client_phone,
      body: renderReminderMessage(settings, {
        clientName: booking.client_name,
        serviceName: serviceNameById.get(booking.service_id) ?? "seu atendimento",
        studioName,
        startAt,
      }),
      // Lembrete cuja hora já passou (o dono ligou o recurso em cima da hora,
      // ou a antecedência é maior que o tempo até o atendimento) sai na próxima
      // execução em vez de ser descartado: melhor um aviso em cima da hora do
      // que nenhum.
      scheduled_for: (scheduledFor < now ? now : scheduledFor).toISOString(),
    });
  }
  return planned;
}
