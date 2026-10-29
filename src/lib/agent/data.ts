import "server-only";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/service";
import { isSupabaseServiceConfigured } from "@/lib/supabase/env";
import { isMissingTableError } from "@/lib/supabase/errors";
import { decryptSecret } from "@/lib/agent/secrets";
import { getIntegration, integrationApiKey } from "@/lib/agent/integrations";
import { canTranscribe } from "@/lib/agent/providers";
import { utcToLocalDate, localDayRangeUtc } from "@/lib/availability";
import type { LlmConfig } from "@/lib/agent/llm";
import type { TranscriptionConfig } from "@/lib/agent/transcribe";
import type { AgentRunStatus, Database } from "@/lib/supabase/types";

/**
 * Leitura e escrita do agente de IA (0026). Tudo pela service_role: as três
 * tabelas não têm policy, e quem chama é o webhook (sem sessão) ou o
 * superadmin (que já conferiu `platform_admins`).
 */

export type StudioAgent = Database["public"]["Tables"]["studio_agents"]["Row"];
export type StudioAgentPatch = Database["public"]["Tables"]["studio_agents"]["Update"];
export type AgentRun = Database["public"]["Tables"]["agent_runs"]["Row"];

export async function getAgentConfig(studioId: string): Promise<StudioAgent | null> {
  if (!isSupabaseServiceConfigured) return null;
  const supabase = createServiceRoleSupabaseClient();
  const { data, error } = await supabase
    .from("studio_agents")
    .select("*")
    .eq("studio_id", studioId)
    .maybeSingle();
  if (error) {
    // Código no ar antes da 0026: o agente simplesmente não existe ainda.
    if (isMissingTableError(error)) return null;
    throw error;
  }
  return data;
}

export async function listAgentConfigs(): Promise<Map<string, StudioAgent>> {
  if (!isSupabaseServiceConfigured) return new Map();
  const supabase = createServiceRoleSupabaseClient();
  const { data, error } = await supabase.from("studio_agents").select("*");
  if (error) {
    if (isMissingTableError(error)) return new Map();
    throw error;
  }
  return new Map((data ?? []).map((row) => [row.studio_id, row]));
}

/** Falso quando a 0026 ainda não rodou — a tela avisa em vez de quebrar. */
export async function isAgentSchemaReady(): Promise<boolean> {
  if (!isSupabaseServiceConfigured) return false;
  const supabase = createServiceRoleSupabaseClient();
  const { error } = await supabase.from("studio_agents").select("studio_id").limit(1);
  if (error && isMissingTableError(error)) return false;
  if (error) throw error;
  return true;
}

export async function saveAgentConfig(studioId: string, patch: StudioAgentPatch): Promise<StudioAgent> {
  const supabase = createServiceRoleSupabaseClient();
  const { data, error } = await supabase
    .from("studio_agents")
    .upsert({ ...patch, studio_id: studioId, updated_at: new Date().toISOString() }, { onConflict: "studio_id" })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

/**
 * A IA de conversa, com a chave já decifrada. Nulo = configuração incompleta.
 *
 * A integração escolhida (0027) manda; sem ela, vale a chave própria do
 * estúdio gravada pela 0026.
 */
export async function resolveLlmConfig(agent: StudioAgent): Promise<LlmConfig | null> {
  if (!agent.model) return null;
  if (agent.integration_id) {
    const integration = await getIntegration(agent.integration_id);
    if (!integration) return null;
    return {
      provider: integration.provider,
      baseUrl: integration.provider === "custom" ? integration.base_url : null,
      model: agent.model,
      apiKey: integrationApiKey(integration),
    };
  }
  if (!agent.api_key_encrypted) return null;
  if (agent.provider === "custom" && !agent.base_url) return null;
  return {
    provider: agent.provider,
    baseUrl: agent.provider === "custom" ? agent.base_url : null,
    model: agent.model,
    apiKey: decryptSecret(agent.api_key_encrypted),
  };
}

/**
 * A transcrição, com a chave decifrada. Pela integração escolhida (0027) ou,
 * sem ela, pela configuração da 0026 — que reaproveita a chave da conversa
 * quando o provedor é o mesmo.
 */
export async function resolveTranscriptionConfig(agent: StudioAgent): Promise<TranscriptionConfig | null> {
  if (agent.transcription_integration_id) {
    const integration = await getIntegration(agent.transcription_integration_id);
    if (!integration || !canTranscribe(integration.provider)) return null;
    return {
      provider: integration.provider as TranscriptionConfig["provider"],
      baseUrl: integration.provider === "custom" ? integration.base_url : null,
      model: agent.transcription_model,
      apiKey: integrationApiKey(integration),
    };
  }
  if (agent.transcription_provider === "desligado") return null;
  const sameProvider = agent.transcription_provider === agent.provider;
  const encrypted =
    agent.transcription_key_encrypted ?? (sameProvider ? agent.api_key_encrypted : null);
  if (!encrypted) return null;
  if (agent.transcription_provider === "custom" && !agent.transcription_base_url) return null;
  return {
    provider: agent.transcription_provider,
    baseUrl: agent.transcription_provider === "custom" ? agent.transcription_base_url : null,
    model: agent.transcription_model,
    apiKey: decryptSecret(encrypted),
  };
}

// --- Pausa por conversa ------------------------------------------------------

export async function pauseChat(
  studioId: string,
  chatId: string,
  hours: number,
  reason: string
): Promise<void> {
  const supabase = createServiceRoleSupabaseClient();
  const until = new Date(Date.now() + hours * 3_600_000).toISOString();
  const { error } = await supabase.from("agent_chat_state").upsert(
    {
      studio_id: studioId,
      chat_id: chatId,
      paused_until: until,
      paused_reason: reason.slice(0, 200),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "studio_id,chat_id" }
  );
  if (error) throw error;
}

export async function getChatPause(
  studioId: string,
  chatId: string
): Promise<{ until: string; reason: string | null } | null> {
  const supabase = createServiceRoleSupabaseClient();
  const { data, error } = await supabase
    .from("agent_chat_state")
    .select("paused_until, paused_reason")
    .eq("studio_id", studioId)
    .eq("chat_id", chatId)
    .maybeSingle();
  if (error) throw error;
  if (!data?.paused_until || new Date(data.paused_until) <= new Date()) return null;
  return { until: data.paused_until, reason: data.paused_reason };
}

/**
 * Um humano respondeu (painel ou celular): o agente se cala nesta conversa
 * pelo tempo configurado. Sem agente ligado, não faz nada.
 */
export async function pauseAgentForHumanReply(
  studioId: string,
  chatId: string,
  reason: string
): Promise<void> {
  const agent = await getAgentConfig(studioId);
  if (!agent?.enabled) return;
  await pauseChat(studioId, chatId, agent.handoff_hours, reason);
}

// --- Registro ----------------------------------------------------------------

export interface RunRecord {
  studioId: string;
  chatId: string;
  status: AgentRunStatus;
  detail?: string | null;
  reply?: string | null;
  toolsUsed?: string[];
  inputTokens?: number | null;
  outputTokens?: number | null;
  durationMs?: number | null;
}

/** Nunca derruba quem chamou: o registro é para a tela, não para o fluxo. */
export async function logRun(run: RunRecord): Promise<void> {
  try {
    const supabase = createServiceRoleSupabaseClient();
    const { error } = await supabase.from("agent_runs").insert({
      studio_id: run.studioId,
      chat_id: run.chatId,
      status: run.status,
      detail: run.detail?.slice(0, 500) ?? null,
      reply: run.reply?.slice(0, 2000) ?? null,
      tools_used: run.toolsUsed ?? [],
      input_tokens: run.inputTokens ?? null,
      output_tokens: run.outputTokens ?? null,
      duration_ms: run.durationMs ?? null,
    });
    if (error) throw error;
  } catch (cause) {
    console.error("[agent] registro", cause);
  }
}

export async function listRecentRuns(studioId: string, limit = 30): Promise<AgentRun[]> {
  const supabase = createServiceRoleSupabaseClient();
  const { data, error } = await supabase
    .from("agent_runs")
    .select("*")
    .eq("studio_id", studioId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) {
    if (isMissingTableError(error)) return [];
    throw error;
  }
  return data ?? [];
}

function todayStartIso(): string {
  return localDayRangeUtc(utcToLocalDate(new Date())).start.toISOString();
}

/** Respostas enviadas hoje (fuso do estúdio) — o teto diário. */
export async function countRepliesToday(studioId: string): Promise<number> {
  const supabase = createServiceRoleSupabaseClient();
  const { count, error } = await supabase
    .from("agent_runs")
    .select("id", { count: "exact", head: true })
    .eq("studio_id", studioId)
    .eq("status", "respondeu")
    .gte("created_at", todayStartIso());
  if (error) throw error;
  return count ?? 0;
}

export interface AgentDaySummary {
  repliesToday: number;
  lastError: { detail: string | null; at: string } | null;
}

/** Resumo de hoje por estúdio, para a lista do superadmin. */
export async function summarizeAgentsToday(): Promise<Map<string, AgentDaySummary>> {
  const result = new Map<string, AgentDaySummary>();
  if (!isSupabaseServiceConfigured) return result;
  const supabase = createServiceRoleSupabaseClient();
  const { data, error } = await supabase
    .from("agent_runs")
    .select("studio_id, status, detail, created_at")
    .gte("created_at", todayStartIso())
    .in("status", ["respondeu", "erro"])
    .order("created_at", { ascending: false })
    .limit(5000);
  if (error) {
    if (isMissingTableError(error)) return result;
    throw error;
  }
  for (const row of data ?? []) {
    const entry = result.get(row.studio_id) ?? { repliesToday: 0, lastError: null };
    if (row.status === "respondeu") entry.repliesToday++;
    if (row.status === "erro" && !entry.lastError) entry.lastError = { detail: row.detail, at: row.created_at };
    result.set(row.studio_id, entry);
  }
  return result;
}
