import type { Subscription } from "@/lib/types";

/**
 * O que a tela /app/assinatura (e o aviso no topo do painel) mostram, a
 * partir da assinatura mais recente do estúdio.
 *
 * Função pura e separada da tela porque a mesma regra vai decidir o bloqueio
 * depois do teste — e regra de acesso precisa de teste automatizado, não de
 * conferência visual.
 */
export type SubscriptionView =
  | { kind: "sem_assinatura" }
  | { kind: "teste"; endsAt: string; daysLeft: number }
  | { kind: "teste_acabou"; endedAt: string }
  | { kind: "ativa"; nextChargeAt: string }
  | { kind: "pagamento_pendente"; since: string }
  | { kind: "cancelada"; accessUntil: string | null };

const DAY_MS = 86_400_000;

export function describeSubscription(
  subscription: Pick<
    Subscription,
    "status" | "trial_ends_at" | "current_period_end" | "updated_at"
  > | null,
  now: Date = new Date()
): SubscriptionView {
  if (!subscription) return { kind: "sem_assinatura" };

  switch (subscription.status) {
    case "trial": {
      const endsAt = subscription.trial_ends_at ?? subscription.current_period_end;
      const msLeft = new Date(endsAt).getTime() - now.getTime();
      if (msLeft <= 0) return { kind: "teste_acabou", endedAt: endsAt };
      // Arredonda para cima: com 2h restantes ainda é "falta 1 dia", não 0.
      return { kind: "teste", endsAt, daysLeft: Math.ceil(msLeft / DAY_MS) };
    }
    case "ativa":
      return { kind: "ativa", nextChargeAt: subscription.current_period_end };
    case "inadimplente":
    case "pausada":
      return { kind: "pagamento_pendente", since: subscription.updated_at };
    case "cancelada": {
      const end = subscription.current_period_end;
      return { kind: "cancelada", accessUntil: new Date(end) > now ? end : null };
    }
  }
}

/** Mostrar o aviso no topo do painel? Só quando há algo a fazer ou prazo perto. */
export function bannerFor(view: SubscriptionView): { tone: "info" | "warning"; text: string } | null {
  switch (view.kind) {
    case "teste":
      return {
        tone: "info",
        text:
          view.daysLeft === 1
            ? "Último dia do seu teste grátis."
            : `Faltam ${view.daysLeft} dias do seu teste grátis.`,
      };
    case "teste_acabou":
      return { tone: "warning", text: "Seu teste grátis acabou." };
    case "pagamento_pendente":
      return { tone: "warning", text: "Não conseguimos cobrar a sua assinatura." };
    case "sem_assinatura":
      return { tone: "warning", text: "Você ainda não tem uma assinatura." };
    case "cancelada":
      return view.accessUntil ? null : { tone: "warning", text: "Sua assinatura foi cancelada." };
    case "ativa":
      return null;
  }
}
