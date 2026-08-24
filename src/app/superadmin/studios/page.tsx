import { listStudioRows } from "@/lib/data/superadminRows";
import { StudiosToolbar } from "@/components/superadmin/studios-toolbar";
import { StudiosTable } from "@/components/superadmin/studios-table";
import { MigrationNotice } from "@/components/superadmin/migration-notice";
import {
  filterAndSortStudios,
  parseStudioFilter,
  parseStudioSort,
} from "@/lib/superadmin-filters";
import { formatPriceCents } from "@/lib/format";

export const metadata = { title: "Clientes — Timely Admin" };

interface StudiosPageProps {
  searchParams: Promise<{ filtro?: string; ordem?: string; q?: string }>;
}

/**
 * Lista de clientes da plataforma.
 *
 * Uma tabela larga em vez de cards: aqui a pergunta é comparativa ("quem paga
 * mais? quem parou de usar? quem está em atraso?"), e comparação se faz em
 * coluna alinhada. A ficha individual é que ganha layout de leitura.
 */
export default async function SuperAdminStudiosPage({ searchParams }: StudiosPageProps) {
  const params = await searchParams;
  const filter = parseStudioFilter(params.filtro);
  const sort = parseStudioSort(params.ordem);
  const query = params.q?.trim() ?? "";

  const { rows, billingReady } = await listStudioRows();
  const visible = filterAndSortStudios(rows, { filter, sort, query });

  const sliceMrr = visible.reduce((total, row) => total + row.monthlyCents, 0);
  const sliceOverdue = visible.reduce((total, row) => total + row.overdueCents, 0);
  const sliceBookings = visible.reduce((total, row) => total + row.bookingsLast30d, 0);

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-5">
      <header className="space-y-1 border-b border-border pb-5">
        <h1 className="text-xl font-semibold text-foreground">Clientes</h1>
        <p className="text-sm text-muted-foreground">
          Cada estúdio da plataforma, com uso e cobrança na mesma linha. Clique para abrir a ficha.
        </p>
      </header>

      {!billingReady && (
        <MigrationNotice migration="0011_billing.sql" feature="A cobrança da plataforma" />
      )}

      <StudiosToolbar
        filter={filter}
        sort={sort}
        query={query}
        total={rows.length}
        shown={visible.length}
      />

      {/* Soma do recorte, não da base: com filtro aplicado, o total da base
          responderia a uma pergunta que ninguém fez. */}
      {visible.length > 0 && (
        <dl className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
          <div className="flex items-baseline gap-1.5">
            <dt className="text-muted-foreground">MRR do recorte:</dt>
            <dd className="font-medium tabular-nums text-foreground">{formatPriceCents(sliceMrr)}</dd>
          </div>
          <div className="flex items-baseline gap-1.5">
            <dt className="text-muted-foreground">Em atraso:</dt>
            <dd
              className={
                sliceOverdue > 0
                  ? "font-medium tabular-nums text-destructive"
                  : "font-medium tabular-nums text-foreground"
              }
            >
              {formatPriceCents(sliceOverdue)}
            </dd>
          </div>
          <div className="flex items-baseline gap-1.5">
            <dt className="text-muted-foreground">Agendamentos em 30 dias:</dt>
            <dd className="font-medium tabular-nums text-foreground">
              {sliceBookings.toLocaleString("pt-BR")}
            </dd>
          </div>
        </dl>
      )}

      <StudiosTable studios={visible} />
    </div>
  );
}
