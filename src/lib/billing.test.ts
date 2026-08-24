import { describe, expect, it } from "vitest";
import {
  agingBucket,
  bucketByMonth,
  churnRate,
  daysOverdue,
  effectiveInvoiceStatus,
  formatMonthShort,
  lastMonths,
  monthKeyOf,
  monthlyAmountCents,
  netPaymentCents,
  sumMonthlyRecurringCents,
} from "@/lib/billing";

/**
 * A aritmética de dinheiro do /superadmin. Testada porque é o único código do
 * projeto em que um erro silencioso produz um NÚMERO PLAUSÍVEL: um MRR 12x
 * maior por esquecer de normalizar o plano anual não quebra tela nenhuma —
 * só faz a plataforma tomar decisão comercial errada.
 */

describe("normalização do valor recorrente", () => {
  it("mantém o mensal e divide o anual por 12", () => {
    expect(monthlyAmountCents(8900, "mensal")).toBe(8900);
    expect(monthlyAmountCents(89000, "anual")).toBe(7417); // 89000/12 arredondado
  });

  it("soma MRR só das assinaturas que representam contrato pago", () => {
    const subs = [
      { status: "ativa" as const, amount_cents: 8900, interval: "mensal" as const },
      { status: "ativa" as const, amount_cents: 89000, interval: "anual" as const },
      { status: "inadimplente" as const, amount_cents: 4900, interval: "mensal" as const },
      // Nenhum dos dois abaixo entra: teste não é receita, cancelada não existe mais.
      { status: "trial" as const, amount_cents: 8900, interval: "mensal" as const },
      { status: "cancelada" as const, amount_cents: 8900, interval: "mensal" as const },
    ];
    expect(sumMonthlyRecurringCents(subs)).toBe(8900 + 7417 + 4900);
    // Só o que está em dia, para separar o pedaço em risco.
    expect(sumMonthlyRecurringCents(subs, ["ativa"])).toBe(8900 + 7417);
  });

  it("churn com base zero não explode nem devolve NaN", () => {
    expect(churnRate(1000, 0)).toBe(0);
    expect(churnRate(1000, 10000)).toBeCloseTo(0.1);
  });
});

describe("fatura vencida", () => {
  it("lê como vencida a fatura aberta cujo vencimento passou", () => {
    const invoice = { status: "aberta" as const, due_date: "2026-08-10" };
    expect(effectiveInvoiceStatus(invoice, "2026-08-23")).toBe("vencida");
    expect(effectiveInvoiceStatus(invoice, "2026-08-01")).toBe("aberta");
  });

  it("não reclassifica fatura paga ou cancelada, mesmo com vencimento antigo", () => {
    expect(effectiveInvoiceStatus({ status: "paga", due_date: "2020-01-01" }, "2026-08-23")).toBe("paga");
    expect(effectiveInvoiceStatus({ status: "cancelada", due_date: "2020-01-01" }, "2026-08-23")).toBe(
      "cancelada"
    );
  });

  it("conta dias de atraso e classifica a faixa", () => {
    expect(daysOverdue("2026-08-20", "2026-08-23")).toBe(3);
    expect(daysOverdue("2026-08-30", "2026-08-23")).toBe(0);
    expect(agingBucket("2026-08-20", "2026-08-23")).toBe("1-7");
    expect(agingBucket("2026-08-01", "2026-08-23")).toBe("8-30");
    expect(agingBucket("2026-07-01", "2026-08-23")).toBe("31-60"); // 53 dias
    expect(agingBucket("2026-01-01", "2026-08-23")).toBe("60+");
    expect(agingBucket("2026-09-01", "2026-08-23")).toBeNull();
  });
});

describe("receita líquida", () => {
  it("desconta taxa do gateway e estorno", () => {
    expect(netPaymentCents({ amount_cents: 8900, fee_cents: 445, refunded_cents: 0 })).toBe(8455);
    expect(netPaymentCents({ amount_cents: 8900, fee_cents: 445, refunded_cents: 8900 })).toBe(-445);
  });
});

describe("séries mensais", () => {
  it("devolve a janela inteira, incluindo mês sem receita", () => {
    const months = ["2026-06", "2026-07", "2026-08"];
    const points = bucketByMonth(
      [
        { at: "2026-06-15T12:00:00Z", cents: 8900 },
        { at: "2026-08-02T12:00:00Z", cents: 4900 },
        { at: "2026-08-20T12:00:00Z", cents: 8900 },
      ],
      months
    );
    expect(points).toEqual([
      { month: "2026-06", cents: 8900, count: 1 },
      { month: "2026-07", cents: 0, count: 0 },
      { month: "2026-08", cents: 13800, count: 2 },
    ]);
  });

  it("ignora o que cai fora da janela em vez de somar no primeiro mês", () => {
    const points = bucketByMonth([{ at: "2025-01-01T12:00:00Z", cents: 99900 }], ["2026-08"]);
    expect(points).toEqual([{ month: "2026-08", cents: 0, count: 0 }]);
  });

  it("agrupa pelo mês do fuso do negócio, não pelo UTC", () => {
    // 01/09 00:30 UTC ainda é 31/08 21:30 em São Paulo: a receita pertence a agosto.
    expect(monthKeyOf("2026-09-01T00:30:00Z")).toBe("2026-08");
  });

  it("monta a janela de meses para trás atravessando o ano", () => {
    expect(lastMonths(3, new Date("2026-02-10T12:00:00Z"))).toEqual([
      "2025-12",
      "2026-01",
      "2026-02",
    ]);
  });

  it("rotula o mês curto sem ponto de abreviação", () => {
    expect(formatMonthShort("2026-08")).toBe("ago/26");
  });
});
