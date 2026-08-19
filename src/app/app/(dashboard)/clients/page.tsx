import Link from "next/link";
import { getMyStudio } from "@/lib/data/studios";
import { listMyClientsWithStats } from "@/lib/data/clients";
import { ClientFormDialog } from "@/components/app/client-form-dialog";
import { ClientRowActions } from "@/components/app/client-row-actions";
import { formatDateLocal, formatPhoneDisplay } from "@/lib/format";

export const metadata = { title: "Clientes — Agenda Online" };

export default async function ClientsPage() {
  const studio = await getMyStudio();
  if (!studio) return null;

  const clients = await listMyClientsWithStats(studio.id);
  // Quem veio há menos tempo primeiro; quem nunca veio vai para o fim, em
  // ordem alfabética — é o cadastro novo, ainda sem histórico.
  const sorted = [...clients].sort((a, b) => {
    if (!a.lastVisitAt && !b.lastVisitAt) return a.name.localeCompare(b.name);
    if (!a.lastVisitAt) return 1;
    if (!b.lastVisitAt) return -1;
    return b.lastVisitAt.localeCompare(a.lastVisitAt);
  });

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-5">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold text-foreground">Clientes</h1>
          <p className="text-sm text-muted-foreground">
            Cadastre quando quiser — quem agenda entra aqui automaticamente.
          </p>
        </div>
        <ClientFormDialog />
      </header>

      {sorted.length === 0 ? (
        <div className="panel flex flex-col items-center gap-1 border-dashed p-10 text-center">
          <p className="font-medium text-foreground">Nenhuma cliente ainda</p>
          <p className="text-sm text-muted-foreground">
            Cadastre pelo botão acima, ou espere o primeiro agendamento entrar.
          </p>
        </div>
      ) : (
        <div className="panel overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-left">
                  <th className="section-label px-4 py-2.5 text-muted-foreground">Nome</th>
                  <th className="section-label px-4 py-2.5 text-muted-foreground">Telefone</th>
                  <th className="section-label px-4 py-2.5 text-right text-muted-foreground">
                    Agendamentos
                  </th>
                  <th className="section-label px-4 py-2.5 text-muted-foreground">Última visita</th>
                  <th className="section-label px-4 py-2.5 text-right text-muted-foreground">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((client) => (
                  <tr key={client.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-3">
                      <Link
                        href={`/app/clients/${client.id}`}
                        className="font-medium text-foreground underline-offset-4 hover:underline"
                      >
                        {client.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {formatPhoneDisplay(client.phone)}
                    </td>
                    <td className="px-4 py-3 text-right">{client.totalBookings}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {client.lastVisitAt ? formatDateLocal(new Date(client.lastVisitAt)) : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <ClientRowActions client={client} />
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
