import "server-only";
import { addMonths, addYears } from "date-fns";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/service";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { isMissingTableError } from "@/lib/supabase/errors";
import { classifyEvent, type ParsedBillingEvent } from "@/lib/abacatepay";
import type { Invoice, Plan, PlanInterval, Subscription } from "@/lib/types";

/**
 * Assinatura do PRÓPRIO estúdio (tela /app/assinatura) e a gravação dos
 * avisos da AbacatePay (webhook). Ver 0011_billing.sql e 0023_abacatepay.sql.
 *
 * Leitura do dono vai pelo cliente com sessão — as policies da 0011 já
 * deixam o dono ler só o que é dele. Escrita é sempre service_role: a
 * assinatura só muda por aviso do gateway ou por ação do servidor.
 */

const GATEWAY = "abacatepay";
const DAY_MS = 86_400_000;

export interface MySubscription {
  subscription: Subscription | null;
  plan: Plan | null;
  invoices: Invoice[];
}

export async function getMySubscription(studioId: string): Promise<MySubscription | null> {
  if (!isSupabaseConfigured) return null;

  const supabase = await createServerSupabaseClient();
  const [subs, invoices] = await Promise.all([
    supabase
      .from("subscriptions")
      .select("*")
      .eq("studio_id", studioId)
      .order("started_at", { ascending: false })
      .limit(1),
    supabase
      .from("invoices")
      .select("*")
      .eq("studio_id", studioId)
      .order("issued_at", { ascending: false })
      .limit(12),
  ]);

  // Sem a 0011 rodada a tela mostra "sem assinatura" em vez de derrubar o painel.
  if (subs.error) {
    if (isMissingTableError(subs.error)) return null;
    throw subs.error;
  }
  if (invoices.error && !isMissingTableError(invoices.error)) throw invoices.error;

  const subscription = subs.data?.[0] ?? null;
  let plan: Plan | null = null;
  if (subscription) {
    // Plano pelo cliente de serviço: a policy de `plans` só mostra os ATIVOS,
    // e quem assinou um plano que saiu do catálogo precisa continuar vendo o nome.
    const { data } = await createServiceRoleSupabaseClient()
      .from("plans")
      .select("*")
      .eq("id", subscription.plan_id)
      .maybeSingle();
    plan = data ?? null;
  }

  return { subscription, plan, invoices: invoices.data ?? [] };
}

/**
 * Só a assinatura mais recente — para o aviso no topo do painel, que roda em
 * toda navegação e não precisa de faturas nem de plano. Nunca derruba o
 * painel: `undefined` = não deu para ler (ex.: migração não rodada), e aí o
 * aviso não aparece — diferente de `null`, que é "não tem assinatura".
 */
export async function getMyLatestSubscription(studioId: string): Promise<Subscription | null | undefined> {
  if (!isSupabaseConfigured) return undefined;
  try {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase
      .from("subscriptions")
      .select("*")
      .eq("studio_id", studioId)
      .order("started_at", { ascending: false })
      .limit(1);
    if (error) return undefined;
    return data?.[0] ?? null;
  } catch {
    return undefined;
  }
}

export async function getCurrentPlan(): Promise<Plan | null> {
  const { data, error } = await createServiceRoleSupabaseClient()
    .from("plans")
    .select("*")
    .eq("code", "timely")
    .maybeSingle();
  if (error) throw error;
  return data ?? null;
}

/** Assinatura vigente (tudo menos cancelada) — no máximo uma, pelo índice da 0011. */
async function findCurrentSubscription(studioId: string): Promise<Subscription | null> {
  const { data, error } = await createServiceRoleSupabaseClient()
    .from("subscriptions")
    .select("*")
    .eq("studio_id", studioId)
    .neq("status", "cancelada")
    .maybeSingle();
  if (error) throw error;
  return data ?? null;
}

export async function getCurrentSubscriptionForStudio(studioId: string): Promise<Subscription | null> {
  return findCurrentSubscription(studioId);
}

/** Cancelamento pedido pelo próprio dono, depois de a AbacatePay confirmar. */
export async function markSubscriptionCancelled(subscriptionId: string, reason: string): Promise<void> {
  const { error } = await createServiceRoleSupabaseClient()
    .from("subscriptions")
    .update({
      status: "cancelada",
      canceled_at: new Date().toISOString(),
      cancel_reason: reason,
      updated_at: new Date().toISOString(),
    })
    .eq("id", subscriptionId)
    .neq("status", "cancelada");
  if (error) throw error;
}

function periodEnd(start: Date, interval: PlanInterval): Date {
  return interval === "anual" ? addYears(start, 1) : addMonths(start, 1);
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// =========================================================
// Webhook
// =========================================================

export type ApplyResult =
  | { status: "processed"; detail: string }
  | { status: "duplicate" }
  | { status: "ignored"; detail: string };

/**
 * Grava o aviso cru e aplica o efeito dele.
 *
 * Idempotência em duas camadas: o ID do aviso é único em `billing_events`
 * (a AbacatePay reenvia o mesmo ID em até 7 tentativas) e o ID do pagamento
 * é único em `payments`. Um aviso que já chegou mas cujo processamento
 * falhou (sem `processed_at`) é reprocessado na tentativa seguinte, em vez de
 * ser descartado como repetido.
 */
export async function applyAbacatePayEvent(
  parsed: ParsedBillingEvent,
  payload: Record<string, unknown>
): Promise<ApplyResult> {
  const supabase = createServiceRoleSupabaseClient();

  let eventRowId: string;
  const inserted = await supabase
    .from("billing_events")
    .insert({
      gateway: GATEWAY,
      event_type: parsed.event,
      external_event_id: parsed.eventId,
      studio_id: parsed.studioId,
      payload,
    })
    .select("id")
    .single();

  if (inserted.error) {
    if (inserted.error.code !== "23505" || !parsed.eventId) throw inserted.error;
    const existing = await supabase
      .from("billing_events")
      .select("id, processed_at")
      .eq("gateway", GATEWAY)
      .eq("external_event_id", parsed.eventId)
      .single();
    if (existing.error) throw existing.error;
    if (existing.data.processed_at) return { status: "duplicate" };
    eventRowId = existing.data.id;
  } else {
    eventRowId = inserted.data.id;
  }

  try {
    const result = await applyEffect(parsed);
    await supabase
      .from("billing_events")
      .update({
        processed_at: new Date().toISOString(),
        process_error: null,
        studio_id: result.studioId,
        invoice_id: result.invoiceId,
        payment_id: result.paymentId,
      })
      .eq("id", eventRowId);
    return result.ignored
      ? { status: "ignored", detail: result.detail }
      : { status: "processed", detail: result.detail };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await supabase.from("billing_events").update({ process_error: message }).eq("id", eventRowId);
    throw error;
  }
}

interface EffectResult {
  detail: string;
  ignored?: boolean;
  studioId: string | null;
  invoiceId: string | null;
  paymentId: string | null;
}

async function resolveStudioId(parsed: ParsedBillingEvent): Promise<string | null> {
  if (parsed.studioId) return parsed.studioId;
  if (!parsed.gatewaySubscriptionId) return null;
  const { data } = await createServiceRoleSupabaseClient()
    .from("subscriptions")
    .select("studio_id")
    .eq("gateway", GATEWAY)
    .eq("gateway_subscription_id", parsed.gatewaySubscriptionId)
    .order("started_at", { ascending: false })
    .limit(1);
  return data?.[0]?.studio_id ?? null;
}

async function applyEffect(parsed: ParsedBillingEvent): Promise<EffectResult> {
  const kind = classifyEvent(parsed.event);
  const empty = { studioId: parsed.studioId, invoiceId: null, paymentId: null };

  if (kind === "ignored" || kind === "trial_started") {
    return { ...empty, ignored: true, detail: `evento ${parsed.event} não altera a assinatura` };
  }

  const studioId = await resolveStudioId(parsed);
  if (!studioId) {
    // Erro, e não "ignorado": sem estúdio, um pagamento de verdade sumiria em
    // silêncio. Fica com `process_error` em billing_events para conferir.
    throw new Error(`Aviso ${parsed.event} sem estúdio identificável (externalId/metadata/subs_)`);
  }

  if (kind === "cancelled") {
    const current = await findCurrentSubscription(studioId);
    if (!current) return { ...empty, studioId, ignored: true, detail: "nenhuma assinatura vigente" };
    // Um cancelamento de uma assinatura ANTIGA da AbacatePay não pode derrubar a atual.
    if (
      parsed.gatewaySubscriptionId &&
      current.gateway_subscription_id &&
      current.gateway_subscription_id !== parsed.gatewaySubscriptionId
    ) {
      return { ...empty, studioId, ignored: true, detail: "cancelamento de outra assinatura" };
    }
    await markSubscriptionCancelled(current.id, parsed.cancelReason ?? "cancelada na AbacatePay");
    return { ...empty, studioId, detail: "assinatura cancelada" };
  }

  // paid | activated
  const supabase = createServiceRoleSupabaseClient();
  const now = new Date();

  let subscription = await findCurrentSubscription(studioId);
  let plan: Plan | null = null;
  if (subscription) {
    const { data } = await supabase.from("plans").select("*").eq("id", subscription.plan_id).single();
    plan = data;
  }
  // Quem pagou pela AbacatePay está no plano que a AbacatePay vende hoje.
  const currentPlan = await getCurrentPlan();
  if (!plan || plan.code !== "timely") plan = currentPlan ?? plan;
  if (!plan) throw new Error("Plano 'timely' não encontrado — rode a migração 0023");

  const interval = plan.billing_interval;
  const end = periodEnd(now, interval);
  const subscriptionPatch = {
    plan_id: plan.id,
    status: "ativa" as const,
    gateway: GATEWAY as "abacatepay",
    gateway_customer_id: parsed.gatewayCustomerId ?? subscription?.gateway_customer_id ?? null,
    gateway_subscription_id: parsed.gatewaySubscriptionId ?? subscription?.gateway_subscription_id ?? null,
    default_payment_method: parsed.method ?? subscription?.default_payment_method ?? null,
    cancel_at_period_end: false,
    updated_at: now.toISOString(),
  };

  // `checkout.completed` só garante o status; quem move o período e lança a
  // fatura é o evento de assinatura (ver `classifyEvent`).
  const movesPeriod = kind === "paid" || subscription?.status !== "ativa";

  if (subscription) {
    const { data, error } = await supabase
      .from("subscriptions")
      .update({
        ...subscriptionPatch,
        ...(movesPeriod
          ? { current_period_start: now.toISOString(), current_period_end: end.toISOString() }
          : {}),
      })
      .eq("id", subscription.id)
      .select("*")
      .single();
    if (error) throw error;
    subscription = data;
  } else {
    const { data, error } = await supabase
      .from("subscriptions")
      .insert({
        ...subscriptionPatch,
        studio_id: studioId,
        amount_cents: plan.price_cents,
        started_at: now.toISOString(),
        current_period_start: now.toISOString(),
        current_period_end: end.toISOString(),
      })
      .select("*")
      .single();
    if (error) throw error;
    subscription = data;
  }

  if (kind === "activated") {
    return { studioId, invoiceId: null, paymentId: null, detail: "assinatura ativa (checkout pago)" };
  }

  const amount = parsed.amountCents ?? subscription.amount_cents;
  if (amount <= 0) {
    return { studioId, invoiceId: null, paymentId: null, detail: "ciclo sem valor, nada a faturar" };
  }

  if (parsed.gatewayPaymentId) {
    const { data: already } = await supabase
      .from("payments")
      .select("id, invoice_id")
      .eq("gateway", GATEWAY)
      .eq("gateway_payment_id", parsed.gatewayPaymentId)
      .maybeSingle();
    if (already) {
      return {
        studioId,
        invoiceId: already.invoice_id,
        paymentId: already.id,
        detail: "pagamento já lançado",
      };
    }
  }

  const periodStart = new Date(subscription.current_period_start);
  const periodEndDate = new Date(subscription.current_period_end);
  const invoice = await supabase
    .from("invoices")
    .insert({
      studio_id: studioId,
      subscription_id: subscription.id,
      amount_cents: amount,
      status: "paga",
      description: `${plan.name} — ${interval === "anual" ? "anuidade" : "mensalidade"}`,
      period_start: isoDate(periodStart),
      // `period_end` inclusivo: o último dia coberto, não o primeiro do próximo ciclo.
      period_end: isoDate(new Date(periodEndDate.getTime() - DAY_MS)),
      due_date: isoDate(now),
      paid_at: now.toISOString(),
      gateway: GATEWAY,
      gateway_invoice_id: parsed.gatewayPaymentId,
    })
    .select("id")
    .single();
  if (invoice.error) throw invoice.error;

  const payment = await supabase
    .from("payments")
    .insert({
      invoice_id: invoice.data.id,
      studio_id: studioId,
      amount_cents: amount,
      fee_cents: Math.min(parsed.feeCents, amount),
      method: parsed.method ?? subscription.default_payment_method ?? "cartao_credito",
      status: "aprovado",
      paid_at: now.toISOString(),
      gateway: GATEWAY,
      gateway_payment_id: parsed.gatewayPaymentId,
    })
    .select("id")
    .single();
  if (payment.error) throw payment.error;

  return {
    studioId,
    invoiceId: invoice.data.id,
    paymentId: payment.data.id,
    detail: parsed.event === "subscription.renewed" ? "renovação lançada" : "primeiro pagamento lançado",
  };
}
