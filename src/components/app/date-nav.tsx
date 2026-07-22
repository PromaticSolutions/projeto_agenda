"use client";

import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function DateNav({
  date,
  prevDate,
  nextDate,
  todayDate,
}: {
  date: string;
  prevDate: string;
  nextDate: string;
  todayDate: string;
}) {
  const router = useRouter();

  return (
    <div className="flex items-center gap-1.5">
      <Button variant="outline" size="icon-sm" onClick={() => router.push(`/app?date=${prevDate}`)}>
        <ChevronLeft className="size-4" />
      </Button>
      <Input
        type="date"
        value={date}
        onChange={(e) => e.target.value && router.push(`/app?date=${e.target.value}`)}
        className="h-8 w-40"
      />
      <Button variant="outline" size="icon-sm" onClick={() => router.push(`/app?date=${nextDate}`)}>
        <ChevronRight className="size-4" />
      </Button>
      {date !== todayDate && (
        <Button variant="ghost" size="sm" onClick={() => router.push("/app")}>
          Hoje
        </Button>
      )}
    </div>
  );
}
