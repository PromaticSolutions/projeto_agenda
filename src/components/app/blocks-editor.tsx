"use client";

import { useActionState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  addBlockAction,
  removeBlockAction,
  type HoursActionState,
} from "@/app/app/(dashboard)/hours/actions";
import { formatFullDateLocal, formatTimeLocal } from "@/lib/format";
import type { Block } from "@/lib/types";

function RemoveBlockButton({ id }: { id: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      disabled={pending}
      onClick={() => startTransition(() => removeBlockAction(id))}
    >
      <Trash2 className="size-4 text-destructive" />
    </Button>
  );
}

export function BlocksEditor({ blocks }: { blocks: Block[] }) {
  const [state, formAction, pending] = useActionState<HoursActionState, FormData>(
    addBlockAction,
    null
  );

  const sorted = [...blocks].sort((a, b) => a.start_at.localeCompare(b.start_at));

  return (
    <div className="flex flex-col gap-4">
      <form action={formAction} className="flex flex-wrap items-end gap-2 rounded-lg border border-border p-3">
        <div className="flex flex-col gap-1">
          <Label htmlFor="block-date" className="text-xs">Data</Label>
          <Input id="block-date" type="date" name="date" required className="h-8 w-36 text-xs" />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="block-start" className="text-xs">Início</Label>
          <Input id="block-start" type="time" name="start_time" required className="h-8 w-24 text-xs" />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="block-end" className="text-xs">Fim</Label>
          <Input id="block-end" type="time" name="end_time" required className="h-8 w-24 text-xs" />
        </div>
        <div className="flex flex-1 min-w-32 flex-col gap-1">
          <Label htmlFor="block-reason" className="text-xs">Motivo (opcional)</Label>
          <Input id="block-reason" name="reason" placeholder="Almoço, folga, feriado..." className="h-8 text-xs" />
        </div>
        <Button type="submit" size="sm" disabled={pending} className="bg-cta text-white hover:opacity-90">
          {pending ? "Salvando..." : "Bloquear"}
        </Button>
        {state && !state.ok && <p className="w-full text-xs text-destructive">{state.error}</p>}
      </form>

      {sorted.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum bloqueio cadastrado.</p>
      ) : (
        <div className="flex flex-col divide-y divide-border rounded-lg border border-border">
          {sorted.map((block) => {
            const start = new Date(block.start_at);
            const end = new Date(block.end_at);
            return (
              <div key={block.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                <div className="text-sm">
                  <p className="font-medium">
                    {formatFullDateLocal(start)} · {formatTimeLocal(start)}–{formatTimeLocal(end)}
                  </p>
                  {block.reason && <p className="text-xs text-muted-foreground">{block.reason}</p>}
                </div>
                <RemoveBlockButton id={block.id} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
