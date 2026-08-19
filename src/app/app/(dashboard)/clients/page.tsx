import Link from "next/link";
import { Users } from "lucide-react";
import { getMyStudio } from "@/lib/data/studios";
import { listMyClientsWithStats } from "@/lib/data/clients";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDateLocal, formatPhoneDisplay } from "@/lib/format";

export const metadata = { title: "Clientes — Agenda Online" };

export default async function ClientsPage() {
  const studio = await getMyStudio();
  if (!studio) return null;

  const clients = await listMyClientsWithStats(studio.id);
  const sorted = [...clients].sort((a, b) => {
    if (!a.lastVisitAt && !b.lastVisitAt) return a.name.localeCompare(b.name);
    if (!a.lastVisitAt) return 1;
    if (!b.lastVisitAt) return -1;
    return b.lastVisitAt.localeCompare(a.lastVisitAt);
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold text-plum-900">Clientes</h1>
        <p className="text-muted-foreground">
          Histórico de quem já agendou com você — derivado automaticamente dos agendamentos.
        </p>
      </div>

      {sorted.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-3xl border border-dashed border-plum-900/15 bg-white/35 p-12 text-center">
          <Users className="size-8 text-muted-foreground" />
          <p className="text-muted-foreground">Nenhum cliente ainda. Assim que o primeiro agendamento entrar, ele aparece aqui.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl bg-card shadow-sm ring-1 ring-plum-900/5">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead>Agendamentos</TableHead>
                <TableHead>Última visita</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((client) => (
                <TableRow key={client.id}>
                  <TableCell>
                    <Link href={`/app/clients/${client.id}`} className="font-medium text-plum-900 hover:text-violet-600 dark:text-foreground">
                      {client.name}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{formatPhoneDisplay(client.phone)}</TableCell>
                  <TableCell>{client.totalBookings}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {client.lastVisitAt ? formatDateLocal(new Date(client.lastVisitAt)) : "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
