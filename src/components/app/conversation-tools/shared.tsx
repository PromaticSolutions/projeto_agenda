"use client";

import Link from "next/link";
import { Loader2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { ToolsData } from "@/components/app/conversation-tools/use-tools-data";
import type {
  ConversationTools,
  ConversationToolService,
} from "@/app/app/(dashboard)/conversations/actions";

/** Peças repetidas entre as ferramentas do painel de atendimento. */

const dayLabelFormatter = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "UTC",
  weekday: "short",
  day: "2-digit",
  month: "2-digit",
});
const weekdayFormatter = new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC", weekday: "short" });

/** "2026-09-24" -> "qua., 24/09" — data de calendário, sem fuso no meio. */
export function formatDayLabel(date: string): string {
  return dayLabelFormatter.format(dateOnly(date));
}

/** "2026-09-24" -> "qua." */
export function formatWeekdayShort(date: string): string {
  return weekdayFormatter.format(dateOnly(date)).replace(".", "");
}

export function dayOfMonth(date: string): string {
  return date.slice(8, 10);
}

function dateOnly(date: string): Date {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, d!));
}

/** Estado de carregamento comum: esqueleto, erro, ou as ferramentas prontas. */
export function WithTools({
  data,
  children,
}: {
  data: ToolsData;
  children: (tools: ConversationTools) => React.ReactNode;
}) {
  if (data.status === "loading") {
    return (
      <div className="flex flex-col gap-2 py-1" aria-busy="true" aria-label="Carregando">
        <Skeleton className="h-9 rounded-lg" />
        <Skeleton className="h-9 rounded-lg" />
      </div>
    );
  }
  if (data.status === "error") {
    return (
      <p className="py-1 text-sm text-muted-foreground">
        Não foi possível carregar os serviços. Recarregue a página para tentar de novo.
      </p>
    );
  }
  if (data.tools.services.length === 0) {
    return (
      <p className="py-1 text-sm text-muted-foreground">
        Nenhum serviço ativo.{" "}
        <Link href="/app/services" className="font-medium text-primary underline-offset-4 hover:underline dark:text-violet-300">
          Cadastre um serviço
        </Link>{" "}
        para usar esta ferramenta.
      </p>
    );
  }
  return <>{children(data.tools)}</>;
}

export const FIELD_CLASS =
  "h-10 w-full rounded-lg border border-input bg-card px-3 text-sm text-foreground outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-60";

export function FieldLabel({ htmlFor, children }: { htmlFor?: string; children: React.ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="text-xs font-medium text-muted-foreground">
      {children}
    </label>
  );
}

/** Serviço por `<select>` nativo: no celular abre a roda do sistema, que é o mais rápido. */
export function ServiceSelect({
  id,
  services,
  value,
  onChange,
}: {
  id: string;
  services: ConversationToolService[];
  value: string;
  onChange: (serviceId: string) => void;
}) {
  return (
    <select id={id} value={value} onChange={(event) => onChange(event.target.value)} className={FIELD_CLASS}>
      {services.map((service) => (
        <option key={service.id} value={service.id}>
          {service.name}
        </option>
      ))}
    </select>
  );
}

/** Botão principal das ferramentas: largura toda, com estado de envio. */
export function ToolButton({
  children,
  pending,
  pendingLabel,
  variant = "primary",
  className,
  ...props
}: React.ComponentProps<"button"> & {
  pending?: boolean;
  pendingLabel?: string;
  variant?: "primary" | "outline";
}) {
  return (
    <button
      type="button"
      {...props}
      disabled={props.disabled || pending}
      className={cn(
        "inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold outline-none transition active:translate-y-px focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50",
        variant === "primary"
          ? "bg-cta text-primary-foreground shadow-float hover:opacity-90"
          : "border border-border bg-card text-foreground hover:bg-muted",
        className
      )}
    >
      {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
      {pending && pendingLabel ? pendingLabel : children}
    </button>
  );
}
