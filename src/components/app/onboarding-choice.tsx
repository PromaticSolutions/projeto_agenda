"use client";

import { useActionState, useState } from "react";
import { ArrowLeft, Store, UserRound } from "lucide-react";
import { createSalonAction, type SalonOnboardingState } from "@/app/app/onboarding/actions";
import { OnboardingForm } from "@/components/app/onboarding-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type Choice = null | "autonoma" | "salao";

/**
 * A bifurcação do onboarding: profissional autônoma ou salão.
 *
 * Fica aqui, e não no /signup, porque o cadastro é só e-mail e senha do
 * Supabase Auth — o que a pessoa É se decide depois, junto com o resto do
 * perfil. Mexer no /signup obrigaria a carregar a escolha por dentro do fluxo
 * de autenticação sem ganho nenhum.
 *
 * O ramo "autônoma" entrega o `OnboardingForm` de sempre, sem uma linha de
 * diferença: é o caminho que já funcionava e que a maioria usa.
 */
export function OnboardingChoice() {
  const [choice, setChoice] = useState<Choice>(null);

  if (choice === "autonoma") {
    return (
      <div className="flex flex-col gap-4">
        <BackButton onClick={() => setChoice(null)} />
        <OnboardingForm />
      </div>
    );
  }

  if (choice === "salao") {
    return (
      <div className="flex flex-col gap-4">
        <BackButton onClick={() => setChoice(null)} />
        <SalonForm />
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <ChoiceCard
        icon={UserRound}
        title="Trabalho por conta"
        description="Você atende suas clientes. Tem sua própria agenda, sua página de agendamento e seu WhatsApp."
        footnote="É o caminho da maioria. Dá para entrar num salão depois."
        onClick={() => setChoice("autonoma")}
      />
      <ChoiceCard
        icon={Store}
        title="Tenho um salão"
        description="Você gerencia atendentes. Cadastra cada uma, e acompanha a agenda, as clientes e as conversas delas."
        footnote="A gerente não tem agenda nem página pública própria."
        onClick={() => setChoice("salao")}
      />
    </div>
  );
}

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
    >
      <ArrowLeft className="size-4" aria-hidden />
      Voltar
    </button>
  );
}

function ChoiceCard({
  icon: Icon,
  title,
  description,
  footnote,
  onClick,
}: {
  icon: typeof UserRound;
  title: string;
  description: string;
  footnote: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex flex-col gap-2 rounded-3xl bg-card p-6 text-left shadow-xl shadow-plum-900/5 ring-1 ring-plum-900/5",
        "transition-transform hover:-translate-y-0.5 focus-visible:-translate-y-0.5",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      )}
    >
      <Icon className="size-6 text-primary" aria-hidden />
      <span className="text-base font-semibold text-foreground">{title}</span>
      <span className="text-sm text-muted-foreground">{description}</span>
      <span className="mt-1 text-xs text-muted-foreground/80">{footnote}</span>
    </button>
  );
}

function SalonForm() {
  const [state, formAction, pending] = useActionState<SalonOnboardingState, FormData>(
    createSalonAction,
    null
  );

  return (
    <div className="rounded-3xl bg-card p-6 shadow-xl shadow-plum-900/5 ring-1 ring-plum-900/5">
      <div className="mb-5">
        <h2 className="text-lg font-semibold text-foreground">Vamos abrir seu salão</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Depois disso você cadastra suas atendentes — cada uma ganha a própria agenda, página e
          WhatsApp, e enxerga só os dados dela.
        </p>
      </div>

      <form action={formAction} className="flex flex-col gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="salonName">Nome do salão</Label>
          <Input id="salonName" name="salonName" required maxLength={80} autoComplete="off" />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="managerName">Seu nome</Label>
          <Input id="managerName" name="managerName" required maxLength={80} autoComplete="name" />
          <p className="text-xs text-muted-foreground">
            Aparece para você na gerência. Suas atendentes não veem esta tela.
          </p>
        </div>

        {state && !state.ok ? (
          <p role="alert" className="text-sm text-destructive">
            {state.error}
          </p>
        ) : null}

        <Button type="submit" disabled={pending} className="w-full">
          {pending ? "Abrindo…" : "Abrir salão"}
        </Button>
      </form>
    </div>
  );
}
