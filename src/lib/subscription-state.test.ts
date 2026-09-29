import { describe, expect, it } from "vitest";
import { bannerFor, describeSubscription } from "@/lib/subscription-state";

const NOW = new Date("2026-09-28T12:00:00Z");

function sub(partial: Partial<Parameters<typeof describeSubscription>[0] & object>) {
  return {
    status: "trial" as const,
    trial_ends_at: null,
    current_period_end: "2026-10-28T12:00:00Z",
    updated_at: "2026-09-28T12:00:00Z",
    ...partial,
  };
}

describe("describeSubscription", () => {
  it("conta os dias restantes do teste arredondando para cima", () => {
    const view = describeSubscription(sub({ trial_ends_at: "2026-09-29T02:00:00Z" }), NOW);
    expect(view).toEqual({ kind: "teste", endsAt: "2026-09-29T02:00:00Z", daysLeft: 1 });
    expect(bannerFor(view)?.text).toBe("Último dia do seu teste grátis.");
  });

  it("teste vencido vira teste_acabou", () => {
    expect(describeSubscription(sub({ trial_ends_at: "2026-09-18T19:58:41Z" }), NOW).kind).toBe("teste_acabou");
  });

  it("ativa não mostra aviso", () => {
    const view = describeSubscription(sub({ status: "ativa" }), NOW);
    expect(view).toEqual({ kind: "ativa", nextChargeAt: "2026-10-28T12:00:00Z" });
    expect(bannerFor(view)).toBeNull();
  });

  it("cancelada com período pago pela frente ainda não mostra aviso", () => {
    const view = describeSubscription(sub({ status: "cancelada" }), NOW);
    expect(view).toEqual({ kind: "cancelada", accessUntil: "2026-10-28T12:00:00Z" });
    expect(bannerFor(view)).toBeNull();
  });

  it("sem assinatura e inadimplente pedem ação", () => {
    expect(bannerFor(describeSubscription(null, NOW))?.tone).toBe("warning");
    expect(describeSubscription(sub({ status: "inadimplente" }), NOW).kind).toBe("pagamento_pendente");
  });
});
