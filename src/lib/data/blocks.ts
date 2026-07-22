import "server-only";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/service";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { mockCreateBlock, mockDeleteBlock, mockListBlocks } from "@/lib/mock/store";
import type { Block } from "@/lib/types";

export interface BlockInput {
  studio_id: string;
  start_at: string;
  end_at: string;
  reason?: string | null;
}

export async function listMyBlocks(studioId: string): Promise<Block[]> {
  if (!isSupabaseConfigured) return mockListBlocks(studioId);

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("blocks")
    .select("*")
    .eq("studio_id", studioId)
    .order("start_at");
  if (error) throw error;
  return data;
}

export async function createBlock(input: BlockInput): Promise<Block> {
  if (!isSupabaseConfigured) return mockCreateBlock({ reason: null, ...input });

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.from("blocks").insert(input).select("*").single();
  if (error) throw error;
  return data;
}

export async function deleteBlock(id: string): Promise<void> {
  if (!isSupabaseConfigured) return mockDeleteBlock(id);

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.from("blocks").delete().eq("id", id);
  if (error) throw error;
}

/** Bloqueios que intersectam [from, to) — usado no cálculo de disponibilidade. */
export async function listPublicBlocksInRange(
  studioId: string,
  from: string,
  to: string
): Promise<Block[]> {
  if (!isSupabaseConfigured) {
    return mockListBlocks(studioId).filter((b) => b.start_at < to && b.end_at > from);
  }

  const supabase = createServiceRoleSupabaseClient();
  const { data, error } = await supabase
    .from("blocks")
    .select("*")
    .eq("studio_id", studioId)
    .lt("start_at", to)
    .gt("end_at", from);
  if (error) throw error;
  return data;
}
