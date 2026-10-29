import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/service";
import { isSupabaseServiceConfigured } from "@/lib/supabase/env";
import { isMissingTableError } from "@/lib/supabase/errors";
import { AGENT_PROVIDERS, classifyModel } from "@/lib/agent/providers";
import { LlmError } from "@/lib/agent/llm";
import { decryptSecret } from "@/lib/agent/secrets";
import type { AgentProvider, Database, IntegrationModel } from "@/lib/supabase/types";

/**
 * Integrações de IA (0027): as chaves de API cadastradas no superadmin.
 *
 * Ao cadastrar, a chave é validada no provedor e a lista de modelos que ela
 * libera fica guardada — é dela que sai o seletor de modelo no agente de cada
 * estúdio. "Atualizar modelos" lê de novo quando o provedor lança modelo novo.
 */

export type AiIntegration = Database["public"]["Tables"]["ai_integrations"]["Row"];

const LIST_TIMEOUT_MS = 15_000;

function sortModels(models: IntegrationModel[]): IntegrationModel[] {
  // Conversa primeiro, grátis antes de pago, e por nome dentro de cada grupo.
  const rank = { chat: 0, audio: 1, other: 2 } as const;
  return models.sort(
    (a, b) =>
      rank[a.kind] - rank[b.kind] ||
      Number(b.free) - Number(a.free) ||
      a.name.localeCompare(b.name)
  );
}

async function getJson(url: string, apiKey: string): Promise<unknown> {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${apiKey}` },
    signal: AbortSignal.timeout(LIST_TIMEOUT_MS),
  }).catch(() => {
    throw new LlmError("Não foi possível falar com o provedor");
  });
  const data = await res.json().catch(() => null);
  if (res.status === 401 || res.status === 403) throw new LlmError("Chave recusada pelo provedor", res.status);
  if (!res.ok) throw new LlmError(`O provedor respondeu com erro (HTTP ${res.status})`, res.status);
  return data;
}

interface OpenAiModelEntry {
  id?: string;
  name?: string;
  pricing?: { prompt?: string; completion?: string };
  supported_parameters?: string[];
}

function entries(data: unknown): OpenAiModelEntry[] {
  const list = (data as { data?: unknown })?.data;
  return Array.isArray(list) ? (list as OpenAiModelEntry[]) : [];
}

/** Valida a chave e devolve os modelos que ela libera. */
export async function listProviderModels(
  provider: AgentProvider,
  apiKey: string,
  baseUrl: string | null
): Promise<IntegrationModel[]> {
  if (provider === "anthropic") {
    const client = new Anthropic({ apiKey, maxRetries: 1, timeout: LIST_TIMEOUT_MS });
    const models: IntegrationModel[] = [];
    try {
      for await (const model of client.models.list({ limit: 1000 })) {
        models.push({ id: model.id, name: model.display_name, kind: "chat", free: false });
      }
    } catch (cause) {
      if (cause instanceof Anthropic.AuthenticationError || cause instanceof Anthropic.PermissionDeniedError) {
        throw new LlmError("Chave recusada pela Anthropic", cause.status);
      }
      throw new LlmError("Não foi possível falar com a Anthropic");
    }
    return sortModels(models);
  }

  const base = (provider === "custom" ? baseUrl : AGENT_PROVIDERS[provider].baseUrl)?.replace(/\/+$/, "");
  if (!base) throw new LlmError("Informe o endereço da API");

  if (provider === "openrouter") {
    // A lista de modelos do OpenRouter é pública; quem prova a chave é /key.
    await getJson(`${base}/key`, apiKey);
    const models = entries(await getJson(`${base}/models`, apiKey))
      .filter((m): m is OpenAiModelEntry & { id: string } => typeof m.id === "string")
      // O agente depende de ferramentas: modelo que não as aceita não serve.
      .filter((m) => !Array.isArray(m.supported_parameters) || m.supported_parameters.includes("tools"))
      .map((m) => ({
        id: m.id,
        name: m.name ?? m.id,
        kind: classifyModel(m.id),
        free: m.id.endsWith(":free") || (m.pricing?.prompt === "0" && m.pricing?.completion === "0"),
      }));
    return sortModels(models);
  }

  const free = provider === "gemini" || provider === "groq";
  const models = entries(await getJson(`${base}/models`, apiKey))
    .filter((m): m is OpenAiModelEntry & { id: string } => typeof m.id === "string")
    .map((m) => {
      const id = m.id.replace(/^models\//, "");
      return { id, name: m.name ?? id, kind: classifyModel(id), free };
    });
  return sortModels(models);
}

// --- Cadastro ----------------------------------------------------------------

export async function listIntegrations(): Promise<AiIntegration[]> {
  if (!isSupabaseServiceConfigured) return [];
  const supabase = createServiceRoleSupabaseClient();
  const { data, error } = await supabase.from("ai_integrations").select("*").order("name");
  if (error) {
    if (isMissingTableError(error)) return [];
    throw error;
  }
  return data ?? [];
}

export async function isIntegrationsSchemaReady(): Promise<boolean> {
  if (!isSupabaseServiceConfigured) return false;
  const supabase = createServiceRoleSupabaseClient();
  const { error } = await supabase.from("ai_integrations").select("id").limit(1);
  if (error && isMissingTableError(error)) return false;
  if (error) throw error;
  return true;
}

export async function getIntegration(id: string): Promise<AiIntegration | null> {
  const supabase = createServiceRoleSupabaseClient();
  const { data, error } = await supabase.from("ai_integrations").select("*").eq("id", id).maybeSingle();
  if (error) {
    if (isMissingTableError(error)) return null;
    throw error;
  }
  return data;
}

export async function insertIntegration(
  row: Database["public"]["Tables"]["ai_integrations"]["Insert"]
): Promise<AiIntegration> {
  const supabase = createServiceRoleSupabaseClient();
  const { data, error } = await supabase.from("ai_integrations").insert(row).select("*").single();
  if (error) throw error;
  return data;
}

export async function updateIntegration(
  id: string,
  patch: Database["public"]["Tables"]["ai_integrations"]["Update"]
): Promise<void> {
  const supabase = createServiceRoleSupabaseClient();
  const { error } = await supabase
    .from("ai_integrations")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function deleteIntegration(id: string): Promise<void> {
  const supabase = createServiceRoleSupabaseClient();
  const { error } = await supabase.from("ai_integrations").delete().eq("id", id);
  if (error) throw error;
}

/** Quantos estúdios usam cada integração (conversa ou áudio). */
export async function countIntegrationUsage(): Promise<Map<string, number>> {
  const usage = new Map<string, number>();
  if (!isSupabaseServiceConfigured) return usage;
  const supabase = createServiceRoleSupabaseClient();
  const { data, error } = await supabase
    .from("studio_agents")
    .select("integration_id, transcription_integration_id");
  if (error) {
    if (isMissingTableError(error) || (error as { code?: string }).code === "42703") return usage;
    throw error;
  }
  for (const row of data ?? []) {
    const ids = new Set([row.integration_id, row.transcription_integration_id].filter(Boolean) as string[]);
    for (const id of ids) usage.set(id, (usage.get(id) ?? 0) + 1);
  }
  return usage;
}

export function integrationApiKey(integration: AiIntegration): string {
  return decryptSecret(integration.api_key_encrypted);
}
