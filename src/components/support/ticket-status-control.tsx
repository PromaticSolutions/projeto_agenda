"use client";

import { useTransition } from "react";
import { setTicketStatusAction } from "@/app/superadmin/chamados/actions";
import { STATUS_CLASS, STATUS_LABEL } from "@/lib/support";
import { cn } from "@/lib/utils";
import type { SupportTicketStatus } from "@/lib/types";

const ORDER: SupportTicketStatus[] = ["aberto", "em_andamento", "resolvido"];

/** Troca de situação pela equipe: três estados, todos visíveis. */
export function TicketStatusControl({ ticketId, status }: { ticketId: string; status: SupportTicketStatus }) {
  const [pending, startTransition] = useTransition();
  return (
    <div role="radiogroup" aria-label="Situação do chamado" className="flex gap-1 rounded-lg border border-border p-1">
      {ORDER.map((value) => {
        const active = value === status;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={pending || active}
            onClick={() => startTransition(() => setTicketStatusAction(ticketId, value))}
            className={cn(
              "rounded-md px-2.5 py-1 text-xs font-medium transition-colors disabled:cursor-default",
              active ? STATUS_CLASS[value] : "text-muted-foreground hover:bg-muted hover:text-foreground",
              pending && !active && "opacity-50"
            )}
          >
            {STATUS_LABEL[value]}
          </button>
        );
      })}
    </div>
  );
}
