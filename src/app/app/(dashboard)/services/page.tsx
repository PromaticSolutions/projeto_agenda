import { getMyStudio } from "@/lib/data/studios";
import { listMyServices } from "@/lib/data/services";
import { ServiceFormDialog } from "@/components/app/service-form-dialog";
import { ServiceRowActions } from "@/components/app/service-row-actions";
import { Badge } from "@/components/ui/badge";
import { formatDurationMin, formatPriceCents } from "@/lib/format";

export const metadata = { title: "Serviços — Agenda Online" };

export default async function ServicesPage() {
  const studio = await getMyStudio();
  if (!studio) return null;

  const services = await listMyServices(studio.id);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-semibold text-plum-900 dark:text-blush-50">
            Serviços
          </h1>
          <p className="text-muted-foreground">
            Cadastre cada procedimento com valor, duração e cor.
          </p>
        </div>
        <ServiceFormDialog />
      </div>

      {services.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-8 text-center text-muted-foreground">
          Nenhum serviço cadastrado ainda. Clique em &quot;Novo serviço&quot; para começar.
        </p>
      ) : (
        <div className="flex flex-col divide-y divide-border rounded-lg border border-border">
          {services.map((service) => (
            <div key={service.id} className="flex items-center justify-between gap-4 px-4 py-3">
              <div className="flex min-w-0 items-center gap-3">
                <span
                  className="size-3 shrink-0 rounded-full"
                  style={{ backgroundColor: service.color }}
                />
                <div className="min-w-0">
                  <p className="truncate font-medium">{service.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {formatPriceCents(service.price_cents)} · {formatDurationMin(service.duration_min)}
                  </p>
                </div>
                {!service.active && (
                  <Badge variant="secondary" className="shrink-0">
                    Pausado
                  </Badge>
                )}
              </div>
              <ServiceRowActions service={service} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
