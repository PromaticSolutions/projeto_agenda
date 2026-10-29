import "server-only";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/service";
import { isSupabaseServiceConfigured } from "@/lib/supabase/env";

/**
 * O LOGIN de cada dono de estúdio, lido do Supabase Auth.
 *
 * `studios` guarda nome e WhatsApp, mas o e-mail com que a pessoa entra e a
 * última vez que entrou só existem em `auth.users` — que o PostgREST não
 * expõe. Daí a API admin, que só funciona com a service_role.
 */
export interface OwnerAccount {
  email: string | null;
  createdAt: string;
  lastSignInAt: string | null;
}

/** Tamanho de página da API admin; o máximo que ela aceita é 1000. */
const USERS_PAGE_SIZE = 1000;

/**
 * Um Map user_id → login, com uma chamada por mil usuários (não uma por
 * estúdio). Fica vazio, e não estoura, quando o banco não está configurado:
 * a lista de clientes continua abrindo sem a coluna de login.
 */
export async function mapOwnerAccounts(): Promise<Map<string, OwnerAccount>> {
  const accounts = new Map<string, OwnerAccount>();
  if (!isSupabaseServiceConfigured) return accounts;

  const supabase = createServiceRoleSupabaseClient();
  for (let page = 1; ; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: USERS_PAGE_SIZE });
    if (error) throw error;
    for (const user of data.users) {
      accounts.set(user.id, {
        email: user.email ?? null,
        createdAt: user.created_at,
        lastSignInAt: user.last_sign_in_at ?? null,
      });
    }
    if (data.users.length < USERS_PAGE_SIZE) return accounts;
  }
}

export async function getOwnerAccount(userId: string): Promise<OwnerAccount | null> {
  if (!isSupabaseServiceConfigured) return null;

  const supabase = createServiceRoleSupabaseClient();
  const { data, error } = await supabase.auth.admin.getUserById(userId);
  if (error) {
    // Dono apagado do Auth à mão: a ficha mostra "sem login" em vez de cair.
    if (error.status === 404) return null;
    throw error;
  }
  return {
    email: data.user.email ?? null,
    createdAt: data.user.created_at,
    lastSignInAt: data.user.last_sign_in_at ?? null,
  };
}
