/**
 * Tipos do schema Supabase, escritos à mão a partir de
 * supabase/migrations/0001_init.sql (não há projeto Supabase vivo ainda
 * para gerar via `supabase gen types`). Quando plugar as chaves reais, rode:
 *   npx supabase gen types typescript --project-id <id> > src/lib/supabase/types.ts
 * e reconcilie manualmente com os campos usados no app.
 *
 * `Relationships: []` e `Views/Functions: {}` são exigidos pelo
 * GenericSchema do @supabase/supabase-js (>=2.110) para o client tipado
 * funcionar — sem eles toda query resolve para `never`.
 */

export type BookingStatus =
  | "agendado"
  | "em_atendimento"
  | "finalizado"
  | "cancelado";

/** enums da fila de mensagens — 0010_message_outbox.sql */
export type MessageOutboxKind = "lembrete" | "novo_agendamento";

export type MessageOutboxStatus =
  | "pendente"
  | "enviando"
  | "enviado"
  | "falhou"
  | "cancelado";

/** enum `whatsapp_connection_status` — 0009_whatsapp_connections.sql */
export type WhatsAppConnectionStatus =
  | "desconectado"
  | "conectando"
  | "conectado"
  | "erro";

export interface Database {
  public: {
    Tables: {
      studios: {
        Row: {
          id: string;
          owner_id: string;
          name: string;
          slug: string;
          whatsapp: string;
          brand_color: string;
          logo_url: string | null;
          /** 0006_studio_profile.sql */
          banner_url: string | null;
          owner_name: string | null;
          /** Somente dígitos. Dado pessoal — ver comentário na migração 0006. */
          owner_cpf: string | null;
          /** `date` do Postgres chega como "YYYY-MM-DD". */
          owner_birth_date: string | null;
          acquired_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          owner_id: string;
          name: string;
          slug: string;
          whatsapp: string;
          brand_color?: string;
          logo_url?: string | null;
          banner_url?: string | null;
          owner_name?: string | null;
          owner_cpf?: string | null;
          owner_birth_date?: string | null;
          acquired_at?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["studios"]["Insert"]>;
        Relationships: [];
      };
      services: {
        Row: {
          id: string;
          studio_id: string;
          name: string;
          price_cents: number;
          duration_min: number;
          color: string;
          active: boolean;
          /** 0005_services_notes_archive.sql — observações internas, opcional. */
          notes: string | null;
          /** Não-nulo = serviço arquivado (tinha bookings e não pode ser apagado). */
          archived_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          studio_id: string;
          name: string;
          price_cents: number;
          duration_min: number;
          color?: string;
          active?: boolean;
          notes?: string | null;
          archived_at?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["services"]["Insert"]>;
        Relationships: [];
      };
      working_hours: {
        Row: {
          id: string;
          studio_id: string;
          weekday: number;
          start_time: string;
          end_time: string;
        };
        Insert: {
          id?: string;
          studio_id: string;
          weekday: number;
          start_time: string;
          end_time: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["working_hours"]["Insert"]
        >;
        Relationships: [];
      };
      blocks: {
        Row: {
          id: string;
          studio_id: string;
          start_at: string;
          end_at: string;
          reason: string | null;
        };
        Insert: {
          id?: string;
          studio_id: string;
          start_at: string;
          end_at: string;
          reason?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["blocks"]["Insert"]>;
        Relationships: [];
      };
      bookings: {
        Row: {
          id: string;
          studio_id: string;
          service_id: string;
          client_id: string | null;
          client_name: string;
          client_phone: string;
          start_at: string;
          end_at: string;
          status: BookingStatus;
          created_at: string;
        };
        Insert: {
          id?: string;
          studio_id: string;
          service_id: string;
          client_id?: string | null;
          client_name: string;
          client_phone: string;
          start_at: string;
          end_at: string;
          status?: BookingStatus;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["bookings"]["Insert"]>;
        Relationships: [];
      };
      clients: {
        Row: {
          id: string;
          studio_id: string;
          name: string;
          phone: string;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          studio_id: string;
          name: string;
          phone: string;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["clients"]["Insert"]>;
        Relationships: [];
      };
      /** 0008_reminder_settings.sql — 1 linha por estúdio (studio_id é a PK). */
      reminder_settings: {
        Row: {
          studio_id: string;
          enabled: boolean;
          lead_time_minutes: number;
          message_template: string;
          include_link: boolean;
          link_url: string | null;
          updated_at: string;
        };
        Insert: {
          studio_id: string;
          enabled?: boolean;
          lead_time_minutes?: number;
          message_template?: string;
          include_link?: boolean;
          link_url?: string | null;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["reminder_settings"]["Insert"]>;
        Relationships: [];
      };
      /** 0009_whatsapp_connections.sql — estrutura sem integração ativa. */
      whatsapp_connections: {
        Row: {
          studio_id: string;
          status: WhatsAppConnectionStatus;
          instance_name: string | null;
          connected_phone: string | null;
          last_error: string | null;
          last_connected_at: string | null;
          updated_at: string;
        };
        Insert: {
          studio_id: string;
          status?: WhatsAppConnectionStatus;
          instance_name?: string | null;
          connected_phone?: string | null;
          last_error?: string | null;
          last_connected_at?: string | null;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["whatsapp_connections"]["Insert"]>;
        Relationships: [];
      };
      /** 0010_message_outbox.sql — fila de envio de WhatsApp. */
      message_outbox: {
        Row: {
          id: string;
          studio_id: string;
          booking_id: string | null;
          kind: MessageOutboxKind;
          to_phone: string;
          body: string;
          scheduled_for: string;
          status: MessageOutboxStatus;
          attempts: number;
          last_error: string | null;
          provider_message_id: string | null;
          sent_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          studio_id: string;
          booking_id?: string | null;
          kind: MessageOutboxKind;
          to_phone: string;
          body: string;
          scheduled_for: string;
          status?: MessageOutboxStatus;
          attempts?: number;
          last_error?: string | null;
          provider_message_id?: string | null;
          sent_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["message_outbox"]["Insert"]>;
        Relationships: [];
      };
      platform_admins: {
        Row: {
          user_id: string;
          created_at: string;
        };
        Insert: {
          user_id: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["platform_admins"]["Insert"]>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      /** 0010_message_outbox.sql — reivindicação atômica do lote a enviar. */
      claim_pending_messages: {
        Args: { p_limit: number };
        Returns: Database["public"]["Tables"]["message_outbox"]["Row"][];
      };
    };
  };
}
