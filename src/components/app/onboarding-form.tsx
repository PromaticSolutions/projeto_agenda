"use client";

import { useActionState, useState } from "react";
import { createStudioAction } from "@/app/app/onboarding/actions";
import { slugify } from "@/lib/slugify";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PhoneInput } from "@/components/ui/phone-input";

export function OnboardingForm() {
  const [state, formAction, pending] = useActionState(createStudioAction, null);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);

  function handleNameChange(value: string) {
    setName(value);
    if (!slugTouched) setSlug(slugify(value));
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="name">Nome do estúdio</Label>
        <Input
          id="name"
          name="name"
          required
          placeholder="Bella Studio"
          value={name}
          onChange={(e) => handleNameChange(e.target.value)}
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="slug">Link público</Label>
        <div className="flex items-center gap-1 text-sm text-muted-foreground">
          <span className="whitespace-nowrap">agenda-online.app/</span>
          <Input
            id="slug"
            name="slug"
            required
            className="text-foreground"
            value={slug}
            onChange={(e) => {
              setSlugTouched(true);
              setSlug(slugify(e.target.value));
            }}
          />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="whatsapp">WhatsApp (com DDD)</Label>
        <PhoneInput id="whatsapp" name="whatsapp" required />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="brand_color">Cor da marca</Label>
        <div className="flex items-center gap-2">
          <Input
            id="brand_color"
            name="brand_color"
            type="color"
            defaultValue="#7C3AED"
            className="h-10 w-14 p-1"
          />
          <span className="text-sm text-muted-foreground">Aparece nos botões da sua página pública.</span>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="logo_url">URL do logo (opcional)</Label>
        <Input id="logo_url" name="logo_url" type="url" placeholder="https://..." />
      </div>

      {state && !state.ok && <p className="text-sm text-destructive">{state.error}</p>}

      <Button type="submit" className="bg-cta text-white hover:opacity-90" disabled={pending}>
        {pending ? "Criando..." : "Criar estúdio"}
      </Button>
    </form>
  );
}
