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
export type MessageOutboxKind =
  | "lembrete"
  | "novo_agendamento"
  /** 0012 — mensagem disparada à mão pelo dono em /app/whatsapp. */
  | "manual"
  /** 0013 — aviso de lead da pesquisa da landing, para o dono da plataforma. */
  | "lead";

export type MessageOutboxStatus =
  | "pendente"
  | "enviando"
  | "enviado"
  | "falhou"
  | "cancelado";

/** enum `lead_interest` — 0013_market_research_leads.sql */
export type LeadInterest = "sim" | "talvez" | "saber_mais" | "nao";

/** enums `data_request_*` — 0016_data_subject_requests.sql */
export type DataRequestKind = "acesso" | "correcao" | "exclusao" | "oposicao";

export type DataRequestStatus = "aberta" | "em_andamento" | "concluida" | "recusada";

/** enum `whatsapp_connection_status` — 0009_whatsapp_connections.sql */
export type WhatsAppConnectionStatus =
  | "desconectado"
  | "conectando"
  | "conectado"
  | "erro";

/** enums de cobrança — 0011_billing.sql */
export type PlanInterval = "mensal" | "anual";

export type SubscriptionStatus =
  | "trial"
  | "ativa"
  | "inadimplente"
  | "pausada"
  | "cancelada";

export type InvoiceStatus =
  | "aberta"
  | "paga"
  | "vencida"
  | "cancelada"
  | "reembolsada";

export type PaymentMethod = "pix" | "cartao_credito" | "boleto";

export type PaymentStatus =
  | "pendente"
  | "aprovado"
  | "recusado"
  | "estornado"
  | "expirado";

/** Gateways previstos. `manual` = baixa dada à mão pelo admin (TED, cortesia). */
export type BillingGateway =
  | "mercadopago"
  | "asaas"
  | "stripe"
  | "pagarme"
  | "manual";

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
          /** Nulo = mensagem da plataforma (0017). */
          studio_id: string | null;
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
          studio_id?: string | null;
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
      /** 0017_platform_whatsapp.sql — linha única: o remetente da plataforma. */
      platform_whatsapp: {
        Row: {
          id: boolean;
          status: WhatsAppConnectionStatus;
          instance_name: string | null;
          connected_phone: string | null;
          /** Destino do aviso de lead. Nulo = ninguém é avisado. */
          notify_phone: string | null;
          last_error: string | null;
          last_connected_at: string | null;
          updated_at: string;
        };
        Insert: {
          id?: boolean;
          status?: WhatsAppConnectionStatus;
          instance_name?: string | null;
          connected_phone?: string | null;
          notify_phone?: string | null;
          last_error?: string | null;
          last_connected_at?: string | null;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["platform_whatsapp"]["Insert"]>;
        Relationships: [];
      };
      /** 0016_data_subject_requests.sql — canal do art. 18 da LGPD. */
      data_subject_requests: {
        Row: {
          id: string;
          studio_id: string;
          kind: DataRequestKind;
          client_name: string;
          client_phone: string;
          message: string | null;
          status: DataRequestStatus;
          resolution_note: string | null;
          resolved_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          studio_id: string;
          kind: DataRequestKind;
          client_name: string;
          client_phone: string;
          message?: string | null;
          status?: DataRequestStatus;
          resolution_note?: string | null;
          resolved_at?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["data_subject_requests"]["Insert"]>;
        Relationships: [];
      };
      /** 0015_consents.sql — prova datada de consentimento do titular (LGPD). */
      consents: {
        Row: {
          id: string;
          studio_id: string;
          /** Nulos quando a linha de origem foi excluída: apagar um
           *  agendamento não pode apagar a prova de que houve consentimento. */
          booking_id: string | null;
          client_id: string | null;
          /** Desnormalizado e obrigatório — é por ele que se acha o registro
           *  depois que `clients` já não tem a linha. */
          client_phone: string;
          /** Bate com POLICY_VERSION em `lib/consent.ts`. */
          policy_version: string;
          consented_at: string;
          ip_address: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          studio_id: string;
          booking_id?: string | null;
          client_id?: string | null;
          client_phone: string;
          policy_version: string;
          consented_at?: string;
          ip_address?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["consents"]["Insert"]>;
        Relationships: [];
      };
      /** 0013_market_research_leads.sql — pesquisa de mercado da landing. */
      market_research_leads: {
        Row: {
          id: string;
          name: string;
          phone: string;
          instagram: string | null;
          business_name: string | null;
          email: string | null;
          profession: string;
          /** 0014 — opcionais: coletados depois do envio, sem travar o funil. */
          team_size: string | null;
          agenda_tools: string[];
          pain_points: string[];
          weekly_volume: string | null;
          whatsapp_reliance: string | null;
          improvement_wish: string | null;
          interest: LeadInterest | null;
          hours_lost_band: string | null;
          contact_allowed: boolean;
          privacy_accepted_at: string | null;
          source: string;
          utm: Record<string, string> | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          phone: string;
          instagram?: string | null;
          business_name?: string | null;
          email?: string | null;
          profession: string;
          team_size?: string | null;
          agenda_tools?: string[];
          pain_points?: string[];
          weekly_volume?: string | null;
          whatsapp_reliance?: string | null;
          improvement_wish?: string | null;
          interest?: LeadInterest | null;
          hours_lost_band?: string | null;
          contact_allowed?: boolean;
          privacy_accepted_at?: string | null;
          source?: string;
          utm?: Record<string, string> | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["market_research_leads"]["Insert"]>;
        Relationships: [];
      };
      /** 0011_billing.sql — catálogo comercial da plataforma. */
      plans: {
        Row: {
          id: string;
          code: string;
          name: string;
          tagline: string | null;
          price_cents: number;
          billing_interval: PlanInterval;
          trial_days: number;
          /** Nulo = ilimitado. */
          max_bookings_per_month: number | null;
          max_services: number | null;
          includes_whatsapp: boolean;
          active: boolean;
          sort_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          code: string;
          name: string;
          tagline?: string | null;
          price_cents: number;
          billing_interval?: PlanInterval;
          trial_days?: number;
          max_bookings_per_month?: number | null;
          max_services?: number | null;
          includes_whatsapp?: boolean;
          active?: boolean;
          sort_order?: number;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["plans"]["Insert"]>;
        Relationships: [];
      };
      /** 0011_billing.sql — contrato estúdio ↔ plataforma. */
      subscriptions: {
        Row: {
          id: string;
          studio_id: string;
          plan_id: string;
          status: SubscriptionStatus;
          /** Valor travado na contratação, em centavos. */
          amount_cents: number;
          started_at: string;
          trial_ends_at: string | null;
          current_period_start: string;
          current_period_end: string;
          cancel_at_period_end: boolean;
          canceled_at: string | null;
          cancel_reason: string | null;
          gateway: BillingGateway | null;
          gateway_customer_id: string | null;
          gateway_subscription_id: string | null;
          default_payment_method: PaymentMethod | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          studio_id: string;
          plan_id: string;
          status?: SubscriptionStatus;
          amount_cents: number;
          started_at?: string;
          trial_ends_at?: string | null;
          current_period_start?: string;
          current_period_end?: string;
          cancel_at_period_end?: boolean;
          canceled_at?: string | null;
          cancel_reason?: string | null;
          gateway?: BillingGateway | null;
          gateway_customer_id?: string | null;
          gateway_subscription_id?: string | null;
          default_payment_method?: PaymentMethod | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["subscriptions"]["Insert"]>;
        Relationships: [];
      };
      /** 0011_billing.sql — o que foi cobrado do estúdio. */
      invoices: {
        Row: {
          id: string;
          studio_id: string;
          subscription_id: string | null;
          /** Sequência humana ("#1043"), gerada pelo banco. */
          seq: number;
          amount_cents: number;
          discount_cents: number;
          /** Coluna gerada (amount - discount) — só leitura. */
          total_cents: number;
          status: InvoiceStatus;
          description: string | null;
          period_start: string | null;
          period_end: string | null;
          due_date: string;
          issued_at: string;
          paid_at: string | null;
          canceled_at: string | null;
          gateway: string | null;
          gateway_invoice_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          studio_id: string;
          subscription_id?: string | null;
          amount_cents: number;
          discount_cents?: number;
          status?: InvoiceStatus;
          description?: string | null;
          period_start?: string | null;
          period_end?: string | null;
          due_date: string;
          issued_at?: string;
          paid_at?: string | null;
          canceled_at?: string | null;
          gateway?: string | null;
          gateway_invoice_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["invoices"]["Insert"]>;
        Relationships: [];
      };
      /** 0011_billing.sql — tentativas de pagar uma fatura. */
      payments: {
        Row: {
          id: string;
          invoice_id: string;
          studio_id: string;
          amount_cents: number;
          fee_cents: number;
          refunded_cents: number;
          method: PaymentMethod;
          status: PaymentStatus;
          installments: number;
          card_brand: string | null;
          /** Só os 4 últimos — ver cabeçalho da 0011. */
          card_last4: string | null;
          pix_expires_at: string | null;
          paid_at: string | null;
          failure_code: string | null;
          failure_reason: string | null;
          gateway: string | null;
          gateway_payment_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          invoice_id: string;
          studio_id: string;
          amount_cents: number;
          fee_cents?: number;
          refunded_cents?: number;
          method: PaymentMethod;
          status?: PaymentStatus;
          installments?: number;
          card_brand?: string | null;
          card_last4?: string | null;
          pix_expires_at?: string | null;
          paid_at?: string | null;
          failure_code?: string | null;
          failure_reason?: string | null;
          gateway?: string | null;
          gateway_payment_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["payments"]["Insert"]>;
        Relationships: [];
      };
      /** 0011_billing.sql — log cru de webhook do gateway. */
      billing_events: {
        Row: {
          id: string;
          gateway: string;
          event_type: string;
          external_event_id: string | null;
          studio_id: string | null;
          invoice_id: string | null;
          payment_id: string | null;
          payload: Record<string, unknown>;
          processed_at: string | null;
          process_error: string | null;
          received_at: string;
        };
        Insert: {
          id?: string;
          gateway: string;
          event_type: string;
          external_event_id?: string | null;
          studio_id?: string | null;
          invoice_id?: string | null;
          payment_id?: string | null;
          payload?: Record<string, unknown>;
          processed_at?: string | null;
          process_error?: string | null;
          received_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["billing_events"]["Insert"]>;
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
