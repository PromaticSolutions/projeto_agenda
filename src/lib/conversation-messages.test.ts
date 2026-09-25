import { describe, expect, it } from "vitest";
import {
  buildBookingConfirmation,
  buildQuoteMessage,
  buildSlotsMessage,
  quoteTotals,
} from "@/lib/conversation-messages";

describe("quoteTotals", () => {
  it("soma preço vezes quantidade", () => {
    expect(
      quoteTotals(
        [
          { name: "Design", priceCents: 5000, quantity: 1 },
          { name: "Henna", priceCents: 2500, quantity: 2 },
        ],
        0
      )
    ).toEqual({ subtotalCents: 10000, discountCents: 0, totalCents: 10000 });
  });

  it("desconto maior que a conta não deixa o total negativo", () => {
    expect(quoteTotals([{ name: "Design", priceCents: 5000, quantity: 1 }], 9000)).toEqual({
      subtotalCents: 5000,
      discountCents: 5000,
      totalCents: 0,
    });
  });

  it("ignora desconto e quantidade negativos", () => {
    expect(quoteTotals([{ name: "Design", priceCents: 5000, quantity: -2 }], -100)).toEqual({
      subtotalCents: 0,
      discountCents: 0,
      totalCents: 0,
    });
  });
});

describe("buildQuoteMessage", () => {
  it("lista os itens, o desconto e o total", () => {
    const text = buildQuoteMessage({
      studioName: "Bella Studio",
      clientName: "Ana Paula Souza",
      lines: [
        { name: "Design de sobrancelha", priceCents: 5000, quantity: 1 },
        { name: "Henna", priceCents: 2500, quantity: 2 },
        { name: "Fora", priceCents: 9900, quantity: 0 },
      ],
      discountCents: 1000,
      note: "Pagamento no Pix ou cartão.",
    });

    expect(text).toContain("Olá, Ana! Segue o seu orçamento:");
    expect(text).toContain("*Orçamento — Bella Studio*");
    expect(text).toContain("• Design de sobrancelha — R$ 50,00");
    expect(text).toContain("• 2x Henna — R$ 50,00");
    expect(text).not.toContain("Fora");
    expect(text).toContain("Subtotal: R$ 100,00");
    expect(text).toContain("Desconto: − R$ 10,00");
    expect(text).toContain("*Total: R$ 90,00*");
    expect(text).toContain("Pagamento no Pix ou cartão.");
    expect(text).not.toContain(" ");
  });

  it("sem desconto não mostra subtotal", () => {
    const text = buildQuoteMessage({
      studioName: "Bella",
      clientName: "",
      lines: [{ name: "Design", priceCents: 5000, quantity: 1 }],
      discountCents: 0,
      note: "",
    });
    expect(text.startsWith("Olá! Segue")).toBe(true);
    expect(text).not.toContain("Subtotal");
    expect(text).toContain("*Total: R$ 50,00*");
  });
});

describe("buildSlotsMessage", () => {
  it("um dia por linha, só os dias com horário", () => {
    const text = buildSlotsMessage("Design", [
      { label: "qua., 24/09", times: ["09:00", "10:00"] },
      { label: "qui., 25/09", times: [] },
    ]);
    expect(text).toContain("*Design*");
    expect(text).toContain("• Qua., 24/09: 09:00, 10:00");
    expect(text).not.toContain("25/09");
  });
});

describe("buildBookingConfirmation", () => {
  it("usa o primeiro nome e o dia com hora", () => {
    const text = buildBookingConfirmation({
      clientName: "Camila Rocha",
      serviceName: "Volume brasileiro",
      dayLabel: "sex., 26/09",
      time: "14:00",
      studioName: "Bella Studio",
    });
    expect(text).toContain("Prontinho, Camila!");
    expect(text).toContain("Sex., 26/09 às 14:00");
    expect(text).toContain("— Bella Studio");
  });
});
