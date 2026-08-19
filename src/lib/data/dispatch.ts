import "server-only";
import { listEnabledReminderSettings } from "@/lib/data/reminders";
import { listStudiosByIds } from "@/lib/data/studios";
import { listServicesByStudioIds } from "@/lib/data/services";
import { listBookingsForStudiosInRange } from "@/lib/data/bookings";
import { saveWhatsAppConnection } from "@/lib/data/whatsapp";
import {
  STALE_AFTER_MINUTES,
  cancelMessage,
  cancelRemindersForCanceledBookings,
  claimDueMessages,
  enqueueReminders,
  markMessageAttemptFailed,
  markMessageSent,
  releaseMessage,
} from "@/lib/data/outbox";
import {
  REMINDER_PLAN_HORIZON_MINUTES,
  planReminders,
  type PlannedMessage,
} from "@/lib/reminders";
import {
  WhatsAppProviderError,
  getWhatsAppProvider,
  instanceNameForStudio,
  type WhatsAppProvider,
} from "@/lib/whatsapp/provider";
import type { WhatsAppConnection } from "@/lib/types";

/**
 * O disparador: duas etapas independentes, na mesma execução.
 *
 * 1. PLANEJAR — olha os agendamentos que se aproximam e coloca na fila o que
 *    ainda não está lá. Idempotente por índice único no banco.
 * 2. ENVIAR — reivindica o lote vencido e entrega pelo gateway.
 *
 * Separar as duas é o que permite ligar o gateway depois: sem Evolution
 * configurada, a etapa 1 continua rodando e dá para ver a fila encher, o que
 * torna o planejamento verificável antes de existir VPS.
 *
 * Nenhuma das etapas confia em ter rodado antes. Se o cron ficar quatro horas
 * sem executar, a próxima execução planeja tudo que venceu no intervalo — não
 * há estado "última execução" para se perder ou para dessincronizar.
 */

/** Teto de mensagens por execução: protege o orçamento de tempo da rota. */
export const SEND_BATCH_LIMIT = 25;

export interface DispatchReport {
  planejadas: number;
  enfileiradas: number;
  canceladasPorCancelamento: number;
  reivindicadas: number;
  enviadas: number;
  falhas: number;
  adiadas: number;
  expiradas: number;
  gateway: string | null;
  /** Preenchido quando o envio não pôde nem ser tentado. */
  aviso?: string;
}

// ---------------------------------------------------------------------------
// Etapa 1 — planejar
// ---------------------------------------------------------------------------

export async function planReminderQueue(now = new Date()): Promise<{
  planejadas: number;
  enfileiradas: number;
  canceladasPorCancelamento: number;
}> {
  const settings = await listEnabledReminderSettings();
  if (settings.length === 0) {
    return { planejadas: 0, enfileiradas: 0, canceladasPorCancelamento: 0 };
  }

  const studioIds = settings.map((s) => s.studio_id);

  // Janela = a maior antecedência configurada entre todos os estúdios, mais o
  // horizonte de enfileiramento. Buscar por estúdio seria uma consulta por
  // inquilino; buscar a janela mais larga é uma consulta só, e o recorte de
  // cada estúdio acontece em memória logo abaixo.
  const maxLeadMinutes = Math.max(...settings.map((s) => s.lead_time_minutes));
  const from = now.toISOString();
  const to = new Date(
    now.getTime() + (maxLeadMinutes + REMINDER_PLAN_HORIZON_MINUTES) * 60_000
  ).toISOString();

  const [studios, services, bookings] = await Promise.all([
    listStudiosByIds(studioIds),
    listServicesByStudioIds(studioIds),
    listBookingsForStudiosInRange(studioIds, from, to),
  ]);

  const studioNameById = new Map(studios.map((s) => [s.id, s.name]));
  const serviceNameById = new Map(services.map((s) => [s.id, s.name]));

  const bookingsByStudio = new Map<string, typeof bookings>();
  for (const booking of bookings) {
    const list = bookingsByStudio.get(booking.studio_id);
    if (list) list.push(booking);
    else bookingsByStudio.set(booking.studio_id, [booking]);
  }

  const planned: PlannedMessage[] = [];
  for (const setting of settings) {
    const studioName = studioNameById.get(setting.studio_id);
    // Estúdio apagado com a configuração órfã: sem nome, a mensagem sairia
    // assinada em branco. Melhor pular.
    if (!studioName) continue;

    planned.push(
      ...planReminders({
        now,
        studioName,
        settings: setting,
        bookings: bookingsByStudio.get(setting.studio_id) ?? [],
        serviceNameById,
      })
    );
  }

  const enfileiradas = await enqueueReminders(planned);
  const canceladasPorCancelamento = await cancelRemindersForCanceledBookings(
    studioIds,
    from,
    to
  );

  return { planejadas: planned.length, enfileiradas, canceladasPorCancelamento };
}

// ---------------------------------------------------------------------------
// Etapa 2 — enviar
// ---------------------------------------------------------------------------

/**
 * Consulta o gateway e grava o estado real da conexão.
 *
 * Chamada uma vez por estúdio a cada execução, antes de tentar enviar. Custa
 * uma requisição e evita o pior cenário do disparador: o banco dizendo
 * "conectado" enquanto a sessão caiu, com todas as mensagens do estúdio
 * gastando as quatro tentativas até serem dadas como falhas.
 */
export async function syncWhatsAppConnection(
  studioId: string,
  provider: WhatsAppProvider
): Promise<WhatsAppConnection> {
  const instanceName = instanceNameForStudio(studioId);
  try {
    const status = await provider.status(instanceName);
    return await saveWhatsAppConnection(studioId, {
      status: status.state,
      instance_name: instanceName,
      connected_phone: status.phone,
      last_error: status.state === "erro" ? status.error : null,
      ...(status.state === "conectado" ? { last_connected_at: new Date().toISOString() } : {}),
    });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Falha ao consultar o gateway";
    return saveWhatsAppConnection(studioId, {
      status: "erro",
      instance_name: instanceName,
      last_error: message,
    });
  }
}

export async function sendDueMessages(options?: {
  provider?: WhatsAppProvider | null;
  limit?: number;
  now?: Date;
}): Promise<Omit<DispatchReport, "planejadas" | "enfileiradas" | "canceladasPorCancelamento">> {
  const provider = options?.provider !== undefined ? options.provider : await getWhatsAppProvider();
  const now = options?.now ?? new Date();
  const limit = options?.limit ?? SEND_BATCH_LIMIT;

  const vazio = { reivindicadas: 0, enviadas: 0, falhas: 0, adiadas: 0, expiradas: 0 };

  if (!provider) {
    return {
      ...vazio,
      gateway: null,
      aviso:
        "Nenhum gateway configurado (EVOLUTION_API_URL/EVOLUTION_API_KEY). A fila continua sendo planejada, mas nada é enviado.",
    };
  }

  const claimed = await claimDueMessages(limit);
  if (claimed.length === 0) return { ...vazio, gateway: provider.name };

  // Um sync por estúdio, não por mensagem: dez lembretes do mesmo salão
  // compartilham a mesma sessão.
  const studioIds = [...new Set(claimed.map((m) => m.studio_id))];
  const connections = new Map<string, WhatsAppConnection>();
  for (const studioId of studioIds) {
    connections.set(studioId, await syncWhatsAppConnection(studioId, provider));
  }

  const staleBefore = new Date(now.getTime() - STALE_AFTER_MINUTES * 60_000);
  let enviadas = 0;
  let falhas = 0;
  let adiadas = 0;
  let expiradas = 0;

  for (const message of claimed) {
    // Mensagem velha demais não sai. Ver STALE_AFTER_MINUTES: o cenário é o
    // estúdio que passou dias desconectado e reconectou.
    if (new Date(message.scheduled_for) < staleBefore) {
      await cancelMessage(message.id, "Passou da hora — não faz mais sentido enviar");
      expiradas++;
      continue;
    }

    const connection = connections.get(message.studio_id);
    if (!connection || connection.status !== "conectado" || !connection.instance_name) {
      await releaseMessage(message, "WhatsApp do estúdio não está conectado");
      adiadas++;
      continue;
    }

    try {
      const { providerMessageId } = await provider.sendText({
        instanceName: connection.instance_name,
        toPhone: message.to_phone,
        body: message.body,
      });
      await markMessageSent(message.id, providerMessageId);
      enviadas++;
    } catch (cause) {
      const retryable = cause instanceof WhatsAppProviderError ? cause.retryable : true;
      const text = cause instanceof Error ? cause.message : "Falha desconhecida no envio";
      const outcome = await markMessageAttemptFailed(message, text, { retryable });
      if (outcome === "falhou") falhas++;
      else adiadas++;
    }
  }

  return { reivindicadas: claimed.length, enviadas, falhas, adiadas, expiradas, gateway: provider.name };
}

// ---------------------------------------------------------------------------
// Execução completa (o que a rota de cron chama)
// ---------------------------------------------------------------------------

export async function runReminderDispatch(now = new Date()): Promise<DispatchReport> {
  const plan = await planReminderQueue(now);
  const send = await sendDueMessages({ now });
  return { ...plan, ...send };
}
