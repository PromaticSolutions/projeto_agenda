"use client";

import { useTransition } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { resolveMyTicketAction } from "@/app/app/(dashboard)/suporte/actions";

/** O estúdio encerra o próprio chamado quando o problema sumiu. */
export function ResolveTicketButton({ ticketId }: { ticketId: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={() => startTransition(() => resolveMyTicketAction(ticketId))}
    >
      {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <CheckCircle2 className="size-4" aria-hidden />}
      Resolvido, pode fechar
    </Button>
  );
}
