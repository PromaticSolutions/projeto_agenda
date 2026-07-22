import "server-only";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/service";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import {
  mockCreateWorkingHour,
  mockDeleteWorkingHour,
  mockListWorkingHours,
} from "@/lib/mock/store";
import type { WorkingHour } from "@/lib/types";

export interface WorkingHourInput {
  studio_id: string;
  weekday: number;
  start_time: string;
  end_time: string;
}

export async function listMyWorkingHours(studioId: string): Promise<WorkingHour[]> {
  if (!isSupabaseConfigured) return mockListWorkingHours(studioId);

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("working_hours")
    .select("*")
    .eq("studio_id", studioId)
    .order("weekday")
    .order("start_time");
  if (error) throw error;
  return data;
}

export async function createWorkingHour(input: WorkingHourInput): Promise<WorkingHour> {
  if (!isSupabaseConfigured) return mockCreateWorkingHour(input);

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("working_hours")
    .insert(input)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function deleteWorkingHour(id: string): Promise<void> {
  if (!isSupabaseConfigured) return mockDeleteWorkingHour(id);

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.from("working_hours").delete().eq("id", id);
  if (error) throw error;
}

/** Leitura pública (disponibilidade) via service role. */
export async function listPublicWorkingHours(studioId: string): Promise<WorkingHour[]> {
  if (!isSupabaseConfigured) return mockListWorkingHours(studioId);

  const supabase = createServiceRoleSupabaseClient();
  const { data, error } = await supabase
    .from("working_hours")
    .select("*")
    .eq("studio_id", studioId);
  if (error) throw error;
  return data;
}
