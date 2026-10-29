import "server-only";
import { listPublicServices } from "@/lib/data/services";
import { listPublicWorkingHours } from "@/lib/data/workingHours";
import { createBookingServerSide } from "@/lib/data/bookings";
import { getStudioAdmin } from "@/lib/data/platformMetrics";
import { getWhatsAppConnection } from "@/lib/data/whatsapp";
import { recordSentReply } from "@/lib/data/conversations";
import { downloadStored } from "@/lib/data/conversationMedia";
import { loadAvailabilityWindow, slotsByDay } from "@/lib/data/publicAvailability";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/service";
import { getWhatsAppProvider } from "@/lib/whatsapp/provider";
import { phoneVariants, type InboundWhatsAppMessage } from "@/lib/whatsapp/inbound";
import {
  STUDIO_TIMEZONE,
  localDateTimeToUtc,
  utcToLocalDate,
} from "@/lib/availability";
import { formatDurationMin, formatPriceCents, formatTimeLocal } from "@/lib/format";
import { dayParts } from "@/lib/public-booking";
import { AGENT_TONES } from "@/lib/agent/providers";
import { runToolLoop, LlmError, type AgentTool, type ChatMessage } from "@/lib/agent/llm";
import { transcribeAudio } from "@/lib/agent/transcribe";
import {
  countRepliesToday,
  getAgentConfig,
  getChatPause,
  logRun,
  pauseChat,
  resolveLlmConfig,
  resolveTranscriptionConfig,
  type StudioAgent,
} from "@/lib/agent/data";
import type { Service, Studio } from "@/lib/types";

/**
 * O agente de IA do WhatsApp do estúdio.
 *
 * Caminho de uma mensagem: o webhook grava, chama `handleInboundForAgent`
 * depois da resposta (`after`), e o agente
 *   1. espera a cliente parar de digitar (várias mensagens seguidas viram uma
 *      resposta só);
 *   2. confere se está ligado, se a conversa não está com um humano e se o
 *      teto do dia não estourou;
 *   3. transcreve os áudios novos;
 *   4. monta a conversa, chama a IA com as ferramentas e manda a resposta pela
 *      instância do estúdio.
 *
 * Cada passo que decide NÃO responder deixa um registro em `agent_runs`, que é
 * o que a tela do superadmin mostra.
 */

/** Espera depois da última mensagem antes de responder. */
const DEBOUNCE_MS = 8_000;
/** Mensagem mais velha que isso não ganha resposta (entrega atrasada do gateway). */
const MAX_MESSAGE_AGE_MS = 10 * 60_000;
/** Quanto da conversa vai para a IA. */
const HISTORY_LIMIT = 24;
/** Dias que `ver_horarios` olha a partir da data pedida. */
const LOOKAHEAD_DAYS = 7;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// --- Prompt ------------------------------------------------------------------

const WEEKDAYS = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];

function nowInStudio(): string {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: STUDIO_TIMEZONE,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date());
}

function weeklyHours(shifts: { weekday: number; start_time: string; end_time: string }[]): string {
  const lines = WEEKDAYS.map((name, weekday) => {
    const day = shifts
      .filter((s) => s.weekday === weekday)
      .sort((a, b) => a.start_time.localeCompare(b.start_time))
      .map((s) => `${s.start_time.slice(0, 5)}–${s.end_time.slice(0, 5)}`);
    return `- ${name}: ${day.length > 0 ? day.join(", ") : "fechado"}`;
  });
  return lines.join("\n");
}

interface PromptContext {
  studio: Studio;
  agent: StudioAgent;
  services: Service[];
  shifts: { weekday: number; start_time: string; end_time: string }[];
  clientName: string | null;
  clientPhone: string | null;
}

function buildSystemPrompt(ctx: PromptContext): string {
  const { studio, agent, services } = ctx;
  const name = agent.assistant_name?.trim() || "a assistente virtual";
  const serviceLines = services
    .map(
      (s) =>
        `- ${s.name} — ${formatPriceCents(s.price_cents)}, ${formatDurationMin(s.duration_min)} (servico_id: ${s.id})`
    )
    .join("\n");

  return `Você é ${name} do ${studio.name}, respondendo clientes pelo WhatsApp do estúdio.

Agora é ${nowInStudio()} (horário de Brasília).

# O estúdio
Serviços (só estes existem; preço e duração exatos):
${serviceLines || "- (nenhum serviço cadastrado)"}

Horário de atendimento:
${weeklyHours(ctx.shifts)}

Link para a cliente agendar sozinha: ${process.env.NEXT_PUBLIC_SITE_URL ?? "https://projeto-agenda2026.vercel.app"}/${studio.slug}

# A cliente
${ctx.clientName ? `Nome no WhatsApp: ${ctx.clientName}.` : "Nome ainda não informado."}
${ctx.clientPhone ? `Telefone: ${ctx.clientPhone}.` : ""}

# Como responder
- Mensagens curtas, como numa conversa de WhatsApp. Nada de títulos ou listas longas. Para destacar, use *negrito* com asteriscos simples.
- ${AGENT_TONES[agent.tone].prompt}
- Responda só sobre o estúdio: serviços, preços, horários e agendamentos.
- NUNCA invente preço, serviço, horário livre ou informação que não esteja aqui (endereço, formas de pagamento, promoções). Se não souber, diga que vai confirmar com a equipe e use a ferramenta chamar_humano.
- Antes de oferecer qualquer horário, consulte a ferramenta ver_horarios. Ofereça poucas opções (2 ou 3), não a lista inteira.
${
  agent.can_book
    ? `- Para marcar: confirme com a cliente o serviço, o dia, o horário e o nome dela. Só então use marcar_horario. Depois de marcado, confirme os detalhes na resposta.`
    : `- Você NÃO marca horários. Quando a cliente quiser marcar, mande o link de agendamento acima.`
}
- Se a cliente perguntar dos horários dela, use meus_agendamentos.
- Cancelar ou remarcar: diga que vai passar para a equipe e use chamar_humano.
- Se a cliente pedir para falar com uma pessoa, reclamar, ou o assunto fugir do que você pode resolver, use chamar_humano.
- Mensagens entre colchetes, como [áudio] ou [foto], descrevem o que a cliente mandou.
${agent.instructions?.trim() ? `\n# Instruções do estúdio\n${agent.instructions.trim()}` : ""}`;
}

// --- Ferramentas -------------------------------------------------------------

interface ToolContext {
  studio: Studio;
  agent: StudioAgent;
  services: Service[];
  chatId: string;
  clientPhone: string | null;
  dryRun: boolean;
  /** Preenchido quando a ferramenta passou a conversa para um humano. */
  handoff: { reason: string } | null;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

function formatDayLabel(date: string): string {
  const { weekday, day } = dayParts(date);
  const month = date.slice(5, 7);
  return `${weekday} ${day}/${month}`;
}

function buildTools(ctx: ToolContext): AgentTool[] {
  const findService = (id: unknown) => ctx.services.find((s) => s.id === id);

  const verHorarios: AgentTool = {
    name: "ver_horarios",
    description:
      "Lista os horários livres de um serviço a partir de uma data, cobrindo os próximos 7 dias. Use sempre antes de oferecer horário.",
    parameters: {
      type: "object",
      properties: {
        servico_id: { type: "string", description: "O servico_id do serviço." },
        data: { type: "string", description: "Data inicial no formato AAAA-MM-DD." },
      },
      required: ["servico_id", "data"],
    },
    async run(args) {
      const service = findService(args.servico_id);
      if (!service) return "Erro: servico_id inválido. Use um dos ids da lista de serviços.";
      const today = utcToLocalDate(new Date());
      let from = typeof args.data === "string" && DATE_RE.test(args.data) ? args.data : today;
      if (from < today) from = today;

      const window = await loadAvailabilityWindow(ctx.studio.id, from, LOOKAHEAD_DAYS);
      const days = slotsByDay(window, service.duration_min, from, LOOKAHEAD_DAYS);
      const lines = days
        .filter((d) => d.slots.length > 0)
        .map((d) => {
          const times = d.slots.map((s) => formatTimeLocal(new Date(s.start)));
          const shown = times.slice(0, 10).join(", ");
          return `${formatDayLabel(d.date)} (${d.date}): ${shown}${times.length > 10 ? ` e mais ${times.length - 10}` : ""}`;
        });
      if (lines.length === 0) {
        return `Sem horário livre para ${service.name} entre ${formatDayLabel(from)} e os 7 dias seguintes.`;
      }
      return `Horários livres para ${service.name}:\n${lines.join("\n")}`;
    },
  };

  const marcarHorario: AgentTool = {
    name: "marcar_horario",
    description:
      "Marca o horário para a cliente desta conversa. Só use depois que ela confirmar serviço, dia, horário e nome.",
    parameters: {
      type: "object",
      properties: {
        servico_id: { type: "string", description: "O servico_id do serviço." },
        data: { type: "string", description: "Dia no formato AAAA-MM-DD." },
        hora: { type: "string", description: "Horário no formato HH:MM, um dos livres em ver_horarios." },
        nome_cliente: { type: "string", description: "Nome da cliente para o agendamento." },
      },
      required: ["servico_id", "data", "hora", "nome_cliente"],
    },
    async run(args) {
      const service = findService(args.servico_id);
      if (!service) return "Erro: servico_id inválido.";
      if (typeof args.data !== "string" || !DATE_RE.test(args.data)) return "Erro: data inválida (use AAAA-MM-DD).";
      if (typeof args.hora !== "string" || !TIME_RE.test(args.hora)) return "Erro: hora inválida (use HH:MM).";
      const name = typeof args.nome_cliente === "string" ? args.nome_cliente.trim().slice(0, 80) : "";
      if (name.length < 2) return "Erro: preciso do nome da cliente.";
      if (!ctx.clientPhone) return "Erro: não tenho o telefone desta conversa. Mande o link de agendamento.";

      const startAt = localDateTimeToUtc(args.data, `${args.hora}:00`);
      if (ctx.dryRun) {
        const window = await loadAvailabilityWindow(ctx.studio.id, args.data, 1);
        const free = slotsByDay(window, service.duration_min, args.data, 1)[0]?.slots ?? [];
        const ok = free.some((s) => new Date(s.start).getTime() === startAt.getTime());
        return ok
          ? `SIMULAÇÃO: o horário está livre e seria marcado (${service.name}, ${formatDayLabel(args.data)} às ${args.hora}, para ${name}). Nada foi gravado.`
          : "Esse horário não está mais livre. Consulte ver_horarios de novo e ofereça outro.";
      }

      const result = await createBookingServerSide({
        studioId: ctx.studio.id,
        serviceId: service.id,
        clientName: name,
        clientPhone: ctx.clientPhone,
        startAt,
      });
      if (!result.ok) {
        return result.error === "conflict"
          ? "Esse horário não está mais livre. Consulte ver_horarios de novo e ofereça outro."
          : "Erro: serviço indisponível.";
      }
      return `Marcado: ${service.name}, ${formatDayLabel(args.data)} às ${args.hora}, em nome de ${name}.`;
    },
  };

  const meusAgendamentos: AgentTool = {
    name: "meus_agendamentos",
    description: "Lista os próximos horários marcados da cliente desta conversa.",
    parameters: { type: "object", properties: {}, required: [] },
    async run() {
      if (!ctx.clientPhone) return "Não tenho o telefone desta conversa.";
      const supabase = createServiceRoleSupabaseClient();
      const { data, error } = await supabase
        .from("bookings")
        .select("start_at, service_id, status")
        .eq("studio_id", ctx.studio.id)
        .in("client_phone", phoneVariants(ctx.clientPhone))
        .gte("start_at", new Date().toISOString())
        .neq("status", "cancelado")
        .order("start_at")
        .limit(5);
      if (error) throw error;
      if (!data || data.length === 0) return "A cliente não tem horário marcado daqui para frente.";
      return data
        .map((b) => {
          const start = new Date(b.start_at);
          const service = ctx.services.find((s) => s.id === b.service_id);
          return `- ${service?.name ?? "Serviço"}: ${formatDayLabel(utcToLocalDate(start))} às ${formatTimeLocal(start)}`;
        })
        .join("\n");
    },
  };

  const chamarHumano: AgentTool = {
    name: "chamar_humano",
    description:
      "Passa a conversa para a equipe do estúdio e para de responder nela por um tempo. Use quando não souber responder, para cancelar/remarcar, reclamação ou quando a cliente pedir uma pessoa.",
    parameters: {
      type: "object",
      properties: { motivo: { type: "string", description: "Em poucas palavras, por que precisa de um humano." } },
      required: ["motivo"],
    },
    async run(args) {
      const reason = typeof args.motivo === "string" ? args.motivo.slice(0, 200) : "sem motivo";
      ctx.handoff = { reason };
      if (!ctx.dryRun) await pauseChat(ctx.studio.id, ctx.chatId, ctx.agent.handoff_hours, `Agente chamou a equipe: ${reason}`);
      return "Feito. Avise a cliente, numa frase, que alguém da equipe vai responder em breve.";
    },
  };

  return ctx.agent.can_book
    ? [verHorarios, marcarHorario, meusAgendamentos, chamarHumano]
    : [verHorarios, meusAgendamentos, chamarHumano];
}

// --- Gerar a resposta --------------------------------------------------------

export interface ReplyOutcome {
  text: string;
  toolsUsed: string[];
  inputTokens: number;
  outputTokens: number;
  handoff: { reason: string } | null;
  refused: boolean;
}

export async function generateReply(input: {
  studio: Studio;
  agent: StudioAgent;
  chatId: string;
  clientName: string | null;
  clientPhone: string | null;
  history: ChatMessage[];
  dryRun: boolean;
}): Promise<ReplyOutcome> {
  const llm = await resolveLlmConfig(input.agent);
  if (!llm) throw new LlmError("Configure o provedor, o modelo e a chave da IA");

  const [services, shifts] = await Promise.all([
    listPublicServices(input.studio.id),
    listPublicWorkingHours(input.studio.id),
  ]);
  const toolCtx: ToolContext = {
    studio: input.studio,
    agent: input.agent,
    services,
    chatId: input.chatId,
    clientPhone: input.clientPhone,
    dryRun: input.dryRun,
    handoff: null,
  };
  const system = buildSystemPrompt({
    studio: input.studio,
    agent: input.agent,
    services,
    shifts,
    clientName: input.clientName,
    clientPhone: input.clientPhone,
  });

  const result = await runToolLoop(llm, system, input.history, buildTools(toolCtx));
  return { ...result, handoff: toolCtx.handoff };
}

// --- Caminho do webhook ------------------------------------------------------

interface StoredMessage {
  id: string;
  direction: "recebida" | "enviada";
  message_type: string;
  body: string | null;
  transcript: string | null;
  provider_message_id: string;
  media_path: string | null;
  media_mime: string | null;
  chat_name: string | null;
  sent_at: string;
}

function describeForLlm(message: StoredMessage): string {
  switch (message.message_type) {
    case "texto":
      return message.body ?? "";
    case "audio":
      return message.transcript
        ? `[áudio] ${message.transcript}`
        : "[a cliente mandou um áudio que não deu para ouvir — peça para escrever]";
    case "imagem":
      return message.body ? `[foto com a legenda: ${message.body}]` : "[foto]";
    case "video":
      return message.body ? `[vídeo com a legenda: ${message.body}]` : "[vídeo]";
    case "documento":
      return `[documento${message.body ? `: ${message.body}` : ""}]`;
    case "figurinha":
      return "[figurinha]";
    default:
      return message.body ?? "[mensagem]";
  }
}

async function loadHistory(studioId: string, chatId: string): Promise<StoredMessage[]> {
  const supabase = createServiceRoleSupabaseClient();
  const { data, error } = await supabase
    .from("whatsapp_messages")
    .select("id, direction, message_type, body, transcript, provider_message_id, media_path, media_mime, chat_name, sent_at")
    .eq("studio_id", studioId)
    .eq("chat_id", chatId)
    .order("sent_at", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(HISTORY_LIMIT);
  if (error) throw error;
  return (data ?? []).reverse() as StoredMessage[];
}

/**
 * Transcreve os áudios que chegaram desde a última resposta e guarda o texto
 * na própria mensagem — na próxima volta ele já está lá.
 */
async function transcribePendingAudios(
  agent: StudioAgent,
  studioId: string,
  instanceName: string,
  history: StoredMessage[],
  rawById: Map<string, Record<string, unknown> | null | undefined>
): Promise<void> {
  const config = await resolveTranscriptionConfig(agent);
  if (!config) return;
  const lastReply = history.map((m) => m.direction).lastIndexOf("enviada");
  const pending = history
    .slice(lastReply + 1)
    .filter((m) => m.direction === "recebida" && m.message_type === "audio" && !m.transcript);
  if (pending.length === 0) return;

  const provider = await getWhatsAppProvider();
  const supabase = createServiceRoleSupabaseClient();
  for (const message of pending) {
    try {
      let audio: { bytes: Uint8Array; mimeType: string } | null = null;
      if (message.media_path) {
        const stored = await downloadStored(message.media_path);
        if (stored) audio = { bytes: stored.bytes, mimeType: message.media_mime ?? stored.type ?? "audio/ogg" };
      }
      if (!audio && provider) {
        const media = await provider.fetchMedia(
          instanceName,
          message.provider_message_id,
          rawById.get(message.provider_message_id) ?? null
        );
        if (media) audio = { bytes: new Uint8Array(Buffer.from(media.base64, "base64")), mimeType: media.mimeType };
      }
      if (!audio) continue;
      const text = await transcribeAudio(config, audio);
      if (!text) continue;
      message.transcript = text;
      await supabase.from("whatsapp_messages").update({ transcript: text }).eq("id", message.id);
    } catch (cause) {
      // Áudio que não transcreve não impede a resposta: o agente pede para
      // a cliente escrever.
      console.error("[agent] transcrição", cause instanceof Error ? cause.message : cause);
    }
  }
}

/**
 * Mensagem nova de cliente chegou pelo webhook. Roda dentro do `after` da
 * rota, então pode esperar sem segurar a resposta à Evolution.
 */
export async function handleInboundForAgent(
  studioId: string,
  instanceName: string,
  message: InboundWhatsAppMessage
): Promise<void> {
  if (message.fromMe || message.isGroup || !message.chatPhone) return;
  if (Date.now() - new Date(message.sentAt).getTime() > MAX_MESSAGE_AGE_MS) return;

  const agent = await getAgentConfig(studioId);
  if (!agent?.enabled) return;

  await sleep(DEBOUNCE_MS);
  const started = Date.now();

  // O registro grava o chat com o número da cliente quando ela é conhecida
  // (ver `recordInboundMessages`); o histórico é lido pelo chat gravado.
  const supabase = createServiceRoleSupabaseClient();
  const { data: stored, error: storedError } = await supabase
    .from("whatsapp_messages")
    .select("chat_id")
    .eq("studio_id", studioId)
    .eq("provider_message_id", message.providerMessageId)
    .maybeSingle();
  if (storedError) throw storedError;
  const chatId = stored?.chat_id ?? message.chatId;

  try {
    const history = await loadHistory(studioId, chatId);
    const latestInbound = [...history].reverse().find((m) => m.direction === "recebida");
    // Chegou mensagem mais nova: a execução dela responde por todas.
    if (!latestInbound || latestInbound.provider_message_id !== message.providerMessageId) return;
    // Alguém (humano ou outra execução) já respondeu depois desta mensagem.
    if (history[history.length - 1]?.direction === "enviada") return;

    const pause = await getChatPause(studioId, chatId);
    if (pause) {
      await logRun({ studioId, chatId, status: "pausado", detail: pause.reason ?? "Conversa com a equipe" });
      return;
    }

    if ((await countRepliesToday(studioId)) >= agent.max_replies_per_day) {
      await logRun({ studioId, chatId, status: "limite", detail: `Teto de ${agent.max_replies_per_day} respostas por dia` });
      return;
    }

    const connection = await getWhatsAppConnection(studioId);
    if (connection.status !== "conectado" || !connection.instance_name) {
      await logRun({ studioId, chatId, status: "erro", detail: "WhatsApp do estúdio não está conectado" });
      return;
    }

    const studio = await getStudioAdmin(studioId);
    if (!studio) return;

    await transcribePendingAudios(
      agent,
      studioId,
      instanceName,
      history,
      new Map([[message.providerMessageId, message.mediaContent]])
    );

    const reply = await generateReply({
      studio,
      agent,
      chatId,
      clientName: message.chatName ?? latestInbound.chat_name,
      clientPhone: message.chatPhone,
      history: history.map((m) => ({
        role: m.direction === "recebida" ? "user" : "assistant",
        content: describeForLlm(m),
      })),
      dryRun: false,
    });

    if (reply.refused || !reply.text) {
      await pauseChat(studioId, chatId, agent.handoff_hours, "A IA não respondeu; conversa passada para a equipe");
      await logRun({
        studioId,
        chatId,
        status: "humano",
        detail: reply.refused ? "A IA recusou responder" : "A IA não gerou resposta",
        toolsUsed: reply.toolsUsed,
        inputTokens: reply.inputTokens,
        outputTokens: reply.outputTokens,
        durationMs: Date.now() - started,
      });
      return;
    }

    const provider = await getWhatsAppProvider();
    if (!provider) throw new LlmError("Gateway do WhatsApp não configurado");
    const sent = await provider.sendText({
      instanceName: connection.instance_name,
      toPhone: message.chatPhone,
      body: reply.text,
    });
    await recordSentReply({
      studioId,
      chatId,
      chatPhone: message.chatPhone,
      clientId: null,
      body: reply.text,
      providerMessageId: sent.providerMessageId,
      sentBy: "agente",
    });

    await logRun({
      studioId,
      chatId,
      status: reply.handoff ? "humano" : "respondeu",
      detail: reply.handoff ? `Passou para a equipe: ${reply.handoff.reason}` : null,
      reply: reply.text,
      toolsUsed: reply.toolsUsed,
      inputTokens: reply.inputTokens,
      outputTokens: reply.outputTokens,
      durationMs: Date.now() - started,
    });
  } catch (cause) {
    console.error("[agent]", cause);
    await logRun({
      studioId,
      chatId,
      status: "erro",
      detail: cause instanceof Error ? cause.message : "Falha desconhecida",
      durationMs: Date.now() - started,
    });
  }
}

/**
 * Mensagem que o próprio estúdio mandou do CELULAR: um humano assumiu a
 * conversa e o agente se cala nela. Espera um pouco antes de decidir porque a
 * resposta do agente também pode voltar por este evento, e a marca de autoria
 * (`sent_by`) é gravada logo depois do envio.
 */
export async function handleOutgoingForAgent(
  studioId: string,
  message: InboundWhatsAppMessage
): Promise<void> {
  if (!message.fromMe || message.isGroup) return;
  const agent = await getAgentConfig(studioId);
  if (!agent?.enabled) return;

  await sleep(4_000);
  const supabase = createServiceRoleSupabaseClient();
  const { data, error } = await supabase
    .from("whatsapp_messages")
    .select("chat_id, sent_by")
    .eq("studio_id", studioId)
    .eq("provider_message_id", message.providerMessageId)
    .maybeSingle();
  if (error || !data || data.sent_by) return;
  await pauseChat(studioId, data.chat_id, agent.handoff_hours, "A equipe respondeu pelo celular");
}

// --- Simulador do superadmin -------------------------------------------------

/**
 * Conversa de teste: a mesma IA, o mesmo prompt e as mesmas ferramentas, mas
 * nada sai pelo WhatsApp e `marcar_horario` só confere se o horário está livre.
 */
export async function simulateAgent(
  studioId: string,
  history: ChatMessage[]
): Promise<ReplyOutcome & { durationMs: number }> {
  const [agent, studio] = await Promise.all([getAgentConfig(studioId), getStudioAdmin(studioId)]);
  if (!studio) throw new LlmError("Estúdio não encontrado");
  if (!agent) throw new LlmError("Salve a configuração do agente antes de testar");

  const started = Date.now();
  const reply = await generateReply({
    studio,
    agent,
    chatId: "simulacao",
    clientName: null,
    clientPhone: "5511900000000",
    history,
    dryRun: true,
  });
  const durationMs = Date.now() - started;
  await logRun({
    studioId,
    chatId: "simulacao",
    status: "simulacao",
    reply: reply.text,
    toolsUsed: reply.toolsUsed,
    inputTokens: reply.inputTokens,
    outputTokens: reply.outputTokens,
    durationMs,
  });
  return { ...reply, durationMs };
}
