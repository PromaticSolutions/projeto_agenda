"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { checkPlatformAdmin } from "@/lib/data/platformAdmins";
import {
  deleteIntegration,
  getIntegration,
  insertIntegration,
  integrationApiKey,
  listProviderModels,
  updateIntegration,
} from "@/lib/agent/integrations";
import { AGENT_PROVIDERS, detectProviderFromKey } from "@/lib/agent/providers";
import { encryptSecret, lastFour } from "@/lib/agent/secrets";
import { LlmError } from "@/lib/agent/llm";

/**
 * Ações das integrações de IA. Server Action é endpoint público: cada uma
 * confere `platform_admins` de novo. A chave entra por aqui e nunca volta.
 */

export type IntegrationResult = { ok: true; message: string } | { ok: false; error: string; needsProvider?: boolean };

const SEM_ACESSO = "Acesso restrito.";

async function isAdmin(): Promise<boolean> {
  return (await checkPlatformAdmin()).status === "ok";
}

function friendly(cause: unknown): string {
  if (cause instanceof LlmError) return cause.message;
  console.error("[superadmin/integracoes]", cause);
  return "Algo deu errado. Tente de novo.";
}

function revalidate() {
  revalidatePath("/superadmin/integracoes");
  revalidatePath("/superadmin/agente", "layout");
}

const createSchema = z.object({
  name: z.string().trim().min(1, "Dê um apelido para a integração").max(60),
  apiKey: z.string().trim().min(8, "Cole a chave de API"),
  // "auto" = descobrir pela chave.
  provider: z.enum(["auto", "gemini", "groq", "openrouter", "openai", "anthropic", "custom"]),
  baseUrl: z
    .string()
    .trim()
    .max(300)
    .refine((v) => v === "" || /^https?:\/\/\S+$/.test(v), "Endereço deve começar com http:// ou https://"),
});

export type CreateIntegrationInput = z.input<typeof createSchema>;

export async function createIntegrationAction(input: CreateIntegrationInput): Promise<IntegrationResult> {
  if (!(await isAdmin())) return { ok: false, error: SEM_ACESSO };
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  const v = parsed.data;

  const provider = v.provider === "auto" ? (v.baseUrl ? "custom" : detectProviderFromKey(v.apiKey)) : v.provider;
  if (!provider) {
    return {
      ok: false,
      needsProvider: true,
      error: "Não reconheci de qual provedor é essa chave. Escolha o provedor abaixo.",
    };
  }
  if (provider === "custom" && !v.baseUrl) {
    return { ok: false, error: "Informe o endereço da API personalizada." };
  }

  try {
    const models = await listProviderModels(provider, v.apiKey, v.baseUrl || null);
    const chat = models.filter((m) => m.kind === "chat");
    if (chat.length === 0) {
      return { ok: false, error: "A chave funcionou, mas não liberou nenhum modelo de conversa." };
    }
    await insertIntegration({
      name: v.name,
      provider,
      base_url: provider === "custom" ? v.baseUrl : null,
      api_key_encrypted: encryptSecret(v.apiKey),
      api_key_last4: lastFour(v.apiKey),
      models,
      models_updated_at: new Date().toISOString(),
    });
    revalidate();
    const free = chat.filter((m) => m.free).length;
    const audio = models.filter((m) => m.kind === "audio").length;
    return {
      ok: true,
      message: `Conectado: ${AGENT_PROVIDERS[provider].label} · ${chat.length} modelos de conversa${
        free > 0 && free < chat.length ? ` (${free} grátis)` : ""
      }${audio > 0 ? ` · ${audio} de áudio` : ""}.`,
    };
  } catch (cause) {
    return { ok: false, error: friendly(cause) };
  }
}

export async function refreshIntegrationModelsAction(id: string): Promise<IntegrationResult> {
  if (!(await isAdmin())) return { ok: false, error: SEM_ACESSO };
  try {
    const integration = await getIntegration(id);
    if (!integration) return { ok: false, error: "Essa integração não existe mais." };
    try {
      const models = await listProviderModels(
        integration.provider,
        integrationApiKey(integration),
        integration.base_url
      );
      await updateIntegration(id, { models, models_updated_at: new Date().toISOString(), last_error: null });
      revalidate();
      return { ok: true, message: `${models.filter((m) => m.kind === "chat").length} modelos de conversa.` };
    } catch (cause) {
      const error = friendly(cause);
      await updateIntegration(id, { last_error: error });
      revalidate();
      return { ok: false, error };
    }
  } catch (cause) {
    return { ok: false, error: friendly(cause) };
  }
}

export async function renameIntegrationAction(id: string, name: string): Promise<IntegrationResult> {
  if (!(await isAdmin())) return { ok: false, error: SEM_ACESSO };
  const clean = name.trim();
  if (!clean || clean.length > 60) return { ok: false, error: "Apelido entre 1 e 60 caracteres." };
  try {
    await updateIntegration(id, { name: clean });
    revalidate();
    return { ok: true, message: "Apelido salvo." };
  } catch (cause) {
    return { ok: false, error: friendly(cause) };
  }
}

/**
 * Exclui a integração. Os estúdios que a usavam ficam sem IA (a referência
 * vira nula) e o agente deles para de responder até escolherem outra.
 */
export async function deleteIntegrationAction(id: string): Promise<IntegrationResult> {
  if (!(await isAdmin())) return { ok: false, error: SEM_ACESSO };
  try {
    await deleteIntegration(id);
    revalidate();
    return { ok: true, message: "Integração excluída." };
  } catch (cause) {
    return { ok: false, error: friendly(cause) };
  }
}
