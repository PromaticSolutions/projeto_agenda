export const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
export const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
export const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

/**
 * Enquanto as chaves do Supabase não são configuradas em .env.local, o app
 * inteiro roda contra dados mockados (src/lib/mock) para o front funcionar
 * isolado. Ver DECISIONS.md.
 */
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const isSupabaseServiceConfigured = Boolean(
  supabaseUrl && supabaseServiceRoleKey
);
