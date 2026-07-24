"use client";

import { useRouter } from "next/navigation";
import { nextLocalDate, prevLocalDate, weekdayOfDate } from "@/lib/availability";
import { WEEKDAY_LABELS_SHORT } from "@/lib/weekdays";
import { cn } from "@/lib/utils";

function mondayOfWeek(dateStr: string): string {
  const dow = weekdayOfDate(dateStr);
  const daysSinceMonday = dow === 0 ? 6 : dow - 1;
  let d = dateStr;
  for (let i = 0; i < daysSinceMonday; i++) d = prevLocalDate(d);
  return d;
}

export function WeekStrip({ date, todayDate }: { date: string; todayDate: string }) {
  const router = useRouter();
  const monday = mondayOfWeek(date);
  const days: string[] = [monday];
  for (let i = 1; i < 7; i++) days.push(nextLocalDate(days[i - 1]));

  return (
    <div className="flex gap-1.5 overflow-x-auto">
      {days.map((d) => {
        const dayNum = Number(d.slice(8, 10));
        const isSelected = d === date;
        const isToday = d === todayDate;
        return (
          <button
            key={d}
            type="button"
            onClick={() => router.push(`/app?date=${d}`)}
            className={cn(
              "flex min-w-11 flex-1 flex-col items-center gap-0.5 rounded-xl px-2 py-1.5 transition-colors",
              isSelected
                ? "bg-cta text-white"
                : isToday
                  ? "bg-violet-600/10 text-violet-700"
                  : "text-muted-foreground hover:bg-muted"
            )}
          >
            <span className="text-[0.65rem] font-medium tracking-wide uppercase opacity-80">
              {WEEKDAY_LABELS_SHORT[weekdayOfDate(d)]}
            </span>
            <span className="text-sm font-semibold tabular-nums">{dayNum}</span>
          </button>
        );
      })}
    </div>
  );
}
