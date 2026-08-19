import type { Database } from "@/lib/supabase/types";

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
export type { BookingStatus, WhatsAppConnectionStatus } from "@/lib/supabase/types";
export type { MessageOutboxKind, MessageOutboxStatus } from "@/lib/supabase/types";
