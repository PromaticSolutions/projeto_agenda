"use client";

import { useState, useTransition } from "react";
import { Switch } from "@/components/ui/switch";
import { toggleAgentAction } from "@/app/superadmin/agente/actions";

/** Liga e desliga o agente de um estúdio, com o motivo visível quando recusa. */
export function AgentToggle({
  studioId,
  enabled,
  label,
}: {
  studioId: string;
  enabled: boolean;
  label?: string;
}) {
  const [checked, setChecked] = useState(enabled);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex flex-col gap-1">
      <label className="flex items-center gap-2 text-sm text-foreground">
        <Switch
          checked={checked}
          disabled={pending}
          onCheckedChange={(next: boolean) => {
            setError(null);
            setChecked(next);
            startTransition(async () => {
              const result = await toggleAgentAction(studioId, next);
              if (!result.ok) {
                setChecked(!next);
                setError(result.error);
              }
            });
          }}
        />
        {label ?? (checked ? "Ligado" : "Desligado")}
      </label>
      {error && <span className="max-w-56 text-xs text-destructive">{error}</span>}
    </div>
  );
}
