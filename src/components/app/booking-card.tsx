import { Phone } from "lucide-react";
import { BookingFormDialog } from "@/components/app/booking-form-dialog";
import { BookingStatusSelect } from "@/components/app/booking-status-select";
import { formatPhoneDisplay, formatPriceCents, formatTimeLocal } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Booking, Service } from "@/lib/types";

/**
 * Cartão de um atendimento na visualização em grade.
 *
 * O movimento de hover é todo CSS — nenhum estado, nenhum handler, então o
 * cartão continua sendo Server Component e só os dois controles internos
 * (reagendar e status) descem como JavaScript para o navegador.
 *
 * A regra do movimento: ele sinaliza "este é o cartão sob o cursor" e nada
 * mais. Elevação de 2px, a borda assumindo a cor primária, a faixa do serviço
 * engrossando e os controles saindo de 60% para 100% de opacidade. Nada
 * aparece ou some no hover — quem usa toque ou teclado enxerga a mesma
 * interface, e `focus-within` reproduz o mesmo destaque ao navegar por Tab.
 */
export function BookingCard({
  booking,
  service,
  services,
}: {
  booking: Booking;
  service: Service | undefined;
  services: Service[];
}) {
  const start = new Date(booking.start_at);
  const end = new Date(booking.end_at);
  const canceled = booking.status === "cancelado";
  const accent = service?.color ?? "var(--primary)";

  return (
    <li
      className={cn(
        "group panel relative overflow-hidden pl-4 transition-[transform,border-color,box-shadow] duration-200 ease-out",
        "hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg hover:shadow-foreground/5",
        "focus-within:-translate-y-0.5 focus-within:border-primary/40",
        // Quem pediu menos movimento no sistema operacional recebe só a cor.
        "motion-reduce:transition-[border-color] motion-reduce:hover:translate-y-0 motion-reduce:focus-within:translate-y-0",
        canceled && "opacity-65"
      )}
    >
      <span
        aria-hidden
        className="absolute inset-y-0 left-0 w-1 transition-[width] duration-200 ease-out group-hover:w-1.5"
        style={{ backgroundColor: accent }}
      />

      <div className="flex flex-col gap-3 p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="flex items-baseline gap-1.5">
              <time className="text-lg font-semibold text-foreground">
                {formatTimeLocal(start)}
              </time>
              <span className="text-sm text-muted-foreground">→ {formatTimeLocal(end)}</span>
            </p>
            <p className="truncate text-sm text-muted-foreground">
              {service?.name ?? "Serviço removido"}
              {service && ` · ${formatPriceCents(service.price_cents)}`}
            </p>
          </div>

          <div className="shrink-0 opacity-100 transition-opacity duration-200 md:opacity-60 md:group-hover:opacity-100 md:group-focus-within:opacity-100">
            <BookingFormDialog
              services={services}
              booking={booking}
              clientName={booking.client_name}
            />
          </div>
        </div>

        <div className="min-w-0">
          <p className="truncate font-medium text-foreground">{booking.client_name}</p>
          <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Phone className="size-3.5 shrink-0" aria-hidden />
            {formatPhoneDisplay(booking.client_phone)}
          </p>
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-border pt-3">
          <BookingStatusSelect bookingId={booking.id} status={booking.status} />
        </div>
      </div>
    </li>
  );
}
