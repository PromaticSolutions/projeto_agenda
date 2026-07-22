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
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
  };
}
