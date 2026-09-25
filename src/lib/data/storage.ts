import "server-only";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/service";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { FILE_EXTENSION, sniffFileType } from "@/lib/file-type";
import {
  isImageMime,
  validateAttachmentUpload,
  validateImageUpload,
  type ImageUploadKind,
} from "@/lib/validation";

export const STUDIO_MEDIA_BUCKET = "studio-media";
/** Privado — 0020_service_attachments.sql. Só se lê por URL assinada. */
export const SERVICE_ATTACHMENTS_BUCKET = "service-attachments";

export type StudioImageKind = ImageUploadKind;

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
  const mime = sniffFileType(bytes);
  if (!mime || !isImageMime(mime)) {
    return { ok: false, error: "O arquivo não é uma imagem válida (JPG, PNG, WebP ou AVIF)." };
  }

  const supabase = createServiceRoleSupabaseClient();
  // Nome novo a cada envio: o path antigo pode estar em cache de CDN, e um
  // nome fixo faria a imagem trocada continuar aparecendo.
  const path = `${studioId}/${kind}-${Date.now()}.${FILE_EXTENSION[mime]}`;

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

// ---------------------------------------------------------------------------
// Fotos e anexos de serviço — bucket privado
// ---------------------------------------------------------------------------

/** O que o upload devolve para a tela guardar até o Salvar do formulário. */
export interface UploadedAttachment {
  storage_path: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
}

export type AttachmentUploadResult =
  | { ok: true; attachment: UploadedAttachment; url: string | null }
  | { ok: false; error: string };

/** Por quanto tempo a URL assinada vale. A tela é recarregada bem antes disso. */
const SIGNED_URL_TTL_SECONDS = 60 * 60;

/**
 * Grava o arquivo no bucket privado e devolve o caminho — ainda SEM linha em
 * `service_attachments`. Quem liga o arquivo ao serviço é o Salvar do
 * formulário, como no logo: fechar o diálogo sem salvar não altera o serviço.
 * (O arquivo fica solto no bucket nesse caso; é o preço de o serviço novo ainda
 * não ter id no momento do upload.)
 */
export async function uploadServiceAttachment(
  studioId: string,
  file: File
): Promise<AttachmentUploadResult> {
  if (!isSupabaseConfigured) {
    return { ok: false, error: "Upload indisponível: Supabase não configurado." };
  }
  const basic = validateAttachmentUpload(file);
  if (!basic.ok) return basic;

  const bytes = new Uint8Array(await file.arrayBuffer());
  const mime = sniffFileType(bytes);
  if (!mime) {
    return { ok: false, error: `"${file.name}" não é uma foto (JPG, PNG, WebP) nem um PDF válido.` };
  }

  const supabase = createServiceRoleSupabaseClient();
  const path = `${studioId}/services/${crypto.randomUUID()}.${FILE_EXTENSION[mime]}`;

  const { error } = await supabase.storage
    .from(SERVICE_ATTACHMENTS_BUCKET)
    .upload(path, bytes, { contentType: mime });

  if (error) {
    console.error(error);
    return { ok: false, error: `Falha ao enviar "${file.name}". Tente novamente.` };
  }

  const [url] = await signAttachmentUrls([path]);
  return {
    ok: true,
    attachment: {
      storage_path: path,
      file_name: file.name.slice(0, 200) || `arquivo.${FILE_EXTENSION[mime]}`,
      mime_type: mime,
      size_bytes: file.size,
    },
    url,
  };
}

/** URLs assinadas na mesma ordem dos caminhos; `null` onde não deu. */
export async function signAttachmentUrls(paths: string[]): Promise<(string | null)[]> {
  if (paths.length === 0 || !isSupabaseConfigured) return paths.map(() => null);

  const supabase = createServiceRoleSupabaseClient();
  const { data, error } = await supabase.storage
    .from(SERVICE_ATTACHMENTS_BUCKET)
    .createSignedUrls(paths, SIGNED_URL_TTL_SECONDS);
  if (error || !data) {
    console.error(error);
    return paths.map(() => null);
  }
  const byPath = new Map(data.map((d) => [d.path, d.signedUrl ?? null]));
  return paths.map((p) => byPath.get(p) ?? null);
}

/** Remove objetos do bucket. Falha aqui não desfaz nada — só loga: o que
 *  importa para o dono (a linha do anexo) já saiu. */
export async function removeAttachmentObjects(paths: string[]): Promise<void> {
  if (paths.length === 0 || !isSupabaseConfigured) return;
  const supabase = createServiceRoleSupabaseClient();
  const { error } = await supabase.storage.from(SERVICE_ATTACHMENTS_BUCKET).remove(paths);
  if (error) console.error(error);
}

/**
 * Lê uma FOTO de serviço para enviar pelo WhatsApp.
 *
 * A linha é buscada pelo id E pelo estúdio: o id vem do navegador, e sem o
 * filtro de estúdio daria para mandar a foto de outro salão. PDF e outros
 * anexos internos ficam de fora — "Enviar fotos dos procedimentos" manda foto.
 * `null` quando o anexo não existe, não é deste estúdio ou não é imagem.
 */
export async function downloadServiceImage(
  studioId: string,
  attachmentId: string
): Promise<{ mimeType: string; fileName: string; base64: string } | null> {
  if (!isSupabaseConfigured) return null;

  const supabase = createServiceRoleSupabaseClient();
  const { data: row, error } = await supabase
    .from("service_attachments")
    .select("storage_path, file_name, mime_type")
    .eq("id", attachmentId)
    .eq("studio_id", studioId)
    .maybeSingle();
  if (error) throw error;
  if (!row || !isImageMime(row.mime_type)) return null;

  const { data: blob, error: downloadError } = await supabase.storage
    .from(SERVICE_ATTACHMENTS_BUCKET)
    .download(row.storage_path);
  if (downloadError) throw downloadError;

  const bytes = new Uint8Array(await blob.arrayBuffer());
  return {
    mimeType: row.mime_type,
    fileName: row.file_name,
    base64: Buffer.from(bytes).toString("base64"),
  };
}
