import Link from "next/link";
import { Building2, ChevronRight, Landmark } from "lucide-react";
import { isBillingSchemaReady } from "@/lib/data/billing";
import { MigrationNotice } from "@/components/superadmin/migration-notice";
import { TotalBillingView } from "@/app/superadmin/billing/total-view";
import { ClientBillingDetail, ClientBillingList } from "@/app/superadmin/billing/clients-view";
import { parseInvoiceFilter, parseMonthParam } from "@/lib/superadmin-filters";
import { utcToLocalDate } from "@/lib/availability";
import { cn } from "@/lib/utils";

export const metadata = { title: "Faturamento — Timely Admin" };

interface BillingPageProps {
  searchParams: Promise<{
    visao?: string;
    cliente?: string;
    situacao?: string;
    mes?: string;
    q?: string;
  }>;
}

type BillingView = "total" | "clientes";

/**
 * Faturamento da plataforma, em duas visões escolhidas pelos cards do topo:
 *
 * - Total: a soma de todos os estúdios (MRR, receita, inadimplência, faturas).
 * - Por cliente: a lista de estúdios e, escolhido um, o dinheiro só dele.
 *
 * A visão e o cliente escolhido vivem na URL (`visao`, `cliente`), como os
 * outros filtros do /superadmin: o voltar do navegador funciona e o link de um
 * cliente específico pode ser favoritado.
 */
export default async function SuperAdminBillingPage({ searchParams }: BillingPageProps) {
  const ready = await isBillingSchemaReady();
  if (!ready) {
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
        <BillingHeader />
        <MigrationNotice migration="0011_billing.sql" feature="A cobrança da plataforma" />
      </div>
    );
  }

  const params = await searchParams;
  const view: BillingView = params.visao === "clientes" ? "clientes" : "total";
  const query = params.q?.trim() ?? "";
  const today = utcToLocalDate(new Date());

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <BillingHeader />

      <nav aria-label="Visão do faturamento" className="grid gap-3 sm:grid-cols-2">
        <ViewCard
          href="/superadmin/billing"
          active={view === "total"}
          icon={Landmark}
          title="Total da plataforma"
          description="MRR, receita recebida, inadimplência e todas as faturas somadas."
        />
        <ViewCard
          href="/superadmin/billing?visao=clientes"
          active={view === "clientes"}
          icon={Building2}
          title="Por cliente"
          description="Escolha um estúdio e veja quanto ele já pagou, o que deve e as faturas dele."
        />
      </nav>

      {view === "total" ? (
        <TotalBillingView
          filter={parseInvoiceFilter(params.situacao)}
          month={parseMonthParam(params.mes)}
          query={query}
          today={today}
        />
      ) : params.cliente ? (
        <ClientBillingDetail studioId={params.cliente} today={today} />
      ) : (
        <ClientBillingList query={query} />
      )}
    </div>
  );
}

function BillingHeader() {
  return (
    <header className="space-y-1 border-b border-border pb-5">
      <h1 className="text-xl font-semibold text-foreground">Faturamento</h1>
      <p className="text-sm text-muted-foreground">
        O que os estúdios pagam pela Timely — no total ou cliente a cliente.
      </p>
    </header>
  );
}

function ViewCard({
  href,
  active,
  icon: Icon,
  title,
  description,
}: {
  href: string;
  active: boolean;
  icon: typeof Landmark;
  title: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "panel flex items-center gap-3 p-4 transition-colors",
        active ? "border-primary ring-1 ring-primary" : "hover:bg-muted/50"
      )}
    >
      <Icon className={cn("size-5 shrink-0", active ? "text-primary" : "text-muted-foreground")} aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="font-medium text-foreground">{title}</p>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
    </Link>
  );
}
