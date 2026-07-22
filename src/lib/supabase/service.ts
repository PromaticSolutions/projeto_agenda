import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { supabaseServiceRoleKey, supabaseUrl } from "@/lib/supabase/env";

/**
 * Cliente Supabase com a service_role key — ignora RLS.
 * Só pode ser importado a partir de código que roda no servidor (Route
 * Handlers / Server Actions). O import de "server-only" quebra o build se
 * este módulo acabar em um bundle de cliente por engano.
 *
 * Usado pela página pública /[slug] para ler serviços/horários/bloqueios e
 * para criar bookings, revalidando disponibilidade no servidor — nunca há
 * escrita pública direta nas tabelas via chave anônima.
 */
export function createServiceRoleSupabaseClient() {
  if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error(
      "Supabase não configurado: defina NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY em .env.local"
    );
  }
  return createClient<Database>(supabaseUrl, supabaseServiceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
