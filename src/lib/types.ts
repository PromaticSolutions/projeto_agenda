import type { Database } from "@/lib/supabase/types";

export type Studio = Database["public"]["Tables"]["studios"]["Row"];
export type Service = Database["public"]["Tables"]["services"]["Row"];
export type WorkingHour = Database["public"]["Tables"]["working_hours"]["Row"];
export type Block = Database["public"]["Tables"]["blocks"]["Row"];
export type Booking = Database["public"]["Tables"]["bookings"]["Row"];
export type PlatformAdmin = Database["public"]["Tables"]["platform_admins"]["Row"];
export type { BookingStatus } from "@/lib/supabase/types";
