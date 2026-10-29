"use client";

import { useRef, useState, useTransition, type FormEvent } from "react";
import { Loader2, RotateCcw, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { simulateAgentAction } from "@/app/superadmin/agente/actions";
import { cn } from "@/lib/utils";

interface Bubble {
  role: "user" | "assistant";
  content: string;
  meta?: string;
}

/**
 * Conversa de teste com o agente, sem WhatsApp no meio.
 *
 * Usa a configuração SALVA e os dados reais do estúdio (serviços, horários
 * livres). "Marcar" só confere se o horário está livre — nada é gravado.
 */
export function AgentSimulator({ studioId }: { studioId: string }) {
  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const endRef = useRef<HTMLDivElement>(null);

  function send(e: FormEvent) {
    e.preventDefault();
    const content = text.trim();
    if (!content || pending) return;
    const next = [...bubbles, { role: "user" as const, content }];
    setBubbles(next);
    setText("");
    setError(null);
    startTransition(async () => {
      const result = await simulateAgentAction(
        studioId,
        next.map(({ role, content: c }) => ({ role, content: c }))
      );
      if (!result.ok) {
        setError(result.error);
        return;
      }
      const meta = [
        `${result.seconds}s`,
        result.toolsUsed.length > 0 ? `usou: ${result.toolsUsed.join(", ")}` : null,
        result.handoff ? `passou para a equipe: ${result.handoff}` : null,
      ]
        .filter(Boolean)
        .join(" · ");
      setBubbles((current) => [...current, { role: "assistant", content: result.reply, meta }]);
      requestAnimationFrame(() => endRef.current?.scrollIntoView({ block: "nearest" }));
    });
  }

  return (
    <section className="panel flex flex-col gap-4 p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-medium text-foreground">Testar o agente</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Escreva como se fosse uma cliente. Usa a configuração salva e os horários reais; nada
            sai pelo WhatsApp e nenhum horário é marcado.
          </p>
        </div>
        {bubbles.length > 0 && (
          <Button type="button" variant="ghost" size="sm" onClick={() => setBubbles([])} disabled={pending}>
            <RotateCcw className="size-4" /> Recomeçar
          </Button>
        )}
      </div>

      <div className="flex max-h-[28rem] min-h-40 flex-col gap-2 overflow-y-auto rounded-lg border border-border bg-muted/30 p-3">
        {bubbles.length === 0 && (
          <p className="m-auto text-center text-sm text-muted-foreground">
            Ex.: “Oi, quanto custa a manicure? Tem horário amanhã à tarde?”
          </p>
        )}
        {bubbles.map((bubble, i) => (
          <div
            key={i}
            className={cn("flex max-w-[85%] flex-col gap-0.5", bubble.role === "user" ? "self-end items-end" : "self-start")}
          >
            <p
              className={cn(
                "whitespace-pre-wrap rounded-lg px-3 py-2 text-sm",
                bubble.role === "user" ? "bg-primary text-primary-foreground" : "border border-border bg-background text-foreground"
              )}
            >
              {bubble.content}
            </p>
            {bubble.meta && <span className="text-[11px] text-muted-foreground">{bubble.meta}</span>}
          </div>
        ))}
        {pending && (
          <p className="flex items-center gap-2 self-start text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> pensando…
          </p>
        )}
        <div ref={endRef} />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <form onSubmit={send} className="flex gap-2">
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Mensagem da cliente"
          aria-label="Mensagem da cliente"
          className="h-10"
          disabled={pending}
        />
        <Button type="submit" disabled={pending || !text.trim()} className="h-10">
          <Send className="size-4" /> Enviar
        </Button>
      </form>
    </section>
  );
}
