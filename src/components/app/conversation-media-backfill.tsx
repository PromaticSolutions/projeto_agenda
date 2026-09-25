"use client";

import { useEffect, useSyncExternalStore } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { backfillConversationMediaAction } from "@/app/app/(dashboard)/conversations/actions";

/**
 * Recupera sozinha as fotos e áudios antigos das conversas (0022).
 *
 * Roda ao abrir Conversas, em lotes, enquanto a tela estiver aberta: cada lote
 * baixa alguns arquivos do WhatsApp e guarda no app. Não há botão porque não
 * há decisão a tomar — o dono quer ver as fotos, e o trabalho é o mesmo que o
 * balão faria ao aparecer, só adiantado para todas as conversas.
 *
 * Uma vez por carregamento de página (`started` de módulo): trocar de conversa
 * remonta o cabeçalho, e sem isto cada clique recomeçaria a varredura.
 */

/** O snapshot do servidor: nada rodou durante a renderização lá. */
const IDLE = { kind: "idle" } as const;

type State =
  | { kind: "idle" }
  | { kind: "running"; remaining: number; saved: number }
  | { kind: "done"; saved: number; unavailable: number };

/* Estado de MÓDULO: a varredura continua quando o cabeçalho remonta (trocar
   de conversa remonta), e o cabeçalho novo mostra o mesmo progresso. */
let started = false;
let current: State = { kind: "idle" };
const listeners = new Set<() => void>();

function publish(next: State) {
  current = next;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

async function run() {
  let cursor: string | null = null;
  let saved = 0;
  let unavailable = 0;
  // Teto de rodadas: com 12 por lote cobre milhares de arquivos, e evita um
  // laço sem fim se o servidor passar a responder algo inesperado.
  for (let round = 0; round < 400; round++) {
    let result;
    try {
      result = await backfillConversationMediaAction(cursor);
    } catch {
      // Falha de rede ou do servidor: para aqui; a próxima visita continua.
      break;
    }
    if (result.blocked) break;
    saved += result.saved;
    unavailable += result.unavailable;
    if (result.nextCursor === null) {
      publish(saved + unavailable > 0 ? { kind: "done", saved, unavailable } : { kind: "idle" });
      return;
    }
    publish({ kind: "running", remaining: result.remaining, saved });
    cursor = result.nextCursor;
  }
  publish(saved + unavailable > 0 ? { kind: "done", saved, unavailable } : { kind: "idle" });
}

export function ConversationMediaBackfill() {
  const state = useSyncExternalStore(
    subscribe,
    () => current,
    () => IDLE
  );

  useEffect(() => {
    if (started) return;
    started = true;
    void run();
  }, []);

  if (state.kind === "idle") return null;

  if (state.kind === "running") {
    return (
      <p
        role="status"
        className="flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground"
      >
        <Loader2 className="size-3.5 animate-spin" aria-hidden />
        Recuperando fotos e áudios antigos · faltam {state.remaining}
      </p>
    );
  }

  return (
    <p
      role="status"
      className="flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground"
    >
      <CheckCircle2 className="size-3.5 text-emerald-600" aria-hidden />
      {state.saved} {state.saved === 1 ? "arquivo recuperado" : "arquivos recuperados"}
      {state.unavailable > 0 && ` · ${state.unavailable} não estão mais no WhatsApp`}
    </p>
  );
}
