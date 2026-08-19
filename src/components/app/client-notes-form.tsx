"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { updateClientNotesAction, type ClientActionState } from "@/app/app/(dashboard)/clients/actions";

export function ClientNotesForm({ clientId, notes }: { clientId: string; notes: string | null }) {
  const [state, formAction, pending] = useActionState<ClientActionState, FormData>(
    updateClientNotesAction.bind(null, clientId),
    null
  );

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <Textarea
        name="notes"
        defaultValue={notes ?? ""}
        placeholder="Preferências, alergias, observações sobre este cliente..."
        className="min-h-28"
      />
      {state && !state.ok && <p className="text-sm text-destructive">{state.error}</p>}
      {state?.ok && <p className="text-sm text-wa">Notas salvas.</p>}
      <Button type="submit" size="sm" className="w-fit bg-cta text-white hover:opacity-90" disabled={pending}>
        {pending ? "Salvando..." : "Salvar notas"}
      </Button>
    </form>
  );
}
