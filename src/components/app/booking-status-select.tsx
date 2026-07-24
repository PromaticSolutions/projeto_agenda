"use client";

import { useState, useTransition } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { updateBookingStatusAction } from "@/app/app/(dashboard)/actions";
import { BOOKING_STATUS_DOT, BOOKING_STATUS_LABELS, BOOKING_STATUS_ORDER } from "@/lib/booking-status";
import type { BookingStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

const QUICK_STATUSES: BookingStatus[] = ["agendado", "em_atendimento", "finalizado"];

export function BookingStatusSelect({
  bookingId,
  status,
}: {
  bookingId: string;
  status: BookingStatus;
}) {
  const [value, setValue] = useState<BookingStatus>(status);
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function handleChange(next: BookingStatus) {
    if (next === value) return;
    setValue(next);
    setOpen(false);
    startTransition(() => updateBookingStatusAction(bookingId, next));
  }

  const isQuickStatus = QUICK_STATUSES.includes(value);

  return (
    <div className="flex items-center gap-1">
      <div className="inline-flex items-center gap-0.5 rounded-full bg-muted p-0.5">
        {QUICK_STATUSES.map((s) => {
          const active = value === s;
          return (
            <button
              key={s}
              type="button"
              disabled={pending}
              onClick={() => handleChange(s)}
              className={cn(
                "flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium whitespace-nowrap transition-colors disabled:opacity-50",
                active ? cn("text-white", BOOKING_STATUS_DOT[s]) : "text-muted-foreground hover:text-foreground"
              )}
            >
              {!active && <span className={cn("size-1.5 rounded-full", BOOKING_STATUS_DOT[s])} />}
              {BOOKING_STATUS_LABELS[s]}
            </button>
          );
        })}
      </div>

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          render={
            <button
              type="button"
              className={cn(
                "flex size-7 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
                !isQuickStatus && "bg-muted"
              )}
              aria-label="Mais status"
            />
          }
        >
          {!isQuickStatus ? (
            <span className={cn("size-2 rounded-full", BOOKING_STATUS_DOT[value])} />
          ) : (
            <span className="text-base leading-none">···</span>
          )}
        </PopoverTrigger>
        <PopoverContent align="end" className="w-40 p-1">
          {BOOKING_STATUS_ORDER.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => handleChange(s)}
              className={cn(
                "flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition-colors hover:bg-accent hover:text-accent-foreground",
                value === s && "font-medium"
              )}
            >
              <span className={cn("size-2 rounded-full", BOOKING_STATUS_DOT[s])} />
              {BOOKING_STATUS_LABELS[s]}
            </button>
          ))}
        </PopoverContent>
      </Popover>
    </div>
  );
}
