import "server-only";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/service";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { mockGetWhatsAppConnection } from "@/lib/mock/store";
import type { WhatsAppConnection } from "@/lib/types";

/**
 * Leitura do estado da conexão de WhatsApp.
 *
 * A tabela é o espelho local do que a Evolution API sabe. Quem a mantém em dia
 * é `syncWhatsAppConnection` (chamada pela tela de conexão e pelo disparador),
 * não um webhook: consultar o estado no momento em que ele importa evita
 * depender de uma entrega de webhook que pode ter se perdido enquanto a
 * aplicação estava em deploy.
 */
export async function getWhatsAppConnection(studioId: string): Promise<WhatsAppConnection> {
  if (!isSupabaseConfigured) return mockGetWhatsAppConnection(studioId);

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("whatsapp_connections")
    .select("*")
    .eq("studio_id", studioId)
    .maybeSingle();
  if (error) throw error;

  if (data) return data;
  return {
    studio_id: studioId,
    status: "desconectado",
    instance_name: null,
    connected_phone: null,
    last_error: null,
    last_connected_at: null,
    updated_at: new Date().toISOString(),
  };
}

export interface WhatsAppConnectionPatch {
  status?: WhatsAppConnection["status"];
  instance_name?: string | null;
  connected_phone?: string | null;
  last_error?: string | null;
  last_connected_at?: string | null;
}

/**
 * Grava o estado da conexão. Usa a service_role porque também é chamada pelo
 * disparador, que roda sem sessão de usuário — as chamadas vindas do painel já
 * resolveram o estúdio por `getMyStudio()`, então o tenant está checado antes
 * de chegar aqui.
 */
export async function saveWhatsAppConnection(
  studioId: string,
  patch: WhatsAppConnectionPatch
): Promise<WhatsAppConnection> {
  const supabase = createServiceRoleSupabaseClient();
  const { data, error } = await supabase
    .from("whatsapp_connections")
    .upsert(
      { studio_id: studioId, ...patch, updated_at: new Date().toISOString() },
      { onConflict: "studio_id" }
    )
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

/** Conexões de vários estúdios — o disparador checa antes de tentar enviar. */
export async function listWhatsAppConnectionsByStudioIds(
  studioIds: string[]
): Promise<WhatsAppConnection[]> {
  if (studioIds.length === 0) return [];
  const supabase = createServiceRoleSupabaseClient();
  const { data, error } = await supabase
    .from("whatsapp_connections")
    .select("*")
    .in("studio_id", studioIds);
  if (error) throw error;
  return data ?? [];
}
