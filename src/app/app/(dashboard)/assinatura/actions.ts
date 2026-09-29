"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getMyStudio } from "@/lib/data/studios";
import {
  getCurrentSubscriptionForStudio,
  markSubscriptionCancelled,
} from "@/lib/data/subscription";
import {
  cancelSubscription,
  createSubscriptionCheckout,
  isAbacatePayConfigured,
} from "@/lib/abacatepay";

export type BillingActionState = { ok: false; error: string } | { ok: true; message: string } | null;

/**
 * Origem pública do app, para os links de volta da AbacatePay.
 *
 * Pelos headers do próprio request, e não por NEXT_PUBLIC_SITE_URL: a
 * variável fica em localhost no .env.local, e um checkout aberto a partir de
 * um deploy de preview da Vercel precisa voltar para o MESMO deploy.
 */
async function appOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (!host) return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

/** Botão "Assinar": cria o checkout e manda o dono para a página de pagamento. */
export async function startCheckoutAction(): Promise<BillingActionState> {
  const studio = await getMyStudio();
  if (!studio) redirect("/app/onboarding");

  if (!isAbacatePayConfigured) {
    return { ok: false, error: "O pagamento ainda não está disponível. Tente de novo mais tarde." };
  }

  const current = await getCurrentSubscriptionForStudio(studio.id);
  if (current?.status === "ativa") {
    return { ok: false, error: "Sua assinatura já está ativa." };
  }

  const origin = await appOrigin();
  let url: string;
  try {
    const checkout = await createSubscriptionCheckout({
      studioId: studio.id,
      completionUrl: `${origin}/app/assinatura?pagamento=concluido`,
      returnUrl: `${origin}/app/assinatura`,
    });
    url = checkout.url;
  } catch (error) {
    console.error("[assinatura] checkout falhou", error instanceof Error ? error.message : error);
    return { ok: false, error: "Não conseguimos abrir a página de pagamento. Tente de novo em instantes." };
  }

  // Fora do try: `redirect` funciona lançando uma exceção.
  redirect(url);
}

/** Botão "Cancelar assinatura". */
export async function cancelSubscriptionAction(): Promise<BillingActionState> {
  const studio = await getMyStudio();
  if (!studio) redirect("/app/onboarding");

  const current = await getCurrentSubscriptionForStudio(studio.id);
  if (!current || current.status === "trial") {
    return { ok: false, error: "Não há assinatura paga para cancelar." };
  }

  try {
    // Primeiro na AbacatePay: marcar como cancelada aqui e a cobrança
    // continuar lá seria o pior erro possível desta tela.
    if (current.gateway === "abacatepay") {
      if (!current.gateway_subscription_id) {
        console.error("[assinatura] assinatura AbacatePay sem subs_ id", current.id);
        return { ok: false, error: "Não conseguimos cancelar agora. Fale com o suporte para cancelar." };
      }
      await cancelSubscription(current.gateway_subscription_id);
    }
    await markSubscriptionCancelled(current.id, "cancelada pelo estúdio");
  } catch (error) {
    console.error("[assinatura] cancelamento falhou", error instanceof Error ? error.message : error);
    return { ok: false, error: "Não conseguimos cancelar agora. Tente de novo ou fale com o suporte." };
  }

  revalidatePath("/app", "layout");
  return { ok: true, message: "Assinatura cancelada. Nenhuma nova cobrança será feita." };
}
