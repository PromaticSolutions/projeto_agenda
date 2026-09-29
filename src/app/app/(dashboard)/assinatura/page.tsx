import Link from "next/link";
import { Check } from "lucide-react";
import { getMyStudio } from "@/lib/data/studios";
import { getCurrentPlan, getMySubscription } from "@/lib/data/subscription";
import { describeSubscription, type SubscriptionView } from "@/lib/subscription-state";
import { INVOICE_STATUS_LABELS, PAYMENT_METHOD_LABELS } from "@/lib/billing";
import { formatFullDateLocal, formatPriceCents } from "@/lib/format";
import { isSupabaseServiceConfigured } from "@/lib/supabase/env";
import { CancelSubscriptionButton, SubscribeButton } from "@/components/app/subscription-actions";
import type { Invoice, PaymentMethod } from "@/lib/types";

export const metadata = { title: "Assinatura — Timely" };

const INCLUDED = [
  "Agenda, link público e clientes",
  "Lembretes e conversas no WhatsApp",
  "Todos os recursos, sem limite de agendamentos",
  "Sem fidelidade — cancele quando quiser",
];

// =========================================================
// Visualização (só em `next dev`)
// =========================================================
// `?ver=ativa`, `?ver=teste`… mostra a tela em cada situação sem mexer em
// dado nenhum. Em produção o parâmetro é ignorado.
const IS_DEV = process.env.NODE_ENV !== "production";
const DAY = 86_400_000;

const PREVIEWS = ["teste", "teste_acabou", "ativa", "pagamento_pendente", "cancelada", "sem_assinatura"] as const;

function previewView(ver: string | undefined): SubscriptionView | null {
  if (!IS_DEV || !ver) return null;
  const now = Date.now();
  const iso = (offsetDays: number) => new Date(now + offsetDays * DAY).toISOString();
  switch (ver) {
    case "teste":
      return { kind: "teste", endsAt: iso(12), daysLeft: 12 };
    case "teste_acabou":
      return { kind: "teste_acabou", endedAt: iso(-3) };
    case "ativa":
      return { kind: "ativa", nextChargeAt: iso(24) };
    case "pagamento_pendente":
      return { kind: "pagamento_pendente", since: iso(-1) };
    case "cancelada":
      return { kind: "cancelada", accessUntil: iso(10) };
    case "sem_assinatura":
      return { kind: "sem_assinatura" };
    default:
      return null;
  }
}

const PREVIEW_INVOICES: Invoice[] = [1, 2].map((monthsAgo, i) => {
  const paid = new Date(Date.now() - monthsAgo * 30 * DAY).toISOString();
  return {
    id: `preview-${i}`,
    description: "Timely — mensalidade",
    paid_at: paid,
    issued_at: paid,
    seq: 1041 - i,
    total_cents: 3990,
    status: "paga",
  } as Invoice;
});

function PreviewSwitcher({ current }: { current: string | undefined }) {
  return (
    <nav className="flex flex-wrap items-center gap-1.5 rounded-md border border-dashed border-border p-2 text-xs">
      <span className="px-1 text-muted-foreground">Visualizar (só local):</span>
      <Link href="/app/assinatura" className={current ? "rounded px-2 py-1 hover:bg-muted" : "rounded bg-muted px-2 py-1 font-medium"}>
        real
      </Link>
      {PREVIEWS.map((p) => (
        <Link
          key={p}
          href={`/app/assinatura?ver=${p}`}
          className={current === p ? "rounded bg-muted px-2 py-1 font-medium" : "rounded px-2 py-1 hover:bg-muted"}
        >
          {p.replace("_", " ")}
        </Link>
      ))}
    </nav>
  );
}

function date(iso: string): string {
  return formatFullDateLocal(new Date(iso));
}

export default async function SubscriptionPage({
  searchParams,
}: {
  searchParams: Promise<{ pagamento?: string; ver?: string }>;
}) {
  const studio = await getMyStudio();
  if (!studio) return null;

  const [{ pagamento, ver }, mine, currentPlan] = await Promise.all([
    searchParams,
    getMySubscription(studio.id),
    isSupabaseServiceConfigured ? getCurrentPlan().catch(() => null) : Promise.resolve(null),
  ]);

  const subscription = mine?.subscription ?? null;
  const view = previewView(ver) ?? describeSubscription(subscription);
  const priceCents = currentPlan?.price_cents ?? subscription?.amount_cents ?? 3990;
  const price = formatPriceCents(priceCents);
  const method = subscription?.default_payment_method as PaymentMethod | null | undefined;
  const invoices = ver && previewView(ver) ? PREVIEW_INVOICES : (mine?.invoices ?? []);

  // Voltou da AbacatePay, mas o aviso de pagamento ainda não chegou.
  const awaitingConfirmation = pagamento === "concluido" && view.kind !== "ativa";

  return (
    <div className="flex flex-col gap-6">
      {IS_DEV && <PreviewSwitcher current={ver} />}

      <header className="space-y-1 border-b border-border pb-5">
        <h1 className="text-xl font-semibold text-foreground">Assinatura</h1>
        <p className="text-sm text-muted-foreground">
          Seu plano do Timely e o histórico de pagamentos.
        </p>
      </header>

      {awaitingConfirmation && (
        <p className="rounded-md border border-border bg-muted/50 px-4 py-3 text-sm text-foreground">
          Recebemos o seu pagamento. A confirmação costuma levar alguns segundos —
          atualize a página se o status abaixo ainda não mudou.
        </p>
      )}

      <section className="panel divide-y divide-border">
        <StatusBlock view={view} price={price} method={method ?? null} />

        <div className="grid gap-6 p-5 sm:grid-cols-[1fr_auto] sm:items-start">
          <div>
            <p className="section-label text-muted-foreground">Plano</p>
            <p className="mt-1 font-medium text-foreground">Timely</p>
            <ul className="mt-3 space-y-1.5">
              {INCLUDED.map((item) => (
                <li key={item} className="flex items-baseline gap-2 text-sm text-muted-foreground">
                  <Check className="size-3.5 shrink-0 translate-y-0.5 text-[var(--mark)]" strokeWidth={2.5} aria-hidden />
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <p className="flex items-baseline gap-1.5 sm:justify-end">
            <span className="text-2xl font-semibold tabular-nums text-foreground">{price}</span>
            <span className="text-sm text-muted-foreground">por mês</span>
          </p>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-foreground">Pagamentos</h2>
        {invoices.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhum pagamento ainda. Eles aparecem aqui assim que a primeira cobrança for feita.
          </p>
        ) : (
          <div className="panel divide-y divide-border">
            {invoices.map((invoice) => (
              <div key={invoice.id} className="flex items-center justify-between gap-4 px-4 py-3 text-sm">
                <div className="min-w-0">
                  <p className="truncate text-foreground">{invoice.description ?? "Mensalidade"}</p>
                  <p className="text-xs text-muted-foreground">
                    {date(invoice.paid_at ?? invoice.issued_at)} · Fatura #{invoice.seq}
                  </p>
                </div>
                <div className="text-right">
                  <p className="tabular-nums text-foreground">{formatPriceCents(invoice.total_cents)}</p>
                  <p className="text-xs text-muted-foreground">{INVOICE_STATUS_LABELS[invoice.status]}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function StatusBlock({
  view,
  price,
  method,
}: {
  view: SubscriptionView;
  price: string;
  method: PaymentMethod | null;
}) {
  const subscribeLabel = `Assinar por ${price}/mês`;

  switch (view.kind) {
    case "teste":
      return (
        <Status
          label="Teste grátis"
          title={view.daysLeft === 1 ? "Último dia do teste" : `Faltam ${view.daysLeft} dias do seu teste`}
          text={`Seu teste vai até ${date(view.endsAt)}. Depois disso o Timely custa ${price} por mês — você só paga se quiser continuar. A primeira cobrança acontece no dia em que você assinar.`}
          action={<SubscribeButton label="Assinar agora" />}
        />
      );
    case "teste_acabou":
      return (
        <Status
          label="Teste encerrado"
          tone="warning"
          title="Seu teste grátis acabou"
          text={`O teste terminou em ${date(view.endedAt)}. Assine para continuar usando o Timely. Pague com cartão (renova sozinho todo mês) ou Pix.`}
          action={<SubscribeButton label={subscribeLabel} />}
        />
      );
    case "ativa":
      return (
        <Status
          label="Ativa"
          tone="ok"
          title="Sua assinatura está ativa"
          text={`Próxima cobrança em ${date(view.nextChargeAt)}${method ? ` · ${PAYMENT_METHOD_LABELS[method]}` : ""}.`}
          action={<CancelSubscriptionButton />}
        />
      );
    case "pagamento_pendente":
      return (
        <Status
          label="Pagamento pendente"
          tone="warning"
          title="Não conseguimos cobrar a sua assinatura"
          text="O cartão pode ter sido recusado ou vencido. Faça o pagamento de novo para manter o Timely funcionando."
          action={<SubscribeButton label="Pagar agora" />}
        />
      );
    case "cancelada":
      return (
        <Status
          label="Cancelada"
          title="Sua assinatura foi cancelada"
          text={
            view.accessUntil
              ? `Nenhuma nova cobrança será feita. Você pode assinar de novo quando quiser.`
              : "Assine de novo para voltar a usar o Timely."
          }
          action={<SubscribeButton label={subscribeLabel} />}
        />
      );
    case "sem_assinatura":
      return (
        <Status
          label="Sem assinatura"
          title="Assine o Timely"
          text={`Todos os recursos por ${price} por mês. Pague com cartão (renova sozinho todo mês) ou Pix.`}
          action={<SubscribeButton label={subscribeLabel} />}
        />
      );
  }
}

const TONE_DOT = {
  neutral: "bg-muted-foreground",
  ok: "bg-emerald-500",
  warning: "bg-amber-500",
} as const;

function Status({
  label,
  title,
  text,
  action,
  tone = "neutral",
}: {
  label: string;
  title: string;
  text: string;
  action: React.ReactNode;
  tone?: keyof typeof TONE_DOT;
}) {
  return (
    <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-end sm:justify-between">
      <div className="max-w-xl space-y-1.5">
        <p className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
          <span className={`size-1.5 rounded-full ${TONE_DOT[tone]}`} aria-hidden />
          {label}
        </p>
        <p className="text-lg font-semibold text-foreground">{title}</p>
        <p className="text-sm leading-6 text-muted-foreground">{text}</p>
      </div>
      <div className="shrink-0">{action}</div>
    </div>
  );
}
