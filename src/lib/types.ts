import type { Database } from "@/lib/supabase/types";

// Re-exporta os enums da 0016 para quem consome só `lib/types`.
export type { DataRequestKind, DataRequestStatus } from "@/lib/supabase/types";

export type Studio = Database["public"]["Tables"]["studios"]["Row"];
export type Service = Database["public"]["Tables"]["services"]["Row"];
/** Foto ou anexo interno de um serviço — 0020_service_attachments.sql. */
export type ServiceAttachment = Database["public"]["Tables"]["service_attachments"]["Row"];
/** Anexo pronto para a tela: o bucket é privado, então vem com URL assinada. */
export type ServiceAttachmentView = Pick<
  ServiceAttachment,
  "id" | "storage_path" | "file_name" | "mime_type" | "size_bytes"
> & { url: string | null };
/** O que a tela de Serviços recebe: o serviço e os anexos dele. */
export type ServiceWithAttachments = Service & { attachments: ServiceAttachmentView[] };
export type WorkingHour = Database["public"]["Tables"]["working_hours"]["Row"];
export type Block = Database["public"]["Tables"]["blocks"]["Row"];
export type Booking = Database["public"]["Tables"]["bookings"]["Row"];
export type Client = Database["public"]["Tables"]["clients"]["Row"];
export type ReminderSettings = Database["public"]["Tables"]["reminder_settings"]["Row"];
export type WhatsAppConnection = Database["public"]["Tables"]["whatsapp_connections"]["Row"];
export type PlatformAdmin = Database["public"]["Tables"]["platform_admins"]["Row"];
export type MessageOutbox = Database["public"]["Tables"]["message_outbox"]["Row"];
/** Conversas de WhatsApp com clientes cadastradas — 0019_whatsapp_messages.sql. */
export type WhatsAppMessage = Database["public"]["Tables"]["whatsapp_messages"]["Row"];
export type WhatsAppConversation = Database["public"]["Views"]["whatsapp_conversations"]["Row"];
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
export type { WhatsAppMessageDirection, WhatsAppMessageType } from "@/lib/supabase/types";
export type { LeadInterest } from "@/lib/supabase/types";
export type {
  BillingGateway,
  InvoiceStatus,
  PaymentMethod,
  PaymentStatus,
  PlanInterval,
  SubscriptionStatus,
} from "@/lib/supabase/types";
