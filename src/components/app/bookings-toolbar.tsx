"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { LayoutGrid, List, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  BOOKING_PERIODS,
  DEFAULT_BOOKING_PERIOD,
  DEFAULT_BOOKING_VIEW,
  type BookingPeriod,
  type BookingStatusFilter,
  type BookingView,
} from "@/lib/bookings-filter";
import { BOOKING_STATUS_DOT, BOOKING_STATUS_LABELS, BOOKING_STATUS_ORDER } from "@/lib/booking-status";
import { cn } from "@/lib/utils";
import type { BookingStatus, Service } from "@/lib/types";

interface BookingsToolbarProps {
  period: BookingPeriod;
  status: BookingStatusFilter;
  serviceId: string;
  query: string;
  view: BookingView;
  services: Service[];
}

/**
 * Barra de filtros do módulo de agendamentos.
 *
 * O estado dos filtros vive na URL, não em `useState`: assim o dono pode
 * salvar "meus cancelados do mês" nos favoritos, o botão voltar funciona, e a
 * página continua sendo um Server Component que lê `searchParams` — sem
 * refazer o carregamento de dados no cliente.
 */
export function BookingsToolbar({
  period,
  status,
  serviceId,
  query,
  view,
  services,
}: BookingsToolbarProps) {
  const router = useRouter();

  // Espelha o texto do prop enquanto o dono não digita. Sincronizar durante o
  // render (em vez de `useEffect`) é o mesmo padrão do BookingFormDialog.
  const [text, setText] = useState(query);
  const [lastQuery, setLastQuery] = useState(query);
  if (query !== lastQuery) {
    setLastQuery(query);
    setText(query);
  }

  /** Monta a próxima URL preservando os filtros atuais e omitindo os padrões. */
  function push(patch: {
    period?: BookingPeriod;
    status?: BookingStatusFilter;
    serviceId?: string;
    query?: string;
    view?: BookingView;
  }) {
    const next = { period, status, serviceId, query, view, ...patch };
    const params = new URLSearchParams();
    if (next.period !== DEFAULT_BOOKING_PERIOD) params.set("periodo", next.period);
    if (next.status !== "todos") params.set("status", next.status);
    if (next.serviceId !== "todos") params.set("servico", next.serviceId);
    if (next.query.trim()) params.set("q", next.query.trim());
    if (next.view !== DEFAULT_BOOKING_VIEW) params.set("view", next.view);
    const qs = params.toString();
    router.push(qs ? `/app/bookings?${qs}` : "/app/bookings");
  }

  function handleSearch(e: FormEvent) {
    e.preventDefault();
    push({ query: text });
  }

  const hasFilters =
    period !== DEFAULT_BOOKING_PERIOD ||
    status !== "todos" ||
    serviceId !== "todos" ||
    query.trim() !== "";

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <form onSubmit={handleSearch} className="relative min-w-56 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Buscar por nome ou telefone"
            aria-label="Buscar agendamentos"
            className="pl-9"
          />
          {/* Submit invisível: garante o Enter no campo sem um botão a mais na barra. */}
          <button type="submit" className="sr-only">
            Buscar
          </button>
        </form>

        {/* Alternador de visualização. Dois botões em vez de um toggle porque o
            estado atual precisa ficar legível sem hover — quem trabalha na
            grade o dia inteiro não deve precisar adivinhar em que modo está. */}
        <div className="flex items-center gap-0.5 rounded-lg border border-border p-0.5">
          <ViewButton
            active={view === "cards"}
            label="Cards"
            onClick={() => push({ view: "cards" })}
            icon={<LayoutGrid className="size-4" />}
          />
          <ViewButton
            active={view === "lista"}
            label="Lista"
            onClick={() => push({ view: "lista" })}
            icon={<List className="size-4" />}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Select value={period} onValueChange={(value) => push({ period: value as BookingPeriod })}>
          <SelectTrigger className="min-w-40" aria-label="Período">
            {/* O rótulo é derivado do valor em vez de deixado a cargo do
                `Select.Value` padrão: assim o gatilho já sai renderizado com o
                texto certo do servidor, sem um instante em branco até a
                hidratação. Vale para os três filtros. */}
            <SelectValue>
              {(value) => BOOKING_PERIODS.find((p) => p.value === value)?.label}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {BOOKING_PERIODS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={status}
          onValueChange={(value) => push({ status: value as BookingStatusFilter })}
        >
          <SelectTrigger className="min-w-36" aria-label="Status">
            <SelectValue>
              {(value) =>
                value === "todos"
                  ? "Todos os status"
                  : BOOKING_STATUS_LABELS[value as BookingStatus]
              }
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os status</SelectItem>
            {BOOKING_STATUS_ORDER.map((s) => (
              <SelectItem key={s} value={s}>
                <span className={cn("size-2 rounded-full", BOOKING_STATUS_DOT[s])} />
                {BOOKING_STATUS_LABELS[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={serviceId} onValueChange={(value) => push({ serviceId: value as string })}>
          <SelectTrigger className="min-w-40" aria-label="Serviço">
            <SelectValue>
              {(value) =>
                value === "todos"
                  ? "Todos os serviços"
                  : (services.find((s) => s.id === value)?.name ?? "Serviço removido")
              }
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os serviços</SelectItem>
            {services.map((service) => (
              <SelectItem key={service.id} value={service.id}>
                <span
                  className="size-2 rounded-full"
                  style={{ backgroundColor: service.color ?? "var(--primary)" }}
                />
                {service.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {hasFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              push({
                period: DEFAULT_BOOKING_PERIOD,
                status: "todos",
                serviceId: "todos",
                query: "",
              })
            }
          >
            <X className="size-4" /> Limpar filtros
          </Button>
        )}
      </div>
    </div>
  );
}

function ViewButton({
  active,
  label,
  icon,
  onClick,
}: {
  active: boolean;
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      title={label}
      className={cn(
        "flex h-7 items-center gap-1.5 rounded-[min(var(--radius-md),12px)] px-2.5 text-[0.8rem] font-medium transition-colors",
        active
          ? "bg-primary text-primary-foreground"
          : "text-muted-foreground hover:bg-muted hover:text-foreground"
      )}
    >
      {icon}
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}
