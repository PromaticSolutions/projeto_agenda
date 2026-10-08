"use server";

import { redirect } from "next/navigation";
import { createMyStudio, getMyStudio, isSlugAvailable } from "@/lib/data/studios";
import { ForbiddenError, createSalonWithManager, getCurrentActor } from "@/lib/data/salons";
import { salonOnboardingSchema, studioOnboardingSchema } from "@/lib/validation";

export type OnboardingActionState = { ok: false; error: string } | null;

export async function createStudioAction(
  _prevState: OnboardingActionState,
  formData: FormData
): Promise<OnboardingActionState> {
  const existing = await getMyStudio();
  if (existing) {
    redirect("/app");
  }

  /* A página já desvia a gerente, mas a Server Action é uma porta própria:
     ela aceita POST de quem montar o formulário na mão. Guardar só na tela
     deixaria a porta aberta. */
  const actor = await getCurrentActor();
  if (actor?.role === "gerente") {
    redirect("/app/gerencia");
  }

  const raw = {
    name: String(formData.get("name") ?? ""),
    slug: String(formData.get("slug") ?? ""),
    whatsapp: String(formData.get("whatsapp") ?? ""),
    brand_color: String(formData.get("brand_color") ?? "#7C3AED"),
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
    // Nulo de propósito: nulo significa "usa a marca do Timely".
    // O estúdio troca por uma própria depois, em Conta > Imagens.
    logo_url: null,
  });

  redirect("/app");
}

export type SalonOnboardingState = { ok: false; error: string } | null;

/**
 * Abre um salão e torna quem está cadastrando a gerente dele.
 *
 * O outro ramo do onboarding. Antes desta ação, virar salão só acontecia por
 * SQL — a hierarquia existia no banco e não existia para quem compra o sistema.
 */
export async function createSalonAction(
  _prevState: SalonOnboardingState,
  formData: FormData
): Promise<SalonOnboardingState> {
  const existing = await getMyStudio();
  if (existing) {
    redirect("/app");
  }

  const parsed = salonOnboardingSchema.safeParse({
    salonName: String(formData.get("salonName") ?? ""),
    managerName: String(formData.get("managerName") ?? ""),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }

  try {
    await createSalonWithManager(parsed.data);
  } catch (error) {
    if (error instanceof ForbiddenError) return { ok: false, error: error.message };
    if (error instanceof Error) return { ok: false, error: error.message };
    return { ok: false, error: "Não foi possível abrir o salão." };
  }

  redirect("/app/gerencia");
}
