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
          <h1 className="font-heading text-2xl font-semibold text-plum-900">Serviços</h1>
          <p className="text-muted-foreground">
            Cadastre cada procedimento com valor, duração e cor.
          </p>
        </div>
        <ServiceFormDialog />
      </div>

      {services.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-plum-900/15 p-8 text-center text-muted-foreground">
          Nenhum serviço cadastrado ainda. Clique em &quot;Novo serviço&quot; para começar.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {services.map((service) => (
            <div
              key={service.id}
              className="flex flex-col overflow-hidden rounded-2xl bg-card shadow-sm ring-1 ring-plum-900/5"
            >
              <div className="h-1.5" style={{ backgroundColor: service.color }} />
              <div className="flex flex-1 flex-col gap-3 p-4">
                <div className="flex items-start justify-between gap-2">
                  <p className="min-w-0 truncate font-medium text-plum-900">{service.name}</p>
                  {!service.active && (
                    <Badge variant="secondary" className="shrink-0">
                      Pausado
                    </Badge>
                  )}
                </div>
                <p className="font-heading text-xl font-semibold text-violet-600">
                  {formatPriceCents(service.price_cents)}
                </p>
                <p className="text-sm text-muted-foreground">{formatDurationMin(service.duration_min)}</p>
                <div className="mt-auto flex items-center justify-end border-t border-border/70 pt-3">
                  <ServiceRowActions service={service} />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
