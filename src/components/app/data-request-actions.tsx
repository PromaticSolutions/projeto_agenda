"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { resolveDataRequestAction } from "@/app/app/(dashboard)/privacidade/actions";
import type { DataRequestStatus } from "@/lib/types";

/**
 * Controles de uma solicitação do titular.
 *
 * A anotação é OBRIGATÓRIA para recusar e opcional para concluir: recusa sem
 * justificativa não atende o art. 18, § 4º, que exige resposta fundamentada.
 * Concluir sem nota é aceitável — muitas vezes a ação foi só apagar o cadastro.
 */
export function DataRequestActions({
  id,
  status,
}: {
  id: string;
  status: DataRequestStatus;
}) {
  const [note, setNote] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function resolver(next: DataRequestStatus) {
    if (next === "recusada" && !note.trim()) {
      setErro("Para recusar, explique o motivo — a lei exige resposta fundamentada.");
      return;
    }
    setErro(null);
    startTransition(async () => {
      await resolveDataRequestAction(id, next, note);
    });
  }

  return (
    <div className="mt-4 border-t border-border pt-3">
      <Input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        maxLength={500}
        placeholder="O que foi feito (ou por que não pôde ser feito)"
        className="text-sm"
      />
      {erro && <p className="mt-2 text-xs text-destructive">{erro}</p>}
      <div className="mt-2 flex flex-wrap gap-2">
        {status === "aberta" && (
          <Button
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() => resolver("em_andamento")}
          >
            Estou cuidando
          </Button>
        )}
        <Button size="sm" disabled={pending} onClick={() => resolver("concluida")}>
          Marcar como concluída
        </Button>
        <Button
          size="sm"
          variant="ghost"
          disabled={pending}
          onClick={() => resolver("recusada")}
        >
          Recusar
        </Button>
      </div>
    </div>
  );
}
