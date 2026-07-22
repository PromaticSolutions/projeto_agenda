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
      await toggleServiceActiveAction(service.id, checked);
    });
  }

  function handleDelete() {
    if (!confirm(`Excluir "${service.name}"? Essa ação não pode ser desfeita.`)) return;
    startTransition(async () => {
      await deleteServiceAction(service.id);
      toast.success("Serviço excluído");
    });
  }

  return (
    <div className="flex items-center gap-2">
      <Switch checked={active} onCheckedChange={handleToggle} disabled={pending} aria-label="Ativo" />
      <ServiceFormDialog service={service} />
      <Button variant="ghost" size="icon-sm" onClick={handleDelete} disabled={pending}>
        <Trash2 className="size-4 text-destructive" />
      </Button>
    </div>
  );
}
