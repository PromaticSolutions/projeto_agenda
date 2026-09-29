"use client";

import { useActionState, useState } from "react";
import { ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  cancelSubscriptionAction,
  startCheckoutAction,
  type BillingActionState,
} from "@/app/app/(dashboard)/assinatura/actions";

/** Leva para a página de pagamento da AbacatePay (a ação redireciona). */
export function SubscribeButton({ label, className }: { label: string; className?: string }) {
  const [state, formAction, pending] = useActionState<BillingActionState, FormData>(
    startCheckoutAction,
    null
  );

  const [lastState, setLastState] = useState(state);
  if (state !== lastState) {
    setLastState(state);
    if (state && !state.ok) toast.error(state.error);
  }

  return (
    <form action={formAction}>
      <Button type="submit" size="lg" disabled={pending} className={cn("gap-2 px-4", className)}>
        {pending ? "Abrindo pagamento…" : label}
        {!pending && <ArrowRight className="size-4" data-icon="inline-end" />}
      </Button>
    </form>
  );
}

export function CancelSubscriptionButton() {
  const [state, formAction, pending] = useActionState<BillingActionState, FormData>(
    cancelSubscriptionAction,
    null
  );

  const [lastState, setLastState] = useState(state);
  if (state !== lastState) {
    setLastState(state);
    if (state?.ok) toast.success(state.message);
    else if (state) toast.error(state.error);
  }

  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        if (
          !confirm(
            "Cancelar a assinatura do Timely?\n\nNenhuma nova cobrança será feita. Você pode assinar de novo quando quiser."
          )
        ) {
          e.preventDefault();
        }
      }}
    >
      <Button type="submit" variant="ghost" size="sm" disabled={pending} className="text-muted-foreground">
        {pending ? "Cancelando…" : "Cancelar assinatura"}
      </Button>
    </form>
  );
}
