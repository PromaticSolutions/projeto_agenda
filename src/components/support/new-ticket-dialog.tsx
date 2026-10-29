"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createTicketAction } from "@/app/app/(dashboard)/suporte/actions";
import { BODY_MAX, CATEGORY_LABEL, CATEGORY_ORDER, SUBJECT_MAX } from "@/lib/support";
import { cn } from "@/lib/utils";
import type { SupportTicketCategory } from "@/lib/types";

/**
 * "Abrir chamado": três perguntas — sobre o quê, um título, o que aconteceu.
 * O tipo é escolha por botão, não select: são quatro opções e ver todas de
 * uma vez ajuda quem não sabe se o problema é "dúvida" ou "algo não funciona".
 */
export function NewTicketDialog({ label = "Abrir chamado" }: { label?: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<SupportTicketCategory>("problema");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function reset() {
    setCategory("problema");
    setSubject("");
    setBody("");
    setError(null);
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await createTicketAction({ category, subject, body });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setOpen(false);
      reset();
      toast.success("Chamado aberto. Avisamos aqui quando a equipe responder.");
      router.push(`/app/suporte/${result.id}`);
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger render={<Button />}>
        <Plus className="size-4" aria-hidden /> {label}
      </DialogTrigger>

      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Abrir chamado</DialogTitle>
          <DialogDescription>
            Conte o que aconteceu. A equipe responde por aqui mesmo.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="flex flex-col gap-4">
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-sm font-medium text-foreground">Sobre o quê?</legend>
            <div className="grid grid-cols-2 gap-2">
              {CATEGORY_ORDER.map((value) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={category === value}
                  onClick={() => setCategory(value)}
                  className={cn(
                    "rounded-lg border px-3 py-2 text-left text-sm transition-colors",
                    category === value
                      ? "border-primary bg-primary/5 font-medium text-foreground"
                      : "border-border text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  {CATEGORY_LABEL[value]}
                </button>
              ))}
            </div>
          </fieldset>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ticket-subject">Título</Label>
            <Input
              id="ticket-subject"
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
              maxLength={SUBJECT_MAX}
              placeholder="Ex.: Lembrete não chegou para a cliente"
              autoFocus
              required
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ticket-body">O que aconteceu?</Label>
            <Textarea
              id="ticket-body"
              value={body}
              onChange={(event) => setBody(event.target.value)}
              maxLength={BODY_MAX}
              rows={5}
              placeholder="O que você fez, o que esperava e o que apareceu. Se tiver, diga o dia e o horário."
              required
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
              Cancelar
            </Button>
            <Button type="submit" disabled={pending || !subject.trim() || !body.trim()}>
              {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
              Enviar chamado
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
