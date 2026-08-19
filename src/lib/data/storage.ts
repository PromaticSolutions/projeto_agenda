import "server-only";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/service";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { validateImageUpload, type ImageUploadKind } from "@/lib/validation";

export const STUDIO_MEDIA_BUCKET = "studio-media";

export type StudioImageKind = ImageUploadKind;

/**
 * Verifica o tipo pelo CONTEÚDO, não pelo `file.type`.
 *
 * O cabeçalho enviado pelo browser é controlado pelo cliente: um .exe
 * renomeado chega como "image/png" sem esforço nenhum. Conferir a assinatura
 * dos primeiros bytes é o que realmente garante que o bucket público só
 * receba imagem — e o bucket aceita exatamente estes quatro formatos.
 */
function sniffImageType(bytes: Uint8Array): string | null {
  const startsWith = (offset: number, ...signature: number[]) =>
    signature.every((byte, i) => bytes[offset + i] === byte);

  if (startsWith(0, 0xff, 0xd8, 0xff)) return "image/jpeg";
  if (startsWith(0, 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return "image/png";

  const ascii = (offset: number, length: number) =>
    String.fromCharCode(...bytes.slice(offset, offset + length));

  // WebP e AVIF são contêineres: a marca fica depois do tamanho do bloco.
  if (ascii(0, 4) === "RIFF" && ascii(8, 4) === "WEBP") return "image/webp";
  if (ascii(4, 4) === "ftyp" && ["avif", "avis"].includes(ascii(8, 4))) return "image/avif";

  return null;
}

const EXTENSION: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
};

export type UploadResult = { ok: true; url: string } | { ok: false; error: string };

/**
 * Grava a imagem no bucket público e devolve a URL definitiva.
 *
 * Usa a service_role key porque a 0007 não dá permissão de escrita a
 * `authenticated` de propósito: assim o browser nunca pode gravar direto no
 * Storage, e a validação de arquivo fica no servidor, onde não dá para burlar.
 */
export async function uploadStudioImage(
  studioId: string,
  kind: StudioImageKind,
  file: File
): Promise<UploadResult> {
  if (!isSupabaseConfigured) {
    return { ok: false, error: "Upload indisponível: Supabase não configurado." };
  }
  // Tamanho e tipo DECLARADO: rejeita cedo, com mensagem boa, sem ler o arquivo.
  const basic = validateImageUpload(file);
  if (!basic.ok) return basic;

  // Tipo REAL: `file.type` vem do cliente e um arquivo qualquer renomeado
  // passa na checagem acima. A assinatura dos bytes é a barreira de verdade.
  const bytes = new Uint8Array(await file.arrayBuffer());
  const mime = sniffImageType(bytes);
  if (!mime) {
    return { ok: false, error: "O arquivo não é uma imagem válida (JPG, PNG, WebP ou AVIF)." };
  }

  const supabase = createServiceRoleSupabaseClient();
  // Nome novo a cada envio: o path antigo pode estar em cache de CDN, e um
  // nome fixo faria a imagem trocada continuar aparecendo.
  const path = `${studioId}/${kind}-${Date.now()}.${EXTENSION[mime]}`;

  const { error } = await supabase.storage
    .from(STUDIO_MEDIA_BUCKET)
    .upload(path, bytes, { contentType: mime, upsert: true });

  if (error) {
    console.error(error);
    return { ok: false, error: "Falha ao enviar a imagem. Tente novamente." };
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from(STUDIO_MEDIA_BUCKET).getPublicUrl(path);

  return { ok: true, url: publicUrl };
}
