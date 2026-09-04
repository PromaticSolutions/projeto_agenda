import "server-only";
import { isBillingSchemaReady, mapCurrentSubscriptions, mapStudioRevenue } from "@/lib/data/billing";
import { listStudiosWithActivity } from "@/lib/data/platformMetrics";
import type { PlanInterval, SubscriptionStatus, WhatsAppConnectionStatus } from "@/lib/types";

/**
 * A linha de cliente como as telas do /superadmin precisam dela: uso
 * (`platformMetrics`) e dinheiro (`billing`) já casados.
 *
 * Mora num módulo próprio porque DUAS telas precisam do mesmo casamento (a
 * visão geral, para o topo da lista e os alertas, e a lista de clientes) — e
 * porque é aqui que fica isolada a única dependência entre os dois módulos de
 * dados. `platformMetrics` continua sem saber que cobrança existe, então a
 * tela de uso não cai se a migração 0011 ainda não tiver rodado.
 */
export interface StudioListRow {
  id: string;
  name: string;
  slug: string;
  ownerName: string | null;
  whatsapp: string;
  createdAt: string;
  bookingsLast7d: number;
  bookingsLast30d: number;
  totalBookings: number;
  cancellationRate30d: number;
  attendedVolume30dCents: number;
  clientsCount: number;
  activeServicesCount: number;
  lastBookingAt: string | null;
  whatsappStatus: WhatsAppConnectionStatus | null;
  remindersEnabled: boolean;
  isAtRisk: boolean;
  isNew: boolean;
  /** Nulo = nenhuma assinatura vigente (ou a 0011 ainda não rodou). */
  subscriptionStatus: SubscriptionStatus | null;
  planName: string | null;
  planInterval: PlanInterval;
  monthlyCents: number;
  lifetimeCents: number;
  overdueCents: number;
}

export interface StudioRowsResult {
  rows: StudioListRow[];
  /** Falso quando a migração de cobrança ainda não foi aplicada. */
  billingReady: boolean;
}

export async function listStudioRows(): Promise<StudioRowsResult> {
  const [activity, billingReady] = await Promise.all([
    listStudiosWithActivity(),
    isBillingSchemaReady(),
  ]);

  const [subscriptions, revenue] = billingReady
    ? await Promise.all([mapCurrentSubscriptions(), mapStudioRevenue()])
    : [new Map(), new Map()];

  const rows = activity.map((studio) => {
    const subscription = subscriptions.get(studio.id);
    const money = revenue.get(studio.id);
    return {
      ...studio,
      subscriptionStatus: subscription?.subscription.status ?? null,
      planName: subscription?.plan?.name ?? null,
      planInterval: subscription?.interval ?? ("mensal" as PlanInterval),
      // Trial não entra no MRR (ver MRR_STATUSES em billing.ts): mostrar o
      // valor do plano na coluna de MRR faria a soma da lista não fechar com
      // o KPI do topo.
      monthlyCents:
        subscription && subscription.subscription.status !== "trial" ? subscription.monthlyCents : 0,
      lifetimeCents: money?.lifetimeCents ?? 0,
      overdueCents: money?.overdueCents ?? 0,
    };
  });

  return { rows, billingReady };
}
