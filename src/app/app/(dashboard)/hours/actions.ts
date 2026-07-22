"use server";

import { revalidatePath } from "next/cache";
import { createWorkingHour, deleteWorkingHour } from "@/lib/data/workingHours";
import { createBlock, deleteBlock } from "@/lib/data/blocks";
import { getMyStudio } from "@/lib/data/studios";
import { workingHourInputSchema, blockInputSchema } from "@/lib/validation";
import { localDateTimeToUtc } from "@/lib/availability";

export type HoursActionState = { ok: false; error: string } | { ok: true } | null;

export async function addWorkingHourAction(
  _prevState: HoursActionState,
  formData: FormData
): Promise<HoursActionState> {
  const studio = await getMyStudio();
  if (!studio) return { ok: false, error: "Estúdio não encontrado" };

  const parsed = workingHourInputSchema.safeParse({
    weekday: Number(formData.get("weekday")),
    start_time: String(formData.get("start_time") ?? ""),
    end_time: String(formData.get("end_time") ?? ""),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }

  await createWorkingHour({ studio_id: studio.id, ...parsed.data });
  revalidatePath("/app/hours");
  return { ok: true };
}

export async function removeWorkingHourAction(id: string): Promise<void> {
  await deleteWorkingHour(id);
  revalidatePath("/app/hours");
}

export async function addBlockAction(
  _prevState: HoursActionState,
  formData: FormData
): Promise<HoursActionState> {
  const studio = await getMyStudio();
  if (!studio) return { ok: false, error: "Estúdio não encontrado" };

  const date = String(formData.get("date") ?? "");
  const startTime = String(formData.get("start_time") ?? "");
  const endTime = String(formData.get("end_time") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();

  if (!date || !startTime || !endTime) {
    return { ok: false, error: "Preencha data, início e fim." };
  }

  const parsed = blockInputSchema.safeParse({
    start_at: localDateTimeToUtc(date, startTime).toISOString(),
    end_at: localDateTimeToUtc(date, endTime).toISOString(),
    reason: reason || undefined,
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }

  await createBlock({ studio_id: studio.id, ...parsed.data, reason: parsed.data.reason ?? null });
  revalidatePath("/app/hours");
  return { ok: true };
}

export async function removeBlockAction(id: string): Promise<void> {
  await deleteBlock(id);
  revalidatePath("/app/hours");
}
