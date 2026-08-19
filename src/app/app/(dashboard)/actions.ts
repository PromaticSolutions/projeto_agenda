"use server";

import { revalidatePath } from "next/cache";
import { createBookingServerSide, getMyBooking, updateBookingSchedule, updateBookingStatus } from "@/lib/data/bookings";
import { getMyStudio } from "@/lib/data/studios";
import { localDateTimeToUtc } from "@/lib/availability";
import { bookingScheduleSchema, bookingStatusSchema, manualBookingSchema } from "@/lib/validation";

export async function updateBookingStatusAction(id: string, status: string): Promise<void> {
  const parsed = bookingStatusSchema.safeParse(status);
  if (!parsed.success) return;
  await updateBookingStatus(id, parsed.data);
  revalidatePath("/app");
}

export type BookingFormState = { ok: false; error: string } | { ok: true } | null;

function conflictMessage(error: "conflict" | "service_not_found"): string {
  return error === "conflict"
    ? "Esse horário não está mais disponível. Escolha outro."
    : "Serviço indisponível. Atualize a página e tente novamente.";
}

export async function createManualBookingAction(
  _prevState: BookingFormState,
  formData: FormData
): Promise<BookingFormState> {
  const studio = await getMyStudio();
  if (!studio) return { ok: false, error: "Estúdio não encontrado" };

  const parsed = manualBookingSchema.safeParse({
    serviceId: String(formData.get("serviceId") ?? ""),
    clientName: String(formData.get("clientName") ?? ""),
    clientPhone: String(formData.get("clientPhone") ?? ""),
    date: String(formData.get("date") ?? ""),
    time: String(formData.get("time") ?? ""),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }

  const startAt = localDateTimeToUtc(parsed.data.date, `${parsed.data.time}:00`);
  const result = await createBookingServerSide({
    studioId: studio.id,
    serviceId: parsed.data.serviceId,
    clientName: parsed.data.clientName,
    clientPhone: parsed.data.clientPhone,
    startAt,
  });

  if (!result.ok) return { ok: false, error: conflictMessage(result.error) };

  revalidatePath("/app");
  revalidatePath("/app/clients");
  return { ok: true };
}

export async function updateBookingScheduleAction(
  bookingId: string,
  _prevState: BookingFormState,
  formData: FormData
): Promise<BookingFormState> {
  const studio = await getMyStudio();
  if (!studio) return { ok: false, error: "Estúdio não encontrado" };

  const existing = await getMyBooking(studio.id, bookingId);
  if (!existing) return { ok: false, error: "Agendamento não encontrado" };

  const parsed = bookingScheduleSchema.safeParse({
    serviceId: String(formData.get("serviceId") ?? ""),
    date: String(formData.get("date") ?? ""),
    time: String(formData.get("time") ?? ""),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }

  const startAt = localDateTimeToUtc(parsed.data.date, `${parsed.data.time}:00`);
  const result = await updateBookingSchedule({
    studioId: studio.id,
    bookingId,
    serviceId: parsed.data.serviceId,
    startAt,
  });

  if (!result.ok) return { ok: false, error: conflictMessage(result.error) };

  revalidatePath("/app");
  return { ok: true };
}
