import "server-only";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/service";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import {
  mockCreateService,
  mockDeleteService,
  mockGetService,
  mockListServices,
  mockUpdateService,
} from "@/lib/mock/store";
import type { Service } from "@/lib/types";

export interface ServiceInput {
  studio_id: string;
  name: string;
  price_cents: number;
  duration_min: number;
  color: string;
  active: boolean;
  /** Observações internas, opcional. Não aparece na página pública. */
  notes?: string | null;
}

/** Lista completa (ativos + inativos) para a tela de CRUD do dono. */
export async function listMyServices(studioId: string): Promise<Service[]> {
  if (!isSupabaseConfigured) return mockListServices(studioId);

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("services")
    .select("*")
    .eq("studio_id", studioId)
    .is("archived_at", null)
    .order("name");
  if (error) throw error;
  return data;
}

export async function createService(input: ServiceInput): Promise<Service> {
  if (!isSupabaseConfigured) return mockCreateService(input);

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.from("services").insert(input).select("*").single();
  if (error) throw error;
  return data;
}

export async function updateService(id: string, patch: Partial<ServiceInput>): Promise<Service> {
  if (!isSupabaseConfigured) return mockUpdateService(id, patch);

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("services")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

/** Como o serviço saiu da lista: apagado de fato ou preservado como histórico. */
export type DeleteServiceMode = "deleted" | "archived";

/**
 * Exclusão em dois regimes.
 *
 * `bookings.service_id` é `on delete restrict` (0001_init.sql) de propósito:
 * apagar um serviço não pode apagar o histórico financeiro nem deixar
 * agendamento órfão. Então um DELETE direto estoura 23503 para qualquer
 * serviço que já tenha sido agendado — que era exatamente o bug da tela.
 *
 * - serviço sem nenhum booking -> DELETE real, a linha some;
 * - serviço com bookings       -> arquivamento, sai de todas as listas mas o
 *                                 histórico continua íntegro.
 */
export async function deleteService(id: string): Promise<DeleteServiceMode> {
  if (!isSupabaseConfigured) return mockDeleteService(id);

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.from("services").delete().eq("id", id);
  if (!error) return "deleted";

  if ((error as { code?: string }).code !== "23503") throw error;

  const { error: archiveError } = await supabase
    .from("services")
    .update({ archived_at: new Date().toISOString(), active: false })
    .eq("id", id);
  if (archiveError) throw archiveError;
  return "archived";
}

/** Só serviços ativos — página pública /[slug]. */
export async function listPublicServices(studioId: string): Promise<Service[]> {
  if (!isSupabaseConfigured) return mockListServices(studioId, { activeOnly: true });

  const supabase = createServiceRoleSupabaseClient();
  const { data, error } = await supabase
    .from("services")
    .select("*")
    .eq("studio_id", studioId)
    .eq("active", true)
    .is("archived_at", null)
    .order("name");
  if (error) throw error;
  return data;
}

/** Usado na revalidação server-side do booking: precisa achar mesmo um serviço já desativado no meio-tempo. */
export async function getPublicService(studioId: string, serviceId: string): Promise<Service | null> {
  if (!isSupabaseConfigured) {
    const service = mockGetService(serviceId);
    return service && service.studio_id === studioId ? service : null;
  }

  const supabase = createServiceRoleSupabaseClient();
  const { data, error } = await supabase
    .from("services")
    .select("*")
    .eq("id", serviceId)
    .eq("studio_id", studioId)
    .maybeSingle();
  if (error) throw error;
  return data;
}
