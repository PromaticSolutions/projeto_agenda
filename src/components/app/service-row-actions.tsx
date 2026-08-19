"use client";

import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { ServiceFormDialog } from "@/components/app/service-form-dialog";
import { deleteServiceAction, toggleServiceActiveAction } from "@/app/app/(dashboard)/services/actions";
import type { Service } from "@/lib/types";

export function ServiceRowActions({ service }: { service: Service }) {
  const [pending, startTransition] = useTransition();
  const [active, setActive] = useState(service.active);

  function handleToggle(checked: boolean) {
    setActive(checked);
    startTransition(async () => {
      const result = await toggleServiceActiveAction(service.id, checked);
      if (!result.ok) {
        setActive(!checked); // desfaz o otimismo se o servidor recusou
        toast.error(result.error);
      }
    });
  }

  function handleDelete() {
    if (!confirm(`Excluir "${service.name}"?`)) return;
    startTransition(async () => {
      const result = await deleteServiceAction(service.id);

      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      // Serviço já agendado não pode ser apagado (FK on delete restrict), então
      // é arquivado. Dizer só "excluído" esconderia isso do dono.
      if (result.mode === "archived") {
        toast.success("Serviço arquivado", {
          description: "Ele tem agendamentos no histórico, então saiu das listas mas foi preservado.",
        });
      } else {
        toast.success("Serviço excluído");
      }
    });
  }

  return (
    <div className="flex items-center gap-2">
      <Switch checked={active} onCheckedChange={handleToggle} disabled={pending} aria-label="Ativo" />
      <ServiceFormDialog service={service} />
      <Button variant="ghost" size="icon-sm" onClick={handleDelete} disabled={pending} aria-label="Excluir serviço">
        <Trash2 className="size-4 text-destructive" />
      </Button>
    </div>
  );
}
