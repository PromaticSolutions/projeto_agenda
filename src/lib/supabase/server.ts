import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/lib/supabase/types";
import { supabaseAnonKey, supabaseUrl } from "@/lib/supabase/env";

/**
 * Cliente Supabase para Server Components / Route Handlers / Server Actions.
 * Next.js 16 + React 19 tornaram cookies() assíncrono — sempre `await` aqui,
 * senão a sessão do Auth some silenciosamente no painel /app.
 */
export async function createServerSupabaseClient() {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "Supabase não configurado: defina NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY em .env.local"
    );
  }
  const cookieStore = await cookies();

  return createServerClient<Database>(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // Chamado a partir de um Server Component sem permissão de escrita.
          // Ignorável: o proxy.ts já cuida de renovar a sessão a cada request.
        }
      },
    },
  });
}
