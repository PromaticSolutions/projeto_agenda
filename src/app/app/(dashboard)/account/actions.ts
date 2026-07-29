"use server";

import { revalidatePath } from "next/cache";
import { getMyStudio, isSlugAvailable, updateMyStudio } from "@/lib/data/studios";
import { studioOnboardingSchema } from "@/lib/validation";

export type AccountActionState = { ok: true; message: string } | { ok: false; error: string } | null;

export async function updateAccountAction(_previous: AccountActionState, formData: FormData): Promise<AccountActionState> {
  const studio = await getMyStudio();
  if (!studio) return { ok: false, error: "Estúdio não encontrado." };
  const parsed = studioOnboardingSchema.safeParse({
    name: String(formData.get("name") ?? ""),
    slug: String(formData.get("slug") ?? ""),
    whatsapp: String(formData.get("whatsapp") ?? ""),
    brand_color: String(formData.get("brand_color") ?? "#7C3AED"),
    logo_url: String(formData.get("logo_url") ?? ""),
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  if (!(await isSlugAvailable(parsed.data.slug, studio.id))) return { ok: false, error: "Este link público já está em uso." };
  await updateMyStudio(studio.id, { ...parsed.data, logo_url: parsed.data.logo_url || null });
  revalidatePath("/app", "layout");
  revalidatePath(`/${studio.slug}`);
  revalidatePath(`/${parsed.data.slug}`);
  return { ok: true, message: "Informações da conta atualizadas." };
}
