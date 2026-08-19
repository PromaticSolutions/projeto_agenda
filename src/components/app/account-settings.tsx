"use client";

import { useActionState, useState, type FormEvent } from "react";
import { Check, ExternalLink, LoaderCircle, Save, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { updateAccountAction, type AccountActionState } from "@/app/app/(dashboard)/account/actions";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PhoneInput } from "@/components/ui/phone-input";
import { ImageUploadField } from "@/components/app/image-upload-field";
import { getStudioPublicUrl } from "@/lib/format";
import type { Studio } from "@/lib/types";

function PasswordPanel() {
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [pending, setPending] = useState(false);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isSupabaseConfigured) {
      return toast.info("A troca de senha só fica disponível com o Supabase configurado.");
    }
    if (password.length < 6) return toast.error("Use pelo menos 6 caracteres na nova senha.");
    if (password !== confirmation) return toast.error("As senhas não coincidem.");

    setPending(true);
    const { error } = await createBrowserSupabaseClient().auth.updateUser({ password });
    setPending(false);
    if (error) return toast.error(error.message);

    setPassword("");
    setConfirmation("");
    setSuccess(true);
    toast.success("Senha atualizada com segurança.");
  }

  return (
    <section className="panel">
      <header className="border-b border-border px-4 py-3">
        <h2 className="font-medium text-foreground">Segurança</h2>
        <p className="text-sm text-muted-foreground">Troque sua senha sempre que precisar.</p>
      </header>

      <form onSubmit={handleSubmit} className="grid gap-4 p-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="new-password">Nova senha</Label>
          <Input
            id="new-password"
            type="password"
            autoComplete="new-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="confirm-password">Confirmar nova senha</Label>
          <Input
            id="confirm-password"
            type="password"
            autoComplete="new-password"
            required
            value={confirmation}
            onChange={(e) => setConfirmation(e.target.value)}
          />
        </div>
        <div className="flex items-center justify-between gap-3 sm:col-span-2">
          <p className="text-xs text-muted-foreground">Use ao menos 6 caracteres.</p>
          <Button type="submit" disabled={pending} className="bg-cta text-white hover:opacity-90">
            {pending ? (
              <LoaderCircle className="size-4 animate-spin" />
            ) : success ? (
              <Check className="size-4" />
            ) : (
              <ShieldCheck className="size-4" />
            )}
            {pending ? "Atualizando..." : success ? "Senha atualizada" : "Atualizar senha"}
          </Button>
        </div>
      </form>
    </section>
  );
}

export function AccountSettings({ studio }: { studio: Studio }) {
  const [state, formAction, pending] = useActionState<AccountActionState, FormData>(
    updateAccountAction,
    null
  );
  const [name, setName] = useState(studio.name);
  const [slug, setSlug] = useState(studio.slug);
  const [color, setColor] = useState(studio.brand_color);
  const publicUrl = getStudioPublicUrl(slug || studio.slug);

  return (
    <div className="flex flex-col gap-5">
      <form action={formAction} className="flex flex-col gap-5">
        <section className="panel">
          <header className="border-b border-border px-4 py-3">
            <h2 className="font-medium text-foreground">Informações públicas</h2>
            <p className="text-sm text-muted-foreground">
              Aparecem para os clientes na página de agendamento.
            </p>
          </header>

          <div className="grid gap-4 p-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="account-name">Nome do estúdio</Label>
              <Input
                id="account-name"
                name="name"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="account-whatsapp">WhatsApp</Label>
              <PhoneInput
                id="account-whatsapp"
                name="whatsapp"
                required
                defaultValue={studio.whatsapp.replace(/^55/, "")}
              />
            </div>

            <div className="flex flex-col gap-2 sm:col-span-2">
              <Label htmlFor="account-slug">Link público</Label>
              <div className="flex overflow-hidden rounded-md border border-input bg-background focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50">
                <span className="flex items-center bg-muted px-3 text-sm text-muted-foreground">/</span>
                <Input
                  id="account-slug"
                  name="slug"
                  required
                  value={slug}
                  onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                  className="rounded-none border-0 focus-visible:ring-0"
                />
              </div>
            </div>

            <div className="flex flex-col gap-2 sm:col-span-2">
              <Label htmlFor="account-color">Cor da marca</Label>
              <div className="flex h-9 w-fit items-center gap-3 rounded-md border border-input px-2">
                <input
                  id="account-color"
                  name="brand_color"
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="size-6 cursor-pointer rounded-sm border-0 bg-transparent p-0"
                />
                <span className="font-mono text-sm uppercase text-muted-foreground">{color}</span>
              </div>
            </div>
          </div>
        </section>

        <section className="panel">
          <header className="border-b border-border px-4 py-3">
            <h2 className="font-medium text-foreground">Imagens</h2>
            <p className="text-sm text-muted-foreground">
              Aparecem na sua página de agendamento. JPG, PNG, WebP ou AVIF, até 4 MB.
            </p>
          </header>

          <div className="grid gap-5 p-4 sm:grid-cols-2">
            <ImageUploadField
              kind="logo"
              name="logo_url"
              label="Logo"
              aspect="square"
              defaultValue={studio.logo_url}
              hint="Exibido no topo da página pública."
              systemDefault={{
                label: "Usar a marca do Agenda Online",
                description: "Sem logo próprio, é esta a imagem que sua cliente vê.",
              }}
              // Só arquivo: no logo a escolha é entre a marca do sistema e uma
              // imagem sua. Colar endereço de terceiro abria porta para o logo
              // sumir da página no dia em que aquele site saísse do ar.
              allowUrl={false}
            />
            <ImageUploadField
              kind="banner"
              name="banner_url"
              label="Banner"
              aspect="wide"
              defaultValue={studio.banner_url}
              hint="Imagem de capa da página pública."
            />
          </div>
        </section>

        {state && !state.ok && <p className="text-sm text-destructive">{state.error}</p>}
        {state?.ok && (
          <p className="flex items-center gap-1.5 text-sm font-medium text-emerald-600">
            <Check className="size-4" />
            {state.message}
          </p>
        )}

        <div className="flex items-center justify-between gap-3">
          <a
            href={publicUrl}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            <ExternalLink className="size-4" /> Abrir página pública
          </a>
          <Button type="submit" disabled={pending} className="bg-cta text-white hover:opacity-90">
            {pending ? <LoaderCircle className="size-4 animate-spin" /> : <Save className="size-4" />}
            {pending ? "Salvando..." : "Salvar alterações"}
          </Button>
        </div>
      </form>

      <PasswordPanel />
    </div>
  );
}
