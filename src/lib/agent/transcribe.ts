import "server-only";
import { TRANSCRIPTION_PROVIDERS } from "@/lib/agent/providers";
import { LlmError } from "@/lib/agent/llm";
import type { TranscriptionProvider } from "@/lib/supabase/types";

/**
 * Áudio → texto pelo endpoint `/audio/transcriptions` (Whisper).
 *
 * Groq e OpenAI falam o mesmo formato (multipart com `file` e `model`), e os
 * dois aceitam o ogg/opus que o WhatsApp manda, sem converter nada.
 */

export interface TranscriptionConfig {
  provider: Exclude<TranscriptionProvider, "desligado">;
  baseUrl: string | null;
  model: string | null;
  apiKey: string;
}

/** Teto do plano gratuito do Groq; um áudio de WhatsApp fica muito abaixo. */
const MAX_AUDIO_BYTES = 25 * 1024 * 1024;

export async function transcribeAudio(
  config: TranscriptionConfig,
  audio: { bytes: Uint8Array; mimeType: string },
  timeoutMs = 20_000
): Promise<string> {
  const preset = TRANSCRIPTION_PROVIDERS[config.provider];
  const base = config.baseUrl ?? preset.baseUrl;
  const model = config.model || preset.model;
  if (!base || !model) throw new LlmError("Transcrição sem endereço ou modelo configurado");
  if (audio.bytes.byteLength > MAX_AUDIO_BYTES) throw new LlmError("Áudio grande demais para transcrever");

  const mime = audio.mimeType.split(";")[0] || "audio/ogg";
  const extension = mime.includes("mpeg") ? "mp3" : mime.includes("mp4") ? "m4a" : "ogg";

  const form = new FormData();
  form.append("file", new Blob([new Uint8Array(audio.bytes)], { type: mime }), `audio.${extension}`);
  form.append("model", model);
  form.append("language", "pt");
  form.append("response_format", "json");

  const res = await fetch(`${base.replace(/\/+$/, "")}/audio/transcriptions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${config.apiKey}` },
    body: form,
    signal: AbortSignal.timeout(timeoutMs),
  }).catch(() => {
    throw new LlmError("Não foi possível falar com o serviço de transcrição");
  });

  const data = (await res.json().catch(() => null)) as { text?: string; error?: { message?: string } } | null;
  if (!res.ok) {
    const detail = data?.error?.message ? ` (${data.error.message.slice(0, 160)})` : "";
    if (res.status === 401 || res.status === 403) throw new LlmError(`Chave de transcrição recusada${detail}`, res.status);
    if (res.status === 429) throw new LlmError(`Limite da transcrição atingido${detail}`, res.status);
    throw new LlmError(`A transcrição falhou (HTTP ${res.status})${detail}`, res.status);
  }
  return (data?.text ?? "").trim();
}
