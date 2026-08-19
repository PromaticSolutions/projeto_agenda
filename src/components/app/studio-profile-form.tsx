"use client";

import { useActionState, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  saveStudioProfileAction,
  type SettingsFormState,
} from "@/app/app/(dashboard)/settings/actions";
import { onlyDigits } from "@/lib/validation";
import type { Studio } from "@/lib/types";

/** 000.000.000-00 enquanto digita; o servidor volta a guardar só os dígitos. */
function maskCpf(value: string): string {
  const digits = onlyDigits(value).slice(0, 11);
  return digits
    .replace(/^(\d{3})(\d)/, "$1.$2")
    .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/^(\d{3})\.(\d{3})\.(\d{3})(\d)/, "$1.$2.$3-$4");
}

export function StudioProfileForm({ studio, email }: { studio: Studio; email: string | null }) {
  const [state, formAction, pending] = useActionState<SettingsFormState, FormData>(
    saveStudioProfileAction,
    null
  );
  const [cpf, setCpf] = useState(maskCpf(studio.owner_cpf ?? ""));

  const [lastState, setLastState] = useState(state);
  if (state !== lastState) {
    setLastState(state);
    if (state?.ok) toast.success("Dados atualizados");
  }

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <section className="panel">
        <header className="border-b border-border px-4 py-3">
          <h2 className="font-medium text-foreground">Responsável</h2>
          <p className="text-sm text-muted-foreground">Quem responde pelo estabelecimento.</p>
        </header>

        <div className="grid gap-4 p-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="owner_name">Nome</Label>
            <Input
              id="owner_name"
              name="owner_name"
              defaultValue={studio.owner_name ?? ""}
              placeholder="Nome completo"
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="owner_cpf">CPF</Label>
            <Input
              id="owner_cpf"
              name="owner_cpf"
              inputMode="numeric"
              value={cpf}
              onChange={(e) => setCpf(maskCpf(e.target.value))}
              placeholder="000.000.000-00"
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="owner_birth_date">Data de nascimento</Label>
            <Input
              id="owner_birth_date"
              name="owner_birth_date"
              type="date"
              defaultValue={studio.owner_birth_date ?? ""}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="email">E-mail cadastrado</Label>
            <Input id="email" value={email ?? "—"} readOnly disabled />
            <p className="text-xs text-muted-foreground">
              Alterado pelo fluxo de autenticação, que confirma o endereço novo.
            </p>
          </div>
        </div>
      </section>

      <section className="panel">
        <header className="border-b border-border px-4 py-3">
          <h2 className="font-medium text-foreground">Estabelecimento</h2>
          <p className="text-sm text-muted-foreground">Identificação do salão no sistema.</p>
        </header>

        <div className="grid gap-4 p-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="salon_name">Nome do salão</Label>
            <Input id="salon_name" name="salon_name" required defaultValue={studio.name} />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="acquired_at">Data de aquisição</Label>
            <Input
              id="acquired_at"
              name="acquired_at"
              type="date"
              defaultValue={studio.acquired_at ?? ""}
            />
            <p className="text-xs text-muted-foreground">Quando o sistema foi contratado.</p>
          </div>
        </div>
      </section>

      {state && !state.ok && <p className="text-sm text-destructive">{state.error}</p>}

      <div className="flex justify-end">
        <Button type="submit" disabled={pending} className="bg-cta text-white hover:opacity-90">
          {pending ? "Salvando..." : "Salvar alterações"}
        </Button>
      </div>
    </form>
  );
}
