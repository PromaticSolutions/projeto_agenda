import "server-only";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { mockGetWhatsAppConnection } from "@/lib/mock/store";
import type { WhatsAppConnection } from "@/lib/types";

/**
 * Leitura do estado da conexão de WhatsApp.
 *
 * O envio e o pareamento reais dependem da Evolution API, que ainda NÃO está
 * integrada (item 8 do escopo: só front-end). Esta função existe para a tela
 * refletir o estado persistido em vez de inventar um — quando a integração
 * entrar, é o webhook dela que passa a escrever nesta tabela.
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
