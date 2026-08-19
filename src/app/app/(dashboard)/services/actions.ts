"use server";

import { revalidatePath } from "next/cache";
import {
  createService,
  deleteService,
  updateService,
  type DeleteServiceMode,
} from "@/lib/data/services";
import { getMyStudio } from "@/lib/data/studios";
import { serviceInputSchema } from "@/lib/validation";

export type ServiceActionState = { ok: false; error: string } | { ok: true } | null;

function parsePriceReais(value: string): number {
  const normalized = value.replace(/\./g, "").replace(",", ".").trim();
  const reais = Number(normalized);
  return Math.round(reais * 100);
}

function parseServiceForm(formData: FormData) {
  // Campo opcional: em branco vira `undefined` para gravar NULL, e não uma
  // string vazia que depois apareceria como observação existente e em branco.
  const notes = String(formData.get("notes") ?? "").trim();

  return serviceInputSchema.safeParse({
    name: String(formData.get("name") ?? ""),
    price_cents: parsePriceReais(String(formData.get("price_reais") ?? "0")),
    duration_min: Number(formData.get("duration_min") ?? 0),
    color: String(formData.get("color") ?? "#7C3AED"),
    active: formData.get("active") === "on",
    notes: notes === "" ? undefined : notes,
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

  await createService({ studio_id: studio.id, ...parsed.data, notes: parsed.data.notes ?? null });
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

  await updateService(id, { ...parsed.data, notes: parsed.data.notes ?? null });
  revalidatePath("/app/services");
  return { ok: true };
}

export type DeleteServiceState =
  | { ok: true; mode: DeleteServiceMode }
  | { ok: false; error: string };

/**
 * O retorno diz ao dono o que realmente aconteceu: um serviço já agendado não
 * pode ser apagado (FK `on delete restrict`), então ele é arquivado — e a tela
 * precisa explicar isso em vez de fingir que excluiu.
 */
export async function deleteServiceAction(id: string): Promise<DeleteServiceState> {
  try {
    const mode = await deleteService(id);
    revalidatePath("/app/services");
    revalidatePath("/app");
    return { ok: true, mode };
  } catch (err) {
    console.error(err);
    return { ok: false, error: "Não foi possível excluir o serviço. Tente novamente." };
  }
}

export type ToggleServiceState = { ok: true } | { ok: false; error: string };

export async function toggleServiceActiveAction(
  id: string,
  active: boolean
): Promise<ToggleServiceState> {
  try {
    await updateService(id, { active });
    revalidatePath("/app/services");
    revalidatePath("/app");
    return { ok: true };
  } catch (err) {
    console.error(err);
    return { ok: false, error: "Não foi possível alterar o serviço. Tente novamente." };
  }
}
