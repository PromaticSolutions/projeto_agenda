import type { Database } from "@/lib/supabase/types";

// Re-exporta os enums da 0016 para quem consome só `lib/types`.
export type { DataRequestKind, DataRequestStatus } from "@/lib/supabase/types";

export type Studio = Database["public"]["Tables"]["studios"]["Row"];
export type Service = Database["public"]["Tables"]["services"]["Row"];
export type WorkingHour = Database["public"]["Tables"]["working_hours"]["Row"];
export type Block = Database["public"]["Tables"]["blocks"]["Row"];
export type Booking = Database["public"]["Tables"]["bookings"]["Row"];
export type Client = Database["public"]["Tables"]["clients"]["Row"];
export type ReminderSettings = Database["public"]["Tables"]["reminder_settings"]["Row"];
export type WhatsAppConnection = Database["public"]["Tables"]["whatsapp_connections"]["Row"];
export type PlatformAdmin = Database["public"]["Tables"]["platform_admins"]["Row"];
export type MessageOutbox = Database["public"]["Tables"]["message_outbox"]["Row"];
/** Pesquisa de mercado da landing — 0013_market_research_leads.sql. */
export type MarketResearchLead = Database["public"]["Tables"]["market_research_leads"]["Row"];
export type Consent = Database["public"]["Tables"]["consents"]["Row"];
export type DataSubjectRequest =
  Database["public"]["Tables"]["data_subject_requests"]["Row"];
/** Cobrança da plataforma — 0011_billing.sql. */
export type Plan = Database["public"]["Tables"]["plans"]["Row"];
export type Subscription = Database["public"]["Tables"]["subscriptions"]["Row"];
export type Invoice = Database["public"]["Tables"]["invoices"]["Row"];
export type Payment = Database["public"]["Tables"]["payments"]["Row"];
export type BillingEvent = Database["public"]["Tables"]["billing_events"]["Row"];
export type { BookingStatus, WhatsAppConnectionStatus } from "@/lib/supabase/types";
export type { MessageOutboxKind, MessageOutboxStatus } from "@/lib/supabase/types";
export type { LeadInterest } from "@/lib/supabase/types";
export type {
  BillingGateway,
  InvoiceStatus,
  PaymentMethod,
  PaymentStatus,
  PlanInterval,
  SubscriptionStatus,
} from "@/lib/supabase/types";
