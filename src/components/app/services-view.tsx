"use client";

import { useSyncExternalStore } from "react";
import { LayoutGrid, List } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ServiceRowActions } from "@/components/app/service-row-actions";
import { formatDurationMin, formatPriceCents } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Service } from "@/lib/types";

type ViewMode = "grid" | "list";
const STORAGE_KEY = "agenda:services-view";

// O localStorage é um store externo ao React, então é lido por
// `useSyncExternalStore` e não por estado + efeito: assim existe um snapshot
// de servidor explícito ("grid"), o HTML renderizado no servidor bate com o
// do cliente e a hidratação não quebra.
const listeners = new Set<() => void>();

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  // "storage" cobre a troca feita em OUTRA aba; o Set cobre esta aba.
  window.addEventListener("storage", onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
}

function getSnapshot(): ViewMode {
  return window.localStorage.getItem(STORAGE_KEY) === "list" ? "list" : "grid";
}

function getServerSnapshot(): ViewMode {
  return "grid";
}

function storeView(next: ViewMode) {
  window.localStorage.setItem(STORAGE_KEY, next);
  listeners.forEach((notify) => notify());
}

/**
 * Alterna entre cartões e lista (item 2 do escopo). A preferência fica no
 * localStorage: é decisão de exibição por dispositivo, não dado de negócio,
 * então não vale uma ida ao servidor nem um parâmetro na URL.
 */
export function ServicesView({ services }: { services: Service[] }) {
  const view = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  function changeView(next: ViewMode) {
    storeView(next);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-muted-foreground">
          {services.length} {services.length === 1 ? "serviço" : "serviços"}
        </p>

        <div className="flex items-center rounded-lg border border-border p-0.5" role="group" aria-label="Modo de exibição">
          {(
            [
              { mode: "grid" as const, Icon: LayoutGrid, label: "Cartões" },
              { mode: "list" as const, Icon: List, label: "Lista" },
            ]
          ).map(({ mode, Icon, label }) => (
            <Button
              key={mode}
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => changeView(mode)}
              aria-pressed={view === mode}
              className={cn(
                "h-7 gap-1.5 px-2.5 text-xs",
                view === mode && "bg-muted text-foreground shadow-none"
              )}
            >
              <Icon className="size-3.5" />
              {label}
            </Button>
          ))}
        </div>
      </div>

      {view === "grid" ? <GridView services={services} /> : <ListView services={services} />}
    </div>
  );
}

function GridView({ services }: { services: Service[] }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {services.map((service) => (
        <article key={service.id} className="panel card-lift flex flex-col overflow-hidden">
          <div className="h-1" style={{ backgroundColor: service.color }} />
          <div className="flex flex-1 flex-col gap-3 p-4">
            <div className="flex items-start justify-between gap-2">
              <h3 className="min-w-0 truncate font-medium text-foreground">{service.name}</h3>
              {!service.active && (
                <Badge variant="secondary" className="shrink-0">
                  Pausado
                </Badge>
              )}
            </div>

            <div className="flex items-baseline gap-2">
              <output className="text-xl font-semibold text-foreground">
                {formatPriceCents(service.price_cents)}
              </output>
              <span className="text-sm text-muted-foreground">
                · {formatDurationMin(service.duration_min)}
              </span>
            </div>

            {service.notes && (
              <p className="line-clamp-2 text-sm text-muted-foreground">{service.notes}</p>
            )}

            <div className="mt-auto flex items-center justify-end border-t border-border pt-3">
              <ServiceRowActions service={service} />
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}

function ListView({ services }: { services: Service[] }) {
  return (
    <div className="panel overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40 text-left">
              <th className="section-label px-4 py-2.5 text-muted-foreground">Serviço</th>
              <th className="section-label px-4 py-2.5 text-right text-muted-foreground">Preço</th>
              <th className="section-label px-4 py-2.5 text-right text-muted-foreground">Duração</th>
              <th className="section-label hidden px-4 py-2.5 text-muted-foreground md:table-cell">
                Observações
              </th>
              <th className="section-label px-4 py-2.5 text-right text-muted-foreground">Ações</th>
            </tr>
          </thead>
          <tbody>
            {services.map((service) => (
              <tr key={service.id} className="border-b border-border last:border-0">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <span
                      className="size-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: service.color }}
                      aria-hidden
                    />
                    <span className="font-medium text-foreground">{service.name}</span>
                    {!service.active && <Badge variant="secondary">Pausado</Badge>}
                  </div>
                </td>
                <td className="px-4 py-3 text-right font-medium">
                  {formatPriceCents(service.price_cents)}
                </td>
                <td className="px-4 py-3 text-right text-muted-foreground">
                  {formatDurationMin(service.duration_min)}
                </td>
                <td className="hidden max-w-xs truncate px-4 py-3 text-muted-foreground md:table-cell">
                  {service.notes || "—"}
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end">
                    <ServiceRowActions service={service} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
