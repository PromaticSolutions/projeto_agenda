import { NextResponse, type NextRequest } from "next/server";
import {
  abacatePayWebhookSecret,
  parseBillingEvent,
  signatureMatchesPublicKey,
  verifyWebhook,
} from "@/lib/abacatepay";
import { applyAbacatePayEvent } from "@/lib/data/subscription";
import { isSupabaseServiceConfigured } from "@/lib/supabase/env";

/**
 * Receptor dos avisos da AbacatePay (webhook v2) — ver src/lib/abacatepay.ts.
 *
 * Respostas, pensando no que a AbacatePay faz com cada uma:
 *   - 2xx: entregue, para de tentar;
 *   - 5xx: tenta de novo (até 7 vezes em ~18h) — é o que devolvemos quando o
 *     banco falha, para o pagamento não se perder;
 *   - 404: segredo errado. Não repete, e a rota não anuncia que existe.
 *   - NUNCA 410: a AbacatePay desliga o webhook de vez ao receber 410.
 */

const MAX_BODY_BYTES = 256 * 1024;

export async function POST(request: NextRequest) {
  // Sem segredo configurado a rota fica fechada, como a da Evolution.
  if (!abacatePayWebhookSecret || !isSupabaseServiceConfigured) {
    return NextResponse.json({ error: "Não encontrado" }, { status: 404 });
  }

  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "Corpo muito grande" }, { status: 413 });
  }

  // O HMAC é do corpo CRU: parsear e re-serializar mudaria os bytes.
  const rawBody = await request.text();
  if (rawBody.length > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "Corpo muito grande" }, { status: 413 });
  }

  const signature = request.headers.get("x-webhook-signature");
  const auth = verifyWebhook({
    secret: abacatePayWebhookSecret,
    querySecret: request.nextUrl.searchParams.get("webhookSecret"),
    signature,
    rawBody,
  });

  if (!auth) {
    // Diagnóstico sem segredo nenhum: diz só QUAL prova veio. Se a AbacatePay
    // estiver assinando com a chave pública e sem `?webhookSecret`, é aqui que
    // aparece — e o conserto é pôr o segredo de volta na URL do webhook.
    console.warn("[abacatepay] aviso recusado", {
      hasQuerySecret: request.nextUrl.searchParams.has("webhookSecret"),
      hasSignature: Boolean(signature),
      signedWithPublicKey: signatureMatchesPublicKey(signature, rawBody),
    });
    return NextResponse.json({ error: "Não encontrado" }, { status: 404 });
  }

  let body: Record<string, unknown>;
  try {
    body = JSON.parse(rawBody) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const parsed = parseBillingEvent(body);
  if (!parsed) {
    return NextResponse.json({ error: "Aviso sem `event`" }, { status: 400 });
  }

  try {
    const result = await applyAbacatePayEvent(parsed, body);
    console.info("[abacatepay]", parsed.event, parsed.eventId, result, { auth, devMode: parsed.devMode });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[abacatepay] falha ao processar", parsed.event, parsed.eventId, message);
    // 500 faz a AbacatePay tentar de novo; o aviso cru já ficou em billing_events.
    return NextResponse.json({ error: "Falha ao processar" }, { status: 500 });
  }
}
