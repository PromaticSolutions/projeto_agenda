import "server-only";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/service";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import {
  mockCreateBooking,
  mockGetBooking,
  mockListBookings,
  mockSearchBookings,
  mockUpdateBookingSchedule,
  mockUpdateBookingStatus,
} from "@/lib/mock/store";
import {
  isSlotStillAvailable,
  localDayRangeUtc,
  nextLocalDate,
  utcToLocalDate,
} from "@/lib/availability";
import { listPublicWorkingHours } from "@/lib/data/workingHours";
import { listPublicBlocksInRange } from "@/lib/data/blocks";
import { getPublicService } from "@/lib/data/services";
import { upsertClientFromBooking } from "@/lib/data/clients";
import type { Booking, BookingStatus } from "@/lib/types";

export async function listBookingsForDay(studioId: string, date: string): Promise<Booking[]> {
  const range = localDayRangeUtc(date);
  return listBookingsInRangeOwner(studioId, range.start.toISOString(), range.end.toISOString());
}

export async function listBookingsForMonth(
  studioId: string,
  year: number,
  month: number
): Promise<Booking[]> {
  const from = `${year}-${String(month).padStart(2, "0")}-01`;
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const to = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  const rangeStart = localDayRangeUtc(from).start;
  const rangeEnd = localDayRangeUtc(to).end;
  return listBookingsInRangeOwner(studioId, rangeStart.toISOString(), rangeEnd.toISOString());
}

async function listBookingsInRangeOwner(
  studioId: string,
  fromIso: string,
  toIso: string
): Promise<Booking[]> {
  if (!isSupabaseConfigured) {
    return mockListBookings(studioId, { from: fromIso, to: toIso });
  }

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("bookings")
    .select("*")
    .eq("studio_id", studioId)
    .lt("start_at", toIso)
    .gt("end_at", fromIso)
    .order("start_at");
  if (error) throw error;
  return data;
}

/** Bookings que intersectam [from, to) — usado no cálculo de disponibilidade pública. */
export async function listPublicBookingsInRange(
  studioId: string,
  fromIso: string,
  toIso: string
): Promise<Booking[]> {
  if (!isSupabaseConfigured) {
    return mockListBookings(studioId, { from: fromIso, to: toIso });
  }

  const supabase = createServiceRoleSupabaseClient();
  const { data, error } = await supabase
    .from("bookings")
    .select("*")
    .eq("studio_id", studioId)
    .lt("start_at", toIso)
    .gt("end_at", fromIso);
  if (error) throw error;
  return data;
}

/** Histórico de agendamentos de um cliente — usado em /app/clients/[id]. */
export async function listBookingsForClient(studioId: string, clientId: string): Promise<Booking[]> {
  if (!isSupabaseConfigured) {
    return mockListBookings(studioId).filter((b) => b.client_id === clientId);
  }

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("bookings")
    .select("*")
    .eq("studio_id", studioId)
    .eq("client_id", clientId)
    .order("start_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function searchBookings(studioId: string, query: string): Promise<Booking[]> {
  if (!isSupabaseConfigured) return mockSearchBookings(studioId, query);

  const q = query.trim();
  const digits = q.replace(/\D/g, "");
  const supabase = await createServerSupabaseClient();
  let builder = supabase.from("bookings").select("*").eq("studio_id", studioId);
  if (digits.length > 0 && digits === q.replace(/[()\s-]/g, "")) {
    builder = builder.ilike("client_phone", `%${digits}%`);
  } else {
    builder = builder.ilike("client_name", `%${q}%`);
  }
  const { data, error } = await builder.order("start_at", { ascending: false }).limit(50);
  if (error) throw error;
  return data;
}

export async function updateBookingStatus(id: string, status: BookingStatus): Promise<Booking> {
  if (!isSupabaseConfigured) return mockUpdateBookingStatus(id, status);

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("bookings")
    .update({ status })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

/** Usado pelo dono (painel) para carregar um booking antes de editar. */
export async function getMyBooking(studioId: string, id: string): Promise<Booking | null> {
  if (!isSupabaseConfigured) {
    const booking = mockGetBooking(id);
    return booking && booking.studio_id === studioId ? booking : null;
  }

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("bookings")
    .select("*")
    .eq("id", id)
    .eq("studio_id", studioId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export interface CreateBookingInput {
  studioId: string;
  serviceId: string;
  clientName: string;
  clientPhone: string;
  startAt: Date;
}

export type CreateBookingOutcome =
  | { ok: true; booking: Booking }
  | { ok: false; error: "conflict" | "service_not_found" };

/**
 * Único caminho de criação de booking do sistema (chamado pela API route).
 * Revalida a disponibilidade no servidor usando os MESMOS dados que geraram
 * a sugestão no cliente, e ainda depende da exclusion constraint do Postgres
 * como última linha de defesa contra corrida (ver RISKS.md).
 */
export async function createBookingServerSide(
  input: CreateBookingInput
): Promise<CreateBookingOutcome> {
  const service = await getPublicService(input.studioId, input.serviceId);
  if (!service || !service.active) return { ok: false, error: "service_not_found" };

  const endAt = new Date(input.startAt.getTime() + service.duration_min * 60_000);
  const dateStr = utcToLocalDate(input.startAt);
  const from = localDayRangeUtc(dateStr).start;
  const to = localDayRangeUtc(nextLocalDate(dateStr)).end;

  const [workingHours, blocks, existingBookings] = await Promise.all([
    listPublicWorkingHours(input.studioId),
    listPublicBlocksInRange(input.studioId, from.toISOString(), to.toISOString()),
    listPublicBookingsInRange(input.studioId, from.toISOString(), to.toISOString()),
  ]);

  const stillAvailable = isSlotStillAvailable(
    { start: input.startAt, end: endAt },
    {
      date: dateStr,
      durationMin: service.duration_min,
      workingHours,
      blocks: blocks.map((b) => ({ start: new Date(b.start_at), end: new Date(b.end_at) })),
      bookings: existingBookings
        .filter((b) => b.status !== "cancelado")
        .map((b) => ({ start: new Date(b.start_at), end: new Date(b.end_at) })),
      now: new Date(),
    }
  );
  if (!stillAvailable) return { ok: false, error: "conflict" };

  const client = await upsertClientFromBooking(input.studioId, input.clientName, input.clientPhone);

  if (!isSupabaseConfigured) {
    const result = mockCreateBooking({
      studio_id: input.studioId,
      service_id: input.serviceId,
      client_id: client.id,
      client_name: input.clientName,
      client_phone: input.clientPhone,
      start_at: input.startAt.toISOString(),
      end_at: endAt.toISOString(),
    });
    if (!result.ok) return { ok: false, error: "conflict" };
    return { ok: true, booking: result.booking };
  }

  const supabase = createServiceRoleSupabaseClient();
  const { data, error } = await supabase
    .from("bookings")
    .insert({
      studio_id: input.studioId,
      service_id: input.serviceId,
      client_id: client.id,
      client_name: input.clientName,
      client_phone: input.clientPhone,
      start_at: input.startAt.toISOString(),
      end_at: endAt.toISOString(),
      status: "agendado",
    })
    .select("*")
    .single();

  if (error) {
    // 23P01 = exclusion_violation: outro request venceu a corrida entre a
    // revalidação acima e o INSERT. É o cinturão-e-suspensório da seção 8.
    if ((error as { code?: string }).code === "23P01") {
      return { ok: false, error: "conflict" };
    }
    throw error;
  }
  return { ok: true, booking: data };
}

export interface UpdateBookingScheduleInput {
  studioId: string;
  bookingId: string;
  serviceId: string;
  startAt: Date;
}

/**
 * Reagenda um booking existente (dono, painel). Mesma revalidação de
 * disponibilidade de `createBookingServerSide`, mas excluindo o próprio
 * booking da lista de conflitos — senão ele sempre colidiria consigo mesmo.
 * A exclusion constraint do Postgres já ignora a própria linha num UPDATE,
 * então nenhum tratamento extra é necessário na camada do banco.
 */
export async function updateBookingSchedule(
  input: UpdateBookingScheduleInput
): Promise<CreateBookingOutcome> {
  const service = await getPublicService(input.studioId, input.serviceId);
  if (!service || !service.active) return { ok: false, error: "service_not_found" };

  const endAt = new Date(input.startAt.getTime() + service.duration_min * 60_000);
  const dateStr = utcToLocalDate(input.startAt);
  const from = localDayRangeUtc(dateStr).start;
  const to = localDayRangeUtc(nextLocalDate(dateStr)).end;

  const [workingHours, blocks, existingBookings] = await Promise.all([
    listPublicWorkingHours(input.studioId),
    listPublicBlocksInRange(input.studioId, from.toISOString(), to.toISOString()),
    listPublicBookingsInRange(input.studioId, from.toISOString(), to.toISOString()),
  ]);

  const stillAvailable = isSlotStillAvailable(
    { start: input.startAt, end: endAt },
    {
      date: dateStr,
      durationMin: service.duration_min,
      workingHours,
      blocks: blocks.map((b) => ({ start: new Date(b.start_at), end: new Date(b.end_at) })),
      bookings: existingBookings
        .filter((b) => b.status !== "cancelado" && b.id !== input.bookingId)
        .map((b) => ({ start: new Date(b.start_at), end: new Date(b.end_at) })),
      now: new Date(),
    }
  );
  if (!stillAvailable) return { ok: false, error: "conflict" };

  if (!isSupabaseConfigured) {
    const result = mockUpdateBookingSchedule(input.bookingId, {
      serviceId: input.serviceId,
      startAt: input.startAt.toISOString(),
      endAt: endAt.toISOString(),
    });
    if (!result.ok) return { ok: false, error: "conflict" };
    return { ok: true, booking: result.booking };
  }

  const supabase = createServiceRoleSupabaseClient();
  const { data, error } = await supabase
    .from("bookings")
    .update({
      service_id: input.serviceId,
      start_at: input.startAt.toISOString(),
      end_at: endAt.toISOString(),
    })
    .eq("id", input.bookingId)
    .eq("studio_id", input.studioId)
    .select("*")
    .single();

  if (error) {
    if ((error as { code?: string }).code === "23P01") {
      return { ok: false, error: "conflict" };
    }
    throw error;
  }
  return { ok: true, booking: data };
}
