import Link from "next/link";
import { Suspense } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LoginForm } from "@/components/auth/login-form";
import { DemoModeNotice } from "@/components/auth/demo-mode-notice";
import { BrandMark } from "@/components/auth/brand-mark";
import { AuthShell, AuthFooter, AUTH_CARD_CLASS } from "@/components/auth/auth-shell";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export const metadata = { title: "Entrar — Timely" };

export default function LoginPage() {
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
          <CardTitle className="text-2xl leading-tight text-white">Entrar</CardTitle>
          <CardDescription className="mt-1.5 text-sm leading-6 text-blush-50/70">
            Acompanhe cada atendimento do dia.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-6 pb-6">
          <Suspense>
            <LoginForm />
          </Suspense>
          {/* Separado por uma régua em vez de solto embaixo do botão: o
              caminho de quem NÃO tem conta é outro assunto, e a divisa deixa
              isso legível sem precisar de mais um título. */}
          <div className="mt-6 border-t border-white/10 pt-4 text-center">
            <p className="text-sm text-blush-50/70">
              Ainda não tem conta?{" "}
              <Link
                href="/signup"
                className="font-medium text-blush-50 underline underline-offset-4 hover:text-white"
              >
                Criar estúdio
              </Link>
            </p>
          </div>
        </CardContent>
      </Card>

      <AuthFooter />
    </AuthShell>
  );
}
