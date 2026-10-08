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
  createAttendantAction,
  updateAttendantAction,
  type AttendantFormState,
} from "@/app/app/gerencia/atendentes/actions";
import { slugify } from "@/lib/slugify";
import type { Studio } from "@/lib/types";

/**
 * Cadastro e edição de atendente pela gerente.
 *
 * NÃO existe campo de salão, nem visível nem oculto. O vínculo é montado no
 * servidor a partir da sessão da gerente — é o que garante que ela não
 * cadastre ninguém em salão alheio, e um `<input type="hidden">` com o salão
 * seria justamente a porta que isso fecha.
 *
 * Na edição não há e-mail nem senha: credencial é da pessoa, e trocá-la por
 * aqui passaria por cima do fluxo de autenticação do Supabase.
 */
export function AttendantFormDialog({ attendant }: { attendant?: Studio }) {
  const isEdit = Boolean(attendant);
  const action = isEdit ? updateAttendantAction.bind(null, attendant!.id) : createAttendantAction;
  const [state, formAction, pending] = useActionState<AttendantFormState, FormData>(action, null);
  const [open, setOpen] = useState(false);

  const [name, setName] = useState(attendant?.name ?? "");
  const [slug, setSlug] = useState(attendant?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(isEdit);

  const [lastState, setLastState] = useState(state);
  if (state !== lastState) {
    setLastState(state);
    if (state?.ok) {
      setOpen(false);
      toast.success(isEdit ? "Cadastro atualizado" : "Atendente cadastrada");
    }
  }

  function handleName(value: string) {
    setName(value);
    // O link acompanha o nome até alguém editá-lo à mão — depois disso, para
    // de mexer sozinho, senão apaga o que a pessoa acabou de escrever.
    if (!slugTouched) setSlug(slugify(value));
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button
            variant={isEdit ? "ghost" : "default"}
            size={isEdit ? "icon-sm" : "default"}
            className={isEdit ? "" : "gap-1.5 bg-cta text-primary-foreground hover:opacity-90"}
          />
        }
      >
        {isEdit ? (
          <Pencil className="size-4" />
        ) : (
          <>
            <Plus className="size-4" /> Nova atendente
          </>
        )}
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar atendente" : "Nova atendente"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Nome e WhatsApp. E-mail e senha são da própria atendente."
              : "Ela entra com este e-mail e senha, e já nasce vinculada ao seu salão."}
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="flex flex-col gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="attendant-name">Nome</Label>
            <Input
              id="attendant-name"
              name="name"
              value={name}
              onChange={(event) => handleName(event.target.value)}
              required
              maxLength={80}
              autoComplete="off"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="attendant-whatsapp">WhatsApp</Label>
            <PhoneInput
              id="attendant-whatsapp"
              name="whatsapp"
              defaultValue={attendant?.whatsapp ?? ""}
              required
            />
          </div>

          {isEdit ? null : (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="attendant-slug">Link da página pública</Label>
                <Input
                  id="attendant-slug"
                  name="slug"
                  value={slug}
                  onChange={(event) => {
                    setSlugTouched(true);
                    setSlug(event.target.value);
                  }}
                  required
                  autoComplete="off"
                />
                <p className="text-xs text-muted-foreground">
                  É por onde as clientes dela marcam horário: /{slug || "nome-da-atendente"}
                </p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="attendant-email">E-mail de acesso</Label>
                <Input
                  id="attendant-email"
                  name="email"
                  type="email"
                  required
                  autoComplete="off"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="attendant-password">Senha provisória</Label>
                <Input
                  id="attendant-password"
                  name="password"
                  type="password"
                  required
                  minLength={6}
                  autoComplete="new-password"
                />
                <p className="text-xs text-muted-foreground">
                  Pelo menos 6 caracteres. Combine com ela e peça para trocar depois do primeiro
                  acesso.
                </p>
              </div>
            </>
          )}

          {state && !state.ok ? (
            <p role="alert" className="text-sm text-destructive">
              {state.error}
            </p>
          ) : null}

          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Salvando…" : isEdit ? "Salvar" : "Cadastrar atendente"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
