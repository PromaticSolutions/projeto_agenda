import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getMyStudio } from "@/lib/data/studios";
import { getMyClient } from "@/lib/data/clients";
import { listBookingsForClient } from "@/lib/data/bookings";
import { listMyServices } from "@/lib/data/services";
import { ClientNotesForm } from "@/components/app/client-notes-form";
import { BOOKING_STATUS_DOT, BOOKING_STATUS_LABELS } from "@/lib/booking-status";
import { formatDateLocal, formatPhoneDisplay, formatTimeLocal } from "@/lib/format";
import { cn } from "@/lib/utils";

interface ClientDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function ClientDetailPage({ params }: ClientDetailPageProps) {
  const { id } = await params;
  const studio = await getMyStudio();
  if (!studio) return null;

  const client = await getMyClient(studio.id, id);
  if (!client) notFound();

  const [bookings, services] = await Promise.all([
    listBookingsForClient(studio.id, client.id),
    listMyServices(studio.id),
  ]);
  const serviceById = new Map(services.map((s) => [s.id, s]));

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <Link href="/app/clients" className="flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Voltar para clientes
      </Link>

      <div>
        <h1 className="font-heading text-2xl font-semibold text-plum-900">{client.name}</h1>
        <p className="text-muted-foreground">{formatPhoneDisplay(client.phone)}</p>
      </div>

      <section className="rounded-2xl bg-card p-5 shadow-sm ring-1 ring-plum-900/5">
        <p className="mb-3 text-xs font-bold tracking-[.13em] text-violet-600 uppercase">Notas</p>
        <ClientNotesForm clientId={client.id} notes={client.notes} />
      </section>

      <section className="rounded-2xl bg-card p-5 shadow-sm ring-1 ring-plum-900/5">
        <p className="mb-3 text-xs font-bold tracking-[.13em] text-violet-600 uppercase">
          Histórico de agendamentos ({bookings.length})
        </p>
        {bookings.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum agendamento registrado ainda.</p>
        ) : (
          <div className="flex flex-col divide-y divide-border/70">
            {bookings.map((booking) => {
              const service = serviceById.get(booking.service_id);
              const start = new Date(booking.start_at);
              return (
                <div key={booking.id} className="flex items-center justify-between gap-3 py-3">
                  <div>
                    <p className="font-medium text-plum-900 dark:text-foreground">{service?.name ?? "Serviço removido"}</p>
                    <p className="text-sm text-muted-foreground">
                      {formatDateLocal(start)} · {formatTimeLocal(start)}
                    </p>
                  </div>
                  <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                    <span className={cn("size-2 rounded-full", BOOKING_STATUS_DOT[booking.status])} />
                    {BOOKING_STATUS_LABELS[booking.status]}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
