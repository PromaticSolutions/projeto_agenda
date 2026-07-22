"use client";

import { useState, useTransition } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { updateBookingStatusAction } from "@/app/app/(dashboard)/actions";
import { BOOKING_STATUS_DOT, BOOKING_STATUS_LABELS, BOOKING_STATUS_ORDER } from "@/lib/booking-status";
import type { BookingStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

export function BookingStatusSelect({
  bookingId,
  status,
}: {
  bookingId: string;
  status: BookingStatus;
}) {
  const [value, setValue] = useState<BookingStatus>(status);
  const [pending, startTransition] = useTransition();

  function handleChange(next: string | null) {
    if (!next) return;
    const nextStatus = next as BookingStatus;
    setValue(nextStatus);
    startTransition(() => updateBookingStatusAction(bookingId, nextStatus));
  }

  return (
    <Select value={value} onValueChange={handleChange} disabled={pending}>
      <SelectTrigger size="sm" className="gap-1.5">
        <span className={cn("size-2 rounded-full", BOOKING_STATUS_DOT[value])} />
        <SelectValue>{BOOKING_STATUS_LABELS[value]}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        {BOOKING_STATUS_ORDER.map((s) => (
          <SelectItem key={s} value={s}>
            <span className={cn("size-2 rounded-full", BOOKING_STATUS_DOT[s])} />
            {BOOKING_STATUS_LABELS[s]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
