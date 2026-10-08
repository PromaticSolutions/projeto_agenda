import { listSalonAttendants, requireManager } from "@/lib/data/salons";
import { attendantStatus } from "@/lib/access";
import { AttendantFormDialog } from "@/components/app/attendant-form-dialog";
import { AttendantRowActions } from "@/components/app/attendant-row-actions";
import { formatDateLocal, formatPhoneDisplay } from "@/lib/format";

export const metadata = { title: "Atendentes — Timely" };

export default async function AtendentesPage() {
  const manager = await requireManager();
  const attendants = await listSalonAttendants(manager.salonId);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-5">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold text-foreground">Atendentes</h1>
          <p className="text-sm text-muted-foreground">
            Quem você cadastra aqui já entra vinculada ao seu salão e vê apenas os próprios
            dados.
          </p>
        </div>
        <AttendantFormDialog />
      </header>

      {attendants.length === 0 ? (
        <div className="panel flex flex-col items-center gap-1 border-dashed p-10 text-center">
          <p className="font-medium text-foreground">Nenhuma atendente ainda</p>
          <p className="text-sm text-muted-foreground">
            Use o botão acima para cadastrar a primeira.
          </p>
        </div>
      ) : (
        <div className="panel overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-left">
                  <th className="section-label px-4 py-2.5 text-muted-foreground">Atendente</th>
                  <th className="section-label px-4 py-2.5 text-muted-foreground">WhatsApp</th>
                  <th className="section-label px-4 py-2.5 text-muted-foreground">Situação</th>
                  <th className="section-label px-4 py-2.5 text-muted-foreground">Desde</th>
                  <th className="section-label px-4 py-2.5 text-right text-muted-foreground">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody>
                {attendants.map((attendant) => {
                  const inactive = attendantStatus(attendant) === "inativa";
                  return (
                    <tr key={attendant.id} className="border-b border-border last:border-0">
                      <td className="px-4 py-3">
                        <span className="font-medium text-foreground">{attendant.name}</span>
                        <span className="block text-xs text-muted-foreground">
                          /{attendant.slug}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {formatPhoneDisplay(attendant.whatsapp)}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={
                            inactive
                              ? "rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground"
                              : "rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary"
                          }
                        >
                          {inactive ? "inativa" : "ativa"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {formatDateLocal(new Date(attendant.created_at))}
                      </td>
                      <td className="px-4 py-3">
                        <AttendantRowActions attendant={attendant} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Desativar tira a página pública do ar sem mexer no login nem no histórico. Remover do
        salão devolve a atendente à condição de autônoma — ela continua com tudo o que é dela.
      </p>
    </div>
  );
}
