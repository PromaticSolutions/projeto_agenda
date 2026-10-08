"use client";

import { useTransition } from "react";
import { LinkIcon, Power, PowerOff } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { AttendantFormDialog } from "@/components/app/attendant-form-dialog";
import {
  detachAttendantAction,
  setAttendantActiveAction,
} from "@/app/app/gerencia/atendentes/actions";
import { attendantStatus } from "@/lib/access";
import type { Studio } from "@/lib/types";

export function AttendantRowActions({ attendant }: { attendant: Studio }) {
  const [pending, startTransition] = useTransition();
  const inactive = attendantStatus(attendant) === "inativa";

  function handleToggleActive() {
    const message = inactive
      ? `Reativar "${attendant.name}"? A página pública dela volta ao ar.`
      : `Desativar "${attendant.name}"? A página pública sai do ar e ninguém marca horário com ela. O login e o histórico dela não mudam.`;
    if (!confirm(message)) return;

    startTransition(async () => {
      const result = await setAttendantActiveAction(attendant.id, inactive);
      if (result?.ok) toast.success(inactive ? "Atendente reativada" : "Atendente desativada");
      else toast.error(result?.error ?? "Não foi possível concluir.");
    });
  }

  function handleDetach() {
    if (
      !confirm(
        `Remover "${attendant.name}" do salão? Ela continua com o acesso, a agenda e as clientes dela — só deixa de aparecer aqui. Dá para vinculá-la de novo depois.`
      )
    )
      return;

    startTransition(async () => {
      const result = await detachAttendantAction(attendant.id);
      if (result?.ok) toast.success("Atendente removida do salão");
      else toast.error(result?.error ?? "Não foi possível concluir.");
    });
  }

  return (
    <div className="flex items-center justify-end gap-1">
      <AttendantFormDialog attendant={attendant} />
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={handleToggleActive}
        disabled={pending}
        aria-label={inactive ? "Reativar atendente" : "Desativar atendente"}
        title={inactive ? "Reativar" : "Desativar"}
      >
        {inactive ? <Power className="size-4" /> : <PowerOff className="size-4" />}
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={handleDetach}
        disabled={pending}
        aria-label="Remover do salão"
        title="Remover do salão"
      >
        <LinkIcon className="size-4 text-destructive" />
      </Button>
    </div>
  );
}
