import "server-only";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/service";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export interface CurrentAdmin {
  id: string;
  email: string | null;
}

export type PlatformAdminCheck =
  | { status: "unauthenticated" }
  | { status: "forbidden" }
  | { status: "ok"; admin: CurrentAdmin };

/**
 * Resultado distinto pra "não logado" vs. "logado mas não é admin" — o
 * layout de /superadmin precisa saber a diferença: no primeiro caso manda
 * pro /login, no segundo mostra "acesso restrito" (mandar de volta pro
 * /login criaria um loop pra um dono de estúdio comum, que já tem sessão
 * válida mas não é admin da plataforma).
 *
 * A checagem em `platform_admins` sempre roda com a service_role key: a
 * tabela não tem policy nenhuma pra anon/authenticated, então nem o próprio
 * usuário conseguiria confirmar seu status via client comum.
 */
export async function checkPlatformAdmin(): Promise<PlatformAdminCheck> {
  if (!isSupabaseConfigured) return { status: "unauthenticated" };

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: "unauthenticated" };

  const service = createServiceRoleSupabaseClient();
  const { data, error } = await service
    .from("platform_admins")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return { status: "forbidden" };

  return { status: "ok", admin: { id: user.id, email: user.email ?? null } };
}
