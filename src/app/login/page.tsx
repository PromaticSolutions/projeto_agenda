import { Suspense } from "react";
import { LoginForm } from "@/components/auth/login-form";
import { DemoModeNotice } from "@/components/auth/demo-mode-notice";
import { AuthShell, AuthHeading, AuthSwitch } from "@/components/auth/auth-shell";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export const metadata = { title: "Entrar — Timely" };

export default function LoginPage() {
  return (
    <AuthShell>
      {!isSupabaseConfigured && <DemoModeNotice />}

      <AuthHeading
        title="Que bom te ver de novo"
        description="Entre para acompanhar sua agenda, suas clientes e seus lembretes."
      />

      <Suspense>
        <LoginForm />
      </Suspense>

      {/* "Começar grátis", e não "Criar estúdio": é a mesma porta da landing,
          com o mesmo nome — quem veio de lá reconhece o caminho. */}
      <AuthSwitch question="Ainda não tem conta?" href="/signup" action="Começar grátis" />
    </AuthShell>
  );
}
