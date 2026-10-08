"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { Label } from "@/components/ui/label";

export interface AttendantOption {
  id: string;
  name: string;
}

/**
 * Filtro "todas / uma atendente", na URL.
 *
 * Na URL e não em estado local para que o link seja compartilhável e o botão
 * voltar funcione — mesmo critério da barra de filtros de Agendamentos.
 *
 * Ele é CONVENIÊNCIA DE LEITURA, não barreira: um id de outro salão digitado
 * na URL é descartado no servidor (`narrowToAttendant`) e, mesmo que não
 * fosse, a RLS da 0024 devolveria vazio. A tela nunca é a defesa.
 */
export function AttendantFilter({
  attendants,
  paramName = "atendente",
}: {
  attendants: AttendantOption[];
  paramName?: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  const current = searchParams.get(paramName) ?? "todas";

  function handleChange(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === "todas") params.delete(paramName);
    else params.set(paramName, value);

    const query = params.toString();
    startTransition(() => {
      router.push(query ? `?${query}` : "?", { scroll: false });
    });
  }

  return (
    <div className="flex items-center gap-2">
      <Label htmlFor="attendant-filter" className="text-sm text-muted-foreground">
        Atendente
      </Label>
      <select
        id="attendant-filter"
        value={current}
        disabled={pending}
        onChange={(event) => handleChange(event.target.value)}
        className="h-9 rounded-md border border-border bg-background px-2 text-sm text-foreground"
      >
        <option value="todas">Todas</option>
        {attendants.map((attendant) => (
          <option key={attendant.id} value={attendant.id}>
            {attendant.name}
          </option>
        ))}
      </select>
    </div>
  );
}
