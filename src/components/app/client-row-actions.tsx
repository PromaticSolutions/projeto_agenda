"use client";

import { useTransition } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ClientFormDialog } from "@/components/app/client-form-dialog";
import { deleteClientAction } from "@/app/app/(dashboard)/clients/actions";
import type { Client } from "@/lib/types";

export function ClientRowActions({ client }: { client: Client }) {
  const [pending, startTransition] = useTransition();

  function handleDelete() {
    if (
      !confirm(
        `Excluir o cadastro de "${client.name}"? Os agendamentos dela continuam na agenda.`
      )
    )
      return;

    startTransition(async () => {
      const result = await deleteClientAction(client.id);
      if (result.ok) toast.success("Cadastro excluído");
      else toast.error(result.error);
    });
  }

  return (
    <div className="flex items-center justify-end gap-1">
      <ClientFormDialog client={client} />
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={handleDelete}
        disabled={pending}
        aria-label="Excluir cadastro"
      >
        <Trash2 className="size-4 text-destructive" />
      </Button>
    </div>
  );
}
