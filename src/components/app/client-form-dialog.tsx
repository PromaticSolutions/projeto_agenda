"use client";

import { useActionState, useState } from "react";
import { Pencil, Plus } from "lucide-react";
import { toast } from "sonner";
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
import { PhoneInput } from "@/components/ui/phone-input";
import {
  createClientAction,
  updateClientAction,
  type ClientFormState,
} from "@/app/app/(dashboard)/clients/actions";
import type { Client } from "@/lib/types";

/**
 * Cadastro manual de cliente (item 3). O cadastro é OPCIONAL: quem agenda sem
 * passar por aqui continua sendo registrado automaticamente a partir do
 * agendamento — ver `upsertClientFromBooking`.
 */
export function ClientFormDialog({ client }: { client?: Client }) {
  const isEdit = Boolean(client);
  const action = isEdit ? updateClientAction.bind(null, client!.id) : createClientAction;
  const [state, formAction, pending] = useActionState<ClientFormState, FormData>(action, null);
  const [open, setOpen] = useState(false);

  const [lastState, setLastState] = useState(state);
  if (state !== lastState) {
    setLastState(state);
    if (state?.ok) {
      setOpen(false);
      toast.success(isEdit ? "Cadastro atualizado" : "Cliente cadastrada");
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button
            variant={isEdit ? "ghost" : "default"}
            size={isEdit ? "icon-sm" : "default"}
            className={isEdit ? "" : "gap-1.5 bg-cta text-white hover:opacity-90"}
          />
        }
      >
        {isEdit ? (
          <Pencil className="size-4" />
        ) : (
          <>
            <Plus className="size-4" /> Nova cliente
          </>
        )}
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar cadastro" : "Nova cliente"}</DialogTitle>
          <DialogDescription>
            Só nome e telefone. O histórico se monta sozinho a partir dos agendamentos.
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="client-name">Nome</Label>
            <Input
              id="client-name"
              name="name"
              required
              defaultValue={client?.name}
              placeholder="Nome completo"
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="client-phone">Telefone (WhatsApp)</Label>
            <PhoneInput
              id="client-phone"
              name="phone"
              required
              defaultValue={client?.phone.replace(/^55/, "")}
            />
          </div>

          {state && !state.ok && <p className="text-sm text-destructive">{state.error}</p>}

          <DialogFooter>
            <Button type="submit" disabled={pending} className="bg-cta text-white hover:opacity-90">
              {pending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
