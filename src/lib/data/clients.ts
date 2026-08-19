import "server-only";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/service";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import {
  mockGetClient,
  mockListBookings,
  mockListClients,
  mockUpdateClientNotes,
  mockUpsertClient,
} from "@/lib/mock/store";
import type { Client } from "@/lib/types";

export interface ClientWithStats extends Client {
  totalBookings: number;
  lastVisitAt: string | null;
}

export async function listMyClients(studioId: string): Promise<Client[]> {
  if (!isSupabaseConfigured) return mockListClients(studioId);

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("clients")
    .select("*")
    .eq("studio_id", studioId)
    .order("name");
  if (error) throw error;
  return data;
}

/** Lista de clientes com contagem de agendamentos e última visita — para a tela /app/clients. */
export async function listMyClientsWithStats(studioId: string): Promise<ClientWithStats[]> {
  const clients = await listMyClients(studioId);

  let bookings: { client_id: string | null; start_at: string; status: string }[];
  if (!isSupabaseConfigured) {
    bookings = mockListBookings(studioId);
  } else {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase
      .from("bookings")
      .select("client_id, start_at, status")
      .eq("studio_id", studioId);
    if (error) throw error;
    bookings = data;
  }

  const statsByClient = new Map<string, { count: number; lastVisitAt: string | null }>();
  for (const booking of bookings) {
    if (!booking.client_id || booking.status === "cancelado") continue;
    const current = statsByClient.get(booking.client_id) ?? { count: 0, lastVisitAt: null };
    current.count += 1;
    if (!current.lastVisitAt || booking.start_at > current.lastVisitAt) {
      current.lastVisitAt = booking.start_at;
    }
    statsByClient.set(booking.client_id, current);
  }

  return clients.map((client) => {
    const stats = statsByClient.get(client.id);
    return { ...client, totalBookings: stats?.count ?? 0, lastVisitAt: stats?.lastVisitAt ?? null };
  });
}

export async function getMyClient(studioId: string, id: string): Promise<Client | null> {
  if (!isSupabaseConfigured) {
    const client = mockGetClient(id);
    return client && client.studio_id === studioId ? client : null;
  }

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("clients")
    .select("*")
    .eq("id", id)
    .eq("studio_id", studioId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/**
 * Cria o cliente se ainda não existir (por studio_id+phone) ou atualiza o
 * nome se mudou. Chamado tanto da criação de booking pública quanto da
 * manual pelo dono — por isso usa a service role (o fluxo público não tem
 * sessão autenticada, ver createBookingServerSide).
 */
export async function upsertClientFromBooking(
  studioId: string,
  name: string,
  phone: string
): Promise<Client> {
  if (!isSupabaseConfigured) return mockUpsertClient({ studio_id: studioId, name, phone });

  const supabase = createServiceRoleSupabaseClient();
  const { data, error } = await supabase
    .from("clients")
    .upsert(
      { studio_id: studioId, name, phone, updated_at: new Date().toISOString() },
      { onConflict: "studio_id,phone" }
    )
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function updateClientNotes(id: string, notes: string | null): Promise<Client> {
  if (!isSupabaseConfigured) return mockUpdateClientNotes(id, notes);

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("clients")
    .update({ notes, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}
