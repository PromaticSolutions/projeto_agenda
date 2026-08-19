import "server-only";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";

/**
 * E-mail da conta autenticada.
 *
 * Vive em `auth.users`, não na tabela `studios`: trocá-lo exige o fluxo de
 * autenticação do Supabase, que confirma o endereço novo. Por isso o módulo
 * Configurações apenas EXIBE este valor — ver `studioProfileSchema`.
 */
export async function getMyEmail(): Promise<string | null> {
  if (!isSupabaseConfigured) return "dono@exemplo.com";

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.email ?? null;
}
