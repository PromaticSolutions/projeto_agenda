import "server-only";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/service";
import { isSupabaseServiceConfigured } from "@/lib/supabase/env";
import type { Database } from "@/lib/supabase/types";

/**
 * A conexão de WhatsApp da PRÓPRIA plataforma (tabela `platform_whatsapp`,
 * migração 0017) — o remetente dos avisos que não pertencem a estúdio nenhum.
 *
 * Espelha `data/whatsapp.ts`, que faz o mesmo por estúdio, com duas
 * diferenças: é linha única (não recebe id) e carrega `notify_phone`, o
 * DESTINO do aviso — que na conexão do estúdio não existe porque lá o destino
 * é a cliente do agendamento.
 *
 * Tudo aqui passa por service role. A tela que chama isto é do superadmin, e o
 * `platform_admins` já foi conferido no layout dessa área antes de renderizar.
 */

export type PlatformWhatsApp =
  Database["public"]["Tables"]["platform_whatsapp"]["Row"];

/** Estado neutro, para quando o banco não está configurado (modo mock). */
const VAZIO: PlatformWhatsApp = {
  id: true,
  status: "desconectado",
  instance_name: null,
  connected_phone: null,
  notify_phone: null,
  last_error: null,
  last_connected_at: null,
  updated_at: new Date(0).toISOString(),
};

export async function getPlatformWhatsApp(): Promise<PlatformWhatsApp> {
  if (!isSupabaseServiceConfigured) return VAZIO;

  const supabase = createServiceRoleSupabaseClient();
  const { data, error } = await supabase
    .from("platform_whatsapp")
    .select("*")
    .eq("id", true)
    .maybeSingle();
  if (error) throw error;
  // A migração já insere a linha; o fallback cobre o banco que ainda não a
  // rodou, para a tela dizer "rode a migração 0017" em vez de estourar.
  return data ?? VAZIO;
}

export type PlatformWhatsAppPatch = {
  status?: PlatformWhatsApp["status"];
  instance_name?: string | null;
  connected_phone?: string | null;
  notify_phone?: string | null;
  last_error?: string | null;
  last_connected_at?: string | null;
};

export async function savePlatformWhatsApp(
  patch: PlatformWhatsAppPatch
): Promise<PlatformWhatsApp> {
  const supabase = createServiceRoleSupabaseClient();
  const { data, error } = await supabase
    .from("platform_whatsapp")
    .upsert({ id: true, ...patch, updated_at: new Date().toISOString() }, { onConflict: "id" })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

/**
 * Para onde mandar o aviso de lead.
 *
 * Devolve o destino mesmo com a sessão CAÍDA: o aviso entra na fila e espera
 * a reconexão. Antes só devolvia com a sessão de pé, e o lead que chegava
 * durante uma queda nunca era avisado — foi o que aconteceu em setembro, com
 * a instância parada em "aguardando QR" por semanas sem ninguém notar.
 */
export async function leadNotifyTarget(): Promise<string | null> {
  const conexao = await getPlatformWhatsApp();
  return conexao.notify_phone;
}
