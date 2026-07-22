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
}

/** Lista completa (ativos + inativos) para a tela de CRUD do dono. */
export async function listMyServices(studioId: string): Promise<Service[]> {
  if (!isSupabaseConfigured) return mockListServices(studioId);

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("services")
    .select("*")
    .eq("studio_id", studioId)
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

export async function deleteService(id: string): Promise<void> {
  if (!isSupabaseConfigured) return mockDeleteService(id);

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.from("services").delete().eq("id", id);
  if (error) throw error;
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
