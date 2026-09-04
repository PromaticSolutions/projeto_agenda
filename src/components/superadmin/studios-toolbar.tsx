"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Search, X } from "lucide-react";
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
  DEFAULT_STUDIO_FILTER,
  DEFAULT_STUDIO_SORT,
  STUDIO_FILTERS,
  STUDIO_SORTS,
  type StudioFilter,
  type StudioSort,
} from "@/lib/superadmin-filters";

/**
 * Filtros da lista de clientes. Estado na URL (não em `useState`) pelos mesmos
 * motivos do módulo de agendamentos: "meus inadimplentes" fica favoritável, o
 * botão voltar funciona, e a página segue Server Component lendo
 * `searchParams` — nada é rebuscado no cliente.
 */
export function StudiosToolbar({
  filter,
  sort,
  query,
  total,
  shown,
}: {
  filter: StudioFilter;
  sort: StudioSort;
  query: string;
  total: number;
  shown: number;
}) {
  const router = useRouter();
  const [text, setText] = useState(query);
  const [lastQuery, setLastQuery] = useState(query);
  if (query !== lastQuery) {
    setLastQuery(query);
    setText(query);
  }

  function push(patch: { filter?: StudioFilter; sort?: StudioSort; query?: string }) {
    const next = { filter, sort, query, ...patch };
    const params = new URLSearchParams();
    if (next.filter !== DEFAULT_STUDIO_FILTER) params.set("filtro", next.filter);
    if (next.sort !== DEFAULT_STUDIO_SORT) params.set("ordem", next.sort);
    if (next.query.trim()) params.set("q", next.query.trim());
    const qs = params.toString();
    router.push(qs ? `/superadmin/studios?${qs}` : "/superadmin/studios");
  }

  const hasFilters =
    filter !== DEFAULT_STUDIO_FILTER || sort !== DEFAULT_STUDIO_SORT || query.trim() !== "";

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <form
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            push({ query: text });
          }}
          className="relative min-w-56 flex-1"
        >
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Buscar por estúdio, slug, dona ou WhatsApp"
            aria-label="Buscar clientes"
            className="pl-9"
          />
          <button type="submit" className="sr-only">
            Buscar
          </button>
        </form>

        <Select value={filter} onValueChange={(value) => push({ filter: value as StudioFilter })}>
          <SelectTrigger className="min-w-44" aria-label="Recorte">
            <SelectValue>
              {(value) => STUDIO_FILTERS.find((f) => f.value === value)?.label}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {STUDIO_FILTERS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={sort} onValueChange={(value) => push({ sort: value as StudioSort })}>
          <SelectTrigger className="min-w-48" aria-label="Ordenar por">
            <SelectValue>{(value) => STUDIO_SORTS.find((s) => s.value === value)?.label}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {STUDIO_SORTS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {hasFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => push({ filter: DEFAULT_STUDIO_FILTER, sort: DEFAULT_STUDIO_SORT, query: "" })}
          >
            <X className="size-4" /> Limpar
          </Button>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        {shown === total
          ? `${total} ${total === 1 ? "cliente" : "clientes"}`
          : `${shown} de ${total} clientes`}
      </p>
    </div>
  );
}
