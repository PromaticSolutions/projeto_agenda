"use client";

import { useActionState } from "react";
import { Loader2, LogIn } from "lucide-react";
import { enterStudioAccountAction, type EnterAccountState } from "@/app/superadmin/actions";
import { cn } from "@/lib/utils";

/**
 * Botão "Entrar na conta" do superadmin.
 *
 * `compact` é a versão de ícone da tabela de clientes; a ficha usa a versão
 * com texto. O erro aparece ao lado do botão porque a action não navega
 * quando falha.
 */
export function EnterAccountButton({
  studioId,
  studioName,
  compact = false,
}: {
  studioId: string;
  studioName: string;
  compact?: boolean;
}) {
  const [state, action, pending] = useActionState<EnterAccountState, FormData>(
    enterStudioAccountAction,
    null
  );

  return (
    <form action={action} className="flex items-center gap-2">
      <input type="hidden" name="studio_id" value={studioId} />
      {state && !state.ok && <span className="text-xs text-destructive">{state.error}</span>}
      <button
        type="submit"
        disabled={pending}
        title={`Entrar na conta de ${studioName}`}
        className={cn(
          "flex items-center gap-1.5 rounded-md text-sm transition-colors disabled:opacity-60",
          compact
            ? "p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
            : "border border-border px-3 py-1.5 font-medium text-foreground hover:bg-muted"
        )}
      >
        {pending ? (
          <Loader2 className={compact ? "size-3.5 animate-spin" : "size-4 animate-spin"} />
        ) : (
          <LogIn className={compact ? "size-3.5" : "size-4"} />
        )}
        {compact ? <span className="sr-only">Entrar na conta de {studioName}</span> : "Entrar na conta"}
      </button>
    </form>
  );
}
