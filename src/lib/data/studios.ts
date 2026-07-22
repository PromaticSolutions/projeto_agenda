import "server-only";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/service";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import {
  MOCK_OWNER_ID,
  mockCreateStudio,
  mockFindStudioByOwnerId,
  mockFindStudioBySlug,
  mockUpdateStudio,
} from "@/lib/mock/store";
import type { Studio } from "@/lib/types";

export interface StudioInput {
  name: string;
  slug: string;
  whatsapp: string;
  brand_color: string;
  logo_url?: string | null;
}

/** Estúdio do dono autenticado (contexto /app). Null se ainda não fez onboarding. */
export async function getMyStudio(): Promise<Studio | null> {
  if (!isSupabaseConfigured) return mockFindStudioByOwnerId(MOCK_OWNER_ID);

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("studios")
    .select("*")
    .eq("owner_id", user.id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function createMyStudio(input: StudioInput): Promise<Studio> {
  if (!isSupabaseConfigured) {
    return mockCreateStudio({ ...input, owner_id: MOCK_OWNER_ID, logo_url: input.logo_url ?? null });
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autenticado");

  const { data, error } = await supabase
    .from("studios")
    .insert({ ...input, owner_id: user.id })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function updateMyStudio(id: string, patch: Partial<StudioInput>): Promise<Studio> {
  if (!isSupabaseConfigured) return mockUpdateStudio(id, patch);

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("studios")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

/** Leitura pública (página /[slug]) via service role — nunca com a chave anônima. */
export async function getPublicStudioBySlug(slug: string): Promise<Studio | null> {
  if (!isSupabaseConfigured) return mockFindStudioBySlug(slug);

  const supabase = createServiceRoleSupabaseClient();
  const { data, error } = await supabase
    .from("studios")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function isSlugAvailable(slug: string, excludeStudioId?: string): Promise<boolean> {
  const existing = await getPublicStudioBySlug(slug);
  if (!existing) return true;
  return existing.id === excludeStudioId;
}
