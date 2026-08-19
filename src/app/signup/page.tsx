import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SignupForm } from "@/components/auth/signup-form";
import { DemoModeNotice } from "@/components/auth/demo-mode-notice";
import { BrandMark } from "@/components/auth/brand-mark";
import { AuthShell, AUTH_CARD_CLASS } from "@/components/auth/auth-shell";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export const metadata = { title: "Criar conta — Agenda Online" };

export default function SignupPage() {
  return (
    <AuthShell>
      <BrandMark />
      {!isSupabaseConfigured && (
        <div className="w-full max-w-sm">
          <DemoModeNotice />
        </div>
      )}

      <Card className={AUTH_CARD_CLASS}>
        <CardHeader className="px-6 pt-6 pb-5">
          <CardTitle className="text-2xl leading-tight text-white">Criar estúdio</CardTitle>
          <CardDescription className="mt-1.5 text-sm leading-6 text-blush-50/70">
            Em poucos minutos seu link de agendamento está pronto.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-6 pb-6">
          <SignupForm />
          <p className="mt-4 text-center text-sm text-blush-50/70">
            Já tem conta?{" "}
            <Link
              href="/login"
              className="font-medium text-blush-50 underline underline-offset-4 hover:text-white"
            >
              Entrar
            </Link>
          </p>
        </CardContent>
      </Card>
    </AuthShell>
  );
}
