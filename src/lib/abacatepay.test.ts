import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { classifyEvent, parseBillingEvent, verifyWebhook } from "@/lib/abacatepay";

const SECRET = "424a21129ce599b016c7daaa583aabfe";
const STUDIO = "7d1c1f4e-2b7a-4d4e-9a61-0c5d3c2b1a90";

function sign(key: string, body: string) {
  return createHmac("sha256", key).update(Buffer.from(body, "utf8")).digest("base64");
}

describe("verifyWebhook", () => {
  const rawBody = JSON.stringify({ id: "log_1", event: "subscription.completed" });

  it("aceita o segredo na URL", () => {
    expect(verifyWebhook({ secret: SECRET, querySecret: SECRET, signature: null, rawBody })).toBe("query-secret");
  });

  it("aceita a assinatura HMAC feita com o nosso segredo", () => {
    expect(
      verifyWebhook({ secret: SECRET, querySecret: null, signature: sign(SECRET, rawBody), rawBody })
    ).toBe("signature-secret");
  });

  it("recusa segredo errado, corpo alterado e rota sem segredo configurado", () => {
    expect(verifyWebhook({ secret: SECRET, querySecret: "x".repeat(32), signature: null, rawBody })).toBeNull();
    expect(
      verifyWebhook({ secret: SECRET, querySecret: null, signature: sign(SECRET, rawBody), rawBody: rawBody + " " })
    ).toBeNull();
    expect(verifyWebhook({ secret: undefined, querySecret: SECRET, signature: null, rawBody })).toBeNull();
  });

  it("não aceita assinatura feita com uma chave qualquer (ex.: a pública)", () => {
    expect(
      verifyWebhook({ secret: SECRET, querySecret: null, signature: sign("chave-publica", rawBody), rawBody })
    ).toBeNull();
  });
});

describe("classifyEvent", () => {
  it("só os eventos de assinatura lançam fatura", () => {
    expect(classifyEvent("subscription.completed")).toBe("paid");
    expect(classifyEvent("subscription.renewed")).toBe("paid");
    expect(classifyEvent("checkout.completed")).toBe("activated");
    expect(classifyEvent("subscription.cancelled")).toBe("cancelled");
    expect(classifyEvent("payout.completed")).toBe("ignored");
  });
});

describe("parseBillingEvent", () => {
  it("lê o formato de checkout documentado", () => {
    const parsed = parseBillingEvent({
      id: "log_abc",
      event: "checkout.completed",
      apiVersion: 2,
      devMode: true,
      data: {
        checkout: { id: "bill_1", externalId: STUDIO, amount: 3990, paidAmount: 3990, method: "PIX" },
        customer: { id: "cust_1", name: "Ana" },
      },
    });
    expect(parsed).toMatchObject({
      eventId: "log_abc",
      devMode: true,
      studioId: STUDIO,
      gatewayCustomerId: "cust_1",
      gatewayPaymentId: "bill_1",
      amountCents: 3990,
      method: "pix",
    });
  });

  it("acha o estúdio e a assinatura num evento de assinatura", () => {
    const parsed = parseBillingEvent({
      id: "log_2",
      event: "subscription.completed",
      data: {
        subscription: { id: "subs_9", amount: 3990, method: "CARD", metadata: { studioId: STUDIO } },
        customer: { id: "cust_1" },
      },
    });
    expect(parsed?.studioId).toBe(STUDIO);
    expect(parsed?.gatewaySubscriptionId).toBe("subs_9");
    expect(parsed?.method).toBe("cartao_credito");
  });

  it("numa renovação o pagamento é identificado pelo ID do evento, que muda a cada ciclo", () => {
    const parsed = parseBillingEvent({
      id: "log_renov_2",
      event: "subscription.renewed",
      data: { subscription: { id: "subs_9" }, checkout: { id: "bill_1", externalId: STUDIO } },
    });
    expect(parsed?.gatewayPaymentId).toBe("log_renov_2");
  });

  it("ignora externalId que não é UUID e aviso sem event", () => {
    expect(parseBillingEvent({ event: "checkout.completed", data: { checkout: { externalId: "pedido-1" } } })?.studioId).toBeNull();
    expect(parseBillingEvent({ data: {} })).toBeNull();
  });
});
