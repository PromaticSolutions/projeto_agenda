import { redirect } from "next/navigation";
import { GerenciaShell } from "@/components/app/gerencia-shell";
import { getCurrentActor, getSalon, getSalonManager } from "@/lib/data/salons";
import { homePathFor } from "@/lib/access";

/**
 * Porta de entrada da área da gerente.
 *
 * O layout só decide PARA ONDE mandar quem não é gerente — ele não é a
 * autorização. Cada página e cada Server Action abaixo chama `requireManager()`
 * por conta própria, porque um layout não protege uma Server Action: a ação é
 * uma porta HTTP própria, que aceita POST de quem montar a requisição à mão.
 *
 * Quem decide de verdade o que ela ALCANÇA é a RLS da migração 0024.
 */
export default async function GerenciaLayout({ children }: { children: React.ReactNode }) {
  const actor = await getCurrentActor();
  if (!actor) redirect("/login?next=/app/gerencia");
  if (actor.role !== "gerente") redirect(homePathFor(actor));

  const [salon, manager] = await Promise.all([
    getSalon(actor.salonId),
    getSalonManager(actor.userId),
  ]);

  return (
    <GerenciaShell salonName={salon?.name ?? "Salão"} managerName={manager?.name ?? null}>
      {children}
    </GerenciaShell>
  );
}
