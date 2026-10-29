"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { checkPlatformAdmin } from "@/lib/data/platformAdmins";
import {
  getAgentConfig,
  resolveLlmConfig,
  saveAgentConfig,
  type StudioAgent,
  type StudioAgentPatch,
} from "@/lib/agent/data";
import { getIntegration } from "@/lib/agent/integrations";
import { getStudioAdmin } from "@/lib/data/platformMetrics";
import {
  WhatsAppProviderError,
  getWhatsAppProvider,
  instanceNameForStudio,
} from "@/lib/whatsapp/provider";
import { canTranscribe } from "@/lib/agent/providers";
import { LlmError, type ChatMessage } from "@/lib/agent/llm";
import { generateReply, simulateAgent } from "@/lib/agent/agent";

/**
 * Ações do agente de IA, por estúdio.
 *
 * Server Action é endpoint público: o layout do /superadmin esconde a tela de
 * quem não é `platform_admins`, mas não impede uma chamada direta — por isso
 * cada ação confere de novo. A chave de API só ENTRA por aqui; nenhuma ação a
 * devolve.
 */

type Result = { ok: true; message?: string } | { ok: false; error: string };

const SEM_ACESSO = "Acesso restrito.";

async function isAdmin(): Promise<boolean> {
  return (await checkPlatformAdmin()).status === "ok";
}

function friendly(cause: unknown): string {
  if (cause instanceof LlmError) return cause.message;
  console.error("[superadmin/agente]", cause);
  return "Algo deu errado. Tente de novo.";
}

const optionalId = z
  .string()
  .trim()
  .transform((v) => v || null)
  .refine((v) => v === null || /^[0-9a-f-]{36}$/i.test(v), "Integração inválida");

const configSchema = z.object({
  integrationId: z.string().trim().regex(/^[0-9a-f-]{36}$/i, "Escolha a integração de IA"),
  model: z.string().trim().min(1, "Escolha o modelo").max(200),
  transcriptionIntegrationId: optionalId,
  transcriptionModel: z.string().trim().max(200).transform((v) => v || null),
  assistantName: z.string().trim().max(60).transform((v) => v || null),
  tone: z.enum(["acolhedor", "profissional", "descontraido"]),
  instructions: z.string().trim().max(4000).transform((v) => v || null),
  canBook: z.boolean(),
  handoffHours: z.number().int().min(1).max(168),
  maxRepliesPerDay: z.number().int().min(1).max(5000),
});

export type AgentConfigInput = z.input<typeof configSchema>;

export async function saveAgentConfigAction(studioId: string, input: AgentConfigInput): Promise<Result> {
  if (!(await isAdmin())) return { ok: false, error: SEM_ACESSO };
  const parsed = configSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  const v = parsed.data;

  try {
    const integration = await getIntegration(v.integrationId);
    if (!integration) return { ok: false, error: "Essa integração não existe mais." };
    if (v.transcriptionIntegrationId) {
      const audio = await getIntegration(v.transcriptionIntegrationId);
      if (!audio || !canTranscribe(audio.provider)) {
        return { ok: false, error: "A integração escolhida para áudio não transcreve (use Groq ou OpenAI)." };
      }
    }

    const patch: StudioAgentPatch = {
      integration_id: integration.id,
      // Espelha o provedor para a lista do superadmin saber o que mostrar.
      provider: integration.provider,
      model: v.model,
      transcription_integration_id: v.transcriptionIntegrationId,
      transcription_model: v.transcriptionIntegrationId ? v.transcriptionModel : null,
      transcription_provider: "desligado",
      assistant_name: v.assistantName,
      tone: v.tone,
      instructions: v.instructions,
      can_book: v.canBook,
      handoff_hours: v.handoffHours,
      max_replies_per_day: v.maxRepliesPerDay,
    };
    await saveAgentConfig(studioId, patch);
  } catch (cause) {
    return { ok: false, error: friendly(cause) };
  }
  revalidatePath("/superadmin/agente");
  revalidatePath(`/superadmin/agente/${studioId}`);
  return { ok: true, message: "Configuração salva." };
}

export async function toggleAgentAction(studioId: string, enabled: boolean): Promise<Result> {
  if (!(await isAdmin())) return { ok: false, error: SEM_ACESSO };
  try {
    if (enabled) {
      const current = await getAgentConfig(studioId);
      if (!current || !(await resolveLlmConfig(current))) {
        return { ok: false, error: "Escolha a integração e o modelo e salve antes de ligar." };
      }
    }
    await saveAgentConfig(studioId, { enabled });
  } catch (cause) {
    return { ok: false, error: friendly(cause) };
  }
  revalidatePath("/superadmin/agente");
  revalidatePath(`/superadmin/agente/${studioId}`);
  return { ok: true, message: enabled ? "Agente ligado." : "Agente desligado." };
}

/** A pergunta do teste: pede serviço, preço e horário, então exercita as ferramentas. */
const TEST_QUESTION = "Oi! Quais serviços vocês fazem e quanto custa? Tem horário amanhã?";

export type ConnectionTestResult =
  | {
      ok: true;
      question: string;
      reply: string;
      toolsUsed: string[];
      seconds: number;
      whatsapp: { ok: boolean; text: string };
    }
  | { ok: false; error: string; whatsapp?: { ok: boolean; text: string } };

/**
 * O WhatsApp do estúdio, perguntado ao gateway AGORA — não o que está gravado.
 * É o que separa "a IA não respondeu" de "a IA respondeu mas nada sai".
 */
async function checkStudioWhatsApp(studioId: string): Promise<{ ok: boolean; text: string }> {
  const provider = await getWhatsAppProvider();
  if (!provider) return { ok: false, text: "Gateway do WhatsApp não configurado neste ambiente." };
  try {
    const status = await provider.status(instanceNameForStudio(studioId));
    if (status.state === "conectado") {
      return { ok: true, text: `Conectado${status.phone ? ` (${status.phone})` : ""}. As respostas vão sair.` };
    }
    return {
      ok: false,
      text: "O WhatsApp do estúdio não está conectado. A IA funciona, mas nada sai até o dono ler o QR em /app/whatsapp.",
    };
  } catch (cause) {
    return {
      ok: false,
      text:
        cause instanceof WhatsAppProviderError
          ? `Servidor do WhatsApp (Evolution) inacessível: ${cause.message}.`
          : "Não foi possível consultar o servidor do WhatsApp.",
    };
  }
}

/**
 * Teste de ponta a ponta com o que está NA TELA, sem precisar salvar: o
 * agente de verdade (instruções do sistema, tom, instruções do estúdio,
 * ferramentas) responde uma pergunta de cliente, e o WhatsApp do estúdio é
 * conferido ao vivo. Nada sai pelo WhatsApp e nada é marcado.
 */
export async function testAgentConnectionAction(
  studioId: string,
  input: AgentConfigInput
): Promise<ConnectionTestResult> {
  if (!(await isAdmin())) return { ok: false, error: SEM_ACESSO };
  const parsed = configSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  const v = parsed.data;

  // Em paralelo com a IA: com a Evolution fora do ar, esperar o WhatsApp
  // antes atrasaria o teste inteiro pelo tempo limite do gateway.
  const whatsappCheck = checkStudioWhatsApp(studioId);
  try {
    const [studio, saved, integration] = await Promise.all([
      getStudioAdmin(studioId),
      getAgentConfig(studioId),
      getIntegration(v.integrationId),
    ]);
    if (!studio) return { ok: false, error: "Estúdio não encontrado.", whatsapp: await whatsappCheck };
    if (!integration) return { ok: false, error: "Essa integração não existe mais.", whatsapp: await whatsappCheck };

    const now = new Date().toISOString();
    // A configuração da tela por cima da salva (ou de uma vazia).
    const draft: StudioAgent = {
      studio_id: studioId,
      enabled: saved?.enabled ?? false,
      provider: integration.provider,
      base_url: null,
      model: v.model,
      api_key_encrypted: null,
      api_key_last4: null,
      transcription_provider: "desligado",
      transcription_base_url: null,
      transcription_model: v.transcriptionModel,
      transcription_key_encrypted: null,
      transcription_key_last4: null,
      assistant_name: v.assistantName,
      tone: v.tone,
      instructions: v.instructions,
      can_book: v.canBook,
      handoff_hours: v.handoffHours,
      max_replies_per_day: v.maxRepliesPerDay,
      integration_id: integration.id,
      transcription_integration_id: v.transcriptionIntegrationId,
      created_at: saved?.created_at ?? now,
      updated_at: now,
    };

    const started = Date.now();
    const reply = await generateReply({
      studio,
      agent: draft,
      chatId: "teste-conexao",
      clientName: null,
      clientPhone: "5511900000000",
      history: [{ role: "user", content: TEST_QUESTION }],
      dryRun: true,
    });
    return {
      ok: true,
      question: TEST_QUESTION,
      reply: reply.refused ? "(a IA recusou responder)" : reply.text || "(a IA não gerou resposta)",
      toolsUsed: reply.toolsUsed,
      seconds: Math.round((Date.now() - started) / 100) / 10,
      whatsapp: await whatsappCheck,
    };
  } catch (cause) {
    return { ok: false, error: friendly(cause), whatsapp: await whatsappCheck };
  }
}

const historySchema = z
  .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().trim().min(1).max(2000) }))
  .min(1)
  .max(30);

export type SimulationResult =
  | { ok: true; reply: string; toolsUsed: string[]; handoff: string | null; seconds: number }
  | { ok: false; error: string };

export async function simulateAgentAction(studioId: string, history: ChatMessage[]): Promise<SimulationResult> {
  if (!(await isAdmin())) return { ok: false, error: SEM_ACESSO };
  const parsed = historySchema.safeParse(history);
  if (!parsed.success) return { ok: false, error: "Conversa inválida" };
  try {
    const result = await simulateAgent(studioId, parsed.data);
    return {
      ok: true,
      reply: result.refused ? "(a IA recusou responder)" : result.text || "(a IA não gerou resposta)",
      toolsUsed: result.toolsUsed,
      handoff: result.handoff?.reason ?? null,
      seconds: Math.round(result.durationMs / 100) / 10,
    };
  } catch (cause) {
    return { ok: false, error: friendly(cause) };
  }
}
