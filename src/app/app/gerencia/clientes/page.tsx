import {
  listSalonAttendants,
  listSalonClients,
  narrowToAttendant,
  requireManager,
} from "@/lib/data/salons";
import { AttendantFilter } from "@/components/app/attendant-filter";
import { formatDateLocal, formatPhoneDisplay } from "@/lib/format";

export const metadata = { title: "Clientes do salão — Timely" };

interface PageProps {
  searchParams: Promise<{ atendente?: string }>;
}

export default async function GerenciaClientesPage({ searchParams }: PageProps) {
  const manager = await requireManager();
  const [params, attendants] = await Promise.all([
    searchParams,
    listSalonAttendants(manager.salonId),
  ]);

  const allIds = attendants.map((a) => a.id);
  /* O filtro da URL é recortado contra os estúdios DO SALÃO. Um id de fora
     some aqui — e, se passasse, a RLS da 0024 devolveria vazio. */
  const studioIds = narrowToAttendant(allIds, params.atendente);
  const clients = await listSalonClients(studioIds);

  const nameByStudio = new Map(attendants.map((a) => [a.id, a.name]));

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-5">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold text-foreground">Clientes do salão</h1>
          <p className="text-sm text-muted-foreground">
            {clients.length} {clients.length === 1 ? "cliente" : "clientes"} nas agendas das suas
            atendentes.
          </p>
        </div>
        <AttendantFilter attendants={attendants.map((a) => ({ id: a.id, name: a.name }))} />
      </header>

      {clients.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="panel overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-left">
                  <th className="section-label px-4 py-2.5 text-muted-foreground">Cliente</th>
                  <th className="section-label px-4 py-2.5 text-muted-foreground">Telefone</th>
                  <th className="section-label px-4 py-2.5 text-muted-foreground">Atendente</th>
                  <th className="section-label px-4 py-2.5 text-muted-foreground">Cadastrada em</th>
                </tr>
              </thead>
              <tbody>
                {clients.map((client) => (
                  <tr key={client.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-3 font-medium text-foreground">{client.name}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {formatPhoneDisplay(client.phone)}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {nameByStudio.get(client.studio_id) ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {formatDateLocal(new Date(client.created_at))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="panel flex flex-col items-center gap-1 border-dashed p-10 text-center">
      <p className="font-medium text-foreground">Nenhuma cliente aqui</p>
      <p className="text-sm text-muted-foreground">
        Elas aparecem conforme as atendentes cadastram ou recebem agendamentos.
      </p>
    </div>
  );
}
