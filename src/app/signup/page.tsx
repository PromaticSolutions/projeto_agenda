import { SignupForm } from "@/components/auth/signup-form";
import { DemoModeNotice } from "@/components/auth/demo-mode-notice";
import { AuthShell, AuthHeading, AuthSwitch } from "@/components/auth/auth-shell";
import { TrialTerms } from "@/components/landing/signup-cta";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export const metadata = { title: "Criar conta — Timely" };

export default function SignupPage() {
  return (
    <AuthShell>
      {!isSupabaseConfigured && <DemoModeNotice />}

      {/* É aqui que todo "Começar grátis" da landing termina: as condições da
          oferta se repetem logo abaixo do título, para a pessoa confirmar que
          chegou no lugar prometido antes de digitar qualquer coisa. */}
      <AuthHeading
        title="Crie sua conta grátis"
        description="Em poucos minutos o seu link de agendamento está no ar."
      >
        <TrialTerms className="mt-4" />
      </AuthHeading>

      <SignupForm />

      <AuthSwitch question="Já tem conta?" href="/login" action="Entrar" />
    </AuthShell>
  );
}
