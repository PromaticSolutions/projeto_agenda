import type { AgentProvider, AgentTone, TranscriptionProvider } from "@/lib/supabase/types";

/**
 * Catálogo dos provedores de IA que o agente aceita.
 *
 * Sem segredo nenhum aqui — é o que a tela do superadmin mostra (nome, onde
 * pegar a chave, modelos sugeridos) e o que o servidor usa para saber o
 * endereço de cada um. Todos menos a Anthropic falam o formato de chat da
 * OpenAI, então um adaptador só cobre Gemini, Groq, OpenRouter, OpenAI e
 * qualquer API "personalizada" compatível.
 *
 * Os modelos sugeridos são só ponto de partida: o campo aceita qualquer nome,
 * porque os provedores trocam de modelo mais rápido do que este arquivo.
 */

export interface ProviderPreset {
  label: string;
  kind: "openai" | "anthropic";
  /** Nulo = o superadmin informa (provedor personalizado). */
  baseUrl: string | null;
  models: string[];
  /** Onde criar a chave. */
  keyUrl: string | null;
  /** Texto curto ao lado do nome: custo e o que saber antes de escolher. */
  note: string;
}

export const AGENT_PROVIDERS: Record<AgentProvider, ProviderPreset> = {
  gemini: {
    label: "Google Gemini",
    kind: "openai",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    models: ["gemini-3.8-flash", "gemini-3.6-flash", "gemini-3.5-flash-lite"],
    keyUrl: "https://aistudio.google.com/apikey",
    note: "Tem plano gratuito. No gratuito o Google pode usar as conversas para melhorar os produtos dele.",
  },
  groq: {
    label: "Groq",
    kind: "openai",
    baseUrl: "https://api.groq.com/openai/v1",
    models: ["openai/gpt-oss-120b", "llama-3.3-70b-versatile", "openai/gpt-oss-20b"],
    keyUrl: "https://console.groq.com/keys",
    note: "Tem plano gratuito, com limite de uso por minuto e por dia. Muito rápido.",
  },
  openrouter: {
    label: "OpenRouter",
    kind: "openai",
    baseUrl: "https://openrouter.ai/api/v1",
    models: ["openrouter/free"],
    keyUrl: "https://openrouter.ai/keys",
    note: "Modelos terminados em :free são grátis (50 pedidos por dia, ou 1000 depois de comprar créditos).",
  },
  openai: {
    label: "OpenAI",
    kind: "openai",
    baseUrl: "https://api.openai.com/v1",
    models: [],
    keyUrl: "https://platform.openai.com/api-keys",
    note: "Pago por uso. Informe o nome do modelo como aparece na sua conta.",
  },
  anthropic: {
    label: "Anthropic (Claude)",
    kind: "anthropic",
    baseUrl: null,
    models: ["claude-opus-5-5", "claude-sonnet-5-5", "claude-haiku-5-5"],
    keyUrl: "https://platform.claude.com/settings/keys",
    note: "Pago por uso. Opus é o mais capaz; Haiku é o mais rápido e barato.",
  },
  custom: {
    label: "Personalizado",
    kind: "openai",
    baseUrl: null,
    models: [],
    keyUrl: null,
    note: "Qualquer API no formato da OpenAI (/chat/completions). Informe o endereço base.",
  },
};

export const AGENT_PROVIDER_ORDER: AgentProvider[] = [
  "gemini",
  "groq",
  "openrouter",
  "openai",
  "anthropic",
  "custom",
];

export interface TranscriptionPreset {
  label: string;
  baseUrl: string | null;
  model: string | null;
  note: string;
}

/** Transcrição pelo endpoint `/audio/transcriptions` (Whisper). */
export const TRANSCRIPTION_PROVIDERS: Record<TranscriptionProvider, TranscriptionPreset> = {
  desligado: {
    label: "Desligada",
    baseUrl: null,
    model: null,
    note: "O agente pede para a cliente escrever quando recebe áudio.",
  },
  groq: {
    label: "Groq Whisper",
    baseUrl: "https://api.groq.com/openai/v1",
    model: "whisper-large-v3-turbo",
    note: "Grátis no plano gratuito do Groq. Aceita o áudio do WhatsApp direto.",
  },
  openai: {
    label: "OpenAI Whisper",
    baseUrl: "https://api.openai.com/v1",
    model: "whisper-1",
    note: "Pago por minuto de áudio.",
  },
  custom: {
    label: "Personalizado",
    baseUrl: null,
    model: null,
    note: "Qualquer API com /audio/transcriptions no formato da OpenAI.",
  },
};

export const TRANSCRIPTION_PROVIDER_ORDER: TranscriptionProvider[] = [
  "desligado",
  "groq",
  "openai",
  "custom",
];

export const AGENT_TONES: Record<AgentTone, { label: string; prompt: string }> = {
  acolhedor: {
    label: "Acolhedor",
    prompt: "Fale de forma calorosa e próxima, como uma recepcionista atenciosa. Pode usar um emoji de vez em quando, sem exagero.",
  },
  profissional: {
    label: "Profissional",
    prompt: "Fale de forma educada, objetiva e profissional. Sem gírias e sem emojis.",
  },
  descontraido: {
    label: "Descontraído",
    prompt: "Fale de forma leve e descontraída, como uma amiga que trabalha no estúdio. Emojis são bem-vindos.",
  },
};

// --- Integrações (0027) ------------------------------------------------------

/**
 * O provedor pelo começo da chave. Nulo = não dá para saber, e a tela pede
 * para escolher. A ordem importa: `sk-or-` e `sk-ant-` também começam com
 * `sk-`, que sozinho é a OpenAI.
 *
 * Detectar pelo prefixo — e não testando a chave em cada provedor até um
 * aceitar — é de propósito: testar mandaria a chave para empresas que não são
 * donas dela.
 */
export function detectProviderFromKey(key: string): AgentProvider | null {
  const k = key.trim();
  if (k.startsWith("sk-or-")) return "openrouter";
  if (k.startsWith("sk-ant-")) return "anthropic";
  if (k.startsWith("gsk_")) return "groq";
  if (k.startsWith("AIza")) return "gemini";
  if (k.startsWith("sk-")) return "openai";
  return null;
}

/** Conversa, transcrição ou outra coisa (embedding, imagem, voz) — pelo nome. */
export function classifyModel(id: string): "chat" | "audio" | "other" {
  const v = id.toLowerCase();
  if (/whisper|transcribe|speech-to-text/.test(v)) return "audio";
  if (/embed|tts|dall-e|imagen|image|moderation|guard|orpheus|playai|veo|lyria|audio-preview|realtime|-live/.test(v)) {
    return "other";
  }
  return "chat";
}

/** Provedores que transcrevem áudio pelo endpoint Whisper. */
export function canTranscribe(provider: AgentProvider): boolean {
  return provider === "groq" || provider === "openai" || provider === "custom";
}
