import { getMyStudio } from "@/lib/data/studios";
import { listMyServices } from "@/lib/data/services";
import { ServiceFormDialog } from "@/components/app/service-form-dialog";
import { ServicesView } from "@/components/app/services-view";

export const metadata = { title: "Serviços — Agenda Online" };

export default async function ServicesPage() {
  const studio = await getMyStudio();
  if (!studio) return null;

  const services = await listMyServices(studio.id);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-5">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold text-foreground">Serviços</h1>
          <p className="text-sm text-muted-foreground">
            Cada procedimento com valor, duração e cor.
          </p>
        </div>
        <ServiceFormDialog />
      </header>

      {services.length === 0 ? (
        <div className="panel flex flex-col items-center gap-1 border-dashed p-10 text-center">
          <p className="font-medium text-foreground">Nenhum serviço cadastrado</p>
          <p className="text-sm text-muted-foreground">
            Use &quot;Novo serviço&quot; para cadastrar o primeiro procedimento.
          </p>
        </div>
      ) : (
        <ServicesView services={services} />
      )}
    </div>
  );
}
