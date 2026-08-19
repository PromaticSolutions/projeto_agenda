"use client";

import { useActionState, useState } from "react";
import { Pencil, Plus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  createServiceAction,
  updateServiceAction,
  type ServiceActionState,
} from "@/app/app/(dashboard)/services/actions";
import { centsToReaisInput } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Service } from "@/lib/types";

const PRESET_COLORS = ["#7C3AED", "#8B5CF6", "#E23FA0", "#A93CC9", "#25D366", "#241238"];

export function ServiceFormDialog({ service }: { service?: Service }) {
  const isEdit = Boolean(service);
  const action = isEdit ? updateServiceAction.bind(null, service!.id) : createServiceAction;
  const [state, formAction, pending] = useActionState<ServiceActionState, FormData>(
    action,
    null
  );
  const [open, setOpen] = useState(false);
  const [color, setColor] = useState(service?.color ?? "#7C3AED");

  // Fecha o diálogo quando a Server Action termina com sucesso. Ajuste de
  // estado durante a renderização (em vez de useEffect) para não disparar
  // um render em cascata — padrão recomendado pelo React para "reagir" a
  // uma prop/state que mudou.
  const [lastState, setLastState] = useState(state);
  if (state !== lastState) {
    setLastState(state);
    if (state?.ok) setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant={isEdit ? "ghost" : "default"} size={isEdit ? "icon-sm" : "default"} className={isEdit ? "" : "bg-cta text-white hover:opacity-90 gap-1.5"} />
        }
      >
        {isEdit ? (
          <Pencil className="size-4" />
        ) : (
          <>
            <Plus className="size-4" /> Novo serviço
          </>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar serviço" : "Novo serviço"}</DialogTitle>
          <DialogDescription>
            Nome, preço, duração e cor aparecem para o cliente na página pública.
            As observações ficam só para você.
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="name">Nome</Label>
            <Input id="name" name="name" required defaultValue={service?.name} placeholder="Design de Sobrancelhas" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="price_reais">Preço (R$)</Label>
              <Input
                id="price_reais"
                name="price_reais"
                required
                inputMode="decimal"
                defaultValue={service ? centsToReaisInput(service.price_cents) : ""}
                placeholder="60,00"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="duration_min">Duração (min)</Label>
              <Input
                id="duration_min"
                name="duration_min"
                type="number"
                min={5}
                step={5}
                required
                defaultValue={service?.duration_min ?? 30}
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="color">Cor</Label>
            <div className="flex items-center gap-3 rounded-xl border border-input px-2.5 py-2">
              <div className="relative size-8 shrink-0 overflow-hidden rounded-full ring-1 ring-plum-900/10">
                <Input
                  id="color"
                  name="color"
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="size-12 -translate-x-2 -translate-y-2 cursor-pointer border-0 p-0"
                />
              </div>
              <div className="flex gap-1.5">
                {PRESET_COLORS.map((preset) => {
                  const selected = preset.toLowerCase() === color.toLowerCase();
                  return (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setColor(preset)}
                      className={cn(
                        "size-6 rounded-full ring-offset-2 ring-offset-background transition-shadow",
                        selected ? "ring-2 ring-plum-900" : "ring-1 ring-border hover:ring-plum-900/30"
                      )}
                      style={{ backgroundColor: preset }}
                      aria-label={preset}
                    />
                  );
                })}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between rounded-xl bg-muted/40 px-3.5 py-2.5">
            <Label htmlFor="active" className="cursor-pointer">
              Serviço ativo (visível na página pública)
            </Label>
            <Switch id="active" name="active" defaultChecked={service?.active ?? true} />
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-baseline justify-between gap-2">
              <Label htmlFor="notes">Observações</Label>
              <span className="text-xs text-muted-foreground">Opcional</span>
            </div>
            <Textarea
              id="notes"
              name="notes"
              rows={3}
              maxLength={2000}
              defaultValue={service?.notes ?? ""}
              placeholder="Preparo, contraindicações, material necessário..."
            />
            <p className="text-xs text-muted-foreground">
              Uso interno. Não aparece na página pública.
            </p>
          </div>

          {state && !state.ok && <p className="text-sm text-destructive">{state.error}</p>}

          <DialogFooter>
            <Button type="submit" className="bg-cta text-white hover:opacity-90" disabled={pending}>
              {pending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
