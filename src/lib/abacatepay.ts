import { createHmac, timingSafeEqual } from "node:crypto";
import type { PaymentMethod } from "@/lib/types";

/**
 * AbacatePay — o gateway que cobra a assinatura do estúdio (0023).
 *
 * Fluxo: o dono clica em "Assinar" em /app/assinatura → o servidor cria um
 * checkout de assinatura (`POST /subscriptions/create`) → o dono paga na
 * página da AbacatePay → a AbacatePay avisa em /api/webhooks/abacatepay →
 * a assinatura vira `ativa`. A cobrança dos meses seguintes é da AbacatePay;
 * cada renovação chega como outro aviso.
 *
 * O `externalId` do checkout é o ID do ESTÚDIO, e não o da nossa assinatura:
 * um estúdio que cancelou e voltou não tem assinatura vigente para apontar,
 * e o webhook precisa saber de quem é o pagamento mesmo assim.
 *
 * Variáveis (cada ambiente da AbacatePay — Dev Mode e produção — tem as suas):
 *   ABACATEPAY_API_KEY         chave da API
 *   ABACATEPAY_PRODUCT_ID      produto com ciclo mensal criado no painel
 *   ABACATEPAY_WEBHOOK_SECRET  segredo do webhook (mínimo 32 caracteres)
 */

const API_BASE = "https://api.abacatepay.com/v2";

export const abacatePayApiKey = process.env.ABACATEPAY_API_KEY;
export const abacatePayProductId = process.env.ABACATEPAY_PRODUCT_ID;
export const abacatePayWebhookSecret = process.env.ABACATEPAY_WEBHOOK_SECRET;

export const isAbacatePayConfigured = Boolean(abacatePayApiKey && abacatePayProductId);

/**
 * Chave pública fixa que a AbacatePay publica na documentação de webhooks e
 * usa para o HMAC do header `X-Webhook-Signature`. Por ser pública, ela só
 * prova que o corpo não foi alterado no caminho — NÃO prova quem mandou.
 * Quem autentica é o nosso segredo (ver `verifyWebhook`).
 */
const ABACATEPAY_PUBLIC_HMAC_KEY =
  "t9dXRhHHo3yDEj5pVDYz0frf7q6bMKyMRmxxCPIPp3RCplBfXRxqlC6ZpiWmOqj4L63qEaeUOtrCI8P0VMUgo6iIga2ri9ogaHFs0WIIywSMg0q7RmBfybe1E5XJcfC4IW3alNqym0tXoAKkzvfEjZxV6bE0oG2zJrNNYmUCKZyV0KZ3JS8Votf9EAWWYdiDkMkpbMdPggfh1EqHlVkMiTady6jOR3hyzGEHrIz2Ret0xHKMbiqkr9HS1JhNHDX9";

export class AbacatePayError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
    this.name = "AbacatePayError";
  }
}

async function call<T>(path: string, init: { method: "GET" | "POST"; body?: unknown }): Promise<T> {
  if (!abacatePayApiKey) throw new AbacatePayError("ABACATEPAY_API_KEY não configurada", 0);

  const response = await fetch(`${API_BASE}${path}`, {
    method: init.method,
    headers: {
      Authorization: `Bearer ${abacatePayApiKey}`,
      "Content-Type": "application/json",
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });

  const json = (await response.json().catch(() => null)) as
    | { data?: T; success?: boolean; error?: unknown }
    | null;

  if (!response.ok || !json || json.error || json.data === undefined) {
    const detail = typeof json?.error === "string" ? json.error : `HTTP ${response.status}`;
    throw new AbacatePayError(`AbacatePay ${path}: ${detail}`, response.status);
  }
  return json.data;
}

export interface SubscriptionCheckout {
  id: string;
  url: string;
  status: string;
}

export async function createSubscriptionCheckout(input: {
  studioId: string;
  completionUrl: string;
  returnUrl: string;
}): Promise<SubscriptionCheckout> {
  if (!abacatePayProductId) throw new AbacatePayError("ABACATEPAY_PRODUCT_ID não configurado", 0);

  return call<SubscriptionCheckout>("/subscriptions/create", {
    method: "POST",
    body: {
      items: [{ id: abacatePayProductId, quantity: 1 }],
      externalId: input.studioId,
      completionUrl: input.completionUrl,
      returnUrl: input.returnUrl,
      // Cartão renova sozinho; Pix fica disponível para quem não quer cartão.
      methods: ["CARD", "PIX"],
      metadata: { studioId: input.studioId },
    },
  });
}

/** Cancelamento imediato: a AbacatePay para de cobrar a partir de agora. */
export async function cancelSubscription(gatewaySubscriptionId: string): Promise<void> {
  await call<unknown>("/subscriptions/cancel", {
    method: "POST",
    body: { id: gatewaySubscriptionId },
  });
}

// =========================================================
// Webhook
// =========================================================

function safeEqual(a: string, b: string): boolean {
  const A = Buffer.from(a);
  const B = Buffer.from(b);
  return A.length === B.length && timingSafeEqual(A, B);
}

function hmacBase64(key: string, body: string): string {
  return createHmac("sha256", key).update(Buffer.from(body, "utf8")).digest("base64");
}

export type WebhookAuth = "query-secret" | "signature-secret" | null;

/**
 * O aviso veio mesmo da AbacatePay?
 *
 * Aceita dois jeitos, porque a documentação descreve os dois e o painel não
 * deixa claro qual está em uso:
 *   - `?webhookSecret=` na URL igual ao nosso segredo;
 *   - `X-Webhook-Signature` = HMAC-SHA256 (base64) do corpo com o nosso
 *     segredo (o campo "Secret" do cadastro do webhook).
 * Uma assinatura que só confere com a chave PÚBLICA não autentica ninguém —
 * qualquer um pode calculá-la — e por isso não entra aqui.
 */
export function verifyWebhook(input: {
  secret: string | undefined;
  querySecret: string | null;
  signature: string | null;
  rawBody: string;
}): WebhookAuth {
  const { secret, querySecret, signature, rawBody } = input;
  if (!secret) return null;
  if (querySecret && safeEqual(querySecret, secret)) return "query-secret";
  if (signature && safeEqual(signature, hmacBase64(secret, rawBody))) return "signature-secret";
  return null;
}

/** Só para diagnóstico no log: a assinatura bate com a chave pública? */
export function signatureMatchesPublicKey(signature: string | null, rawBody: string): boolean {
  return Boolean(signature && safeEqual(signature, hmacBase64(ABACATEPAY_PUBLIC_HMAC_KEY, rawBody)));
}

export type BillingEventKind = "paid" | "activated" | "cancelled" | "trial_started" | "ignored";

/**
 * `checkout.completed` e `subscription.completed` podem chegar os DOIS para
 * o mesmo primeiro pagamento, com IDs de evento diferentes. Se os dois
 * lançassem fatura, o primeiro mês apareceria em dobro no faturamento. Então
 * só os eventos de assinatura lançam fatura (`paid`); o de checkout apenas
 * garante que a assinatura fique ativa (`activated`), caso chegue antes.
 */
export function classifyEvent(event: string): BillingEventKind {
  switch (event) {
    case "subscription.completed":
    case "subscription.renewed":
      return "paid";
    case "checkout.completed":
      return "activated";
    case "subscription.cancelled":
      return "cancelled";
    case "subscription.trial_started":
      return "trial_started";
    default:
      return "ignored";
  }
}

export interface ParsedBillingEvent {
  eventId: string | null;
  event: string;
  devMode: boolean;
  /** Nosso ID de estúdio, vindo do `externalId`/`metadata` do checkout. */
  studioId: string | null;
  /** `subs_…` — o que se usa depois para cancelar. */
  gatewaySubscriptionId: string | null;
  gatewayCustomerId: string | null;
  /** ID do pagamento deste ciclo (idempotência em `payments`). */
  gatewayPaymentId: string | null;
  amountCents: number | null;
  feeCents: number;
  method: PaymentMethod | null;
  cancelReason: string | null;
}

type Obj = Record<string, unknown>;

function obj(value: unknown): Obj | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Obj) : null;
}

function str(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function int(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? Math.round(value) : null;
}

function first<T>(...values: (T | null | undefined)[]): T | null {
  for (const v of values) if (v !== null && v !== undefined) return v;
  return null;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function mapMethod(value: unknown): PaymentMethod | null {
  const m = str(value)?.toUpperCase();
  if (!m) return null;
  if (m === "PIX") return "pix";
  if (m === "CARD" || m === "CREDIT_CARD") return "cartao_credito";
  if (m === "BOLETO") return "boleto";
  return null;
}

/**
 * Lê um aviso v2 da AbacatePay: `{ id, event, apiVersion, devMode, data }`.
 *
 * A documentação só mostra o `data` completo dos eventos de checkout
 * (`data.checkout`, `data.customer`); o dos eventos de assinatura não está
 * publicado. Por isso a leitura procura cada campo nos lugares plausíveis
 * (`data.subscription`, `data.checkout`, `data.payment`, `data`) em vez de
 * assumir um formato. O payload cru fica em `billing_events` de qualquer
 * jeito — se algo não for encontrado, o conserto começa por ele.
 */
export function parseBillingEvent(body: unknown): ParsedBillingEvent | null {
  const root = obj(body);
  const event = str(root?.event);
  if (!root || !event) return null;

  const data = obj(root.data) ?? {};
  const subscription = obj(data.subscription);
  const checkout = obj(data.checkout) ?? obj(data.billing) ?? obj(data.transparent);
  const payment = obj(data.payment);
  const customer = obj(data.customer);
  const sources = [subscription, checkout, payment, data].filter((o): o is Obj => o !== null);

  const pick = (key: string) => first(...sources.map((o) => str(o[key])));
  const metadataStudio = first(
    ...sources.map((o) => str(obj(o.metadata)?.studioId))
  );
  const externalId = pick("externalId");
  const studioId = first(
    metadataStudio && UUID_RE.test(metadataStudio) ? metadataStudio : null,
    externalId && UUID_RE.test(externalId) ? externalId : null
  );

  const subscriptionId = first(
    str(subscription?.id),
    str(data.subscriptionId),
    str(checkout?.subscriptionId),
    // Sem objeto `subscription` separado, o próprio `data` pode ser a assinatura.
    event.startsWith("subscription.") && str(data.id)?.startsWith("subs_") ? str(data.id) : null
  );

  const paymentId = first(
    str(payment?.id),
    // Numa renovação o checkout é o mesmo do primeiro mês; o ID do evento é
    // o único que certamente muda a cada ciclo.
    event === "subscription.renewed" ? str(root.id) : null,
    str(checkout?.id),
    str(root.id)
  );

  return {
    eventId: str(root.id),
    event,
    devMode: root.devMode === true,
    studioId,
    gatewaySubscriptionId: subscriptionId,
    gatewayCustomerId: first(str(customer?.id), pick("customerId")),
    gatewayPaymentId: paymentId,
    amountCents: first(...sources.map((o) => int(o.paidAmount)), ...sources.map((o) => int(o.amount))),
    feeCents: first(...sources.map((o) => int(o.platformFee)), ...sources.map((o) => int(o.fee))) ?? 0,
    method: first(...sources.map((o) => mapMethod(o.method)), ...sources.map((o) => mapMethod(o.paymentMethod))),
    cancelReason: first(pick("cancelledDueTo"), pick("cancelReason")),
  };
}
