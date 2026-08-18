"use server";

import { revalidatePath } from "next/cache";
import {
  createOwnerBooking,
  listOwnerAvailableSlots,
  updateBookingStatus,
} from "@/lib/data/bookings";
import { getMyStudio } from "@/lib/data/studios";
import { localDateTimeToUtc } from "@/lib/availability";
import { bookingStatusSchema, manualBookingSchema } from "@/lib/validation";

export async function updateBookingStatusAction(id: string, status: string): Promise<void> {
  const parsed = bookingStatusSchema.safeParse(status);
  if (!parsed.success) return;
  await updateBookingStatus(id, parsed.data);
  revalidatePath("/app");
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export type OwnerSlotsResult =
  | { ok: true; slots: { start: string; end: string }[] }
  | { ok: false; error: string };

/** Grade de horários livres para o diálogo de agendamento manual. */
export async function listOwnerSlotsAction(
  serviceId: string,
  date: string
): Promise<OwnerSlotsResult> {
  if (!DATE_RE.test(date)) return { ok: false, error: "Data inválida" };

  const studio = await getMyStudio();
  if (!studio) return { ok: false, error: "Estúdio não encontrado" };

  try {
    const slots = await listOwnerAvailableSlots(studio.id, serviceId, date);
    if (!slots) return { ok: false, error: "Serviço não encontrado" };
    return { ok: true, slots };
  } catch (err) {
    console.error(err);
    return { ok: false, error: "Não foi possível buscar os horários. Tente novamente." };
  }
}

export interface ManualBookingFields {
  serviceId: string;
  clientName: string;
  clientPhone: string;
  date: string;
  time: string;
  durationMin: number;
  encaixe: boolean;
}

export type ManualBookingResult =
  | { ok: true; startAt: string }
  | { ok: false; error: string };

/**
 * Cria um agendamento manualmente pelo painel. No modo padrão o horário
 * precisa ser um slot livre da grade (mesma regra da página pública); com
 * `encaixe` o dono agenda fora do expediente/por cima de bloqueio, mas
 * nunca por cima de outro atendimento.
 */
export async function createManualBookingAction(
  fields: ManualBookingFields
): Promise<ManualBookingResult> {
  const studio = await getMyStudio();
  if (!studio) return { ok: false, error: "Estúdio não encontrado" };

  const parsed = manualBookingSchema.safeParse(fields);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }

  const { serviceId, clientName, clientPhone, date, time, durationMin, encaixe } = parsed.data;

  try {
    const result = await createOwnerBooking({
      studioId: studio.id,
      serviceId,
      clientName,
      clientPhone,
      startAt: localDateTimeToUtc(date, time),
      durationMin,
      allowOffGrid: encaixe,
    });

    if (!result.ok) {
      return {
        ok: false,
        error:
          result.error === "conflict"
            ? encaixe
              ? "Já existe um atendimento nesse intervalo. Escolha outro horário."
              : "Esse horário não está mais livre. Atualize a grade e escolha outro."
            : "Serviço não encontrado. Atualize a página e tente novamente.",
      };
    }

    revalidatePath("/app");
    return { ok: true, startAt: result.booking.start_at };
  } catch (err) {
    console.error(err);
    return { ok: false, error: "Não foi possível criar o agendamento. Tente novamente." };
  }
}
