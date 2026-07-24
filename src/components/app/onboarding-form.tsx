"use client";

import { useActionState, useState } from "react";
import { createStudioAction } from "@/app/app/onboarding/actions";
import { slugify } from "@/lib/slugify";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PhoneInput } from "@/components/ui/phone-input";
import { OnboardingPreview } from "@/components/app/onboarding-preview";
import { cn } from "@/lib/utils";

const STEPS = ["Identidade", "Link e cor", "Contato"] as const;

export function OnboardingForm() {
  const [state, formAction, pending] = useActionState(createStudioAction, null);
  const [step, setStep] = useState(0);
  const [stepError, setStepError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [brandColor, setBrandColor] = useState("#7C3AED");
  const [logoUrl, setLogoUrl] = useState("");

  function handleNameChange(value: string) {
    setName(value);
    if (!slugTouched) setSlug(slugify(value));
  }

  function goNext() {
    if (step === 0 && !name.trim()) {
      setStepError("Digite o nome do seu estúdio.");
      return;
    }
    if (step === 1 && !slug.trim()) {
      setStepError("Escolha um link público.");
      return;
    }
    setStepError(null);
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }

  function goBack() {
    setStepError(null);
    setStep((s) => Math.max(s - 1, 0));
  }

  return (
    <div className="flex flex-col gap-6 md:grid md:grid-cols-[1fr_280px] md:items-start md:gap-8">
      <OnboardingPreview
        className="md:order-2"
        name={name}
        slug={slug}
        brandColor={brandColor}
        logoUrl={logoUrl}
      />

      <div className="rounded-3xl bg-card p-6 shadow-xl shadow-plum-900/5 ring-1 ring-plum-900/5 md:order-1">
        <div className="mb-5 flex flex-col gap-2">
          <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
            <span>
              Etapa {step + 1} de {STEPS.length}
            </span>
            <span>{STEPS[step]}</span>
          </div>
          <div className="flex gap-1.5">
            {STEPS.map((label, i) => (
              <div
                key={label}
                className={cn("h-1 flex-1 rounded-full transition-colors", i <= step ? "bg-cta" : "bg-muted")}
              />
            ))}
          </div>
        </div>

        <form action={formAction} className="flex flex-col gap-4">
          <div className={cn("flex flex-col gap-4", step !== 0 && "hidden")}>
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
              <Label htmlFor="logo_url">URL do logo (opcional)</Label>
              <Input
                id="logo_url"
                name="logo_url"
                type="url"
                placeholder="https://..."
                value={logoUrl}
                onChange={(e) => setLogoUrl(e.target.value)}
              />
            </div>
          </div>

          <div className={cn("flex flex-col gap-4", step !== 1 && "hidden")}>
            <div className="flex flex-col gap-2">
              <Label htmlFor="slug">Link público</Label>
              <div className="flex items-stretch overflow-hidden rounded-lg border border-input focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50">
                <span className="flex items-center whitespace-nowrap bg-muted px-2.5 text-sm text-muted-foreground">
                  agenda-online.app/
                </span>
                <Input
                  id="slug"
                  name="slug"
                  required
                  className="rounded-none border-0 text-foreground focus-visible:ring-0"
                  value={slug}
                  onChange={(e) => {
                    setSlugTouched(true);
                    setSlug(slugify(e.target.value));
                  }}
                />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="brand_color">Cor da marca</Label>
              <div className="flex items-center gap-3 rounded-xl border border-input px-2.5 py-2">
                <div className="relative size-8 shrink-0 overflow-hidden rounded-full ring-1 ring-plum-900/10">
                  <Input
                    id="brand_color"
                    name="brand_color"
                    type="color"
                    value={brandColor}
                    onChange={(e) => setBrandColor(e.target.value)}
                    className="size-12 -translate-x-2 -translate-y-2 cursor-pointer border-0 p-0"
                  />
                </div>
                <div className="min-w-0">
                  <p className="font-mono text-sm text-foreground uppercase">{brandColor}</p>
                  <p className="text-xs text-muted-foreground">Aparece nos botões da sua página pública.</p>
                </div>
              </div>
            </div>
          </div>

          <div className={cn("flex flex-col gap-4", step !== 2 && "hidden")}>
            <div className="flex flex-col gap-2">
              <Label htmlFor="whatsapp">WhatsApp (com DDD)</Label>
              <PhoneInput id="whatsapp" name="whatsapp" required />
            </div>
          </div>

          {stepError && <p className="text-sm text-destructive">{stepError}</p>}
          {state && !state.ok && <p className="text-sm text-destructive">{state.error}</p>}

          <div className="flex items-center justify-between gap-3 pt-2">
            {step > 0 ? (
              <Button type="button" variant="ghost" onClick={goBack}>
                Voltar
              </Button>
            ) : (
              <span />
            )}
            {step < STEPS.length - 1 ? (
              <Button type="button" onClick={goNext} className="bg-cta text-white hover:opacity-90">
                Continuar
              </Button>
            ) : (
              <Button type="submit" disabled={pending} className="bg-cta text-white hover:opacity-90">
                {pending ? "Criando..." : "Criar estúdio"}
              </Button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
