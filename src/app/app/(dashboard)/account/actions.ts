"use server";

import { revalidatePath } from "next/cache";
import { getMyStudio, isSlugAvailable, updateMyStudio } from "@/lib/data/studios";
import { uploadStudioImage, type StudioImageKind } from "@/lib/data/storage";
import { studioIdentitySchema } from "@/lib/validation";

export type AccountActionState = { ok: true; message: string } | { ok: false; error: string } | null;

export async function updateAccountAction(
  _previous: AccountActionState,
  formData: FormData
): Promise<AccountActionState> {
  const studio = await getMyStudio();
  if (!studio) return { ok: false, error: "Estúdio não encontrado." };

  const parsed = studioIdentitySchema.safeParse({
    name: String(formData.get("name") ?? ""),
    slug: String(formData.get("slug") ?? ""),
    whatsapp: String(formData.get("whatsapp") ?? ""),
    brand_color: String(formData.get("brand_color") ?? "#7C3AED"),
    logo_url: String(formData.get("logo_url") ?? ""),
    banner_url: String(formData.get("banner_url") ?? ""),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  if (!(await isSlugAvailable(parsed.data.slug, studio.id))) {
    return { ok: false, error: "Este link público já está em uso." };
  }

  await updateMyStudio(studio.id, {
    ...parsed.data,
    logo_url: parsed.data.logo_url || null,
    banner_url: parsed.data.banner_url || null,
  });

  revalidatePath("/app", "layout");
  revalidatePath(`/${studio.slug}`);
  revalidatePath(`/${parsed.data.slug}`);
  return { ok: true, message: "Informações da conta atualizadas." };
}

export type UploadState = { ok: true; url: string } | { ok: false; error: string };

/**
 * Recebe o arquivo escolhido no dispositivo e devolve a URL pública.
 *
 * Só devolve a URL: quem grava em `studios` é o formulário, ao salvar. Assim
 * um upload seguido de "cancelar" não deixa a imagem trocada pela metade.
 */
export async function uploadStudioImageAction(
  kind: StudioImageKind,
  formData: FormData
): Promise<UploadState> {
  const studio = await getMyStudio();
  if (!studio) return { ok: false, error: "Estúdio não encontrado." };

  const file = formData.get("file");
  if (!(file instanceof File)) return { ok: false, error: "Nenhum arquivo recebido." };

  return uploadStudioImage(studio.id, kind, file);
}
