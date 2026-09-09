/**
 * Aliases de tipo para o teste do disparador.
 *
 * Existem para o arquivo de teste não importar `@/lib/supabase/types` por
 * caminhos diferentes dos módulos que ele mocka — importar o tipo de dentro do
 * módulo mockado traria o mock junto.
 */
import type { Database } from "@/lib/supabase/types";

export type MessageOutbox = Database["public"]["Tables"]["message_outbox"]["Row"];
export type WhatsAppConnection = Database["public"]["Tables"]["whatsapp_connections"]["Row"];
export type PlatformWhatsAppRow = Database["public"]["Tables"]["platform_whatsapp"]["Row"];
