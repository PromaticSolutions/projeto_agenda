"use server";

import { redirect } from "next/navigation";
import { createMyStudio, getMyStudio, isSlugAvailable } from "@/lib/data/studios";
import { studioOnboardingSchema } from "@/lib/validation";

export type OnboardingActionState = { ok: false; error: string } | null;

export async function createStudioAction(
  _prevState: OnboardingActionState,
  formData: FormData
): Promise<OnboardingActionState> {
  const existing = await getMyStudio();
  if (existing) {
    redirect("/app");
  }

  const raw = {
    name: String(formData.get("name") ?? ""),
    slug: String(formData.get("slug") ?? ""),
    whatsapp: String(formData.get("whatsapp") ?? ""),
    brand_color: String(formData.get("brand_color") ?? "#7C3AED"),
    logo_url: String(formData.get("logo_url") ?? ""),
  };

  const parsed = studioOnboardingSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }

  const available = await isSlugAvailable(parsed.data.slug);
  if (!available) {
    return { ok: false, error: "Esse link já está em uso, escolha outro." };
  }

  await createMyStudio({
    name: parsed.data.name,
    slug: parsed.data.slug,
    whatsapp: parsed.data.whatsapp,
    brand_color: parsed.data.brand_color,
    logo_url: parsed.data.logo_url || null,
  });

  redirect("/app");
}
