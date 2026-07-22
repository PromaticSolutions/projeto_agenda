"use server";

import { revalidatePath } from "next/cache";
import { updateBookingStatus } from "@/lib/data/bookings";
import { bookingStatusSchema } from "@/lib/validation";

export async function updateBookingStatusAction(id: string, status: string): Promise<void> {
  const parsed = bookingStatusSchema.safeParse(status);
  if (!parsed.success) return;
  await updateBookingStatus(id, parsed.data);
  revalidatePath("/app");
}
