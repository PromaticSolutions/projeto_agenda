import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/lib/supabase/types";
import { supabaseAnonKey, supabaseUrl } from "@/lib/supabase/env";

/** Cliente Supabase para uso em Client Components. */
export function createBrowserSupabaseClient() {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "Supabase não configurado: defina NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY em .env.local"
    );
  }
  return createBrowserClient<Database>(supabaseUrl, supabaseAnonKey);
}
