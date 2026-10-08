import { formatFullDateLocal, formatTimeLocal } from "@/lib/format";
import type { BookingStatus, ReminderSettings } from "@/lib/types";

/**
 * Regras do lembrete, em funções puras.
 *
 * Nada aqui toca banco, rede ou relógio por conta própria (o `now` sempre
 * chega por parâmetro) — é o que permite testar "quem deveria receber lembrete
 * às 14h03 de terça" sem subir nada. A camada que fala com o Postgres e com o
 * gateway fica em src/lib/data/outbox.ts e src/lib/data/dispatch.ts.
 */

export interface ReminderTemplateData {
  clientName: string;
  serviceName: string;
  studioName: string;
  startAt: Date;
}

/**
 * Um pedaço do agendamento que a mensagem pode citar.
 *
 * O `marker` é o que fica GRAVADO no template (`{cliente}`) e o `label` é a
 * única coisa que a dona do salão vê na tela ("nome da cliente"). Essa
 * separação é o ponto da estrutura: o formato gravado não muda — disparador,
 * migração e linhas já salvas continuam valendo — e ainda assim ninguém
 * precisa entender chave nem colchete para escrever a mensagem.
 *
 * A tabela é a ÚNICA lista de marcadores do sistema: a substituição do envio e
 * os botões da tela saem daqui. Um marcador novo nasce com o rótulo e o valor
 * juntos, sem a chance de existir botão que o envio não sabe trocar.
 */
export interface ReminderToken {
  marker: string;
  label: string;
  /** Valor que o marcador assume no envio — e, com dados de exemplo, na prévia. */
  read: (data: ReminderTemplateData) => string;
}

export const REMINDER_TOKENS: readonly ReminderToken[] = [
  { marker: "{cliente}", label: "nome da cliente", read: (d) => d.clientName },
  { marker: "{servico}", label: "serviço", read: (d) => d.serviceName },
  { marker: "{data}", label: "data", read: (d) => formatFullDateLocal(d.startAt) },
  { marker: "{hora}", label: "horário", read: (d) => formatTimeLocal(d.startAt) },
  { marker: "{salao}", label: "nome do seu negócio", read: (d) => d.studioName },
];

/**
 * Uma passada só, de propósito: trocar marcador por marcador em sequência
 * deixaria uma cliente chamada "{salao}" ter o próprio nome substituído pela
 * rodada seguinte.
 */
const MARKER_PATTERN = new RegExp(
  REMINDER_TOKENS.map((token) => token.marker.replace(/[{}]/g, "\\$&")).join("|"),
  "g"
);

/** Mensagens prontas oferecidas na tela. Escrever do zero continua possível. */
export const REMINDER_TEMPLATE_PRESETS: readonly {
  id: string;
  label: string;
  description: string;
  template: string;
}[] = [
  {
    id: "lembrete",
    label: "Lembrete simpático",
    description: "Avisa do horário sem pedir resposta.",
    template:
      "Oi {cliente}, tudo bem? Passando para lembrar do seu horário de {servico} em {data} às {hora}. Te espero! — {salao}",
  },
  {
    id: "confirmacao",
    label: "Pedido de confirmação",
    description: "Pede um sim e reduz falta.",
    template:
      "Olá {cliente}! Seu {servico} está marcado para {data} às {hora}. Consegue confirmar que vem? É só responder esta mensagem. — {salao}",
  },
  {
    id: "direta",
    label: "Curta e direta",
    description: "Só o essencial, sem rodeio.",
    template:
      "{cliente}, seu horário de {servico} é {data} às {hora}. Qualquer imprevisto, me avise por aqui. — {salao}",
  },
];

/**
 * Agendamento fictício da pré-visualização.
 *
 * Vive aqui, e não na tela, porque a prévia chama `renderReminderMessage` — a
 * MESMA função do envio. Uma tabela de exemplos própria no componente era o
 * desenho anterior, e ela podia divergir da substituição real sem ninguém
 * perceber até a primeira cliente receber a mensagem errada.
 */
export function exampleReminderData(startAt: Date): ReminderTemplateData {
  return {
    clientName: "Marina",
    serviceName: "Design de sobrancelhas",
    studioName: "Bella Studio",
    startAt,
  };
}

/** Substitui os marcadores do template. Marcador desconhecido fica como está. */
export function renderReminderMessage(
  settings: Pick<ReminderSettings, "message_template" | "include_link" | "link_url">,
  data: ReminderTemplateData
): string {
  const values = new Map(REMINDER_TOKENS.map((token) => [token.marker, token.read(data)]));

  const body = settings.message_template.replace(MARKER_PATTERN, (marker) =>
    values.get(marker) ?? marker
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
