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
import { formatMonthShort } from "@/lib/billing";
import { DEFAULT_INVOICE_FILTER, INVOICE_FILTERS, type InvoiceFilter } from "@/lib/superadmin-filters";

const ALL_MONTHS = "todos";

/**
 * Filtros do faturamento. Uma linha só, acima de tudo que ela recorta — a
 * regra de dashboard que impede o painel de virar cinco gráficos discordando
 * entre si, cada um com seu próprio período.
 */
export function InvoicesToolbar({
  filter,
  month,
  query,
  months,
}: {
  filter: InvoiceFilter;
  month: string | undefined;
  query: string;
  /** Meses oferecidos, do mais recente para o mais antigo ("2026-08"). */
  months: string[];
}) {
  const router = useRouter();
  const [text, setText] = useState(query);
  const [lastQuery, setLastQuery] = useState(query);
  if (query !== lastQuery) {
    setLastQuery(query);
    setText(query);
  }

  function push(patch: { filter?: InvoiceFilter; month?: string | undefined; query?: string }) {
    const next = { filter, month, query, ...patch };
    const params = new URLSearchParams();
    if (next.filter !== DEFAULT_INVOICE_FILTER) params.set("situacao", next.filter);
    if (next.month) params.set("mes", next.month);
    if (next.query.trim()) params.set("q", next.query.trim());
    const qs = params.toString();
    router.push(qs ? `/superadmin/billing?${qs}` : "/superadmin/billing");
  }

  const hasFilters = filter !== DEFAULT_INVOICE_FILTER || Boolean(month) || query.trim() !== "";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <form
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          push({ query: text });
        }}
        className="relative min-w-52 flex-1"
      >
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Buscar por estúdio ou número da fatura"
          aria-label="Buscar faturas"
          className="pl-9"
        />
        <button type="submit" className="sr-only">
          Buscar
        </button>
      </form>

      <Select value={filter} onValueChange={(value) => push({ filter: value as InvoiceFilter })}>
        <SelectTrigger className="min-w-40" aria-label="Situação da fatura">
          <SelectValue>{(value) => INVOICE_FILTERS.find((f) => f.value === value)?.label}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {INVOICE_FILTERS.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={month ?? ALL_MONTHS}
        onValueChange={(value) => push({ month: value === ALL_MONTHS ? undefined : (value as string) })}
      >
        <SelectTrigger className="min-w-36" aria-label="Mês de emissão">
          <SelectValue>
            {(value) => (value === ALL_MONTHS ? "Todo o período" : formatMonthShort(value as string))}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL_MONTHS}>Todo o período</SelectItem>
          {months.map((option) => (
            <SelectItem key={option} value={option}>
              {formatMonthShort(option)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {hasFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => push({ filter: DEFAULT_INVOICE_FILTER, month: undefined, query: "" })}
        >
          <X className="size-4" /> Limpar
        </Button>
      )}
    </div>
  );
}
