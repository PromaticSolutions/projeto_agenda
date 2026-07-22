"use server";

import { revalidatePath } from "next/cache";
import { createService, deleteService, updateService } from "@/lib/data/services";
import { getMyStudio } from "@/lib/data/studios";
import { serviceInputSchema } from "@/lib/validation";

export type ServiceActionState = { ok: false; error: string } | { ok: true } | null;

function parsePriceReais(value: string): number {
  const normalized = value.replace(/\./g, "").replace(",", ".").trim();
  const reais = Number(normalized);
  return Math.round(reais * 100);
}

function parseServiceForm(formData: FormData) {
  return serviceInputSchema.safeParse({
    name: String(formData.get("name") ?? ""),
    price_cents: parsePriceReais(String(formData.get("price_reais") ?? "0")),
    duration_min: Number(formData.get("duration_min") ?? 0),
    color: String(formData.get("color") ?? "#7C3AED"),
    active: formData.get("active") === "on",
  });
}

export async function createServiceAction(
  _prevState: ServiceActionState,
  formData: FormData
): Promise<ServiceActionState> {
  const studio = await getMyStudio();
  if (!studio) return { ok: false, error: "Estúdio não encontrado" };

  const parsed = parseServiceForm(formData);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }

  await createService({ studio_id: studio.id, ...parsed.data });
  revalidatePath("/app/services");
  return { ok: true };
}

export async function updateServiceAction(
  id: string,
  _prevState: ServiceActionState,
  formData: FormData
): Promise<ServiceActionState> {
  const parsed = parseServiceForm(formData);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }

  await updateService(id, parsed.data);
  revalidatePath("/app/services");
  return { ok: true };
}

export async function deleteServiceAction(id: string): Promise<void> {
  await deleteService(id);
  revalidatePath("/app/services");
}

export async function toggleServiceActiveAction(id: string, active: boolean): Promise<void> {
  await updateService(id, { active });
  revalidatePath("/app/services");
}
