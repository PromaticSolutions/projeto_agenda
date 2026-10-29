import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { AGENT_PROVIDERS } from "@/lib/agent/providers";
import type { AgentProvider } from "@/lib/supabase/types";

/**
 * O laço "pergunta → ferramenta → resposta" com qualquer provedor.
 *
 * Dois adaptadores atrás da mesma função: o do formato de chat da OpenAI, que
 * Gemini, Groq, OpenRouter, OpenAI e as APIs personalizadas falam, e o da
 * Anthropic, pelo SDK oficial. Quem chama não sabe qual rodou — passa as
 * ferramentas e recebe o texto final.
 */

export interface LlmConfig {
  provider: AgentProvider;
  baseUrl: string | null;
  model: string;
  apiKey: string;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface AgentTool {
  name: string;
  description: string;
  /** JSON Schema de um objeto. */
  parameters: {
    type: "object";
    properties: Record<string, unknown>;
    required: string[];
  };
  run(args: Record<string, unknown>): Promise<string>;
}

export interface ToolLoopResult {
  text: string;
  toolsUsed: string[];
  inputTokens: number;
  outputTokens: number;
  /** O modelo recusou responder (filtro de segurança do provedor). */
  refused: boolean;
}

/** Erro do provedor com uma mensagem que a tela do superadmin consegue mostrar. */
export class LlmError extends Error {
  constructor(
    message: string,
    readonly status: number | null = null
  ) {
    super(message);
    this.name = "LlmError";
  }
}

/** Voltas de ferramenta por resposta: o bastante para ver horário e marcar. */
const MAX_STEPS = 6;

/**
 * Modelos Claude que aceitam o fallback do servidor: se o modelo recusar por
 * engano, a Anthropic refaz o pedido em outro modelo dentro da mesma chamada.
 */
const SERVER_FALLBACK_MODELS = /^claude-(opus-5-5|opus-5|sonnet-5-5|fable-5-1)$/;

export async function runToolLoop(
  config: LlmConfig,
  system: string,
  history: ChatMessage[],
  tools: AgentTool[],
  timeoutMs = 35_000
): Promise<ToolLoopResult> {
  // Os dois formatos querem a conversa começando pela cliente.
  const firstUser = history.findIndex((m) => m.role === "user");
  const messages = firstUser === -1 ? [] : history.slice(firstUser);
  if (messages.length === 0) throw new LlmError("Nada para responder");

  const deadline = Date.now() + timeoutMs;
  return AGENT_PROVIDERS[config.provider].kind === "anthropic"
    ? anthropicLoop(config, system, messages, tools, deadline)
    : openAiLoop(config, system, messages, tools, deadline);
}

function remaining(deadline: number): number {
  const left = deadline - Date.now();
  if (left <= 1000) throw new LlmError("A IA demorou demais para responder");
  return left;
}

async function runTool(tool: AgentTool | undefined, args: unknown): Promise<string> {
  if (!tool) return "Erro: ferramenta desconhecida.";
  if (!args || typeof args !== "object" || Array.isArray(args)) return "Erro: argumentos inválidos.";
  try {
    return await tool.run(args as Record<string, unknown>);
  } catch (cause) {
    console.error(`[agent/tool] ${tool.name}`, cause);
    return "Erro ao executar. Diga à cliente que vai confirmar com o estúdio.";
  }
}

// --- Formato OpenAI ----------------------------------------------------------

interface OpenAiToolCall {
  id?: string;
  type?: string;
  function?: { name?: string; arguments?: string };
}

interface OpenAiMessage {
  role: string;
  content?: string | null;
  tool_calls?: OpenAiToolCall[];
  tool_call_id?: string;
}

function chatCompletionsUrl(config: LlmConfig): string {
  const base = config.baseUrl ?? AGENT_PROVIDERS[config.provider].baseUrl;
  if (!base) throw new LlmError("Informe o endereço da API");
  return `${base.replace(/\/+$/, "")}/chat/completions`;
}

async function openAiLoop(
  config: LlmConfig,
  system: string,
  history: ChatMessage[],
  tools: AgentTool[],
  deadline: number
): Promise<ToolLoopResult> {
  const url = chatCompletionsUrl(config);
  const byName = new Map(tools.map((t) => [t.name, t]));
  const messages: OpenAiMessage[] = [{ role: "system", content: system }, ...history];
  const toolsUsed: string[] = [];
  let inputTokens = 0;
  let outputTokens = 0;

  for (let step = 0; step < MAX_STEPS; step++) {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`,
        // Opcional no OpenRouter; identifica o app no painel deles.
        ...(config.provider === "openrouter" ? { "X-OpenRouter-Title": "Timely" } : {}),
      },
      body: JSON.stringify({
        model: config.model,
        messages,
        ...(tools.length > 0
          ? {
              tools: tools.map((t) => ({
                type: "function",
                function: { name: t.name, description: t.description, parameters: t.parameters },
              })),
              tool_choice: "auto",
            }
          : {}),
      }),
      signal: AbortSignal.timeout(remaining(deadline)),
    }).catch((cause: unknown) => {
      throw new LlmError(
        cause instanceof Error && cause.name === "TimeoutError"
          ? "A IA demorou demais para responder"
          : "Não foi possível falar com a API da IA"
      );
    });

    const data = (await res.json().catch(() => null)) as {
      choices?: { message?: OpenAiMessage }[];
      usage?: { prompt_tokens?: number; completion_tokens?: number };
      error?: { message?: string } | string;
    } | null;

    if (!res.ok) throw new LlmError(describeHttpError(res.status, data?.error), res.status);

    inputTokens += data?.usage?.prompt_tokens ?? 0;
    outputTokens += data?.usage?.completion_tokens ?? 0;

    const message = data?.choices?.[0]?.message;
    if (!message) throw new LlmError("A IA respondeu num formato inesperado");

    const calls = message.tool_calls ?? [];
    if (calls.length === 0) {
      return { text: (message.content ?? "").trim(), toolsUsed, inputTokens, outputTokens, refused: false };
    }

    // Alguns provedores não mandam id na chamada; o id local só precisa casar
    // a resposta da ferramenta com a chamada dentro desta conversa.
    const withIds = calls.map((call, i) => ({ ...call, id: call.id || `call_${step}_${i}` }));
    messages.push({ role: "assistant", content: message.content ?? null, tool_calls: withIds });
    for (const call of withIds) {
      const name = call.function?.name ?? "";
      toolsUsed.push(name);
      let args: unknown = null;
      try {
        args = JSON.parse(call.function?.arguments || "{}");
      } catch {
        args = null;
      }
      messages.push({ role: "tool", tool_call_id: call.id, content: await runTool(byName.get(name), args) });
    }
  }

  throw new LlmError("A IA entrou em laço de ferramentas sem responder");
}

function describeHttpError(status: number, error: unknown): string {
  const detail =
    typeof error === "string" ? error : error && typeof error === "object" && "message" in error
      ? String((error as { message?: unknown }).message ?? "")
      : "";
  const short = detail ? ` (${detail.slice(0, 160)})` : "";
  if (status === 401 || status === 403) return `Chave de API recusada pelo provedor${short}`;
  if (status === 404) return `Modelo ou endereço não encontrado${short}`;
  if (status === 429) return `Limite de uso do provedor atingido — tente mais tarde${short}`;
  if (status >= 500) return `O provedor da IA está com problema agora${short}`;
  return `A IA recusou o pedido (HTTP ${status})${short}`;
}

// --- Anthropic -------------------------------------------------------------

async function anthropicLoop(
  config: LlmConfig,
  system: string,
  history: ChatMessage[],
  tools: AgentTool[],
  deadline: number
): Promise<ToolLoopResult> {
  const client = new Anthropic({ apiKey: config.apiKey, maxRetries: 1 });
  const byName = new Map(tools.map((t) => [t.name, t]));
  const messages: Anthropic.Beta.BetaMessageParam[] = history.map((m) => ({
    role: m.role,
    content: m.content,
  }));
  const definitions: Anthropic.Beta.BetaTool[] = tools.map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: t.parameters,
  }));
  const fallback = SERVER_FALLBACK_MODELS.test(config.model)
    ? { betas: ["server-side-fallback-2026-07-01"] as Anthropic.Beta.AnthropicBeta[], fallbacks: "default" as const }
    : {};
  const toolsUsed: string[] = [];
  let inputTokens = 0;
  let outputTokens = 0;

  for (let step = 0; step < MAX_STEPS; step++) {
    let response: Anthropic.Beta.BetaMessage;
    try {
      response = await client.beta.messages.create(
        {
          model: config.model,
          max_tokens: 8000,
          system,
          messages,
          ...(definitions.length > 0 ? { tools: definitions } : {}),
          ...fallback,
        },
        { timeout: remaining(deadline) }
      );
    } catch (cause) {
      if (cause instanceof Anthropic.AuthenticationError || cause instanceof Anthropic.PermissionDeniedError) {
        throw new LlmError("Chave de API recusada pela Anthropic", cause.status);
      }
      if (cause instanceof Anthropic.NotFoundError) {
        throw new LlmError("Modelo não encontrado na Anthropic", cause.status);
      }
      if (cause instanceof Anthropic.RateLimitError) {
        throw new LlmError("Limite de uso da Anthropic atingido — tente mais tarde", cause.status);
      }
      if (cause instanceof Anthropic.APIError) {
        throw new LlmError(`A Anthropic recusou o pedido: ${cause.message.slice(0, 160)}`, cause.status ?? null);
      }
      throw new LlmError("Não foi possível falar com a Anthropic");
    }

    inputTokens += response.usage.input_tokens;
    outputTokens += response.usage.output_tokens;

    if (response.stop_reason === "refusal") {
      return { text: "", toolsUsed, inputTokens, outputTokens, refused: true };
    }

    const calls = response.content.filter(
      (block): block is Anthropic.Beta.BetaToolUseBlock => block.type === "tool_use"
    );
    if (response.stop_reason !== "tool_use" || calls.length === 0) {
      const text = response.content
        .filter((block): block is Anthropic.Beta.BetaTextBlock => block.type === "text")
        .map((block) => block.text)
        .join("\n")
        .trim();
      return { text, toolsUsed, inputTokens, outputTokens, refused: false };
    }

    // O conteúdo inteiro volta, não só o texto: a próxima volta precisa dos
    // blocos de ferramenta (e de raciocínio) exatamente como vieram.
    messages.push({ role: "assistant", content: response.content });
    const results: Anthropic.Beta.BetaToolResultBlockParam[] = [];
    for (const call of calls) {
      toolsUsed.push(call.name);
      results.push({
        type: "tool_result",
        tool_use_id: call.id,
        content: await runTool(byName.get(call.name), call.input),
      });
    }
    messages.push({ role: "user", content: results });
  }

  throw new LlmError("A IA entrou em laço de ferramentas sem responder");
}
