import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function KpiTile({
  label,
  value,
  sublabel,
  icon: Icon,
  accent,
}: {
  label: string;
  value: string;
  sublabel?: string;
  icon: LucideIcon;
  accent: string;
}) {
  return (
    <div className="overflow-hidden rounded-2xl bg-card shadow-sm ring-1 ring-plum-900/5">
      <div className={cn("h-1", accent)} />
      <div className="flex items-start justify-between gap-3 p-4 sm:p-5">
        <div className="min-w-0">
          <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{label}</p>
          <p className="mt-1.5 font-heading text-2xl font-semibold text-plum-900">{value}</p>
          {sublabel && <p className="mt-0.5 text-xs text-muted-foreground">{sublabel}</p>}
        </div>
        <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-xl text-white", accent)}>
          <Icon className="size-4" />
        </span>
      </div>
    </div>
  );
}
