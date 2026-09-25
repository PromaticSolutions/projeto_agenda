"use server";

import { revalidatePath } from "next/cache";
import { createWorkingHour, deleteWorkingHour, listMyWorkingHours } from "@/lib/data/workingHours";
import { createBlock, deleteBlock } from "@/lib/data/blocks";
import { getMyStudio } from "@/lib/data/studios";
import { workingHourInputSchema, blockInputSchema } from "@/lib/validation";
import { localDateTimeToUtc } from "@/lib/availability";
import { diffShifts, validateShifts, type Shift } from "@/lib/working-week";

export type HoursActionState = { ok: false; error: string } | { ok: true } | null;

/**
 * Salva a semana inteira de uma vez — é o que o editor de /app/hours chama no
 * "Salvar horários".
 *
 * Valida TUDO antes de escrever qualquer coisa (formato, fim depois do
 * início, nenhum período sobreposto no mesmo dia): uma semana meio gravada é
 * pior do que nenhuma. Depois escreve só a diferença. Cria antes de apagar:
 * se algo falhar no meio, o pior caso é um período a mais, e nunca um dia que
 * some do link de agendamento.
 */
export async function saveWorkingWeekAction(shifts: Shift[]): Promise<HoursActionState> {
  const studio = await getMyStudio();
  if (!studio) return { ok: false, error: "Estúdio não encontrado" };

  for (const shift of shifts) {
    const parsed = workingHourInputSchema.safeParse(shift);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "Horário inválido" };
    }
  }
  const invalid = validateShifts(shifts);
  if (invalid) return { ok: false, error: invalid };

  const existing = await listMyWorkingHours(studio.id);
  const { toCreate, toDelete } = diffShifts(existing, shifts);

  for (const shift of toCreate) {
    await createWorkingHour({ studio_id: studio.id, ...shift });
  }
  await Promise.all(toDelete.map((id) => deleteWorkingHour(id)));

  revalidatePath("/app/hours");
  return { ok: true };
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
