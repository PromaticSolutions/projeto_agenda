"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { CalendarIcon, ChevronLeft, ChevronRight, LayoutGrid, List, Search, X } from "lucide-react";
import { ptBR } from "react-day-picker/locale";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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
import { addLocalDays } from "@/lib/availability";
import { formatDateLocal } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { BookingStatus, Service } from "@/lib/types";

interface BookingsToolbarProps {
  period: BookingPeriod;
  /** Dia escolhido no calendário ("AAAA-MM-DD"), ou null. Manda sobre o período. */
  date: string | null;
  /** Hoje, na data local do estúdio — o calendário abre nele quando não há dia escolhido. */
  today: string;
  status: BookingStatusFilter;
  serviceId: string;
  query: string;
  view: BookingView;
  services: Service[];
}

/** Rótulos curtos para os botões de período; o vocabulário continua em `lib`. */
const PERIOD_SHORT: Record<BookingPeriod, string> = {
  hoje: "Hoje",
  "7d": "Próximos 7 dias",
  "30d": "Próximos 30 dias",
  passados: "Últimos 30 dias",
};

/** "2026-09-12" → Date ao meio-dia de Brasília: nenhum fuso empurra para outro dia. */
function dateFromLocal(value: string): Date {
  return new Date(`${value}T12:00:00-03:00`);
}

function localFromDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Barra de filtros do módulo de agendamentos.
 *
 * O estado dos filtros vive na URL, não em `useState`: assim o dono pode
 * salvar "meus cancelados do mês" nos favoritos, o botão voltar funciona, e a
 * página continua sendo um Server Component que lê `searchParams` — sem
 * refazer o carregamento de dados no cliente.
 *
 * Cada grupo tem RÓTULO ("Quando", "Status", "Serviço"): três seletores lado
 * a lado sem nome eram o que deixava esta tela confusa — só dava para saber o
 * que cada um filtrava abrindo. O período virou botões visíveis em vez de um
 * menu, e ao lado deles fica o calendário para um dia específico. Com um dia
 * escolhido, as setas andam para o dia anterior e o seguinte sem reabrir o
 * calendário.
 */
export function BookingsToolbar({
  period,
  date,
  today,
  status,
  serviceId,
  query,
  view,
  services,
}: BookingsToolbarProps) {
  const router = useRouter();
  const [calendarOpen, setCalendarOpen] = useState(false);

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
    date?: string | null;
    status?: BookingStatusFilter;
    serviceId?: string;
    query?: string;
    view?: BookingView;
  }) {
    const next = { period, date, status, serviceId, query, view, ...patch };
    const params = new URLSearchParams();
    if (next.date) params.set("data", next.date);
    else if (next.period !== DEFAULT_BOOKING_PERIOD) params.set("periodo", next.period);
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
    date !== null ||
    period !== DEFAULT_BOOKING_PERIOD ||
    status !== "todos" ||
    serviceId !== "todos" ||
    query.trim() !== "";

  return (
    <div className="panel shadow-float flex flex-col gap-5 p-4 sm:p-5">
      <div className="flex flex-wrap items-center gap-2">
        <form onSubmit={handleSearch} className="relative min-w-56 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Buscar cliente por nome ou telefone"
            aria-label="Buscar agendamentos"
            className="h-10 pl-9"
          />
          {/* Submit invisível: garante o Enter no campo sem um botão a mais na barra. */}
          <button type="submit" className="sr-only">
            Buscar
          </button>
        </form>

        {/* Alternador de visualização. Dois botões em vez de um toggle porque o
            estado atual precisa ficar legível sem hover — quem trabalha na
            grade o dia inteiro não deve precisar adivinhar em que modo está. */}
        <div className="flex h-10 items-center gap-0.5 rounded-lg border border-border p-1">
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

      <div className="flex flex-wrap items-end gap-x-6 gap-y-4">
        <FilterGroup label="Quando">
          <div className="flex flex-wrap items-center gap-1.5">
            {BOOKING_PERIODS.map((option) => (
              <Chip
                key={option.value}
                active={!date && period === option.value}
                onClick={() => push({ period: option.value, date: null })}
              >
                {PERIOD_SHORT[option.value]}
              </Chip>
            ))}

            {/* Dia específico. Com um dia escolhido, o próprio botão mostra a
                data e ganha setas para andar um dia para cada lado. */}
            <div
              className={cn(
                "flex items-center rounded-full border",
                date ? "border-primary bg-primary/8" : "border-border"
              )}
            >
              {date && (
                <DayArrow label="Dia anterior" onClick={() => push({ date: addLocalDays(date, -1) })}>
                  <ChevronLeft className="size-4" />
                </DayArrow>
              )}
              <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                <PopoverTrigger
                  render={
                    <button
                      type="button"
                      className={cn(
                        "flex h-8 items-center gap-1.5 rounded-full px-3 text-sm font-medium outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50",
                        date
                          ? "text-primary capitalize dark:text-violet-300"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      )}
                    />
                  }
                >
                  <CalendarIcon className="size-4" aria-hidden />
                  {date ? formatDateLocal(dateFromLocal(date)) : "Escolher data"}
                </PopoverTrigger>
                <PopoverContent align="start" className="w-auto p-0">
                  <Calendar
                    mode="single"
                    locale={ptBR}
                    selected={dateFromLocal(date ?? today)}
                    defaultMonth={dateFromLocal(date ?? today)}
                    onSelect={(picked) => {
                      if (!picked) return;
                      setCalendarOpen(false);
                      push({ date: localFromDate(picked) });
                    }}
                  />
                </PopoverContent>
              </Popover>
              {date && (
                <>
                  <DayArrow label="Próximo dia" onClick={() => push({ date: addLocalDays(date, 1) })}>
                    <ChevronRight className="size-4" />
                  </DayArrow>
                  <DayArrow label="Tirar a data escolhida" onClick={() => push({ date: null })}>
                    <X className="size-3.5" />
                  </DayArrow>
                </>
              )}
            </div>
          </div>
        </FilterGroup>

        <FilterGroup label="Status">
          <Select
            value={status}
            onValueChange={(value) => push({ status: value as BookingStatusFilter })}
          >
            <SelectTrigger className="h-9 min-w-40" aria-label="Status">
              {/* O rótulo é derivado do valor em vez de deixado a cargo do
                  `Select.Value` padrão: assim o gatilho já sai renderizado com
                  o texto certo do servidor, sem um instante em branco até a
                  hidratação. Vale para os dois seletores. */}
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
        </FilterGroup>

        <FilterGroup label="Serviço">
          <Select value={serviceId} onValueChange={(value) => push({ serviceId: value as string })}>
            <SelectTrigger className="h-9 min-w-44" aria-label="Serviço">
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
        </FilterGroup>

        {hasFilters && (
          <Button
            variant="ghost"
            size="sm"
            className="h-9"
            onClick={() =>
              push({
                period: DEFAULT_BOOKING_PERIOD,
                date: null,
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

function FilterGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div role="group" aria-label={label} className="flex flex-col gap-2">
      <span className="section-label">{label}</span>
      {children}
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "h-8 rounded-full border px-3 text-sm font-medium whitespace-nowrap outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50",
        active
          ? "border-foreground bg-foreground text-background"
          : "border-border text-muted-foreground hover:border-input hover:text-foreground"
      )}
    >
      {children}
    </button>
  );
}

function DayArrow({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="flex size-8 items-center justify-center rounded-full text-primary outline-none transition-colors hover:bg-primary/10 focus-visible:ring-3 focus-visible:ring-ring/50 dark:text-violet-300"
    >
      {children}
    </button>
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
